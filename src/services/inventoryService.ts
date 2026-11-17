import { getSupabase } from '../lib/supabase';
import type { ItemInventariado, LogLeitura, ProdutoCadastro, SessaoInventario } from '../types/inventory';

// Chaves do LocalStorage para modo demonstração/offline
const LS_PRODUTOS = 'inv_demo_produtos';
const LS_SESSOES = 'inv_demo_sessoes';
const LS_ITENS = 'inv_demo_itens';
const LS_LOGS = 'inv_demo_logs';

function toValidUuidOrNull(val?: string | null): string | null {
  if (!val) return null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
  return isUuid ? val : null;
}

// Dados semente para teste imediato
const PRODUTOS_DEMO: ProdutoCadastro[] = [
  {
    id: 'p1',
    codigo_sku: '205N51',
    descricao: 'PUXADA ALTA CONVERGENTE - ALL FIT IRON',
    codigo_fornecedor: 'XVD038',
    estoque_sistema: 12,
    custo_unitario: 4850.0,
    created_at: new Date().toISOString(),
  },
  {
    id: 'p2',
    codigo_sku: '002NA01AC',
    descricao: 'LEG PRESS 45 GRAUS ARTICULADO - LINHA PRO',
    codigo_fornecedor: 'ALP902',
    estoque_sistema: 8,
    custo_unitario: 7200.0,
    created_at: new Date().toISOString(),
  },
  {
    id: 'p3',
    codigo_sku: '010KB88',
    descricao: 'ESTEIRA ERGOMÉTRICA PROFISSIONAL ELETRÔNICA T9',
    codigo_fornecedor: 'EST441',
    estoque_sistema: 15,
    custo_unitario: 12900.0,
    created_at: new Date().toISOString(),
  },
  {
    id: 'p4',
    codigo_sku: '440M22',
    descricao: 'SUPINO RETO OLÍMPICO REFORÇADO COM TRAVA',
    codigo_fornecedor: 'SUP110',
    estoque_sistema: 6,
    custo_unitario: 2600.0,
    created_at: new Date().toISOString(),
  },
  {
    id: 'p5',
    codigo_sku: '771X09',
    descricao: 'CROSSOVER ANGULAR COM REGULAGEM DE CABO DUPLO',
    codigo_fornecedor: 'CAB882',
    estoque_sistema: 4,
    custo_unitario: 11400.0,
    created_at: new Date().toISOString(),
  },
  {
    id: 'p6',
    codigo_sku: '102DF33',
    descricao: 'BANCO REGULÁVEL INCLINADO/DECLINADO 0-90°',
    codigo_fornecedor: 'BNC001',
    estoque_sistema: 20,
    custo_unitario: 1450.0,
    created_at: new Date().toISOString(),
  },
];

function initLocalDemo() {
  if (!localStorage.getItem(LS_PRODUTOS)) {
    localStorage.setItem(LS_PRODUTOS, JSON.stringify(PRODUTOS_DEMO));
  }
  if (!localStorage.getItem(LS_SESSOES)) {
    const defaultSessao: SessaoInventario = {
      id: 'sessao-demo-principal',
      nome: 'Inventário Geral - Galpão Principal e Maquinários',
      status: 'em_andamento',
      created_at: new Date().toISOString(),
    };
    localStorage.setItem(LS_SESSOES, JSON.stringify([defaultSessao]));
  }
}

initLocalDemo();

// ==============================================================================
// PRODUTOS (produtos_cadastro)
// ==============================================================================
export async function listarProdutos(): Promise<ProdutoCadastro[]> {
  const supabase = getSupabase();
  if (supabase) {
    // Paginação para carregar mais de 1000 itens se necessário
    const todos: ProdutoCadastro[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('produtos_cadastro')
        .select('*')
        .order('codigo_sku', { ascending: true })
        .range(from, from + step - 1);

      if (error) throw error;
      if (data && data.length > 0) {
        todos.push(...data);
        if (data.length < step) {
          hasMore = false;
        } else {
          from += step;
        }
      } else {
        hasMore = false;
      }
    }
    return todos;
  }

  // Fallback Local
  const json = localStorage.getItem(LS_PRODUTOS);
  return json ? JSON.parse(json) : [];
}

export async function salvarProduto(prod: Partial<ProdutoCadastro>): Promise<ProdutoCadastro> {
  const sku = (prod.codigo_sku || '').trim();
  if (!sku) throw new Error('Código SKU é obrigatório');
  if (!prod.descricao) throw new Error('Descrição é obrigatória');

  const payload = {
    codigo_sku: sku,
    descricao: prod.descricao.trim(),
    codigo_fornecedor: prod.codigo_fornecedor ? prod.codigo_fornecedor.trim() : null,
    estoque_sistema: Number(prod.estoque_sistema || 0),
    custo_unitario: Number(prod.custo_unitario || 0),
    updated_at: new Date().toISOString(),
  };

  const supabase = getSupabase();
  if (supabase) {
    // 1. Tenta atualizar primeiro caso já exista
    const { data: updated } = await supabase
      .from('produtos_cadastro')
      .update(payload)
      .eq('codigo_sku', sku)
      .select()
      .maybeSingle();

    if (updated) {
      return updated;
    }

    // 2. Se não encontrou para atualizar, insere
    const { data: inserted, error: insertErr } = await supabase
      .from('produtos_cadastro')
      .insert(payload)
      .select()
      .single();

    if (insertErr) {
      // Se deu 409 (concorrência / duplicate key), faz o update como fallback
      if (insertErr.code === '23505' || insertErr.message?.includes('duplicate key') || insertErr.message?.includes('violates unique')) {
        const { data: retryUpdated } = await supabase
          .from('produtos_cadastro')
          .update(payload)
          .eq('codigo_sku', sku)
          .select()
          .single();
        if (retryUpdated) return retryUpdated;
      }
      throw insertErr;
    }

    return inserted;
  }

  // Fallback Local
  const lista = await listarProdutos();
  const index = lista.findIndex((p) => p.codigo_sku.toLowerCase() === sku.toLowerCase());

  const novo: ProdutoCadastro = {
    id: prod.id || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    codigo_sku: sku,
    descricao: prod.descricao,
    codigo_fornecedor: prod.codigo_fornecedor || undefined,
    estoque_sistema: Number(prod.estoque_sistema || 0),
    custo_unitario: Number(prod.custo_unitario || 0),
    updated_at: new Date().toISOString(),
    created_at: prod.created_at || new Date().toISOString(),
  };

  if (index >= 0) {
    lista[index] = { ...lista[index], ...novo };
  } else {
    lista.push(novo);
  }
  localStorage.setItem(LS_PRODUTOS, JSON.stringify(lista));
  return novo;
}

export async function salvarProdutosEmLote(
  produtos: Omit<ProdutoCadastro, 'id'>[]
): Promise<{ inseridos: number; atualizados: number }> {
  const supabase = getSupabase();

  // Deduplicação na memória antes de processar:
  // Se a planilha tiver o mesmo SKU repetido, unifica para não gerar 409
  const mapaDeduplicado = new Map<string, Omit<ProdutoCadastro, 'id'>>();
  produtos.forEach((p) => {
    const skuKey = p.codigo_sku.trim().toLowerCase();
    mapaDeduplicado.set(skuKey, {
      ...p,
      codigo_sku: p.codigo_sku.trim(),
      descricao: p.descricao.trim(),
    });
  });

  const listaDeduplicada = Array.from(mapaDeduplicado.values());

  if (supabase) {
    let inseridos = 0;
    let atualizados = 0;

    // Processamento seguro em chunks de 50
    const chunkSize = 50;
    for (let i = 0; i < listaDeduplicada.length; i += chunkSize) {
      const chunk = listaDeduplicada.slice(i, i + chunkSize).map((p) => ({
        codigo_sku: p.codigo_sku,
        descricao: p.descricao,
        codigo_fornecedor: p.codigo_fornecedor ? p.codigo_fornecedor.trim() : null,
        estoque_sistema: p.estoque_sistema,
        custo_unitario: p.custo_unitario,
        updated_at: new Date().toISOString(),
      }));

      // Tenta inserir o chunk inteiro de uma vez para velocidade máxima
      const { error: chunkErr } = await supabase.from('produtos_cadastro').insert(chunk);

      if (!chunkErr) {
        inseridos += chunk.length;
      } else {
        // Se deu conflito 409 (ou duplicate key 23505), resolve item a item com fallback de UPDATE
        for (const item of chunk) {
          const { error: itemErr } = await supabase.from('produtos_cadastro').insert(item);
          if (!itemErr) {
            inseridos++;
          } else {
            // Se já existe, atualiza os dados
            const { error: updateErr } = await supabase
              .from('produtos_cadastro')
              .update({
                descricao: item.descricao,
                codigo_fornecedor: item.codigo_fornecedor,
                estoque_sistema: item.estoque_sistema,
                custo_unitario: item.custo_unitario,
                updated_at: new Date().toISOString(),
              })
              .eq('codigo_sku', item.codigo_sku);

            if (!updateErr) {
              atualizados++;
            }
          }
        }
      }
    }

    return { inseridos, atualizados };
  }

  // Fallback Local
  const lista = await listarProdutos();
  let inseridos = 0;
  let atualizados = 0;

  listaDeduplicada.forEach((p) => {
    const sku = p.codigo_sku.trim();
    const idx = lista.findIndex((item) => item.codigo_sku.toLowerCase() === sku.toLowerCase());
    if (idx >= 0) {
      lista[idx] = {
        ...lista[idx],
        descricao: p.descricao,
        codigo_fornecedor: p.codigo_fornecedor,
        estoque_sistema: p.estoque_sistema,
        custo_unitario: p.custo_unitario,
        updated_at: new Date().toISOString(),
      };
      atualizados++;
    } else {
      lista.push({
        id: `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        codigo_sku: sku,
        descricao: p.descricao,
        codigo_fornecedor: p.codigo_fornecedor,
        estoque_sistema: p.estoque_sistema,
        custo_unitario: p.custo_unitario,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      inseridos++;
    }
  });

  localStorage.setItem(LS_PRODUTOS, JSON.stringify(lista));
  return { inseridos, atualizados };
}

export async function excluirProduto(produtoId: string): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.from('produtos_cadastro').delete().eq('id', produtoId);
    if (error) throw error;
    return;
  }

  const produtos = await listarProdutos();
  const filtrados = produtos.filter((p) => p.id !== produtoId);
  localStorage.setItem(LS_PRODUTOS, JSON.stringify(filtrados));
}

export async function limparTodosProdutos(): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.from('produtos_cadastro').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
    return;
  }

  localStorage.setItem(LS_PRODUTOS, JSON.stringify([]));
}

// ==============================================================================
// SESSÕES DE INVENTÁRIO (sessoes_inventario)
// ==============================================================================
export async function listarSessoes(): Promise<SessaoInventario[]> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from('sessoes_inventario')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  const json = localStorage.getItem(LS_SESSOES);
  return json ? JSON.parse(json) : [];
}

export async function criarSessao(nome: string, usuarioId?: string): Promise<SessaoInventario> {
  if (!nome.trim()) throw new Error('Nome da sessão é obrigatório');

  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from('sessoes_inventario')
      .insert({
        nome: nome.trim(),
        status: 'em_andamento',
        criado_por: toValidUuidOrNull(usuarioId),
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const sessoes = await listarSessoes();
  const nova: SessaoInventario = {
    id: `sessao_${Date.now()}`,
    nome: nome.trim(),
    status: 'em_andamento',
    criado_por: usuarioId || null,
    created_at: new Date().toISOString(),
  };
  sessoes.unshift(nova);
  localStorage.setItem(LS_SESSOES, JSON.stringify(sessoes));
  return nova;
}

export async function finalizarSessao(sessaoId: string): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase
      .from('sessoes_inventario')
      .update({
        status: 'finalizado',
        finalizado_at: new Date().toISOString(),
      })
      .eq('id', sessaoId);
    if (error) throw error;
    return;
  }

  const sessoes = await listarSessoes();
  const idx = sessoes.findIndex((s) => s.id === sessaoId);
  if (idx >= 0) {
    sessoes[idx].status = 'finalizado';
    sessoes[idx].finalizado_at = new Date().toISOString();
    localStorage.setItem(LS_SESSOES, JSON.stringify(sessoes));
  }
}

export async function renomearSessao(sessaoId: string, novoNome: string): Promise<void> {
  const nomeTrim = novoNome.trim();
  if (!nomeTrim) throw new Error('Nome da sessão não pode ser vazio');

  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase
      .from('sessoes_inventario')
      .update({ nome: nomeTrim })
      .eq('id', sessaoId);
    if (error) throw error;
    return;
  }

  const sessoes = await listarSessoes();
  const idx = sessoes.findIndex((s) => s.id === sessaoId);
  if (idx >= 0) {
    sessoes[idx].nome = nomeTrim;
    localStorage.setItem(LS_SESSOES, JSON.stringify(sessoes));
  }
}

export async function reabrirSessao(sessaoId: string): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase
      .from('sessoes_inventario')
      .update({
        status: 'em_andamento',
        finalizado_at: null,
      })
      .eq('id', sessaoId);
    if (error) throw error;
    return;
  }

  const sessoes = await listarSessoes();
  const idx = sessoes.findIndex((s) => s.id === sessaoId);
  if (idx >= 0) {
    sessoes[idx].status = 'em_andamento';
    sessoes[idx].finalizado_at = null;
    localStorage.setItem(LS_SESSOES, JSON.stringify(sessoes));
  }
}

export async function excluirSessao(sessaoId: string): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.from('sessoes_inventario').delete().eq('id', sessaoId);
    if (error) throw error;
    return;
  }

  const sessoes = await listarSessoes();
  const filtradas = sessoes.filter((s) => s.id !== sessaoId);
  localStorage.setItem(LS_SESSOES, JSON.stringify(filtradas));
  localStorage.removeItem(`${LS_ITENS}_${sessaoId}`);
  localStorage.removeItem(`${LS_LOGS}_${sessaoId}`);
}

// ==============================================================================
// ITENS INVENTARIADOS & BIPE ATÔMICO
// ==============================================================================
export async function listarItensInventariados(sessaoId: string): Promise<ItemInventariado[]> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from('itens_inventariados')
      .select('*')
      .eq('sessao_id', sessaoId)
      .order('ultima_leitura_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  const json = localStorage.getItem(`${LS_ITENS}_${sessaoId}`);
  return json ? JSON.parse(json) : [];
}

export interface ResultadoLeitura {
  sucesso: boolean;
  cadastrado: boolean;
  item: ItemInventariado;
  mensagem: string;
}

/**
 * Operação atômica principal de leitura do Nonus LW200:
 * Executa RPC no PostgreSQL ou simulação atômica local
 */
export async function registrarLeitura(
  sessaoId: string,
  codigoSku: string,
  usuarioId?: string
): Promise<ResultadoLeitura> {
  const sku = codigoSku.trim();
  if (!sku) throw new Error('Código SKU inválido');

  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase.rpc('registrar_leitura_inventario', {
      p_sessao_id: sessaoId,
      p_codigo_sku: sku,
      p_usuario_id: toValidUuidOrNull(usuarioId),
    });

    if (error) {
      throw new Error(error.message || 'Erro ao registrar leitura no servidor');
    }

    return {
      sucesso: data.sucesso,
      cadastrado: data.cadastrado,
      item: data.item,
      mensagem: data.mensagem,
    };
  }

  // Fallback Local
  const produtos = await listarProdutos();
  const prod = produtos.find((p) => p.codigo_sku.toLowerCase() === sku.toLowerCase());

  const itens = await listarItensInventariados(sessaoId);
  const idx = itens.findIndex((i) => i.codigo_sku.toLowerCase() === sku.toLowerCase());

  let itemAtualizado: ItemInventariado;
  const cadastrado = Boolean(prod);

  if (idx >= 0) {
    itens[idx].quantidade_contada += 1;
    itens[idx].ultima_leitura_at = new Date().toISOString();
    if (prod) {
      itens[idx].descricao_snapshot = prod.descricao;
      itens[idx].estoque_sistema_snapshot = prod.estoque_sistema;
      itens[idx].custo_unitario_snapshot = prod.custo_unitario;
      itens[idx].cadastrado_no_sistema = true;
    }
    itemAtualizado = itens[idx];
  } else {
    itemAtualizado = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sessao_id: sessaoId,
      codigo_sku: sku,
      descricao_snapshot: prod ? prod.descricao : `[NÃO CADASTRADO] SKU ${sku}`,
      quantidade_contada: 1,
      estoque_sistema_snapshot: prod ? prod.estoque_sistema : 0,
      custo_unitario_snapshot: prod ? prod.custo_unitario : 0,
      cadastrado_no_sistema: cadastrado,
      ultima_leitura_at: new Date().toISOString(),
    };
    itens.unshift(itemAtualizado);
  }

  localStorage.setItem(`${LS_ITENS}_${sessaoId}`, JSON.stringify(itens));

  // Registrar Log Local
  await registrarLogLocal(sessaoId, sku, usuarioId);

  return {
    sucesso: true,
    cadastrado,
    item: itemAtualizado,
    mensagem: cadastrado
      ? 'Leitura confirmada com sucesso!'
      : 'Código não cadastrado na base! Contagem registrada como pendente.',
  };
}

export async function ajustarQuantidade(
  itemId: string,
  sessaoId: string,
  delta: number,
  usuarioId?: string
): Promise<ItemInventariado> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase.rpc('ajustar_quantidade_manual', {
      p_item_id: itemId,
      p_delta: delta,
      p_usuario_id: toValidUuidOrNull(usuarioId),
    });
    if (error) throw error;
    return data.item;
  }

  // Fallback Local
  const itens = await listarItensInventariados(sessaoId);
  const idx = itens.findIndex((i) => i.id === itemId);
  if (idx < 0) throw new Error('Item não encontrado');

  itens[idx].quantidade_contada = Math.max(0, itens[idx].quantidade_contada + delta);
  itens[idx].ultima_leitura_at = new Date().toISOString();
  localStorage.setItem(`${LS_ITENS}_${sessaoId}`, JSON.stringify(itens));

  if (delta > 0) {
    await registrarLogLocal(sessaoId, itens[idx].codigo_sku, usuarioId);
  }

  return itens[idx];
}

export async function excluirItemContagem(itemId: string, sessaoId: string): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.from('itens_inventariados').delete().eq('id', itemId);
    if (error) throw error;
    return;
  }

  const itens = await listarItensInventariados(sessaoId);
  const filtrados = itens.filter((i) => i.id !== itemId);
  localStorage.setItem(`${LS_ITENS}_${sessaoId}`, JSON.stringify(filtrados));
}

// ==============================================================================
// LOGS DE AUDITORIA (logs_leituras)
// ==============================================================================
export async function listarLogs(sessaoId: string): Promise<LogLeitura[]> {
  const supabase = getSupabase();
  if (supabase) {
    const { data, error } = await supabase
      .from('logs_leituras')
      .select('*')
      .eq('sessao_id', sessaoId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return data || [];
  }

  const json = localStorage.getItem(`${LS_LOGS}_${sessaoId}`);
  return json ? JSON.parse(json) : [];
}

async function registrarLogLocal(sessaoId: string, sku: string, usuarioId?: string) {
  const json = localStorage.getItem(`${LS_LOGS}_${sessaoId}`);
  const logs: LogLeitura[] = json ? JSON.parse(json) : [];
  logs.unshift({
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sessao_id: sessaoId,
    codigo_sku: sku,
    usuario_id: usuarioId || null,
    created_at: new Date().toISOString(),
  });
  if (logs.length > 100) logs.length = 100;
  localStorage.setItem(`${LS_LOGS}_${sessaoId}`, JSON.stringify(logs));
}
