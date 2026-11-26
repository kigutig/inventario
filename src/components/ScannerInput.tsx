import React, { useEffect, useRef, useState } from 'react';
import {
  Barcode,
  AlertTriangle,
  CheckCircle,
  PlusCircle,
  Clock,
  Zap,
  Camera,
  RotateCcw,
  Sliders,
  History
} from 'lucide-react';
import { soundManager } from '../lib/sound';
import type { ItemInventariado } from '../types/inventory';

interface ScannedHistoryItem {
  id: string;
  sku: string;
  descricao: string;
  cadastrado: boolean;
  timestamp: Date;
  qtdDelta: number;
  totalQtd: number;
}

interface ScannerInputProps {
  onScan: (sku: string, multiplier?: number) => Promise<{ cadastrado: boolean; item?: ItemInventariado; mensagem?: string }>;
  disabled?: boolean;
  onQuickRegisterSku?: (sku: string) => void;
  onOpenMobileCamera?: () => void;
  onUndoLastScan?: (sku: string) => void;
}

export const ScannerInput: React.FC<ScannerInputProps> = ({
  onScan,
  disabled = false,
  onQuickRegisterSku,
  onOpenMobileCamera,
  onUndoLastScan,
}) => {
  const [sku, setSku] = useState('');
  const [multiplier, setMultiplier] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [flashType, setFlashType] = useState<'success' | 'warning' | 'error' | null>(null);
  const [history, setHistory] = useState<ScannedHistoryItem[]>([]);
  const [lastScanned, setLastScanned] = useState<{
    sku: string;
    descricao: string;
    cadastrado: boolean;
    timestamp: Date;
    qtd: number;
    divergencia: number;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // RE-FOCO PERSISTENTE (CRÍTICO PARA LEITOR HID NONUS LW200)
  useEffect(() => {
    const focusInput = () => {
      if (disabled) return;
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.getAttribute('role') === 'dialog') &&
        activeEl !== inputRef.current
      ) {
        return;
      }
      inputRef.current?.focus();
    };

    focusInput();

    const handleWindowClick = () => {
      setTimeout(focusInput, 50);
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInputFocused =
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

      if (!isInputFocused && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        inputRef.current?.focus();
      }
    };

    window.addEventListener('click', handleWindowClick);
    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      window.removeEventListener('click', handleWindowClick);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [disabled]);

  const triggerFlash = (type: 'success' | 'warning' | 'error') => {
    setFlashType(type);
    setTimeout(() => setFlashType(null), 400);
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const rawSku = sku.trim().toUpperCase();
      if (!rawSku || isProcessing || disabled) return;

      const currentMultiplier = Math.max(1, Math.floor(multiplier) || 1);

      setSku('');
      setIsProcessing(true);

      try {
        const result = currentMultiplier > 1 ? await onScan(rawSku, currentMultiplier) : await onScan(rawSku);

        if (result.cadastrado) {
          soundManager.playSuccess();
          triggerFlash('success');
        } else {
          soundManager.playWarning();
          triggerFlash('warning');
        }

        const totalQtd = result.item?.quantidade_contada || currentMultiplier;
        const estoque = result.item?.estoque_sistema_snapshot || 0;
        const descricao = result.item?.descricao_snapshot || (result.cadastrado ? 'Item Cadastrado' : 'Item NÃO Cadastrado');

        setLastScanned({
          sku: rawSku,
          descricao,
          cadastrado: result.cadastrado,
          timestamp: new Date(),
          qtd: totalQtd,
          divergencia: totalQtd - estoque,
        });

        setHistory((prev) => [
          {
            id: `scan_${Date.now()}_${Math.random()}`,
            sku: rawSku,
            descricao,
            cadastrado: result.cadastrado,
            timestamp: new Date(),
            qtdDelta: currentMultiplier,
            totalQtd,
          },
          ...prev.slice(0, 4),
        ]);
      } catch (err) {
        soundManager.playError();
        triggerFlash('error');
        console.error('Erro ao processar leitura:', err);
      } finally {
        setIsProcessing(false);
        inputRef.current?.focus();
      }
    }
  };

  const handleUndo = (itemSku: string) => {
    if (onUndoLastScan) {
      onUndoLastScan(itemSku);
      setHistory((prev) => prev.filter((h) => h.sku !== itemSku));
      if (lastScanned?.sku === itemSku) {
        setLastScanned(null);
      }
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Multiplicador */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 bg-gray-800/60 p-1 rounded-lg border border-gray-700/50 text-xs">
          <span className="text-gray-400 font-medium px-2 flex items-center gap-1">
            <Sliders className="w-3.5 h-3.5" />
            Lote:
          </span>
          {[1, 5, 10, 25, 50].map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => {
                setMultiplier(val);
                inputRef.current?.focus();
              }}
              className={`px-2.5 py-1 rounded-md font-mono font-semibold transition ${multiplier === val
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700/50 text-gray-300 hover:text-white hover:bg-gray-700'
                }`}
            >
              x{val}
            </button>
          ))}
          <div className="flex items-center gap-1 pl-1 border-l border-gray-700/50">
            <input
              type="number"
              min={1}
              max={9999}
              value={multiplier}
              onChange={(e) => setMultiplier(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-14 bg-gray-900 border border-gray-700 rounded-md px-2 py-0.5 text-center font-mono text-xs text-white focus:outline-none focus:border-blue-500"
              title="Quantidade personalizada"
            />
          </div>
        </div>

        {onOpenMobileCamera && (
          <button
            type="button"
            onClick={onOpenMobileCamera}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700/50 text-gray-300 text-xs font-medium transition"
            title="Leitor por câmera"
          >
            <Camera className="w-4 h-4" />
            <span>Câmera</span>
          </button>
        )}
      </div>

      {/* Input Principal */}
      <div
        className={`rounded-xl p-1 transition-all border-2 ${flashType === 'success'
          ? 'flash-success bg-blue-950/20 border-blue-500'
          : flashType === 'warning'
            ? 'flash-warning bg-yellow-950/20 border-yellow-500'
            : flashType === 'error'
              ? 'flash-error bg-red-950/20 border-red-500'
              : 'bg-gray-800/40 border-gray-700/60 hover:border-gray-600 focus-within:border-blue-500'
          }`}
      >
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-900 text-blue-400 shrink-0">
            <Barcode className="w-6 h-6" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-gray-400 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <span className="text-gray-300 font-medium">Leitor Nonus LW200</span>
                {multiplier > 1 && (
                  <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300 text-[10px] font-semibold">
                    x{multiplier}
                  </span>
                )}
              </span>
              <span className="text-gray-500 text-[11px] hidden sm:inline">
                SKU + Enter
              </span>
            </div>

            <input
              ref={inputRef}
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder={disabled ? 'Sessão finalizada' : 'Aguardando bipe do leitor...'}
              autoComplete="off"
              autoFocus
              className="w-full bg-transparent text-lg sm:text-xl font-mono font-bold text-white placeholder-gray-500 focus:outline-none tracking-wider disabled:opacity-50"
            />
          </div>

          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <span className="px-2 py-1 rounded-md bg-gray-900 border border-gray-700 text-gray-400 font-mono text-xs">
              ENTER ↵
            </span>
            <div className="flex items-center gap-1 text-green-400 text-xs font-medium">
              <Zap className="w-3.5 h-3.5" />
              <span>ON</span>
            </div>
          </div>
        </div>
      </div>

      {/* Última Leitura */}
      {lastScanned && (
        <div
          className={`rounded-lg p-3.5 border transition ${lastScanned.cadastrado
            ? 'bg-gray-800/40 border-gray-700/50'
            : 'bg-yellow-950/20 border-yellow-700/40'
            }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-lg shrink-0 ${lastScanned.cadastrado
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-yellow-500/10 text-yellow-400'
                  }`}
              >
                {lastScanned.cadastrado ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">
                    ÚLTIMO BIPE
                  </span>
                  <span className="font-mono text-base font-bold text-white">
                    {lastScanned.sku}
                  </span>

                  {lastScanned.cadastrado ? (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">
                      Cadastrado Oficial
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-yellow-500 text-gray-900">
                      NÃO CADASTRADO NO ERP
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-300 mt-1 line-clamp-1">
                  {lastScanned.descricao}
                </p>

                <div className="flex items-center gap-4 text-xs text-gray-500 mt-1.5">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {lastScanned.timestamp.toLocaleTimeString('pt-BR')}
                  </span>
                  <span>
                    Contado: <strong className="text-white">{lastScanned.qtd}</strong>
                  </span>
                  <span>
                    Div:{' '}
                    <strong
                      className={`${lastScanned.divergencia === 0
                        ? 'text-green-400'
                        : lastScanned.divergencia > 0
                          ? 'text-blue-400'
                          : 'text-red-400'
                        }`}
                    >
                      {lastScanned.divergencia > 0 ? `+${lastScanned.divergencia}` : lastScanned.divergencia}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              {onUndoLastScan && (
                <button
                  type="button"
                  onClick={() => handleUndo(lastScanned.sku)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white text-xs font-medium transition"
                  title="Desfazer (-1)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Desfazer
                </button>
              )}

              {!lastScanned.cadastrado && onQuickRegisterSku && (
                <button
                  type="button"
                  onClick={() => onQuickRegisterSku(lastScanned.sku)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-gray-900 font-semibold text-xs transition"
                >
                  <PlusCircle className="w-4 h-4" />
                  Cadastrar Este SKU Agora
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fita de bipes */}
      {history.length > 0 && (
        <div className="bg-gray-800/30 border border-gray-700/40 rounded-lg p-2 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium shrink-0 pl-1">
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Recentes:</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
            {history.map((h) => (
              <div
                key={h.id}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-mono border shrink-0 ${h.cadastrado
                  ? 'bg-gray-800/50 border-gray-700/50 text-gray-300'
                  : 'bg-yellow-950/20 border-yellow-700/40 text-yellow-300'
                  }`}
              >
                <span className="font-semibold">{h.sku}</span>
                <span className="text-[10px] px-1 rounded bg-gray-700 text-blue-400 font-semibold">
                  +{h.qtdDelta}
                </span>
                <span className="text-[10px] text-gray-500">
                  ({h.totalQtd})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
