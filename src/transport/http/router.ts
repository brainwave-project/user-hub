import { Router } from 'express';
import { UserService } from '../../application/user.service.js';
import { UserRepository } from '../../adapters/db/user.repository.js';
import { createUserHandlers } from './handlers/user.handler.js';

/**
 * Wires dependencies and returns the /api/users Express router.
 * Composition root for the UserHub HTTP transport.
 */
export function createRouter(): Router {
  const router = Router();

  // Dependency injection — swap UserRepository for a fake in tests
  const repo    = new UserRepository();
  const service = new UserService(repo);
  const handlers = createUserHandlers(service);

  router.get('/:id',          handlers.getUser);
  router.post('/',            handlers.createUser);
  router.patch('/:id/activate', handlers.activateUser);
  router.patch('/:id/suspend',  handlers.suspendUser);
  router.patch('/:id/roles',    handlers.assignRoles);

  return router;
}
