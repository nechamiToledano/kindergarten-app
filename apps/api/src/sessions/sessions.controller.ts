import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  CreateSessionSchema,
  SubmitResultSchema,
  SyncBatchSchema,
  type CreateSession,
  type Principal,
  type SubmitResult,
  type SyncBatch,
} from '@kga/contracts';
import { CurrentUser, Roles } from '../common/auth.js';
import { ZodBody } from '../common/zod-validation.pipe.js';
import { SessionsService } from './sessions.service.js';

@Controller({ path: 'sessions', version: '1' })
@Roles('TEACHER', 'KINDERGARTEN_ADMIN')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post()
  create(
    @CurrentUser() principal: Principal,
    @Body(new ZodBody(CreateSessionSchema)) body: CreateSession,
  ) {
    return this.sessions.create(principal, body);
  }

  @Get(':id')
  get(@CurrentUser() principal: Principal, @Param('id') id: string) {
    return this.sessions.get(principal, id);
  }

  @Post(':id/results')
  @HttpCode(200)
  submitResult(
    @CurrentUser() principal: Principal,
    @Body(new ZodBody(SubmitResultSchema)) body: SubmitResult,
  ) {
    return this.sessions.submitResult(principal, body);
  }

  @Post('sync')
  @HttpCode(200)
  sync(@CurrentUser() principal: Principal, @Body(new ZodBody(SyncBatchSchema)) body: SyncBatch) {
    return this.sessions.sync(principal, body);
  }

  @Post(':id/complete')
  @HttpCode(200)
  complete(@CurrentUser() principal: Principal, @Param('id') id: string) {
    return this.sessions.complete(principal, id);
  }
}
