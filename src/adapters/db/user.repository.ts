import type { IUserRepository } from '../../application/ports/IUserRepository.js';
import type { User, CreateUserInput, AccountStatus } from '../../domain/user.js';
import type { Role } from '../../domain/role.js';
import type { UserEvent, UserEventType } from '../../domain/events.js';
import type { Prisma } from '@prisma/client';
import prisma from './prisma/client.js';

// ---------------------------------------------------------------------------
// Internal type alias for what Prisma returns when roles are included
// ---------------------------------------------------------------------------
type UserWithRoles = Prisma.UserGetPayload<{
  include: { userRoles: { include: { role: true } } };
}>;

// ---------------------------------------------------------------------------
// Mapper — Prisma row → domain User
// ---------------------------------------------------------------------------
function mapUser(row: UserWithRoles): User {
  return {
    id:            row.id.toString(),
    keycloakId:    row.keycloakId,
    email:         row.email,
    accountStatus: row.accountStatus as AccountStatus,
    roles:         row.userRoles.map(ur => ur.role.name as Role),
    createdAt:     row.createdAt,
    updatedAt:     row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Mapper — Prisma UserEvent row → domain UserEvent
// ---------------------------------------------------------------------------
function mapEvent(row: { id: number; eventType: string; userId: number; keycloakId: string; payload: Prisma.JsonValue; createdAt: Date; processedAt: Date | null; error: string | null }): UserEvent {
  let status: 'pending' | 'published' | 'failed' = 'pending';
  if (row.processedAt)  status = 'published';
  if (row.error)        status = 'failed';

  return {
    id:          row.id.toString(),
    userId:      row.userId.toString(),
    eventType:   row.eventType as UserEventType,
    payload:     (row.payload as Record<string, unknown>) ?? {},
    status,
    createdAt:   row.createdAt,
    publishedAt: row.processedAt,
  };
}

const INCLUDE_ROLES = { userRoles: { include: { role: true } } } as const;

// ---------------------------------------------------------------------------
// UserRepository — Prisma + PostgreSQL implementation
// ---------------------------------------------------------------------------
export class UserRepository implements IUserRepository {

  async findById(id: string): Promise<User | null> {
    const row = await prisma.user.findUnique({
      where:   { id: parseInt(id, 10) },
      include: INCLUDE_ROLES,
    });
    return row ? mapUser(row) : null;
  }

  async findByKeycloakId(keycloakId: string): Promise<User | null> {
    const row = await prisma.user.findUnique({
      where:   { keycloakId },
      include: INCLUDE_ROLES,
    });
    return row ? mapUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await prisma.user.findUnique({
      where:   { email: email.toLowerCase() },
      include: INCLUDE_ROLES,
    });
    return row ? mapUser(row) : null;
  }

  /**
   * Creates the user record and the user.created event in one transaction.
   * Atomicity guarantees: if DB commit fails, the event is also rolled back.
   */
  async create(input: CreateUserInput): Promise<User> {
    const row = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          keycloakId:    input.keycloakId,
          email:         input.email.toLowerCase(),
          accountStatus: 'pending_identity',
        },
        include: INCLUDE_ROLES,
      });

      await tx.userEvent.create({
        data: {
          eventType:  'user.created',
          userId:     user.id,
          keycloakId: user.keycloakId,
          payload:    { email: user.email } satisfies Prisma.InputJsonValue,
        },
      });

      return user;
    });

    return mapUser(row);
  }

  async updateStatus(id: string, status: AccountStatus): Promise<User> {
    const row = await prisma.user.update({
      where:   { id: parseInt(id, 10) },
      data:    { accountStatus: status },
      include: INCLUDE_ROLES,
    });
    return mapUser(row);
  }

  async assignRoles(id: string, roles: Role[]): Promise<User> {
    const numericId = parseInt(id, 10);

    // Resolve role names → IDs
    const roleRows = await prisma.role.findMany({
      where: { name: { in: roles } },
      select: { id: true, name: true },
    });

    const row = await prisma.$transaction(async (tx) => {
      // Replace all current role assignments atomically
      await tx.userRole.deleteMany({ where: { userId: numericId } });
      await tx.userRole.createMany({
        data: roleRows.map(r => ({ userId: numericId, roleId: r.id })),
      });
      return tx.user.findUniqueOrThrow({
        where:   { id: numericId },
        include: INCLUDE_ROLES,
      });
    });

    return mapUser(row);
  }

  /**
   * Transactional outbox:
   * Writes the status mutation AND the lifecycle event in one DB transaction.
   */
  async updateStatusWithEvent(
    id: string,
    status: AccountStatus,
    event: { type: UserEventType; payload: Record<string, unknown> },
  ): Promise<User> {
    const numericId = parseInt(id, 10);

    // Fetch keycloakId needed for the event row (no FK but required field)
    const existing = await prisma.user.findUnique({
      where:  { id: numericId },
      select: { keycloakId: true },
    });
    if (!existing) throw new Error(`User ${id} not found`);

    const row = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where:   { id: numericId },
        data:    { accountStatus: status },
        include: INCLUDE_ROLES,
      });

      await tx.userEvent.create({
        data: {
          eventType:  event.type,
          userId:     numericId,
          keycloakId: existing.keycloakId,
          payload:    event.payload as Prisma.InputJsonValue,
        },
      });

      return user;
    });

    return mapUser(row);
  }

  async listPendingEvents(limit = 50): Promise<UserEvent[]> {
    const rows = await prisma.userEvent.findMany({
      where:   { processedAt: null, error: null },
      take:    limit,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(mapEvent);
  }

  async markEventPublished(eventId: string): Promise<void> {
    await prisma.userEvent.update({
      where: { id: parseInt(eventId, 10) },
      data:  { processedAt: new Date() },
    });
  }

  async markEventFailed(eventId: string, reason: string): Promise<void> {
    await prisma.userEvent.update({
      where: { id: parseInt(eventId, 10) },
      data:  { error: reason },
    });
  }
}
