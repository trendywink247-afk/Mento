import { IsString, IsNotEmpty } from 'class-validator'

export class GoogleSigninDto {
  @IsString()
  @IsNotEmpty()
  idToken!: string
}
