import { IsOptional, IsString, IsInt, Min, IsDateString } from 'class-validator'

export class CreateInviteDto {
  @IsOptional()
  @IsString()
  label?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number

  @IsOptional()
  @IsDateString()
  expiresAt?: string
}
