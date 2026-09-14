import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
  CreateUserSchema,
  UpdateUserSchema,
  type CreateUser,
  type Principal,
  type UpdateUser,
} from '@kga/contracts';
import { CurrentUser, Roles } from '../common/auth.js';
import { ZodBody } from '../common/zod-validation.pipe.js';
import { UsersService } from './users.service.js';

/** Staff & role management (§14.4). Scoped to the caller's kindergarten or network. */
@Controller({ path: 'users', version: '1' })
@Roles('KINDERGARTEN_ADMIN', 'NETWORK_ADMIN')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentUser() principal: Principal) {
    return this.users.list(principal);
  }

  @Post()
  create(
    @CurrentUser() principal: Principal,
    @Body(new ZodBody(CreateUserSchema)) body: CreateUser,
  ) {
    return this.users.create(principal, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() principal: Principal,
    @Param('id') id: string,
    @Body(new ZodBody(UpdateUserSchema)) body: UpdateUser,
  ) {
    return this.users.update(principal, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() principal: Principal, @Param('id') id: string) {
    return this.users.remove(principal, id);
  }
}
