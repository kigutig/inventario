import React, { useState } from 'react';
import {
  Search,
  X,
  PackageX,
  PlusCircle,
  Percent,
  CheckCircle2,
  AlertTriangle,
  TrendingDown,
} from 'lucide-react';
import type { ItemInventariado, ProdutoCadastro } from '../types/inventory';

interface UnscannedItemsModalProps {
  isOpen?: boolean;
  produtos: ProdutoCadastro[];
  itensContados?: ItemInventariado[];
  itensSessao?: ItemInventariado[];
  onAddUnscannedAsZero: (produtosNaoContados: ProdutoCadastro[]) => Promise<void>;
  onClose: () => void;
}

export const UnscannedItemsModal: React.FC<UnscannedItemsModalProps> = ({
  isOpen = true,
  produtos,
  itensContados,
  itensSessao,
  onAddUnscannedAsZero,
  onClose,
}) => {
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const contados = itensContados || itensSessao || [];

  // Mapear SKUs já presentes na contagem
  const skusContadosSet = new Set(
    contados.map((i) => i.codigo_sku.trim().toLowerCase())
  );

  // Filtrar produtos da base oficial que NÃO estão na contagem
  const produtosNaoContados = produtos.filter(
    (p) => !skusContadosSet.has(p.codigo_sku.trim().toLowerCase())
  );

  const filtrados = produtosNaoContados.filter(
    (p) =>
      p.codigo_sku.toLowerCase().includes(busca.toLowerCase()) ||
      p.descricao.toLowerCase().includes(busca.toLowerCase())
  );

  const totalCatalogo = produtos.length;
  const totalAuditados = produtos.length - produtosNaoContados.length;
  const percentualCobertura =
    totalCatalogo > 0 ? (totalAuditados / totalCatalogo) * 100 : 100;

  const totalPecasFaltandoNoInventario = produtosNaoContados.reduce(
    (sum, p) => sum + (p.estoque_sistema || 0),
    0
  );
  const valorTotalNaoLocalizado = produtosNaoContados.reduce(
    (sum, p) => sum + (p.estoque_sistema || 0) * (p.custo_unitario || 0),
    0
  );

  const handleConsolidarTodos = async () => {
    if (produtosNaoContados.length === 0) return;
    const confirm = window.confirm(
      `Deseja adicionar todos os ${produtosNaoContados.length} itens não encontrados à sessão com quantidade contada = 0 para formalizar a falta de estoque?`
    );
    if (!confirm) return;

    setLoading(true);
    try {
      await onAddUnscannedAsZero(produtosNaoContados);
      onClose();
    } catch (err) {
      alert('Erro ao consolidar itens: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <PackageX className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Cobertura de Inventário & Ativos Não Bipados</h2>
              <p className="text-xs text-slate-400">
                Itens cadastrados no sistema que ainda não receberam nenhuma leitura nesta sessão
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quadro de Cobertura e Métricas */}
        <div className="p-5 border-b border-slate-800 bg-slate-900/80 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Taxa de Cobertura</span>
              <Percent className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-emerald-400">
                {percentualCobertura.toFixed(1)}%
              </span>
              <span className="text-xs text-slate-500">
                ({totalAuditados} de {totalCatalogo} SKUs)
              </span>
            </div>
            {/* Barra de progresso */}
            <div className="w-full bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${percentualCobertura}%` }}
              />
            </div>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>SKUs Não Localizados</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-amber-400">
                {produtosNaoContados.length}
              </span>
              <span className="text-xs text-slate-500">
                ({totalPecasFaltandoNoInventario} peças teóricas)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Ainda não tiveram bipe físico</p>
          </div>

          <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Impacto Teórico Não Visto</span>
              <TrendingDown className="w-4 h-4 text-rose-400" />
            </div>
            <span className="text-2xl font-black font-mono text-rose-400 block">
              {valorTotalNaoLocalizado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
            <p className="text-[11px] text-slate-500 mt-2">Custo total se não forem encontrados</p>
          </div>
        </div>

        {/* Barra de Busca e Ação de Fechamento */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar SKU ou ativo não bipado..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          {produtosNaoContados.length > 0 && (
            <button
              onClick={handleConsolidarTodos}
              disabled={loading}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer whitespace-nowrap"
            >
              <PlusCircle className="w-4 h-4" />
              {loading ? 'Consolidando...' : `Adicionar Todos como Qtd = 0 (${produtosNaoContados.length})`}
            </button>
          )}
        </div>

        {/* Tabela de Itens */}
        <div className="flex-1 overflow-y-auto p-4">
          {filtrados.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-500/60 mx-auto stroke-[1.5]" />
              <p className="text-sm font-bold text-white">Todos os SKUs do catálogo já foram bipados!</p>
              <p className="text-xs text-slate-400">Cobertura de 100% dos produtos do cadastro nesta sessão.</p>
            </div>
          ) : (
            <div className="border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase tracking-wider font-semibold text-[10px]">
                    <th className="py-3 px-4">Código SKU</th>
                    <th className="py-3 px-4">Descrição Oficial</th>
                    <th className="py-3 px-4 text-center">Ref. Fornecedor</th>
                    <th className="py-3 px-4 text-right">Saldo ERP</th>
                    <th className="py-3 px-4 text-right">Custo Unit.</th>
                    <th className="py-3 px-4 text-right">Impacto Se Ausente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filtrados.map((prod) => {
                    const impacto = (prod.estoque_sistema || 0) * (prod.custo_unitario || 0);
                    return (
                      <tr key={prod.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-amber-400">
                          {prod.codigo_sku}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-200">{prod.descricao}</td>
                        <td className="py-3 px-4 text-center font-mono text-slate-400">
                          {prod.codigo_fornecedor || '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-white">
                          {prod.estoque_sistema} un
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-400">
                          {prod.custo_unitario.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-rose-400">
                          {impacto.toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
