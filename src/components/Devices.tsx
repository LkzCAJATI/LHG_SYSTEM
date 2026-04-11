import React, { useState, useReducer, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useNetworkStore, pushTimeTransferNetworkSync } from '../store/networkStore';
import { Device, Customer, Session } from '../types';
import { sessionRemainingSeconds } from '../utils/sessionRemaining';
import { formatMinutesBr } from '../utils/formatMinutesBr';

const DURATION_PRESETS_MIN = [10, 30, 60, 120] as const;
const MAX_SESSION_MINUTES = 24 * 60;

// Ícone de Monitor
const MonitorIcon = () => (
  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

// Ícone de Controle
const GamepadIcon = () => (
  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
  </svg>
);

// Ícone de Joystick (Fliperama)
const JoystickIcon = () => (
  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
  </svg>
);

const Devices: React.FC = () => {
  const { devices, customers, startSession, endSessionSavingTime, pauseSession, resumeSession, transferTimeBetweenDevices } = useStore();
  const { 
    isServerRunning, 
    connectedClients, 
    lockDevice, 
    unlockDevice, 
    shutdownDevice, 
    restartDevice,
    isDeviceConnected,
    sendPcUnlockStartSession,
    sendDeviceCommand,
    resolveCommandTargetId,
    startRemoteDesktop,
    remoteDesktopSession,
    stopRemoteDesktop,
    startServer,
    stopServer
  } = useNetworkStore();
  
  const [activeFilter, setActiveFilter] = useState<'all' | 'pc' | 'consoles' | 'arcade'>('all');
  const [isScanning, setIsScanning] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [customerName, setCustomerName] = useState('');
  /** Soma por cliques nos atalhos (+10 / +30 / +1h / +2h), até 24 h. */
  const [duration, setDuration] = useState(0);
  const [extraControllers, setExtraControllers] = useState(0);
  const [showRemoteModal, setShowRemoteModal] = useState(false);
  const [remoteMessage, setRemoteMessage] = useState('');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferFromDevice, setTransferFromDevice] = useState<Device | null>(null);
  const [transferToDeviceId, setTransferToDeviceId] = useState<string>('');
  /** Atualiza cards a cada 1s para contagem regressiva (tempo restante). */
  const [, bumpSessionClock] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const id = window.setInterval(() => bumpSessionClock(), 1000);
    return () => clearInterval(id);
  }, []);

  const getDeviceTypeLabel = (type: Device['type']) => {
    switch (type) {
      case 'pc':
        return 'PC';
      case 'console':
        return 'Console';
      case 'playstation':
        return 'PlayStation';
      case 'arcade':
        return 'Fliperama';
    }
  };

  const calcRemainingMinutes = (session?: Session) => {
    if (!session?.startTime) return 0;
    return Math.floor(sessionRemainingSeconds(session) / 60);
  };

  // Estado para busca de cliente cadastrado
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [useRegisteredCustomer, setUseRegisteredCustomer] = useState(false);
  const [useCustomerCreditsAuto, setUseCustomerCreditsAuto] = useState(true);

  const filteredCustomers = customerSearch.length >= 2
    ? customers.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.username.toLowerCase().includes(customerSearch.toLowerCase())
      ).slice(0, 5)
    : [];

  const getDeviceIcon = (type: Device['type']) => {
    switch (type) {
      case 'pc': return <MonitorIcon />;
      case 'console': return <GamepadIcon />;
      case 'playstation': return <GamepadIcon />;
      case 'arcade': return <JoystickIcon />;
    }
  };

  const getStatusColor = (status: Device['status']) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'in_use': return 'bg-yellow-500';
      case 'paused': return 'bg-orange-500';
      case 'maintenance': return 'bg-red-500';
    }
  };

  const getStatusText = (status: Device['status']) => {
    switch (status) {
      case 'available': return 'Disponível';
      case 'in_use': return 'Em Uso';
      case 'paused': return 'Pausado';
      case 'maintenance': return 'Manutenção';
    }
  };

  const isConsoleLike = (d: Device) => d.type === 'console' || d.type === 'playstation';

  const filteredDevices = devices.filter(d => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'consoles') return isConsoleLike(d);
    return d.type === activeFilter;
  });

  const handleStartSession = (device: Device) => {
    if (device.type === 'pc') {
      if (!isDeviceConnected(device.id)) {
        alert('Este PC não está conectado ao servidor! Verifique se o cliente está rodando.');
        return;
      }
    }
    setDuration(0);
    setSelectedDevice(device);
    setShowStartModal(true);
  };

  const handleConfirmStart = () => {
    if (!selectedDevice) return;

    const selectedCustomerCredits = selectedCustomer?.credits || 0;
    const usingAutoCredits = useRegisteredCustomer && !!selectedCustomer && useCustomerCreditsAuto;
    const finalDuration = usingAutoCredits ? selectedCustomerCredits : duration;

    if (usingAutoCredits && selectedCustomerCredits <= 0) {
      alert('Este cliente não possui créditos disponíveis.');
      return;
    }
    if (!Number.isFinite(finalDuration) || finalDuration <= 0) {
      alert('Duração inválida.');
      return;
    }

    const name = selectedCustomer ? selectedCustomer.name : (customerName || 'Cliente');
    const custId = selectedCustomer ? selectedCustomer.id : undefined;
    const hours = finalDuration / 60;
    startSession(selectedDevice.id, name, hours, extraControllers, custId);

    if (selectedDevice.type === 'pc' && isDeviceConnected(selectedDevice.id)) {
      const updatedDevice = useStore.getState().devices.find(d => d.id === selectedDevice.id);
      const newSession = updatedDevice?.currentSession;
      if (newSession?.id) {
        void sendPcUnlockStartSession(selectedDevice.id, newSession.id, finalDuration);
      }
    }

    setShowStartModal(false);
    setSelectedDevice(null);
    setCustomerName('');
    setDuration(0);
    setExtraControllers(0);
    setCustomerSearch('');
    setSelectedCustomer(null);
    setUseRegisteredCustomer(false);
    setUseCustomerCreditsAuto(true);
  };

  const handleEndSession = (device: Device) => {
    if (device.currentSession) {
      if (device.type === 'pc' && isDeviceConnected(device.id)) {
        void sendDeviceCommand(device.id, { type: 'end_session' });
      }
      endSessionSavingTime(device.currentSession.id);
    }
  };

  const handleShutdown = async (device: Device) => {
    if (confirm(`Tem certeza que deseja DESLIGAR ${device.name}?`)) {
      await shutdownDevice(device.id);
    }
  };

  const handleRestart = async (device: Device) => {
    if (confirm(`Tem certeza que deseja REINICIAR ${device.name}?`)) {
      await restartDevice(device.id);
    }
  };

  const handleLock = async (device: Device) => {
    await lockDevice(device.id);
  };

  const handleUnlock = async (device: Device) => {
    await unlockDevice(device.id);
  };

  const handleRemoteDesktop = (device: Device) => {
    const wsId = resolveCommandTargetId(device.id) || device.id;
    startRemoteDesktop(wsId);
    setShowRemoteModal(true);
  };

  const handleCloseRemote = () => {
    stopRemoteDesktop();
    setShowRemoteModal(false);
  };

  const formatRemaining = (session?: Session) => {
    if (!session?.startTime) return '00:00:00';
    const rem = Math.max(0, sessionRemainingSeconds(session));
    const hours = Math.floor(rem / 3600);
    const minutes = Math.floor((rem % 3600) / 60);
    const seconds = rem % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const calculatePrice = () => {
    if (!selectedDevice) return 0;
    const effectiveDuration = (useRegisteredCustomer && selectedCustomer && useCustomerCreditsAuto)
      ? selectedCustomer.credits
      : duration;
    const hours = effectiveDuration / 60;
    let price = selectedDevice.pricePerHour * hours;
    if ((selectedDevice.type === 'console' || selectedDevice.type === 'playstation') && extraControllers > 0) {
      price += extraControllers * 3; // R$ 3 por controle extra
    }
    return price;
  };

  const pcCount = devices.filter(d => d.type === 'pc').length;
  const consoleCount = devices.filter(d => d.type === 'console' || d.type === 'playstation').length;
  const arcadeCount = devices.filter(d => d.type === 'arcade').length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dispositivos</h1>
          <p className="text-gray-600">Gerencie todos os dispositivos da sua LAN House</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm">
            <span className={`w-3 h-3 rounded-full ${isServerRunning ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span className="text-sm font-medium text-gray-700">
              Servidor: {isServerRunning ? 'Online' : 'Offline'}
            </span>
            <button
              onClick={() => isServerRunning ? stopServer() : startServer()}
              className={`ml-2 px-3 py-1 rounded text-xs font-bold transition-colors ${
                isServerRunning 
                  ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {isServerRunning ? 'Desligar' : 'Ativar'}
            </button>
          </div>
          
          <button
            onClick={() => {
              setIsScanning(true);
              setTimeout(() => setIsScanning(false), 1500); // call to refresh
            }}
            disabled={!isServerRunning || isScanning}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              isServerRunning && !isScanning
                ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <svg className={`w-5 h-5 ${isScanning ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isScanning ? 'Atualizando...' : 'Atualizar Rede'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Total de Dispositivos</div>
          <div className="text-2xl font-bold text-gray-800">{devices.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">PCs</div>
          <div className="text-2xl font-bold text-purple-600">{pcCount}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Consoles</div>
          <div className="text-2xl font-bold text-blue-600">{consoleCount}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Fliperamas</div>
          <div className="text-2xl font-bold text-orange-600">{arcadeCount}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeFilter === 'all' 
              ? 'bg-purple-600 text-white' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Todos
        </button>
        <button
          onClick={() => setActiveFilter('pc')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeFilter === 'pc' 
              ? 'bg-purple-600 text-white' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <MonitorIcon /> PCs
        </button>
        <button
          onClick={() => setActiveFilter('consoles')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeFilter === 'consoles' 
              ? 'bg-purple-600 text-white' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <GamepadIcon /> Consoles
        </button>
        <button
          onClick={() => setActiveFilter('arcade')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeFilter === 'arcade' 
              ? 'bg-purple-600 text-white' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <JoystickIcon /> Fliperama
        </button>
      </div>

      {/* Grid de Dispositivos */}
      <div className="grid grid-cols-5 gap-4">
        {filteredDevices.map(device => {
          const isConnected = device.type === 'pc' ? isDeviceConnected(device.id) : false;
          
          return (
            <div
              key={device.id}
              className={`bg-white rounded-xl shadow-lg overflow-hidden border-2 transition-all hover:shadow-xl ${
                device.status === 'in_use' ? 'border-yellow-400' : 
                device.status === 'paused' ? 'border-orange-400' : 
                device.status === 'available' ? 'border-green-400' : 'border-red-400'
              }`}
            >
              {/* Header do Card */}
              <div className={`p-4 ${
                device.status === 'in_use' ? 'bg-yellow-50' : 
                device.status === 'paused' ? 'bg-orange-50' : 
                device.status === 'available' ? 'bg-green-50' : 'bg-red-50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg ${
                    device.type === 'pc' ? 'bg-purple-100 text-purple-600' :
                    (device.type === 'console' || device.type === 'playstation') ? 'bg-blue-100 text-blue-600' :
                    'bg-orange-100 text-orange-600'
                  }`}>
                    {getDeviceIcon(device.type)}
                  </div>
                  <div className="flex items-center gap-2">
                    {device.type === 'pc' && (
                      <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} title={isConnected ? 'Conectado' : 'Desconectado'}></span>
                    )}
                    <span className={`w-3 h-3 rounded-full ${getStatusColor(device.status)}`}></span>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mt-2">{device.name}</h3>
                <p className="text-sm text-gray-500">{getStatusText(device.status)}</p>
              </div>

              {/* Conteúdo do Card */}
              <div className="p-4">
                {(device.status === 'in_use' || device.status === 'paused') && device.currentSession && (
                  <div className="mb-3">
                    <div className="text-xs text-gray-500 mb-1">Tempo restante</div>
                    <div className={`text-xl font-mono font-bold ${device.status === 'paused' ? 'text-orange-500 opacity-80' : 'text-gray-800'}`}>
                      {formatRemaining(device.currentSession)}
                    </div>
                    {device.currentSession.customerName && (
                      <div className="text-sm text-gray-600 mt-1">
                        👤 {device.currentSession.customerName}
                      </div>
                    )}
                    {device.extraControllers && device.extraControllers > 0 && (
                      <div className="text-sm text-gray-600">
                        🎮 +{device.extraControllers} controle(s)
                      </div>
                    )}
                  </div>
                )}

                {/* Preço */}
                <div className="text-sm text-gray-500 mb-3">
                  R$ {device.pricePerHour.toFixed(2)}/hora
                  {(device.type === 'console' || device.type === 'playstation') && <span className="text-xs ml-1">(+R$ 3/controle)</span>}
                </div>

                {/* Botões de Ação */}
                <div className="space-y-2">
                  {device.status === 'available' && (
                    <button
                      onClick={() => handleStartSession(device)}
                      className="w-full py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                    >
                      ▶ Iniciar
                    </button>
                  )}
                  
                  {(device.status === 'in_use' || device.status === 'paused') && device.currentSession && (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => {
                          if (device.status === 'in_use') {
                            pauseSession(device.currentSession!.id);
                            if (device.type === 'pc' && isDeviceConnected(device.id)) {
                              void sendDeviceCommand(device.id, { type: 'pause' });
                            }
                          } else {
                            resumeSession(device.currentSession!.id);
                            if (device.type === 'pc' && isDeviceConnected(device.id)) {
                              void sendDeviceCommand(device.id, { type: 'resume' });
                            }
                          }
                        }}
                        className={`w-full py-2 text-white rounded-lg font-medium transition-colors ${
                          device.status === 'in_use' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'
                        }`}
                      >
                        {device.status === 'in_use' ? '⏸ Pausar Tempo' : '▶ Retomar Tempo'}
                      </button>
                      <button
                        onClick={() => {
                          setTransferFromDevice(device);
                          setTransferToDeviceId('');
                          setShowTransferModal(true);
                        }}
                        className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                        title="Transferir o tempo restante para outro dispositivo"
                      >
                        🔁 Transferir Tempo
                      </button>
                      <button
                        onClick={() => handleEndSession(device)}
                        className="w-full py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                      >
                        ⏹ Finalizar
                      </button>
                    </div>
                  )}

                  {/* Controles Remotos (apenas para PCs conectados) */}
                  {device.type === 'pc' && isConnected && (
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t">
                      <button
                        onClick={() => handleLock(device)}
                        className="py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium transition-colors"
                        title="Bloquear Tela"
                      >
                        🔒 Bloquear
                      </button>
                      <button
                        onClick={() => handleUnlock(device)}
                        className="py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium transition-colors"
                        title="Desbloquear Tela"
                      >
                        🔓 Liberar
                      </button>
                      <button
                        onClick={() => handleRestart(device)}
                        className="py-1.5 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded text-xs font-medium transition-colors"
                        title="Reiniciar PC"
                      >
                        🔄 Reiniciar
                      </button>
                      <button
                        onClick={() => handleShutdown(device)}
                        className="py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-medium transition-colors"
                        title="Desligar PC"
                      >
                        ⏻ Desligar
                      </button>
                      <button
                        onClick={() => handleRemoteDesktop(device)}
                        className="col-span-2 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded text-xs font-medium transition-colors"
                        title="Acesso Remoto"
                      >
                        🖥️ Acesso Remoto
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Iniciar Sessão */}
      {showStartModal && selectedDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Iniciar Sessão - {selectedDevice.name}</h2>
            
            <div className="space-y-4">
              {/* Seleção: cliente com cadastro ou sem */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setUseRegisteredCustomer(false);
                    setSelectedCustomer(null);
                    setCustomerSearch('');
                    setUseCustomerCreditsAuto(true);
                  }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    !useRegisteredCustomer ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Sem cadastro
                </button>
                <button
                  onClick={() => {
                    setUseRegisteredCustomer(true);
                    setCustomerName('');
                    setUseCustomerCreditsAuto(true);
                  }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    useRegisteredCustomer ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Cliente cadastrado
                </button>
              </div>

              {/* Campo de nome livre (sem cadastro) */}
              {!useRegisteredCustomer && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Cliente</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nome do cliente (opcional)"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              )}

              {/* Busca de cliente cadastrado */}
              {useRegisteredCustomer && (
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Cliente</label>
                  {selectedCustomer ? (
                    <div className="flex items-center gap-2 bg-green-50 border border-green-300 rounded-lg px-4 py-2">
                      <span className="flex-1">
                        <span className="font-medium text-green-800">{selectedCustomer.name}</span>
                        <span className="text-green-600 text-sm ml-2">@{selectedCustomer.username}</span>
                        <span className="text-green-500 text-xs ml-2">{selectedCustomer.credits} min em créditos</span>
                      </span>
                      <button
                        onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }}
                        className="text-gray-400 hover:text-red-500 text-lg font-bold"
                      >&#x2715;</button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        placeholder="Digite nome ou usuário..."
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      {filteredCustomers.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {filteredCustomers.map(c => (
                            <button
                              key={c.id}
                              onClick={() => { setSelectedCustomer(c); setCustomerSearch(''); }}
                              className="w-full text-left px-4 py-2 hover:bg-purple-50 transition-colors"
                            >
                              <span className="font-medium text-gray-800">{c.name}</span>
                              <span className="text-gray-500 text-sm ml-2">@{c.username}</span>
                              <span className="text-purple-500 text-xs ml-2">{formatMinutesBr(c.credits)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {customerSearch.length >= 2 && filteredCustomers.length === 0 && (
                        <p className="text-sm text-gray-400 mt-1">Nenhum cliente encontrado</p>
                      )}
                    </>
                  )}
                </div>
              )}

              {useRegisteredCustomer && selectedCustomer && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-blue-900">
                    <input
                      type="checkbox"
                      checked={useCustomerCreditsAuto}
                      onChange={(e) => setUseCustomerCreditsAuto(e.target.checked)}
                    />
                    Usar créditos do cliente automaticamente
                  </label>
                  <p className="text-xs text-blue-700 mt-1">
                    Créditos atuais: <strong>{formatMinutesBr(selectedCustomer.credits)}</strong>
                    {useCustomerCreditsAuto ? ' (serão usados como duração desta sessão)' : ''}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tempo da sessão (some clicando várias vezes)
                </label>
                <p className="text-sm text-gray-600 mb-2">
                  Total: <strong>{formatMinutesBr(duration)}</strong>
                  <span className="text-gray-400 font-normal"> (máx. 24 h)</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {DURATION_PRESETS_MIN.map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() =>
                        setDuration(prev =>
                          Math.min(MAX_SESSION_MINUTES, prev + d)
                        )
                      }
                      disabled={useRegisteredCustomer && !!selectedCustomer && useCustomerCreditsAuto}
                      className={`flex-1 min-w-[4.5rem] py-2 rounded-lg font-medium transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200 ${
                        (useRegisteredCustomer && !!selectedCustomer && useCustomerCreditsAuto)
                          ? 'opacity-50 cursor-not-allowed'
                          : ''
                      }`}
                    >
                      +{d === 60 ? '1h' : d === 120 ? '2h' : `${d}min`}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDuration(0)}
                    disabled={useRegisteredCustomer && !!selectedCustomer && useCustomerCreditsAuto}
                    className="py-2 px-3 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Zerar
                  </button>
                </div>
              </div>

              {(selectedDevice.type === 'console' || selectedDevice.type === 'playstation') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Controles Extras (+R$ 3,00 cada)</label>
                  <div className="flex gap-2">
                    {[0, 1, 2, 3].map(c => (
                      <button
                        key={c}
                        onClick={() => setExtraControllers(c)}
                        className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                          extraControllers === c 
                            ? 'bg-purple-600 text-white' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {c === 0 ? 'Nenhum' : `+${c}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Valor Total:</span>
                  <span className="text-2xl font-bold text-purple-600">
                    R$ {calculatePrice().toFixed(2)}
                  </span>
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {formatMinutesBr(
                    (useRegisteredCustomer && selectedCustomer && useCustomerCreditsAuto)
                      ? selectedCustomer.credits
                      : duration
                  )}{' '}
                  × R$ {selectedDevice.pricePerHour.toFixed(2)}/hora
                  {extraControllers > 0 && ` + ${extraControllers} × R$ 3,00`}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowStartModal(false);
                  setSelectedDevice(null);
                  setUseCustomerCreditsAuto(true);
                }}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmStart}
                className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Transferir Tempo */}
      {showTransferModal && transferFromDevice?.currentSession && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <h2 className="text-lg sm:text-xl font-bold mb-2">Transferir Tempo</h2>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              Origem: <strong>{transferFromDevice.name}</strong> — restante aproximado:{' '}
              <strong>{calcRemainingMinutes(transferFromDevice.currentSession)} min</strong>
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Destino</label>
                <select
                  value={transferToDeviceId}
                  onChange={(e) => setTransferToDeviceId(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm sm:text-base"
                >
                  <option value="">Selecione...</option>
                  {devices
                    .filter(d => d.id !== transferFromDevice.id)
                    .map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({getDeviceTypeLabel(d.type)}) - {d.status === 'available' ? 'Disponível' : d.status === 'in_use' ? 'Em uso' : d.status === 'paused' ? 'Pausado' : 'Manutenção'}
                      </option>
                    ))}
                </select>
                <p className="mt-2 text-xs text-gray-500">
                  Todos os aparelhos aparecem na lista, inclusive offline.
                </p>
              </div>

              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                Será transferido o <strong>tempo restante exato</strong> da origem (incluindo segundos). A origem fica disponível.
              </p>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (!transferFromDevice?.currentSession) return;
                    if (!transferToDeviceId) {
                      alert('Selecione um destino.');
                      return;
                    }
                    const res = transferTimeBetweenDevices({
                      fromDeviceId: transferFromDevice.id,
                      toDeviceId: transferToDeviceId
                    });
                    if (!res.ok) {
                      alert(res.error || 'Falha ao transferir.');
                      return;
                    }
                    pushTimeTransferNetworkSync(transferFromDevice.id, transferToDeviceId);
                    setShowTransferModal(false);
                  }}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                >
                  Transferir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Acesso Remoto */}
      {showRemoteModal && remoteDesktopSession && (() => {
        const remoteDevice = devices.find(d => d.id === remoteDesktopSession);
        const remoteDeviceName = remoteDevice?.name ?? remoteDesktopSession;
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">
                  Acesso Remoto - {remoteDeviceName}
                </h2>
                <button
                  onClick={handleCloseRemote}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              
              {/* Simulação de tela remota */}
              <div className="bg-gray-900 rounded-lg h-64 flex items-center justify-center mb-4">
                <div className="text-center">
                  <div className="text-6xl mb-4">🖥️</div>
                  <p className="text-gray-400">Tela remota simulada</p>
                  <p className="text-gray-500 text-sm">
                    Em produção, aqui seria exibida a tela do PC remoto via WebRTC/VNC
                  </p>
                </div>
              </div>

              {/* Enviar mensagem */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={remoteMessage}
                  onChange={(e) => setRemoteMessage(e.target.value)}
                  placeholder="Enviar mensagem para o cliente..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={() => {
                    alert(`Mensagem enviada para ${remoteDeviceName}: "${remoteMessage}"`);
                    setRemoteMessage('');
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
                >
                  Enviar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Lista de Clientes Conectados */}
      {connectedClients.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Clientes Conectados na Rede</h2>
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dispositivo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conectado em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {connectedClients.map(client => (
                  <tr key={client.id}>
                    <td className="px-4 py-3 font-medium">{client.deviceName || client.name || 'Não registrado'}</td>
                    <td className="px-4 py-3 text-gray-600">{client.ip}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        client.status === 'online' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {client.status === 'online' ? 'Conectado' : 'Desconectado'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {client.connectedAt ? new Date(client.connectedAt).toLocaleTimeString('pt-BR') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Devices;
