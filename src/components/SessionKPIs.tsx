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

  const acuraciaBarCor =
    acuraciaClamped >= 95
      ? 'bg-green-500'
      : acuraciaClamped >= 85
      ? 'bg-yellow-500'
      : 'bg-red-500';

  const acuraciaTextoCor =
    acuraciaClamped >= 95
      ? 'text-green-400'
      : acuraciaClamped >= 85
      ? 'text-yellow-400'
      : 'text-red-400';

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {/* 1. Total Peças Bipadas */}
      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Total Bipado
          </span>
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
            <PackageCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tabular-nums">
              {resumo.totalPecasBipadas.toLocaleString('pt-BR')}
            </span>
            <span className="text-xs text-gray-500">unidades</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500 pt-2 border-t border-gray-700/50">
            <span>Soma física real</span>
            <span className="text-blue-400 font-medium">100% auditado</span>
          </div>
        </div>
      </div>

      {/* 2. SKUs Únicos */}
      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            SKUs Únicos
          </span>
          <div className="p-1.5 rounded-lg bg-gray-600/20 text-gray-400">
            <Layers className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tabular-nums">
              {resumo.totalSkusContados.toLocaleString('pt-BR')}
            </span>
            <span className="text-xs text-gray-500">itens</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] pt-2 border-t border-gray-700/50">
            <span className="text-green-400">{resumo.totalItensCorretos} s/ erro</span>
            {resumo.totalNaoCadastrados > 0 ? (
              <span className="text-yellow-400 font-medium">+{resumo.totalNaoCadastrados} novos</span>
            ) : (
              <span className="text-gray-500">0 novos</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Divergências */}
      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Divergências
          </span>
          <div
            className={`p-1.5 rounded-lg ${
              resumo.totalItensDivergentes === 0
                ? 'bg-green-500/10 text-green-400'
                : 'bg-red-500/10 text-red-400'
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
              className={`text-2xl font-bold tabular-nums ${
                resumo.totalItensDivergentes === 0 ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {resumo.totalItensDivergentes}
            </span>
            <span className="text-xs text-gray-500">SKUs</span>
          </div>
          <div className="mt-2 flex items-center gap-3 text-[11px] pt-2 border-t border-gray-700/50">
            <span className="text-red-400 flex items-center gap-1">
              <TrendingDown className="w-3 h-3" /> {resumo.totalItensFaltando} falta
            </span>
            <span className="text-gray-600">|</span>
            <span className="text-blue-400 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> {resumo.totalItensSobrando} sobra
            </span>
          </div>
        </div>
      </div>

      {/* 4. Acurácia */}
      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Acurácia
          </span>
          <div className="p-1.5 rounded-lg bg-gray-600/20 text-gray-400">
            <Percent className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-baseline justify-between">
            <span className={`text-2xl font-bold tabular-nums ${acuraciaTextoCor}`}>
              {resumo.acuraciaPercentual.toFixed(1)}%
            </span>
            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-gray-700 text-gray-300">
              {acuraciaClamped >= 95 ? 'Excelente' : acuraciaClamped >= 85 ? 'Atenção' : 'Crítico'}
            </span>
          </div>

          <div className="mt-2 pt-2 border-t border-gray-700/50">
            <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${acuraciaBarCor} transition-all duration-500`}
                style={{ width: `${acuraciaClamped}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 5. Impacto Financeiro */}
      <div className="col-span-2 md:col-span-1 lg:col-span-1 bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Impacto Líquido
          </span>
          <div
            className={`p-1.5 rounded-lg ${
              isFinanceiroPositivo
                ? 'bg-blue-500/10 text-blue-400'
                : 'bg-red-500/10 text-red-400'
            }`}
          >
            <DollarSign className="w-4 h-4" />
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-baseline gap-1">
            <span
              className={`text-xl font-bold tabular-nums truncate ${
                resumo.impactoFinanceiroTotal === 0
                  ? 'text-gray-300'
                  : isFinanceiroPositivo
                  ? 'text-blue-400'
                  : 'text-red-400'
              }`}
            >
              {resumo.impactoFinanceiroTotal > 0 ? '+' : ''}
              {resumo.impactoFinanceiroTotal.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500 pt-2 border-t border-gray-700/50">
            <span>Balanço contábil</span>
            <span
              className={`font-medium ${
                isFinanceiroPositivo ? 'text-blue-400' : 'text-red-400'
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
