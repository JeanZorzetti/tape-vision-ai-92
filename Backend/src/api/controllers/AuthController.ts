/**
 * Authentication Controller - Tape Vision Trading System
 * Handles user authentication, registration, and session management
 */

import { Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { 
  AuthenticatedRequest, 
  LoginRequest, 
  LoginResponse, 
  RefreshTokenRequest,
  CreateUserRequest,
  UserProfile 
} from '../types/api';
import { APIContext } from '../index';
import { asyncHandler } from '../middleware/errorHandler';
import { 
  generateToken, 
  generateRefreshToken, 
  verifyRefreshToken,
  createSession,
  removeSession,
  getActiveSessions
} from '../middleware/auth';
import { transformUserData } from '../middleware/responseFormatter';

export class AuthController {
  private context: APIContext;

  constructor(context: APIContext) {
    this.context = context;
  }

  /**
   * User login
   * POST /api/v1/auth/login
   */
  public login = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { username, password, rememberMe = false }: LoginRequest = req.body;

    try {
      // Find user by username
      const user = await this.context.databaseManager.getUserByUsername(username);
      if (!user) {
        res.unauthorized('Invalid credentials');
        return;
      }

      // Check if user is active
      if (!user.isActive) {
        res.forbidden('Account is deactivated');
        return;
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        // Log failed login attempt
        this.context.logger.warn('Failed login attempt', {
          username,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        res.unauthorized('Invalid credentials');
        return;
      }

      // Create session
      const sessionId = createSession(user.id, req.ip, req.get('User-Agent') || '');

      // Generate tokens
      const tokenPayload = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        sessionId
      };

      const token = generateToken(tokenPayload);
      const refreshToken = generateRefreshToken(tokenPayload);

      // Update last login
      await this.context.databaseManager.updateUserLastLogin(user.id);

      // Prepare response
      const response: LoginResponse = {
        token,
        refreshToken,
        expiresIn: rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60, // 30 days or 24 hours
        user: transformUserData(user) as UserProfile
      };

      this.context.logger.info('User login successful', {
        userId: user.id,
        username: user.username,
        ip: req.ip,
        sessionId
      });

      res.success(response, 'Login successful');
    } catch (error) {
      this.context.logger.error('Login error', { 
        error: error.message, 
        username,
        ip: req.ip 
      });
      res.serverError('Login failed');
    }
  });

  /**
   * User logout
   * POST /api/v1/auth/logout
   */
  public logout = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (req.user?.sessionId) {
        removeSession(req.user.sessionId);
      }

      this.context.logger.info('User logout', {
        userId: req.user?.id,
        sessionId: req.user?.sessionId
      });

      res.success({ message: 'Logout successful' });
    } catch (error) {
      this.context.logger.error('Logout error', { 
        error: error.message,
        userId: req.user?.id 
      });
      res.serverError('Logout failed');
    }
  });

  /**
   * Refresh access token
   * POST /api/v1/auth/refresh
   */
  public refreshToken = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { refreshToken }: RefreshTokenRequest = req.body;

    try {
      // Verify refresh token
      const payload = verifyRefreshToken(refreshToken);
      
      // Get current user data
      const user = await this.context.databaseManager.getUserById(payload.id);
      if (!user || !user.isActive) {
        res.unauthorized('User not found or inactive');
        return;
      }

      // Generate new tokens
      const tokenPayload = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        sessionId: payload.sessionId
      };

      const newToken = generateToken(tokenPayload);
      const newRefreshToken = generateRefreshToken(tokenPayload);

      this.context.logger.info('Token refreshed', {
        userId: user.id,
        sessionId: payload.sessionId
      });

      res.success({
        token: newToken,
        refreshToken: newRefreshToken,
        expiresIn: 24 * 60 * 60 // 24 hours
      }, 'Token refreshed successfully');
    } catch (error) {
      this.context.logger.warn('Token refresh failed', { error: error.message });
      res.unauthorized('Invalid refresh token');
    }
  });

  /**
   * Register new user (admin only)
   * POST /api/v1/auth/register
   */
  public register = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

      // Create user
      const newUser = await this.context.databaseManager.createUser({
        ...userRequest,
        passwordHash,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      this.context.logger.info('New user registered', {
        userId: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        createdBy: req.user?.id
      });

      const userResponse = transformUserData(newUser) as UserProfile;
      res.success(userResponse, 'User registered successfully');
    } catch (error) {
      this.context.logger.error('User registration error', { 
        error: error.message,
        userRequest: { ...userRequest, password: '[REDACTED]' }
      });
      res.serverError('Registration failed');
    }
  });

  /**
   * Change password
   * POST /api/v1/auth/change-password
   */
  public changePassword = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.id;

    try {
      // Get current user
      const user = await this.context.databaseManager.getUserById(userId);
      if (!user) {
        res.unauthorized('User not found');
        return;
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValidPassword) {
        res.unauthorized('Current password is incorrect');
        return;
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 12);

      // Update password
      await this.context.databaseManager.updateUserPassword(userId, newPasswordHash);

      this.context.logger.info('Password changed', {
        userId,
        username: user.username
      });

      res.success({ message: 'Password changed successfully' });
    } catch (error) {
      this.context.logger.error('Password change error', { 
        error: error.message,
        userId 
      });
      res.serverError('Password change failed');
    }
  });

  /**
   * Get current user profile
   * GET /api/v1/auth/profile
   */
  public getProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const user = await this.context.databaseManager.getUserById(userId);
      
      if (!user) {
        res.unauthorized('User not found');
        return;
      }

      const userProfile = transformUserData(user) as UserProfile;
      res.success(userProfile, 'Profile retrieved successfully');
    } catch (error) {
      this.context.logger.error('Get profile error', { 
        error: error.message,
        userId: req.user?.id 
      });
      res.serverError('Failed to retrieve profile');
    }
  });

  /**
   * Update user profile
   * PUT /api/v1/auth/profile
   */
  public updateProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const updates = req.body;

    try {
      // Remove fields that shouldn't be updated via this endpoint
      delete updates.password;
      delete updates.role;
      delete updates.permissions;
      delete updates.isActive;

      const updatedUser = await this.context.databaseManager.updateUser(userId, {
        ...updates,
        updatedAt: new Date()
      });

      this.context.logger.info('Profile updated', {
        userId,
        changes: Object.keys(updates)
      });

      const userProfile = transformUserData(updatedUser) as UserProfile;
      res.success(userProfile, 'Profile updated successfully');
    } catch (error) {
      this.context.logger.error('Update profile error', { 
        error: error.message,
        userId,
        updates 
      });
      res.serverError('Failed to update profile');
    }
  });

  /**
   * Get active sessions
   * GET /api/v1/auth/sessions
   */
  public getSessions = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const allSessions = getActiveSessions();
      const userSessions = allSessions.filter(session => session.userId === userId);

      res.success(userSessions, 'Active sessions retrieved successfully');
    } catch (error) {
      this.context.logger.error('Get sessions error', { 
        error: error.message,
        userId: req.user?.id 
      });
      res.serverError('Failed to retrieve sessions');
    }
  });

  /**
   * Revoke session
   * DELETE /api/v1/auth/sessions/:sessionId
   */
  public revokeSession = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { sessionId } = req.params;
    const userId = req.user!.id;

    try {
      // Verify session belongs to user
      const allSessions = getActiveSessions();
      const session = allSessions.find(s => s.sessionId === sessionId && s.userId === userId);
      
      if (!session) {
        res.notFound('Session not found');
        return;
      }

      // Remove session
      removeSession(sessionId);

      this.context.logger.info('Session revoked', {
        userId,
        sessionId,
        revokedBy: req.user?.sessionId
      });

      res.success({ sessionId, status: 'revoked' }, 'Session revoked successfully');
    } catch (error) {
      this.context.logger.error('Revoke session error', { 
        error: error.message,
        sessionId,
        userId: req.user?.id 
      });
      res.serverError('Failed to revoke session');
    }
  });

  /**
   * Validate token (for other services)
   * POST /api/v1/auth/validate
   */
  public validateToken = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Token is already validated by auth middleware
      const user = req.user!;
      
      res.success({
        valid: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          permissions: user.permissions
        },
        sessionId: user.sessionId
      }, 'Token is valid');
    } catch (error) {
      this.context.logger.error('Token validation error', { error: error.message });
      res.unauthorized('Invalid token');
    }
  });

  /**
   * Request password reset (placeholder for email functionality)
   * POST /api/v1/auth/forgot-password
   */
  public forgotPassword = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { email } = req.body;

    try {
      const user = await this.context.databaseManager.getUserByEmail(email);
      
      if (user) {
        // In a real implementation, this would send an email
        this.context.logger.info('Password reset requested', {
          userId: user.id,
          email: user.email
        });
      }

      // Always return success for security reasons
      res.success({ 
        message: 'If an account with that email exists, a password reset link has been sent' 
      });
    } catch (error) {
      this.context.logger.error('Forgot password error', { 
        error: error.message,
        email 
      });
      res.success({ 
        message: 'If an account with that email exists, a password reset link has been sent' 
      });
    }
  });
}