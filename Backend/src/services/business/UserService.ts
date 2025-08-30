import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { User, IUser, RiskManagement } from '../models';

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  role?: 'TRADER' | 'VIEWER' | 'ADMIN';
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthResult {
  success: boolean;
  user?: IUser;
  tokens?: AuthTokens;
  error?: string;
}

export class UserService {
  private static instance: UserService;
  private jwtSecret: string;
  private jwtRefreshSecret: string;
  private jwtExpiresIn: string;
  private jwtRefreshExpiresIn: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'tape-vision-secret-2025';
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'tape-vision-refresh-secret-2025';
    this.jwtExpiresIn = process.env.JWT_EXPIRES || '24h';
    this.jwtRefreshExpiresIn = process.env.JWT_REFRESH_EXPIRES || '30d';
  }

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  /**
   * User Authentication
   */
  public async login(credentials: LoginCredentials): Promise<AuthResult> {
    try {
      const { email, password } = credentials;

      // Find user with password field included
      const user = await User.findOne({ email: email.toLowerCase() })
        .select('+password')
        .exec();

      if (!user) {
        await this.simulatePasswordCheck(); // Prevent timing attacks
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      // Check if account is locked
      if (user.isLocked()) {
        return {
          success: false,
          error: 'Account is temporarily locked. Please try again later.'
        };
      }

      // Verify password
      const isValidPassword = await user.comparePassword(password);
      
      if (!isValidPassword) {
        await user.incrementLoginAttempts();
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      // Reset login attempts on successful login
      if (user.loginAttempts > 0) {
        await user.updateOne({
          $unset: { loginAttempts: 1, lockUntil: 1 }
        });
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate tokens
      const tokens = this.generateTokens(user);

      // Remove sensitive data
      const userResponse = user.toJSON();

      return {
        success: true,
        user: userResponse,
        tokens
      };

    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Authentication failed'
      };
    }
  }

  /**
   * User Registration
   */
  public async register(userData: RegisterData): Promise<AuthResult> {
    try {
      // Check if user already exists
      const existingUser = await User.findOne({ 
        email: userData.email.toLowerCase() 
      });

      if (existingUser) {
        return {
          success: false,
          error: 'User already exists with this email'
        };
      }

      // Create new user
      const user = new User({
        email: userData.email.toLowerCase(),
        password: userData.password,
        name: userData.name,
        role: userData.role || 'TRADER',
        permissions: this.getDefaultPermissions(userData.role || 'TRADER')
      });

      await user.save();

      // Create initial risk management profile
      await this.createInitialRiskProfile(user._id);

      // Generate tokens
      const tokens = this.generateTokens(user);

      // Remove sensitive data
      const userResponse = user.toJSON();

      return {
        success: true,
        user: userResponse,
        tokens
      };

    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: 'Registration failed'
      };
    }
  }

  /**
   * Token Refresh
   */
  public async refreshTokens(refreshToken: string): Promise<AuthResult> {
    try {
      const decoded = jwt.verify(refreshToken, this.jwtRefreshSecret) as any;
      
      const user = await User.findById(decoded.id);
      if (!user || !user.isActive) {
        return {
          success: false,
          error: 'Invalid refresh token'
        };
      }

      const tokens = this.generateTokens(user);
      const userResponse = user.toJSON();

      return {
        success: true,
        user: userResponse,
        tokens
      };

    } catch (error) {
      return {
        success: false,
        error: 'Invalid refresh token'
      };
    }
  }

  /**
   * User Profile Management
   */
  public async getUserProfile(userId: string): Promise<IUser | null> {
    try {
      const user = await User.findById(userId);
      return user;
    } catch (error) {
      console.error('Get user profile error:', error);
      return null;
    }
  }

  public async updateUserProfile(
    userId: string, 
    updateData: Partial<IUser>
  ): Promise<IUser | null> {
    try {
      // Remove sensitive fields that shouldn't be updated directly
      delete (updateData as any).password;
      delete (updateData as any).role;
      delete (updateData as any).permissions;
      delete (updateData as any).apiKey;

      const user = await User.findByIdAndUpdate(
        userId,
        updateData,
        { new: true }
      );

      return user;
    } catch (error) {
      console.error('Update user profile error:', error);
      return null;
    }
  }

  /**
   * Password Management
   */
  public async changePassword(
    userId: string, 
    currentPassword: string, 
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const user = await User.findById(userId).select('+password');
      
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Verify current password
      const isCurrentValid = await user.comparePassword(currentPassword);
      if (!isCurrentValid) {
        return { success: false, error: 'Current password is incorrect' };
      }

      // Update password
      user.password = newPassword;
      await user.save();

      return { success: true };

    } catch (error) {
      console.error('Change password error:', error);
      return { success: false, error: 'Password change failed' };
    }
  }

  /**
   * API Key Management
   */
  public async generateApiKey(userId: string): Promise<{ success: boolean; apiKey?: string; error?: string }> {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const apiKey = user.generateApiKey();
      await user.save();

      return { success: true, apiKey };

    } catch (error) {
      console.error('Generate API key error:', error);
      return { success: false, error: 'API key generation failed' };
    }
  }

  public async validateApiKey(apiKey: string): Promise<IUser | null> {
    try {
      const user = await User.findOne({ 
        apiKey, 
        apiKeyEnabled: true,
        isActive: true,
        apiKeyExpires: { $gt: new Date() }
      });

      return user;
    } catch (error) {
      console.error('Validate API key error:', error);
      return null;
    }
  }

  /**
   * User Management (Admin functions)
   */
  public async getAllUsers(adminUserId: string): Promise<IUser[]> {
    try {
      // Verify admin permissions
      const admin = await User.findById(adminUserId);
      if (!admin || !admin.permissions.includes('USER_MANAGEMENT')) {
        throw new Error('Insufficient permissions');
      }

      const users = await User.find({ isActive: true })
        .sort({ createdAt: -1 });

      return users;
    } catch (error) {
      console.error('Get all users error:', error);
      return [];
    }
  }

  public async updateUserPermissions(
    adminUserId: string,
    targetUserId: string,
    permissions: string[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Verify admin permissions
      const admin = await User.findById(adminUserId);
      if (!admin || !admin.permissions.includes('USER_MANAGEMENT')) {
        return { success: false, error: 'Insufficient permissions' };
      }

      const user = await User.findByIdAndUpdate(
        targetUserId,
        { permissions },
        { new: true }
      );

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      return { success: true };

    } catch (error) {
      console.error('Update user permissions error:', error);
      return { success: false, error: 'Permission update failed' };
    }
  }

  /**
   * Trading Access Control
   */
  public async canUserTrade(userId: string): Promise<boolean> {
    try {
      const user = await User.findById(userId);
      return user ? user.canTrade() : false;
    } catch (error) {
      console.error('Can user trade check error:', error);
      return false;
    }
  }

  public async updateTradingSettings(
    userId: string,
    settings: {
      maxDailyLoss?: number;
      maxPositionSize?: number;
      riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
      tradingEnabled?: boolean;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        settings,
        { new: true }
      );

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Update risk management profile as well
      await RiskManagement.findOneAndUpdate(
        { userId },
        {
          'riskProfile.maxDailyLoss': settings.maxDailyLoss || user.maxDailyLoss,
          'riskProfile.maxPositionSize': settings.maxPositionSize || user.maxPositionSize,
          'riskProfile.level': this.mapRiskLevelToProfile(settings.riskLevel || user.riskLevel)
        }
      );

      return { success: true };

    } catch (error) {
      console.error('Update trading settings error:', error);
      return { success: false, error: 'Trading settings update failed' };
    }
  }

  /**
   * Private Helper Methods
   */
  private generateTokens(user: IUser): AuthTokens {
    const payload = {
      id: user._id,
      email: user.email,
      role: user.role,
      permissions: user.permissions
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn
    });

    const refreshToken = jwt.sign(
      { id: user._id },
      this.jwtRefreshSecret,
      { expiresIn: this.jwtRefreshExpiresIn }
    );

    return { accessToken, refreshToken };
  }

  private getDefaultPermissions(role: string): string[] {
    const permissions = {
      TRADER: ['TRADING_ENABLED', 'ML_ACCESS'],
      VIEWER: ['ML_ACCESS'],
      ADMIN: [
        'TRADING_ENABLED',
        'ML_ACCESS',
        'ADMIN_ACCESS',
        'API_ACCESS',
        'RISK_OVERRIDE',
        'SESSION_MANAGEMENT',
        'USER_MANAGEMENT',
        'SYSTEM_CONFIG'
      ],
      SERVICE: ['ML_ENGINE_ACCESS', 'DATA_ACCESS']
    };

    return permissions[role as keyof typeof permissions] || permissions.TRADER;
  }

  private async createInitialRiskProfile(userId: Types.ObjectId): Promise<void> {
    try {
      const riskProfile = new RiskManagement({
        userId,
        riskProfile: {
          level: 'MODERATE',
          maxDailyLoss: 500,
          maxDailyLossPercentage: 2,
          maxPositionSize: 2,
          maxPositionSizePercentage: 10,
          maxDrawdown: 1000,
          maxConsecutiveLosses: 3,
          maxOpenPositions: 5,
          maxLeverage: 10,
          maxTradingHours: 8,
          cooldownPeriod: 30,
          maxCorrelatedPositions: 3,
          correlationThreshold: 0.7
        },
        monitoringRules: [
          {
            ruleId: 'DAILY_LOSS_LIMIT',
            name: 'Daily Loss Limit',
            description: 'Triggers when daily loss exceeds limit',
            condition: {
              metric: 'dailyLoss',
              operator: 'GREATER_THAN',
              threshold: 500,
              frequency: 'REAL_TIME'
            },
            actions: [{
              type: 'BLOCK_TRADING',
              parameters: { duration: 24 * 60 },
              priority: 10
            }],
            isActive: true,
            triggerCount: 0
          }
        ]
      });

      await riskProfile.save();
    } catch (error) {
      console.error('Create initial risk profile error:', error);
    }
  }

  private async simulatePasswordCheck(): Promise<void> {
    // Simulate password hashing time to prevent timing attacks
    return new Promise(resolve => {
      setTimeout(resolve, Math.random() * 100 + 50);
    });
  }

  private mapRiskLevelToProfile(riskLevel: string): string {
    const mapping = {
      'LOW': 'CONSERVATIVE',
      'MEDIUM': 'MODERATE', 
      'HIGH': 'AGGRESSIVE'
    };
    return mapping[riskLevel as keyof typeof mapping] || 'MODERATE';
  }

  /**
   * Token Validation
   */
  public async validateAccessToken(token: string): Promise<IUser | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      const user = await User.findById(decoded.id);
      if (!user || !user.isActive) {
        return null;
      }

      return user;
    } catch (error) {
      return null;
    }
  }

  /**
   * Session Management
   */
  public async getUserSessions(userId: string): Promise<any[]> {
    // This would integrate with TradingSession model
    // For now, return empty array
    return [];
  }

  /**
   * User Statistics
   */
  public async getUserStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    traderUsers: number;
    adminUsers: number;
  }> {
    try {
      const [total, active, traders, admins] = await Promise.all([
        User.countDocuments({}),
        User.countDocuments({ isActive: true }),
        User.countDocuments({ role: 'TRADER', isActive: true }),
        User.countDocuments({ role: 'ADMIN', isActive: true })
      ]);

      return {
        totalUsers: total,
        activeUsers: active,
        traderUsers: traders,
        adminUsers: admins
      };
    } catch (error) {
      console.error('Get user stats error:', error);
      return {
        totalUsers: 0,
        activeUsers: 0,
        traderUsers: 0,
        adminUsers: 0
      };
    }
  }
}

// Export singleton instance
export const userService = UserService.getInstance();
export default userService;