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

  const itensProcessados = useMemo(() => {
    const filtrados = itens.filter((item) => {
      const divergencia = item.quantidade_contada - item.estoque_sistema_snapshot;

      if (busca.trim()) {
        const termo = busca.toLowerCase().trim();
        const bateuSku = item.codigo_sku.toLowerCase().includes(termo);
        const bateuDesc = item.descricao_snapshot.toLowerCase().includes(termo);
        if (!bateuSku && !bateuDesc) return false;
      }

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
      return <ArrowUpDown className="w-3 h-3 text-gray-600 ml-1 inline-block" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-blue-400 ml-1 inline-block" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-400 ml-1 inline-block" />
    );
  };

  return (
    <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl overflow-hidden">
      {/* Barra Superior */}
      <div className="p-4 border-b border-gray-700/50 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar SKU ou descrição..."
              className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition"
            />
            {busca && (
              <button
                onClick={() => setBusca('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-white"
              >
                Limpar
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onOpenAuditLogs}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium border border-gray-700/50 transition"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Trilha de Bipes</span>
            </button>

            <button
              onClick={() => exportarRelatorioInventario(sessao, itens, 'xlsx')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel</span>
            </button>

            <button
              onClick={() => exportarRelatorioInventario(sessao, itens, 'csv')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium border border-gray-700/50 transition"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <span className="text-gray-500 font-medium flex items-center gap-1 mr-1 text-[11px] uppercase tracking-wider shrink-0">
            <Filter className="w-3 h-3" /> Filtros:
          </span>

          <button
            onClick={() => setFiltro('todos')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition shrink-0 ${
              filtro === 'todos'
                ? 'bg-gray-200 text-gray-900'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Todos ({itens.length})
          </button>

          <button
            onClick={() => setFiltro('divergencia')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition shrink-0 ${
              filtro === 'divergencia'
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 text-red-400 hover:text-red-300'
            }`}
          >
            Divergências ({totalDivergentes})
          </button>

          <button
            onClick={() => setFiltro('faltando')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition shrink-0 ${
              filtro === 'faltando'
                ? 'bg-red-700 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Faltando ({totalFaltando})
          </button>

          <button
            onClick={() => setFiltro('sobrando')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition shrink-0 ${
              filtro === 'sobrando'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Sobrando ({totalSobrando})
          </button>

          <button
            onClick={() => setFiltro('corretos')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition shrink-0 ${
              filtro === 'corretos'
                ? 'bg-green-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Corretos ({totalCorretos})
          </button>

          <button
            onClick={() => setFiltro('nao_cadastrados')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition shrink-0 ${
              filtro === 'nao_cadastrados'
                ? 'bg-yellow-600 text-gray-900'
                : 'bg-gray-800 text-yellow-400 hover:text-yellow-300'
            }`}
          >
            Não Cadastrados ({totalNaoCadastrados})
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead className="bg-gray-900 text-gray-500 text-[11px] uppercase tracking-wider border-b border-gray-700/50 select-none">
            <tr>
              <th onClick={() => handleSort('sku')} className="py-2.5 px-4 cursor-pointer hover:text-white transition">
                SKU {renderSortIndicator('sku')}
              </th>
              <th onClick={() => handleSort('descricao')} className="py-2.5 px-4 cursor-pointer hover:text-white transition">
                Descrição {renderSortIndicator('descricao')}
              </th>
              <th onClick={() => handleSort('teorico')} className="py-2.5 px-4 text-center cursor-pointer hover:text-white transition">
                Teórico {renderSortIndicator('teorico')}
              </th>
              <th onClick={() => handleSort('contado')} className="py-2.5 px-4 text-center cursor-pointer hover:text-white transition">
                Físico {renderSortIndicator('contado')}
              </th>
              <th onClick={() => handleSort('divergencia')} className="py-2.5 px-4 text-center cursor-pointer hover:text-white transition">
                Divergência {renderSortIndicator('divergencia')}
              </th>
              <th onClick={() => handleSort('custo')} className="py-2.5 px-4 text-right cursor-pointer hover:text-white transition">
                Custo {renderSortIndicator('custo')}
              </th>
              <th onClick={() => handleSort('impacto')} className="py-2.5 px-4 text-right cursor-pointer hover:text-white transition">
                Impacto {renderSortIndicator('impacto')}
              </th>
              <th className="py-2.5 px-4 text-center">Ações</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-700/30">
            {itensProcessados.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center justify-center gap-2 max-w-xs mx-auto">
                    <Search className="w-6 h-6 text-gray-600" />
                    <p className="font-medium text-gray-300">Nenhum item encontrado.</p>
                    <p className="text-xs text-gray-500">
                      Aponte o leitor para uma etiqueta para registrar.
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
                    className={`hover:bg-gray-800/50 transition-colors ${
                      !item.cadastrado_no_sistema
                        ? 'bg-yellow-950/10'
                        : ''
                    }`}
                  >
                    <td className="py-2.5 px-4 font-mono font-semibold text-white text-sm">
                      {item.codigo_sku}
                    </td>

                    <td className="py-2.5 px-4 max-w-xs sm:max-w-md">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-gray-200 leading-snug">
                          {item.descricao_snapshot}
                        </span>

                        {!item.cadastrado_no_sistema && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Não Cadastrado
                            </span>
                            {onQuickRegisterSku && (
                              <button
                                onClick={() => onQuickRegisterSku(item.codigo_sku)}
                                className="text-[10px] font-semibold text-yellow-400 hover:text-yellow-300 underline underline-offset-2 flex items-center gap-0.5"
                              >
                                Cadastrar <ExternalLink className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-2.5 px-4 text-center font-mono text-gray-500">
                      {item.estoque_sistema_snapshot} un
                    </td>

                    <td className="py-2.5 px-4 text-center">
                      <div className="inline-flex items-center gap-0.5 bg-gray-900 p-0.5 rounded-lg border border-gray-700/50">
                        <button
                          onClick={() => handleAdjust(item.id, -1)}
                          disabled={isFinalizada || item.quantidade_contada <= 0}
                          className="w-6 h-6 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white flex items-center justify-center transition disabled:opacity-30"
                        >
                          <Minus className="w-3 h-3" />
                        </button>

                        <span className="w-10 text-center font-mono font-bold text-base text-white">
                          {item.quantidade_contada}
                        </span>

                        <button
                          onClick={() => handleAdjust(item.id, 1)}
                          disabled={isFinalizada}
                          className="w-6 h-6 rounded-md bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition disabled:opacity-30"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    <td className="py-2.5 px-4 text-center">
                      {divergencia === 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-green-500/10 text-green-400">
                          <CheckCircle2 className="w-3 h-3" />
                          0
                        </span>
                      ) : divergencia > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/10 text-blue-400 font-mono">
                          +{divergencia}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-500/10 text-red-400 font-mono">
                          {divergencia}
                        </span>
                      )}
                    </td>

                    <td className="py-2.5 px-4 text-right font-mono text-gray-500 text-xs">
                      {item.custo_unitario_snapshot.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </td>

                    <td className="py-2.5 px-4 text-right font-mono font-semibold text-xs">
                      <span
                        className={
                          impacto === 0
                            ? 'text-gray-500'
                            : impacto > 0
                            ? 'text-blue-400'
                            : 'text-red-400'
                        }
                      >
                        {impacto > 0 ? '+' : ''}
                        {impacto.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                      </span>
                    </td>

                    <td className="py-2.5 px-4 text-center">
                      <button
                        onClick={() => setItemParaExcluir(item)}
                        disabled={isFinalizada}
                        title="Remover"
                        className="p-1 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Rodapé */}
      <div className="p-3 px-4 bg-gray-900/50 border-t border-gray-700/50 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span>
            <strong className="text-gray-300">{itensProcessados.length}</strong> de {itens.length} SKUs
          </span>
          <span className="text-gray-700">|</span>
          <span>
            Peças: <strong className="text-blue-400">{totalPecasFiltradas}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span>Impacto:</span>
          <strong
            className={`${
              totalImpactoFiltrado > 0
                ? 'text-blue-400'
                : totalImpactoFiltrado < 0
                ? 'text-red-400'
                : 'text-gray-400'
            }`}
          >
            {totalImpactoFiltrado > 0 ? '+' : ''}
            {totalImpactoFiltrado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </strong>
        </div>
      </div>

      {/* Modal de exclusão */}
      {itemParaExcluir && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 rounded-lg bg-red-500/10">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Remover Contagem?</h3>
                <p className="text-xs text-gray-400">Zera a contagem deste SKU nesta sessão.</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-gray-800 border border-gray-700 text-sm">
              <p className="text-blue-400 font-mono font-semibold">{itemParaExcluir.codigo_sku}</p>
              <p className="text-gray-300 mt-0.5">{itemParaExcluir.descricao_snapshot}</p>
              <p className="text-xs text-gray-500 mt-1.5">
                Contado: <strong className="text-white">{itemParaExcluir.quantidade_contada} un</strong>
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setItemParaExcluir(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition disabled:opacity-50"
              >
                {isDeleting ? 'Removendo...' : 'Remover'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
