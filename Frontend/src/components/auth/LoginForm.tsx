/**
 * Login Form Component
 * Handles user authentication with Backend middleware
 */

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, TrendingUp, Shield, Zap } from 'lucide-react';

interface LoginFormProps {
  onSuccess?: () => void;
  className?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, className }) => {
  const { login, isLoading, error, clearError } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!formData.email || !formData.password) {
      return;
    }

    const success = await login(formData.email, formData.password);
    
    if (success) {
      onSuccess?.();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (error) {
      clearError();
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4 ${className}`}>
      <div className="w-full max-w-md">
        {/* Logo/Brand Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-full mb-4">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Tape Vision AI
          </h1>
          <p className="text-gray-400">
            Sistema de Trading Autônomo
          </p>
        </div>

        {/* Login Card */}
        <Card className="bg-gray-800/50 border-gray-700 backdrop-blur-sm">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center text-white">
              Acesso ao Sistema
            </CardTitle>
            <p className="text-center text-gray-400">
              Entre com suas credenciais para acessar o trading bot
            </p>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Error Alert */}
            {error && (
              <Alert className="border-red-600 bg-red-900/20">
                <AlertDescription className="text-red-400">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-gray-300">
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="seu@email.com"
                  className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-400 focus:border-blue-500"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-300">
                  Senha
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="••••••••"
                  className="bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-400 focus:border-blue-500"
                  required
                  disabled={isLoading}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                disabled={isLoading || !formData.email || !formData.password}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Autenticando...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    Entrar no Sistema
                  </>
                )}
              </Button>
            </form>

            {/* Demo Credentials */}
            <div className="mt-6 p-4 bg-gray-700/30 rounded-lg border border-gray-600">
              <h4 className="text-sm font-medium text-gray-300 mb-2">
                💡 Credenciais de Demonstração:
              </h4>
              <div className="text-xs text-gray-400 space-y-1">
                <div>📧 Email: <code className="text-blue-400">demo@aitrading.com</code></div>
                <div>🔑 Senha: <code className="text-blue-400">demo2025</code></div>
              </div>
            </div>

            {/* Features */}
            <div className="mt-6 grid grid-cols-2 gap-4 text-center">
              <div className="p-3 bg-green-900/20 rounded-lg border border-green-600">
                <Zap className="w-6 h-6 text-green-400 mx-auto mb-1" />
                <div className="text-xs text-green-300 font-medium">Real-time</div>
                <div className="text-xs text-gray-400">Trading Data</div>
              </div>
              <div className="p-3 bg-purple-900/20 rounded-lg border border-purple-600">
                <TrendingUp className="w-6 h-6 text-purple-400 mx-auto mb-1" />
                <div className="text-xs text-purple-300 font-medium">ML Engine</div>
                <div className="text-xs text-gray-400">AI Analysis</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>© 2025 Tape Vision AI. Sistema protegido por middleware de autenticação.</p>
        </div>
      </div>
    </div>
  );
};