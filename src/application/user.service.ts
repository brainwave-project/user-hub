import type { IUserRepository } from './ports/IUserRepository.js';
import type { User, CreateUserInput } from '../domain/user.js';
import type { Role } from '../domain/role.js';
import { AccountStatus, ALLOWED_TRANSITIONS } from '../domain/user.js';
import { UserEventType } from '../domain/events.js';
import { AppError } from '@brainwave-project/core';
import {
  DuplicateEmailError,
  DuplicateKeycloakIdError,
} from '../errors/user.errors.js';
import {
  createKeycloakUser,
  deleteKeycloakUser,
} from '../adapters/keycloak/admin.client.js';

/** Input for the admin-initiated create flow (no keycloakId required). */
export interface AdminCreateUserInput {
  email:        string;
  fullName?:    string;
  displayName?: string;
  password:     string;
  roles:        Role[];
}

/**
 * UserService — application layer.
 * Owns the account state machine and all user mutation logic.
 * Depends only on IUserRepository — never on Prisma or Express directly.
 */
export class UserService {
  constructor(private readonly repo: IUserRepository) {}

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  async getUser(id: string): Promise<User> {
    const isNumeric = /^\d+$/.test(id);
    const user = isNumeric
      ? await this.repo.findById(id)
      : await this.repo.findByKeycloakId(id);
    if (!user) throw AppError.notFound('User', id);
    return user;
  }

  async listUsers(opts: { limit: number; offset: number; status?: AccountStatus }): Promise<{ items: User[]; total: number }> {
    return this.repo.list(opts);
  }

  // ---------------------------------------------------------------------------
  // Commands
  // ---------------------------------------------------------------------------

  /**
   * Registers a new user after Keycloak has provisioned the identity.
   * Called by the Keycloak webhook or the registration flow.
   */
  async createUser(input: CreateUserInput): Promise<User> {
    const [byKeycloak, byEmail] = await Promise.all([
      this.repo.findByKeycloakId(input.keycloakId),
      this.repo.findByEmail(input.email),
    ]);

    if (byKeycloak) throw new DuplicateKeycloakIdError(input.keycloakId);
    if (byEmail)    throw new DuplicateEmailError(input.email);

    return this.repo.create(input);
  }

  /**
   * Admin-initiated user creation flow:
   *   1. Create the identity in Keycloak (gets keycloakId back).
   *   2. Create the local DB record with the returned keycloakId.
   *   3. Rollback the Keycloak user if the DB write fails.
   *
   * The user is created as ACTIVE immediately (admin has verified the identity).
   * The initial password is marked temporary so the user must reset it on first login.
   */
  async adminCreateUser(input: AdminCreateUserInput): Promise<User> {
    const existing = await this.repo.findByEmail(input.email);
    if (existing) throw new DuplicateEmailError(input.email);

    // Step 1 — provision in Keycloak
    const keycloakId = await createKeycloakUser({
      email:     input.email,
      firstName: input.fullName,
      password:  input.password,
      temporary: true,
    });

    // Step 2 — persist locally (with rollback guard)
    try {
      return await this.repo.create({
        keycloakId,
        email:         input.email,
        fullName:      input.fullName,
        displayName:   input.displayName,
        initialStatus: AccountStatus.ACTIVE,
        initialRoles:  input.roles,
      });
    } catch (err) {
      // Best-effort rollback — remove the orphaned Keycloak user
      await deleteKeycloakUser(keycloakId).catch(() => {});
      throw err;
    }
  }

  /**
   * Transitions account status.
   * Enforces ALLOWED_TRANSITIONS — throws 409 for invalid moves.
   * Writes the status change and lifecycle event atomically via the outbox.
   */
  async transitionStatus(id: string, to: AccountStatus): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) throw AppError.notFound('User', id);

    const allowed = ALLOWED_TRANSITIONS[user.accountStatus];
    if (!allowed.includes(to)) {
      throw AppError.invalidStateTransition(user.accountStatus, to);
    }

    const eventType = STATUS_TO_EVENT[to];
    return this.repo.updateStatusWithEvent(id, to, {
      type:    eventType,
      payload: { previousStatus: user.accountStatus, newStatus: to },
    });
  }

  /** Convenience — used by PATCH /activate route */
  async activateUser(id: string): Promise<User> {
    return this.transitionStatus(id, AccountStatus.ACTIVE);
  }

  /** Convenience — used by PATCH /suspend route */
  async suspendUser(id: string): Promise<User> {
    return this.transitionStatus(id, AccountStatus.SUSPENDED);
  }

  /**
   * Soft-delete: transitions to DISABLED.
   * Does NOT delete the DB row — GDPR erasure is handled separately.
   */
  async deleteUser(id: string): Promise<User> {
    return this.transitionStatus(id, AccountStatus.DISABLED);
  }

  async assignRoles(id: string, roles: Role[]): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) throw AppError.notFound('User', id);

    const updated = await this.repo.assignRoles(id, roles);

    // Write role_changed event outside the assignRoles transaction
    // (assignRoles is already atomic; this is best-effort telemetry)
    await this.repo.updateStatusWithEvent(id, updated.accountStatus, {
      type:    UserEventType.ROLE_CHANGED,
      payload: { previousRoles: user.roles, newRoles: roles },
    });

    return updated;
  }
}

// ---------------------------------------------------------------------------
// Internal map: target status → outbox event type
// ---------------------------------------------------------------------------
const STATUS_TO_EVENT: Record<AccountStatus, UserEventType> = {
  [AccountStatus.PENDING_IDENTITY]: UserEventType.USER_CREATED,
  [AccountStatus.ACTIVE]:           UserEventType.USER_ACTIVATED,
  [AccountStatus.SUSPENDED]:        UserEventType.USER_SUSPENDED,
  [AccountStatus.DISABLED]:         UserEventType.USER_DELETED,
  [AccountStatus.FAILED]:           UserEventType.USER_DELETED,
};
