import { IsEnum, IsString, MaxLength } from 'class-validator'
import { Role } from '@prisma/client'

export class RolePickDto {
  @IsString()
  @MaxLength(128)
  sessionId!: string

  @IsEnum(Role)
  role!: Role
}
