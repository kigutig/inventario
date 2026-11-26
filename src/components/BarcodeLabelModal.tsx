import React, { useState } from 'react';
import {
  Barcode,
  Printer,
  X,
  Search,
  CheckSquare,
  Square,
  Tag,
} from 'lucide-react';
import type { ItemInventariado, ProdutoCadastro } from '../types/inventory';
import { generateBarcode128Svg } from '../lib/barcode128';

interface BarcodeLabelModalProps {
  isOpen?: boolean;
  produtos: ProdutoCadastro[];
  itensSessao?: ItemInventariado[];
  onClose: () => void;
}

export const BarcodeLabelModal: React.FC<BarcodeLabelModalProps> = ({
  isOpen = true,
  produtos,
  onClose,
}) => {
  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [copiasPorItem, setCopiasPorItem] = useState<number>(1);

  if (!isOpen) return null;

  const filtrados = produtos.filter(
    (p) =>
      p.codigo_sku.toLowerCase().includes(busca.toLowerCase()) ||
      p.descricao.toLowerCase().includes(busca.toLowerCase())
  );

  const toggleSelect = (sku: string) => {
    setSelecionados((prev) => {
      const copy = new Set(prev);
      if (copy.has(sku)) copy.delete(sku);
      else copy.add(sku);
      return copy;
    });
  };

  const selectAll = () => {
    if (selecionados.size === filtrados.length) {
      setSelecionados(new Set());
    } else {
      setSelecionados(new Set(filtrados.map((p) => p.codigo_sku)));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const itensParaImprimir = produtos.filter((p) => selecionados.has(p.codigo_sku));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm print:p-0 print:bg-white">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl print:border-none print:shadow-none print:max-w-none print:max-h-none print:w-full">
        {/* Topo / Painel de Controle (Oculto na impressão) */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/60 rounded-t-3xl flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Gerador de Etiquetas de Código de Barras</h2>
              <p className="text-xs text-slate-400">Impressão nítida Code 128 compatível com leitor Nonus LW200</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              disabled={itensParaImprimir.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-sky-500/20 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir Etiquetas ({itensParaImprimir.length * copiasPorItem})
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barra de Filtros e Opções (Oculta na impressão) */}
        <div className="p-4 border-b border-slate-800 bg-slate-900 grid grid-cols-1 sm:grid-cols-3 gap-3 print:hidden">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar SKU ou descrição..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400 whitespace-nowrap">Cópias por SKU:</label>
            <input
              type="number"
              min="1"
              max="100"
              value={copiasPorItem}
              onChange={(e) => setCopiasPorItem(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-center font-mono font-bold text-sky-400 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs text-slate-300 hover:text-white px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {selecionados.size === filtrados.length && filtrados.length > 0 ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5 text-sky-400" /> Desmarcar Todos
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5" /> Selecionar Todos ({filtrados.length})
                </>
              )}
            </button>
          </div>
        </div>

        {/* Conteúdo: Seletor à esquerda e Prévia das Etiquetas à direita */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 print:block">
          {/* Coluna 1: Lista de Seleção (Oculta na impressão) */}
          <div className="md:col-span-5 border-r border-slate-800 overflow-y-auto p-3 space-y-1.5 print:hidden bg-slate-950/40">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1">
              Catálogo de Produtos ({filtrados.length})
            </p>
            {filtrados.length === 0 ? (
              <p className="text-xs text-slate-500 p-4 text-center">Nenhum produto encontrado.</p>
            ) : (
              filtrados.map((p) => {
                const isSelected = selecionados.has(p.codigo_sku);
                return (
                  <div
                    key={p.id}
                    onClick={() => toggleSelect(p.codigo_sku)}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-sky-500/10 border-sky-500/40 text-slate-100'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="mt-0.5 rounded border-slate-700 text-sky-500 focus:ring-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-sky-400">{p.codigo_sku}</span>
                        <span className="text-[10px] text-slate-500 font-mono">Saldo: {p.estoque_sistema}</span>
                      </div>
                      <p className="truncate text-[11px] text-slate-300 mt-0.5">{p.descricao}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Coluna 2: Prévia das Etiquetas Prontas para Impressão */}
          <div className="md:col-span-7 overflow-y-auto p-4 sm:p-6 bg-slate-950 print:p-0 print:overflow-visible print:bg-white print:w-full">
            <div className="flex items-center justify-between mb-3 print:hidden">
              <span className="text-xs text-slate-400 font-medium">
                Prévia de Impressão: <strong className="text-white">{itensParaImprimir.length * copiasPorItem} etiquetas</strong>
              </span>
            </div>

            {itensParaImprimir.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-2xl text-slate-500">
                <Barcode className="w-12 h-12 stroke-[1.5] text-slate-700 mb-2" />
                <p className="text-xs">Selecione um ou mais produtos ao lado para gerar as etiquetas.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 print:grid-cols-2 print:gap-2">
                {itensParaImprimir.flatMap((prod) =>
                  Array.from({ length: copiasPorItem }).map((_, idx) => (
                    <div
                      key={`${prod.codigo_sku}-${idx}`}
                      className="p-3 bg-white border border-slate-300 rounded-lg shadow-sm text-slate-900 flex flex-col items-center text-center page-break-inside-avoid print:border-slate-400"
                    >
                      <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase block w-full truncate">
                        PATRIMÔNIO // ATIVO INDUSTRIAL
                      </span>
                      <p className="text-xs font-black text-slate-900 line-clamp-1 mt-0.5 w-full">
                        {prod.descricao}
                      </p>
                      <div
                        className="my-1.5 flex justify-center"
                        dangerouslySetInnerHTML={{
                          __html: generateBarcode128Svg(prod.codigo_sku, 190, 48, true),
                        }}
                      />
                      <div className="w-full flex items-center justify-between text-[9px] font-mono text-slate-600 border-t border-slate-200 pt-1 mt-1">
                        <span>REF: {prod.codigo_fornecedor || 'S/N'}</span>
                        <span>CONTROLE DE ATIVOS</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
