import { describe, it, expect, beforeEach } from 'vitest';
import {
  listarProdutos,
  salvarProduto,
  excluirProduto,
  salvarProdutosEmLote,
  limparTodosProdutos,
  listarSessoes,
  criarSessao,
  renomearSessao,
  finalizarSessao,
  reabrirSessao,
  excluirSessao,
  registrarLeitura,
  ajustarQuantidade,
  listarItensInventariados,
} from '../services/inventoryService';

describe('InventoryService (Lógica de Negócios e Operações Atômicas)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('deve listar produtos do cadastro', async () => {
    // Garante que existe pelo menos um produto para o teste
    await salvarProduto({
      codigo_sku: 'SKU_TESTE_LISTAGEM',
      descricao: 'Item para Teste de Listagem',
      estoque_sistema: 10,
      custo_unitario: 100,
    });

    const produtos = await listarProdutos();
    expect(produtos.length).toBeGreaterThan(0);
    expect(produtos.some((p) => p.codigo_sku === 'SKU_TESTE_LISTAGEM')).toBe(true);
  });

  it('deve salvar e atualizar produtos manualmente', async () => {
    const novoProduto = await salvarProduto({
      codigo_sku: 'NOVA_MAQUINA_01',
      descricao: 'CROSSOVER PROFISSIONAL TESTE',
      estoque_sistema: 5,
      custo_unitario: 8900.0,
    });

    expect(novoProduto.codigo_sku).toBe('NOVA_MAQUINA_01');

    // Atualização do mesmo produto
    const atualizado = await salvarProduto({
      codigo_sku: 'NOVA_MAQUINA_01',
      descricao: 'CROSSOVER PROFISSIONAL ATUALIZADO',
      estoque_sistema: 7,
      custo_unitario: 9200.0,
    });

    expect(atualizado.descricao).toBe('CROSSOVER PROFISSIONAL ATUALIZADO');
    expect(atualizado.estoque_sistema).toBe(7);
  });

  it('deve excluir produto e limpar base', async () => {
    const prod = await salvarProduto({
      codigo_sku: 'DELETAR_01',
      descricao: 'Item para deletar',
      estoque_sistema: 1,
      custo_unitario: 10,
    });

    await excluirProduto(prod.id);
    const listaAposExcluir = await listarProdutos();
    expect(listaAposExcluir.some((p) => p.codigo_sku === 'DELETAR_01')).toBe(false);

    await limparTodosProdutos();
    const listaVazia = await listarProdutos();
    expect(listaVazia.length).toBe(0);
  });

  it('deve processar lote de produtos deduplicando SKUs repetidos', async () => {
    const lote = [
      { codigo_sku: 'SKU_LOTE_A', descricao: 'Item A V1', estoque_sistema: 10, custo_unitario: 100 },
      { codigo_sku: 'SKU_LOTE_A', descricao: 'Item A V2 Atualizado', estoque_sistema: 15, custo_unitario: 110 },
      { codigo_sku: 'SKU_LOTE_B', descricao: 'Item B', estoque_sistema: 5, custo_unitario: 50 },
    ];

    const res = await salvarProdutosEmLote(lote);
    expect(res.inseridos + res.atualizados).toBe(2); // Unificado em 2 produtos únicos

    const produtos = await listarProdutos();
    const itemA = produtos.find((p) => p.codigo_sku === 'SKU_LOTE_A');
    expect(itemA?.descricao).toBe('Item A V2 Atualizado');
    expect(itemA?.estoque_sistema).toBe(15);
  });

  it('deve gerenciar o ciclo de vida completo de sessões (criar, renomear, finalizar, reabrir, excluir)', async () => {
    const sessao = await criarSessao('Galpão Caldeiraria 2026');
    expect(sessao.status).toBe('em_andamento');

    await renomearSessao(sessao.id, 'Galpão Caldeiraria & Usinagem 2026');
    let sessoes = await listarSessoes();
    expect(sessoes.find((s) => s.id === sessao.id)?.nome).toBe('Galpão Caldeiraria & Usinagem 2026');

    await finalizarSessao(sessao.id);
    sessoes = await listarSessoes();
    expect(sessoes.find((s) => s.id === sessao.id)?.status).toBe('finalizado');

    await reabrirSessao(sessao.id);
    sessoes = await listarSessoes();
    expect(sessoes.find((s) => s.id === sessao.id)?.status).toBe('em_andamento');

    await excluirSessao(sessao.id);
    sessoes = await listarSessoes();
    expect(sessoes.some((s) => s.id === sessao.id)).toBe(false);
  });

  it('deve registrar bipe atômico incrementando quantidade contada', async () => {
    // Garante produto de teste cadastrado
    await salvarProduto({
      codigo_sku: 'UNIT_TEST_SKU_CAD',
      descricao: 'Item Unit Test',
      estoque_sistema: 12,
      custo_unitario: 4850.0,
    });

    const sessao = await criarSessao('Sessao Mock Test');

    // Primeiro bipe de SKU cadastrado
    const r1 = await registrarLeitura(sessao.id, 'UNIT_TEST_SKU_CAD');
    expect(r1.sucesso).toBe(true);
    expect(r1.cadastrado).toBe(true);
    expect(r1.item.quantidade_contada).toBe(1);

    // Segundo bipe do mesmo SKU
    const r2 = await registrarLeitura(sessao.id, 'UNIT_TEST_SKU_CAD');
    expect(r2.item.quantidade_contada).toBe(2);

    // Bipe de SKU não cadastrado
    const r3 = await registrarLeitura(sessao.id, 'UNIT_TEST_SKU_NAO_CAD');
    expect(r3.cadastrado).toBe(false);
    expect(r3.item.quantidade_contada).toBe(1);
    expect(r3.item.cadastrado_no_sistema).toBe(false);

    // Ajuste manual (+1)
    const ajustado = await ajustarQuantidade(r1.item.id, sessao.id, 1);
    expect(ajustado.quantidade_contada).toBe(3);

    const itens = await listarItensInventariados(sessao.id);
    expect(itens.length).toBe(2);
  });
});
