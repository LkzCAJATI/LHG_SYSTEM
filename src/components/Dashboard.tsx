import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useNetworkStore } from '../store/networkStore';
import { Device, Session } from '../types';
import { sessionRemainingSeconds } from '../utils/sessionRemaining';
import { formatMinutesBr, minutesToReais } from '../utils/formatMinutesBr';
import { useSettingsStore } from '../store/settingsStore';
import {
  Monitor, Gamepad2, Plus, Square,
  X, Check, Power, RotateCw, Lock, Unlock, Wifi, WifiOff, ArrowLeftRight
} from 'lucide-react';
import { pushTimeTransferNetworkSync } from '../store/networkStore';

export function Dashboard() {
  const { settings } = useSettingsStore();
  const { 
    devices, updateDevice, addDevice, 
    endSessionSavingTime, pauseSession, resumeSession,
    customers, removeCredits, startSession,
    transferTimeBetweenDevices
  } = useStore();
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
    startServer,
    stopServer
  } = useNetworkStore();
  
  const [isScanning, setIsScanning] = useState(false);
  
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pc' | 'console' | 'arcade'>('all');
  const [newDevice, setNewDevice] = useState({
    name: '',
    type: 'pc' as 'pc' | 'console' | 'arcade',
    pricePerHour: 5,
    /** Mesmo ID configurado no cliente (ex.: pc-01) — evita comando na rede ir para UUID errado */
    stationClientId: '',
    stationIp: '',
  });

  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditCustomerSearch, setCreditCustomerSearch] = useState('');
  const [selectedCreditCustomer, setSelectedCreditCustomer] = useState<any>(null);
  /** Minutos a liberar; some com +10 / +30 / +1h / +2h (limitado ao saldo do cliente). */
  const [creditReleaseMinutes, setCreditReleaseMinutes] = useState(0);
  const [showCreditSuggestions, setShowCreditSuggestions] = useState(false);

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferFromDevice, setTransferFromDevice] = useState<Device | null>(null);
  const [transferToDeviceId, setTransferToDeviceId] = useState('');

  /** Contagem regressiva (tempo restante), igual ao PWA — evita “reset” visual na transferência. */
  const [sessionTimes, setSessionTimes] = useState<Record<string, string>>({});

  useEffect(() => {
    const tick = () => {
      const times: Record<string, string> = {};
      devices.forEach((device) => {
        const session = device.currentSession;
        if (
          (device.status === 'in_use' || device.status === 'paused') &&
          session?.startTime &&
          !session?.isPendingStart
        ) {
          const rem = Math.max(0, sessionRemainingSeconds(session));
          const hours = Math.floor(rem / 3600);
          const minutes = Math.floor((rem % 3600) / 60);
          const seconds = rem % 60;
          times[device.id] = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
      });
      setSessionTimes(times);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [devices]);

  const pcDevices = devices.filter(d => d.type === 'pc');
  const consoleDevices = devices.filter(d => d.type === 'console');
  const arcadeDevices = devices.filter(d => d.type === 'arcade');

  const filteredDevices = devices.filter(d => {
    if (activeFilter === 'all') return true;
    return d.type === activeFilter;
  });

  const getStatusColor = (status: Device['status']) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'in_use':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'paused':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusLabel = (status: Device['status']) => {
    switch (status) {
      case 'available': return 'Disponível';
      case 'in_use': return 'Em Uso';
      case 'paused': return 'Pausado';
      case 'maintenance': return 'Manutenção';
      default: return status;
    }
  };

  const getDeviceTypeLabel = (type: Device['type']) => {
    switch (type) {
      case 'pc': return 'PC';
      case 'console': return 'Console';
      case 'playstation': return 'PlayStation';
      case 'arcade': return 'Fliperama';
    }
  };

  const calcRemainingMinutes = (session?: Session) => {
    if (!session?.startTime) return 0;
    return Math.floor(sessionRemainingSeconds(session) / 60);
  };

  const handleAddDevice = () => {
    if (!newDevice.name) return;
    
    const sid = newDevice.stationClientId.trim();
    const sip = newDevice.stationIp.trim();
    addDevice({
      name: newDevice.name,
      type: newDevice.type,
      status: 'available',
      pricePerHour: newDevice.pricePerHour,
      ...(newDevice.type === 'pc' && sid ? { suggestedClientId: sid } : {}),
      ...(newDevice.type === 'pc' && sip ? { ip: sip } : {}),
      ...(newDevice.type === 'pc' && sid ? { networkClientId: sid } : {}),
    });
    
    setNewDevice({ name: '', type: 'pc', pricePerHour: 5, stationClientId: '', stationIp: '' });
    setShowAddDevice(false);
  };

  const handleEndSession = (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (device?.currentSession) {
      if (device.type === 'pc' && isDeviceConnected(device.id)) {
        void sendDeviceCommand(device.id, { type: 'end_session' });
      }
      endSessionSavingTime(device.currentSession.id);
    }
  };

  const toggleMaintenance = (device: Device) => {
    updateDevice(device.id, {
      status: device.status === 'maintenance' ? 'available' : 'maintenance'
    });
  };

  // Controles remotos
  const handleLock = async (deviceId: string) => {
    await lockDevice(deviceId);
  };

  const handleUnlock = async (deviceId: string) => {
    await unlockDevice(deviceId);
  };

  const handleShutdown = async (deviceId: string, deviceName: string) => {
    if (confirm(`Tem certeza que deseja DESLIGAR ${deviceName}?`)) {
      await shutdownDevice(deviceId);
    }
  };

  const handleRestart = async (deviceId: string, deviceName: string) => {
    if (confirm(`Tem certeza que deseja REINICIAR ${deviceName}?`)) {
      await restartDevice(deviceId);
    }
  };

  const handleStartWithCredits = async () => {
    if (!selectedDevice || !selectedCreditCustomer) return;

    const minutesToUse = creditReleaseMinutes;
    if (minutesToUse <= 0) {
      alert('Defina quanto tempo liberar (use os atalhos ou informe minutos).');
      return;
    }
    if (selectedCreditCustomer.credits < minutesToUse) {
      alert('Cliente não possui créditos suficientes!');
      return;
    }

    // 1. Remover créditos do cliente
    removeCredits(selectedCreditCustomer.id, minutesToUse);

    // 2. Iniciar sessão
    startSession(
      selectedDevice.id, 
      selectedCreditCustomer.name, 
      minutesToUse / 60, 
      0, 
      selectedCreditCustomer.id
    );

    if (selectedDevice.type === 'pc' && isDeviceConnected(selectedDevice.id)) {
      const newSession = useStore.getState().devices.find((d) => d.id === selectedDevice.id)?.currentSession;
      if (newSession?.id) {
        void sendPcUnlockStartSession(selectedDevice.id, newSession.id, minutesToUse);
      }
    } else if (selectedDevice.type === 'pc') {
      await unlockDevice(selectedDevice.id);
    }

    setShowCreditModal(false);
    setSelectedDevice(null);
    setSelectedCreditCustomer(null);
    setCreditCustomerSearch('');
    setCreditReleaseMinutes(0);
  };

  const closeCreditModal = () => {
    setShowCreditModal(false);
    setCreditReleaseMinutes(0);
  };

  const availableDevices = devices.filter(d => d.status === 'available').length;
  const inUseDevices = devices.filter(d => d.status === 'in_use').length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dispositivos</h1>
          <p className="text-gray-600">Gerencie todos os dispositivos da sua LAN House</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Status do servidor */}
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow">
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
              setTimeout(() => setIsScanning(false), 1500); // refresh fake state
            }}
            disabled={!isServerRunning || isScanning}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              isServerRunning && !isScanning
                ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            <svg className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isScanning ? 'Atualizando...' : 'Atualizar Rede'}
          </button>

          <button
            onClick={() => setShowAddDevice(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Dispositivo
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Total</div>
          <div className="text-2xl font-bold text-gray-800">{devices.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">PCs</div>
          <div className="text-2xl font-bold text-purple-600">{pcDevices.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Consoles</div>
          <div className="text-2xl font-bold text-blue-600">{consoleDevices.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Disponíveis</div>
          <div className="text-2xl font-bold text-green-600">{availableDevices}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Em Uso</div>
          <div className="text-2xl font-bold text-yellow-600">{inUseDevices}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeFilter === 'all' 
              ? 'bg-purple-600 text-white' 
              : 'bg-white text-gray-600 hover:bg-gray-100 shadow'
          }`}
        >
          Todos ({devices.length})
        </button>
        <button
          onClick={() => setActiveFilter('pc')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeFilter === 'pc' 
              ? 'bg-purple-600 text-white' 
              : 'bg-white text-gray-600 hover:bg-gray-100 shadow'
          }`}
        >
          <Monitor className="w-4 h-4" /> PCs ({pcDevices.length})
        </button>
        <button
          onClick={() => setActiveFilter('console')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeFilter === 'console' 
              ? 'bg-purple-600 text-white' 
              : 'bg-white text-gray-600 hover:bg-gray-100 shadow'
          }`}
        >
          <Gamepad2 className="w-4 h-4" /> Consoles ({consoleDevices.length})
        </button>
        <button
          onClick={() => setActiveFilter('arcade')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeFilter === 'arcade' 
              ? 'bg-purple-600 text-white' 
              : 'bg-white text-gray-600 hover:bg-gray-100 shadow'
          }`}
        >
          <Gamepad2 className="w-4 h-4" /> Fliperama ({arcadeDevices.length})
        </button>
      </div>

      {/* Grid de Dispositivos */}
      <div className="grid grid-cols-5 gap-4">
        {filteredDevices.map(device => {
          const isConnected = device.type === 'pc' ? isDeviceConnected(device.id) : false;
          
          return (
            <div
              key={device.id}
              className={`bg-white rounded-xl shadow-lg overflow-hidden border-2 transition-all hover:shadow-xl cursor-pointer ${
                device.status === 'in_use' ? 'border-purple-400' : 
                device.status === 'paused' ? 'border-orange-400' : 
                device.status === 'available' ? 'border-green-400' : 'border-yellow-400'
              }`}
              onClick={() => setSelectedDevice(device)}
            >
              {/* Header do Card */}
              <div className={`p-4 ${
                device.status === 'in_use' ? 'bg-purple-50' : 
                device.status === 'paused' ? 'bg-orange-50' : 
                device.status === 'available' ? 'bg-green-50' : 'bg-yellow-50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg ${
                    device.type === 'pc' ? 'bg-purple-100 text-purple-600' :
                    device.type === 'console' ? 'bg-blue-100 text-blue-600' :
                    'bg-orange-100 text-orange-600'
                  }`}>
                    {device.type === 'pc' ? <Monitor className="w-6 h-6" /> :
                     device.type === 'console' ? <Gamepad2 className="w-6 h-6" /> :
                     <Gamepad2 className="w-6 h-6" />}
                  </div>
                  <div className="flex items-center gap-2">
                    {device.type === 'pc' && (
                      isConnected 
                        ? <Wifi className="w-4 h-4 text-green-500" />
                        : <WifiOff className="w-4 h-4 text-gray-400" />
                    )}
                    <span className={`w-3 h-3 rounded-full ${
                      device.status === 'in_use' ? 'bg-purple-500' : 
                      device.status === 'available' ? 'bg-green-500' : 'bg-yellow-500'
                    }`}></span>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mt-2">{device.name}</h3>
                <p className="text-sm text-gray-500">{getStatusLabel(device.status)}</p>
              </div>

              {/* Conteúdo do Card */}
              <div className="p-4">
                {(device.status === 'in_use' || device.status === 'paused') && device.currentSession && (
                  <div className="mb-3">
                    {device.currentSession.isPendingStart ? (
                      <div className="flex items-center gap-2 text-blue-500 bg-blue-50 px-2 py-1.5 rounded-lg border border-blue-200">
                        <span className="animate-pulse text-base">⏳</span>
                        <span className="text-sm font-semibold">Aguardando PC iniciar...</span>
                      </div>
                    ) : (
                      <>
                        <div className="text-xs text-gray-500 mb-1">Tempo restante</div>
                        <div className={`text-xl font-mono font-bold ${device.status === 'paused' ? 'text-orange-500 opacity-80' : 'text-gray-800'}`}>
                          {sessionTimes[device.id] || '00:00:00'}
                        </div>
                      </>
                    )}
                    {device.currentSession.customerName && (
                      <div className="text-sm text-gray-600 mt-1 truncate">
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
                  {device.type === 'console' && <span className="text-xs ml-1">(+R$ 3/ctrl)</span>}
                </div>

                {/* Botões de Ação */}
                <div className="space-y-2">
                  {(device.status === 'in_use' || device.status === 'paused') && device.currentSession && (
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
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
                          className={`flex-1 py-1 px-2 text-white rounded text-sm font-bold transition-colors ${
                            device.status === 'in_use' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-500 hover:bg-green-600'
                          }`}
                        >
                          {device.status === 'in_use' ? '⏸ Pausar' : '▶ Retomar'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEndSession(device.id);
                          }}
                          className="flex-1 flex items-center justify-center gap-1 py-1 px-2 bg-red-500 hover:bg-red-600 text-white rounded text-sm font-bold transition-colors"
                        >
                          <Square className="w-3 h-3" />
                          Finalizar
                        </button>
                      </div>
                      {!device.currentSession.isPendingStart && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setTransferFromDevice(device);
                            setTransferToDeviceId('');
                            setShowTransferModal(true);
                          }}
                          className="w-full flex items-center justify-center gap-1 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-bold transition-colors"
                          title="Transferir o tempo restante para outro dispositivo"
                        >
                          <ArrowLeftRight className="w-3 h-3" />
                          Transferir tempo
                        </button>
                      )}
                    </div>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMaintenance(device);
                    }}
                    className={`w-full py-2 rounded-lg font-medium transition-colors ${
                      device.status === 'maintenance'
                        ? 'bg-green-500 hover:bg-green-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {device.status === 'maintenance' ? 'Ativar' : 'Manutenção'}
                  </button>

                  {/* Controles Remotos (apenas para PCs conectados) */}
                  {device.type === 'pc' && isConnected && (
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLock(device.id);
                        }}
                        className="flex items-center justify-center gap-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium transition-colors"
                        title="Bloquear Tela"
                      >
                        <Lock className="w-3 h-3" /> Bloquear
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnlock(device.id);
                        }}
                        className="flex items-center justify-center gap-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-medium transition-colors"
                        title="Desbloquear Tela"
                      >
                        <Unlock className="w-3 h-3" /> Liberar
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestart(device.id, device.name);
                        }}
                        className="flex items-center justify-center gap-1 py-1.5 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded text-xs font-medium transition-colors"
                        title="Reiniciar PC"
                      >
                        <RotateCw className="w-3 h-3" /> Reiniciar
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShutdown(device.id, device.name);
                        }}
                        className="flex items-center justify-center gap-1 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-medium transition-colors"
                        title="Desligar PC"
                      >
                        <Power className="w-3 h-3" /> Desligar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal de Adicionar Dispositivo */}
      {showAddDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Adicionar Dispositivo</h2>
              <button onClick={() => setShowAddDevice(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Dispositivo</label>
                <input
                  type="text"
                  value={newDevice.name}
                  onChange={(e) => setNewDevice(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: PC 11, PS5 G"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setNewDevice(prev => ({ ...prev, type: 'pc', pricePerHour: 5 }))}
                    className={`py-2 rounded-lg font-medium transition-colors ${
                      newDevice.type === 'pc' 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    PC
                  </button>
                  <button
                    onClick={() => setNewDevice(prev => ({ ...prev, type: 'console', pricePerHour: 6 }))}
                    className={`py-2 rounded-lg font-medium transition-colors ${
                      newDevice.type === 'console' 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Console
                  </button>
                  <button
                    onClick={() => setNewDevice(prev => ({ ...prev, type: 'arcade', pricePerHour: 5 }))}
                    className={`py-2 rounded-lg font-medium transition-colors ${
                      newDevice.type === 'arcade' 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Fliperama
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preço por Hora (R$)</label>
                <input
                  type="number"
                  value={newDevice.pricePerHour}
                  onChange={(e) => setNewDevice(prev => ({ ...prev, pricePerHour: parseFloat(e.target.value) || 0 }))}
                  min="0"
                  step="0.5"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {newDevice.type === 'pc' && (
                <div className="space-y-3 rounded-lg border border-purple-100 bg-purple-50/50 p-3">
                  <p className="text-xs text-gray-600">
                    Para comandos (liberar tempo) chegarem no PC cliente, o cadastro deve casar com o terminal: use o mesmo ID (ex. <code className="text-purple-800">pc-01</code>) ou o IP fixo da máquina.
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">ID no cliente (opcional)</label>
                    <input
                      type="text"
                      value={newDevice.stationClientId}
                      onChange={(e) => setNewDevice((prev) => ({ ...prev, stationClientId: e.target.value }))}
                      placeholder="pc-01"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">IP do PC (opcional, fallback)</label>
                    <input
                      type="text"
                      value={newDevice.stationIp}
                      onChange={(e) => setNewDevice((prev) => ({ ...prev, stationIp: e.target.value }))}
                      placeholder="192.168.1.50"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddDevice(false)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddDevice}
                disabled={!newDevice.name}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white rounded-lg font-medium"
              >
                <Check className="w-4 h-4" />
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes do Dispositivo */}
      {selectedDevice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setSelectedDevice(null)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{selectedDevice.name}</h2>
              <button onClick={() => setSelectedDevice(null)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-gray-600">Tipo</span>
                <span className="font-medium capitalize">{selectedDevice.type}</span>
              </div>
              
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-gray-600">Status</span>
                <span className={`px-2 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedDevice.status)}`}>
                  {getStatusLabel(selectedDevice.status)}
                </span>
              </div>
              
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-gray-600">Preço/Hora</span>
                <span className="font-medium">R$ {selectedDevice.pricePerHour.toFixed(2)}</span>
              </div>

              {selectedDevice.type === 'pc' && (
                <div className="flex items-center justify-between py-2 border-b">
                  <span className="text-gray-600">Conexão</span>
                  <span className={`font-medium ${isDeviceConnected(selectedDevice.id) ? 'text-green-600' : 'text-gray-400'}`}>
                    {isDeviceConnected(selectedDevice.id) ? 'Conectado' : 'Desconectado'}
                  </span>
                </div>
              )}

              {selectedDevice.status === 'in_use' && selectedDevice.currentSession && (
                <>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-gray-600">Cliente</span>
                    <span className="font-medium">{selectedDevice.currentSession.customerName || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-gray-600">Início</span>
                    <span className="font-medium">
                      {selectedDevice.currentSession.isPendingStart
                        ? <span className="text-blue-500 text-sm">⏳ Aguardando boot...</span>
                        : selectedDevice.currentSession.startTime
                          ? new Date(selectedDevice.currentSession.startTime).toLocaleTimeString('pt-BR')
                          : '-'
                      }
                    </span>
                  </div>
                  {!selectedDevice.currentSession.isPendingStart && (
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-gray-600">Tempo restante</span>
                      <span className="font-mono font-bold text-lg">
                        {sessionTimes[selectedDevice.id] || '00:00:00'}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Ações */}
            <div className="mt-6 space-y-2">
              {selectedDevice.status === 'available' && (
                <button
                  onClick={() => {
                    setCreditReleaseMinutes(0);
                    setShowCreditModal(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-lg transition-all transform hover:scale-[1.02]"
                >
                  <Unlock className="w-5 h-5" />
                  Liberar com Créditos
                </button>
              )}
              {(selectedDevice.status === 'in_use' || selectedDevice.status === 'paused') &&
                selectedDevice.currentSession &&
                !selectedDevice.currentSession.isPendingStart && (
                <button
                  onClick={() => {
                    setTransferFromDevice(selectedDevice);
                    setTransferToDeviceId('');
                    setShowTransferModal(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  Transferir tempo
                </button>
              )}
              {(selectedDevice.status === 'in_use' || selectedDevice.status === 'paused') &&
                selectedDevice.currentSession && (
                <button
                  onClick={() => {
                    handleEndSession(selectedDevice.id);
                    setSelectedDevice(null);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium"
                >
                  <Square className="w-4 h-4" />
                  Finalizar Sessão
                </button>
              )}

              {/* Controles remotos para PCs conectados */}
              {selectedDevice.type === 'pc' && isDeviceConnected(selectedDevice.id) && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleLock(selectedDevice.id)}
                    className="flex items-center justify-center gap-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium"
                  >
                    <Lock className="w-4 h-4" /> Bloquear
                  </button>
                  <button
                    onClick={() => handleUnlock(selectedDevice.id)}
                    className="flex items-center justify-center gap-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium"
                  >
                    <Unlock className="w-4 h-4" /> Liberar
                  </button>
                  <button
                    onClick={() => handleRestart(selectedDevice.id, selectedDevice.name)}
                    className="flex items-center justify-center gap-1 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-lg text-sm font-medium"
                  >
                    <RotateCw className="w-4 h-4" /> Reiniciar
                  </button>
                  <button
                    onClick={() => handleShutdown(selectedDevice.id, selectedDevice.name)}
                    className="flex items-center justify-center gap-1 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium"
                  >
                    <Power className="w-4 h-4" /> Desligar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lista de Clientes Conectados */}
      {connectedClients.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            Clientes na Rede ({connectedClients.length})
          </h2>
          <div className="bg-white rounded-xl shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dispositivo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Última Atividade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {connectedClients.map(client => (
                  <tr key={client.id}>
                    <td className="px-4 py-3 font-medium">{client.deviceName || 'Aguardando registro'}</td>
                    <td className="px-4 py-3 text-gray-600">{client.ip}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        client.connected ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {client.connected ? 'Conectado' : 'Desconectado'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {client.lastSeen ? new Date(client.lastSeen).toLocaleTimeString('pt-BR') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Transferir Tempo */}
      {showTransferModal && transferFromDevice?.currentSession && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[70] p-2 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <h2 className="text-lg sm:text-xl font-bold mb-2">Transferir tempo</h2>
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
                    .filter((d) => d.id !== transferFromDevice.id)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({getDeviceTypeLabel(d.type)}) —{' '}
                        {d.status === 'available'
                          ? 'Disponível'
                          : d.status === 'in_use'
                            ? 'Em uso'
                            : d.status === 'paused'
                              ? 'Pausado'
                              : 'Manutenção'}
                      </option>
                    ))}
                </select>
                <p className="mt-2 text-xs text-gray-500">
                  O destino precisa estar <strong>disponível</strong>. Todos os aparelhos aparecem na lista.
                </p>
              </div>

              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                Será transferido o <strong>tempo restante exato</strong> da origem (incluindo segundos). A origem fica disponível.
              </p>

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="button"
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

      {/* Modal Lançar Créditos */}
      {showCreditModal && selectedDevice && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]" onClick={closeCreditModal}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                  <Unlock className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-gray-800">Liberar com Créditos</h2>
              </div>
              <button onClick={closeCreditModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-sm text-gray-500">Dispositivo selecionado:</p>
                <p className="font-bold text-gray-800">{selectedDevice.name}</p>
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">Buscar Cliente</label>
                <input
                  type="text"
                  value={creditCustomerSearch}
                  onChange={(e) => {
                    setCreditCustomerSearch(e.target.value);
                    setSelectedCreditCustomer(null);
                    setShowCreditSuggestions(true);
                  }}
                  onFocus={() => setShowCreditSuggestions(true)}
                  placeholder="Digite o nome do cliente..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                />

                {showCreditSuggestions && creditCustomerSearch && (
                  <div className="absolute z-[70] left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-2xl max-h-56 overflow-auto">
                    {customers
                      .filter(c => c.name.toLowerCase().includes(creditCustomerSearch.toLowerCase()))
                      .map(customer => (
                        <button
                          key={customer.id}
                          onClick={() => {
                            setCreditCustomerSearch(customer.name);
                            setSelectedCreditCustomer(customer);
                            setShowCreditSuggestions(false);
                          }}
                          className="w-full text-left px-4 py-4 hover:bg-indigo-50 border-b border-gray-50 last:border-0 transition-colors flex items-center justify-between"
                        >
                          <div>
                            <p className="font-bold text-gray-800">{customer.name}</p>
                            <p className="text-xs text-gray-400">{customer.phone || 'Sem telefone'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-indigo-600">
                              {formatMinutesBr(customer.credits)}
                            </p>
                            <p className="text-[10px] text-gray-400">Saldo</p>
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {selectedCreditCustomer && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider">Saldo disponível</p>
                        <p className="text-2xl font-black text-indigo-900">
                          {formatMinutesBr(selectedCreditCustomer.credits)}
                        </p>
                        <p className="text-xs text-indigo-700/80 mt-1">
                          ≈ R$ {minutesToReais(selectedCreditCustomer.credits, settings.pcPricePerHour).toFixed(2)} (tarifa PC/h)
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Quanto tempo liberar?</label>
                    <p className="text-sm text-gray-600 mb-3">
                      Liberando: <strong>{formatMinutesBr(creditReleaseMinutes)}</strong>
                      {creditReleaseMinutes > 0 && (
                        <span className="text-gray-500">
                          {' '}
                          · ≈ R$ {minutesToReais(creditReleaseMinutes, selectedDevice.pricePerHour).toFixed(2)} (tarifa deste aparelho)
                        </span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {[10, 30, 60, 120].map((add) => (
                        <button
                          key={add}
                          type="button"
                          onClick={() =>
                            setCreditReleaseMinutes((m) =>
                              Math.min(selectedCreditCustomer.credits, m + add)
                            )
                          }
                          className="flex-1 min-w-[4.5rem] py-2.5 rounded-xl bg-gray-100 hover:bg-indigo-100 text-gray-800 font-semibold text-sm border border-gray-200"
                        >
                          +{add === 60 ? '1h' : add === 120 ? '2h' : `${add}min`}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setCreditReleaseMinutes(0)}
                        className="py-2.5 px-3 rounded-xl text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
                      >
                        Zerar
                      </button>
                    </div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Ou digite o total (minutos)</label>
                    <input
                      type="number"
                      min={0}
                      max={selectedCreditCustomer.credits}
                      value={creditReleaseMinutes === 0 ? '' : creditReleaseMinutes}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '') {
                          setCreditReleaseMinutes(0);
                          return;
                        }
                        const v = Math.floor(Number(raw));
                        if (!Number.isFinite(v) || v < 0) setCreditReleaseMinutes(0);
                        else setCreditReleaseMinutes(Math.min(selectedCreditCustomer.credits, v));
                      }}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="0"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-8">
              <button
                onClick={closeCreditModal}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-bold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleStartWithCredits}
                disabled={
                  !selectedCreditCustomer ||
                  creditReleaseMinutes <= 0 ||
                  creditReleaseMinutes > selectedCreditCustomer.credits
                }
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 disabled:shadow-none"
              >
                Liberar Agora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
