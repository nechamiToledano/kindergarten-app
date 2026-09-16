import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  CreateSessionSchema,
  SkipPlanItemSchema,
  SubmitResultSchema,
  SyncBatchSchema,
  type CreateSession,
  type Principal,
  type SkipPlanItem,
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

  /** Record that a planned subdomain was deliberately not run (M10 §2). */
  @Post(':id/skip')
  @HttpCode(200)
  skip(
    @CurrentUser() principal: Principal,
    @Param('id') id: string,
    @Body(new ZodBody(SkipPlanItemSchema)) body: SkipPlanItem,
  ) {
    return this.sessions.skip(principal, id, body.subdomainId);
  }

  @Post(':id/complete')
  @HttpCode(200)
  complete(@CurrentUser() principal: Principal, @Param('id') id: string) {
    return this.sessions.complete(principal, id);
  }

  /** End a sitting early; everything still pending is recorded as skipped. */
  @Post(':id/abandon')
  @HttpCode(200)
  abandon(@CurrentUser() principal: Principal, @Param('id') id: string) {
    return this.sessions.abandon(principal, id);
  }
}
