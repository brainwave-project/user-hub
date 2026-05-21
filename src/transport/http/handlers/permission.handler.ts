import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import type { PermissionService } from '../../../application/permission.service.js';
import { AppError } from '@brainwave-project/core';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const SetPermissionsSchema = z.object({
  permissionIds: z.array(z.string()).min(0),
});

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * @swagger
 * components:
 *   schemas:
 *     Permission:
 *       type: object
 *       properties:
 *         id:          { type: string }
 *         name:        { type: string, example: "document:read" }
 *         description: { type: string, nullable: true }
 *         resource:    { type: string, example: "document" }
 *         action:      { type: string, example: "read" }
 *         createdAt:   { type: string, format: date-time }
 *     RoleWithPermissions:
 *       type: object
 *       properties:
 *         id:          { type: string }
 *         name:        { type: string, example: "ADMIN" }
 *         description: { type: string, nullable: true }
 *         permissions:
 *           type: array
 *           items: { $ref: '#/components/schemas/Permission' }
 *         createdAt:   { type: string, format: date-time }
 */
export function createPermissionHandlers(service: PermissionService) {
  return {

    /**
     * @swagger
     * /api/permissions:
     *   get:
     *     summary: List all available permissions
     *     tags: [Permissions]
     *     security: [{ BearerAuth: [] }]
     *     responses:
     *       200:
     *         description: Full permission catalogue
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items: { $ref: '#/components/schemas/Permission' }
     */
    listPermissions: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const permissions = await service.listPermissions();
        res.status(200).json(permissions);
      } catch (err) { next(err); }
    },

    /**
     * @swagger
     * /api/roles:
     *   get:
     *     summary: List all roles with their assigned permissions
     *     tags: [Permissions]
     *     security: [{ BearerAuth: [] }]
     *     responses:
     *       200:
     *         description: Roles with permission assignments
     *         content:
     *           application/json:
     *             schema:
     *               type: array
     *               items: { $ref: '#/components/schemas/RoleWithPermissions' }
     */
    listRoles: async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const roles = await service.listRolesWithPermissions();
        res.status(200).json(roles);
      } catch (err) { next(err); }
    },

    /**
     * @swagger
     * /api/roles/{id}:
     *   get:
     *     summary: Get a single role with its permissions
     *     tags: [Permissions]
     *     security: [{ BearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: string }
     *     responses:
     *       200:
     *         description: Role with permission list
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/RoleWithPermissions' }
     *       404:
     *         description: Role not found
     */
    getRole: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const role = await service.getRoleWithPermissions(req.params['id']!);
        res.status(200).json(role);
      } catch (err) { next(err); }
    },

    /**
     * @swagger
     * /api/roles/{id}/permissions:
     *   put:
     *     summary: Replace all permissions for a role (atomic full replace)
     *     tags: [Permissions]
     *     security: [{ BearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: string }
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [permissionIds]
     *             properties:
     *               permissionIds:
     *                 type: array
     *                 items: { type: string }
     *           example: { permissionIds: ["1", "2", "3"] }
     *     responses:
     *       200:
     *         description: Role with updated permissions
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/RoleWithPermissions' }
     */
    setRolePermissions: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const parsed = SetPermissionsSchema.safeParse(req.body);
        if (!parsed.success) {
          next(AppError.validationError('Invalid payload', { issues: parsed.error.issues }));
          return;
        }
        const role = await service.setRolePermissions(req.params['id']!, parsed.data.permissionIds);
        res.status(200).json(role);
      } catch (err) { next(err); }
    },

    /**
     * @swagger
     * /api/roles/{id}/permissions/{permId}:
     *   post:
     *     summary: Grant a single permission to a role
     *     tags: [Permissions]
     *     security: [{ BearerAuth: [] }]
     *   delete:
     *     summary: Revoke a single permission from a role
     *     tags: [Permissions]
     *     security: [{ BearerAuth: [] }]
     */
    grantPermission: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        await service.grantPermission(req.params['id']!, req.params['permId']!);
        res.status(204).send();
      } catch (err) { next(err); }
    },

    revokePermission: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        await service.revokePermission(req.params['id']!, req.params['permId']!);
        res.status(204).send();
      } catch (err) { next(err); }
    },
  };
}
