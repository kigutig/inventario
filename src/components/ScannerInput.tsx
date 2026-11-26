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

  // --------------------------------------------------------------------------
  // RE-FOCO INTELIGENTE E PERSISTENTE (CRÍTICO PARA LEITOR HID NONUS LW200)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const focusInput = () => {
      if (disabled) return;
      // Não roubar o foco se o usuário estiver intencionalmente digitando em outro input/modal/textarea
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

    // Foco inicial
    focusInput();

    // Re-foco ao clicar na tela
    const handleWindowClick = () => {
      setTimeout(focusInput, 50);
    };

    // Buffer rápido do leitor Nonus LW200 caso clique fora
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

  // --------------------------------------------------------------------------
  // PROCESSAMENTO DO BIPE (ENTER AUTOMÁTICO DO NONUS LW200)
  // --------------------------------------------------------------------------
  const triggerFlash = (type: 'success' | 'warning' | 'error') => {
    setFlashType(type);
    setTimeout(() => setFlashType(null), 500);
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const rawSku = sku.trim().toUpperCase();
      if (!rawSku || isProcessing || disabled) return;

      const currentMultiplier = Math.max(1, Math.floor(multiplier) || 1);

      // Limpa imediatamente o input para a próxima leitura imediata (Zero Latency UX)
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

        // Adiciona à fita de auditoria dos últimos bipes
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
      {/* Controles de Lote / Multiplicador e Ações Rápidas */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        {/* Multiplicadores de Quantidade */}
        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
          <span className="text-slate-400 font-medium px-2 flex items-center gap-1">
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
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
              className={`px-2.5 py-1 rounded-lg font-mono font-bold transition-all ${multiplier === val
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
            >
              x{val}
            </button>
          ))}
          <div className="flex items-center gap-1 pl-1 border-l border-slate-800">
            <input
              type="number"
              min={1}
              max={9999}
              value={multiplier}
              onChange={(e) => setMultiplier(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-14 bg-slate-950 border border-slate-700 rounded-lg px-2 py-0.5 text-center font-mono text-xs text-white focus:outline-none focus:border-cyan-400"
              title="Quantidade personalizada por bipe"
            />
          </div>
        </div>

        {/* Botão de Câmera Mobile / Tablet */}
        {onOpenMobileCamera && (
          <button
            type="button"
            onClick={onOpenMobileCamera}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 text-xs font-semibold shadow-sm transition"
            title="Abrir leitor de código de barras pela câmera"
          >
            <Camera className="w-4 h-4" />
            <span>Leitor por Câmera</span>
          </button>
        )}
      </div>

      {/* Container Principal do Input do Leitor */}
      <div
        className={`relative overflow-hidden rounded-2xl p-1.5 transition-all duration-300 border-2 ${
          flashType === 'success'
            ? 'flash-success bg-emerald-950/40 border-emerald-400 shadow-2xl shadow-emerald-500/25'
            : flashType === 'warning'
            ? 'flash-warning bg-amber-950/40 border-amber-400 shadow-2xl shadow-amber-500/25'
            : flashType === 'error'
            ? 'flash-error bg-red-950/40 border-red-500 shadow-2xl shadow-red-500/25'
            : 'enterprise-card border-slate-700/80 hover:border-slate-600 focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10'
        }`}
      >
        {/* Laser animado sutil de prontidão */}
        {!disabled && <div className="laser-beam opacity-30" />}

        <div className="flex items-center gap-3 px-4 py-2 relative z-10">
          {/* Ícone Indicador de Scanner */}
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-950 text-emerald-400 border border-slate-800 shadow-inner shrink-0">
            <Barcode className="w-7 h-7" />
          </div>

          {/* Campo de Entrada com Autofocus */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-xs font-semibold mb-1">
              <span className="text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-slate-300 font-bold">Leitor Nonus LW200</span>
                {multiplier > 1 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[10px] font-bold">
                    Multiplicador x{multiplier}
                  </span>
                )}
              </span>
              <span className="text-slate-400 font-mono text-[11px] hidden sm:inline">
                Aguardando leitura de código de barras ou SKU + Enter
              </span>
            </div>

            <input
              ref={inputRef}
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder={disabled ? 'Sessão finalizada (Leitura bloqueada)' : 'Aguardando bipe do leitor... Ex: 205N51, 002NA01AC'}
              autoComplete="off"
              autoFocus
              className="w-full bg-transparent text-xl sm:text-2xl font-mono font-bold text-white placeholder-slate-400 focus:outline-none tracking-wider disabled:opacity-50"
            />
          </div>

          {/* Indicador de Status / Enter */}
          <div className="hidden sm:flex items-center gap-2 pr-2 shrink-0">
            <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs shadow-inner">
              ENTER ↵
            </span>
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold font-mono">
              <Zap className="w-3.5 h-3.5" />
              <span>Autofocus ON</span>
            </div>
          </div>
        </div>
      </div>

      {/* BANNER HUD: ÚLTIMA LEITURA BIPADA */}
      {lastScanned && (
        <div
          className={`rounded-xl p-4 border transition-all duration-300 ${lastScanned.cadastrado
            ? 'bg-slate-900/95 border-emerald-500/40 shadow-lg'
            : 'bg-amber-950/40 border-amber-500/60 shadow-lg shadow-amber-950/50'
            }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${lastScanned.cadastrado
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}
              >
                {lastScanned.cadastrado ? (
                  <CheckCircle className="w-6 h-6" />
                ) : (
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-semibold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    ÚLTIMO BIPE
                  </span>
                  <span className="font-mono text-lg font-black text-white tracking-wide">
                    {lastScanned.sku}
                  </span>

                  {lastScanned.cadastrado ? (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      Cadastrado Oficial
                    </span>
                  ) : (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950">
                      NÃO CADASTRADO NO ERP
                    </span>
                  )}
                </div>

                <p className="text-sm font-semibold text-slate-200 mt-1 line-clamp-1">
                  {lastScanned.descricao}
                </p>

                <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {lastScanned.timestamp.toLocaleTimeString('pt-BR')}
                  </span>
                  <span>
                    Qtd Contada Nesta Sessão: <strong className="text-white font-mono text-sm">{lastScanned.qtd}</strong>
                  </span>
                  <span>
                    Divergência:{' '}
                    <strong
                      className={`font-mono text-sm ${lastScanned.divergencia === 0
                        ? 'text-emerald-400'
                        : lastScanned.divergencia > 0
                          ? 'text-sky-400'
                          : 'text-red-400'
                        }`}
                    >
                      {lastScanned.divergencia > 0 ? `+${lastScanned.divergencia}` : lastScanned.divergencia}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Ações Rápidas: Cadastrar ou Desfazer */}
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              {onUndoLastScan && (
                <button
                  type="button"
                  onClick={() => handleUndo(lastScanned.sku)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition"
                  title="Desfazer última leitura deste SKU (-1)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Desfazer (-1)
                </button>
              )}

              {!lastScanned.cadastrado && onQuickRegisterSku && (
                <button
                  type="button"
                  onClick={() => onQuickRegisterSku(lastScanned.sku)}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all shrink-0"
                >
                  <PlusCircle className="w-4 h-4" />
                  Cadastrar Este SKU Agora
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MINI FITA DE AUDITORIA: ÚLTIMOS BIPES REGISTRADOS */}
      {history.length > 0 && (
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold shrink-0 pl-1">
            <History className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Fita de Bipes:</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto py-0.5">
            {history.map((h) => (
              <div
                key={h.id}
                className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-mono border shrink-0 ${h.cadastrado
                  ? 'bg-slate-900 border-slate-700 text-slate-200'
                  : 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                  }`}
              >
                <span className="font-bold">{h.sku}</span>
                <span className="text-[11px] px-1.5 py-0.2 rounded bg-slate-800 text-emerald-400 font-bold">
                  +{h.qtdDelta}
                </span>
                <span className="text-[10px] text-slate-400">
                  (Total: {h.totalQtd})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
