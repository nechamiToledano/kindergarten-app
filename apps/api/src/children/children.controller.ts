import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
  CreateChildSchema,
  UpdateChildSchema,
  type CreateChild,
  type Principal,
  type UpdateChild,
} from '@kga/contracts';
import { CurrentUser, Roles } from '../common/auth.js';
import { ZodBody } from '../common/zod-validation.pipe.js';
import { ChildrenService } from './children.service.js';

@Controller({ path: 'children', version: '1' })
@Roles('TEACHER', 'KINDERGARTEN_ADMIN')
export class ChildrenController {
  constructor(private readonly children: ChildrenService) {}

  @Get()
  list(@CurrentUser() principal: Principal) {
    return this.children.list(principal);
  }

  @Get(':id')
  get(@CurrentUser() principal: Principal, @Param('id') id: string) {
    return this.children.get(principal, id);
  }

  @Post()
  create(
    @CurrentUser() principal: Principal,
    @Body(new ZodBody(CreateChildSchema)) body: CreateChild,
  ) {
    return this.children.create(principal, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() principal: Principal,
    @Param('id') id: string,
    @Body(new ZodBody(UpdateChildSchema)) body: UpdateChild,
  ) {
    return this.children.update(principal, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() principal: Principal, @Param('id') id: string) {
    return this.children.remove(principal, id);
  }
}
