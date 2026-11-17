import React, { useState } from 'react';
import {
  Code2,
  Copy,
  Check,
  X,
  Database,
  ShieldCheck,
  Save,
} from 'lucide-react';
import { getSupabaseCredentials, saveSupabaseCredentials } from '../lib/supabase';

interface SqlInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SQL_SCRIPT = `-- ==============================================================================
-- SISTEMA DE INVENTÁRIO E AUDITORIA DE ATIVOS (SUPABASE / POSTGRESQL)
-- Script de Configuração Completo: Tabelas, Índices, RLS, Triggers e RPCs Atômicas
-- ==============================================================================

-- 0. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABELA: produtos_cadastro (Base oficial importada do ERP / Excel)
CREATE TABLE IF NOT EXISTS public.produtos_cadastro (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_sku TEXT NOT NULL UNIQUE,
    descricao TEXT NOT NULL,
    codigo_fornecedor TEXT,
    estoque_sistema INTEGER NOT NULL DEFAULT 0,
    custo_unitario NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_produtos_cadastro_sku ON public.produtos_cadastro (codigo_sku);
CREATE INDEX IF NOT EXISTS idx_produtos_cadastro_descricao ON public.produtos_cadastro USING gin(to_tsvector('portuguese', descricao));

-- 2. TABELA: sessoes_inventario (Múltiplas sessões/auditorias)
CREATE TABLE IF NOT EXISTS public.sessoes_inventario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'finalizado')),
    criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    finalizado_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessoes_status ON public.sessoes_inventario(status);
CREATE INDEX IF NOT EXISTS idx_sessoes_created_at ON public.sessoes_inventario(created_at DESC);

-- 3. TABELA: itens_inventariados (Contagem consolidada por sessão)
CREATE TABLE IF NOT EXISTS public.itens_inventariados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sessao_id UUID NOT NULL REFERENCES public.sessoes_inventario(id) ON DELETE CASCADE,
    codigo_sku TEXT NOT NULL,
    descricao_snapshot TEXT NOT NULL DEFAULT '',
    quantidade_contada INTEGER NOT NULL DEFAULT 1 CHECK (quantidade_contada >= 0),
    estoque_sistema_snapshot INTEGER NOT NULL DEFAULT 0,
    custo_unitario_snapshot NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    cadastrado_no_sistema BOOLEAN NOT NULL DEFAULT true,
    ultima_leitura_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_sessao_sku UNIQUE(sessao_id, codigo_sku)
);

CREATE INDEX IF NOT EXISTS idx_itens_sessao ON public.itens_inventariados(sessao_id);
CREATE INDEX IF NOT EXISTS idx_itens_sku ON public.itens_inventariados(codigo_sku);
CREATE INDEX IF NOT EXISTS idx_itens_ultima_leitura ON public.itens_inventariados(ultima_leitura_at DESC);

-- 4. TABELA: logs_leituras (Trilha bruta de cada bipe do leitor HID Nonus LW200)
CREATE TABLE IF NOT EXISTS public.logs_leituras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sessao_id UUID NOT NULL REFERENCES public.sessoes_inventario(id) ON DELETE CASCADE,
    codigo_sku TEXT NOT NULL,
    usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_logs_sessao_created ON public.logs_leituras(sessao_id, created_at DESC);

-- 5. FUNÇÃO RPC: registrar_leitura_inventario (Atômica, Concorrência Segura)
CREATE OR REPLACE FUNCTION public.registrar_leitura_inventario(
    p_sessao_id UUID,
    p_codigo_sku TEXT,
    p_usuario_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sku TEXT;
    v_sessao_status TEXT;
    v_prod RECORD;
    v_item RECORD;
    v_cadastrado BOOLEAN := false;
BEGIN
    v_sku := TRIM(p_codigo_sku);
    IF v_sku IS NULL OR v_sku = '' THEN
        RAISE EXCEPTION 'Código SKU não pode ser vazio';
    END IF;

    SELECT status INTO v_sessao_status
    FROM public.sessoes_inventario
    WHERE id = p_sessao_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sessão de inventário não encontrada: %', p_sessao_id;
    END IF;

    IF v_sessao_status <> 'em_andamento' THEN
        RAISE EXCEPTION 'Esta sessão de inventário já foi finalizada e não aceita novos bipes.';
    END IF;

    SELECT codigo_sku, descricao, codigo_fornecedor, estoque_sistema, custo_unitario
    INTO v_prod
    FROM public.produtos_cadastro
    WHERE TRIM(codigo_sku) = v_sku
    LIMIT 1;

    IF FOUND THEN
        v_cadastrado := true;
        INSERT INTO public.itens_inventariados (
            sessao_id, codigo_sku, descricao_snapshot, quantidade_contada,
            estoque_sistema_snapshot, custo_unitario_snapshot, cadastrado_no_sistema, ultima_leitura_at
        ) VALUES (
            p_sessao_id, v_sku, v_prod.descricao, 1,
            v_prod.estoque_sistema, v_prod.custo_unitario, true, timezone('utc'::text, now())
        )
        ON CONFLICT (sessao_id, codigo_sku)
        DO UPDATE SET
            quantidade_contada = public.itens_inventariados.quantidade_contada + 1,
            ultima_leitura_at = timezone('utc'::text, now()),
            descricao_snapshot = CASE 
                WHEN public.itens_inventariados.descricao_snapshot LIKE '[NÃO CADASTRADO]%' THEN v_prod.descricao 
                ELSE public.itens_inventariados.descricao_snapshot 
            END,
            estoque_sistema_snapshot = v_prod.estoque_sistema,
            custo_unitario_snapshot = v_prod.custo_unitario,
            cadastrado_no_sistema = true
        RETURNING * INTO v_item;
    ELSE
        v_cadastrado := false;
        INSERT INTO public.itens_inventariados (
            sessao_id, codigo_sku, descricao_snapshot, quantidade_contada,
            estoque_sistema_snapshot, custo_unitario_snapshot, cadastrado_no_sistema, ultima_leitura_at
        ) VALUES (
            p_sessao_id, v_sku, '[NÃO CADASTRADO] SKU ' || v_sku, 1,
            0, 0.00, false, timezone('utc'::text, now())
        )
        ON CONFLICT (sessao_id, codigo_sku)
        DO UPDATE SET
            quantidade_contada = public.itens_inventariados.quantidade_contada + 1,
            ultima_leitura_at = timezone('utc'::text, now())
        RETURNING * INTO v_item;
    END IF;

    INSERT INTO public.logs_leituras (sessao_id, codigo_sku, usuario_id, created_at)
    VALUES (p_sessao_id, v_sku, p_usuario_id, timezone('utc'::text, now()));

    RETURN jsonb_build_object(
        'sucesso', true,
        'cadastrado', v_cadastrado,
        'item', to_jsonb(v_item),
        'mensagem', CASE 
            WHEN v_cadastrado THEN 'Leitura confirmada com sucesso!'
            ELSE 'Código não cadastrado na base! Contagem registrada como pendente.'
        END
    );
END;
$$;

-- 6. FUNÇÃO RPC: ajustar_quantidade_manual
CREATE OR REPLACE FUNCTION public.ajustar_quantidade_manual(
    p_item_id UUID,
    p_delta INTEGER,
    p_usuario_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item RECORD;
    v_nova_qtd INTEGER;
BEGIN
    SELECT i.*, s.status AS sessao_status
    INTO v_item
    FROM public.itens_inventariados i
    JOIN public.sessoes_inventario s ON s.id = i.sessao_id
    WHERE i.id = p_item_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item inventariado não encontrado.';
    END IF;

    IF v_item.sessao_status <> 'em_andamento' THEN
        RAISE EXCEPTION 'Sessão finalizada.';
    END IF;

    v_nova_qtd := v_item.quantidade_contada + p_delta;
    IF v_nova_qtd < 0 THEN v_nova_qtd := 0; END IF;

    UPDATE public.itens_inventariados
    SET quantidade_contada = v_nova_qtd,
        ultima_leitura_at = timezone('utc'::text, now())
    WHERE id = p_item_id
    RETURNING * INTO v_item;

    RETURN jsonb_build_object('sucesso', true, 'item', to_jsonb(v_item));
END;
$$;

-- 7. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.produtos_cadastro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessoes_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_inventariados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_leituras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir tudo produtos" ON public.produtos_cadastro FOR ALL USING (true);
CREATE POLICY "Permitir tudo sessoes" ON public.sessoes_inventario FOR ALL USING (true);
CREATE POLICY "Permitir tudo itens" ON public.itens_inventariados FOR ALL USING (true);
CREATE POLICY "Permitir tudo logs" ON public.logs_leituras FOR ALL USING (true);

-- 8. HABILITAR SUPABASE REALTIME
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

ALTER PUBLICATION supabase_realtime ADD TABLE public.itens_inventariados;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessoes_inventario;
ALTER PUBLICATION supabase_realtime ADD TABLE public.logs_leituras;
`;

export const SqlInstructionsModal: React.FC<SqlInstructionsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const creds = getSupabaseCredentials();
  const [url, setUrl] = useState(creds.url);
  const [anonKey, setAnonKey] = useState(creds.anonKey);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(SQL_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveCreds = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseCredentials(url, anonKey);
    setSaveSuccess(true);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Conexão Supabase & Script SQL Completo
              </h2>
              <p className="text-xs text-slate-400">
                Execute o script abaixo no SQL Editor do seu Supabase para criar tabelas, RLS e RPCs
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo com Tabs ou Seções */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Formulário de Configuração das Chaves */}
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Configurar Credenciais do Seu Projeto Supabase
              </div>
              <span className="text-[11px] text-slate-400">
                Pode ser preenchido aqui ou no arquivo <code>.env</code>
              </span>
            </div>

            <form onSubmit={handleSaveCreds} className="space-y-3">
              <div>
                <label className="block text-xs font-mono font-semibold text-slate-400 mb-1">
                  SUPABASE PROJECT URL (VITE_SUPABASE_URL)
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold text-slate-400 mb-1">
                  SUPABASE ANON PUBLIC KEY (VITE_SUPABASE_ANON_KEY)
                </label>
                <input
                  type="password"
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-[11px] text-slate-400">
                  {saveSuccess ? (
                    <span className="text-emerald-400 font-bold">Credenciais salvas com sucesso! Recarregando...</span>
                  ) : (
                    <>Encontrado em: <strong>Project Settings → API</strong> no painel do Supabase.</>
                  )}
                </p>

                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all"
                >
                  <Save className="w-3.5 h-3.5" />
                  Salvar e Conectar Supabase
                </button>
              </div>
            </form>
          </div>

          {/* Script SQL */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <Code2 className="w-4 h-4 text-emerald-400" />
                  Script SQL para Rodar no Supabase (SQL Editor)
                </h3>
                <p className="text-xs text-slate-400">
                  Cria tabelas, índices de alta performance, RPC atômica anti-concorrência e Realtime.
                </p>
              </div>

              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copiado para Área de Transferência!' : 'Copiar SQL Completo'}
              </button>
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
              <pre className="p-4 text-xs font-mono text-slate-300 max-h-72 overflow-y-auto leading-relaxed">
                {SQL_SCRIPT}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
