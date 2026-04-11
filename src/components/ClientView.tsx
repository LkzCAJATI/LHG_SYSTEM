import React, { useEffect, useState, useRef } from 'react';
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
  isRemoteActive: boolean;
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
    isRemoteActive: false
  });

  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [setupData, setSetupData] = useState<ClientConfig>({ serverIp: '', stationNumber: '' });
  const wallpaperToUse = settings.clientWallpaper;

  const [showExitModal, setShowExitModal] = useState(false);
  const [exitUsername, setExitUsername] = useState('');
  const [exitPassword, setExitPassword] = useState('');
  const [exitError, setExitError] = useState('');

  // Estados das configurações de IP (Admin)
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsLoginStep, setSettingsLoginStep] = useState<'login' | 'config'>('login');
  const [settingsUsername, setSettingsUsername] = useState('');
  const [settingsPassword, setSettingsPassword] = useState('');
  const [settingsError, setSettingsError] = useState('');

  // Estados do Login de Cliente
  const [activeTab, setActiveTab] = useState<'status' | 'login'>('status');
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const socketRef = React.useRef<WebSocket | null>(null);
  const [currentWallpaper, setCurrentWallpaper] = useState<string | null>(null);
  const [currentLogo, setCurrentLogo] = useState<string | null>(null);

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
      const remainingMinutes = Math.floor(state.timeRemaining / 60);

      endSessionSavingTime(state.sessionId);

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
      endSessionSavingTime(state.sessionId);
      setShowEndSessionModal(false);
      setState(prev => ({ ...prev, isLocked: true, sessionId: null, sessionStartTime: null, timeRemaining: 0 }));
    }
  };

  // Verificar se a sessão ativa tem cliente cadastrado
  const activeSession = state.sessionId ? sessions.find(s => s.id === state.sessionId) : null;
  const sessionHasRegisteredCustomer = !!(activeSession?.customerId);

  // UI de encerrar sessão (botão visível ao cliente na tela ativa)
  // Loop de captura de tela para acesso remoto
  useEffect(() => {
    if (!state.isRemoteActive) {
      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach((t: any) => t.stop());
        remoteStreamRef.current = null;
      }
      return;
    }

    const startCapture = async () => {
      try {
        const sources = await window.lhgSystem?.getScreenSources();
        if (!sources || sources.length === 0) return;

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: sources[0].id,
              minWidth: 800,
              maxWidth: 1280,
              minHeight: 600,
              maxHeight: 720
            }
          } as any
        });

        remoteStreamRef.current = stream;
        
        // Setup hidden video to capture frames
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const sendFrame = () => {
          if (!state.isRemoteActive || !ctx) return;
          const socket = socketRef.current;
          if (!socket || socket.readyState !== WebSocket.OPEN) {
            if (state.isRemoteActive) setTimeout(sendFrame, 500);
            return;
          }
          // Se a rede/browser estiver engasgado, não acumula buffer infinito
          if (typeof socket.bufferedAmount === 'number' && socket.bufferedAmount > 2_000_000) {
            if (state.isRemoteActive) setTimeout(sendFrame, 300);
            return;
          }

          const vw = video.videoWidth || 0;
          const vh = video.videoHeight || 0;
          if (vw <= 0 || vh <= 0) {
            if (state.isRemoteActive) setTimeout(sendFrame, 300);
            return;
          }

          // Downscale para evitar travar e reduzir latência (estilo "preview remoto")
          const targetW = 960;
          const scale = Math.min(1, targetW / vw);
          const cw = Math.max(1, Math.round(vw * scale));
          const ch = Math.max(1, Math.round(vh * scale));

          canvas.width = cw;
          canvas.height = ch;
          ctx.drawImage(video, 0, 0, cw, ch);
          
          const frame = canvas.toDataURL('image/jpeg', 0.35); // mais leve
          socket.send(JSON.stringify({
            type: 'remote_frame',
            frame
          }));

          if (state.isRemoteActive) {
            setTimeout(sendFrame, 250); // ~4 FPS (bem mais estável)
          }
        };

        video.onloadedmetadata = () => sendFrame();

      } catch (err) {
        console.error('Erro ao capturar tela:', err);
        setState(prev => ({ ...prev, isRemoteActive: false }));
      }
    };

    startCapture();

    return () => {
      remoteStreamRef.current?.getTracks().forEach((t: any) => t.stop());
    };
  }, [state.isRemoteActive]);

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

  // Controlar o modo da janela (Kiosk vs Floating)
  useEffect(() => {
    if (window.lhgSystem?.setWindowMode) {
      if (state.isLocked || state.isPaused) {
        window.lhgSystem.setWindowMode({ mode: 'kiosk' });
      } else {
        window.lhgSystem.setWindowMode({ mode: 'floating' });
      }
    }
  }, [state.isLocked, state.isPaused]);

  const remoteStreamRef = useRef<MediaStream | null>(null);

  // Conexão WebSocket Real
  useEffect(() => {
    if (!config) return;

    let heartbeatInterval: any;
    let reconnectTimeout: any;

    const connect = () => {
      setConnectionError(null);
      // O IP vem da configuração salva pelo usuário na primeira vez
      const wsUrl = `ws://${config.serverIp}:8080`;
      
      try {
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
          console.log('Conectado ao servidor!');
          setState(prev => ({ ...prev, isConnected: true }));
          
          // Registrar este dispositivo no servidor
          socket?.send(JSON.stringify({
            type: 'register',
            deviceId: `pc-${config.stationNumber.padStart(2, '0')}`,
            deviceName: `PC ${config.stationNumber}`
          }));

          // Iniciar batimento cardíaco (heartbeat)
          heartbeatInterval = setInterval(() => {
            if (socket?.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({
                type: 'heartbeat',
                deviceId: `pc-${config.stationNumber.padStart(2, '0')}`
              }));
            }
          }, 10000);
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'login_response') {
              setIsLoggingIn(false);
              if (data.success) {
                setLoginError('');
                setLoginUsername('');
                setLoginPassword('');
              } else {
                setLoginError(data.message || 'Erro ao realizar login.');
              }
            } else if (data.type === 'wallpaper_update') {
              setCurrentWallpaper(data.url || null);
            } else if (data.type === 'logo_update') {
              setCurrentLogo(data.url || null);
            } else {
              handleServerMessage(data);
            }
          } catch (e) {
            console.error('Erro Mensagem:', e);
          }
        };

        socket.onclose = () => {
          setState(prev => ({ ...prev, isConnected: false }));
          clearInterval(heartbeatInterval);
          reconnectTimeout = setTimeout(connect, 5000);
        };

        socket.onerror = () => {
          socket?.close();
        };
      } catch (err) {
        console.error('Erro ao criar WebSocket:', err);
        reconnectTimeout = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      socketRef.current?.close();
      socketRef.current = null;
      clearInterval(heartbeatInterval);
      clearTimeout(reconnectTimeout);
    };
  }, [config]);

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
          isPaused: false,
        }));
        break;
      case 'add_time':
        setState(prev => ({
          ...prev,
          timeRemaining: prev.timeRemaining + (data.minutes * 60)
        }));
        break;
      case 'start_remote':
        setState(prev => ({ ...prev, isRemoteActive: true }));
        break;
      case 'stop_remote':
        setState(prev => ({ ...prev, isRemoteActive: false }));
        break;
      case 'remote_input':
        if (window.lhgSystem?.executeRemoteInput) {
          window.lhgSystem.executeRemoteInput(data.input);
        }
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
        void window.lhgSystem?.requestSystemShutdown?.().then((r) => {
          if (r && !r.ok && r.error) {
            alert(`Não foi possível desligar: ${r.error}`);
          }
        });
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

  const handleAdminSettingsLogin = () => {
    setSettingsError('');
    const user = users.find(u => u.username === settingsUsername && u.password === settingsPassword);
    
    // Senha local de emergência se não houver usuários sincronizados
    const isMasterPassword = settingsUsername === 'admin' && settingsPassword === 'lhgmaster';

    if ((user && (user.role === 'admin' || user.role === 'employee')) || isMasterPassword) {
      window.lhgSystem?.setClientAdminMode?.({ enabled: true });
      setSettingsLoginStep('config');
    } else {
      setSettingsError('Credenciais administrativas incorretas.');
    }
  };

  const handleCustomerLogin = () => {
    if (!state.isConnected) {
      setLoginError('Não foi possível conectar ao servidor.');
      return;
    }
    if (!loginUsername || !loginPassword) {
      setLoginError('Preencha todos os campos.');
      return;
    }

    setLoginError('');
    setIsLoggingIn(true);

    // Enviar via WebSocket para o servidor validar
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'login_request',
        deviceId: `pc-${config?.stationNumber.padStart(2, '0')}`,
        username: loginUsername,
        password: loginPassword
      }));
    } else {
      setIsLoggingIn(false);
      setLoginError('Sem conexão com o servidor.');
    }
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

  const settingsUI = showSettingsModal && (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4 text-left">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="font-semibold text-gray-800">Acesso Administrativo</h3>
          <button onClick={() => setShowSettingsModal(false)} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          {settingsLoginStep === 'login' ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Autentique-se para alterar o IP ou número da máquina.</p>
              {settingsError && <p className="text-red-500 text-sm">{settingsError}</p>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Usuário / Admin</label>
                <input
                  type="text"
                  value={settingsUsername}
                  onChange={(e) => setSettingsUsername(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg outline-none text-black bg-white"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                <input
                  type="password"
                  value={settingsPassword}
                  onChange={(e) => setSettingsPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdminSettingsLogin()}
                  className="w-full px-3 py-2 border rounded-lg outline-none text-black bg-white"
                />
              </div>
              <button
                onClick={handleAdminSettingsLogin}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
              >
                Entrar
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Altere o IP para o mesmo que aparece no servidor.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IP do Servidor</label>
                <input
                  type="text"
                  defaultValue={config?.serverIp}
                  id="new-ip"
                  className="w-full px-3 py-2 border rounded-lg outline-none text-black bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número da Máquina</label>
                <input
                  type="text"
                  defaultValue={config?.stationNumber}
                  id="new-station"
                  className="w-full px-3 py-2 border rounded-lg outline-none text-black bg-white"
                />
              </div>
              <button
                onClick={() => {
                  const ipValue = (document.getElementById('new-ip') as HTMLInputElement).value;
                  const stationValue = (document.getElementById('new-station') as HTMLInputElement).value;
                  const newConfig: ClientConfig = { serverIp: ipValue.trim(), stationNumber: stationValue.trim() };
                  localStorage.setItem(CLIENT_CONFIG_KEY, JSON.stringify(newConfig));
                  setShowSettingsModal(false);
                  window.location.reload();
                }}
                className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                Salvar e Reiniciar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Cliente sempre inicia bloqueado e só libera por comando do servidor (ou quando pausado)
  if (state.isLocked || state.isPaused) {
    const wallpaperToDisplay = currentWallpaper || wallpaperToUse;
    const logoToDisplay = currentLogo || settings.logo;
    const wallpaperStyle = wallpaperToDisplay 
      ? { backgroundImage: `url(${wallpaperToDisplay})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : {};

    return (
      <div 
        className="min-h-screen flex items-center justify-center relative overflow-hidden"
        style={wallpaperToDisplay ? wallpaperStyle : {}} 
      >
        {!wallpaperToDisplay && (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-purple-800 to-indigo-900" />
        )}
        <div className="relative z-10 w-full max-w-lg mx-4">
          <div className="bg-black/40 backdrop-blur-xl rounded-3xl p-10 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <div className="text-center">
              {/* Header com Logo do Sistema se disponível */}
              <div className="flex flex-col items-center mb-8">
                {logoToDisplay ? (
                  <img src={logoToDisplay} alt="Logo" className="h-20 w-auto mb-4 drop-shadow-lg" />
                ) : (
                  <div className="text-6xl mb-4 drop-shadow-md">🎮</div>
                )}
                <h2 className="text-2xl font-bold text-white tracking-wider">
                  {settings.systemName || 'LHG SYSTEM'}
                </h2>
              </div>

              {/* Tabs Switcher */}
              <div className="flex justify-center mb-10">
                <div className="bg-white/10 p-1.5 rounded-2xl flex gap-1 w-full max-w-xs">
                  <button
                    onClick={() => setActiveTab('status')}
                    className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                      activeTab === 'status' ? 'bg-white text-purple-900 shadow-lg' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    STATUS
                  </button>
                  <button
                    onClick={() => setActiveTab('login')}
                    className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                      activeTab === 'login' ? 'bg-white text-purple-900 shadow-lg' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    LOGIN
                  </button>
                </div>
              </div>

              {activeTab === 'status' ? (
                <div className="animate-in fade-in duration-500">
                  <div className="text-6xl mb-6">{state.isPaused ? '⏸️' : '🔒'}</div>
                  <h1 className="text-3xl font-bold text-white mb-4">
                    {state.isPaused ? 'Sessão Pausada' : 'PC Bloqueado'}
                  </h1>
                  <p className="text-purple-100 text-lg mb-8 leading-relaxed">
                    {!state.isConnected
                      ? 'Conectando ao sistema...'
                      : state.isPaused
                        ? 'O seu tempo e a máquina foram pausados.'
                        : state.timeRemaining <= 0
                          ? 'Tempo esgotado! Recarregue no balcão.'
                          : 'Aguarde a liberação do atendente.'}
                  </p>
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="space-y-6">
                    {loginError && (
                      <div className="bg-red-500/30 border border-red-500/50 text-red-100 px-4 py-3 rounded-2xl text-sm backdrop-blur-sm">
                        ⚠️ {loginError}
                      </div>
                    )}
                    <div className="text-left">
                      <label className="block text-xs font-bold text-purple-300 uppercase tracking-widest mb-2 ml-1">Usuário</label>
                      <input
                        type="text"
                        value={loginUsername}
                        onChange={(e) => setLoginUsername(e.target.value)}
                        className="w-full px-5 py-4 bg-white/10 border border-white/20 rounded-2xl text-white outline-none focus:ring-4 focus:ring-purple-500/30 transition-all font-medium text-lg"
                        placeholder="Digite seu login"
                        autoFocus
                      />
                    </div>
                    <div className="text-left">
                      <label className="block text-xs font-bold text-purple-300 uppercase tracking-widest mb-2 ml-1">Senha</label>
                      <input
                        type="password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCustomerLogin()}
                        className="w-full px-5 py-4 bg-white/10 border border-white/20 rounded-2xl text-white outline-none focus:ring-4 focus:ring-purple-500/30 transition-all font-medium text-lg"
                        placeholder="••••••••"
                      />
                    </div>
                    <button
                      onClick={handleCustomerLogin}
                      disabled={isLoggingIn}
                      className={`w-full py-4 rounded-2xl font-black text-xl tracking-tighter transition-all shadow-2xl ${
                        isLoggingIn 
                          ? 'bg-white/20 text-white/50 cursor-not-allowed scale-95' 
                          : 'bg-white text-purple-900 hover:bg-white hover:scale-[1.05] active:scale-[0.95]'
                      }`}
                    >
                      {isLoggingIn ? 'AUTENTICANDO...' : 'ENTRAR AGORA'}
                    </button>
                    <p className="text-white/40 text-xs text-center">
                      Seu saldo será consumido automaticamente.
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-10 pt-8 border-t border-white/5 flex justify-between items-center text-purple-300 text-xs font-bold uppercase tracking-widest">
                <span>MÁQUINA {config.stationNumber || '??'}</span>
                <span>SERVIDOR {config.serverIp || 'OFFLINE'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mensagem do servidor */}
        {state.message && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-yellow-900 px-6 py-3 rounded-lg shadow-lg z-20">
            📢 {state.message}
          </div>
        )}

        {/* Botão de Configurações (Admin) */}
        <button
          onClick={() => {
            setSettingsLoginStep('login');
            setSettingsUsername('');
            setSettingsPassword('');
            setSettingsError('');
            setShowSettingsModal(true);
          }}
          className="fixed bottom-4 left-4 bg-white/20 hover:bg-white/40 text-white p-3 rounded-full backdrop-blur-sm transition-all z-50 shadow-lg"
          title="Configurações do Servidor"
        >
          ⚙️
        </button>

        {settingsUI}
        {exitUI}
      </div>
    );
  }

  // Buscar informações do cliente atual
  const activeSessionForHUD = state.sessionId ? sessions.find(s => s.id === state.sessionId) : null;
  const currentCustomer = activeSessionForHUD?.customerId 
    ? customers.find(c => c.id === activeSessionForHUD.customerId) 
    : null;
  const customerDisplayName = currentCustomer 
    ? currentCustomer.name.split(' ')[0] 
    : (activeSessionForHUD?.customerName?.split(' ')[0] || 'Visitante');

  // TELA PRINCIPAL (LIBERADA) -> HUD COMPACTO NO TOPO DIREITO
  // Importante: não pode depender do tamanho da janela (pode estar em fullscreen por falha de setWindowMode).
  return (
    <div
      style={{ 
        position: 'fixed',
        top: 12,
        right: 12,
        width: 'min(360px, calc(100vw - 24px))',
        background: 'transparent',
        zIndex: 9999
      }}
      className="pointer-events-none select-none"
    >
      {/* HUD Pill — tamanho controlado, independente da janela */}
      <div
        style={{
          width: '100%',
          height: 60,
          background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.95) 0%, rgba(67, 24, 108, 0.9) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitAppRegion: 'drag' as any,
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          padding: '0 16px',
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.2)',
          boxShadow: '0 15px 50px rgba(0,0,0,0.6), inset 0 0 20px rgba(255,255,255,0.05)',
          pointerEvents: 'auto',
          overflow: 'hidden',
        } as React.CSSProperties}
      >
        {/* Info do Usuário / Estação */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            {settings.logo ? (
              <img src={settings.logo} alt="logo" style={{ height: '36px', width: '36px', borderRadius: '10px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.2)' }} />
            ) : (
              <div style={{ width: '36px', height: '36px', background: 'rgba(255,255,255,0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                👤
              </div>
            )}
            <div style={{ 
              position: 'absolute', 
              bottom: '-2px', 
              right: '-2px', 
              width: '12px', 
              height: '12px', 
              background: '#22c55e', 
              borderRadius: '50%', 
              border: '2px solid #1e1b4b',
              boxShadow: '0 0 10px #22c55e'
            }} />
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span style={{ fontSize: '12px', fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {customerDisplayName}
            </span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(216, 180, 254, 0.8)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              PC {config.stationNumber}
            </span>
          </div>
        </div>

        {/* Divisor Vertical */}
        <div style={{ width: '1px', height: '32px', background: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />

        {/* Tempo Restante */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '84px' }}>
          <span style={{ 
            fontSize: '28px', 
            fontWeight: 900, 
            fontFamily: '"Outfit", sans-serif',
            lineHeight: 1,
            color: state.timeRemaining <= 300 ? '#ff4d4d' : '#ffffff',
            textShadow: state.timeRemaining <= 300 ? '0 0 15px rgba(255,77,77,0.5)' : 'none',
            letterSpacing: '-0.03em',
            animation: state.timeRemaining <= 300 ? 'pulse 1s infinite' : 'none'
          }}>
            {formatTime(state.timeRemaining).substring(0, 5)}
            <span style={{ fontSize: '14px', opacity: 0.7, marginLeft: '1px' }}>
              :{formatTime(state.timeRemaining).substring(6, 8)}
            </span>
          </span>
          <span style={{ fontSize: '8px', fontWeight: 800, color: 'rgba(216, 180, 254, 0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '2px' }}>
            Tempo Restante
          </span>
        </div>

        {/* Ações — Sem Drag */}
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0, WebkitAppRegion: 'no-drag' as any } as React.CSSProperties}>
          <button
            onClick={() => {
              setEndSessionUsername('');
              setEndSessionPassword('');
              setEndSessionError('');
              setEndSessionSuccess(null);
              setShowEndSessionModal(true);
            }}
            title="Sair / Encerrar"
            style={{
              background: 'linear-gradient(to bottom, #f97316, #ea580c)',
              border: 'none',
              borderRadius: '12px',
              color: '#fff',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 4px 15px rgba(234, 88, 12, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.05)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(234, 88, 12, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(234, 88, 12, 0.3)';
            }}
          >
            <X size={20} strokeWidth={3} />
          </button>
        </div>

        {/* Alça de Arrastar (Visual) */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '2px', 
          opacity: 0.3, 
          paddingLeft: '4px' 
        }}>
          {[1,2,3].map(i => <div key={i} style={{ width: '3px', height: '3px', background: '#fff', borderRadius: '50%' }} />)}
        </div>
      </div>

      {/* Mensagem flutuante do servidor — aparece abaixo do HUD */}
      {state.message && (
        <div
          style={{
            position: 'fixed',
            top: 84,
            right: 12,
            background: '#fbbf24',
            color: '#78350f',
            padding: '10px 16px',
            borderRadius: '12px',
            fontSize: '13px',
            fontWeight: 800,
            boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
            zIndex: 1000,
            animation: 'bounce 1s infinite',
          }}
        >
          📢 {state.message}
        </div>
      )}

      {/* Modais */}
      {settingsUI}
      {exitUI}
      {endSessionUI}
    </div>
  );
};

export default ClientView;
