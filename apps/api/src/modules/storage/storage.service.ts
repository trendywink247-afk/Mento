import * as fs from 'node:fs'
import * as path from 'node:path'
import * as crypto from 'node:crypto'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import {
  type UploadKind,
  DOCUMENT_KINDS,
  ALLOWED_MIMES,
  MAX_BYTES_DOCUMENT,
  MAX_BYTES_AVATAR,
} from './dto/presign-upload.dto'

const EXT_MAP: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)
  private readonly s3: S3Client | null
  private readonly bucket: string
  private readonly r2Enabled: boolean

  constructor(private readonly config: ConfigService) {
    const enabled = config.get<string>('R2_ENABLED') === 'true'
    this.r2Enabled = enabled && !!config.get<string>('R2_ACCESS_KEY_ID')

    if (this.r2Enabled) {
      const accountId = config.get<string>('R2_ACCOUNT_ID') ?? ''
      this.s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: config.get<string>('R2_ACCESS_KEY_ID') ?? '',
          secretAccessKey: config.get<string>('R2_SECRET_ACCESS_KEY') ?? '',
        },
      })
    } else {
      this.s3 = null
      this.logger.warn(
        'R2_ENABLED not set — using local-disk dev mode for file storage',
      )
    }

    this.bucket = config.get<string>('R2_BUCKET_MEDIA') ?? 'mento-media-dev'
  }

  /**
   * Generate a pre-signed PUT URL (5 min TTL).
   * In dev mode (no R2 credentials) returns a fake local /dev-upload URL
   * so the full upload → submit flow can be exercised without real cloud access.
   */
  async presignUpload(
    userId: string,
    kind: UploadKind,
    mime: string,
    sizeBytes: number,
  ): Promise<{ uploadUrl: string; publicKey: string; expiresIn: number }> {
    // Validate mime
    if (!(ALLOWED_MIMES as readonly string[]).includes(mime)) {
      throw new BadRequestException(
        `Unsupported MIME type. Allowed: ${ALLOWED_MIMES.join(', ')}`,
      )
    }

    // Validate size per kind
    const maxBytes = kind === 'avatar' ? MAX_BYTES_AVATAR : MAX_BYTES_DOCUMENT
    if (sizeBytes > maxBytes) {
      throw new BadRequestException(
        `File too large for kind "${kind}". Max: ${maxBytes / (1024 * 1024)} MB`,
      )
    }

    const ext = EXT_MAP[mime] ?? 'bin'
    const id = crypto.randomUUID()
    const publicKey = `verification/${userId}/${kind}/${id}.${ext}`
    const expiresIn = 300 // 5 minutes

    if (!this.r2Enabled) {
      // Dev mode — return a local endpoint URL. The /dev-upload endpoint (in
      // the controller) will write to disk and the key acts as the logical path.
      const apiBase =
        this.config.get<string>('API_BASE_URL') ?? 'http://localhost:4000'
      const uploadUrl = `${apiBase}/dev-upload/${encodeURIComponent(publicKey)}?mime=${encodeURIComponent(mime)}`
      return { uploadUrl, publicKey, expiresIn }
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: publicKey,
      ContentType: mime,
      ContentLength: sizeBytes,
    })

    const uploadUrl = await getSignedUrl(this.s3!, command, { expiresIn })
    return { uploadUrl, publicKey, expiresIn }
  }

  /**
   * Generate a pre-signed GET URL (5 min TTL) for admin document review.
   * In dev mode returns a /dev-read URL that serves from local disk.
   */
  async presignRead(key: string): Promise<string> {
    const expiresIn = 300

    if (!this.r2Enabled) {
      const apiBase =
        this.config.get<string>('API_BASE_URL') ?? 'http://localhost:4000'
      return `${apiBase}/dev-read/${encodeURIComponent(key)}`
    }

    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key })
    return getSignedUrl(this.s3!, command, { expiresIn })
  }

  /**
   * Dev-only: write a file to local disk under apps/api/.local-storage/<key>.
   * Called by the /dev-upload controller.
   */
  writeLocalFile(key: string, data: Buffer, mime: string): void {
    const localRoot = path.resolve(process.cwd(), '.local-storage')
    const dest = path.join(localRoot, key)
    const dir = path.dirname(dest)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(dest, data)
    this.logger.debug(`[dev-upload] wrote ${dest} (${mime})`)
  }

  /**
   * Dev-only: read a file from local disk.
   * Called by the /dev-read controller.
   */
  readLocalFile(key: string): { data: Buffer; exists: boolean } {
    const localRoot = path.resolve(process.cwd(), '.local-storage')
    const src = path.join(localRoot, key)
    if (!fs.existsSync(src)) return { data: Buffer.alloc(0), exists: false }
    return { data: fs.readFileSync(src), exists: true }
  }

  isDevMode(): boolean {
    return !this.r2Enabled
  }

  /** Derive content-type from key extension (best-effort for dev-read). */
  mimeFromKey(key: string): string {
    const ext = path.extname(key).toLowerCase().replace('.', '')
    const map: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    }
    return map[ext] ?? 'application/octet-stream'
  }

  /** Returns the set of document kinds (not 'avatar'). */
  isDocumentKind(kind: string): boolean {
    return (DOCUMENT_KINDS as readonly string[]).includes(kind)
  }
}
