import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { useNetworkStore } from '../store/networkStore';
import { Device, Customer } from '../types';

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
  const { devices, customers, startSession, endSession } = useStore();
  const { 
    isServerRunning, 
    connectedClients, 
    lockDevice, 
    unlockDevice, 
    shutdownDevice, 
    restartDevice,
    isDeviceConnected,
    startRemoteDesktop,
    remoteDesktopSession,
    stopRemoteDesktop,
  } = useNetworkStore();
  
  const [activeFilter, setActiveFilter] = useState<'all' | 'pc' | 'console' | 'arcade'>('all');
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [duration, setDuration] = useState(60); // minutos
  const [extraControllers, setExtraControllers] = useState(0);
  const [showRemoteModal, setShowRemoteModal] = useState(false);
  const [remoteMessage, setRemoteMessage] = useState('');

  // Estado para busca de cliente cadastrado
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [useRegisteredCustomer, setUseRegisteredCustomer] = useState(false);

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
      case 'arcade': return <JoystickIcon />;
    }
  };

  const getStatusColor = (status: Device['status']) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'in_use': return 'bg-yellow-500';
      case 'maintenance': return 'bg-red-500';
    }
  };

  const getStatusText = (status: Device['status']) => {
    switch (status) {
      case 'available': return 'Disponível';
      case 'in_use': return 'Em Uso';
      case 'maintenance': return 'Manutenção';
    }
  };

  const filteredDevices = devices.filter(d => {
    if (activeFilter === 'all') return true;
    return d.type === activeFilter;
  });

  const handleStartSession = (device: Device) => {
    if (device.type === 'pc') {
      if (!isDeviceConnected(device.id)) {
        alert('Este PC não está conectado ao servidor! Verifique se o cliente está rodando.');
        return;
      }
    }
    setSelectedDevice(device);
    setShowStartModal(true);
  };

  const handleConfirmStart = () => {
    if (!selectedDevice) return;
    const name = selectedCustomer ? selectedCustomer.name : (customerName || 'Cliente');
    const custId = selectedCustomer ? selectedCustomer.id : undefined;
    startSession(selectedDevice.id, name, duration, extraControllers, custId);
    setShowStartModal(false);
    setSelectedDevice(null);
    setCustomerName('');
    setDuration(60);
    setExtraControllers(0);
    setCustomerSearch('');
    setSelectedCustomer(null);
    setUseRegisteredCustomer(false);
  };

  const handleEndSession = (device: Device) => {
    if (device.currentSession) {
      endSession(device.currentSession.id);
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
    startRemoteDesktop(device.id);
    setShowRemoteModal(true);
  };

  const handleCloseRemote = () => {
    stopRemoteDesktop();
    setShowRemoteModal(false);
  };

  const formatDuration = (startTime?: Date) => {
    if (!startTime) return '00:00:00';
    const diff = Date.now() - new Date(startTime).getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const calculatePrice = () => {
    if (!selectedDevice) return 0;
    const hours = duration / 60;
    let price = selectedDevice.pricePerHour * hours;
    if (selectedDevice.type === 'console' && extraControllers > 0) {
      price += extraControllers * 3; // R$ 3 por controle extra
    }
    return price;
  };

  const pcCount = devices.filter(d => d.type === 'pc').length;
  const consoleCount = devices.filter(d => d.type === 'console').length;
  const arcadeCount = devices.filter(d => d.type === 'arcade').length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dispositivos</h1>
          <p className="text-gray-600">Gerencie todos os dispositivos da sua LAN House</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${isServerRunning ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span className="text-sm text-gray-600">
            Servidor: {isServerRunning ? 'Online' : 'Offline'}
          </span>
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
          onClick={() => setActiveFilter('console')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeFilter === 'console' 
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
                device.status === 'available' ? 'border-green-400' : 'border-red-400'
              }`}
            >
              {/* Header do Card */}
              <div className={`p-4 ${
                device.status === 'in_use' ? 'bg-yellow-50' : 
                device.status === 'available' ? 'bg-green-50' : 'bg-red-50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className={`p-2 rounded-lg ${
                    device.type === 'pc' ? 'bg-purple-100 text-purple-600' :
                    device.type === 'console' ? 'bg-blue-100 text-blue-600' :
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
                {device.status === 'in_use' && device.currentSession && (
                  <div className="mb-3">
                    <div className="text-xs text-gray-500 mb-1">Tempo de Uso</div>
                    <div className="text-xl font-mono font-bold text-gray-800">
                      {formatDuration(device.currentSession.startTime)}
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
                  {device.type === 'console' && <span className="text-xs ml-1">(+R$ 3/controle)</span>}
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
                  
                  {device.status === 'in_use' && (
                    <button
                      onClick={() => handleEndSession(device)}
                      className="w-full py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                    >
                      ⏹ Finalizar
                    </button>
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
                  onClick={() => { setUseRegisteredCustomer(false); setSelectedCustomer(null); setCustomerSearch(''); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    !useRegisteredCustomer ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Sem cadastro
                </button>
                <button
                  onClick={() => { setUseRegisteredCustomer(true); setCustomerName(''); }}
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
                              <span className="text-purple-500 text-xs ml-2">{c.credits} min</span>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duração (minutos)</label>
                <div className="flex gap-2">
                  {[30, 60, 120, 180].map(d => (
                    <button
                      key={d}
                      onClick={() => setDuration(d)}
                      className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                        duration === d 
                          ? 'bg-purple-600 text-white' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {d < 60 ? `${d}min` : `${d/60}h`}
                    </button>
                  ))}
                </div>
              </div>

              {selectedDevice.type === 'console' && (
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
                  {duration} minutos × R$ {selectedDevice.pricePerHour.toFixed(2)}/hora
                  {extraControllers > 0 && ` + ${extraControllers} × R$ 3,00`}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowStartModal(false);
                  setSelectedDevice(null);
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
