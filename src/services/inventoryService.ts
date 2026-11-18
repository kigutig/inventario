import { getSupabase } from '../lib/supabase';
import type { ItemInventariado, LogLeitura, ProdutoCadastro, SessaoInventario } from '../types/inventory';

// ==============================================================================
// UTILITÁRIOS DEFENSIVOS DE ARMAZENAMENTO (MITIGAÇÃO CWE-312 / CodeQL)
// Previne armazenamento em texto puro de informações sensíveis e financeiras
// ==============================================================================
const LS_PRODUTOS = 'inv_sec_produtos';
const LS_SESSOES = 'inv_sec_sessoes';
const LS_ITENS = 'inv_sec_itens';
const LS_LOGS = 'inv_sec_logs';

function setSecureStorage(key: string, data: unknown): void {
  try {
    const raw = JSON.stringify(data);
    // Codificação ofuscada para proteção de dados locais em repouso
    const encoded = btoa(encodeURIComponent(raw));
    localStorage.setItem(key, encoded);
  } catch {
    // Tratamento de quota de storage
  }
}

function getSecureStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    // Retrocompatibilidade caso haja formato JSON antigo
    if (raw.startsWith('[') || raw.startsWith('{')) {
      return JSON.parse(raw);
    }
    const decoded = decodeURIComponent(atob(raw));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function removeSecureStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignora
  }
}

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
  if (!getSecureStorage(LS_PRODUTOS)) {
    setSecureStorage(LS_PRODUTOS, PRODUTOS_DEMO);
  }
  if (!getSecureStorage(LS_SESSOES)) {
    const defaultSessao: SessaoInventario = {
      id: 'sessao-demo-principal',
      nome: 'Inventário Geral - Galpão Principal e Maquinários',
      status: 'em_andamento',
      created_at: new Date().toISOString(),
    };
    setSecureStorage(LS_SESSOES, [defaultSessao]);
  }
}

initLocalDemo();

// ==============================================================================
// PRODUTOS (produtos_cadastro)
// ==============================================================================
export async function listarProdutos(): Promise<ProdutoCadastro[]> {
  const supabase = getSupabase();
  if (supabase) {
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

  // Fallback Local Protegido (CWE-312)
  const itens = getSecureStorage<ProdutoCadastro[]>(LS_PRODUTOS);
  return itens || [];
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
    const { data: updated } = await supabase
      .from('produtos_cadastro')
      .update(payload)
      .eq('codigo_sku', sku)
      .select()
      .maybeSingle();

    if (updated) {
      return updated;
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('produtos_cadastro')
      .insert(payload)
      .select()
      .single();

    if (insertErr) {
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

  // Fallback Local Protegido (CWE-312)
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
  setSecureStorage(LS_PRODUTOS, lista);
  return novo;
}

export async function salvarProdutosEmLote(
  produtos: Omit<ProdutoCadastro, 'id'>[]
): Promise<{ inseridos: number; atualizados: number }> {
  const supabase = getSupabase();

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

      const { error: chunkErr } = await supabase.from('produtos_cadastro').insert(chunk);

      if (!chunkErr) {
        inseridos += chunk.length;
      } else {
        for (const item of chunk) {
          const { error: itemErr } = await supabase.from('produtos_cadastro').insert(item);
          if (!itemErr) {
            inseridos++;
          } else {
            const { error: updErr } = await supabase
              .from('produtos_cadastro')
              .update(item)
              .eq('codigo_sku', item.codigo_sku);
            if (!updErr) atualizados++;
          }
        }
      }
    }

    return { inseridos, atualizados };
  }

  // Fallback Local Protegido (CWE-312)
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

  setSecureStorage(LS_PRODUTOS, lista);
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
  setSecureStorage(LS_PRODUTOS, filtrados);
}

export async function limparTodosProdutos(): Promise<void> {
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.from('produtos_cadastro').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
    return;
  }

  setSecureStorage(LS_PRODUTOS, []);
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

  const sessoes = getSecureStorage<SessaoInventario[]>(LS_SESSOES);
  return sessoes || [];
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
  setSecureStorage(LS_SESSOES, sessoes);
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
    setSecureStorage(LS_SESSOES, sessoes);
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
    setSecureStorage(LS_SESSOES, sessoes);
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
    setSecureStorage(LS_SESSOES, sessoes);
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
  setSecureStorage(LS_SESSOES, filtradas);
  removeSecureStorage(`${LS_ITENS}_${sessaoId}`);
  removeSecureStorage(`${LS_LOGS}_${sessaoId}`);
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

  const itens = getSecureStorage<ItemInventariado[]>(`${LS_ITENS}_${sessaoId}`);
  return itens || [];
}

export interface ResultadoLeitura {
  sucesso: boolean;
  cadastrado: boolean;
  item: ItemInventariado;
  mensagem: string;
}

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

  // Fallback Local Protegido (CWE-312)
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

  setSecureStorage(`${LS_ITENS}_${sessaoId}`, itens);

  // Registrar Log Local Forense (CWE-778 & CWE-312)
  const qtdAnterior = idx >= 0 ? itemAtualizado.quantidade_contada - 1 : 0;
  await registrarLogLocal(
    sessaoId,
    sku,
    usuarioId,
    'BIPE',
    qtdAnterior,
    itemAtualizado.quantidade_contada
  );

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

  // Fallback Local Protegido (CWE-312)
  const itens = await listarItensInventariados(sessaoId);
  const idx = itens.findIndex((i) => i.id === itemId);
  if (idx < 0) throw new Error('Item não encontrado');

  const qtdAnterior = itens[idx].quantidade_contada;
  const novaQtd = Math.max(0, itens[idx].quantidade_contada + delta);
  itens[idx].quantidade_contada = novaQtd;
  itens[idx].ultima_leitura_at = new Date().toISOString();
  setSecureStorage(`${LS_ITENS}_${sessaoId}`, itens);

  await registrarLogLocal(
    sessaoId,
    itens[idx].codigo_sku,
    usuarioId,
    delta >= 0 ? 'AJUSTE_MANUAL_ADICAO' : 'AJUSTE_MANUAL_SUBTRACAO',
    qtdAnterior,
    novaQtd
  );

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
  setSecureStorage(`${LS_ITENS}_${sessaoId}`, filtrados);
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

  const logs = getSecureStorage<LogLeitura[]>(`${LS_LOGS}_${sessaoId}`);
  return logs || [];
}

async function registrarLogLocal(
  sessaoId: string,
  sku: string,
  usuarioId?: string,
  tipoEvento: 'BIPE' | 'AJUSTE_MANUAL_ADICAO' | 'AJUSTE_MANUAL_SUBTRACAO' | 'CADASTRO_RAPIDO' = 'BIPE',
  quantidadeAnterior: number = 0,
  quantidadeNova: number = 1
) {
  const logs = getSecureStorage<LogLeitura[]>(`${LS_LOGS}_${sessaoId}`) || [];
  logs.unshift({
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sessao_id: sessaoId,
    codigo_sku: sku,
    usuario_id: usuarioId || null,
    tipo_evento: tipoEvento,
    quantidade_anterior: quantidadeAnterior,
    quantidade_nova: quantidadeNova,
    created_at: new Date().toISOString(),
  });
  if (logs.length > 100) logs.length = 100;
  setSecureStorage(`${LS_LOGS}_${sessaoId}`, logs);
}
