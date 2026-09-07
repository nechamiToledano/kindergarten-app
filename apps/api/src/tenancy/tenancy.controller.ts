import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import {
  CreateKindergartenSchema,
  UpdateKindergartenSchema,
  type CreateKindergarten,
  type Principal,
  type UpdateKindergarten,
} from '@kga/contracts';
import { CurrentUser, Roles } from '../common/auth.js';
import { ZodBody } from '../common/zod-validation.pipe.js';
import { TenancyService } from './tenancy.service.js';

@Controller({ path: 'kindergartens', version: '1' })
@Roles('NETWORK_ADMIN', 'KINDERGARTEN_ADMIN')
export class TenancyController {
  constructor(private readonly tenancy: TenancyService) {}

  @Get()
  list(@CurrentUser() principal: Principal) {
    return this.tenancy.list(principal);
  }

  @Get(':id')
  get(@CurrentUser() principal: Principal, @Param('id') id: string) {
    return this.tenancy.get(principal, id);
  }

  @Post()
  create(
    @CurrentUser() principal: Principal,
    @Body(new ZodBody(CreateKindergartenSchema)) body: CreateKindergarten,
  ) {
    return this.tenancy.create(principal, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() principal: Principal,
    @Param('id') id: string,
    @Body(new ZodBody(UpdateKindergartenSchema)) body: UpdateKindergarten,
  ) {
    return this.tenancy.update(principal, id, body);
  }
}
