import type { Role } from './role.js';

/**
 * Domain event types — mirrors the CHECK constraint on user_management.user_events.event_type.
 * These are written to the outbox table atomically with the business operation.
 */
export enum UserEventType {
  USER_CREATED   = 'user.created',
  USER_ACTIVATED = 'user.activated',
  USER_SUSPENDED = 'user.suspended',
  USER_DELETED   = 'user.deleted',
  ROLE_CHANGED   = 'user.role_changed',
}

export interface UserEvent {
  id:          string;
  userId:      string;
  eventType:   UserEventType;
  payload:     Record<string, unknown>;
  status:      'pending' | 'published' | 'failed';
  createdAt:   Date;
  publishedAt: Date | null;
}

// Typed payload shapes per event

export interface UserCreatedPayload {
  keycloakId: string;
  email:      string;
}

export interface RoleChangedPayload {
  previousRoles: Role[];
  newRoles:      Role[];
  changedBy:     string; // actor userId
}
