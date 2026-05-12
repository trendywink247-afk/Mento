import { IsIn, IsNumber, IsString, Max, Min } from 'class-validator'

export const DOCUMENT_KINDS = ['aadhaar', 'hall_ticket', 'marks_sheet'] as const
export const ALL_KINDS = [...DOCUMENT_KINDS, 'avatar'] as const
export type UploadKind = (typeof ALL_KINDS)[number]

export const ALLOWED_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

/** 5 MB for documents, 2 MB for avatars */
export const MAX_BYTES_DOCUMENT = 5 * 1024 * 1024
export const MAX_BYTES_AVATAR = 2 * 1024 * 1024

export class PresignUploadDto {
  @IsIn(ALL_KINDS)
  kind!: UploadKind

  @IsIn(ALLOWED_MIMES)
  mime!: string

  @IsNumber()
  @Min(1)
  @Max(MAX_BYTES_DOCUMENT) // actual per-kind enforcement in service
  sizeBytes!: number
}
