import { IsString, Matches } from 'class-validator'

export class RedeemInviteDto {
  @IsString()
  @Matches(/^[A-Z0-9]{8}$/, { message: 'Invite code must be 8 uppercase alphanumeric characters' })
  code!: string
}
