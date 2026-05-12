import { IsOptional, IsString, MaxLength } from 'class-validator'

export class RespondSessionRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string
}
