import React, { useEffect, useRef, useState } from 'react';
import {
  Barcode,
  AlertTriangle,
  CheckCircle,
  PlusCircle,
  Clock,
  Zap,
} from 'lucide-react';
import { soundManager } from '../lib/sound';
import type { ItemInventariado } from '../types/inventory';

interface ScannerInputProps {
  onScan: (sku: string) => Promise<{ cadastrado: boolean; item?: ItemInventariado; mensagem?: string }>;
  disabled?: boolean;
  onQuickRegisterSku?: (sku: string) => void;
}

export const ScannerInput: React.FC<ScannerInputProps> = ({
  onScan,
  disabled = false,
  onQuickRegisterSku,
}) => {
  const [sku, setSku] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [flashType, setFlashType] = useState<'success' | 'warning' | 'error' | null>(null);
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

    // Foco no mount
    focusInput();

    // Re-foco ao clicar em qualquer lugar da tela
    const handleWindowClick = () => {
      setTimeout(focusInput, 50);
    };

    // Fallback: se o usuário pressionar teclas alfanuméricas fora do input (buffer rápido do leitor Nonus LW200)
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

      // Limpa imediatamente o input para a próxima leitura imediata (Zero Latency UX)
      setSku('');
      setIsProcessing(true);

      try {
        const result = await onScan(rawSku);

        if (result.cadastrado) {
          soundManager.playSuccess();
          triggerFlash('success');
        } else {
          soundManager.playWarning();
          triggerFlash('warning');
        }

        const qtd = result.item?.quantidade_contada || 1;
        const estoque = result.item?.estoque_sistema_snapshot || 0;

        setLastScanned({
          sku: rawSku,
          descricao: result.item?.descricao_snapshot || (result.cadastrado ? 'Item Cadastrado' : 'Item NÃO Cadastrado'),
          cadastrado: result.cadastrado,
          timestamp: new Date(),
          qtd,
          divergencia: qtd - estoque,
        });
      } catch (err) {
        soundManager.playError();
        triggerFlash('error');
        console.error('Erro ao processar leitura:', err);
      } finally {
        setIsProcessing(false);
        // Garante que o foco permaneça
        inputRef.current?.focus();
      }
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Container Principal do Input do Leitor */}
      <div
        className={`relative rounded-2xl p-1.5 transition-all duration-200 border-2 ${
          flashType === 'success'
            ? 'flash-success bg-emerald-950/40 border-emerald-400 shadow-2xl shadow-emerald-500/20'
            : flashType === 'warning'
            ? 'flash-warning bg-amber-950/40 border-amber-400 shadow-2xl shadow-amber-500/20'
            : flashType === 'error'
            ? 'flash-error bg-red-950/40 border-red-500 shadow-2xl shadow-red-500/20'
            : 'bg-slate-900/90 border-slate-700/80 hover:border-slate-600 focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10'
        }`}
      >
        <div className="flex items-center gap-3 px-4 py-2">
          {/* Ícone Indicador de Scanner */}
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-800 text-emerald-400 border border-slate-700 shrink-0">
            <Barcode className="w-7 h-7" />
          </div>

          {/* Campo de Entrada com Autofocus */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-xs font-semibold mb-1">
              <span className="text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Leitor Nonus LW200 Ativo
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
            <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-xs">
              ENTER ↵
            </span>
            <div className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
              <Zap className="w-3.5 h-3.5" />
              <span>Autofocus ON</span>
            </div>
          </div>
        </div>
      </div>

      {/* BANNER HUD: ÚLTIMA LEITURA BIPADA (ALTO CONTRASTE PARA GALPÃO) */}
      {lastScanned && (
        <div
          className={`rounded-xl p-4 border transition-all duration-300 ${
            lastScanned.cadastrado
              ? 'bg-slate-900/95 border-emerald-500/40 shadow-lg'
              : 'bg-amber-950/40 border-amber-500/60 shadow-lg shadow-amber-950/50'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                  lastScanned.cadastrado
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
                      className={`font-mono text-sm ${
                        lastScanned.divergencia === 0
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

            {/* Ação rápida caso não seja cadastrado */}
            {!lastScanned.cadastrado && onQuickRegisterSku && (
              <button
                onClick={() => onQuickRegisterSku(lastScanned.sku)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-md transition-all self-end sm:self-center shrink-0"
              >
                <PlusCircle className="w-4 h-4" />
                Cadastrar Este SKU Agora
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
