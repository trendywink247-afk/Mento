import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'
import { UserStatus } from '@prisma/client'

export class SetUserStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string
}
