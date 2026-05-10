import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator'

export class CreateChatRequestDto {
  @IsUUID()
  mentorId!: string

  @IsString()
  @MinLength(1)
  @MaxLength(160) // Section 1.7: 160-char intro
  intro!: string
}
