import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'
import { JourneyStage } from '@prisma/client'

export class MirrorSubmitDto {
  @IsEnum(JourneyStage)
  journeyStage!: JourneyStage

  @IsOptional()
  @IsString()
  @MaxLength(120)
  background?: string

  // { polity: 0..1, history: 0..1, ... } — 0 = no idea, 1 = strong
  @IsOptional()
  @IsObject()
  knowledge?: Record<string, number>

  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(12)
  challenges!: string[]
}
