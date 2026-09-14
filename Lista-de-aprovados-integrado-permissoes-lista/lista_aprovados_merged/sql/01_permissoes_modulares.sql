-- ============================================================
-- AgSUS - Permissoes modulares
-- Patch aditivo para o schema gerenciamento_concursos
-- Mantem os perfis operacionais existentes:
-- usuario | contratador | admin
-- ============================================================

BEGIN;

DO $migration$
DECLARE
    v_acesso_editais_existia BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'gerenciamento_concursos'
          AND table_name = 'permissoes'
          AND column_name = 'acesso_editais'
    )
    INTO v_acesso_editais_existia;

    ALTER TABLE gerenciamento_concursos.permissoes
        ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS acesso_lista BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS acesso_dashboards BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS acesso_editais BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS acesso_permissoes BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS acesso_configuracoes BOOLEAN NOT NULL DEFAULT FALSE;

    -- Na primeira instalacao, contratadores preservam o comportamento antigo
    -- de acesso ao gerenciamento de editais. Em reexecucoes, escolhas manuais
    -- ja existentes nao sao sobrescritas.
    IF NOT v_acesso_editais_existia THEN
        UPDATE gerenciamento_concursos.permissoes
        SET acesso_editais = TRUE
        WHERE tipo_permissao = 'contratador';
    END IF;

    -- Um modulo pode restringir o perfil, nunca elevar seus privilegios.
    UPDATE gerenciamento_concursos.permissoes
    SET
        acesso_editais = FALSE,
        acesso_permissoes = FALSE,
        acesso_configuracoes = FALSE
    WHERE tipo_permissao = 'usuario';

    UPDATE gerenciamento_concursos.permissoes
    SET
        acesso_permissoes = FALSE,
        acesso_configuracoes = FALSE
    WHERE tipo_permissao = 'contratador';

    -- Admin sempre possui todos os modulos e permanece ativo.
    UPDATE gerenciamento_concursos.permissoes
    SET
        ativo = TRUE,
        acesso_lista = TRUE,
        acesso_dashboards = TRUE,
        acesso_editais = TRUE,
        acesso_permissoes = TRUE,
        acesso_configuracoes = TRUE
    WHERE tipo_permissao = 'admin';
END
$migration$;


-- ============================================================
-- Perfil atual: usuario inativo deixa de receber privilegios
-- Todas as policies existentes que usam esta funcao passam a
-- respeitar a inativacao sem precisar ser reescritas uma a uma.
-- ============================================================

CREATE OR REPLACE FUNCTION gerenciamento_concursos_private.tipo_permissao_atual()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT p.tipo_permissao
    FROM gerenciamento_concursos.permissoes p
    WHERE p.ativo IS TRUE
      AND (
          p.auth_user_id = auth.uid()
          OR LOWER(p.email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
      )
    ORDER BY CASE WHEN p.auth_user_id = auth.uid() THEN 0 ELSE 1 END
    LIMIT 1;
$$;


-- ============================================================
-- Helper privado: verifica acesso ao modulo
-- ============================================================

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

    IF v_permissao.tipo_permissao = 'contratador' THEN
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


-- ============================================================
-- RLS: o modulo Lista passa a ser tambem uma regra de dados.
-- A leitura de editais continua compartilhada porque a Lista e
-- os dashboards dependem desses metadados; somente a gestao de
-- editais exige o modulo editais.
-- ============================================================

DROP POLICY IF EXISTS lista_select
ON gerenciamento_concursos.lista_aprovados;

CREATE POLICY lista_select
ON gerenciamento_concursos.lista_aprovados
FOR SELECT
TO authenticated
USING (
    gerenciamento_concursos_private.tem_acesso_modulo('lista')
    AND gerenciamento_concursos_private.tipo_permissao_atual()
        IN ('usuario', 'contratador', 'admin')
);

DROP POLICY IF EXISTS lista_insert
ON gerenciamento_concursos.lista_aprovados;

CREATE POLICY lista_insert
ON gerenciamento_concursos.lista_aprovados
FOR INSERT
TO authenticated
WITH CHECK (
    gerenciamento_concursos_private.tem_acesso_modulo('lista')
    AND gerenciamento_concursos_private.tipo_permissao_atual()
        IN ('contratador', 'admin')
);

DROP POLICY IF EXISTS lista_update
ON gerenciamento_concursos.lista_aprovados;

CREATE POLICY lista_update
ON gerenciamento_concursos.lista_aprovados
FOR UPDATE
TO authenticated
USING (
    gerenciamento_concursos_private.tem_acesso_modulo('lista')
    AND gerenciamento_concursos_private.tipo_permissao_atual()
        IN ('contratador', 'admin')
)
WITH CHECK (
    gerenciamento_concursos_private.tem_acesso_modulo('lista')
    AND gerenciamento_concursos_private.tipo_permissao_atual()
        IN ('contratador', 'admin')
);

DROP POLICY IF EXISTS "Contratador excluir sub judice"
ON gerenciamento_concursos.lista_aprovados;

CREATE POLICY "Contratador excluir sub judice"
ON gerenciamento_concursos.lista_aprovados
FOR DELETE
TO authenticated
USING (
    sub_judice IS TRUE
    AND gerenciamento_concursos_private.tem_acesso_modulo('lista')
    AND gerenciamento_concursos_private.tipo_permissao_atual()
        IN ('contratador', 'admin')
);

DROP POLICY IF EXISTS lista_delete
ON gerenciamento_concursos.lista_aprovados;

CREATE POLICY lista_delete
ON gerenciamento_concursos.lista_aprovados
FOR DELETE
TO authenticated
USING (
    gerenciamento_concursos_private.tem_acesso_modulo('lista')
    AND gerenciamento_concursos_private.tipo_permissao_atual() = 'admin'
);

DROP POLICY IF EXISTS editais_insert
ON gerenciamento_concursos.editais;

CREATE POLICY editais_insert
ON gerenciamento_concursos.editais
FOR INSERT
TO authenticated
WITH CHECK (
    gerenciamento_concursos_private.tem_acesso_modulo('editais')
    AND gerenciamento_concursos_private.tipo_permissao_atual()
        IN ('contratador', 'admin')
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

DROP POLICY IF EXISTS editais_delete
ON gerenciamento_concursos.editais;

CREATE POLICY editais_delete
ON gerenciamento_concursos.editais
FOR DELETE
TO authenticated
USING (
    gerenciamento_concursos_private.tem_acesso_modulo('editais')
    AND gerenciamento_concursos_private.tipo_permissao_atual() = 'admin'
);


-- ============================================================
-- RPC: contexto de acesso em uma unica chamada
-- Inspirado no sistema anterior, sem carregar a arquitetura antiga.
-- ============================================================

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
                WHEN v_permissao.tipo_permissao = 'contratador' THEN v_permissao.acesso_editais
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


-- ============================================================
-- RPC administrativa para cadastrar/editar permissao
-- p_id NULL = novo usuario (ou atualiza pelo e-mail se ja existir)
-- ============================================================

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

    IF p_tipo_permissao NOT IN ('usuario', 'contratador', 'admin') THEN
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

    IF NOT v_admin_alvo
       AND COALESCE(p_ativo, TRUE)
       AND NOT (
            COALESCE(p_acesso_lista, FALSE)
            OR COALESCE(p_acesso_dashboards, FALSE)
            OR (
                p_tipo_permissao = 'contratador'
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
                WHEN p_tipo_permissao = 'contratador' THEN COALESCE(p_acesso_editais, TRUE)
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
                WHEN p_tipo_permissao = 'contratador' THEN COALESCE(p_acesso_editais, TRUE)
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


-- ============================================================
-- Reforca protecao contra autoedicao
-- ============================================================

CREATE OR REPLACE FUNCTION
gerenciamento_concursos_private.bloquear_alteracao_propria_permissao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
    v_email_usuario TEXT;
BEGIN
    v_email_usuario := auth.jwt() ->> 'email';

    -- SQL Editor / manutencao administrativa.
    IF v_email_usuario IS NULL THEN
        RETURN NEW;
    END IF;

    IF LOWER(OLD.email) = LOWER(v_email_usuario)
       AND (
            LOWER(OLD.email) IS DISTINCT FROM LOWER(NEW.email)
            OR OLD.tipo_permissao IS DISTINCT FROM NEW.tipo_permissao
            OR OLD.ativo IS DISTINCT FROM NEW.ativo
            OR OLD.acesso_lista IS DISTINCT FROM NEW.acesso_lista
            OR OLD.acesso_dashboards IS DISTINCT FROM NEW.acesso_dashboards
            OR OLD.acesso_editais IS DISTINCT FROM NEW.acesso_editais
            OR OLD.acesso_permissoes IS DISTINCT FROM NEW.acesso_permissoes
            OR OLD.acesso_configuracoes IS DISTINCT FROM NEW.acesso_configuracoes
       )
    THEN
        RAISE EXCEPTION 'Voce nao pode alterar seu proprio perfil ou acessos.';
    END IF;

    RETURN NEW;
END;
$$;


-- ============================================================
-- Auditoria ampliada
-- ============================================================

CREATE OR REPLACE FUNCTION
gerenciamento_concursos_private.log_alteracao_permissao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
    IF
        OLD.tipo_permissao IS DISTINCT FROM NEW.tipo_permissao
        OR OLD.ativo IS DISTINCT FROM NEW.ativo
        OR OLD.acesso_lista IS DISTINCT FROM NEW.acesso_lista
        OR OLD.acesso_dashboards IS DISTINCT FROM NEW.acesso_dashboards
        OR OLD.acesso_editais IS DISTINCT FROM NEW.acesso_editais
        OR OLD.acesso_permissoes IS DISTINCT FROM NEW.acesso_permissoes
        OR OLD.acesso_configuracoes IS DISTINCT FROM NEW.acesso_configuracoes
    THEN
        INSERT INTO gerenciamento_concursos.logs (
            alteracoes,
            usuario_alterou
        )
        VALUES (
            jsonb_build_object(
                'acao', 'ALTERACAO_PERMISSAO',
                'usuario_permissao_id', NEW.id,
                'usuario_email_alterado', NEW.email,
                'usuario_nome_alterado', NEW.nome,
                'antes', jsonb_build_object(
                    'tipo_permissao', OLD.tipo_permissao,
                    'ativo', OLD.ativo,
                    'lista', OLD.acesso_lista,
                    'dashboards', OLD.acesso_dashboards,
                    'editais', OLD.acesso_editais,
                    'permissoes', OLD.acesso_permissoes,
                    'configuracoes', OLD.acesso_configuracoes
                ),
                'depois', jsonb_build_object(
                    'tipo_permissao', NEW.tipo_permissao,
                    'ativo', NEW.ativo,
                    'lista', NEW.acesso_lista,
                    'dashboards', NEW.acesso_dashboards,
                    'editais', NEW.acesso_editais,
                    'permissoes', NEW.acesso_permissoes,
                    'configuracoes', NEW.acesso_configuracoes
                ),
                'usuario_id', auth.uid()
            ),
            COALESCE(auth.jwt() ->> 'email', 'sistema')
        );
    END IF;

    RETURN NEW;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
