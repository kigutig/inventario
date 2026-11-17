import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Lock,
  Unlock,
  ArrowRight,
  Calendar,
  AlertCircle,
  MoreVertical,
  Edit3,
  Trash2,
  FileSpreadsheet,
  FileText,
  Barcode,
} from 'lucide-react';
import type { SessaoInventario } from '../types/inventory';
import { listarItensInventariados } from '../services/inventoryService';
import { exportarRelatorioInventario } from '../lib/excel';

interface SessionsViewProps {
  sessoes: SessaoInventario[];
  sessaoAtivaId: string;
  onSelectSessao: (sessaoId: string) => void;
  onCreateSessao: (nome: string) => Promise<void>;
  onFinalizeSessao: (sessaoId: string) => Promise<void>;
  onReopenSessao?: (sessaoId: string) => Promise<void>;
  onRenameSessao?: (sessaoId: string, novoNome: string) => Promise<void>;
  onDeleteSessao?: (sessaoId: string) => Promise<void>;
}

export const SessionsView: React.FC<SessionsViewProps> = ({
  sessoes,
  sessaoAtivaId,
  onSelectSessao,
  onCreateSessao,
  onFinalizeSessao,
  onReopenSessao,
  onRenameSessao,
  onDeleteSessao,
}) => {
  // Criação
  const [novoNome, setNovoNome] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Menu dropdown ativo
  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null);

  // Modais de ação
  const [sessaoParaFinalizar, setSessaoParaFinalizar] = useState<SessaoInventario | null>(null);
  const [sessaoParaRenomear, setSessaoParaRenomear] = useState<SessaoInventario | null>(null);
  const [novoNomeRenomear, setNovoNomeRenomear] = useState('');
  const [sessaoParaExcluir, setSessaoParaExcluir] = useState<SessaoInventario | null>(null);

  // Estados de loading
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportandoId, setExportandoId] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoNome.trim()) return;

    setIsCreating(true);
    try {
      await onCreateSessao(novoNome.trim());
      setNovoNome('');
      setShowCreateModal(false);
    } finally {
      setIsCreating(false);
    }
  };

  const handleConfirmFinalize = async () => {
    if (!sessaoParaFinalizar) return;
    setIsProcessing(true);
    try {
      await onFinalizeSessao(sessaoParaFinalizar.id);
      setSessaoParaFinalizar(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessaoParaRenomear || !novoNomeRenomear.trim() || !onRenameSessao) return;
    setIsProcessing(true);
    try {
      await onRenameSessao(sessaoParaRenomear.id, novoNomeRenomear.trim());
      setSessaoParaRenomear(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!sessaoParaExcluir || !onDeleteSessao) return;
    setIsProcessing(true);
    try {
      await onDeleteSessao(sessaoParaExcluir.id);
      setSessaoParaExcluir(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = async (sessao: SessaoInventario, formato: 'xlsx' | 'csv') => {
    setExportandoId(sessao.id);
    setMenuAbertoId(null);
    try {
      const itens = await listarItensInventariados(sessao.id);
      exportarRelatorioInventario(sessao, itens, formato);
    } catch (err) {
      console.error('Erro ao exportar sessão:', err);
    } finally {
      setExportandoId(null);
    }
  };

  return (
    <div className="space-y-6" onClick={() => setMenuAbertoId(null)}>
      {/* Topo com Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Layers className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Sessões de Inventário</h2>
            <p className="text-xs text-slate-400">
              Gerencie auditorias isoladas por setor, data ou galpão de máquinas
            </p>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowCreateModal(true);
          }}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nova Sessão de Inventário
        </button>
      </div>

      {/* Grid de Sessões */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sessoes.map((sessao) => {
          const isAtiva = sessao.id === sessaoAtivaId;
          const isFinalizada = sessao.status === 'finalizado';
          const isMenuAberto = menuAbertoId === sessao.id;

          return (
            <div
              key={sessao.id}
              className={`rounded-2xl border p-5 transition-all flex flex-col justify-between relative ${
                isAtiva
                  ? 'bg-slate-900/90 border-emerald-500/50 shadow-xl shadow-emerald-500/5 ring-1 ring-emerald-500/20'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="space-y-3">
                {/* Cabeçalho do Card com Badges e Botão de Ações (...) */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                        isFinalizada
                          ? 'bg-slate-800 text-slate-400 border-slate-700'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      }`}
                    >
                      {isFinalizada ? 'Finalizado' : 'Em Andamento'}
                    </span>

                    {isAtiva && (
                      <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        ATIVA
                      </span>
                    )}
                  </div>

                  {/* Botão Menu de Ações (3 pontos) */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuAbertoId(isMenuAberto ? null : sessao.id);
                      }}
                      title="Menu de Ações da Sessão"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>

                    {/* Popover Dropdown de Ações */}
                    {isMenuAberto && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 top-8 w-56 bg-slate-950 border border-slate-700/80 rounded-2xl shadow-2xl p-1.5 z-30 space-y-0.5 animate-in fade-in duration-150"
                      >
                        <div className="px-2.5 py-1.5 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 mb-1">
                          Ações da Sessão
                        </div>

                        {/* 1. Abrir Contagem */}
                        <button
                          onClick={() => {
                            onSelectSessao(sessao.id);
                            setMenuAbertoId(null);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors text-left"
                        >
                          <Barcode className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Abrir Contagem (Bipe)</span>
                        </button>

                        {/* 2. Renomear Sessão */}
                        {onRenameSessao && (
                          <button
                            onClick={() => {
                              setSessaoParaRenomear(sessao);
                              setNovoNomeRenomear(sessao.nome);
                              setMenuAbertoId(null);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors text-left"
                          >
                            <Edit3 className="w-4 h-4 text-sky-400 shrink-0" />
                            <span>Renomear Sessão</span>
                          </button>
                        )}

                        {/* 3. Exportar Excel */}
                        <button
                          onClick={() => handleExport(sessao, 'xlsx')}
                          disabled={exportandoId === sessao.id}
                          className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors text-left disabled:opacity-50"
                        >
                          <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>{exportandoId === sessao.id ? 'Gerando...' : 'Exportar Excel (.xlsx)'}</span>
                        </button>

                        {/* 4. Exportar CSV */}
                        <button
                          onClick={() => handleExport(sessao, 'csv')}
                          disabled={exportandoId === sessao.id}
                          className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-slate-200 hover:text-white hover:bg-slate-800/80 rounded-xl transition-colors text-left disabled:opacity-50"
                        >
                          <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>Exportar CSV</span>
                        </button>

                        <div className="border-t border-slate-800 my-1" />

                        {/* 5. Finalizar ou Reabrir */}
                        {!isFinalizada ? (
                          <button
                            onClick={() => {
                              setSessaoParaFinalizar(sessao);
                              setMenuAbertoId(null);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/10 rounded-xl transition-colors text-left"
                          >
                            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>Finalizar Sessão</span>
                          </button>
                        ) : (
                          onReopenSessao && (
                            <button
                              onClick={async () => {
                                setMenuAbertoId(null);
                                await onReopenSessao(sessao.id);
                              }}
                              className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10 rounded-xl transition-colors text-left"
                            >
                              <Unlock className="w-4 h-4 text-emerald-400 shrink-0" />
                              <span>Reabrir para Bipar</span>
                            </button>
                          )
                        )}

                        {/* 6. Excluir Sessão */}
                        {onDeleteSessao && (
                          <button
                            onClick={() => {
                              setSessaoParaExcluir(sessao);
                              setMenuAbertoId(null);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/15 rounded-xl transition-colors text-left"
                          >
                            <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
                            <span>Excluir Sessão</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="font-bold text-white text-base line-clamp-2">{sessao.nome}</h3>

                <div className="text-xs text-slate-400 space-y-1 font-mono">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Início: {new Date(sessao.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  {sessao.finalizado_at && (
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Fim: {new Date(sessao.finalizado_at).toLocaleString('pt-BR')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Botões de Ação Rápida no Rodapé */}
              <div className="flex items-center gap-2 pt-4 mt-4 border-t border-slate-800/80">
                <button
                  onClick={() => onSelectSessao(sessao.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                    isAtiva
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  {isAtiva ? 'Abrir Contagem' : 'Selecionar'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => handleExport(sessao, 'xlsx')}
                  title="Exportar Planilha Excel"
                  disabled={exportandoId === sessao.id}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 border border-slate-700 hover:border-emerald-500/30 transition-colors disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                </button>

                {!isFinalizada ? (
                  <button
                    onClick={() => setSessaoParaFinalizar(sessao)}
                    title="Concluir e Finalizar Sessão"
                    className="p-2 rounded-xl bg-slate-800 hover:bg-amber-500/10 text-slate-400 hover:text-amber-400 border border-slate-700 hover:border-amber-500/30 transition-colors"
                  >
                    <Lock className="w-4 h-4" />
                  </button>
                ) : (
                  onReopenSessao && (
                    <button
                      onClick={() => onReopenSessao(sessao.id)}
                      title="Reabrir Sessão"
                      className="p-2 rounded-xl bg-slate-800 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 border border-slate-700 hover:border-emerald-500/30 transition-colors"
                    >
                      <Unlock className="w-4 h-4" />
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Criar Nova Sessão */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreate}
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <h3 className="font-bold text-lg text-white">Criar Nova Sessão de Inventário</h3>
            <p className="text-xs text-slate-400">
              Dê um nome descritivo para organizar a contagem física (ex: Inventário Geral Nov/2026, Galpão A).
            </p>

            <div>
              <label className="block text-xs font-mono font-semibold text-slate-400 mb-1">
                NOME DA SESSÃO
              </label>
              <input
                type="text"
                required
                autoFocus
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex: Galpão A - Maquinários de Musculação"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
              >
                {isCreating ? 'Criando...' : 'Criar Sessão'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Renomear Sessão */}
      {sessaoParaRenomear && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmRename}
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <h3 className="font-bold text-lg text-white flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-sky-400" />
              Renomear Sessão de Inventário
            </h3>

            <div>
              <label className="block text-xs font-mono font-semibold text-slate-400 mb-1">
                NOVO NOME DA SESSÃO
              </label>
              <input
                type="text"
                required
                autoFocus
                value={novoNomeRenomear}
                onChange={(e) => setNovoNomeRenomear(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-medium focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSessaoParaRenomear(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
              >
                {isProcessing ? 'Salvando...' : 'Salvar Alteração'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Confirmar Finalização */}
      {sessaoParaFinalizar && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Finalizar Esta Sessão?</h3>
                <p className="text-xs text-slate-400">
                  Após finalizada, a contagem será congelada e novos bipes serão bloqueados (pode ser reaberta depois).
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <p className="text-sm font-bold text-white">{sessaoParaFinalizar.nome}</p>
              <p className="text-xs text-slate-400 mt-1">
                Iniciada em {new Date(sessaoParaFinalizar.created_at).toLocaleString('pt-BR')}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setSessaoParaFinalizar(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmFinalize}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all disabled:opacity-50"
              >
                {isProcessing ? 'Finalizando...' : 'Confirmar e Fechar Sessão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão de Sessão */}
      {sessaoParaExcluir && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Excluir Esta Sessão de Inventário?</h3>
                <p className="text-xs text-slate-400">
                  Todas as contagens e bipes vinculados a esta sessão serão excluídos definitivamente.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <p className="text-sm font-bold text-white">{sessaoParaExcluir.nome}</p>
              <p className="text-xs text-slate-400 mt-1">
                Criada em {new Date(sessaoParaExcluir.created_at).toLocaleString('pt-BR')}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setSessaoParaExcluir(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isProcessing}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
              >
                {isProcessing ? 'Excluindo...' : 'Sim, Excluir Sessão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
