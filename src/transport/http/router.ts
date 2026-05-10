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

  router.get   ('/',            handlers.listUsers);
  router.post  ('/',           handlers.createUser);
  router.get   ('/:id',        handlers.getUser);
  router.patch ('/:id/status', handlers.updateStatus);
  router.patch ('/:id/roles',  handlers.assignRoles);
  router.delete('/:id',        handlers.deleteUser);

  return router;
}
