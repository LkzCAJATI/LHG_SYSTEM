import React, { useEffect, useRef, useState } from 'react';
import { useNetworkStore } from '../store/networkStore';
import { Timer, Aperture, X, Maximize, Minimize, MousePointer2, Zap } from 'lucide-react';

interface RemoteDesktopViewerProps {
  deviceId: string;
  onClose: () => void;
}

export default function RemoteDesktopViewer({ deviceId, onClose }: RemoteDesktopViewerProps) {
  const { clients } = useNetworkStore();
  const client = clients.find(c => c.id === deviceId);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lastFrame, setLastFrame] = useState<string | null>(null);

  useEffect(() => {
    // Iniciar acesso remoto no servidor (enviar comando via WS)
    if (window.lhgSystem?.sendNetworkCommand) {
      window.lhgSystem.sendNetworkCommand({
        deviceId,
        command: { type: 'start_remote' }
      });
    }

    // Ouvir frames do cliente
    const cleanup = window.lhgSystem?.onNetworkEvent((event: any) => {
      if (event.type === 'remote_frame' && event.deviceId === deviceId) {
        setLastFrame(event.frame);
      }
    });

    return () => {
      if (window.lhgSystem?.sendNetworkCommand) {
        window.lhgSystem.sendNetworkCommand({
          deviceId,
          command: { type: 'stop_remote' }
        });
      }
      if (cleanup && typeof cleanup === 'function') cleanup();
    };
  }, [deviceId]);

  // Renderizar frame no canvas
  useEffect(() => {
    if (!lastFrame || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
    };
    img.src = lastFrame;
  }, [lastFrame]);

  const handleInput = (type: string, e: React.MouseEvent | React.KeyboardEvent) => {
    // @ts-ignore
    if (!canvasRef.current || !window.lhgSystem?.sendRemoteInput) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    let input: any = { type };

    if ('clientX' in e) {
      input.x = (e.clientX - rect.left) * scaleX;
      input.y = (e.clientY - rect.top) * scaleY;
    }

    if ('key' in e) {
      input.key = (e as React.KeyboardEvent).key;
    }

    // @ts-ignore
    window.lhgSystem.sendRemoteInput({ deviceId, input });
  };

  return (
    <div className={`fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-xl transition-all ${isFullscreen ? '' : 'p-4 md:p-8'}`}>
      {/* Barra de Ferramentas */}
      <div className="flex items-center justify-between bg-gray-900/80 border border-gray-700/50 p-3 rounded-t-xl mb-px">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${client?.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          <span className="text-white font-medium">Controle Remoto: {client?.name || deviceId}</span>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">{client?.ip}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 transition-colors"
            title={isFullscreen ? "Sair Tela Cheia" : "Tela Cheia"}
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-red-600 rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Área de Visualização */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto bg-gray-950 flex items-center justify-center relative cursor-none group"
        onMouseMove={(e) => handleInput('mousemove', e)}
        onMouseDown={(e) => handleInput('mousedown', e)}
        onMouseUp={(e) => handleInput('mouseup', e)}
      >
        <canvas 
          ref={canvasRef}
          className="max-w-full max-h-full shadow-2xl bg-black"
        />

        {/* Cursor Virtual */}
        <div className="absolute pointer-events-none text-purple-400 group-hover:block transition-opacity duration-100 mix-blend-difference">
          <MousePointer2 size={24} className="fill-current" />
        </div>

        {!lastFrame && (
          <div className="flex flex-col items-center gap-4 text-gray-500">
            <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
            <p className="animate-pulse">Aguardando imagem do cliente...</p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="bg-gray-900/80 border-t border-gray-700/50 p-2 rounded-b-xl flex justify-between items-center text-[10px] text-gray-500 uppercase tracking-widest">
        <div className="flex gap-4">
          <span>Qualidade: 50% JPEG</span>
          <span>Latência: ~150ms</span>
          <span>PowerShell Bridge: Ativo</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap size={10} className="text-yellow-500" />
          <span>LHG Remote Engine v1.0</span>
        </div>
      </div>
    </div>
  );
}
