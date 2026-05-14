/**
 * User-hub Kafka event emitter.
 *
 * Singleton producer — initialised once in app.ts, then imported and used
 * fire-and-forget in route handlers. A Kafka outage NEVER blocks user-hub responses.
 */

import { randomUUID } from 'crypto';
import {
  createEventProducer,
  emitEvent,
  KAFKA_TOPICS,
  AuditAction,
  type EventProducer,
  type DomainEvent,
} from '@brainwave-project/core';

let producer: EventProducer | null = null;

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export async function initUserEventProducer(brokers: string[]): Promise<void> {
  producer = await createEventProducer({ brokers, clientId: 'user-hub' });
}

export async function disconnectUserEventProducer(): Promise<void> {
  await producer?.disconnect();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function build(
  action:  DomainEvent['action'],
  outcome: DomainEvent['outcome'],
  actorId: string,
  opts?: {
    resourceId?:    string;
    resourceName?:  string;
    correlationId?: string;
    metadata?:      Record<string, unknown>;
  },
): DomainEvent {
  return {
    eventId:    randomUUID(),
    occurredAt: new Date().toISOString(),
    service:    'user-hub',
    action,
    outcome,
    actor:      { userId: actorId },
    resource:   opts?.resourceId
      ? { type: 'User', id: opts.resourceId, name: opts.resourceName }
      : undefined,
    correlationId: opts?.correlationId,
    metadata:      opts?.metadata,
  };
}

function emit(event: DomainEvent): void {
  if (!producer) return;
  emitEvent(producer, KAFKA_TOPICS.USER, event);
}

// ---------------------------------------------------------------------------
// Typed emitters
// ---------------------------------------------------------------------------

export function emitUserCreated(
  actorId: string,
  userId: string,
  email: string,
  opts?: { correlationId?: string },
): void {
  emit(build(AuditAction.USER_CREATED, 'SUCCESS', actorId, {
    resourceId:   userId,
    resourceName: email,
    ...opts,
  }));
}

export function emitUserStatusChanged(
  actorId: string,
  userId: string,
  opts?: { fromStatus?: string; toStatus?: string; correlationId?: string },
): void {
  emit(build(AuditAction.USER_STATUS_CHANGED, 'SUCCESS', actorId, {
    resourceId: userId,
    metadata:   { from: opts?.fromStatus, to: opts?.toStatus },
    correlationId: opts?.correlationId,
  }));
}

export function emitUserRolesAssigned(
  actorId: string,
  userId: string,
  opts?: { roles?: string[]; correlationId?: string },
): void {
  emit(build(AuditAction.USER_ROLES_ASSIGNED, 'SUCCESS', actorId, {
    resourceId: userId,
    metadata:   { roles: opts?.roles },
    correlationId: opts?.correlationId,
  }));
}

export function emitUserDeleted(
  actorId: string,
  userId: string,
  opts?: { correlationId?: string },
): void {
  emit(build(AuditAction.USER_DELETED, 'SUCCESS', actorId, {
    resourceId:    userId,
    correlationId: opts?.correlationId,
  }));
}
