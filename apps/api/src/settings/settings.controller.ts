import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { SettingKeySchema, UpdateSettingSchema, type Principal, type UpdateSetting } from '@kga/contracts';
import { CurrentUser, Roles } from '../common/auth.js';
import { ZodBody } from '../common/zod-validation.pipe.js';
import { SettingsService } from './settings.service.js';

/**
 * System-wide settings (M11 — real management). Network-admin only: a setting
 * here changes behaviour for every kindergarten, not one tenant.
 */
@Controller({ path: 'settings', version: '1' })
@Roles('NETWORK_ADMIN')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  list() {
    return this.settings.list();
  }

  @Patch(':key')
  update(
    @CurrentUser() principal: Principal,
    @Param('key') key: string,
    @Body(new ZodBody(UpdateSettingSchema)) body: UpdateSetting,
  ) {
    const parsedKey = SettingKeySchema.parse(key);
    return this.settings.update(principal.sub, parsedKey, body.value);
  }
}
