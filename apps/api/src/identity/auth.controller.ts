import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { LoginSchema, RefreshSchema, type LoginRequest, type Principal, type RefreshRequest } from '@kga/contracts';
import { CurrentUser, Public } from '../common/auth.js';
import { ThrottleSetting } from '../common/rate-limit.guard.js';
import { ZodBody } from '../common/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @ThrottleSetting('security.loginRateLimit')
  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodBody(LoginSchema)) body: LoginRequest) {
    return this.auth.login(body);
  }

  @Public()
  @ThrottleSetting('security.refreshRateLimit')
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body(new ZodBody(RefreshSchema)) body: RefreshRequest) {
    return this.auth.refresh(body.refreshToken);
  }

  @Get('me')
  me(@CurrentUser() principal: Principal) {
    return this.auth.me(principal);
  }
}
