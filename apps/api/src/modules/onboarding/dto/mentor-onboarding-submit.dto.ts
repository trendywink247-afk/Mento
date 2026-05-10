import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import { Type } from 'class-transformer'
import { MentorJourney } from '@prisma/client'

export class AttemptYearDto {
  @IsInt()
  @Min(2010)
  @Max(2100)
  year!: number

  @IsBoolean()
  prelims!: boolean

  @IsBoolean()
  mains!: boolean

  @IsBoolean()
  interview!: boolean
}

export class MentorOnboardingSubmitDto {
  @IsEnum(MentorJourney)
  journeyType!: MentorJourney

  @IsBoolean()
  prelimsCleared!: boolean

  @IsInt()
  @Min(0)
  @Max(20)
  mainsAttempts!: number

  @IsInt()
  @Min(0)
  @Max(20)
  interviewAttempts!: number

  @IsArray()
  @Type(() => AttemptYearDto)
  attemptHistory!: AttemptYearDto[]

  @IsOptional()
  @IsInt()
  @Min(1)
  rankAchieved?: number

  @IsOptional()
  @IsString()
  @MaxLength(120)
  optionalSubject?: string

  @IsArray()
  @IsString({ each: true })
  guidanceCategories!: string[]

  @IsArray()
  @IsString({ each: true })
  languages!: string[]

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(10000)
  hourlyRateInr?: number
}
