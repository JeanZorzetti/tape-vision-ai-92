/**
 * User Management Routes - Tape Vision Trading System
 * Defines all user management API endpoints with proper validation and authorization
 */

import { Router } from 'express';
import { UserController } from '../controllers/UserController';
import { validationMiddleware } from '../middleware/validation';
import { requirePermissions } from '../middleware/auth';

export function createUserRoutes(controller: UserController): Router {
  const router = Router();

  // User statistics route (admin only)
  router.get(
    '/stats',
    requirePermissions(['users.read', 'system.admin']),
    controller.getUserStats
  );

  // User CRUD routes
  router.get(
    '/',
    requirePermissions(['users.read']),
    validationMiddleware.pagination,
    controller.getUsers
  );

  router.post(
    '/',
    requirePermissions(['users.write']),
    validationMiddleware.register,
    controller.createUser
  );

  router.get(
    '/:userId',
    requirePermissions(['users.read']),
    validationMiddleware.id,
    controller.getUserById
  );

  router.put(
    '/:userId',
    requirePermissions(['users.write']),
    validationMiddleware.id,
    controller.updateUser
  );

  router.delete(
    '/:userId',
    requirePermissions(['users.write']),
    validationMiddleware.id,
    controller.deleteUser
  );

  // Password management routes
  router.post(
    '/:userId/reset-password',
    requirePermissions(['users.write']),
    validationMiddleware.id,
    controller.resetPassword
  );

  // Permission management routes
  router.get(
    '/:userId/permissions',
    requirePermissions(['users.read']),
    validationMiddleware.id,
    controller.getUserPermissions
  );

  router.put(
    '/:userId/permissions',
    requirePermissions(['users.write', 'system.admin']),
    validationMiddleware.id,
    controller.updateUserPermissions
  );

  // Activity tracking routes
  router.get(
    '/:userId/activity',
    requirePermissions(['users.read']),
    validationMiddleware.id,
    validationMiddleware.pagination,
    validationMiddleware.dateRange,
    controller.getUserActivity
  );

  return router;
}

export default createUserRoutes;