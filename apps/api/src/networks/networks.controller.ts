import { Body, Controller, Get, Patch } from '@nestjs/common';
import { UpdateNetworkSchema, type Principal, type UpdateNetwork } from '@kga/contracts';
import { CurrentUser, Roles } from '../common/auth.js';
import { ZodBody } from '../common/zod-validation.pipe.js';
import { NetworksService } from './networks.service.js';

@Controller({ path: 'networks', version: '1' })
@Roles('NETWORK_ADMIN')
export class NetworksController {
  constructor(private readonly networks: NetworksService) {}

  @Get('mine')
  getMine(@CurrentUser() principal: Principal) {
    return this.networks.getMine(principal);
  }

  @Patch('mine')
  updateMine(
    @CurrentUser() principal: Principal,
    @Body(new ZodBody(UpdateNetworkSchema)) body: UpdateNetwork,
  ) {
    return this.networks.updateMine(principal, body);
  }
}
