import type { User, CreateUserInput, AccountStatus } from '../../domain/user.js';
import type { Role } from '../../domain/role.js';
import type { UserEvent, UserEventType } from '../../domain/events.js';

/**
 * Outbound port — what UserService needs from the persistence layer.
 * Implemented by UserRepository (Prisma/PostgreSQL).
 * Tests can provide an in-memory fake.
 */
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByKeycloakId(keycloakId: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  list(opts: { limit: number; offset: number; status?: AccountStatus }): Promise<{ items: User[]; total: number }>;

  create(input: CreateUserInput): Promise<User>;

  updateStatus(id: string, status: AccountStatus): Promise<User>;
  assignRoles(id: string, roles: Role[]): Promise<User>;

  /**
   * Transactional outbox: writes the user mutation AND the event in a single DB transaction.
   * Guarantees the event is never lost even if the message broker is down.
   */
  updateStatusWithEvent(
    id: string,
    status: AccountStatus,
    event: { type: UserEventType; payload: Record<string, unknown> },
  ): Promise<User>;

  listPendingEvents(limit?: number): Promise<UserEvent[]>;
  markEventPublished(eventId: string): Promise<void>;
  markEventFailed(eventId: string, reason: string): Promise<void>;
}
