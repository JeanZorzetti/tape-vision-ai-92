import React, { useState, useEffect } from 'react';
import { Brain, Zap, TrendingUp, Activity, CheckCircle } from 'lucide-react';

interface SplashScreenProps {
  onLoadingComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onLoadingComplete }) => {
  const [loadingStep, setLoadingStep] = useState(0);
  const [progress, setProgress] = useState(0);

  const loadingSteps = [
    { 
      id: 0, 
      text: 'Inicializando sistema IA...', 
      icon: Brain,
      duration: 1000 
    },
    { 
      id: 1, 
      text: 'Conectando à API Nelogica...', 
      icon: Zap,
      duration: 1500 
    },
    { 
      id: 2, 
      text: 'Carregando modelos de IA...', 
      icon: Activity,
      duration: 2000 
    },
    { 
      id: 3, 
      text: 'Sincronizando dados de mercado...', 
      icon: TrendingUp,
      duration: 1200 
    },
    { 
      id: 4, 
      text: 'Sistema pronto para operar!', 
      icon: CheckCircle,
      duration: 800 
    }
  ];

  useEffect(() => {
    let progressInterval: NodeJS.Timeout;
    let stepTimeout: NodeJS.Timeout;

    const startStep = (stepIndex: number) => {
      if (stepIndex >= loadingSteps.length) {
        setTimeout(onLoadingComplete, 500);
        return;
      }

      const step = loadingSteps[stepIndex];
      const stepProgress = (stepIndex / loadingSteps.length) * 100;
      
      // Reset progress for current step
      setProgress(stepProgress);
      setLoadingStep(stepIndex);

      // Animate progress within the step
      progressInterval = setInterval(() => {
        setProgress(prev => {
          const nextStepProgress = ((stepIndex + 1) / loadingSteps.length) * 100;
          const increment = (nextStepProgress - stepProgress) / (step.duration / 50);
          return Math.min(prev + increment, nextStepProgress);
        });
      }, 50);

      // Move to next step
      stepTimeout = setTimeout(() => {
        clearInterval(progressInterval);
        startStep(stepIndex + 1);
      }, step.duration);
    };

    startStep(0);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(stepTimeout);
    };
  }, [onLoadingComplete]);

  const currentStep = loadingSteps[loadingStep];
  const CurrentIcon = currentStep?.icon || Brain;

  return (
    <div className="fixed inset-0 bg-bg-primary flex items-center justify-center z-50">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-buy-primary/10 via-transparent to-sell-primary/10" />
        
        {/* Floating Particles */}
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-buy-primary/50 rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 2}s`
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 text-center max-w-md mx-4">
        {/* Logo/Brand */}
        <div className="mb-8">
          <div className="relative inline-block">
            <Brain className="w-16 h-16 text-buy-primary mx-auto mb-4 animate-pulse" />
            <div className="absolute inset-0 w-16 h-16 border-2 border-buy-primary/30 rounded-full animate-spin mx-auto" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">
            AI Trading Bot
          </h1>
          <p className="text-text-secondary text-sm">
            Sistema Autônomo de Trading com IA
          </p>
        </div>

        {/* Current Step */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <CurrentIcon className="w-6 h-6 text-buy-primary animate-pulse" />
            <span className="text-text-primary font-medium">
              {currentStep?.text}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-bg-tertiary rounded-full h-2 mb-4">
            <div 
              className="h-2 bg-gradient-to-r from-buy-primary to-text-accent rounded-full transition-all duration-300 ease-out glow-buy"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="text-xs text-text-secondary font-mono">
            {Math.round(progress)}% concluído
          </div>
        </div>

        {/* Loading Steps Indicator */}
        <div className="flex justify-center gap-2">
          {loadingSteps.map((step, index) => (
            <div
              key={step.id}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index <= loadingStep 
                  ? 'bg-buy-primary glow-buy' 
                  : 'bg-bg-tertiary'
              }`}
            />
          ))}
        </div>

        {/* System Info */}
        <div className="mt-8 text-xs text-text-muted space-y-1">
          <p>Versão 2.1.4 - Build Neural Network</p>
          <p>© 2024 AI Trading Systems</p>
        </div>
      </div>

      {/* Pulse Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="w-32 h-32 absolute top-1/4 left-1/4 bg-buy-primary/5 rounded-full animate-ping" 
             style={{ animationDuration: '3s' }} />
        <div className="w-24 h-24 absolute bottom-1/4 right-1/4 bg-text-accent/5 rounded-full animate-ping" 
             style={{ animationDuration: '2s', animationDelay: '1s' }} />
      </div>
    </div>
  );
};