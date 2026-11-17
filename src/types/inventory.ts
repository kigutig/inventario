// ==============================================================================
// TIPAGENS DO SISTEMA DE INVENTÁRIO & SUPABASE
// ==============================================================================

export interface ProdutoCadastro {
  id: string;
  codigo_sku: string;
  descricao: string;
  codigo_fornecedor?: string | null;
  estoque_sistema: number;
  custo_unitario: number;
  created_at?: string;
  updated_at?: string;
}

export type SessaoStatus = 'em_andamento' | 'finalizado';

export interface SessaoInventario {
  id: string;
  nome: string;
  status: SessaoStatus;
  criado_por?: string | null;
  created_at: string;
  finalizado_at?: string | null;
}

export interface ItemInventariado {
  id: string;
  sessao_id: string;
  codigo_sku: string;
  descricao_snapshot: string;
  quantidade_contada: number;
  estoque_sistema_snapshot: number;
  custo_unitario_snapshot: number;
  cadastrado_no_sistema: boolean;
  ultima_leitura_at: string;
  // Campos calculados na UI:
  divergencia?: number; // quantidade_contada - estoque_sistema_snapshot
  impacto_financeiro?: number; // divergencia * custo_unitario_snapshot
}

export interface LogLeitura {
  id: string;
  sessao_id: string;
  codigo_sku: string;
  usuario_id?: string | null;
  usuario_email?: string | null;
  tipo_evento?: 'BIPE' | 'AJUSTE_MANUAL_ADICAO' | 'AJUSTE_MANUAL_SUBTRACAO' | 'CADASTRO_RAPIDO' | string;
  quantidade_anterior?: number;
  quantidade_nova?: number;
  ip_address?: string | null;
  created_at: string;
}

export interface ResumoSessao {
  totalPecasBipadas: number;
  totalSkusContados: number;
  totalItensDivergentes: number;
  totalItensCorretos: number;
  totalItensFaltando: number;
  totalItensSobrando: number;
  totalNaoCadastrados: number;
  impactoFinanceiroTotal: number;
  acuraciaPercentual: number;
}

export type FiltroTabela = 'todos' | 'divergencia' | 'faltando' | 'sobrando' | 'corretos' | 'nao_cadastrados';

