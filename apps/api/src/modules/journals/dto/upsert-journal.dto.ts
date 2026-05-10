import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator'
import { JournalCategory } from '@prisma/client'

export class UpsertJournalDto {
  @IsEnum(JournalCategory)
  category!: JournalCategory

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string

  @IsOptional()
  @IsUUID()
  conversationId?: string
}
