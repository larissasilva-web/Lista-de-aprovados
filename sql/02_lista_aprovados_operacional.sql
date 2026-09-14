-- ============================================================
-- AgSUS - Lista de Aprovados operacional
-- View normalizada + RPCs de filtros e KPIs
-- Nao duplica unidade na lista_aprovados: usa editais.unidade.
-- ============================================================

BEGIN;

DROP VIEW IF EXISTS gerenciamento_concursos.vw_lista_aprovados_operacional;

CREATE VIEW gerenciamento_concursos.vw_lista_aprovados_operacional
WITH (security_invoker = true)
AS
SELECT
    l.id,
    l.edital_id,
    l.processo_seletivo,
    l.edital,
    e.unidade,
    e.status_edital,
    e.data_inicio AS edital_data_inicio,
    e.data_fim AS edital_data_fim,
    e.prazo_validade,
    l.codigo_vaga,
    l.cargo,
    l.classificacao,
    l.nota,
    l.nome,
    l.modalidade_candidatura,
    l.status,
    l.processo_sei,
    l.matricula,
    l.data_contratacao,
    l.sub_judice,
    l.origem_cadastro
FROM gerenciamento_concursos.lista_aprovados l
JOIN gerenciamento_concursos.editais e
    ON e.id = l.edital_id;

GRANT SELECT
ON gerenciamento_concursos.vw_lista_aprovados_operacional
TO authenticated;


-- ============================================================
-- Opcoes para filtros
-- ============================================================

CREATE OR REPLACE FUNCTION
gerenciamento_concursos.obter_opcoes_lista_aprovados()
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    SELECT jsonb_build_object(
        'unidades',
        COALESCE(
            (
                SELECT jsonb_agg(x.unidade ORDER BY x.unidade)
                FROM (
                    SELECT DISTINCT e.unidade
                    FROM gerenciamento_concursos.editais e
                    JOIN gerenciamento_concursos.lista_aprovados l
                        ON l.edital_id = e.id
                    WHERE e.unidade IS NOT NULL
                      AND BTRIM(e.unidade) <> ''
                ) x
            ),
            '[]'::jsonb
        ),

        'editais',
        COALESCE(
            (
                SELECT jsonb_agg(to_jsonb(x) ORDER BY x.edital, x.unidade)
                FROM (
                    SELECT DISTINCT
                        e.id,
                        e.edital,
                        e.processo_seletivo,
                        e.unidade,
                        e.status_edital
                    FROM gerenciamento_concursos.editais e
                    JOIN gerenciamento_concursos.lista_aprovados l
                        ON l.edital_id = e.id
                ) x
            ),
            '[]'::jsonb
        ),

        'cargos',
        COALESCE(
            (
                SELECT jsonb_agg(x.cargo ORDER BY x.cargo)
                FROM (
                    SELECT DISTINCT l.cargo
                    FROM gerenciamento_concursos.lista_aprovados l
                    WHERE l.cargo IS NOT NULL
                      AND BTRIM(l.cargo) <> ''
                ) x
            ),
            '[]'::jsonb
        ),

        'codigos_vaga',
        COALESCE(
            (
                SELECT jsonb_agg(x.codigo_vaga ORDER BY x.codigo_vaga)
                FROM (
                    SELECT DISTINCT l.codigo_vaga
                    FROM gerenciamento_concursos.lista_aprovados l
                    WHERE l.codigo_vaga IS NOT NULL
                      AND BTRIM(l.codigo_vaga) <> ''
                ) x
            ),
            '[]'::jsonb
        ),

        'status',
        COALESCE(
            (
                SELECT jsonb_agg(x.status ORDER BY x.status)
                FROM (
                    SELECT DISTINCT l.status
                    FROM gerenciamento_concursos.lista_aprovados l
                    WHERE l.status IS NOT NULL
                      AND BTRIM(l.status) <> ''
                ) x
            ),
            '[]'::jsonb
        )
    );
$$;

REVOKE ALL
ON FUNCTION gerenciamento_concursos.obter_opcoes_lista_aprovados()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION gerenciamento_concursos.obter_opcoes_lista_aprovados()
TO authenticated;


-- ============================================================
-- Resumo/KPIs com os mesmos filtros da tela
-- ============================================================

CREATE OR REPLACE FUNCTION
gerenciamento_concursos.resumo_lista_aprovados(
    p_edital_id UUID,
    p_unidade TEXT,
    p_cargo TEXT,
    p_codigo_vaga TEXT,
    p_status TEXT,
    p_busca TEXT,
    p_sub_judice BOOLEAN
)
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
    WITH base AS (
        SELECT l.*
        FROM gerenciamento_concursos.lista_aprovados l
        JOIN gerenciamento_concursos.editais e
            ON e.id = l.edital_id
        WHERE
            (p_edital_id IS NULL OR l.edital_id = p_edital_id)
            AND (
                NULLIF(BTRIM(p_unidade), '') IS NULL
                OR e.unidade = BTRIM(p_unidade)
            )
            AND (
                NULLIF(BTRIM(p_cargo), '') IS NULL
                OR l.cargo = BTRIM(p_cargo)
            )
            AND (
                NULLIF(BTRIM(p_codigo_vaga), '') IS NULL
                OR l.codigo_vaga = BTRIM(p_codigo_vaga)
            )
            AND (
                NULLIF(BTRIM(p_status), '') IS NULL
                OR l.status = BTRIM(p_status)
            )
            AND (
                p_sub_judice IS NULL
                OR l.sub_judice = p_sub_judice
            )
            AND (
                NULLIF(BTRIM(p_busca), '') IS NULL
                OR l.nome ILIKE '%' || BTRIM(p_busca) || '%'
                OR COALESCE(l.matricula, '') ILIKE '%' || BTRIM(p_busca) || '%'
                OR COALESCE(l.processo_sei, '') ILIKE '%' || BTRIM(p_busca) || '%'
            )
    )
    SELECT jsonb_build_object(
        'total', COUNT(*),
        'aprovado', COUNT(*) FILTER (WHERE status = 'Aprovado'),
        'convocado', COUNT(*) FILTER (WHERE status = 'Convocado'),
        'contratado', COUNT(*) FILTER (WHERE status = 'Contratado'),
        'desistente', COUNT(*) FILTER (WHERE status = 'Desistente'),
        'documentacao_rejeitada',
            COUNT(*) FILTER (WHERE status = 'Documentação Rejeitada'),
        'migracao', COUNT(*) FILTER (WHERE status = 'Migração'),
        'sub_judice', COUNT(*) FILTER (WHERE sub_judice IS TRUE)
    )
    FROM base;
$$;

REVOKE ALL
ON FUNCTION gerenciamento_concursos.resumo_lista_aprovados(
    UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION gerenciamento_concursos.resumo_lista_aprovados(
    UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN
)
TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
