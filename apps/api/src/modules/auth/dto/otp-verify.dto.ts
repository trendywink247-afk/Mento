import { IsString, IsOptional, Matches } from 'class-validator'

export class OtpVerifyDto {
  @IsString()
  @Matches(/^\+\d{10,15}$/)
  phone!: string

  @IsString()
  @Matches(/^\d{6}$/, { message: 'OTP must be 6 digits' })
  code!: string

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9]{8}$/, { message: 'Invite code must be 8 uppercase alphanumeric characters' })
  inviteCode?: string
}
