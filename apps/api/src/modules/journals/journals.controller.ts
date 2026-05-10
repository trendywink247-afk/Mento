import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common'
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator'
import { JournalsService } from './journals.service'
import { UpsertJournalDto } from './dto/upsert-journal.dto'
import { CreateEntryDto } from './dto/create-entry.dto'
import { SaveMessageToJournalDto } from './dto/save-message-to-journal.dto'

@Controller('journals')
export class JournalsController {
  constructor(private readonly journals: JournalsService) {}

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.journals.listForUser(user.sub)
  }

  @Post()
  upsert(@CurrentUser() user: JwtUser, @Body() body: UpsertJournalDto) {
    return this.journals.upsert(user.sub, body.category, body.conversationId, body.title)
  }

  @Get(':id')
  detail(@CurrentUser() user: JwtUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.journals.getJournal(id, user.sub)
  }

  @Get(':id/audit')
  audit(@CurrentUser() user: JwtUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.journals.getAuditLog(id, user.sub)
  }

  @Post(':id/entries')
  createEntry(
    @CurrentUser() user: JwtUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: CreateEntryDto,
  ) {
    return this.journals.createEntry(id, user.sub, body)
  }

  @Patch('entries/:entryId')
  updateEntry(
    @CurrentUser() user: JwtUser,
    @Param('entryId', new ParseUUIDPipe()) entryId: string,
    @Body() body: { content: string },
  ) {
    return this.journals.updateEntry(entryId, user.sub, body.content)
  }

  @Delete('entries/:entryId')
  deleteEntry(
    @CurrentUser() user: JwtUser,
    @Param('entryId', new ParseUUIDPipe()) entryId: string,
  ) {
    return this.journals.deleteEntry(entryId, user.sub)
  }

  @Post('save-from-chat')
  saveFromChat(@CurrentUser() user: JwtUser, @Body() body: SaveMessageToJournalDto) {
    return this.journals.saveMessageToJournal(body.messageId, user.sub, body.category)
  }
}
