import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, RefreshCw, AlertCircle, CheckCircle2, Zap } from 'lucide-react';

interface CameraBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (sku: string) => void;
}

export const CameraBarcodeScannerModal: React.FC<CameraBarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [manualCode, setManualCode] = useState<string>('');
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setLastScanned(null);
      setErrorMessage(null);
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    setErrorMessage(null);
    setHasPermission(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Acesso à câmera não é suportado pelo seu navegador neste ambiente.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setHasPermission(true);
        setIsScanning(true);
        detectBarcodes();
      }
    } catch (err: unknown) {
      console.warn('Erro ao acessar câmera:', err);
      setHasPermission(false);
      setErrorMessage(
        err instanceof Error ? err.message : 'Não foi possível acessar a câmera do dispositivo. Verifique as permissões do navegador.'
      );
    }
  };

  const stopCamera = () => {
    setIsScanning(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const detectBarcodes = async () => {
    // Verifica suporte ao BarcodeDetector nativo (Chrome / Edge / Android)
    const hasBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;

    if (!hasBarcodeDetector) {
      return;
    }

    try {
      // @ts-expect-error Window BarcodeDetector might be experimental
      const barcodeDetector = new window.BarcodeDetector({
        formats: ['code_128', 'ean_13', 'ean_8', 'qr_code', 'code_39', 'upc_a']
      });

      const scanLoop = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          animationFrameRef.current = requestAnimationFrame(scanLoop);
          return;
        }

        try {
          const barcodes = await barcodeDetector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const code = barcodes[0].rawValue?.trim();
            if (code && code !== lastScanned) {
              setLastScanned(code);
              onScan(code);
              // Vibração tátil se disponível
              if (navigator.vibrate) {
                navigator.vibrate([100]);
              }
              setTimeout(() => {
                setLastScanned(null);
              }, 1500);
            }
          }
        } catch {
          // Ignora falhas pontuais de frame
        }

        animationFrameRef.current = requestAnimationFrame(scanLoop);
      };

      animationFrameRef.current = requestAnimationFrame(scanLoop);
    } catch (err) {
      console.warn('Falha ao inicializar BarcodeDetector:', err);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      setLastScanned(manualCode.trim());
      setManualCode('');
      setTimeout(() => setLastScanned(null), 1500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Leitor por Câmera (Mobile / Tablet)
              </h2>
              <p className="text-xs text-slate-400">
                Aponte para o código de barras ou QR Code do produto
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Viewport */}
        <div className="relative flex-1 bg-black min-h-[320px] max-h-[420px] flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* Mira / Overlay de Leitura */}
          {hasPermission && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative w-3/4 max-w-xs h-40 border-2 border-cyan-400/80 rounded-2xl shadow-[0_0_20px_rgba(34,211,238,0.25)] flex items-center justify-center">
                {/* Linha Laser Animada */}
                <div className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_8px_#ef4444] animate-pulse" />
                <div className="absolute top-2 left-2 text-[10px] font-mono text-cyan-400/80 bg-slate-950/70 px-1.5 py-0.5 rounded">
                  ALINHE O CÓDIGO AQUI
                </div>
              </div>
            </div>
          )}

          {/* Feedback de sucesso imediato */}
          {lastScanned && (
            <div className="absolute inset-x-4 top-4 z-20 flex items-center gap-2 bg-emerald-500/90 text-white font-mono text-xs px-3 py-2 rounded-xl shadow-lg border border-emerald-400/50 backdrop-blur animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Código Capturado: <strong>{lastScanned}</strong></span>
            </div>
          )}

          {/* Mensagem de Erro / Sem Permissão */}
          {hasPermission === false && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-slate-900/95">
              <AlertCircle className="w-12 h-12 text-amber-400 mb-3" />
              <h3 className="text-sm font-bold text-white mb-1">Câmera Não Acessível</h3>
              <p className="text-xs text-slate-400 max-w-sm mb-4 leading-relaxed">
                {errorMessage || 'Permissão de vídeo negada ou nenhuma câmera detectada.'}
              </p>
              <button
                onClick={startCamera}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-xl text-xs font-semibold border border-slate-700 transition"
              >
                <RefreshCw className="w-4 h-4" /> Tentar Novamente
              </button>
            </div>
          )}
        </div>

        {/* Footer com Entrada Manual & Status */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex flex-col gap-3">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Ou digite o SKU manualmente..."
              className="flex-1 bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 outline-none transition"
            />
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shrink-0"
            >
              <Zap className="w-3.5 h-3.5" /> Enviar
            </button>
          </form>

          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Status: {isScanning ? 'Scanner Ativo' : 'Parado'}</span>
            <span className="text-slate-400">Pressione ESC para fechar</span>
          </div>
        </div>
      </div>
    </div>
  );
};
