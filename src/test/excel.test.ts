import { describe, it, expect, vi } from 'vitest';
import * as XLSX from 'xlsx';
import {
  importarPlanilhaProdutos,
  exportarRelatorioInventario,
  baixarModeloPlanilha,
} from '../lib/excel';
import type { ItemInventariado, SessaoInventario } from '../types/inventory';

describe('Manipulação de Excel e Planilhas (SheetJS / XLSX)', () => {
  it('deve importar planilha preservando rigorosamente zeros à esquerda nos códigos SKU', async () => {
    const dadosTeste = [
      {
        'Código': '002NA01AC',
        'Descrição': 'LEG PRESS 45 GRAUS ARTICULADO',
        'Código Fornecedor': 'ALP902',
        'Estoque': 8,
        'Custo': '7.200,50',
      },
      {
        'Código': '010KB88',
        'Descrição': 'ESTEIRA ERGOMÉTRICA PROFISSIONAL',
        'Código Fornecedor': 'EST441',
        'Estoque': '15',
        'Custo': 12900,
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dadosTeste);
    XLSX.utils.book_append_sheet(wb, ws, 'Dados');
    const u8 = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const file = new File([u8], 'teste_zeros.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const resultado = await importarPlanilhaProdutos(file);

    expect(resultado.totalValidos).toBe(2);
    expect(resultado.produtos[0].codigo_sku).toBe('002NA01AC');
    expect(resultado.produtos[0].estoque_sistema).toBe(8);
    expect(resultado.produtos[0].custo_unitario).toBe(7200.5);

    expect(resultado.produtos[1].codigo_sku).toBe('010KB88');
    expect(resultado.produtos[1].estoque_sistema).toBe(15);
  });

  it('deve adicionar itens sem código gerando SKU sequencial automático (AUTO_0001)', async () => {
    const dadosSemCodigo = [
      {
        'Código': '',
        'Descrição': 'HALTER 10KG SEM CODIGO ORIGINAL',
        'Estoque': 20,
        'Custo': 150.0,
      },
      {
        'Código': '205N51',
        'Descrição': 'PUXADA ALTA CONVERGENTE',
        'Estoque': 12,
        'Custo': 4850.0,
      },
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dadosSemCodigo);
    XLSX.utils.book_append_sheet(wb, ws, 'Itens');
    const u8 = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const file = new File([u8], 'sem_codigo.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const resultado = await importarPlanilhaProdutos(file);

    expect(resultado.totalValidos).toBe(2);
    expect(resultado.produtos[0].codigo_sku).toBe('AUTO_0001');
    expect(resultado.produtos[0].descricao).toBe('HALTER 10KG SEM CODIGO ORIGINAL');
    expect(resultado.produtos[1].codigo_sku).toBe('205N51');
    expect(resultado.erros.length).toBeGreaterThan(0);
  });

  it('deve exportar relatório de inventário em XLSX e CSV com resumo executivo sem falhas', () => {
    const sessaoMock: SessaoInventario = {
      id: 'sessao-1',
      nome: 'Auditoria Galpão A',
      status: 'finalizado',
      created_at: new Date().toISOString(),
      finalizado_at: new Date().toISOString(),
    };

    const itensMock: ItemInventariado[] = [
      {
        id: 'item-1',
        sessao_id: 'sessao-1',
        codigo_sku: '205N51',
        descricao_snapshot: 'PUXADA ALTA CONVERGENTE',
        quantidade_contada: 14,
        estoque_sistema_snapshot: 12,
        custo_unitario_snapshot: 4850.0,
        cadastrado_no_sistema: true,
        ultima_leitura_at: new Date().toISOString(),
      },
      {
        id: 'item-2',
        sessao_id: 'sessao-1',
        codigo_sku: '002NA01AC',
        descricao_snapshot: 'LEG PRESS 45',
        quantidade_contada: 6,
        estoque_sistema_snapshot: 8,
        custo_unitario_snapshot: 7200.0,
        cadastrado_no_sistema: true,
        ultima_leitura_at: new Date().toISOString(),
      },
    ];

    // Mock seguro para cliques e URLs de download no DOM
    const clickMock = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickMock);
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    window.URL.revokeObjectURL = vi.fn();

    // Exportação CSV
    expect(() => exportarRelatorioInventario(sessaoMock, itensMock, 'csv')).not.toThrow();
    expect(clickMock).toHaveBeenCalled();

    // Exportação XLSX e Modelo (execução em ambiente jsdom)
    expect(() => exportarRelatorioInventario(sessaoMock, itensMock, 'xlsx')).not.toThrow();
    expect(() => baixarModeloPlanilha()).not.toThrow();
  });
});
