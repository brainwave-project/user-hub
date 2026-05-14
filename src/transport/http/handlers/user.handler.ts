import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import type { UserService } from '../../../application/user.service.js';
import { AccountStatus } from '../../../domain/user.js';
import { Role } from '../../../domain/role.js';
import { AppError } from '@brainwave-project/core';
import {
  emitUserCreated,
  emitUserStatusChanged,
  emitUserRolesAssigned,
  emitUserDeleted,
} from '../../../events/emitter.js';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const ListQuerySchema = z.object({
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.nativeEnum(AccountStatus).optional(),
});

const CreateUserSchema = z.object({
  keycloakId: z.string().uuid('keycloakId must be a UUID'),
  email:      z.string().email('email must be a valid email address'),
});

const StatusSchema = z.object({
  status: z.enum(
    [AccountStatus.ACTIVE, AccountStatus.SUSPENDED, AccountStatus.DISABLED],
    { errorMap: () => ({ message: `status must be one of: active, suspended, disabled` }) },
  ),
});

const AssignRolesSchema = z.object({
  roles: z.array(z.nativeEnum(Role), { required_error: 'roles array is required' })
           .min(1, 'at least one role is required'),
});

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:            { type: string, example: "42" }
 *         keycloakId:    { type: string, format: uuid }
 *         email:         { type: string, format: email }
 *         accountStatus:
 *           type: string
 *           enum: [pending_identity, active, suspended, disabled, failed]
 *         roles:
 *           type: array
 *           items: { type: string, enum: [ADMIN, EDITOR, VIEWER] }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     CreateUserRequest:
 *       type: object
 *       required: [keycloakId, email]
 *       properties:
 *         keycloakId: { type: string, format: uuid }
 *         email:      { type: string, format: email }
 *     StatusRequest:
 *       type: object
 *       required: [status]
 *       properties:
 *         status:
 *           type: string
 *           enum: [active, suspended, disabled]
 *     AssignRolesRequest:
 *       type: object
 *       required: [roles]
 *       properties:
 *         roles:
 *           type: array
 *           items: { type: string, enum: [ADMIN, EDITOR, VIEWER] }
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: object
 *           properties:
 *             code:    { type: string }
 *             message: { type: string }
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: >
 *         JWT issued by Keycloak via AuthHub. Kong validates the token and
 *         injects X-User-Id and X-User-Roles headers before forwarding the request.
 *         Services trust the injected headers — they never parse the JWT themselves.
 */
export function createUserHandlers(service: UserService) {
  return {

    /**
     * @swagger
     * /api/users:
     *   get:
     *     summary: List users (paginated)
     *     tags: [Users]
     *     security: [{ BearerAuth: [] }]
     *     parameters:
     *       - in: query
     *         name: limit
     *         schema: { type: integer, default: 20, minimum: 1, maximum: 100 }
     *       - in: query
     *         name: offset
     *         schema: { type: integer, default: 0, minimum: 0 }
     *       - in: query
     *         name: status
     *         schema:
     *           type: string
     *           enum: [pending_identity, active, suspended, disabled, failed]
     *     responses:
     *       200:
     *         description: Paginated user list
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 items:
     *                   type: array
     *                   items: { $ref: '#/components/schemas/User' }
     *                 total:  { type: integer }
     *                 limit:  { type: integer }
     *                 offset: { type: integer }
     */
    listUsers: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const parsed = ListQuerySchema.safeParse(req.query);
        if (!parsed.success) {
          next(AppError.validationError('Invalid query params', { issues: parsed.error.issues }));
          return;
        }
        const { limit, offset, status } = parsed.data;
        const result = await service.listUsers({ limit, offset, status });
        res.status(200).json({ items: result.items, total: result.total, limit, offset });
      } catch (err) { next(err); }
    },

    /**
     * @swagger
     * /api/users/{id}:
     *   get:
     *     summary: Get user by ID
     *     tags: [Users]
     *     security: [{ BearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: string }
     *         description: Internal user ID
     *     responses:
     *       200:
     *         description: User found
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/User' }
     *       404:
     *         description: User not found
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/ErrorResponse' }
     */
    getUser: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const user = await service.getUser(req.params['id']!);
        res.status(200).json(user);
      } catch (err) {
        next(err);
      }
    },

    /**
     * @swagger
     * /api/users:
     *   post:
     *     summary: Register a new user (called after Keycloak identity provisioned)
     *     tags: [Users]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema: { $ref: '#/components/schemas/CreateUserRequest' }
     *           example:
     *             keycloakId: "c56a4180-65aa-42ec-a945-5fd21dec0538"
     *             email: "ahmad@brainwave.io"
     *     responses:
     *       201:
     *         description: User registered, starts in pending_identity state
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/User' }
     *       409:
     *         description: Email or Keycloak identity already exists
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/ErrorResponse' }
     *       422:
     *         description: Validation error
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/ErrorResponse' }
     */
    createUser: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const parsed = CreateUserSchema.safeParse(req.body);
        if (!parsed.success) {
          next(AppError.validationError('Invalid request body', { issues: parsed.error.issues }));
          return;
        }
        const user = await service.createUser(parsed.data);
        const actorId = (req.headers['x-user-id'] as string | undefined) ?? parsed.data.keycloakId;
        emitUserCreated(actorId, String(user.id), parsed.data.email, {
          correlationId: req.headers['x-correlation-id'] as string,
        });
        res.status(201).json(user);
      } catch (err) {
        next(err);
      }
    },

    /**
     * @swagger
     * /api/users/{id}/status:
     *   patch:
     *     summary: Transition account status
     *     description: >
     *       Enforces the state machine:
     *       pending_identity → active | failed,
     *       active → suspended | disabled,
     *       suspended → active | disabled.
     *       DISABLED and FAILED are terminal states.
     *     tags: [Users]
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
     *           schema: { $ref: '#/components/schemas/StatusRequest' }
     *           example: { status: "active" }
     *     responses:
     *       200:
     *         description: Status transitioned successfully
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/User' }
     *       409:
     *         description: Invalid state transition
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/ErrorResponse' }
     *       404:
     *         description: User not found
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/ErrorResponse' }
     */
    updateStatus: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const parsed = StatusSchema.safeParse(req.body);
        if (!parsed.success) {
          next(AppError.validationError('Invalid status', { issues: parsed.error.issues }));
          return;
        }
        const prevUser = await service.getUser(req.params['id']!).catch(() => null);
        const user = await service.transitionStatus(req.params['id']!, parsed.data.status as AccountStatus);
        const actorId = (req.headers['x-user-id'] as string | undefined) ?? 'system';
        emitUserStatusChanged(actorId, req.params['id']!, {
          fromStatus:    prevUser?.accountStatus,
          toStatus:      parsed.data.status,
          correlationId: req.headers['x-correlation-id'] as string,
        });
        res.status(200).json(user);
      } catch (err) {
        next(err);
      }
    },

    /**
     * @swagger
     * /api/users/{id}:
     *   delete:
     *     summary: Soft-delete user (transitions to disabled)
     *     description: >
     *       Moves the account to DISABLED state. The DB row is retained for audit purposes.
     *       GDPR erasure of PII is handled by a separate background process.
     *     tags: [Users]
     *     security: [{ BearerAuth: [] }]
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: string }
     *     responses:
     *       200:
     *         description: User disabled
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/User' }
     *       409:
     *         description: Already disabled or invalid state transition
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/ErrorResponse' }
     */
    deleteUser: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const user = await service.deleteUser(req.params['id']!);
        const actorId = (req.headers['x-user-id'] as string | undefined) ?? 'system';
        emitUserDeleted(actorId, req.params['id']!, {
          correlationId: req.headers['x-correlation-id'] as string,
        });
        res.status(200).json(user);
      } catch (err) {
        next(err);
      }
    },

    /**
     * @swagger
     * /api/users/{id}/roles:
     *   patch:
     *     summary: Replace all role assignments for a user
     *     tags: [Users]
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
     *           schema: { $ref: '#/components/schemas/AssignRolesRequest' }
     *           example: { roles: ["EDITOR"] }
     *     responses:
     *       200:
     *         description: Roles updated
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/User' }
     *       422:
     *         description: Validation error (unknown roles)
     *         content:
     *           application/json:
     *             schema: { $ref: '#/components/schemas/ErrorResponse' }
     */
    assignRoles: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const parsed = AssignRolesSchema.safeParse(req.body);
        if (!parsed.success) {
          next(AppError.validationError('Invalid roles payload', { issues: parsed.error.issues }));
          return;
        }
        const user = await service.assignRoles(req.params['id']!, parsed.data.roles);
        const actorId = (req.headers['x-user-id'] as string | undefined) ?? 'system';
        emitUserRolesAssigned(actorId, req.params['id']!, {
          roles:         parsed.data.roles,
          correlationId: req.headers['x-correlation-id'] as string,
        });
        res.status(200).json(user);
      } catch (err) {
        next(err);
      }
    },
  };
}
