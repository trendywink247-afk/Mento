import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'

export enum ResolveAction {
  DISMISS = 'DISMISS',
  WARN = 'WARN',
  SUSPEND = 'SUSPEND',
  BAN = 'BAN',
}

export class ResolveReportDto {
  @IsEnum(ResolveAction)
  action!: ResolveAction

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string
}
