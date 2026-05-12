import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator'

export class CreateSessionRequestDto {
  @IsUUID()
  mentorId!: string

  @IsDateString()
  scheduledAt!: string

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(180)
  durationMin?: number

  @IsOptional()
  @IsString()
  @MaxLength(200)
  message?: string
}
