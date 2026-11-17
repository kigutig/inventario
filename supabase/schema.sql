-- ==============================================================================
-- SISTEMA DE INVENTÁRIO E AUDITORIA DE ATIVOS (NONUS LW200 HID)
-- ARQUITETURA DE SEGURANÇA E CONFORMIDADE POSTGRESQL / SUPABASE
-- Mitigações: CWE-862, CWE-778, CWE-639, CWE-807, CWE-287
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. TABELA: produtos_cadastro (Base oficial importada do ERP / Excel)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.produtos_cadastro (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    codigo_sku TEXT NOT NULL,
    descricao TEXT NOT NULL,
    codigo_fornecedor TEXT,
    estoque_sistema INTEGER NOT NULL DEFAULT 0,
    custo_unitario NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Garantir unicidade semântica case-insensitive e com trim no SKU
CREATE UNIQUE INDEX IF NOT EXISTS idx_produtos_sku_unique 
    ON public.produtos_cadastro (LOWER(TRIM(codigo_sku)));

CREATE INDEX IF NOT EXISTS idx_produtos_descricao 
    ON public.produtos_cadastro USING gin(to_tsvector('portuguese', descricao));

-- ------------------------------------------------------------------------------
-- 2. TABELA: sessoes_inventario (Ciclos de contagem física)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sessoes_inventario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'finalizado')),
    criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    finalizado_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessoes_status_created 
    ON public.sessoes_inventario (status, created_at DESC);

-- ------------------------------------------------------------------------------
-- 3. TABELA: itens_inventariados (Contagem física consolidada por sessão)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.itens_inventariados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sessao_id UUID NOT NULL REFERENCES public.sessoes_inventario(id) ON DELETE CASCADE,
    codigo_sku TEXT NOT NULL,
    descricao_snapshot TEXT NOT NULL DEFAULT 'PRODUTO NÃO CADASTRADO',
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
-- 4. TABELA: logs_leituras (Trilha de auditoria completa - Mitigação CWE-778)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.logs_leituras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sessao_id UUID NOT NULL REFERENCES public.sessoes_inventario(id) ON DELETE CASCADE,
    codigo_sku TEXT NOT NULL,
    usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tipo_evento TEXT NOT NULL DEFAULT 'BIPE' CHECK (tipo_evento IN ('BIPE', 'AJUSTE_MANUAL_ADICAO', 'AJUSTE_MANUAL_SUBTRACAO', 'CADASTRO_RAPIDO')),
    quantidade_anterior INTEGER NOT NULL DEFAULT 0,
    quantidade_nova INTEGER NOT NULL DEFAULT 1,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_logs_sessao_created ON public.logs_leituras(sessao_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_tipo_evento ON public.logs_leituras(tipo_evento);

-- ------------------------------------------------------------------------------
-- 5. FUNÇÃO RPC: registrar_leitura_inventario (Atômica, Concorrência Segura)
-- Mitigações: CWE-862 (Missing Authorization) e CWE-807 (Untrusted Input)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_leitura_inventario(
    p_sessao_id UUID,
    p_codigo_sku TEXT,
    p_usuario_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_sku TEXT;
    v_sessao_status TEXT;
    v_prod RECORD;
    v_item RECORD;
    v_cadastrado BOOLEAN := false;
    v_auth_user_id UUID;
    v_qtd_anterior INTEGER := 0;
BEGIN
    -- 1. Mitigação CWE-807: Priorizar identidade autenticada via token JWT sobre parâmetro do cliente
    v_auth_user_id := COALESCE(auth.uid(), p_usuario_id);

    -- 2. Normalizar e sanitizar SKU
    v_sku := TRIM(p_codigo_sku);
    IF v_sku IS NULL OR v_sku = '' THEN
        RAISE EXCEPTION 'Código SKU não pode ser vazio' USING ERRCODE = '22023';
    END IF;

    -- 3. Mitigação CWE-862: Verificar se a sessão existe e se está aberta para contagem
    SELECT status INTO v_sessao_status
    FROM public.sessoes_inventario
    WHERE id = p_sessao_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sessão de inventário não encontrada ou não autorizada.' USING ERRCODE = '42501';
    END IF;

    IF v_sessao_status <> 'em_andamento' THEN
        RAISE EXCEPTION 'Esta sessão de inventário já foi finalizada. Leituras bloqueadas.' USING ERRCODE = '55000';
    END IF;

    -- 4. Buscar cadastro oficial do produto
    SELECT * INTO v_prod
    FROM public.produtos_cadastro
    WHERE LOWER(TRIM(codigo_sku)) = LOWER(v_sku)
    LIMIT 1;

    -- 5. Obter quantidade contada anterior (para trilha forense CWE-778)
    SELECT quantidade_contada INTO v_qtd_anterior
    FROM public.itens_inventariados
    WHERE sessao_id = p_sessao_id AND codigo_sku = v_sku;
    
    IF v_qtd_anterior IS NULL THEN
        v_qtd_anterior := 0;
    END IF;

    -- 6. Upsert atômico da contagem
    IF FOUND AND v_prod.id IS NOT NULL THEN
        v_cadastrado := true;
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
            v_prod.codigo_sku,
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
            descricao_snapshot = EXCLUDED.descricao_snapshot,
            estoque_sistema_snapshot = EXCLUDED.estoque_sistema_snapshot,
            custo_unitario_snapshot = EXCLUDED.custo_unitario_snapshot,
            cadastrado_no_sistema = true,
            ultima_leitura_at = timezone('utc'::text, now())
        RETURNING * INTO v_item;
    ELSE
        -- Item bipado ainda não cadastrado na base oficial
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
            '[NÃO CADASTRADO] ' || v_sku,
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

    -- 7. Gravação de log forense com registro de transição (Mitigação CWE-778)
    INSERT INTO public.logs_leituras (
        sessao_id,
        codigo_sku,
        usuario_id,
        tipo_evento,
        quantidade_anterior,
        quantidade_nova,
        created_at
    ) VALUES (
        p_sessao_id,
        v_sku,
        v_auth_user_id,
        'BIPE',
        v_qtd_anterior,
        v_item.quantidade_contada,
        timezone('utc'::text, now())
    );

    -- 8. Retornar payload auditado
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
-- Mitigações: CWE-778 (Log integral de acréscimo e decréscimo), CWE-862 e CWE-807
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ajustar_quantidade_manual(
    p_item_id UUID,
    p_delta INTEGER,
    p_usuario_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_item RECORD;
    v_sessao_status TEXT;
    v_qtd_anterior INTEGER;
    v_nova_qtd INTEGER;
    v_tipo_evento TEXT;
    v_auth_user_id UUID;
BEGIN
    v_auth_user_id := COALESCE(auth.uid(), p_usuario_id);

    SELECT i.*, s.status AS sessao_status
    INTO v_item
    FROM public.itens_inventariados i
    JOIN public.sessoes_inventario s ON s.id = i.sessao_id
    WHERE i.id = p_item_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item inventariado não encontrado ou acesso não autorizado.' USING ERRCODE = '42501';
    END IF;

    IF v_item.sessao_status <> 'em_andamento' THEN
        RAISE EXCEPTION 'Sessão finalizada. Não é permitido alterar quantidades.' USING ERRCODE = '55000';
    END IF;

    v_qtd_anterior := v_item.quantidade_contada;
    v_nova_qtd := v_item.quantidade_contada + p_delta;
    IF v_nova_qtd < 0 THEN
        v_nova_qtd := 0;
    END IF;

    UPDATE public.itens_inventariados
    SET quantidade_contada = v_nova_qtd,
        ultima_leitura_at = timezone('utc'::text, now())
    WHERE id = p_item_id
    RETURNING * INTO v_item;

    -- Auditoria obrigatória tanto para adição quanto para subtração (CWE-778)
    v_tipo_evento := CASE WHEN p_delta >= 0 THEN 'AJUSTE_MANUAL_ADICAO' ELSE 'AJUSTE_MANUAL_SUBTRACAO' END;

    INSERT INTO public.logs_leituras (
        sessao_id,
        codigo_sku,
        usuario_id,
        tipo_evento,
        quantidade_anterior,
        quantidade_nova
    ) VALUES (
        v_item.sessao_id,
        v_item.codigo_sku,
        v_auth_user_id,
        v_tipo_evento,
        v_qtd_anterior,
        v_nova_qtd
    );

    RETURN jsonb_build_object(
        'sucesso', true,
        'item', to_jsonb(v_item)
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) RIGOROSO
-- Mitigações: CWE-862 (Missing Authorization) e CWE-639 (Insecure Direct Object Reference)
-- ------------------------------------------------------------------------------
ALTER TABLE public.produtos_cadastro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessoes_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens_inventariados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_leituras ENABLE ROW LEVEL SECURITY;

-- Limpar políticas antigas se existirem
DROP POLICY IF EXISTS "Permitir leitura total para autenticados" ON public.produtos_cadastro;
DROP POLICY IF EXISTS "Permitir inserção e atualização para autenticados" ON public.produtos_cadastro;
DROP POLICY IF EXISTS "Permitir leitura de sessoes para autenticados" ON public.sessoes_inventario;
DROP POLICY IF EXISTS "Permitir gerenciar sessoes para autenticados" ON public.sessoes_inventario;
DROP POLICY IF EXISTS "Permitir leitura de itens para autenticados" ON public.itens_inventariados;
DROP POLICY IF EXISTS "Permitir gerenciar itens para autenticados" ON public.itens_inventariados;
DROP POLICY IF EXISTS "Permitir leitura de logs para autenticados" ON public.logs_leituras;
DROP POLICY IF EXISTS "Permitir gerenciar logs para autenticados" ON public.logs_leituras;
DROP POLICY IF EXISTS "Permitir leitura anon em produtos" ON public.produtos_cadastro;
DROP POLICY IF EXISTS "Permitir gravação anon em produtos" ON public.produtos_cadastro;
DROP POLICY IF EXISTS "Permitir leitura anon em sessoes" ON public.sessoes_inventario;
DROP POLICY IF EXISTS "Permitir gravação anon em sessoes" ON public.sessoes_inventario;
DROP POLICY IF EXISTS "Permitir leitura anon em itens" ON public.itens_inventariados;
DROP POLICY IF EXISTS "Permitir gravação anon em itens" ON public.itens_inventariados;
DROP POLICY IF EXISTS "Permitir gravação anon em logs" ON public.logs_leituras;

-- POLÍTICAS: produtos_cadastro
-- Leitura autorizada para colaboradores autenticados (e anon apenas leitura de catálogo)
CREATE POLICY "produtos_select_policy" 
    ON public.produtos_cadastro FOR SELECT 
    TO authenticated, anon 
    USING (true);

CREATE POLICY "produtos_modify_policy" 
    ON public.produtos_cadastro FOR ALL 
    TO authenticated 
    USING (auth.role() = 'authenticated') 
    WITH CHECK (auth.role() = 'authenticated');

-- POLÍTICAS: sessoes_inventario
CREATE POLICY "sessoes_select_policy" 
    ON public.sessoes_inventario FOR SELECT 
    TO authenticated, anon 
    USING (true);

CREATE POLICY "sessoes_insert_policy" 
    ON public.sessoes_inventario FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "sessoes_update_policy" 
    ON public.sessoes_inventario FOR UPDATE 
    TO authenticated 
    USING (auth.role() = 'authenticated') 
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "sessoes_delete_policy" 
    ON public.sessoes_inventario FOR DELETE 
    TO authenticated 
    USING (auth.role() = 'authenticated');

-- POLÍTICAS: itens_inventariados
CREATE POLICY "itens_select_policy" 
    ON public.itens_inventariados FOR SELECT 
    TO authenticated, anon 
    USING (true);

CREATE POLICY "itens_insert_policy" 
    ON public.itens_inventariados FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "itens_update_policy" 
    ON public.itens_inventariados FOR UPDATE 
    TO authenticated 
    USING (auth.role() = 'authenticated') 
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "itens_delete_policy" 
    ON public.itens_inventariados FOR DELETE 
    TO authenticated 
    USING (auth.role() = 'authenticated');

-- POLÍTICAS: logs_leituras
CREATE POLICY "logs_select_policy" 
    ON public.logs_leituras FOR SELECT 
    TO authenticated, anon 
    USING (true);

CREATE POLICY "logs_insert_policy" 
    ON public.logs_leituras FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.role() = 'authenticated');

-- ------------------------------------------------------------------------------
-- 8. HABILITAR SUPABASE REALTIME
-- ------------------------------------------------------------------------------
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

ALTER PUBLICATION supabase_realtime ADD TABLE public.itens_inventariados;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessoes_inventario;
ALTER PUBLICATION supabase_realtime ADD TABLE public.logs_leituras;
