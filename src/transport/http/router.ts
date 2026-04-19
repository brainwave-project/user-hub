import { Router } from 'express';
import { UserService }    from '../../application/user.service.js';
import { UserRepository } from '../../adapters/db/user.repository.js';
import { createUserHandlers } from './handlers/user.handler.js';

/**
 * Wires dependencies and returns the /api/users Express router.
 * Composition root for the UserHub HTTP transport.
 */
export function createRouter(): Router {
  const router = Router();

  const repo     = new UserRepository();
  const service  = new UserService(repo);
  const handlers = createUserHandlers(service);

  /**
   * @swagger
   * /users:
   *   post:
   *     $ref: '#/paths/~1api~1users'
   * /users/{id}:
   *   get:
   *     $ref: '#/paths/~1api~1users~1{id}'
   *   delete:
   *     $ref: '#/paths/~1api~1users~1{id}'
   * /users/{id}/status:
   *   patch:
   *     $ref: '#/paths/~1api~1users~1{id}~1status'
   * /users/{id}/roles:
   *   patch:
   *     $ref: '#/paths/~1api~1users~1{id}~1roles'
   */
  router.post  ('/',           handlers.createUser);
  router.get   ('/:id',        handlers.getUser);
  router.patch ('/:id/status', handlers.updateStatus);
  router.patch ('/:id/roles',  handlers.assignRoles);
  router.delete('/:id',        handlers.deleteUser);

  return router;
}
