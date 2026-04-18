import type { IUserRepository } from '../../application/ports/IUserRepository.js';
import type { User, CreateUserInput, AccountStatus } from '../../domain/user.js';
import type { Role } from '../../domain/role.js';
import type { UserEvent, UserEventType } from '../../domain/events.js';
import prisma from './prisma/client.js';

/**
 * Implements IUserRepository using Prisma + PostgreSQL (user_management schema).
 * TODO: implement each method when Prisma models are defined.
 */
export class UserRepository implements IUserRepository {
  async findById(_id: string): Promise<User | null> {
    // TODO: prisma.user.findUnique({ where: { id } })
    throw new Error('Not implemented');
  }

  async findByKeycloakId(_keycloakId: string): Promise<User | null> {
    // TODO: prisma.user.findUnique({ where: { keycloakId } })
    throw new Error('Not implemented');
  }

  async findByEmail(_email: string): Promise<User | null> {
    // TODO: prisma.user.findUnique({ where: { email } })
    throw new Error('Not implemented');
  }

  async create(_input: CreateUserInput): Promise<User> {
    // TODO: prisma.user.create({ data: { ...input, accountStatus: 'pending_identity' } })
    throw new Error('Not implemented');
  }

  async updateStatus(_id: string, _status: AccountStatus): Promise<User> {
    // TODO: prisma.user.update({ where: { id }, data: { accountStatus: status } })
    throw new Error('Not implemented');
  }

  async assignRoles(_id: string, _roles: Role[]): Promise<User> {
    // TODO: prisma.$transaction — delete existing user_roles, insert new ones
    throw new Error('Not implemented');
  }

  async updateStatusWithEvent(
    _id: string,
    _status: AccountStatus,
    _event: { type: UserEventType; payload: Record<string, unknown> },
  ): Promise<User> {
    // TODO: prisma.$transaction([
    //   prisma.user.update({ where: { id }, data: { accountStatus } }),
    //   prisma.userEvent.create({ data: { userId, eventType, payload, status: 'pending' } }),
    // ])
    throw new Error('Not implemented');
  }

  async listPendingEvents(_limit = 50): Promise<UserEvent[]> {
    // TODO: prisma.userEvent.findMany({ where: { status: 'pending' }, take: limit, orderBy: { createdAt: 'asc' } })
    throw new Error('Not implemented');
  }

  async markEventPublished(_eventId: string): Promise<void> {
    // TODO: prisma.userEvent.update({ where: { id: eventId }, data: { status: 'published', publishedAt: new Date() } })
    throw new Error('Not implemented');
  }

  async markEventFailed(_eventId: string, _reason: string): Promise<void> {
    // TODO: prisma.userEvent.update({ where: { id: eventId }, data: { status: 'failed', failReason: reason } })
    throw new Error('Not implemented');
  }
}
