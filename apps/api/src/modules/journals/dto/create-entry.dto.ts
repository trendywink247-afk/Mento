import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'
import { JournalEntryType } from '@prisma/client'

export class CreateEntryDto {
  @IsEnum(JournalEntryType)
  type!: JournalEntryType

  @IsString()
  @MaxLength(20000)
  content!: string

  @IsOptional()
  @IsUUID()
  sourceMessageId?: string
}
