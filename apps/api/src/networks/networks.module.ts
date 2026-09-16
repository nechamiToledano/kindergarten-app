import { Module } from '@nestjs/common';
import { NetworksController } from './networks.controller.js';
import { NetworksService } from './networks.service.js';

@Module({ controllers: [NetworksController], providers: [NetworksService] })
export class NetworksModule {}
