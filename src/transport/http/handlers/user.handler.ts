import type { Request, Response, NextFunction } from 'express';
import type { UserService } from '../../../application/user.service.js';

/**
 * HTTP handlers for /api/users routes.
 * Each handler delegates to UserService — no business logic here.
 * TODO: implement when UserService methods are built out.
 */
export function createUserHandlers(service: UserService) {
  return {
    /** GET /api/users/:id */
    getUser: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const user = await service.getUser(req.params['id']!);
        res.status(200).json(user);
      } catch (err) {
        next(err);
      }
    },

    /** POST /api/users — triggered by Keycloak user-registration webhook */
    createUser: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // TODO: validate body with Zod schema
        const user = await service.createUser(req.body);
        res.status(201).json(user);
      } catch (err) {
        next(err);
      }
    },

    /** PATCH /api/users/:id/activate */
    activateUser: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const user = await service.activateUser(req.params['id']!);
        res.status(200).json(user);
      } catch (err) {
        next(err);
      }
    },

    /** PATCH /api/users/:id/suspend */
    suspendUser: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const user = await service.suspendUser(req.params['id']!);
        res.status(200).json(user);
      } catch (err) {
        next(err);
      }
    },

    /** PATCH /api/users/:id/roles */
    assignRoles: async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // TODO: validate body.roles with Zod
        const user = await service.assignRoles(req.params['id']!, req.body.roles);
        res.status(200).json(user);
      } catch (err) {
        next(err);
      }
    },
  };
}
