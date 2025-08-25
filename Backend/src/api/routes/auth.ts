/**
 * Authentication Routes - Tape Vision Trading System
 * Defines all authentication API endpoints with proper validation and rate limiting
 */

import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { validationMiddleware } from '../middleware/validation';
import { authMiddleware, requireAdminAccess } from '../middleware/auth';
import { authRateLimit } from '../middleware/rateLimit';

export function createAuthRoutes(controller: AuthController): Router {
  const router = Router();

  // Apply authentication-specific rate limiting
  router.use(authRateLimit);

  // Public authentication routes (no auth required)
  router.post(
    '/login',
    validationMiddleware.login,
    controller.login
  );

  router.post(
    '/refresh',
    validationMiddleware.refreshToken,
    controller.refreshToken
  );

  router.post(
    '/forgot-password',
    controller.forgotPassword
  );

  // Admin-only routes
  router.post(
    '/register',
    requireAdminAccess,
    validationMiddleware.register,
    controller.register
  );

  // Protected routes (require authentication)
  router.use(authMiddleware); // Apply auth middleware to all routes below

  router.post(
    '/logout',
    controller.logout
  );

  router.get(
    '/profile',
    controller.getProfile
  );

  router.put(
    '/profile',
    controller.updateProfile
  );

  router.post(
    '/change-password',
    validationMiddleware.changePassword,
    controller.changePassword
  );

  router.post(
    '/validate',
    controller.validateToken
  );

  router.get(
    '/sessions',
    controller.getSessions
  );

  router.delete(
    '/sessions/:sessionId',
    validationMiddleware.id,
    controller.revokeSession
  );

  return router;
}

export default createAuthRoutes;