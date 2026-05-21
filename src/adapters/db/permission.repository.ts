import type { IPermissionRepository } from '../../application/ports/IPermissionRepository.js';
import type { Permission, RoleWithPermissions } from '../../domain/permission.js';
import type { Prisma } from '@prisma/client';
import prisma from './prisma/client.js';

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapPermission(row: { id: number; name: string; description: string | null; resource: string; action: string; createdAt: Date }): Permission {
  return {
    id:          row.id.toString(),
    name:        row.name,
    description: row.description,
    resource:    row.resource,
    action:      row.action,
    createdAt:   row.createdAt,
  };
}

type RoleWithPermsRow = Prisma.RoleGetPayload<{
  include: { rolePermissions: { include: { permission: true } } };
}>;

function mapRoleWithPermissions(row: RoleWithPermsRow): RoleWithPermissions {
  return {
    id:          row.id.toString(),
    name:        row.name,
    description: row.description ?? null,
    permissions: row.rolePermissions.map(rp => mapPermission(rp.permission)),
    createdAt:   row.createdAt,
  };
}

const INCLUDE_PERMISSIONS = { rolePermissions: { include: { permission: true } } } as const;

// ---------------------------------------------------------------------------
// PermissionRepository
// ---------------------------------------------------------------------------

export class PermissionRepository implements IPermissionRepository {

  async listPermissions(): Promise<Permission[]> {
    const rows = await prisma.permission.findMany({ orderBy: [{ resource: 'asc' }, { action: 'asc' }] });
    return rows.map(mapPermission);
  }

  async findPermissionById(id: string): Promise<Permission | null> {
    const row = await prisma.permission.findUnique({ where: { id: parseInt(id, 10) } });
    return row ? mapPermission(row) : null;
  }

  async listRolesWithPermissions(): Promise<RoleWithPermissions[]> {
    const rows = await prisma.role.findMany({
      include:  INCLUDE_PERMISSIONS,
      orderBy:  { id: 'asc' },
    });
    return rows.map(mapRoleWithPermissions);
  }

  async findRoleWithPermissions(roleId: string): Promise<RoleWithPermissions | null> {
    const row = await prisma.role.findUnique({
      where:   { id: parseInt(roleId, 10) },
      include: INCLUDE_PERMISSIONS,
    });
    return row ? mapRoleWithPermissions(row) : null;
  }

  async setRolePermissions(roleId: string, permissionIds: string[]): Promise<RoleWithPermissions> {
    const numericRoleId = parseInt(roleId, 10);
    const numericPermIds = permissionIds.map(id => parseInt(id, 10));

    const row = await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: numericRoleId } });
      if (numericPermIds.length > 0) {
        await tx.rolePermission.createMany({
          data:           numericPermIds.map(permissionId => ({ roleId: numericRoleId, permissionId })),
          skipDuplicates: true,
        });
      }
      return tx.role.findUniqueOrThrow({
        where:   { id: numericRoleId },
        include: INCLUDE_PERMISSIONS,
      });
    });

    return mapRoleWithPermissions(row);
  }

  async grantPermission(roleId: string, permissionId: string): Promise<void> {
    await prisma.rolePermission.upsert({
      where:  { roleId_permissionId: { roleId: parseInt(roleId, 10), permissionId: parseInt(permissionId, 10) } },
      update: {},
      create: { roleId: parseInt(roleId, 10), permissionId: parseInt(permissionId, 10) },
    });
  }

  async revokePermission(roleId: string, permissionId: string): Promise<void> {
    await prisma.rolePermission.deleteMany({
      where: { roleId: parseInt(roleId, 10), permissionId: parseInt(permissionId, 10) },
    });
  }
}
