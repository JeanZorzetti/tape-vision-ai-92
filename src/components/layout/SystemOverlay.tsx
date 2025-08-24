import React from 'react';

interface SystemOverlayProps {
  onReactivate: () => void;
}

export const SystemOverlay: React.FC<SystemOverlayProps> = ({ onReactivate }) => {
  const handleReactivate = () => {
    const confirmed = window.confirm('Deseja reativar o sistema?');
    if (confirmed) {
      onReactivate();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="system-stopped-title"
      aria-describedby="system-stopped-description"
    >
      <div className="trading-card max-w-md mx-4 text-center">
        <div className="text-6xl text-sell-primary mb-4" aria-hidden="true">⏹</div>
        <h2 id="system-stopped-title" className="text-xl font-bold text-text-primary mb-2">
          Sistema Parado
        </h2>
        <p id="system-stopped-description" className="text-text-secondary mb-4">
          Todas as operações foram interrompidas por segurança.
        </p>
        <button
          onClick={handleReactivate}
          className="px-6 py-2 bg-buy-primary text-bg-primary rounded font-semibold hover:bg-buy-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-buy-primary focus:ring-offset-2 focus:ring-offset-bg-primary"
          aria-label="Reativar sistema de trading"
        >
          Reativar Sistema
        </button>
      </div>
    </div>
  );
};