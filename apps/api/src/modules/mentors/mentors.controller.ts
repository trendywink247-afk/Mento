import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common'
import { MentorsService, type MentorListFilters } from './mentors.service'

@Controller('mentors')
export class MentorsController {
  constructor(private readonly mentors: MentorsService) {}

  @Get()
  list(
    @Query('prelimsCleared') prelimsCleared?: string,
    @Query('mainsAttempts') mainsAttempts?: string,
    @Query('interviewAttempted') interviewAttempted?: string,
    @Query('language') language?: string,
    @Query('optionalSubject') optionalSubject?: string,
    @Query('guidanceCategory') guidanceCategory?: string,
    @Query('maxRateInr') maxRateInr?: string,
    @Query('isVerified') isVerified?: string,
  ) {
    const filters: MentorListFilters = {
      prelimsCleared:
        prelimsCleared === 'true' ? true : prelimsCleared === 'false' ? false : undefined,
      mainsAttempts: mainsAttempts ? Number(mainsAttempts) : undefined,
      interviewAttempted: interviewAttempted === 'true',
      language,
      optionalSubject,
      guidanceCategory,
      maxRateInr: maxRateInr ? Number(maxRateInr) : undefined,
      isVerified: isVerified === 'true' ? true : isVerified === 'false' ? false : undefined,
    }
    return this.mentors.list(filters)
  }

  @Get(':id')
  detail(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.mentors.detail(id)
  }
}
