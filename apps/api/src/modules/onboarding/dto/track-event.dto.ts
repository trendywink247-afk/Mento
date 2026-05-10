import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator'

export class TrackEventDto {
  // Anonymous session id from the client (uuid). For pre-login events.
  @IsString()
  @MaxLength(128)
  sessionId!: string

  @IsString()
  @MaxLength(120)
  step!: string

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>
}
