-- ============================================================
-- AgSUS - Novo perfil: gestor_edital
-- Patch aditivo sobre sql/01_permissoes_modulares.sql
--
-- Perfis apos este patch:
-- usuario | gestor_edital | contratador | admin
--
-- gestor_edital PODE:
--   - ver dashboards;
--   - ver a lista de aprovados (somente leitura);
--   - cadastrar novos editais.
--
-- gestor_edital NAO PODE:
--   - alterar o status dos aprovados;
--   - alterar ou inativar editais ja cadastrados;
--   - excluir editais;
--   - acessar Permissoes ou Configuracoes.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Aceitar o novo valor em tipo_permissao
--
-- Roda fora da transacao principal porque ALTER TYPE ... ADD VALUE
-- nao pode ser usado no mesmo bloco em que o valor e consumido.
-- Cobre os dois cenarios possiveis da coluna: enum ou texto com CHECK.
-- ------------------------------------------------------------

DO $tipo$
DECLARE
    v_tipo_coluna TEXT;
    v_nome_enum TEXT;
    v_constraint RECORD;
BEGIN
    SELECT c.data_type, c.udt_name
    INTO v_tipo_coluna, v_nome_enum
    FROM information_schema.columns c
    WHERE c.table_schema = 'gerenciamento_concursos'
      AND c.table_name = 'permissoes'
      AND c.column_name = 'tipo_permissao';

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Coluna gerenciamento_concursos.permissoes.tipo_permissao nao encontrada.';
    END IF;

    IF v_tipo_coluna = 'USER-DEFINED' THEN
        -- Coluna e um ENUM: acrescenta o rotulo se ainda nao existir.
        IF NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = v_nome_enum
              AND e.enumlabel = 'gestor_edital'
        ) THEN
            EXECUTE format(
                'ALTER TYPE %I ADD VALUE %L',
                v_nome_enum,
                'gestor_edital'
            );

            RAISE NOTICE
                'Valor gestor_edital adicionado ao enum %.', v_nome_enum;
        END IF;
    ELSE
        -- Coluna e texto: recria os CHECKs que listam os perfis aceitos.
        FOR v_constraint IN
            SELECT con.conname,
                   pg_get_constraintdef(con.oid) AS definicao
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'gerenciamento_concursos'
              AND rel.relname = 'permissoes'
              AND con.contype = 'c'
              AND pg_get_constraintdef(con.oid) ILIKE '%tipo_permissao%'
              AND pg_get_constraintdef(con.oid) NOT ILIKE '%gestor_edital%'
        LOOP
            EXECUTE format(
                'ALTER TABLE gerenciamento_concursos.permissoes '
                'DROP CONSTRAINT %I',
                v_constraint.conname
            );

            RAISE NOTICE
                'CHECK % removido (definicao antiga: %).',
                v_constraint.conname,
                v_constraint.definicao;
        END LOOP;

        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            WHERE nsp.nspname = 'gerenciamento_concursos'
              AND rel.relname = 'permissoes'
              AND con.contype = 'c'
              AND con.conname = 'permissoes_tipo_permissao_check'
        ) THEN
            ALTER TABLE gerenciamento_concursos.permissoes
                ADD CONSTRAINT permissoes_tipo_permissao_check
                CHECK (
                    tipo_permissao IN (
                        'usuario',
                        'gestor_edital',
                        'contratador',
                        'admin'
                    )
                );
        END IF;
    END IF;
END
$tipo$;


BEGIN;

-- ------------------------------------------------------------
-- 2. Normaliza os modulos do novo perfil
--
-- Um modulo pode restringir o perfil, nunca elevar privilegios.
-- ------------------------------------------------------------

UPDATE gerenciamento_concursos.permissoes
SET
    acesso_permissoes = FALSE,
    acesso_configuracoes = FALSE
WHERE tipo_permissao = 'gestor_edital';


-- ------------------------------------------------------------
-- 3. Acesso por modulo
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION gerenciamento_concursos_private.tem_acesso_modulo(
    p_modulo TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_permissao gerenciamento_concursos.permissoes%ROWTYPE;
    v_modulo TEXT;
BEGIN
    v_modulo := LOWER(BTRIM(COALESCE(p_modulo, '')));

    SELECT p.*
    INTO v_permissao
    FROM gerenciamento_concursos.permissoes p
    WHERE
        (
            p.auth_user_id = auth.uid()
            OR LOWER(p.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        )
    ORDER BY
        CASE WHEN p.auth_user_id = auth.uid() THEN 0 ELSE 1 END
    LIMIT 1;

    IF NOT FOUND OR v_permissao.ativo IS NOT TRUE THEN
        RETURN FALSE;
    END IF;

    IF v_permissao.tipo_permissao = 'admin' THEN
        RETURN v_modulo IN (
            'lista',
            'dashboards',
            'editais',
            'permissoes',
            'configuracoes'
        );
    END IF;

    -- Contratador e gestor de edital enxergam os mesmos modulos.
    -- A diferenca entre eles esta nas operacoes de escrita, tratadas
    -- pelas policies abaixo.
    IF v_permissao.tipo_permissao IN ('contratador', 'gestor_edital') THEN
        RETURN CASE v_modulo
            WHEN 'lista' THEN v_permissao.acesso_lista
            WHEN 'dashboards' THEN v_permissao.acesso_dashboards
            WHEN 'editais' THEN v_permissao.acesso_editais
            ELSE FALSE
        END;
    END IF;

    IF v_permissao.tipo_permissao = 'usuario' THEN
        RETURN CASE v_modulo
            WHEN 'lista' THEN v_permissao.acesso_lista
            WHEN 'dashboards' THEN v_permissao.acesso_dashboards
            ELSE FALSE
        END;
    END IF;

    RETURN FALSE;
END;
$$;


-- ------------------------------------------------------------
-- 4. RLS da Lista de aprovados
--
-- Leitura liberada para o novo perfil. As policies de INSERT,
-- UPDATE e DELETE continuam restritas a contratador/admin, de
-- modo que o gestor de edital nao altera status de aprovados.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS lista_select
ON gerenciamento_concursos.lista_aprovados;

CREATE POLICY lista_select
ON gerenciamento_concursos.lista_aprovados
FOR SELECT
TO authenticated
USING (
    gerenciamento_concursos_private.tem_acesso_modulo('lista')
    AND gerenciamento_concursos_private.tipo_permissao_atual()
        IN ('usuario', 'gestor_edital', 'contratador', 'admin')
);


-- ------------------------------------------------------------
-- 5. RLS de Editais
--
-- INSERT liberado para o gestor de edital.
-- UPDATE e DELETE permanecem fora do alcance dele: nao altera,
-- nao inativa e nao exclui editais ja cadastrados.
-- ------------------------------------------------------------

DROP POLICY IF EXISTS editais_insert
ON gerenciamento_concursos.editais;

CREATE POLICY editais_insert
ON gerenciamento_concursos.editais
FOR INSERT
TO authenticated
WITH CHECK (
    gerenciamento_concursos_private.tem_acesso_modulo('editais')
    AND gerenciamento_concursos_private.tipo_permissao_atual()
        IN ('gestor_edital', 'contratador', 'admin')
);

DROP POLICY IF EXISTS editais_update
ON gerenciamento_concursos.editais;

CREATE POLICY editais_update
ON gerenciamento_concursos.editais
FOR UPDATE
TO authenticated
USING (
    gerenciamento_concursos_private.tem_acesso_modulo('editais')
    AND gerenciamento_concursos_private.tipo_permissao_atual()
        IN ('contratador', 'admin')
)
WITH CHECK (
    gerenciamento_concursos_private.tem_acesso_modulo('editais')
    AND gerenciamento_concursos_private.tipo_permissao_atual()
        IN ('contratador', 'admin')
);


-- ------------------------------------------------------------
-- 6. Contexto de acesso consumido pela aplicacao
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION gerenciamento_concursos.obter_contexto_acesso()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_permissao gerenciamento_concursos.permissoes%ROWTYPE;
    v_admin BOOLEAN;
BEGIN
    SELECT p.*
    INTO v_permissao
    FROM gerenciamento_concursos.permissoes p
    WHERE
        (
            p.auth_user_id = auth.uid()
            OR LOWER(p.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
        )
    ORDER BY
        CASE WHEN p.auth_user_id = auth.uid() THEN 0 ELSE 1 END
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    v_admin := v_permissao.tipo_permissao = 'admin';

    RETURN jsonb_build_object(
        'id', v_permissao.id,
        'auth_user_id', v_permissao.auth_user_id,
        'email', v_permissao.email,
        'nome', v_permissao.nome,
        'tipo_permissao', v_permissao.tipo_permissao,
        'ativo', v_permissao.ativo,
        'modulos', jsonb_build_object(
            'lista', CASE
                WHEN v_admin THEN TRUE
                ELSE v_permissao.acesso_lista
            END,
            'dashboards', CASE
                WHEN v_admin THEN TRUE
                ELSE v_permissao.acesso_dashboards
            END,
            'editais', CASE
                WHEN v_admin THEN TRUE
                WHEN v_permissao.tipo_permissao
                    IN ('contratador', 'gestor_edital')
                    THEN v_permissao.acesso_editais
                ELSE FALSE
            END,
            'permissoes', CASE WHEN v_admin THEN TRUE ELSE FALSE END,
            'configuracoes', CASE WHEN v_admin THEN TRUE ELSE FALSE END
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION gerenciamento_concursos.obter_contexto_acesso()
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION gerenciamento_concursos.obter_contexto_acesso()
TO authenticated;


-- ------------------------------------------------------------
-- 7. RPC administrativa de cadastro/edicao de permissao
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION gerenciamento_concursos.salvar_permissao_usuario(
    p_id UUID,
    p_email TEXT,
    p_nome TEXT,
    p_tipo_permissao TEXT,
    p_ativo BOOLEAN,
    p_acesso_lista BOOLEAN,
    p_acesso_dashboards BOOLEAN,
    p_acesso_editais BOOLEAN,
    p_acesso_permissoes BOOLEAN,
    p_acesso_configuracoes BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_tipo_atual TEXT;
    v_email_atual TEXT;
    v_id UUID;
    v_existente gerenciamento_concursos.permissoes%ROWTYPE;
    v_admin_alvo BOOLEAN;
    v_gerencia_editais BOOLEAN;
BEGIN
    v_tipo_atual :=
        gerenciamento_concursos_private.tipo_permissao_atual();

    IF v_tipo_atual IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Apenas administradores podem gerenciar permissoes.';
    END IF;

    v_email_atual := LOWER(COALESCE(auth.jwt() ->> 'email', ''));

    IF NULLIF(BTRIM(p_email), '') IS NULL THEN
        RAISE EXCEPTION 'Informe o e-mail do usuario.';
    END IF;

    IF p_tipo_permissao NOT IN (
        'usuario',
        'gestor_edital',
        'contratador',
        'admin'
    ) THEN
        RAISE EXCEPTION 'Tipo de permissao invalido.';
    END IF;

    -- Resolve o registro por id ou pelo e-mail.
    IF p_id IS NOT NULL THEN
        SELECT p.*
        INTO v_existente
        FROM gerenciamento_concursos.permissoes p
        WHERE p.id = p_id;
    ELSE
        SELECT p.*
        INTO v_existente
        FROM gerenciamento_concursos.permissoes p
        WHERE LOWER(p.email) = LOWER(BTRIM(p_email))
        LIMIT 1;
    END IF;

    -- Impede o administrador de retirar o proprio acesso.
    IF FOUND
       AND LOWER(v_existente.email) = v_email_atual
       AND (
            LOWER(v_existente.email) IS DISTINCT FROM LOWER(BTRIM(p_email))
            OR v_existente.tipo_permissao IS DISTINCT FROM p_tipo_permissao
            OR v_existente.ativo IS DISTINCT FROM COALESCE(p_ativo, TRUE)
            OR v_existente.acesso_lista IS DISTINCT FROM COALESCE(p_acesso_lista, TRUE)
            OR v_existente.acesso_dashboards IS DISTINCT FROM COALESCE(p_acesso_dashboards, TRUE)
            OR v_existente.acesso_editais IS DISTINCT FROM COALESCE(p_acesso_editais, FALSE)
            OR v_existente.acesso_permissoes IS DISTINCT FROM COALESCE(p_acesso_permissoes, FALSE)
            OR v_existente.acesso_configuracoes IS DISTINCT FROM COALESCE(p_acesso_configuracoes, FALSE)
       )
    THEN
        RAISE EXCEPTION 'Voce nao pode alterar seu proprio perfil ou acessos.';
    END IF;

    v_admin_alvo := p_tipo_permissao = 'admin';

    v_gerencia_editais :=
        p_tipo_permissao IN ('contratador', 'gestor_edital');

    IF NOT v_admin_alvo
       AND COALESCE(p_ativo, TRUE)
       AND NOT (
            COALESCE(p_acesso_lista, FALSE)
            OR COALESCE(p_acesso_dashboards, FALSE)
            OR (
                v_gerencia_editais
                AND COALESCE(p_acesso_editais, FALSE)
            )
       )
    THEN
        RAISE EXCEPTION 'Selecione pelo menos um modulo para o usuario ativo.';
    END IF;

    IF v_existente.id IS NOT NULL THEN
        UPDATE gerenciamento_concursos.permissoes
        SET
            email = LOWER(BTRIM(p_email)),
            nome = NULLIF(BTRIM(p_nome), ''),
            tipo_permissao = p_tipo_permissao,
            ativo = CASE WHEN v_admin_alvo THEN TRUE ELSE COALESCE(p_ativo, TRUE) END,
            acesso_lista = CASE WHEN v_admin_alvo THEN TRUE ELSE COALESCE(p_acesso_lista, TRUE) END,
            acesso_dashboards = CASE WHEN v_admin_alvo THEN TRUE ELSE COALESCE(p_acesso_dashboards, TRUE) END,
            acesso_editais = CASE
                WHEN v_admin_alvo THEN TRUE
                WHEN v_gerencia_editais THEN COALESCE(p_acesso_editais, TRUE)
                ELSE FALSE
            END,
            acesso_permissoes = CASE WHEN v_admin_alvo THEN TRUE ELSE FALSE END,
            acesso_configuracoes = CASE WHEN v_admin_alvo THEN TRUE ELSE FALSE END
        WHERE id = v_existente.id
        RETURNING id INTO v_id;
    ELSE
        INSERT INTO gerenciamento_concursos.permissoes (
            email,
            nome,
            tipo_permissao,
            ativo,
            acesso_lista,
            acesso_dashboards,
            acesso_editais,
            acesso_permissoes,
            acesso_configuracoes
        )
        VALUES (
            LOWER(BTRIM(p_email)),
            NULLIF(BTRIM(p_nome), ''),
            p_tipo_permissao,
            CASE WHEN v_admin_alvo THEN TRUE ELSE COALESCE(p_ativo, TRUE) END,
            CASE WHEN v_admin_alvo THEN TRUE ELSE COALESCE(p_acesso_lista, TRUE) END,
            CASE WHEN v_admin_alvo THEN TRUE ELSE COALESCE(p_acesso_dashboards, TRUE) END,
            CASE
                WHEN v_admin_alvo THEN TRUE
                WHEN v_gerencia_editais THEN COALESCE(p_acesso_editais, TRUE)
                ELSE FALSE
            END,
            CASE WHEN v_admin_alvo THEN TRUE ELSE FALSE END,
            CASE WHEN v_admin_alvo THEN TRUE ELSE FALSE END
        )
        RETURNING id INTO v_id;

        INSERT INTO gerenciamento_concursos.logs (
            usuario_alterou,
            alteracoes
        )
        VALUES (
            COALESCE(auth.jwt() ->> 'email', 'sistema'),
            jsonb_build_object(
                'acao', 'CRIACAO_USUARIO',
                'usuario_permissao_id', v_id,
                'usuario_email', LOWER(BTRIM(p_email)),
                'usuario_nome', NULLIF(BTRIM(p_nome), ''),
                'tipo_permissao', p_tipo_permissao
            )
        );
    END IF;

    RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION gerenciamento_concursos.salvar_permissao_usuario(
    UUID, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN
)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION gerenciamento_concursos.salvar_permissao_usuario(
    UUID, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN
)
TO authenticated;

COMMIT;


-- ------------------------------------------------------------
-- 8. Diagnostico: RPCs SECURITY DEFINER com lista de perfis fixa
--
-- cadastrar_edital e importar_lista_aprovados nao fazem parte
-- deste repositorio. Se alguma delas validar o perfil por dentro,
-- o gestor de edital sera barrado apesar das policies acima.
-- O bloco abaixo apenas avisa; nao altera nada.
-- ------------------------------------------------------------

DO $diagnostico$
DECLARE
    v_funcao RECORD;
BEGIN
    FOR v_funcao IN
        SELECT n.nspname AS esquema,
               p.proname AS nome,
               p.prosrc AS fonte
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.proname IN (
            'cadastrar_edital',
            'importar_lista_aprovados'
        )
    LOOP
        IF v_funcao.fonte ILIKE '%contratador%'
           AND v_funcao.fonte NOT ILIKE '%gestor_edital%'
        THEN
            RAISE WARNING
                'A funcao %.% valida o perfil internamente e nao conhece gestor_edital. Revise-a se o gestor precisar executa-la.',
                v_funcao.esquema,
                v_funcao.nome;
        END IF;
    END LOOP;
END
$diagnostico$;


NOTIFY pgrst, 'reload schema';
