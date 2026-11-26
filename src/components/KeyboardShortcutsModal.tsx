import React from 'react';
import { Keyboard, X, Sparkles } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  const shortcuts = [
    {
      key: 'F2',
      description: 'Focar instantaneamente no Leitor de Código de Barras',
      category: 'Operação de Chão de Fábrica',
      highlight: true
    },
    {
      key: 'F4',
      description: 'Abrir Catálogo de Produtos / Cadastro Oficial de SKUs',
      category: 'Navegação'
    },
    {
      key: 'F7',
      description: 'Abrir Painel de Cobertura e Ativos Não Localizados',
      category: 'Auditoria'
    },
    {
      key: 'F8',
      description: 'Gerador e Impressão de Etiquetas Code 128',
      category: 'Identificação'
    },
    {
      key: 'F9',
      description: 'Abrir Relatório Formal de Auditoria Física',
      category: 'Auditoria'
    },
    {
      key: 'Ctrl + P',
      description: 'Disparar Impressão Oficial do Relatório de Auditoria',
      category: 'Impressão'
    },
    {
      key: 'Esc',
      description: 'Fechar qualquer janela suspensa, drawer ou modal aberto',
      category: 'Sistema'
    },
    {
      key: 'Enter',
      description: 'Confirmar leitura do coletor / leitor Nonus LW200',
      category: 'Operação de Chão de Fábrica'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                Atalhos Rápidos de Teclado
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-normal">
                  Chão de Fábrica
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Otimizado para operadores de coletor e auditores industriais
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

        {/* Lista de Atalhos */}
        <div className="p-5 overflow-y-auto max-h-[60vh] divide-y divide-slate-800/60">
          {shortcuts.map((item, idx) => (
            <div
              key={idx}
              className={`py-3 flex items-center justify-between gap-4 ${
                item.highlight ? 'bg-cyan-950/20 -mx-5 px-5' : ''
              }`}
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-slate-200">
                  {item.description}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {item.category}
                </span>
              </div>
              <kbd className="px-3 py-1.5 bg-slate-950 border border-slate-700/80 text-cyan-400 font-mono text-xs font-bold rounded-lg shadow-inner min-w-[70px] text-center shrink-0">
                {item.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Foco automático mantém o leitor Nonus LW200 sempre pronto.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
