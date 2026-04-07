import React, { useEffect, useState } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { useStore } from '../store/useStore';
import { LogOut, X } from 'lucide-react';

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
  const { users, customers, sessions, endSessionSavingTime } = useStore();
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

  const [showExitModal, setShowExitModal] = useState(false);
  const [exitUsername, setExitUsername] = useState('');
  const [exitPassword, setExitPassword] = useState('');
  const [exitError, setExitError] = useState('');

  // Estados do modal de encerrar sessão (pelo próprio cliente)
  const [showEndSessionModal, setShowEndSessionModal] = useState(false);
  const [endSessionUsername, setEndSessionUsername] = useState('');
  const [endSessionPassword, setEndSessionPassword] = useState('');
  const [endSessionError, setEndSessionError] = useState('');
  const [endSessionSuccess, setEndSessionSuccess] = useState<string | null>(null);

  const handleExitAttempt = () => {
    const user = users.find(u => u.username === exitUsername && u.password === exitPassword);
    if (user && (user.role === 'admin' || user.role === 'employee')) {
       // @ts-ignore
       if (window.lhgSystem?.quitApp) {
          // @ts-ignore
          window.lhgSystem.quitApp();
       } else {
          alert('Saindo do app...');
       }
    } else {
       setExitError('Usuário ou senha incorretos, ou sem permissão.');
    }
  };

  // Encerrar sessão pelo próprio cliente
  const handleEndSessionAttempt = () => {
    setEndSessionError('');
    setEndSessionSuccess(null);

    if (!state.sessionId) {
      setEndSessionError('Nenhuma sessão ativa encontrada.');
      return;
    }

    // Encontrar a sessão ativa no store
    const activeSession = sessions.find(s => s.id === state.sessionId);

    if (activeSession?.customerId) {
      // Sessão vinculada a um cliente cadastrado: validar credenciais
      const customer = customers.find(
        c => c.id === activeSession.customerId &&
             c.username === endSessionUsername &&
             c.password === endSessionPassword
      );
      if (!customer) {
        setEndSessionError('Usuário ou senha do cliente incorretos.');
        return;
      }
      // Calcular tempo já usado em segundos
      const initialDurationSeconds = (activeSession.duration ?? 0) * 60;
      const elapsedSeconds = initialDurationSeconds - state.timeRemaining;
      const remainingMinutes = Math.floor(state.timeRemaining / 60);

      endSessionSavingTime(state.sessionId, elapsedSeconds);

      const msg = remainingMinutes > 0
        ? `Sessão encerrada! ${remainingMinutes} minuto(s) foram salvos na sua conta.`
        : 'Sessão encerrada! Sem tempo restante para salvar.';
      setEndSessionSuccess(msg);

      setTimeout(() => {
        setShowEndSessionModal(false);
        setState(prev => ({ ...prev, isLocked: true, sessionId: null, sessionStartTime: null, timeRemaining: 0 }));
      }, 2500);
    } else {
      // Sessão sem cliente cadastrado: encerra direto sem precisar de senha
      endSessionSavingTime(state.sessionId, (activeSession?.duration ?? 0) * 60 - state.timeRemaining);
      setShowEndSessionModal(false);
      setState(prev => ({ ...prev, isLocked: true, sessionId: null, sessionStartTime: null, timeRemaining: 0 }));
    }
  };

  // Verificar se a sessão ativa tem cliente cadastrado
  const activeSession = state.sessionId ? sessions.find(s => s.id === state.sessionId) : null;
  const sessionHasRegisteredCustomer = !!(activeSession?.customerId);

  // UI de encerrar sessão (botão visível ao cliente na tela ativa)
  const endSessionUI = (
    <>
      <button
        onClick={() => {
          setEndSessionUsername('');
          setEndSessionPassword('');
          setEndSessionError('');
          setEndSessionSuccess(null);
          setShowEndSessionModal(true);
        }}
        className="fixed bottom-16 right-4 bg-orange-500/80 hover:bg-orange-600 text-white px-4 py-2 rounded-full backdrop-blur-sm transition-all z-40 text-sm font-medium shadow-lg"
        title="Encerrar minha sessão"
      >
        ⏹ Encerrar Sessão
      </button>

      {showEndSessionModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden text-left">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-semibold text-gray-800">Encerrar Sessão</h3>
              <button onClick={() => setShowEndSessionModal(false)} className="text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              {endSessionSuccess ? (
                <div className="text-center">
                  <div className="text-5xl mb-3">✅</div>
                  <p className="text-green-700 font-medium">{endSessionSuccess}</p>
                </div>
              ) : (
                <>
                  {sessionHasRegisteredCustomer ? (
                    <>
                      <p className="text-sm text-gray-600 mb-4">
                        Esta sessão está vinculada a uma conta. Insira suas credenciais para encerrar e <strong>salvar o tempo restante</strong>.
                      </p>
                      {endSessionError && <p className="text-red-500 text-sm mb-3">{endSessionError}</p>}
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Usuário</label>
                          <input
                            type="text"
                            value={endSessionUsername}
                            onChange={(e) => setEndSessionUsername(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-400 outline-none text-black"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                          <input
                            type="password"
                            value={endSessionPassword}
                            onChange={(e) => setEndSessionPassword(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleEndSessionAttempt(); }}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-400 outline-none text-black"
                          />
                        </div>
                        <button
                          onClick={handleEndSessionAttempt}
                          className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
                        >
                          Confirmar e Salvar Tempo
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600 mb-4">
                        Esta sessão não está vinculada a nenhuma conta. O tempo restante não será salvo.
                      </p>
                      <button
                        onClick={handleEndSessionAttempt}
                        className="w-full py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                      >
                        Encerrar Sessão
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );

  const exitUI = (
    <>
      <button 
        onClick={() => {
          setExitUsername('');
          setExitPassword('');
          setExitError('');
          setShowExitModal(true);
        }}
        className="fixed bottom-4 right-4 bg-white/10 hover:bg-red-500/80 text-white/50 hover:text-white p-3 rounded-full backdrop-blur-sm transition-all z-40"
        title="Sair do Cliente"
      >
        <LogOut size={24} />
      </button>

      {showExitModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden text-left">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-semibold text-gray-800">Sair do Cliente</h3>
              <button 
                onClick={() => setShowExitModal(false)} 
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              {exitError && <p className="text-red-500 text-sm mb-4">{exitError}</p>}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Usuário</label>
                  <input
                    type="text"
                    value={exitUsername}
                    onChange={(e) => setExitUsername(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                  <input
                    type="password"
                    value={exitPassword}
                    onChange={(e) => setExitPassword(e.target.value)}
                    onKeyDown={(e) => { if(e.key === 'Enter') handleExitAttempt(); }}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 outline-none text-black"
                  />
                </div>
                <button
                  onClick={handleExitAttempt}
                  className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  Confirmar Saída
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

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

        {exitUI}
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

      {/* Botão de encerrar sessão (visivel ao cliente) */}
      {state.sessionId && endSessionUI}

      {exitUI}
    </div>
  );
};

export default ClientView;
