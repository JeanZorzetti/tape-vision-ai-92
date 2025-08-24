import React, { useState } from 'react';
import { AlertTriangle, Square } from 'lucide-react';

interface EmergencyStopProps {
  onEmergencyStop: () => void;
  isActive: boolean;
}

export const EmergencyStop: React.FC<EmergencyStopProps> = ({
  onEmergencyStop,
  isActive
}) => {
  const [isPressed, setIsPressed] = useState(false);

  const handleEmergencyStop = () => {
    const confirmation = window.confirm(
      'ATENÇÃO: Isso irá interromper todas as operações da IA.\n\n' +
      'Deseja realmente parar o sistema?'
    );
    
    if (confirmation) {
      setIsPressed(true);
      onEmergencyStop();
      
      // Log da ação crítica
      console.warn('[EMERGENCY STOP] Sistema interrompido pelo usuário', {
        timestamp: new Date().toISOString(),
        userAction: 'emergency_stop'
      });
    }
  };

  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col items-center gap-2">
      <button
        onClick={handleEmergencyStop}
        disabled={isPressed}
        className={`
          emergency-stop
          ${isPressed ? 'activated' : ''}
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
        aria-label="Botão de parada de emergência"
        title="Parar sistema (ISO 13850)"
      >
        <Square className="w-6 h-6 mb-1" />
        <span className="text-[10px] font-bold leading-tight">
          PARAR<br />SISTEMA
        </span>
      </button>
      
      <div className={`
        text-xs font-mono px-2 py-1 rounded
        ${isActive ? 'status-active' : isPressed ? 'status-danger' : 'status-warning'}
      `}>
        {isActive ? 'Sistema Ativo' : isPressed ? 'SISTEMA PARADO' : 'Aguardando'}
      </div>
      
      {isPressed && (
        <div className="flex items-center gap-1 text-xs text-danger animate-pulse">
          <AlertTriangle className="w-3 h-3" />
          <span>Parada de Emergência</span>
        </div>
      )}
    </div>
  );
};