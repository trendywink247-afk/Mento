import { IsString, Matches } from 'class-validator'

export class OtpRequestDto {
  @IsString()
  @Matches(/^\+\d{10,15}$/, { message: 'Phone must be in E.164 format e.g. +911234567890' })
  phone!: string
}
