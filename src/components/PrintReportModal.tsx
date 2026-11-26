import React from 'react';
import {
  Printer,
  X,
  FileCheck2,
  AlertCircle,
  Building2,
} from 'lucide-react';
import type { ItemInventariado, ResumoSessao, SessaoInventario } from '../types/inventory';

interface PrintReportModalProps {
  isOpen?: boolean;
  sessao: SessaoInventario;
  itens: ItemInventariado[];
  resumo: ResumoSessao;
  auditorEmail?: string;
  onClose: () => void;
}

export const PrintReportModal: React.FC<PrintReportModalProps> = ({
  isOpen = true,
  sessao,
  itens,
  resumo,
  auditorEmail,
  onClose,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const divergencias = itens.filter(
    (i) => i.quantidade_contada !== i.estoque_sistema_snapshot || !i.cadastrado_no_sistema
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm print:p-0 print:bg-white">
      {/* Botões superiores na tela (ocultos na impressão) */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl print:border-none print:shadow-none print:max-w-none print:max-h-none print:w-full">
        <div className="flex items-center justify-between p-4 border-b border-slate-800 print:hidden bg-slate-950/50 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Relatório Oficial de Auditoria Física</h2>
              <p className="text-xs text-slate-400">Visualização de impressão formal de fechamento de inventário</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir Relatório (Ctrl + P)
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* DOCUMENTO IMPRESSO (A4 FORMAT) */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 text-slate-900 bg-white print:p-0 print:overflow-visible">
          {/* Cabeçalho Corporativo */}
          <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Building2 className="w-6 h-6 text-slate-900" />
                <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">
                  Relatório de Auditoria de Ativos e Inventário Físico
                </h1>
              </div>
              <p className="text-xs text-slate-600 font-mono">
                SISTEMA INDUSTRIAL NONUS LW200 // AUDIT.BARCODE
              </p>
            </div>
            <div className="text-right text-xs text-slate-600 space-y-0.5">
              <p className="font-bold text-slate-900">Data de Emissão: {new Date().toLocaleDateString('pt-BR')}</p>
              <p>Hora: {new Date().toLocaleTimeString('pt-BR')}</p>
              <span className="inline-block px-2 py-0.5 mt-1 rounded bg-slate-100 font-mono font-bold text-[10px] text-slate-800 border border-slate-300">
                STATUS: {sessao.status.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Dados da Sessão */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Identificação da Sessão</span>
              <p className="font-bold text-slate-900">{sessao.nome}</p>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Data de Início</span>
              <p className="font-mono text-slate-800">{new Date(sessao.created_at).toLocaleString('pt-BR')}</p>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Data de Conclusão</span>
              <p className="font-mono text-slate-800">
                {sessao.finalizado_at ? new Date(sessao.finalizado_at).toLocaleString('pt-BR') : 'Em Andamento'}
              </p>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Acurácia Global</span>
              <p className="font-bold text-emerald-700 text-sm">{resumo.acuraciaPercentual.toFixed(1)}%</p>
            </div>
          </div>

          {/* Quadro Executivo de Indicadores */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            <div className="p-3 border border-slate-300 rounded text-center bg-slate-50/50">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Total de Peças Físicas</span>
              <span className="text-lg font-black font-mono text-slate-900">{resumo.totalPecasBipadas}</span>
            </div>
            <div className="p-3 border border-slate-300 rounded text-center bg-slate-50/50">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">SKUs Auditados</span>
              <span className="text-lg font-black font-mono text-slate-900">{resumo.totalSkusContados}</span>
            </div>
            <div className="p-3 border border-slate-300 rounded text-center bg-slate-50/50">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Itens com Divergência</span>
              <span className="text-lg font-black font-mono text-rose-600">{resumo.totalItensDivergentes}</span>
            </div>
            <div className="p-3 border border-slate-300 rounded text-center bg-slate-50/50">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Balanço Financeiro (R$)</span>
              <span className={`text-lg font-black font-mono ${resumo.impactoFinanceiroTotal >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                {resumo.impactoFinanceiroTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>

          {/* Tabela de Divergências */}
          <div className="space-y-2 mb-8">
            <div className="flex items-center justify-between border-b border-slate-300 pb-1">
              <h3 className="text-xs font-black uppercase text-slate-900 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                Itens com Divergência e Pendências ({divergencias.length})
              </h3>
              <span className="text-[10px] text-slate-500">Exibindo apenas itens com diferença de saldo</span>
            </div>

            {divergencias.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded">
                Nenhuma divergência encontrada. Inventário 100% equilibrado com o sistema ERP.
              </div>
            ) : (
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-y border-slate-300 text-slate-700 font-bold text-left">
                    <th className="py-1.5 px-2">Código SKU</th>
                    <th className="py-1.5 px-2">Descrição do Ativo</th>
                    <th className="py-1.5 px-2 text-right">Teórico</th>
                    <th className="py-1.5 px-2 text-right">Físico</th>
                    <th className="py-1.5 px-2 text-center">Divergência</th>
                    <th className="py-1.5 px-2 text-right">Custo Unit.</th>
                    <th className="py-1.5 px-2 text-right">Impacto (R$)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {divergencias.map((item) => {
                    const diff = item.quantidade_contada - item.estoque_sistema_snapshot;
                    const impacto = diff * item.custo_unitario_snapshot;
                    return (
                      <tr key={item.id} className="text-slate-800">
                        <td className="py-1.5 px-2 font-mono font-bold">{item.codigo_sku}</td>
                        <td className="py-1.5 px-2">
                          {item.descricao_snapshot}
                          {!item.cadastrado_no_sistema && (
                            <span className="ml-1 text-[9px] text-amber-700 font-bold uppercase">[Não Cadastrado]</span>
                          )}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono">{item.estoque_sistema_snapshot}</td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold">{item.quantidade_contada}</td>
                        <td className="py-1.5 px-2 text-center font-mono font-bold">
                          <span className={diff > 0 ? 'text-emerald-700' : 'text-rose-700'}>
                            {diff > 0 ? `+${diff} (Sobra)` : `${diff} (Falta)`}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono">
                          {item.custo_unitario_snapshot.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className={`py-1.5 px-2 text-right font-mono font-bold ${impacto >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {impacto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Campo Formal de Assinaturas */}
          <div className="mt-12 pt-8 border-t border-slate-300 grid grid-cols-2 gap-12 text-center text-xs">
            <div className="space-y-1">
              <div className="border-b border-slate-400 w-3/4 mx-auto mb-2" />
              <p className="font-bold text-slate-900">Auditor Responsável da Contagem</p>
              <p className="text-[10px] text-slate-500 font-mono">{auditorEmail || 'Assinatura / Matrícula'}</p>
            </div>
            <div className="space-y-1">
              <div className="border-b border-slate-400 w-3/4 mx-auto mb-2" />
              <p className="font-bold text-slate-900">Gerência de Operações / Controladoria</p>
              <p className="text-[10px] text-slate-500 font-mono">Visto e Homologação</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
