import React, { useState } from 'react';
import {
  Search,
  Filter,
  FileSpreadsheet,
  FileText,
  Plus,
  Minus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';
import type { FiltroTabela, ItemInventariado, SessaoInventario } from '../types/inventory';
import { exportarRelatorioInventario } from '../lib/excel';
import { soundManager } from '../lib/sound';

interface InventoryTableProps {
  sessao: SessaoInventario;
  itens: ItemInventariado[];
  onAdjustQuantity: (itemId: string, delta: number) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
  onQuickRegisterSku?: (sku: string) => void;
  onOpenAuditLogs: () => void;
}

export const InventoryTable: React.FC<InventoryTableProps> = ({
  sessao,
  itens,
  onAdjustQuantity,
  onDeleteItem,
  onQuickRegisterSku,
  onOpenAuditLogs,
}) => {
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroTabela>('todos');
  const [itemParaExcluir, setItemParaExcluir] = useState<ItemInventariado | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isFinalizada = sessao.status === 'finalizado';

  // Filtragem dos itens
  const itensFiltrados = itens.filter((item) => {
    const divergencia = item.quantidade_contada - item.estoque_sistema_snapshot;

    // Filtro por termo de busca
    if (busca.trim()) {
      const termo = busca.toLowerCase().trim();
      const bateuSku = item.codigo_sku.toLowerCase().includes(termo);
      const bateuDesc = item.descricao_snapshot.toLowerCase().includes(termo);
      if (!bateuSku && !bateuDesc) return false;
    }

    // Filtro por categoria
    switch (filtro) {
      case 'divergencia':
        return divergencia !== 0;
      case 'faltando':
        return divergencia < 0;
      case 'sobrando':
        return divergencia > 0;
      case 'corretos':
        return divergencia === 0 && item.cadastrado_no_sistema;
      case 'nao_cadastrados':
        return !item.cadastrado_no_sistema;
      default:
        return true;
    }
  });

  const handleAdjust = async (itemId: string, delta: number) => {
    if (isFinalizada) return;
    soundManager.playAdjust();
    await onAdjustQuantity(itemId, delta);
  };

  const handleConfirmDelete = async () => {
    if (!itemParaExcluir || isFinalizada) return;
    setIsDeleting(true);
    try {
      await onDeleteItem(itemParaExcluir.id);
      setItemParaExcluir(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Barra de Filtros e Exportação */}
      <div className="p-4 border-b border-slate-800 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Campo de Busca */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar por SKU ou descrição..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {busca && (
              <button
                onClick={() => setBusca('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Botões de Ação e Exportação */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onOpenAuditLogs}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
            >
              <Clock className="w-4 h-4 text-sky-400" />
              Trilha de Bipes
            </button>

            <button
              onClick={() => exportarRelatorioInventario(sessao, itens, 'xlsx')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Exportar Excel (.xlsx)
            </button>

            <button
              onClick={() => exportarRelatorioInventario(sessao, itens, 'csv')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
            >
              <FileText className="w-4 h-4 text-emerald-400" />
              CSV
            </button>
          </div>
        </div>

        {/* Pílulas de Filtros Rápidos */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 font-medium flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" /> Filtros:
          </span>

          <button
            onClick={() => setFiltro('todos')}
            className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
              filtro === 'todos'
                ? 'bg-slate-200 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Todos ({itens.length})
          </button>

          <button
            onClick={() => setFiltro('divergencia')}
            className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
              filtro === 'divergencia'
                ? 'bg-rose-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Com Divergência ({itens.filter((i) => i.quantidade_contada !== i.estoque_sistema_snapshot).length})
          </button>

          <button
            onClick={() => setFiltro('faltando')}
            className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
              filtro === 'faltando'
                ? 'bg-red-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Faltando ({itens.filter((i) => i.quantidade_contada < i.estoque_sistema_snapshot).length})
          </button>

          <button
            onClick={() => setFiltro('sobrando')}
            className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
              filtro === 'sobrando'
                ? 'bg-sky-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Sobrando ({itens.filter((i) => i.quantidade_contada > i.estoque_sistema_snapshot).length})
          </button>

          <button
            onClick={() => setFiltro('corretos')}
            className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
              filtro === 'corretos'
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            100% Corretos ({itens.filter((i) => i.quantidade_contada === i.estoque_sistema_snapshot && i.cadastrado_no_sistema).length})
          </button>

          <button
            onClick={() => setFiltro('nao_cadastrados')}
            className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
              filtro === 'nao_cadastrados'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Não Cadastrados ({itens.filter((i) => !i.cadastrado_no_sistema).length})
          </button>
        </div>
      </div>

      {/* Tabela de Itens */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950/70 text-slate-400 text-xs uppercase font-mono tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-3 px-4">Código SKU</th>
              <th className="py-3 px-4">Descrição do Ativo</th>
              <th className="py-3 px-4 text-center">Sistema (Teórico)</th>
              <th className="py-3 px-4 text-center">Contado (Físico)</th>
              <th className="py-3 px-4 text-center">Divergência</th>
              <th className="py-3 px-4 text-right">Custo Unit.</th>
              <th className="py-3 px-4 text-right">Impacto (R$)</th>
              <th className="py-3 px-4 text-center">Ações</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/80">
            {itensFiltrados.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Search className="w-8 h-8 text-slate-400" />
                    <p className="font-semibold text-slate-300">Nenhum item inventariado corresponde aos filtros.</p>
                    <p className="text-xs text-slate-400">
                      Use o leitor Nonus LW200 para bipar o primeiro produto acima!
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              itensFiltrados.map((item) => {
                const divergencia = item.quantidade_contada - item.estoque_sistema_snapshot;
                const impacto = divergencia * item.custo_unitario_snapshot;

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      !item.cadastrado_no_sistema ? 'bg-amber-950/10' : ''
                    }`}
                  >
                    {/* Código SKU */}
                    <td className="py-3 px-4 font-mono font-bold text-white text-base">
                      {item.codigo_sku}
                    </td>

                    {/* Descrição */}
                    <td className="py-3 px-4 max-w-xs sm:max-w-md">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-200">
                          {item.descricao_snapshot}
                        </span>

                        {!item.cadastrado_no_sistema && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Não Cadastrado
                            </span>
                            {onQuickRegisterSku && (
                              <button
                                onClick={() => onQuickRegisterSku(item.codigo_sku)}
                                className="text-[10px] font-bold text-amber-400 hover:text-amber-300 underline underline-offset-2 flex items-center gap-0.5"
                              >
                                Cadastrar <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Saldo Sistema */}
                    <td className="py-3 px-4 text-center font-mono font-medium text-slate-400">
                      {item.estoque_sistema_snapshot} un
                    </td>

                    {/* Quantidade Contada com Controles + / - */}
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                        <button
                          onClick={() => handleAdjust(item.id, -1)}
                          disabled={isFinalizada || item.quantidade_contada <= 0}
                          title="Subtrair 1"
                          className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition-colors disabled:opacity-40"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>

                        <span className="w-12 text-center font-mono font-black text-lg text-white">
                          {item.quantidade_contada}
                        </span>

                        <button
                          onClick={() => handleAdjust(item.id, 1)}
                          disabled={isFinalizada}
                          title="Somar 1"
                          className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-colors disabled:opacity-40"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Divergência */}
                    <td className="py-3 px-4 text-center">
                      {divergencia === 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          0 (Bateu)
                        </span>
                      ) : divergencia > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono">
                          +{divergencia} (Sobra)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
                          {divergencia} (Falta)
                        </span>
                      )}
                    </td>

                    {/* Custo Unitário */}
                    <td className="py-3 px-4 text-right font-mono text-slate-400">
                      {item.custo_unitario_snapshot.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </td>

                    {/* Impacto Financeiro */}
                    <td className="py-3 px-4 text-right font-mono font-bold">
                      <span
                        className={
                          impacto === 0
                            ? 'text-slate-400'
                            : impacto > 0
                            ? 'text-sky-400'
                            : 'text-rose-400'
                        }
                      >
                        {impacto > 0 ? '+' : ''}
                        {impacto.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </span>
                    </td>

                    {/* Ações */}
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setItemParaExcluir(item)}
                        disabled={isFinalizada}
                        title="Remover contagem deste SKU"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Confirmação de Exclusão */}
      {itemParaExcluir && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Remover Contagem?</h3>
                <p className="text-xs text-slate-400">Esta ação zera a contagem deste SKU nesta sessão.</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-sm">
              <p className="text-emerald-400 font-bold">{itemParaExcluir.codigo_sku}</p>
              <p className="text-slate-300 font-sans mt-0.5">{itemParaExcluir.descricao_snapshot}</p>
              <p className="text-xs text-slate-400 mt-2">
                Quantidade atual contada: <strong>{itemParaExcluir.quantidade_contada} un</strong>
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setItemParaExcluir(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Removendo...' : 'Sim, Remover'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
