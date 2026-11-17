-- ==============================================================================
-- SISTEMA DE INVENTÁRIO E AUDITORIA DE ATIVOS (SUPABASE / POSTGRESQL)
-- Script de Configuração Completo: Tabelas, Índices, RLS, Triggers e RPCs Atômicas
-- ==============================================================================

-- 0. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. TABELA: produtos_cadastro (Base oficial importada do ERP / Excel)
-- ------------------------------------------------------------------------------
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

-- Garantir índice único exato no SKU para suporte a upsert PostgREST e buscas rápidas
CREATE UNIQUE INDEX IF NOT EXISTS idx_produtos_cadastro_sku ON public.produtos_cadastro (codigo_sku);
CREATE INDEX IF NOT EXISTS idx_produtos_cadastro_descricao ON public.produtos_cadastro USING gin(to_tsvector('portuguese', descricao));

-- ------------------------------------------------------------------------------
-- 2. TABELA: sessoes_inventario (Múltiplas sessões/auditorias)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 3. TABELA: itens_inventariados (Contagem consolidada por sessão)
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 4. TABELA: logs_leituras (Trilha bruta de cada bipe do leitor HID Nonus LW200)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.logs_leituras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sessao_id UUID NOT NULL REFERENCES public.sessoes_inventario(id) ON DELETE CASCADE,
    codigo_sku TEXT NOT NULL,
    usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_logs_sessao_created ON public.logs_leituras(sessao_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 5. FUNÇÃO RPC: registrar_leitura_inventario (Atômica, Concorrência Segura)
-- ------------------------------------------------------------------------------
-- Executa a busca em produtos_cadastro, incrementa ou insere em itens_inventariados
-- e registra na trilha de logs_leituras em uma única transação atômica.
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
    -- 1. Normalizar SKU (remover espaços ao redor)
    v_sku := TRIM(p_codigo_sku);
    IF v_sku IS NULL OR v_sku = '' THEN
        RAISE EXCEPTION 'Código SKU não pode ser vazio';
    END IF;

    -- 2. Validar se a sessão existe e está em andamento
    SELECT status INTO v_sessao_status
    FROM public.sessoes_inventario
    WHERE id = p_sessao_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sessão de inventário não encontrada: %', p_sessao_id;
    END IF;

    IF v_sessao_status <> 'em_andamento' THEN
        RAISE EXCEPTION 'Esta sessão de inventário já foi finalizada e não aceita novos bipes.';
    END IF;

    -- 3. Buscar produto no cadastro oficial
    SELECT codigo_sku, descricao, codigo_fornecedor, estoque_sistema, custo_unitario
    INTO v_prod
    FROM public.produtos_cadastro
    WHERE TRIM(codigo_sku) = v_sku
    LIMIT 1;

    IF FOUND THEN
        v_cadastrado := true;
        -- Upsert atômico com dados oficiais
        INSERT INTO public.itens_inventariados (
            sessao_id,
            codigo_sku,
            descricao_snapshot,
            quantidade_contada,
            estoque_sistema_snapshot,
            custo_unitario_snapshot,
            cadastrado_no_sistema,
            ultima_leitura_at
        ) VALUES (
            p_sessao_id,
            v_sku,
            v_prod.descricao,
            1,
            v_prod.estoque_sistema,
            v_prod.custo_unitario,
            true,
            timezone('utc'::text, now())
        )
        ON CONFLICT (sessao_id, codigo_sku)
        DO UPDATE SET
            quantidade_contada = public.itens_inventariados.quantidade_contada + 1,
            ultima_leitura_at = timezone('utc'::text, now()),
            -- Atualiza dados caso o cadastro tenha sido atualizado posteriormente
            descricao_snapshot = CASE 
                WHEN public.itens_inventariados.descricao_snapshot LIKE '[NÃO CADASTRADO]%' THEN v_prod.descricao 
                ELSE public.itens_inventariados.descricao_snapshot 
            END,
            estoque_sistema_snapshot = v_prod.estoque_sistema,
            custo_unitario_snapshot = v_prod.custo_unitario,
            cadastrado_no_sistema = true
        RETURNING * INTO v_item;
    ELSE
        -- Produto não cadastrado: soma +1 mesmo assim com aviso
        v_cadastrado := false;
        INSERT INTO public.itens_inventariados (
            sessao_id,
            codigo_sku,
            descricao_snapshot,
            quantidade_contada,
            estoque_sistema_snapshot,
            custo_unitario_snapshot,
            cadastrado_no_sistema,
            ultima_leitura_at
        ) VALUES (
            p_sessao_id,
            v_sku,
            '[NÃO CADASTRADO] SKU ' || v_sku,
            1,
            0,
            0.00,
            false,
            timezone('utc'::text, now())
        )
        ON CONFLICT (sessao_id, codigo_sku)
        DO UPDATE SET
            quantidade_contada = public.itens_inventariados.quantidade_contada + 1,
            ultima_leitura_at = timezone('utc'::text, now())
        RETURNING * INTO v_item;
    END IF;

    -- 4. Gravar log de auditoria do bipe
    INSERT INTO public.logs_leituras (
        sessao_id,
        codigo_sku,
        usuario_id,
        created_at
    ) VALUES (
        p_sessao_id,
        v_sku,
        p_usuario_id,
        timezone('utc'::text, now())
    );

    -- 5. Retornar payload com o item atualizado
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

-- ------------------------------------------------------------------------------
-- 6. FUNÇÃO RPC: ajustar_quantidade_manual
-- Permite botões + e - com auditoria e controle de sessão ativa
-- ------------------------------------------------------------------------------
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
    v_sessao_status TEXT;
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
        RAISE EXCEPTION 'Sessão finalizada. Não é permitido alterar quantidades.';
    END IF;

    v_nova_qtd := v_item.quantidade_contada + p_delta;
    IF v_nova_qtd < 0 THEN
        v_nova_qtd := 0;
    END IF;

    UPDATE public.itens_inventariados
    SET quantidade_contada = v_nova_qtd,
        ultima_leitura_at = timezone('utc'::text, now())
    WHERE id = p_item_id
    RETURNING * INTO v_item;

    -- Registrar log se houve acréscimo
    IF p_delta > 0 THEN
        INSERT INTO public.logs_leituras (sessao_id, codigo_sku, usuario_id)
        VALUES (v_item.sessao_id, v_item.codigo_sku, p_usuario_id);
    END IF;

    RETURN jsonb_build_object(
        'sucesso', true,
        'item', to_jsonb(v_item)
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS)
-- Garante acesso a usuários autenticados (e leitura controlada)
-- ------------------------------------------------------------------------------
ALTER TABLE public.produtos_cadastro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessoes_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_inventariados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_leituras ENABLE ROW LEVEL SECURITY;

-- Políticas para usuários autenticados
CREATE POLICY "Permitir leitura total para autenticados" 
    ON public.produtos_cadastro FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir inserção e atualização para autenticados" 
    ON public.produtos_cadastro FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir leitura de sessoes para autenticados" 
    ON public.sessoes_inventario FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir gerenciar sessoes para autenticados" 
    ON public.sessoes_inventario FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir leitura de itens para autenticados" 
    ON public.itens_inventariados FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir gerenciar itens para autenticados" 
    ON public.itens_inventariados FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Permitir leitura de logs para autenticados" 
    ON public.logs_leituras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir gerenciar logs para autenticados" 
    ON public.logs_leituras FOR INSERT TO authenticated WITH CHECK (true);

-- Políticas de fallback para chave anon (facilita testes imediatos e demonstração com anon key caso desejado)
CREATE POLICY "Permitir leitura anon em produtos" 
    ON public.produtos_cadastro FOR SELECT TO anon USING (true);
CREATE POLICY "Permitir gravação anon em produtos" 
    ON public.produtos_cadastro FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Permitir leitura anon em sessoes" 
    ON public.sessoes_inventario FOR SELECT TO anon USING (true);
CREATE POLICY "Permitir gravação anon em sessoes" 
    ON public.sessoes_inventario FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Permitir leitura anon em itens" 
    ON public.itens_inventariados FOR SELECT TO anon USING (true);
CREATE POLICY "Permitir gravação anon em itens" 
    ON public.itens_inventariados FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Permitir gravação anon em logs" 
    ON public.logs_leituras FOR ALL TO anon USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 8. HABILITAR SUPABASE REALTIME
-- Permite que múltiplos bipes sincronizem instantaneamente na tela de todos
-- ------------------------------------------------------------------------------
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

ALTER PUBLICATION supabase_realtime ADD TABLE public.itens_inventariados;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessoes_inventario;
ALTER PUBLICATION supabase_realtime ADD TABLE public.logs_leituras;

-- ------------------------------------------------------------------------------
-- 9. DADOS DE DEMONSTRAÇÃO / TESTE INICIAL (OPCIONAL)
-- Exemplos reais de máquinas e ativos de academia / indústria
-- ------------------------------------------------------------------------------
INSERT INTO public.produtos_cadastro (codigo_sku, descricao, codigo_fornecedor, estoque_sistema, custo_unitario)
VALUES
    ('205N51', 'PUXADA ALTA CONVERGENTE - ALL FIT IRON', 'XVD038', 12, 4850.00),
    ('002NA01AC', 'LEG PRESS 45 GRAUS ARTICULADO - LINHA PRO', 'ALP902', 8, 7200.00),
    ('010KB88', 'ESTEIRA ERGOMÉTRICA PROFISSIONAL ELETRÔNICA T9', 'EST441', 15, 12900.00),
    ('440M22', 'SUPINO RETO OLÍMPICO REFORÇADO COM TRAVA', 'SUP110', 6, 2600.00),
    ('771X09', 'CROSSOVER ANGULAR COM REGULAGEM DE CABO DUPLO', 'CAB882', 4, 11400.00),
    ('102DF33', 'BANCO REGULÁVEL INCLINADO/DECLINADO 0-90°', 'BNC001', 20, 1450.00),
    ('500AC99', 'HALTER MONOBLOCO EMBORRACHADO 20KG (PAR)', 'HLT020', 30, 480.00)
ON CONFLICT (TRIM(codigo_sku)) DO UPDATE SET
    descricao = EXCLUDED.descricao,
    estoque_sistema = EXCLUDED.estoque_sistema,
    custo_unitario = EXCLUDED.custo_unitario;

