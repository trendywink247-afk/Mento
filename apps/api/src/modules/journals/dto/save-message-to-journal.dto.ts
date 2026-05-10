import { IsEnum, IsUUID } from 'class-validator'
import { JournalCategory } from '@prisma/client'

export class SaveMessageToJournalDto {
  @IsUUID()
  messageId!: string

  @IsEnum(JournalCategory)
  category!: JournalCategory
}
