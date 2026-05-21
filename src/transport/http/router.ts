import { Router } from 'express';
import { UserService }          from '../../application/user.service.js';
import { PermissionService }    from '../../application/permission.service.js';
import { UserRepository }       from '../../adapters/db/user.repository.js';
import { PermissionRepository } from '../../adapters/db/permission.repository.js';
import { createUserHandlers }       from './handlers/user.handler.js';
import { createPermissionHandlers } from './handlers/permission.handler.js';

/**
 * Wires dependencies and returns Express routers.
 * Composition root for the UserHub HTTP transport.
 */
export function createRouter(): Router {
  const router = Router();

  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------
  const userRepo    = new UserRepository();
  const userService = new UserService(userRepo);
  const userHandlers = createUserHandlers(userService);

  router.get   ('/users',              userHandlers.listUsers);
  router.post  ('/users',              userHandlers.createUser);
  router.post  ('/users/admin',        userHandlers.adminCreateUser);
  router.get   ('/users/:id',          userHandlers.getUser);
  router.patch ('/users/:id/status',   userHandlers.updateStatus);
  router.patch ('/users/:id/roles',    userHandlers.assignRoles);
  router.delete('/users/:id',          userHandlers.deleteUser);

  // ---------------------------------------------------------------------------
  // Permissions & Roles
  // ---------------------------------------------------------------------------
  const permRepo    = new PermissionRepository();
  const permService = new PermissionService(permRepo);
  const permHandlers = createPermissionHandlers(permService);

  router.get   ('/permissions',                           permHandlers.listPermissions);
  router.get   ('/roles',                                 permHandlers.listRoles);
  router.get   ('/roles/:id',                             permHandlers.getRole);
  router.put   ('/roles/:id/permissions',                 permHandlers.setRolePermissions);
  router.post  ('/roles/:id/permissions/:permId',         permHandlers.grantPermission);
  router.delete('/roles/:id/permissions/:permId',         permHandlers.revokePermission);

  return router;
}
