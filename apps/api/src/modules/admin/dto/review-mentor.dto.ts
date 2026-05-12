import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class RejectMentorDto {
  @IsString()
  @MinLength(5, { message: 'Reason must be at least 5 characters' })
  @MaxLength(1000)
  reason!: string
}

export class BanMentorDto {
  @IsString()
  @MinLength(5, { message: 'Reason must be at least 5 characters' })
  @MaxLength(1000)
  reason!: string
}

export class ApproveMentorDto {
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reviewNote?: string
}
