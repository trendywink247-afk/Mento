import { IsUUID } from 'class-validator'

export class CreateAssignmentDto {
  @IsUUID()
  mentorId!: string

  @IsUUID()
  aspirantId!: string
}
