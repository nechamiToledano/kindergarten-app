import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  AgeGroupSchema,
  CreateDomainSchema,
  CreateSubdomainSchema,
  UpdateDomainSchema,
  UpdateSubdomainSchema,
  type AgeGroup,
  type CreateDomain,
  type CreateSubdomain,
  type Principal,
  type UpdateDomain,
  type UpdateSubdomain,
} from '@kga/contracts';
import { CurrentUser, Roles } from '../common/auth.js';
import { ZodBody } from '../common/zod-validation.pipe.js';
import { ContentService } from './content.service.js';

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

  @Get('subdomains/:id/versions')
  @Roles('CONTENT_EDITOR')
  listVersions(@Param('id') id: string) {
    return this.content.listVersions(id);
  }

  @Post('domains')
  @Roles('CONTENT_EDITOR')
  createDomain(
    @CurrentUser() principal: Principal,
    @Body(new ZodBody(CreateDomainSchema)) body: CreateDomain,
  ) {
    return this.content.createDomain(principal, body);
  }

  @Patch('domains/:id')
  @Roles('CONTENT_EDITOR')
  updateDomain(
    @CurrentUser() principal: Principal,
    @Param('id') id: string,
    @Body(new ZodBody(UpdateDomainSchema)) body: UpdateDomain,
  ) {
    return this.content.updateDomain(principal, id, body);
  }

  @Delete('domains/:id')
  @Roles('CONTENT_EDITOR')
  removeDomain(@CurrentUser() principal: Principal, @Param('id') id: string) {
    return this.content.removeDomain(principal, id);
  }

  @Delete('subdomains/:id')
  @Roles('CONTENT_EDITOR')
  removeSubdomain(@CurrentUser() principal: Principal, @Param('id') id: string) {
    return this.content.removeSubdomain(principal, id);
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
