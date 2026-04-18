import type { Role } from './role.js';

/**
 * Account states — mirrors the CHECK constraint in user_management.users.account_status.
 *
 * State machine:
 *   pending_identity → active         (Keycloak webhook confirms identity)
 *   active           → suspended      (admin action)
 *   active           → disabled       (admin action / GDPR delete)
 *   suspended        → active         (admin reinstates)
 *   *                → failed         (system error during provisioning)
 */
export enum AccountStatus {
  PENDING_IDENTITY = 'pending_identity',
  ACTIVE           = 'active',
  SUSPENDED        = 'suspended',
  DISABLED         = 'disabled',
  FAILED           = 'failed',
}

/** Valid state transitions — enforced in UserService before any DB write. */
export const ALLOWED_TRANSITIONS: Readonly<Record<AccountStatus, AccountStatus[]>> = {
  [AccountStatus.PENDING_IDENTITY]: [AccountStatus.ACTIVE, AccountStatus.FAILED],
  [AccountStatus.ACTIVE]:           [AccountStatus.SUSPENDED, AccountStatus.DISABLED],
  [AccountStatus.SUSPENDED]:        [AccountStatus.ACTIVE, AccountStatus.DISABLED],
  [AccountStatus.DISABLED]:         [],
  [AccountStatus.FAILED]:           [],
};

/** Core user aggregate. Maps 1:1 with user_management.users. */
export interface User {
  id:            string;        // internal UUID (user_management.users.id)
  keycloakId:    string;        // sub claim from Keycloak JWT
  email:         string;
  accountStatus: AccountStatus;
  roles:         Role[];
  createdAt:     Date;
  updatedAt:     Date;
}

/** Subset used when creating a new user after Keycloak webhook fires. */
export interface CreateUserInput {
  keycloakId: string;
  email:      string;
}
