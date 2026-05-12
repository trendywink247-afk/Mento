import { IsEnum, IsString, Matches } from 'class-validator'
import { Platform } from '@prisma/client'

export class RegisterPushTokenDto {
  @IsString()
  @Matches(/^ExponentPushToken\[.+\]$|^[a-zA-Z0-9_-]{20,}$/, {
    message: 'token must be a valid Expo push token',
  })
  token!: string

  @IsEnum(Platform, { message: 'platform must be IOS, ANDROID, or WEB' })
  platform!: Platform
}
