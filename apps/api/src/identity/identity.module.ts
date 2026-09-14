import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { Env } from '../config/env.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { UserRepository } from './user.repository.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: { algorithm: 'HS256' },
      }),
    }),
  ],
  controllers: [AuthController, UsersController],
  providers: [AuthService, UserRepository, UsersService],
  exports: [AuthService, UserRepository, JwtModule],
})
export class IdentityModule {}
