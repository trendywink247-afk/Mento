import { IsObject } from 'class-validator'

export class SetAvailabilityDto {
  @IsObject()
  availability!: Record<string, unknown>
}
