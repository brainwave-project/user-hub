import type { Permission, RoleWithPermissions } from '../../domain/permission.js';

/**
 * Outbound port — what PermissionService needs from persistence.
 * Implemented by PermissionRepository (Prisma/PostgreSQL).
 */
export interface IPermissionRepository {
  /** List all permissions in the catalogue. */
  listPermissions(): Promise<Permission[]>;

  /** Get a single permission by id. */
  findPermissionById(id: string): Promise<Permission | null>;

  /** List all roles with their permission assignments. */
  listRolesWithPermissions(): Promise<RoleWithPermissions[]>;

  /** Get a single role with its permissions. */
  findRoleWithPermissions(roleId: string): Promise<RoleWithPermissions | null>;

  /** Replace all permissions for a role (full replace). */
  setRolePermissions(roleId: string, permissionIds: string[]): Promise<RoleWithPermissions>;

  /** Grant a single permission to a role (idempotent). */
  grantPermission(roleId: string, permissionId: string): Promise<void>;

  /** Revoke a single permission from a role. */
  revokePermission(roleId: string, permissionId: string): Promise<void>;
}
