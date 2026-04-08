import { useState, useEffect } from 'react';
import { useNetworkStore } from '../store/networkStore';
import { useStore } from '../store/useStore';
import { Timer, Aperture, X, Maximize, Minimize, MousePointer2, Zap } from 'lucide-react';
import RemoteDesktopViewer from './RemoteDesktopViewer';

export default function Network() {
  const { 
    clients, serverIP, serverPort, setServerConfig, toggleClient, 
    shutdownClient, restartClient, scanNetwork, isScanning, 
    detectedIp, detectIp, startServer, stopServer, isServerRunning, initializeIpc,
    removeClient
  } = useNetworkStore();
  
  const { 
    devices, sessions, addTimeToSession
  } = useStore();
  
  const [now, setNow] = useState(Date.now());
  const [editIP, setEditIP] = useState(serverIP);
  const [editPort, setEditPort] = useState(serverPort.toString());
  const [showAddTimeModal, setShowAddTimeModal] = useState<string | null>(null);
  const [customMinutes, setCustomMinutes] = useState('30');
  const [remoteSessionId, setRemoteSessionId] = useState<string | null>(null);

  // Efeito para atualizar o cronômetro visual a cada segundo
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  // Carregar IP e inicializar ao montar
  useEffect(() => {
    detectIp();
    initializeIpc();
  }, [detectIp, initializeIpc]);

  // Sincronizar campo com IP detectado se vazio
  useEffect(() => {
    if (detectedIp && !editIP) {
      setEditIP(detectedIp);
    }
  }, [detectedIp, editIP]);

  const handleSaveConfig = () => {
    setServerConfig(editIP, parseInt(editPort));
  };

  const connectedClients = clients.filter(c => c.connected);
  const disconnectedClients = clients.filter(c => !c.connected);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">🖥️ Gerenciamento de Rede</h1>
          <p className="text-gray-400 mt-1">Controle remoto dos PCs da LAN</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => isServerRunning ? stopServer() : startServer()}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              isServerRunning 
                ? 'bg-red-600/20 text-red-400 border border-red-900/50 hover:bg-red-600/30' 
                : 'bg-green-600 text-white hover:bg-green-700 shadow-lg'
            }`}
          >
            {isServerRunning ? '🛑 Parar Servidor' : '🚀 Iniciar Servidor'}
          </button>
          <button
            onClick={() => setShowInstallGuide(!showInstallGuide)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            📖 Guia
          </button>
        </div>
      </div>

      {/* Status de Conexão */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800/50 backdrop-blur rounded-xl p-4 border border-gray-700">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isServerRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-gray-400">Status WebSocket</span>
          </div>
          <p className="text-xl font-bold text-white mt-2">{isServerRunning ? '🟢 Online' : '🔴 Offline'}</p>
        </div>
        
        <div className="bg-gray-800/50 backdrop-blur rounded-xl p-4 border border-gray-700 relative overflow-hidden">
          <span className="text-gray-400 font-medium">Seu IP na Rede</span>
          <p className="text-xl font-bold text-white mt-2 font-mono">
            {detectedIp || 'Procurando...'}
          </p>
          <div className="absolute -right-4 -bottom-4 text-white/5 text-6xl rotate-12">IP</div>
        </div>
        
        <div className="bg-gray-800/50 backdrop-blur rounded-xl p-4 border border-gray-700">
          <span className="text-gray-400">PCs com o app na LAN</span>
          <p className="text-xl font-bold text-white mt-2">{clients.filter(c => c.connected).length}</p>
        </div>
      </div>

      {/* Guia de Instalação */}
      {showInstallGuide && (
        <div className="bg-blue-900/30 backdrop-blur rounded-xl p-6 border border-blue-700">
          <h3 className="text-lg font-semibold text-blue-400 mb-4">📋 Como Instalar nos PCs Clientes</h3>
          <ol className="text-gray-300 space-y-2 list-decimal list-inside">
            <li>Abra a pasta <code className="bg-gray-700 px-2 py-1 rounded">GameZoneClient</code> nos PCs da LAN</li>
            <li>Execute o arquivo <code className="bg-gray-700 px-2 py-1 rounded">GameZone-Client.exe</code></li>
            <li>Na primeira execução, insira o IP do servidor: <code className="bg-gray-700 px-2 py-1 rounded">{serverIP}</code></li>
            <li>O cliente irá conectar automaticamente e aparecerá aqui como "Novo dispositivo detectado"</li>
            <li>Nomeie o PC (ex: PC 01, PC 02) e clique em "Registrar"</li>
            <li>O PC ficará registrado permanentemente</li>
          </ol>
          <div className="mt-4 p-3 bg-yellow-900/30 rounded-lg border border-yellow-700">
            <p className="text-yellow-400 text-sm">
              💡 <strong>Dica:</strong> Para desligar automaticamente o PC no final do tempo, 
              certifique-se que o cliente está rodando como Administrador no Windows.
            </p>
          </div>
        </div>
      )}

      {/* Configurações do Servidor */}
      <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">⚙️ Configurações do Servidor</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">IP do Servidor</label>
            <input
              type="text"
              value={editIP}
              onChange={(e) => setEditIP(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Porta WebSocket</label>
            <input
              type="number"
              value={editPort}
              onChange={(e) => setEditPort(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
            />
          </div>
          <div className="flex items-end gap-3">
            <button
              onClick={handleSaveConfig}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
            >
              💾 Salvar IP
            </button>
            <button
              onClick={() => scanNetwork()}
              disabled={isScanning}
              className={`flex-1 px-4 py-2 border rounded-lg transition-all font-medium ${
                isScanning 
                  ? 'bg-purple-900/20 text-purple-400 border-purple-800 animate-pulse' 
                  : 'bg-purple-600/10 text-purple-400 border-purple-900/50 hover:bg-purple-600 hover:text-white'
              }`}
            >
              {isScanning ? '🔍 Buscando...' : '🔍 Varrer Rede'}
            </button>
          </div>
        </div>
      </div>

      {/* PCs Conectados */}
      <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">
          🟢 PCs Conectados ({connectedClients.length})
        </h2>
        {connectedClients.length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            Nenhum PC conectado. Instale o cliente nos PCs da LAN para começar.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {connectedClients.map((client) => (
              <div
                key={client.id}
                className="bg-gray-700/50 rounded-lg p-4 border border-gray-600 hover:border-purple-500 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-white font-medium">{client.name}</span>
                  </div>
                  <span className="text-xs text-gray-400">{client.ip}</span>
                </div>
                
                <div className="text-sm text-gray-400 mb-3 space-y-1">
                  <p className="flex items-center gap-2">
                    Status: <span className={client.locked ? 'text-red-400 font-medium' : 'text-green-400 font-medium'}>
                      {client.locked ? '🔒 Bloqueado' : '🔓 Liberado'}
                    </span>
                  </p>
                  
                  {(() => {
                    // @ts-ignore
                    const sources = async () => await window.lhgSystem?.getScreenSources();
                    const device = devices.find(d => d.id === client.id);
                    const session = sessions.find(s => s.id === device?.currentSession?.id);
                    if (session && !client.locked) {
                      // Calcular tempo restante: Duração total - Tempo decorrido
                      const durationMs = session.duration * 60000;
                      const elapsedMs = now - new Date(session.startTime).getTime() - (session.totalPausedTime || 0);
                      const remainingMs = Math.max(0, durationMs - elapsedMs);
                      
                      const mins = Math.floor(remainingMs / 60000);
                      const secs = Math.floor((remainingMs % 60000) / 1000);
                      
                      return (
                        <p className="flex items-center gap-2 bg-yellow-500/10 p-1.5 rounded border border-yellow-500/20">
                          <Timer size={14} className="text-yellow-500 animate-pulse" />
                          <span className="text-yellow-500 font-bold font-mono">
                            Restante: {mins}:{secs.toString().padStart(2, '0')}
                          </span>
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      // @ts-ignore
                      if (!window.lhgSystem?.sendRemoteInput) return;
                      if (!client.locked || confirm(`Tem certeza que deseja LIBERAR o acesso do PC "${client.name}"?`)) {
                        toggleClient(client.id);
                      }
                    }}
                    className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      client.locked
                        ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-900/20'
                        : 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20'
                    }`}
                  >
                    {client.locked ? '🔓 Liberar' : '🔒 Bloquear'}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Reiniciar o PC "${client.name}" agora?`)) {
                        restartClient(client.id);
                      }
                    }}
                    className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm transition-colors shadow-lg shadow-yellow-900/20"
                    title="Reiniciar PC"
                  >
                    🔄
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`DESLIGAR o PC "${client.name}" remotamente?`)) {
                        shutdownClient(client.id);
                      }
                    }}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors shadow-lg shadow-red-900/20"
                    title="Desligar PC"
                  >
                    ⏻
                  </button>
                  {sessions.some(s => {
                    const d = devices.find(dev => dev.id === client.id);
                    return s.id === d?.currentSession?.id;
                  }) && (
                    <button
                      onClick={() => setShowAddTimeModal(client.id)}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium transition-colors shadow-lg shadow-purple-900/20 flex items-center justify-center gap-1"
                      title="Adicionar Tempo"
                    >
                      <Timer size={14} />
                    </button>
                  )}
                  
                  <button
                    onClick={() => {
                      // @ts-ignore
                      if (window.lhgSystem?.executeRemoteInput) {
                        // @ts-ignore
                        window.lhgSystem.executeRemoteInput(client.id);
                      }
                      if (client.connected) {
                        setRemoteSessionId(client.id);
                      } else {
                        alert('PC Offline. Não é possível iniciar acesso remoto.');
                      }
                    }}
                    className={`flex-1 px-3 py-1.5 rounded text-sm font-medium transition-all flex items-center justify-center gap-1 ${
                      client.connected 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/20' 
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <Aperture size={14} /> Acesso
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* PCs Desconectados */}
      {disconnectedClients.length > 0 && (
        <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-white mb-4">
            🔴 PCs Desconectados ({disconnectedClients.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {disconnectedClients.map((client) => (
              <div
                key={client.id}
                className="bg-gray-700/30 rounded-lg p-4 border border-gray-600 opacity-60 group relative flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <span className="text-gray-300 font-medium">{client.name}</span>
                    </div>
                    <span className="text-xs text-gray-500">{client.ip}</span>
                  </div>
                  <p className="text-sm text-gray-500">
                    Última conexão: {client.lastSeen ? new Date(client.lastSeen).toLocaleString() : 'Nunca'}
                  </p>
                </div>
                
                <button
                  onClick={() => {
                    if (confirm(`Remover permanentemente o PC "${client.name}" da lista?`)) {
                      removeClient(client.id);
                    }
                  }}
                  className="mt-3 text-xs text-red-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-300 flex items-center gap-1"
                >
                  🗑️ Remover da Rede
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visualizador de Acesso Remoto */}
      {remoteSessionId && (
        <RemoteDesktopViewer 
          deviceId={remoteSessionId} 
          onClose={() => setRemoteSessionId(null)} 
        />
      )}

      {/* Modal Adicionar Tempo */}
      {showAddTimeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Timer className="text-purple-400" />
              Adicionar Tempo
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              Quanto tempo deseja adicionar para <strong>{clients.find(c => c.id === showAddTimeModal)?.name}</strong>?
            </p>
            
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[15, 30, 60, 120].map(mins => (
                <button
                  key={mins}
                  onClick={() => {
                    addTimeToSession(showAddTimeModal, mins);
                    setShowAddTimeModal(null);
                  }}
                  className="py-3 bg-gray-700 hover:bg-purple-600 text-white rounded-xl transition-all font-medium border border-gray-600"
                >
                  +{mins < 60 ? `${mins}min` : `${mins/60}h`}
                </button>
              ))}
            </div>
            
            <div className="relative mb-6">
              <input
                type="number"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500"
                placeholder="Valor customizado (min)"
              />
              <button
                onClick={() => {
                  addTimeToSession(showAddTimeModal, parseInt(customMinutes));
                  setShowAddTimeModal(null);
                }}
                className="absolute right-2 top-1.5 px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Add
              </button>
            </div>
            
            <button
              onClick={() => setShowAddTimeModal(null)}
              className="w-full py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Instruções */}
      <div className="bg-gray-800/50 backdrop-blur rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-semibold text-white mb-4">📝 Resumo das Funcionalidades</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
          <div>
            <h3 className="text-purple-400 font-medium mb-2">🎮 Controle Remoto</h3>
            <ul className="space-y-1 list-disc list-inside">
              <li>Liberar/Bloquear PC</li>
              <li>Desligar PC remotamente</li>
              <li>Reiniciar PC remotamente</li>
              <li>Acesso remoto via LAN</li>
            </ul>
          </div>
          <div>
            <h3 className="text-purple-400 font-medium mb-2">⏱️ Controle de Tempo</h3>
            <ul className="space-y-1 list-disc list-inside">
              <li>Tempo conta automaticamente</li>
              <li>Alerta antes do fim do tempo</li>
              <li>Bloqueio automático no fim</li>
              <li>Renovação pelo caixa</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
