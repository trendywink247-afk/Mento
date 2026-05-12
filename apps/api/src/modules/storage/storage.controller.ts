import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator'
import { Public } from '../auth/decorators/public.decorator'
import { StorageService } from './storage.service'
import { PresignUploadDto } from './dto/presign-upload.dto'

@Controller()
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  /**
   * POST /storage/presign
   * Returns a pre-signed upload URL + the storage key the client will use to
   * reference the file after upload. Throttled at module level.
   */
  @Post('storage/presign')
  @HttpCode(200)
  presign(@CurrentUser() user: JwtUser, @Body() body: PresignUploadDto) {
    return this.storage.presignUpload(user.sub, body.kind, body.mime, body.sizeBytes)
  }

  // ------------------------------------------------------------------
  // DEV-ONLY routes — only active when R2 is not configured.
  // These are intentionally unauthenticated so a browser fetch() with the
  // signed-URL-style URL just works in local dev.
  // ------------------------------------------------------------------

  @Public()
  @Post('dev-upload/:key(*)')
  @HttpCode(200)
  async devUpload(
    @Param('key') key: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!this.storage.isDevMode()) {
      res.status(403).json({ message: 'Not in dev mode' })
      return
    }
    const mime = (req.query['mime'] as string | undefined) ?? 'application/octet-stream'
    const chunks: Buffer[] = []
    await new Promise<void>((resolve, reject) => {
      req.on('data', (chunk: Buffer) => chunks.push(chunk))
      req.on('end', resolve)
      req.on('error', reject)
    })
    const data = Buffer.concat(chunks)
    this.storage.writeLocalFile(key, data, mime)
    res.json({ ok: true, key })
  }

  @Public()
  @Get('dev-read/:key(*)')
  async devRead(@Param('key') key: string, @Res() res: Response) {
    if (!this.storage.isDevMode()) {
      res.status(403).json({ message: 'Not in dev mode' })
      return
    }
    const { data, exists } = this.storage.readLocalFile(key)
    if (!exists) {
      res.status(404).json({ message: 'File not found in local dev storage' })
      return
    }
    const mime = this.storage.mimeFromKey(key)
    res.setHeader('Content-Type', mime)
    res.send(data)
  }
}
