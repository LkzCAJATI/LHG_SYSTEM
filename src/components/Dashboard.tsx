import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useNetworkStore } from '../store/networkStore';
import { Device } from '../types';
import {
  Monitor, Gamepad2, Plus, Square,
  X, Check, Power, RotateCw, Lock, Unlock, Wifi, WifiOff
} from 'lucide-react';

export function Dashboard() {
  const { devices, updateDevice, addDevice, endSession } = useStore();
  const { 
    isServerRunning, 
    connectedClients,
    lockDevice,
    unlockDevice,
    shutdownDevice,
    restartDevice,
    isDeviceConnected,
  } = useNetworkStore();
  
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'pc' | 'console' | 'arcade'>('all');
  const [newDevice, setNewDevice] = useState({
    name: '',
    type: 'pc' as 'pc' | 'console' | 'arcade',
    pricePerHour: 5,
  });

  // Estado do tempo em sessão
  const [sessionTimes, setSessionTimes] = useState<Record<string, string>>({});

  // Atualizar tempos das sessões a cada segundo
  useEffect(() => {
    const interval = setInterval(() => {
      const times: Record<string, string> = {};
      devices.forEach(device => {
        if (device.status === 'in_use' && device.currentSession?.startTime) {
          const diff = Date.now() - new Date(device.currentSession.startTime).getTime();
          const hours = Math.floor(diff / 3600000);
          const minutes = Math.floor((diff % 3600000) / 60000);
          const seconds = Math.floor((diff % 60000) / 1000);
          times[device.id] = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
      });
      setSessionTimes(times);
    }, 1000);
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
      case 'maintenance': return 'Manutenção';
      default: return status;
    }
  };

  const handleAddDevice = () => {
    if (!newDevice.name) return;
    
    addDevice({
      name: newDevice.name,
      type: newDevice.type,
      status: 'available',
      pricePerHour: newDevice.pricePerHour,
    });
    
    setNewDevice({ name: '', type: 'pc', pricePerHour: 5 });
    setShowAddDevice(false);
  };

  const handleEndSession = (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    if (device?.currentSession) {
      endSession(device.currentSession.id);
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
            <span className="text-sm text-gray-600">
              Servidor: {isServerRunning ? 'Online' : 'Offline'}
            </span>
          </div>
          <button
            onClick={() => setShowAddDevice(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Adicionar Dispositivo
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
                device.status === 'available' ? 'border-green-400' : 'border-yellow-400'
              }`}
              onClick={() => setSelectedDevice(device)}
            >
              {/* Header do Card */}
              <div className={`p-4 ${
                device.status === 'in_use' ? 'bg-purple-50' : 
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
                {device.status === 'in_use' && device.currentSession && (
                  <div className="mb-3">
                    <div className="text-xs text-gray-500 mb-1">Tempo de Uso</div>
                    <div className="text-xl font-mono font-bold text-gray-800">
                      {sessionTimes[device.id] || '00:00:00'}
                    </div>
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
                  {device.status === 'in_use' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEndSession(device.id);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                    >
                      <Square className="w-4 h-4" />
                      Finalizar
                    </button>
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
                      {new Date(selectedDevice.currentSession.startTime).toLocaleTimeString('pt-BR')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b">
                    <span className="text-gray-600">Tempo</span>
                    <span className="font-mono font-bold text-lg">
                      {sessionTimes[selectedDevice.id] || '00:00:00'}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Ações */}
            <div className="mt-6 space-y-2">
              {selectedDevice.status === 'in_use' && (
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
            Clientes na Rede ({connectedClients.filter(c => c.status === 'connected').length})
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
                        client.status === 'connected' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {client.status === 'connected' ? 'Conectado' : 'Desconectado'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(client.lastSeen).toLocaleTimeString('pt-BR')}
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
}
