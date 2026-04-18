import type { IUserRepository } from './ports/IUserRepository.js';
import type { User, CreateUserInput, AccountStatus } from '../domain/user.js';
import type { Role } from '../domain/role.js';
import { ALLOWED_TRANSITIONS } from '../domain/user.js';
import { AppError } from '@brainwave-project/core';

/**
 * UserService — application layer.
 * Owns the account state machine and all user mutation logic.
 * Depends only on the IUserRepository port, never on Prisma directly.
 *
 * TODO: Implement each method when UserHub is built out.
 */
export class UserService {
  constructor(private readonly repo: IUserRepository) {}

  async createUser(input: CreateUserInput): Promise<User> {
    // TODO: check for duplicate keycloakId/email → CONFLICT
    // TODO: repo.create(input)
    // TODO: write user.created event via outbox
    throw new Error('Not implemented');
  }

  async activateUser(id: string): Promise<User> {
    return this.transition(id, 'active' as AccountStatus);
  }

  async suspendUser(id: string): Promise<User> {
    return this.transition(id, 'suspended' as AccountStatus);
  }

  async disableUser(id: string): Promise<User> {
    return this.transition(id, 'disabled' as AccountStatus);
  }

  async assignRoles(id: string, roles: Role[]): Promise<User> {
    // TODO: validate user exists
    // TODO: repo.assignRoles → write role_changed event via outbox
    throw new Error('Not implemented');
  }

  async getUser(id: string): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) throw AppError.notFound('User', id);
    return user;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async transition(id: string, to: AccountStatus): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) throw AppError.notFound('User', id);

    const allowed = ALLOWED_TRANSITIONS[user.accountStatus];
    if (!allowed.includes(to)) {
      throw AppError.invalidStateTransition(user.accountStatus, to);
    }

    // TODO: repo.updateStatusWithEvent(id, to, { type, payload })
    throw new Error('Not implemented');
  }
}
