/**
 * User Management Controller - Tape Vision Trading System
 * Handles user management operations (admin functionality)
 */

import { Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { AuthenticatedRequest, CreateUserRequest, UpdateUserRequest, UserProfile } from '../types/api';
import { APIContext } from '../index';
import { asyncHandler } from '../middleware/errorHandler';
import { transformUserData } from '../middleware/responseFormatter';

export class UserController {
  private context: APIContext;

  constructor(context: APIContext) {
    this.context = context;
  }

  /**
   * Get all users
   * GET /api/v1/users
   */
  public getUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { page = 1, limit = 50, role, isActive, search } = req.query;

    try {
      const users = await this.context.databaseManager.getUsers({
        page: Number(page),
        limit: Number(limit),
        role: role as string,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        search: search as string
      });

      // Transform user data to remove sensitive information
      const transformedUsers = users.items.map(user => transformUserData(user) as UserProfile);

      res.paginated(
        transformedUsers,
        users.page,
        users.limit,
        users.total,
        'Users retrieved successfully'
      );
    } catch (error) {
      this.context.logger.error('Failed to get users', { 
        error: error.message,
        userId: req.user?.id 
      });
      res.serverError('Failed to retrieve users');
    }
  });

  /**
   * Get user by ID
   * GET /api/v1/users/:userId
   */
  public getUserById = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { userId } = req.params;

    try {
      const user = await this.context.databaseManager.getUserById(userId);
      
      if (!user) {
        res.notFound('User not found');
        return;
      }

      const userProfile = transformUserData(user) as UserProfile;
      res.success(userProfile, 'User retrieved successfully');
    } catch (error) {
      this.context.logger.error('Failed to get user', { 
        error: error.message,
        userId,
        requestedBy: req.user?.id 
      });
      res.serverError('Failed to retrieve user');
    }
  });

  /**
   * Create new user
   * POST /api/v1/users
   */
  public createUser = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userRequest: CreateUserRequest = req.body;

    try {
      // Check if username already exists
      const existingUser = await this.context.databaseManager.getUserByUsername(userRequest.username);
      if (existingUser) {
        res.conflict('Username already exists');
        return;
      }

      // Check if email already exists
      const existingEmail = await this.context.databaseManager.getUserByEmail(userRequest.email);
      if (existingEmail) {
        res.conflict('Email already exists');
        return;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(userRequest.password, 12);

      // Determine permissions based on role
      const permissions = this.getDefaultPermissionsByRole(userRequest.role);

      // Create user
      const newUser = await this.context.databaseManager.createUser({
        username: userRequest.username,
        email: userRequest.email,
        passwordHash,
        firstName: userRequest.firstName,
        lastName: userRequest.lastName,
        role: userRequest.role,
        permissions: userRequest.permissions || permissions,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      this.context.logger.info('User created', {
        userId: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        createdBy: req.user?.id
      });

      const userProfile = transformUserData(newUser) as UserProfile;
      res.success(userProfile, 'User created successfully');
    } catch (error) {
      this.context.logger.error('Failed to create user', { 
        error: error.message,
        userRequest: { ...userRequest, password: '[REDACTED]' },
        createdBy: req.user?.id 
      });
      res.serverError('Failed to create user');
    }
  });

  /**
   * Update user
   * PUT /api/v1/users/:userId
   */
  public updateUser = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { userId } = req.params;
    const updates: UpdateUserRequest = req.body;

    try {
      // Check if user exists
      const existingUser = await this.context.databaseManager.getUserById(userId);
      if (!existingUser) {
        res.notFound('User not found');
        return;
      }

      // Prevent self-deactivation
      if (userId === req.user?.id && updates.isActive === false) {
        res.conflict('Cannot deactivate your own account');
        return;
      }

      // Check if email is being changed and already exists
      if (updates.email && updates.email !== existingUser.email) {
        const existingEmail = await this.context.databaseManager.getUserByEmail(updates.email);
        if (existingEmail && existingEmail.id !== userId) {
          res.conflict('Email already exists');
          return;
        }
      }

      // Update user
      const updatedUser = await this.context.databaseManager.updateUser(userId, {
        ...updates,
        updatedAt: new Date()
      });

      this.context.logger.info('User updated', {
        userId,
        changes: Object.keys(updates),
        updatedBy: req.user?.id
      });

      const userProfile = transformUserData(updatedUser) as UserProfile;
      res.success(userProfile, 'User updated successfully');
    } catch (error) {
      this.context.logger.error('Failed to update user', { 
        error: error.message,
        userId,
        updates,
        updatedBy: req.user?.id 
      });
      res.serverError('Failed to update user');
    }
  });

  /**
   * Delete user
   * DELETE /api/v1/users/:userId
   */
  public deleteUser = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { userId } = req.params;

    try {
      // Check if user exists
      const existingUser = await this.context.databaseManager.getUserById(userId);
      if (!existingUser) {
        res.notFound('User not found');
        return;
      }

      // Prevent self-deletion
      if (userId === req.user?.id) {
        res.conflict('Cannot delete your own account');
        return;
      }

      // Soft delete user (deactivate instead of actual deletion)
      await this.context.databaseManager.updateUser(userId, {
        isActive: false,
        deletedAt: new Date(),
        updatedAt: new Date()
      });

      this.context.logger.info('User deleted', {
        userId,
        username: existingUser.username,
        deletedBy: req.user?.id
      });

      res.success({ userId, status: 'deleted' }, 'User deleted successfully');
    } catch (error) {
      this.context.logger.error('Failed to delete user', { 
        error: error.message,
        userId,
        deletedBy: req.user?.id 
      });
      res.serverError('Failed to delete user');
    }
  });

  /**
   * Reset user password
   * POST /api/v1/users/:userId/reset-password
   */
  public resetPassword = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { userId } = req.params;
    const { newPassword } = req.body;

    try {
      // Check if user exists
      const existingUser = await this.context.databaseManager.getUserById(userId);
      if (!existingUser) {
        res.notFound('User not found');
        return;
      }

      // Hash new password
      const passwordHash = await bcrypt.hash(newPassword, 12);

      // Update password
      await this.context.databaseManager.updateUserPassword(userId, passwordHash);

      this.context.logger.info('Password reset', {
        userId,
        username: existingUser.username,
        resetBy: req.user?.id
      });

      res.success({ userId, status: 'password_reset' }, 'Password reset successfully');
    } catch (error) {
      this.context.logger.error('Failed to reset password', { 
        error: error.message,
        userId,
        resetBy: req.user?.id 
      });
      res.serverError('Failed to reset password');
    }
  });

  /**
   * Get user permissions
   * GET /api/v1/users/:userId/permissions
   */
  public getUserPermissions = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { userId } = req.params;

    try {
      const user = await this.context.databaseManager.getUserById(userId);
      
      if (!user) {
        res.notFound('User not found');
        return;
      }

      res.success({
        userId,
        role: user.role,
        permissions: user.permissions
      }, 'User permissions retrieved successfully');
    } catch (error) {
      this.context.logger.error('Failed to get user permissions', { 
        error: error.message,
        userId,
        requestedBy: req.user?.id 
      });
      res.serverError('Failed to retrieve user permissions');
    }
  });

  /**
   * Update user permissions
   * PUT /api/v1/users/:userId/permissions
   */
  public updateUserPermissions = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { userId } = req.params;
    const { permissions } = req.body;

    try {
      // Check if user exists
      const existingUser = await this.context.databaseManager.getUserById(userId);
      if (!existingUser) {
        res.notFound('User not found');
        return;
      }

      // Prevent removing admin permissions from self
      if (userId === req.user?.id && !permissions.includes('system.admin')) {
        res.conflict('Cannot remove admin permissions from your own account');
        return;
      }

      // Update permissions
      const updatedUser = await this.context.databaseManager.updateUser(userId, {
        permissions,
        updatedAt: new Date()
      });

      this.context.logger.info('User permissions updated', {
        userId,
        permissions,
        updatedBy: req.user?.id
      });

      res.success({
        userId,
        role: updatedUser.role,
        permissions: updatedUser.permissions
      }, 'User permissions updated successfully');
    } catch (error) {
      this.context.logger.error('Failed to update user permissions', { 
        error: error.message,
        userId,
        permissions,
        updatedBy: req.user?.id 
      });
      res.serverError('Failed to update user permissions');
    }
  });

  /**
   * Get user activity log
   * GET /api/v1/users/:userId/activity
   */
  public getUserActivity = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { userId } = req.params;
    const { page = 1, limit = 50, startDate, endDate } = req.query;

    try {
      const activity = await this.context.databaseManager.getUserActivity({
        userId,
        page: Number(page),
        limit: Number(limit),
        startDate: startDate as string,
        endDate: endDate as string
      });

      res.paginated(
        activity.items,
        activity.page,
        activity.limit,
        activity.total,
        'User activity retrieved successfully'
      );
    } catch (error) {
      this.context.logger.error('Failed to get user activity', { 
        error: error.message,
        userId,
        requestedBy: req.user?.id 
      });
      res.serverError('Failed to retrieve user activity');
    }
  });

  /**
   * Get user statistics
   * GET /api/v1/users/stats
   */
  public getUserStats = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const stats = await this.context.databaseManager.getUserStatistics();

      res.success(stats, 'User statistics retrieved successfully');
    } catch (error) {
      this.context.logger.error('Failed to get user statistics', { 
        error: error.message,
        requestedBy: req.user?.id 
      });
      res.serverError('Failed to retrieve user statistics');
    }
  });

  // Helper method to get default permissions by role
  private getDefaultPermissionsByRole(role: string): string[] {
    const rolePermissions = {
      admin: [
        'system.admin',
        'system.read',
        'system.write',
        'trading.read',
        'trading.write',
        'trading.execute',
        'market_data.read',
        'market_data.subscribe',
        'risk.read',
        'risk.write',
        'users.read',
        'users.write',
        'analytics.read'
      ],
      trader: [
        'trading.read',
        'trading.write',
        'trading.execute',
        'market_data.read',
        'market_data.subscribe',
        'risk.read'
      ],
      analyst: [
        'trading.read',
        'market_data.read',
        'market_data.subscribe',
        'risk.read',
        'analytics.read'
      ],
      viewer: [
        'trading.read',
        'market_data.read',
        'risk.read'
      ]
    };

    return rolePermissions[role as keyof typeof rolePermissions] || rolePermissions.viewer;
  }
}