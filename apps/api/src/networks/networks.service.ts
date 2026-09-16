import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { Network, Principal, UpdateNetwork } from '@kga/contracts';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../common/audit.service.js';

/**
 * A network admin's own network (M11 — real management, §14.4 extended).
 *
 * Creating a *new* network is a bootstrap operation (seed script), not a
 * self-service one — there is no role above NETWORK_ADMIN to gate it, and a
 * network with no admin yet is unreachable from the app by construction. What
 * belongs here is what an existing network admin can manage about their own
 * network: its name and a live view of how many kindergartens sit under it.
 */
@Injectable()
export class NetworksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private requireNetwork(principal: Principal): string {
    if (principal.role !== 'NETWORK_ADMIN' || !principal.networkId) {
      throw new ForbiddenException('This account is not attached to a network');
    }
    return principal.networkId;
  }

  async getMine(principal: Principal): Promise<Network> {
    const networkId = this.requireNetwork(principal);
    const network = await this.prisma.network.findFirst({
      where: { id: networkId, deletedAt: null },
      include: { _count: { select: { kindergartens: { where: { deletedAt: null } } } } },
    });
    if (!network) throw new NotFoundException('Network not found');
    return { id: network.id, name: network.name, kindergartenCount: network._count.kindergartens };
  }

  async updateMine(principal: Principal, input: UpdateNetwork): Promise<Network> {
    const networkId = this.requireNetwork(principal);
    const network = await this.prisma.network.update({
      where: { id: networkId },
      data: { name: input.name },
      include: { _count: { select: { kindergartens: { where: { deletedAt: null } } } } },
    });
    await this.audit.record(principal.sub, 'network.update', 'Network', networkId);
    return { id: network.id, name: network.name, kindergartenCount: network._count.kindergartens };
  }
}
