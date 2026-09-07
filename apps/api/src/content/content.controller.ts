import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import {
  AgeGroupSchema,
  CreateSubdomainSchema,
  UpdateSubdomainSchema,
  type AgeGroup,
  type CreateSubdomain,
  type Principal,
  type UpdateSubdomain,
} from '@kga/contracts';
import { CurrentUser, Roles } from '../common/auth.js';
import { ZodBody } from '../common/zod-validation.pipe.js';
import { ContentService } from './content.service.js';

const CreateDomainSchema = z.object({
  ageGroup: AgeGroupSchema,
  name: z.string().min(1).max(120),
  orderIndex: z.number().int().min(0).default(0),
});

@Controller({ path: 'content', version: '1' })
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('domains')
  listDomains(@Query('ageGroup') ageGroup?: string) {
    const parsed = ageGroup ? AgeGroupSchema.parse(ageGroup) : undefined;
    return this.content.listDomains(parsed as AgeGroup | undefined);
  }

  @Get('domains/:id/subdomains')
  listSubdomains(@Param('id') id: string) {
    return this.content.listSubdomains(id);
  }

  @Get('subdomains/:id')
  getForPlay(@Param('id') id: string) {
    return this.content.getForPlay(id);
  }

  @Post('domains')
  @Roles('CONTENT_EDITOR')
  createDomain(
    @CurrentUser() principal: Principal,
    @Body(new ZodBody(CreateDomainSchema)) body: z.infer<typeof CreateDomainSchema>,
  ) {
    return this.content.createDomain(principal, body);
  }

  @Post('subdomains')
  @Roles('CONTENT_EDITOR')
  createSubdomain(
    @CurrentUser() principal: Principal,
    @Body(new ZodBody(CreateSubdomainSchema)) body: CreateSubdomain,
  ) {
    return this.content.createSubdomain(principal, body);
  }

  @Patch('subdomains/:id')
  @Roles('CONTENT_EDITOR')
  updateSubdomain(
    @CurrentUser() principal: Principal,
    @Param('id') id: string,
    @Body(new ZodBody(UpdateSubdomainSchema)) body: UpdateSubdomain,
  ) {
    return this.content.updateSubdomain(principal, id, body);
  }
}
