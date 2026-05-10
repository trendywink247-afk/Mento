import { IsEnum, IsOptional, IsString, IsUrl, IsUUID, MaxLength } from 'class-validator'
import { MessageType } from '@prisma/client'

export class SendMessageDto {
  @IsUUID()
  conversationId!: string

  @IsEnum(MessageType)
  type!: MessageType

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  body?: string

  @IsOptional()
  @IsUrl()
  attachmentUrl?: string

  @IsUUID()
  clientMessageId!: string
}
