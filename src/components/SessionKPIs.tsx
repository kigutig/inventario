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
  const acuraciaClamped = Math.min(100, Math.max(0, resumo.acuraciaPercentual));

  const acuraciaCor =
    acuraciaClamped >= 95
      ? 'from-emerald-500 to-teal-400'
      : acuraciaClamped >= 85
      ? 'from-amber-500 to-yellow-400'
      : 'from-rose-500 to-red-400';

  const acuraciaTextoCor =
    acuraciaClamped >= 95
      ? 'text-emerald-400'
      : acuraciaClamped >= 85
      ? 'text-amber-400'
      : 'text-rose-400';

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
      {/* 1. Total Peças Bipadas */}
      <div className="enterprise-card rounded-2xl p-4 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between group">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Total Bipado
          </span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:scale-105 transition-transform">
            <PackageCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
              {resumo.totalPecasBipadas.toLocaleString('pt-BR')}
            </span>
            <span className="text-xs text-slate-400 font-medium">unidades</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
            <span>Soma física real</span>
            <span className="text-emerald-400 font-mono font-medium">100% auditado</span>
          </div>
        </div>
      </div>

      {/* 2. SKUs Únicos */}
      <div className="enterprise-card rounded-2xl p-4 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between group">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            SKUs Únicos
          </span>
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 group-hover:scale-105 transition-transform">
            <Layers className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
              {resumo.totalSkusContados.toLocaleString('pt-BR')}
            </span>
            <span className="text-xs text-slate-400 font-medium">itens</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] pt-2 border-t border-slate-800/80">
            <span className="text-emerald-400 font-mono">{resumo.totalItensCorretos} s/ erro</span>
            {resumo.totalNaoCadastrados > 0 ? (
              <span className="text-amber-400 font-bold font-mono">+{resumo.totalNaoCadastrados} novos</span>
            ) : (
              <span className="text-slate-400 font-mono">0 novos</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Divergências (Falta vs Sobra) */}
      <div className="enterprise-card rounded-2xl p-4 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between group">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                resumo.totalItensDivergentes === 0 ? 'bg-emerald-400' : 'bg-rose-400'
              }`}
            />
            Divergências
          </span>
          <div
            className={`p-2 rounded-xl border group-hover:scale-105 transition-transform ${
              resumo.totalItensDivergentes === 0
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}
          >
            {resumo.totalItensDivergentes === 0 ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertOctagon className="w-4 h-4" />
            )}
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                resumo.totalItensDivergentes === 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {resumo.totalItensDivergentes}
            </span>
            <span className="text-xs text-slate-400 font-medium">SKUs</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px] pt-2 border-t border-slate-800/80">
            <span className="text-rose-400 font-mono font-medium flex items-center gap-1">
              <TrendingDown className="w-3 h-3" /> {resumo.totalItensFaltando} falta
            </span>
            <span className="text-slate-700">|</span>
            <span className="text-sky-400 font-mono font-medium flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> {resumo.totalItensSobrando} sobra
            </span>
          </div>
        </div>
      </div>

      {/* 4. Acurácia % com Barra Visual */}
      <div className="enterprise-card rounded-2xl p-4 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between group">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            Acurácia
          </span>
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:scale-105 transition-transform">
            <Percent className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-baseline justify-between">
            <span className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${acuraciaTextoCor}`}>
              {resumo.acuraciaPercentual.toFixed(1)}%
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {acuraciaClamped >= 95 ? 'Excelente' : acuraciaClamped >= 85 ? 'Atenção' : 'Crítico'}
            </span>
          </div>

          {/* Barra de progresso visual */}
          <div className="mt-2 pt-2 border-t border-slate-800/80">
            <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${acuraciaCor} transition-all duration-500`}
                style={{ width: `${acuraciaClamped}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 5. Balanço Financeiro Líquido */}
      <div className="col-span-2 md:col-span-1 lg:col-span-1 enterprise-card rounded-2xl p-4 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between group">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isFinanceiroPositivo ? 'bg-sky-400' : 'bg-rose-400'}`} />
            Impacto Líquido
          </span>
          <div
            className={`p-2 rounded-xl border group-hover:scale-105 transition-transform ${
              isFinanceiroPositivo
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}
          >
            <DollarSign className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-baseline gap-1">
            <span
              className={`text-xl sm:text-2xl font-black font-mono tracking-tight truncate ${
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
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
            <span>Balanço contábil</span>
            <span
              className={`font-mono font-bold ${
                isFinanceiroPositivo ? 'text-sky-400' : 'text-rose-400'
              }`}
            >
              {resumo.impactoFinanceiroTotal > 0 ? 'Sobra' : resumo.impactoFinanceiroTotal < 0 ? 'Falta' : 'Equilibrado'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
