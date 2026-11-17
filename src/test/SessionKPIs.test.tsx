import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SessionKPIs } from '../components/SessionKPIs';
import type { ResumoSessao } from '../types/inventory';

describe('<SessionKPIs />', () => {
  it('deve renderizar os indicadores de inventário com precisão', () => {
    const resumoMock: ResumoSessao = {
      totalPecasBipadas: 48,
      totalSkusContados: 10,
      totalItensDivergentes: 3,
      totalItensCorretos: 7,
      totalItensFaltando: 2,
      totalItensSobrando: 1,
      totalNaoCadastrados: 1,
      impactoFinanceiroTotal: -1850.5,
      acuraciaPercentual: 70.0,
    };

    render(<SessionKPIs resumo={resumoMock} />);

    // Total Bipado
    expect(screen.getByText('48')).toBeInTheDocument();
    expect(screen.getByText('unidades')).toBeInTheDocument();

    // SKUs Únicos
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText(/7 s\/ erro/)).toBeInTheDocument();

    // Divergências
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/2 falta/)).toBeInTheDocument();
    expect(screen.getByText(/1 sobra/)).toBeInTheDocument();

    // Acurácia %
    expect(screen.getByText('70.0%')).toBeInTheDocument();

    // Balanço Financeiro
    expect(screen.getByText(/-R\$\s*1\.850,50/)).toBeInTheDocument();
  });

  it('deve formatar balanço positivo com sinal de mais (+)', () => {
    const resumoPositivo: ResumoSessao = {
      totalPecasBipadas: 10,
      totalSkusContados: 2,
      totalItensDivergentes: 1,
      totalItensCorretos: 1,
      totalItensFaltando: 0,
      totalItensSobrando: 1,
      totalNaoCadastrados: 0,
      impactoFinanceiroTotal: 4850.0,
      acuraciaPercentual: 50.0,
    };

    render(<SessionKPIs resumo={resumoPositivo} />);
    expect(screen.getByText(/\+R\$\s*4\.850,00/)).toBeInTheDocument();
  });
});
