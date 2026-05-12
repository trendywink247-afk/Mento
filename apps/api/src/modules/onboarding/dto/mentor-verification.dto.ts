import {
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator'
import { Type } from 'class-transformer'

export class BankAccountDto {
  @IsString()
  @IsNotEmpty()
  accountNumber!: string

  /** IFSC: 4 uppercase alpha + 0 + 6 alphanumeric */
  @IsString()
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, { message: 'IFSC code format is invalid' })
  ifsc!: string

  @IsString()
  @IsNotEmpty()
  beneficiaryName!: string

  @IsString()
  @IsOptional()
  upiId?: string
}

export class MentorVerificationDto {
  /** Storage key returned by POST /storage/presign for kind=aadhaar */
  @IsString()
  @IsNotEmpty()
  aadhaarKey!: string

  /** Storage key returned by POST /storage/presign for kind=hall_ticket */
  @IsString()
  @IsNotEmpty()
  hallTicketKey!: string

  /** Storage key returned by POST /storage/presign for kind=marks_sheet (optional) */
  @IsString()
  @IsOptional()
  marksSheetKey?: string

  /**
   * Last 4 digits of the Aadhaar number.
   *
   * NOTE: MVP only collects the last 4 digits — we never ask for or store the
   * full 12-digit Aadhaar number. The aadhaarHash is SHA-256 of the last-4
   * prefixed with the userId so it is unique per person even if two people share
   * the same last-4. In a production deployment with real Aadhaar OTP
   * verification this would be replaced with a hash of the verified full number.
   */
  @IsString()
  @Length(4, 4, { message: 'aadhaarLast4 must be exactly 4 digits' })
  @Matches(/^\d{4}$/, { message: 'aadhaarLast4 must be 4 digits' })
  aadhaarLast4!: string

  @ValidateNested()
  @Type(() => BankAccountDto)
  bankAccount!: BankAccountDto
}
