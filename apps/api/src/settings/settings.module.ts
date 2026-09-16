import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller.js';

/** Registers the HTTP surface; `SettingsService` itself is provided globally by `SettingsCoreModule`. */
@Module({ controllers: [SettingsController] })
export class SettingsModule {}
