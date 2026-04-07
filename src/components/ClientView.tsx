import React, { useEffect, useState } from 'react';
import { useSettingsStore } from '../store/settingsStore';

// Tela do cliente - Esta é a tela que aparece no PC quando ele está conectado como cliente
// Em produção, isso seria uma aplicação Electron separada

interface ClientState {
  isConnected: boolean;
  isLocked: boolean;
  isPaused: boolean;
  sessionId: string | null;
  sessionStartTime: Date | null;
  timeRemaining: number; // em segundos
  message: string | null;
  serverIp: string;
}

interface ClientConfig {
  serverIp: string;
  stationNumber: string;
}

const CLIENT_CONFIG_KEY = 'lhg-client-config';

const ClientView: React.FC = () => {
  const { settings } = useSettingsStore();
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [state, setState] = useState<ClientState>({
    isConnected: false,
    isLocked: true,
    isPaused: false,
    sessionId: null,
    sessionStartTime: null,
    timeRemaining: 0,
    message: null,
    serverIp: '',
  });

  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [setupData, setSetupData] = useState<ClientConfig>({ serverIp: '', stationNumber: '' });
  const wallpaperToUse = settings.clientWallpaper;

  // Carregar configuração inicial (primeira execução)
  useEffect(() => {
    const raw = localStorage.getItem(CLIENT_CONFIG_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as Partial<ClientConfig>;
      if (parsed.serverIp && parsed.stationNumber) {
        const loaded: ClientConfig = {
          serverIp: parsed.serverIp,
          stationNumber: parsed.stationNumber,
        };
        setConfig(loaded);
        setState(prev => ({ ...prev, serverIp: loaded.serverIp }));
      }
    } catch {
      // Ignora configuração inválida
    }
  }, []);

  // Garante que o cliente não use fundo local: somente painel admin.
  useEffect(() => {
    localStorage.removeItem('lhg-client-wallpaper');
  }, []);

  // Simular conexão com o servidor quando já configurado
  useEffect(() => {
    if (!config) return;
    setConnectionError(null);

    // Em produção, isso seria uma conexão WebSocket real
    const timeout = setTimeout(() => {
      setState(prev => ({ ...prev, isConnected: true }));
    }, 1000);

    return () => clearTimeout(timeout);
  }, [config]);

  useEffect(() => {
    // Listener para mensagens do servidor (simulado)
    const messageHandler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
      } catch {
        // Ignorar mensagens inválidas
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, []);

  // Atualizar tempo restante
  useEffect(() => {
    if (!state.sessionStartTime || state.isPaused || state.timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setState(prev => {
        const newTime = prev.timeRemaining - 1;
        if (newTime <= 0) {
          // Tempo esgotado - bloquear
          return { ...prev, timeRemaining: 0, isLocked: true };
        }
        return { ...prev, timeRemaining: newTime };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state.sessionStartTime, state.isPaused, state.timeRemaining]);

  const handleServerMessage = (data: any) => {
    switch (data.type) {
      case 'unlock':
        setState(prev => ({ ...prev, isLocked: false }));
        break;
      case 'lock':
        setState(prev => ({ ...prev, isLocked: true }));
        break;
      case 'start_session':
        setState(prev => ({
          ...prev,
          sessionId: data.sessionId,
          sessionStartTime: new Date(),
          timeRemaining: data.duration * 60, // converter minutos para segundos
          isLocked: false,
        }));
        break;
      case 'end_session':
        setState(prev => ({
          ...prev,
          sessionId: null,
          sessionStartTime: null,
          timeRemaining: 0,
          isLocked: true,
        }));
        break;
      case 'pause':
        setState(prev => ({ ...prev, isPaused: true }));
        break;
      case 'resume':
        setState(prev => ({ ...prev, isPaused: false }));
        break;
      case 'message':
        setState(prev => ({ ...prev, message: data.text }));
        setTimeout(() => {
          setState(prev => ({ ...prev, message: null }));
        }, 5000);
        break;
      case 'shutdown':
        // Em produção, isso chamaria o Electron para desligar o PC
        alert('Comando de desligamento recebido do servidor!');
        break;
      case 'restart':
        // Em produção, isso chamaria o Electron para reiniciar o PC
        alert('Comando de reinicialização recebido do servidor!');
        break;
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSetupSave = () => {
    const serverIp = setupData.serverIp.trim();
    const stationNumber = setupData.stationNumber.trim();

    if (!serverIp || !stationNumber) {
      setConnectionError('Preencha IP do servidor e número da máquina');
      return;
    }

    const newConfig: ClientConfig = { serverIp, stationNumber };
    localStorage.setItem(CLIENT_CONFIG_KEY, JSON.stringify(newConfig));
    setConfig(newConfig);
    setState(prev => ({ ...prev, serverIp: serverIp }));
    setConnectionError(null);
  };

  // Primeira configuração do cliente
  if (!config) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Configuração Inicial do Cliente</h1>
          <p className="text-gray-600 mb-6">Preencha uma vez para este PC iniciar automaticamente no boot.</p>

          {connectionError && (
            <div className="bg-red-100 text-red-700 px-4 py-2 rounded-lg mb-4 text-center">
              {connectionError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">IP do Servidor</label>
              <input
                type="text"
                value={setupData.serverIp}
                onChange={(e) => setSetupData(prev => ({ ...prev, serverIp: e.target.value }))}
                placeholder="192.168.1.100"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Numero da Maquina</label>
              <input
                type="text"
                value={setupData.stationNumber}
                onChange={(e) => setSetupData(prev => ({ ...prev, stationNumber: e.target.value }))}
                placeholder="Ex: 01"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button
              onClick={handleSetupSave}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
            >
              Salvar e Iniciar Cliente
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Cliente sempre inicia bloqueado e só libera por comando do servidor
  if (state.isLocked) {
    const wallpaperStyle = wallpaperToUse 
      ? { backgroundImage: `url(${wallpaperToUse})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : {};

    return (
      <div 
        className="min-h-screen flex items-center justify-center relative"
        style={wallpaperToUse ? wallpaperStyle : {}} 
      >
        {!wallpaperToUse && (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900" />
        )}
        <div className="relative z-10 bg-black/60 backdrop-blur-md rounded-2xl p-8">
          <div className="text-center">
            <div className="text-8xl mb-8">🔒</div>
            <h1 className="text-4xl font-bold text-white mb-4">Computador Bloqueado</h1>
            <p className="text-purple-200 text-xl mb-8">
              {!state.isConnected
                ? 'Conectando ao servidor...'
                : state.timeRemaining <= 0
                  ? 'Seu tempo acabou! Fale com o atendente para continuar.'
                  : 'Aguarde a liberação do atendente.'}
            </p>

            <p className="text-purple-300 text-sm mb-4">
              Maquina {config.stationNumber} - Servidor {config.serverIp}
            </p>
            
            {state.timeRemaining > 0 && (
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 inline-block">
                <div className="text-purple-200 text-sm mb-2">Tempo Restante</div>
                <div className="text-5xl font-mono font-bold text-white">
                  {formatTime(state.timeRemaining)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mensagem do servidor */}
        {state.message && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-yellow-900 px-6 py-3 rounded-lg shadow-lg z-20">
            📢 {state.message}
          </div>
        )}
      </div>
    );
  }

  // Tela principal (conectado e desbloqueado)
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎮</span>
            <div>
              <h1 className="text-xl font-bold text-white">GameZone</h1>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                <span className="text-green-400 text-sm">Conectado ao servidor ({config.serverIp})</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-purple-200 text-sm">Sessão Ativa</div>
            <div className="text-3xl font-mono font-bold text-white">
              {formatTime(state.timeRemaining)}
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="flex items-center justify-center h-[calc(100vh-100px)]">
        <div className="text-center">
          <div className="text-9xl mb-8">🖥️</div>
          <h2 className="text-3xl font-bold text-white mb-4">Computador Liberado</h2>
          <p className="text-purple-200 text-xl mb-8">
            Aproveite sua sessão de jogos!
          </p>
          
          {/* Barra de progresso do tempo */}
          <div className="w-96 mx-auto">
            <div className="bg-white/20 rounded-full h-4 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-green-400 to-green-500 h-full transition-all duration-1000"
                style={{ 
                  width: `${Math.min(100, (state.timeRemaining / 3600) * 100)}%` 
                }}
              ></div>
            </div>
            <div className="flex justify-between text-purple-200 text-sm mt-2">
              <span>Tempo restante</span>
              <span>{formatTime(state.timeRemaining)}</span>
            </div>
          </div>

          {/* Aviso de tempo baixo */}
          {state.timeRemaining > 0 && state.timeRemaining <= 300 && (
            <div className="mt-8 bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 inline-block">
              <div className="text-yellow-300 font-medium">
                ⚠️ Atenção: Seu tempo está acabando!
              </div>
              <div className="text-yellow-200 text-sm">
                Fale com o atendente para adicionar mais tempo.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mensagem do servidor */}
      {state.message && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-yellow-900 px-6 py-3 rounded-lg shadow-lg animate-bounce">
          📢 {state.message}
        </div>
      )}

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/20 backdrop-blur-sm px-6 py-3">
        <div className="flex items-center justify-between text-purple-200 text-sm">
          <span>GameZone - Sistema de Gerenciamento de LAN House</span>
          <span>Para suporte, fale com o atendente</span>
        </div>
      </div>
    </div>
  );
};

export default ClientView;
