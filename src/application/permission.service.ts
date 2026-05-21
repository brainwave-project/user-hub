import type { IPermissionRepository } from './ports/IPermissionRepository.js';
import type { Permission, RoleWithPermissions } from '../domain/permission.js';
import { AppError } from '@brainwave-project/core';

/**
 * PermissionService — application layer for role-permission management.
 * Depends only on IPermissionRepository.
 */
export class PermissionService {
  constructor(private readonly repo: IPermissionRepository) {}

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  async listPermissions(): Promise<Permission[]> {
    return this.repo.listPermissions();
  }

  async listRolesWithPermissions(): Promise<RoleWithPermissions[]> {
    return this.repo.listRolesWithPermissions();
  }

  async getRoleWithPermissions(roleId: string): Promise<RoleWithPermissions> {
    const role = await this.repo.findRoleWithPermissions(roleId);
    if (!role) throw AppError.notFound('Role', roleId);
    return role;
  }

  // ---------------------------------------------------------------------------
  // Commands
  // ---------------------------------------------------------------------------

  /**
   * Replace ALL permissions for a role atomically.
   * Used by the UI permission matrix "Save" button.
   */
  async setRolePermissions(roleId: string, permissionIds: string[]): Promise<RoleWithPermissions> {
    const role = await this.repo.findRoleWithPermissions(roleId);
    if (!role) throw AppError.notFound('Role', roleId);
    return this.repo.setRolePermissions(roleId, permissionIds);
  }

  /** Grant a single permission to a role (idempotent). */
  async grantPermission(roleId: string, permissionId: string): Promise<void> {
    const role = await this.repo.findRoleWithPermissions(roleId);
    if (!role) throw AppError.notFound('Role', roleId);
    const perm = await this.repo.findPermissionById(permissionId);
    if (!perm) throw AppError.notFound('Permission', permissionId);
    await this.repo.grantPermission(roleId, permissionId);
  }

  /** Revoke a single permission from a role. */
  async revokePermission(roleId: string, permissionId: string): Promise<void> {
    const role = await this.repo.findRoleWithPermissions(roleId);
    if (!role) throw AppError.notFound('Role', roleId);
    await this.repo.revokePermission(roleId, permissionId);
  }
}
