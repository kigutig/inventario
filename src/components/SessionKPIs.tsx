import React from 'react';
import {
  PackageCheck,
  Layers,
  AlertOctagon,
  Percent,
  TrendingDown,
  TrendingUp,
  DollarSign,
  CheckCircle2,
} from 'lucide-react';
import type { ResumoSessao } from '../types/inventory';

interface SessionKPIsProps {
  resumo: ResumoSessao;
}

export const SessionKPIs: React.FC<SessionKPIsProps> = ({ resumo }) => {
  const isFinanceiroPositivo = resumo.impactoFinanceiroTotal >= 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {/* 1. Total Peças Bipadas */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Total Bipado
          </span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
            <PackageCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-black text-white font-mono">
            {resumo.totalPecasBipadas}
          </span>
          <span className="text-xs text-slate-400 font-medium">unidades</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">Soma física de bipes</p>
      </div>

      {/* 2. SKUs Únicos */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            SKUs Únicos
          </span>
          <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
            <Layers className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-black text-white font-mono">
            {resumo.totalSkusContados}
          </span>
          <span className="text-xs text-slate-400 font-medium">itens</span>
        </div>
        <div className="flex items-center gap-2 mt-1 text-[11px]">
          <span className="text-emerald-400">{resumo.totalItensCorretos} s/ erro</span>
          {resumo.totalNaoCadastrados > 0 && (
            <span className="text-amber-400 font-semibold">({resumo.totalNaoCadastrados} novos)</span>
          )}
        </div>
      </div>

      {/* 3. Divergências (Falta vs Sobra) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Divergências
          </span>
          <div
            className={`p-2 rounded-xl ${
              resumo.totalItensDivergentes === 0
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-rose-500/10 text-rose-400'
            }`}
          >
            {resumo.totalItensDivergentes === 0 ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertOctagon className="w-4 h-4" />
            )}
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span
            className={`text-2xl sm:text-3xl font-black font-mono ${
              resumo.totalItensDivergentes === 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {resumo.totalItensDivergentes}
          </span>
          <span className="text-xs text-slate-400 font-medium">SKUs</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
          <span className="text-rose-400 flex items-center gap-0.5">
            <TrendingDown className="w-3 h-3" /> {resumo.totalItensFaltando} falta
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-sky-400 flex items-center gap-0.5">
            <TrendingUp className="w-3 h-3" /> {resumo.totalItensSobrando} sobra
          </span>
        </div>
      </div>

      {/* 4. Acurácia % */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Acurácia
          </span>
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
            <Percent className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span
            className={`text-2xl sm:text-3xl font-black font-mono ${
              resumo.acuraciaPercentual >= 95
                ? 'text-emerald-400'
                : resumo.acuraciaPercentual >= 85
                ? 'text-amber-400'
                : 'text-rose-400'
            }`}
          >
            {resumo.acuraciaPercentual.toFixed(1)}%
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">Conformidade com o ERP</p>
      </div>

      {/* 5. Balanço Financeiro */}
      <div className="col-span-2 md:col-span-1 lg:col-span-1 bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Balanço Financeiro
          </span>
          <div
            className={`p-2 rounded-xl ${
              isFinanceiroPositivo ? 'bg-sky-500/10 text-sky-400' : 'bg-rose-500/10 text-rose-400'
            }`}
          >
            <DollarSign className="w-4 h-4" />
          </div>
        </div>
        <div className="mt-2">
          <span
            className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${
              resumo.impactoFinanceiroTotal === 0
                ? 'text-slate-200'
                : isFinanceiroPositivo
                ? 'text-sky-400'
                : 'text-rose-400'
            }`}
          >
            {resumo.impactoFinanceiroTotal > 0 ? '+' : ''}
            {resumo.impactoFinanceiroTotal.toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">Impacto monetário líquido</p>
      </div>
    </div>
  );
};
