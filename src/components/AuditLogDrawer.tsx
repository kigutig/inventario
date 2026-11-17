import React from 'react';
import { X, Clock, Barcode, User as UserIcon, ShieldCheck } from 'lucide-react';
import type { LogLeitura } from '../types/inventory';

interface AuditLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  logs: LogLeitura[];
  sessaoNome: string;
}

export const AuditLogDrawer: React.FC<AuditLogDrawerProps> = ({
  isOpen,
  onClose,
  logs,
  sessaoNome,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-1.5">
                Trilha de Bipes (Auditoria)
              </h3>
              <p className="text-xs text-slate-400 truncate max-w-[240px]">
                {sessaoNome}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status de integridade */}
        <div className="px-5 py-2.5 bg-slate-950/40 border-b border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1 text-emerald-400 font-mono">
            <ShieldCheck className="w-4 h-4" />
            Registro Bruto de Leitor HID
          </span>
          <span className="font-mono">{logs.length} registros</span>
        </div>

        {/* Lista de Logs */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {logs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              <Barcode className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              Nenhum bipe registrado nesta sessão até o momento.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <Barcode className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-mono font-bold text-white text-sm">
                      {log.codigo_sku}
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                      <UserIcon className="w-3 h-3 text-slate-400" />
                      <span>{log.usuario_email || 'Operador Nonus LW200'}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-mono text-xs text-slate-400 block">
                    {new Date(log.created_at).toLocaleTimeString('pt-BR')}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(log.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
