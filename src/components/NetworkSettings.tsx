import { useState } from 'react';
import { useNetworkStore } from '../store/networkStore';
import { useStore } from '../store/useStore';

export function NetworkSettings() {
  const { 
    isServerRunning, 
    serverIp, 
    serverPort, 
    connectedClients,
    pendingClients,
    startServer, 
    stopServer,
    approveClient,
    rejectClient,
  } = useNetworkStore();
  
  const { devices } = useStore();
  const [showClientModal, setShowClientModal] = useState(false);

  const handleToggleServer = () => {
    if (isServerRunning) {
      stopServer();
    } else {
      startServer();
    }
  };

  const getAvailableDevices = () => {
    return devices.filter(d => d.type === 'pc');
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Configurações de Rede</h1>
        <p className="text-gray-600">Gerencie a conexão com os PCs clientes</p>
      </div>

      {/* Status do Servidor */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Servidor WebSocket</h2>
            <p className="text-gray-600">Servidor para comunicação com os PCs clientes</p>
          </div>
          <button
            onClick={handleToggleServer}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              isServerRunning 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isServerRunning ? 'Parar Servidor' : 'Iniciar Servidor'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">Status</div>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${isServerRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
              <span className="font-medium">{isServerRunning ? 'Online' : 'Offline'}</span>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">IP do Servidor</div>
            <div className="font-mono font-bold text-lg">{serverIp}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">Porta</div>
            <div className="font-mono font-bold text-lg">{serverPort}</div>
          </div>
        </div>
      </div>

      {/* Clientes Pendentes */}
      {pendingClients.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            🔔 Novos Dispositivos Detectados ({pendingClients.length})
          </h2>
          <div className="space-y-3">
            {pendingClients.map(client => (
              <div key={client.id} className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div>
                  <div className="font-medium">{client.ip}</div>
                  <div className="text-sm text-gray-500">
                    Conectado em {new Date(client.connectedAt).toLocaleTimeString('pt-BR')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select 
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                    onChange={(e) => {
                      if (e.target.value) {
                        approveClient(client.id, e.target.value);
                      }
                    }}
                    defaultValue=""
                  >
                    <option value="">Selecione o PC...</option>
                    {getAvailableDevices().map(device => (
                      <option key={device.id} value={device.id}>
                        {device.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => rejectClient(client.id)}
                    className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg"
                  >
                    Rejeitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clientes Conectados */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">
            PCs Conectados ({connectedClients.filter(c => c.status === 'connected').length})
          </h2>
          <button
            onClick={() => setShowClientModal(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
          >
            Ver Instruções do Cliente
          </button>
        </div>
        
        {connectedClients.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-4">📡</div>
            <p>Nenhum cliente conectado</p>
            <p className="text-sm">Instale o cliente nos PCs e configure o IP do servidor</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dispositivo</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sistema</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conectado em</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Última Atividade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {connectedClients.map(client => (
                  <tr key={client.id}>
                    <td className="px-4 py-3 font-medium">{client.deviceName || 'Não registrado'}</td>
                    <td className="px-4 py-3 font-mono text-gray-600">{client.ip}</td>
                    <td className="px-4 py-3 text-gray-600">{client.os || 'Windows'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        client.status === 'connected' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {client.status === 'connected' ? 'Conectado' : 'Desconectado'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(client.connectedAt).toLocaleTimeString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(client.lastSeen).toLocaleTimeString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Configuração de Rede */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Como Configurar os PCs Clientes</h2>
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-800 mb-2">Passo 1: Instalar o Cliente</h3>
            <p className="text-gray-600 text-sm">
              Baixe e instale o aplicativo GameZone Client em cada PC da LAN house.
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-800 mb-2">Passo 2: Configurar o IP do Servidor</h3>
            <p className="text-gray-600 text-sm">
              No primeiro acesso, informe o IP do servidor: <code className="bg-gray-200 px-2 py-1 rounded">{serverIp}</code>
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-800 mb-2">Passo 3: Aprovar o Dispositivo</h3>
            <p className="text-gray-600 text-sm">
              Quando o cliente conectar, ele aparecerá em "Novos Dispositivos Detectados". Selecione o PC correspondente e aprove.
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-800 mb-2">Passo 4: Controle Remoto</h3>
            <p className="text-gray-600 text-sm">
              Após a aprovação, você poderá controlar o PC remotamente: bloquear, desbloquear, desligar ou reiniciar.
            </p>
          </div>
        </div>
      </div>

      {/* Modal de Instruções do Cliente */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Instruções para o Cliente</h2>
              <button onClick={() => setShowClientModal(false)} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-gray-800 mb-2">1. Download do Cliente</h3>
                <p className="text-gray-600 mb-2">
                  O cliente é um pequeno aplicativo que deve ser instalado em cada PC da LAN house.
                </p>
                <div className="bg-gray-100 rounded-lg p-4 text-center">
                  <p className="text-gray-500">Em produção, aqui teria o link de download do instalador</p>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-gray-800 mb-2">2. Configuração Inicial</h3>
                <p className="text-gray-600 mb-2">
                  Na primeira execução, o cliente solicitará o IP do servidor. Informe:
                </p>
                <div className="bg-purple-100 rounded-lg p-4 text-center">
                  <div className="text-2xl font-mono font-bold text-purple-700">{serverIp}</div>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-gray-800 mb-2">3. Funcionalidades do Cliente</h3>
                <ul className="list-disc list-inside text-gray-600 space-y-1">
                  <li>Tela de bloqueio com tempo restante</li>
                  <li>Conexão automática com o servidor</li>
                  <li>Executa em segundo plano</li>
                  <li>Desabilita atalhos de sistema (Ctrl+Alt+Del, etc)</li>
                  <li>Recebe comandos do servidor (bloquear, desligar, etc)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-gray-800 mb-2">4. Modo de Emergência</h3>
                <p className="text-gray-600">
                  Para desbloquear manualmente (em caso de emergência), pressione{' '}
                  <code className="bg-gray-200 px-2 py-1 rounded">Ctrl + Shift + F12</code> e informe a senha de administrador.
                </p>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={() => setShowClientModal(false)}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
