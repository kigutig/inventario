import React, { useMemo, useState } from 'react';
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import type { FiltroTabela, ItemInventariado, SessaoInventario } from '../types/inventory';
import { exportarRelatorioInventario } from '../lib/excel';
import { soundManager } from '../lib/sound';

type SortField = 'sku' | 'descricao' | 'teorico' | 'contado' | 'divergencia' | 'custo' | 'impacto';
type SortOrder = 'asc' | 'desc';

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
  const [sortField, setSortField] = useState<SortField>('divergencia');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [itemParaExcluir, setItemParaExcluir] = useState<ItemInventariado | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isFinalizada = sessao.status === 'finalizado';

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Filtragem e ordenação dos itens
  const itensProcessados = useMemo(() => {
    const filtrados = itens.filter((item) => {
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

    // Ordenação
    return filtrados.sort((a, b) => {
      let res = 0;
      const diffA = a.quantidade_contada - a.estoque_sistema_snapshot;
      const diffB = b.quantidade_contada - b.estoque_sistema_snapshot;
      const impactoA = diffA * a.custo_unitario_snapshot;
      const impactoB = diffB * b.custo_unitario_snapshot;

      switch (sortField) {
        case 'sku':
          res = a.codigo_sku.localeCompare(b.codigo_sku);
          break;
        case 'descricao':
          res = a.descricao_snapshot.localeCompare(b.descricao_snapshot);
          break;
        case 'teorico':
          res = a.estoque_sistema_snapshot - b.estoque_sistema_snapshot;
          break;
        case 'contado':
          res = a.quantidade_contada - b.quantidade_contada;
          break;
        case 'divergencia':
          res = diffA - diffB;
          break;
        case 'custo':
          res = a.custo_unitario_snapshot - b.custo_unitario_snapshot;
          break;
        case 'impacto':
          res = impactoA - impactoB;
          break;
        default:
          res = 0;
      }
      return sortOrder === 'asc' ? res : -res;
    });
  }, [itens, busca, filtro, sortField, sortOrder]);

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

  // Contagens para os badges de filtro
  const totalDivergentes = itens.filter((i) => i.quantidade_contada !== i.estoque_sistema_snapshot).length;
  const totalFaltando = itens.filter((i) => i.quantidade_contada < i.estoque_sistema_snapshot).length;
  const totalSobrando = itens.filter((i) => i.quantidade_contada > i.estoque_sistema_snapshot).length;
  const totalCorretos = itens.filter((i) => i.quantidade_contada === i.estoque_sistema_snapshot && i.cadastrado_no_sistema).length;
  const totalNaoCadastrados = itens.filter((i) => !i.cadastrado_no_sistema).length;

  const totalPecasFiltradas = itensProcessados.reduce((acc, i) => acc + i.quantidade_contada, 0);
  const totalImpactoFiltrado = itensProcessados.reduce(
    (acc, i) => acc + (i.quantidade_contada - i.estoque_sistema_snapshot) * i.custo_unitario_snapshot,
    0
  );

  const renderSortIndicator = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-60 ml-1 inline-block" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-cyan-400 ml-1 inline-block" />
    ) : (
      <ArrowDown className="w-3 h-3 text-cyan-400 ml-1 inline-block" />
    );
  };

  return (
    <div className="enterprise-card rounded-2xl overflow-hidden shadow-2xl">
      {/* Barra Superior: Busca & Ações de Exportação */}
      <div className="p-4 sm:p-5 border-b border-slate-800/80 space-y-3.5 bg-slate-950/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Campo de Busca Rápida */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por SKU ou descrição no inventário..."
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 transition"
            />
            {busca && (
              <button
                onClick={() => setBusca('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400 hover:text-white"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Botões de Ação e Exportação */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onOpenAuditLogs}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700/80 transition shadow-sm"
              title="Abrir trilha detalhada de bipes e registros de auditoria"
            >
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Trilha de Bipes</span>
            </button>

            <button
              onClick={() => exportarRelatorioInventario(sessao, itens, 'xlsx')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition"
              title="Exportar planilha Excel formatada com fórmulas de divergência"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar Excel (.xlsx)</span>
            </button>

            <button
              onClick={() => exportarRelatorioInventario(sessao, itens, 'csv')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700/80 transition"
              title="Exportar dados brutos em formato CSV para integração ERP"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Pílulas de Filtros Rápidos com Contadores */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 font-semibold flex items-center gap-1 mr-1 text-[11px] uppercase tracking-wider shrink-0">
            <Filter className="w-3 h-3 text-cyan-400" /> Filtros:
          </span>

          <button
            onClick={() => setFiltro('todos')}
            className={`px-3 py-1 rounded-lg font-mono text-xs font-bold transition shrink-0 ${
              filtro === 'todos'
                ? 'bg-slate-200 text-slate-950 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Todos ({itens.length})
          </button>

          <button
            onClick={() => setFiltro('divergencia')}
            className={`px-3 py-1 rounded-lg font-mono text-xs font-bold transition shrink-0 ${
              filtro === 'divergencia'
                ? 'bg-rose-500 text-white shadow-sm'
                : 'bg-slate-900 text-rose-400 hover:text-rose-300 border border-slate-800'
            }`}
          >
            Divergências ({totalDivergentes})
          </button>

          <button
            onClick={() => setFiltro('faltando')}
            className={`px-3 py-1 rounded-lg font-mono text-xs font-bold transition shrink-0 ${
              filtro === 'faltando'
                ? 'bg-red-600 text-white shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Faltando ({totalFaltando})
          </button>

          <button
            onClick={() => setFiltro('sobrando')}
            className={`px-3 py-1 rounded-lg font-mono text-xs font-bold transition shrink-0 ${
              filtro === 'sobrando'
                ? 'bg-sky-500 text-slate-950 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Sobrando ({totalSobrando})
          </button>

          <button
            onClick={() => setFiltro('corretos')}
            className={`px-3 py-1 rounded-lg font-mono text-xs font-bold transition shrink-0 ${
              filtro === 'corretos'
                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            100% Corretos ({totalCorretos})
          </button>

          <button
            onClick={() => setFiltro('nao_cadastrados')}
            className={`px-3 py-1 rounded-lg font-mono text-xs font-bold transition shrink-0 ${
              filtro === 'nao_cadastrados'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-900 text-amber-400 hover:text-amber-300 border border-slate-800'
            }`}
          >
            Não Cadastrados ({totalNaoCadastrados})
          </button>
        </div>
      </div>

      {/* Tabela de Itens com Cabeçalhos Ordenáveis */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase font-mono tracking-wider border-b border-slate-800 select-none">
            <tr>
              <th
                onClick={() => handleSort('sku')}
                className="py-3 px-4 cursor-pointer hover:text-white transition"
              >
                Código SKU {renderSortIndicator('sku')}
              </th>
              <th
                onClick={() => handleSort('descricao')}
                className="py-3 px-4 cursor-pointer hover:text-white transition"
              >
                Descrição do Ativo {renderSortIndicator('descricao')}
              </th>
              <th
                onClick={() => handleSort('teorico')}
                className="py-3 px-4 text-center cursor-pointer hover:text-white transition"
              >
                Teórico {renderSortIndicator('teorico')}
              </th>
              <th
                onClick={() => handleSort('contado')}
                className="py-3 px-4 text-center cursor-pointer hover:text-white transition"
              >
                Físico {renderSortIndicator('contado')}
              </th>
              <th
                onClick={() => handleSort('divergencia')}
                className="py-3 px-4 text-center cursor-pointer hover:text-white transition"
              >
                Divergência {renderSortIndicator('divergencia')}
              </th>
              <th
                onClick={() => handleSort('custo')}
                className="py-3 px-4 text-right cursor-pointer hover:text-white transition"
              >
                Custo Unit. {renderSortIndicator('custo')}
              </th>
              <th
                onClick={() => handleSort('impacto')}
                className="py-3 px-4 text-right cursor-pointer hover:text-white transition"
              >
                Impacto (R$) {renderSortIndicator('impacto')}
              </th>
              <th className="py-3 px-4 text-center">Ações</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60 bg-slate-950/20">
            {itensProcessados.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-16 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                    <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-slate-500">
                      <Search className="w-8 h-8" />
                    </div>
                    <p className="font-bold text-slate-200">Nenhum item inventariado corresponde aos filtros.</p>
                    <p className="text-xs text-slate-400">
                      Aponte o leitor de código de barras Nonus LW200 para qualquer etiqueta para registrar contagem imediata.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              itensProcessados.map((item) => {
                const divergencia = item.quantidade_contada - item.estoque_sistema_snapshot;
                const impacto = divergencia * item.custo_unitario_snapshot;

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-800/30 transition-colors ${
                      !item.cadastrado_no_sistema
                        ? 'bg-amber-950/15'
                        : divergencia < 0
                        ? 'hover:bg-rose-950/10'
                        : divergencia > 0
                        ? 'hover:bg-sky-950/10'
                        : ''
                    }`}
                  >
                    {/* Código SKU */}
                    <td className="py-3 px-4 font-mono font-bold text-white text-sm sm:text-base tracking-wide">
                      {item.codigo_sku}
                    </td>

                    {/* Descrição */}
                    <td className="py-3 px-4 max-w-xs sm:max-w-md">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-200 leading-snug">
                          {item.descricao_snapshot}
                        </span>

                        {!item.cadastrado_no_sistema && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
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
                      <div className="inline-flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
                        <button
                          onClick={() => handleAdjust(item.id, -1)}
                          disabled={isFinalizada || item.quantidade_contada <= 0}
                          title="Subtrair 1 (Estorno)"
                          className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center transition disabled:opacity-30"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>

                        <span className="w-12 text-center font-mono font-black text-base sm:text-lg text-white">
                          {item.quantidade_contada}
                        </span>

                        <button
                          onClick={() => handleAdjust(item.id, 1)}
                          disabled={isFinalizada}
                          title="Somar 1"
                          className="w-7 h-7 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition disabled:opacity-30"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Divergência */}
                    <td className="py-3 px-4 text-center">
                      {divergencia === 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          0 (Bateu)
                        </span>
                      ) : divergencia > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30 font-mono">
                          +{divergencia} (Sobra)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30 font-mono">
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
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition disabled:opacity-30"
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

      {/* Rodapé com Estatísticas do Filtro Atual */}
      <div className="p-3.5 sm:px-6 bg-slate-950/80 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-400">
        <div className="flex items-center gap-4">
          <span>
            Exibindo: <strong className="text-white">{itensProcessados.length}</strong> de {itens.length} SKUs
          </span>
          <span>|</span>
          <span>
            Soma Física Filtrada: <strong className="text-emerald-400">{totalPecasFiltradas}</strong> un
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span>Impacto Líquido Filtrado:</span>
          <strong
            className={`text-sm ${
              totalImpactoFiltrado > 0
                ? 'text-sky-400'
                : totalImpactoFiltrado < 0
                ? 'text-rose-400'
                : 'text-slate-300'
            }`}
          >
            {totalImpactoFiltrado > 0 ? '+' : ''}
            {totalImpactoFiltrado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </strong>
        </div>
      </div>

      {/* Modal de Confirmação de Exclusão */}
      {itemParaExcluir && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Remover Contagem?</h3>
                <p className="text-xs text-slate-400">Esta ação zera a contagem deste SKU nesta sessão.</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-sm">
              <p className="text-emerald-400 font-bold">{itemParaExcluir.codigo_sku}</p>
              <p className="text-slate-300 font-sans mt-0.5">{itemParaExcluir.descricao_snapshot}</p>
              <p className="text-xs text-slate-400 mt-2">
                Quantidade atual contada: <strong className="text-white">{itemParaExcluir.quantidade_contada} un</strong>
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setItemParaExcluir(null)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white transition disabled:opacity-50"
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
