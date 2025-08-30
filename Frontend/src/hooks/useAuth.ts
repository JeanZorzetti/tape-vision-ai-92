/**
 * Authentication Hook for Trading System
 * Manages user authentication state and middleware integration
 */

import { useState, useEffect, useCallback } from 'react';
import { apiService } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null
  });

  /**
   * Initialize authentication state from stored tokens
   */
  const initializeAuth = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      if (apiService.isAuthenticated()) {
        // Get user profile from token
        const user = apiService.getCurrentUser();
        
        if (user) {
          // Verify token is still valid by fetching profile
          try {
            const profile = await apiService.getProfile();
            setAuthState({
              user: profile,
              isAuthenticated: true,
              isLoading: false,
              error: null
            });
          } catch (error) {
            // Token might be expired, clear authentication
            console.warn('Token validation failed:', error);
            await apiService.logout();
            setAuthState({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: null
            });
          }
        } else {
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null
          });
        }
      } else {
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null
        });
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Authentication error'
      });
    }
  }, []);

  /**
   * Login user with email and password
   */
  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await apiService.login(email, password);
      
      if (response.success) {
        setAuthState({
          user: response.user,
          isAuthenticated: true,
          isLoading: false,
          error: null
        });

        console.log('✅ User logged in successfully:', response.user.email);
        return true;
      } else {
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Login failed'
        }));
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      console.error('❌ Login error:', error);
      return false;
    }
  }, []);

  /**
   * Register new user
   */
  const register = useCallback(async (
    email: string, 
    password: string, 
    name: string
  ): Promise<boolean> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await apiService.register({ email, password, name });
      
      if (response.success) {
        setAuthState({
          user: response.user,
          isAuthenticated: true,
          isLoading: false,
          error: null
        });

        console.log('✅ User registered successfully:', response.user.email);
        return true;
      } else {
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Registration failed'
        }));
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      console.error('❌ Registration error:', error);
      return false;
    }
  }, []);

  /**
   * Logout user
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      
      await apiService.logout();
      
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      });

      console.log('✅ User logged out successfully');
    } catch (error) {
      console.error('❌ Logout error:', error);
      
      // Force logout even if API call failed
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      });
    }
  }, []);

  /**
   * Clear authentication error
   */
  const clearError = useCallback(() => {
    setAuthState(prev => ({ ...prev, error: null }));
  }, []);

  /**
   * Check if user has specific permission
   */
  const hasPermission = useCallback((permission: string): boolean => {
    return authState.user?.permissions?.includes(permission) || false;
  }, [authState.user]);

  /**
   * Check if user has specific role
   */
  const hasRole = useCallback((role: string): boolean => {
    return authState.user?.role === role;
  }, [authState.user]);

  /**
   * Check if user can trade (has trading permissions)
   */
  const canTrade = useCallback((): boolean => {
    return (
      authState.isAuthenticated && 
      (hasPermission('TRADING_ENABLED') || hasRole('ADMIN') || hasRole('TRADER'))
    );
  }, [authState.isAuthenticated, hasPermission, hasRole]);

  /**
   * Get current authentication token
   */
  const getAuthToken = useCallback((): string | null => {
    return apiService.getAuthToken();
  }, []);

  /**
   * Refresh user profile
   */
  const refreshProfile = useCallback(async (): Promise<void> => {
    if (!authState.isAuthenticated) return;

    try {
      const profile = await apiService.getProfile();
      setAuthState(prev => ({
        ...prev,
        user: profile
      }));
    } catch (error) {
      console.error('Failed to refresh profile:', error);
      // If profile refresh fails, user might need to re-authenticate
      await logout();
    }
  }, [authState.isAuthenticated, logout]);

  // Listen for auth events from API service
  useEffect(() => {
    const handleAuthLogin = (event: CustomEvent) => {
      const user = event.detail;
      setAuthState(prev => ({
        ...prev,
        user,
        isAuthenticated: true,
        error: null
      }));
    };

    const handleAuthLogout = () => {
      setAuthState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      });
    };

    window.addEventListener('auth:login', handleAuthLogin as EventListener);
    window.addEventListener('auth:logout', handleAuthLogout);

    return () => {
      window.removeEventListener('auth:login', handleAuthLogin as EventListener);
      window.removeEventListener('auth:logout', handleAuthLogout);
    };
  }, []);

  // Initialize authentication on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return {
    // State
    user: authState.user,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    error: authState.error,

    // Actions
    login,
    register,
    logout,
    clearError,
    refreshProfile,

    // Utilities
    hasPermission,
    hasRole,
    canTrade,
    getAuthToken,

    // Alias for convenience
    isLoggedIn: authState.isAuthenticated,
    currentUser: authState.user
  };
};