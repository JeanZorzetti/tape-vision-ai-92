/**
 * Protected Route Component
 * Ensures user authentication before accessing protected components
 */

import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { LoginForm } from './LoginForm';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Shield } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredRole?: string;
  fallbackMessage?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requiredRole,
  fallbackMessage = 'Acesso negado. Você não tem permissão para acessar esta área.'
}) => {
  const { 
    isAuthenticated, 
    isLoading, 
    hasPermission, 
    hasRole,
    user 
  } = useAuth();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm p-8">
          <CardContent className="flex flex-col items-center space-y-4">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <div className="text-white text-lg">Verificando autenticação...</div>
            <div className="text-gray-400 text-sm">Conectando com sistema de segurança</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If not authenticated, show login form
  if (!isAuthenticated) {
    return <LoginForm />;
  }

  // Check required permission
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm max-w-md">
          <CardContent className="flex flex-col items-center space-y-4 p-8">
            <Shield className="w-16 h-16 text-red-500" />
            <div className="text-white text-xl font-semibold text-center">
              Acesso Restrito
            </div>
            <div className="text-gray-400 text-center">
              {fallbackMessage}
            </div>
            <div className="text-sm text-gray-500 bg-gray-700/30 p-4 rounded-lg">
              <div><strong>Usuário:</strong> {user?.email}</div>
              <div><strong>Role:</strong> {user?.role}</div>
              <div><strong>Permissão necessária:</strong> {requiredPermission}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check required role
  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
        <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm max-w-md">
          <CardContent className="flex flex-col items-center space-y-4 p-8">
            <Shield className="w-16 h-16 text-red-500" />
            <div className="text-white text-xl font-semibold text-center">
              Acesso Restrito
            </div>
            <div className="text-gray-400 text-center">
              {fallbackMessage}
            </div>
            <div className="text-sm text-gray-500 bg-gray-700/30 p-4 rounded-lg">
              <div><strong>Usuário:</strong> {user?.email}</div>
              <div><strong>Role atual:</strong> {user?.role}</div>
              <div><strong>Role necessária:</strong> {requiredRole}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If all checks pass, render the protected component
  return <>{children}</>;
};

/**
 * Higher-order component version of ProtectedRoute
 */
export const withAuth = <P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    requiredPermission?: string;
    requiredRole?: string;
    fallbackMessage?: string;
  }
) => {
  const AuthenticatedComponent: React.FC<P> = (props) => {
    return (
      <ProtectedRoute {...options}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };

  AuthenticatedComponent.displayName = `withAuth(${Component.displayName || Component.name})`;
  
  return AuthenticatedComponent;
};

/**
 * Trading-specific protected route that requires trading permissions
 */
export const TradingProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ProtectedRoute
      requiredPermission="TRADING_ENABLED"
      fallbackMessage="Você precisa de permissão de trading para acessar esta área."
    >
      {children}
    </ProtectedRoute>
  );
};

/**
 * Admin-only protected route
 */
export const AdminProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <ProtectedRoute
      requiredRole="ADMIN"
      fallbackMessage="Somente administradores podem acessar esta área."
    >
      {children}
    </ProtectedRoute>
  );
};