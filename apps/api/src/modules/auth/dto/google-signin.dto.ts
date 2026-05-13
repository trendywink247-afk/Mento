import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator'

export class GoogleSigninDto {
  @IsString()
  @IsNotEmpty()
  idToken!: string

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9]{8}$/, { message: 'Invite code must be 8 uppercase alphanumeric characters' })
  inviteCode?: string
}
