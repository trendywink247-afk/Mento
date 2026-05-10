import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common'
import { Role } from '@prisma/client'
import { Roles } from '../auth/decorators/roles.decorator'
import { AssignmentsService } from './assignments.service'
import { CreateAssignmentDto } from './dto/create-assignment.dto'

@Controller('assignments')
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Roles(Role.ADMIN)
  @Get()
  list() {
    return this.assignments.list()
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() body: CreateAssignmentDto) {
    return this.assignments.create(body.mentorId, body.aspirantId)
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  end(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.assignments.end(id)
  }
}
