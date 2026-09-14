from __future__ import annotations

from datetime import datetime
from typing import Any, Iterable

import psycopg
from psycopg.rows import dict_row


class Banco:
    def __init__(self, database_url: str, schema: str):
        self.database_url = database_url
        self.schema = schema

    def conectar(self):
        return psycopg.connect(
            self.database_url,
            row_factory=dict_row,
        )

    def listar_fontes(
        self,
        edital_id: str | None = None,
        incluir_desabilitado: bool = False,
    ) -> list[dict[str, Any]]:
        filtros = [
            "f.pasta_analise_id IS NOT NULL",
            "btrim(f.pasta_analise_id) <> ''",
        ]

        params: list[Any] = []

        # -----------------------------------------------------
        # ETL habilitado
        # -----------------------------------------------------
        if not incluir_desabilitado:
            filtros.append("f.etl_habilitado = true")

        # -----------------------------------------------------
        # EXECUÇÃO MANUAL
        #
        # Quando edital_id é informado explicitamente,
        # permitimos executar o edital independentemente
        # de status e datas.
        #
        # Isso possibilita manutenção/reprocessamento de
        # editais encerrados.
        # -----------------------------------------------------
        if edital_id:
            filtros.append("f.edital_id = %s")
            params.append(edital_id)

        # -----------------------------------------------------
        # EXECUÇÃO AUTOMÁTICA
        #
        # Quando NÃO existe edital_id, somente editais ativos
        # e dentro do período entram na sincronização.
        #
        # A data final é inclusiva:
        # se data_fim = hoje, o edital ainda será processado.
        #
        # O horário de Brasília é utilizado explicitamente.
        # -----------------------------------------------------
        else:
            data_hoje = (
                "(now() AT TIME ZONE "
                "'America/Sao_Paulo')::date"
            )

            filtros.extend(
                [
                    "e.status_edital = true",
                    f"e.data_inicio <= {data_hoje}",
                    f"e.data_fim >= {data_hoje}",
                ]
            )

        sql = f"""
            SELECT
                f.edital_id,
                f.pasta_analise_id,
                f.etl_habilitado,
                f.ultima_sincronizacao,
                e.processo_seletivo,
                e.edital,
                e.unidade,
                e.status_edital,
                e.data_inicio,
                e.data_fim
            FROM {self.schema}.fontes_editais f
            JOIN {self.schema}.editais e
                ON e.id = f.edital_id
            WHERE {' AND '.join(filtros)}
            ORDER BY
                e.data_fim,
                e.edital,
                e.processo_seletivo
        """

        with self.conectar() as conn, conn.cursor() as cur:
            cur.execute(sql, params)
            return list(cur.fetchall())

    def obter_fonte_por_edital(
        self,
        edital_id: str,
    ) -> dict[str, Any] | None:
        fontes = self.listar_fontes(
            edital_id=edital_id,
            incluir_desabilitado=True,
        )

        return fontes[0] if fontes else None

    def obter_fonte_por_pasta(
        self,
        pasta_id: str,
    ) -> dict[str, Any] | None:
        sql = f"""
            SELECT
                f.edital_id,
                f.pasta_analise_id,
                f.etl_habilitado,
                f.ultima_sincronizacao,
                e.processo_seletivo,
                e.edital
            FROM {self.schema}.fontes_editais f
            JOIN {self.schema}.editais e
                ON e.id = f.edital_id
            WHERE f.pasta_analise_id = %s
            LIMIT 1
        """

        with self.conectar() as conn, conn.cursor() as cur:
            cur.execute(sql, (pasta_id,))
            return cur.fetchone()

    def obter_vaga_por_planilha(
        self,
        planilha_id: str,
    ) -> dict[str, Any] | None:
        sql = f"""
            SELECT *
            FROM {self.schema}.analise_curricular_vagas
            WHERE planilha_origem_id = %s
            LIMIT 1
        """

        with self.conectar() as conn, conn.cursor() as cur:
            cur.execute(sql, (planilha_id,))
            return cur.fetchone()

    def marcar_ausentes_como_inativas(
        self,
        edital_id: str,
        ids_presentes: Iterable[str],
    ) -> int:
        ids = list(ids_presentes)

        with self.conectar() as conn, conn.cursor() as cur:
            if ids:
                cur.execute(
                    f"""
                    UPDATE {self.schema}.analise_curricular_vagas
                    SET
                        ativo_na_fonte = false,
                        atualizado_em = now()
                    WHERE edital_id = %s
                      AND ativo_na_fonte = true
                      AND NOT (
                          planilha_origem_id = ANY(%s)
                      )
                    """,
                    (
                        edital_id,
                        ids,
                    ),
                )

            else:
                cur.execute(
                    f"""
                    UPDATE {self.schema}.analise_curricular_vagas
                    SET
                        ativo_na_fonte = false,
                        atualizado_em = now()
                    WHERE edital_id = %s
                      AND ativo_na_fonte = true
                    """,
                    (edital_id,),
                )

            return cur.rowcount

    def atualizar_status_fonte(
        self,
        edital_id: str,
        status: str,
        mensagem: str | None,
    ) -> None:
        with self.conectar() as conn, conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE {self.schema}.fontes_editais
                SET
                    ultima_sincronizacao = now(),
                    status_sincronizacao = %s,
                    mensagem_erro = %s,
                    atualizado_em = now()
                WHERE edital_id = %s
                """,
                (
                    status,
                    mensagem,
                    edital_id,
                ),
            )

    def sincronizar_vaga(
        self,
        *,
        fonte: dict[str, Any],
        arquivo: Any,
        vaga: Any,
        registros: list[dict[str, Any]],
        indicadores: Any,
        forcar: bool = False,
    ) -> dict[str, Any]:
        inicio = datetime.now().astimezone()

        if indicadores.total_aptos != len(registros):
            raise RuntimeError(
                "Inconsistencia interna: total_aptos difere "
                "da quantidade extraida de "
                "APTOS PARA ANÁLISE."
            )

        with self.conectar() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    f"""
                    SELECT
                        id,
                        edital_id,
                        drive_ultima_atualizacao,
                        qtd_registros
                    FROM {self.schema}.analise_curricular_vagas
                    WHERE planilha_origem_id = %s
                    FOR UPDATE
                    """,
                    (arquivo.id,),
                )

                existente = cur.fetchone()

                if (
                    existente
                    and str(existente["edital_id"])
                    != str(fonte["edital_id"])
                ):
                    raise RuntimeError(
                        "A mesma planilha_origem_id ja esta "
                        "vinculada a outro edital. "
                        "O vinculo nao sera alterado "
                        "automaticamente."
                    )

                if (
                    existente
                    and existente["drive_ultima_atualizacao"]
                    and arquivo.modified_time
                    <= existente["drive_ultima_atualizacao"]
                    and not forcar
                ):
                    return {
                        "status": "SEM_ALTERACAO",
                        "qtd": existente["qtd_registros"] or 0,
                    }

                cur.execute(
                    f"""
                    INSERT INTO
                        {self.schema}.analise_curricular_vagas (
                            edital_id,
                            codigo_vaga,
                            nome_vaga,
                            unidade,
                            regime,
                            carga_horaria,
                            planilha_origem_id,
                            link_planilha_origem,
                            nome_arquivo_origem,
                            drive_ultima_atualizacao,
                            ultima_sincronizacao,
                            qtd_registros,
                            total_inscritos,
                            total_aptos,
                            total_cancelados,
                            total_questionarios_pendentes,
                            total_reprovados_nota,
                            status_sync,
                            mensagem,
                            ativo_na_fonte
                        )
                    VALUES (
                        %(edital_id)s,
                        %(codigo_vaga)s,
                        %(nome_vaga)s,
                        %(unidade)s,
                        %(regime)s,
                        %(carga_horaria)s,
                        %(planilha_id)s,
                        %(link)s,
                        %(nome_arquivo)s,
                        %(modified_time)s,
                        now(),
                        %(qtd)s,
                        %(total_inscritos)s,
                        %(total_aptos)s,
                        %(total_cancelados)s,
                        %(total_questionarios_pendentes)s,
                        %(total_reprovados_nota)s,
                        'PROCESSANDO',
                        NULL,
                        true
                    )
                    ON CONFLICT (planilha_origem_id)
                    DO UPDATE SET
                        edital_id = EXCLUDED.edital_id,
                        codigo_vaga = EXCLUDED.codigo_vaga,

                        nome_vaga = COALESCE(
                            EXCLUDED.nome_vaga,
                            {self.schema}.analise_curricular_vagas.nome_vaga
                        ),

                        unidade = COALESCE(
                            EXCLUDED.unidade,
                            {self.schema}.analise_curricular_vagas.unidade
                        ),

                        regime = COALESCE(
                            EXCLUDED.regime,
                            {self.schema}.analise_curricular_vagas.regime
                        ),

                        carga_horaria = COALESCE(
                            EXCLUDED.carga_horaria,
                            {self.schema}.analise_curricular_vagas.carga_horaria
                        ),

                        link_planilha_origem =
                            EXCLUDED.link_planilha_origem,

                        nome_arquivo_origem =
                            EXCLUDED.nome_arquivo_origem,

                        drive_ultima_atualizacao =
                            EXCLUDED.drive_ultima_atualizacao,

                        ultima_sincronizacao = now(),

                        qtd_registros =
                            EXCLUDED.qtd_registros,

                        total_inscritos =
                            EXCLUDED.total_inscritos,

                        total_aptos =
                            EXCLUDED.total_aptos,

                        total_cancelados =
                            EXCLUDED.total_cancelados,

                        total_questionarios_pendentes =
                            EXCLUDED.total_questionarios_pendentes,

                        total_reprovados_nota =
                            EXCLUDED.total_reprovados_nota,

                        status_sync = 'PROCESSANDO',
                        mensagem = NULL,
                        ativo_na_fonte = true,
                        atualizado_em = now()

                    RETURNING id
                    """,
                    {
                        "edital_id": fonte["edital_id"],
                        "codigo_vaga": vaga.codigo_vaga,
                        "nome_vaga": vaga.nome_vaga,
                        "unidade": vaga.unidade,
                        "regime": vaga.regime,
                        "carga_horaria": vaga.carga_horaria,
                        "planilha_id": arquivo.id,
                        "link": arquivo.web_view_link,
                        "nome_arquivo": arquivo.nome,
                        "modified_time": arquivo.modified_time,
                        "qtd": len(registros),
                        **indicadores.as_dict(),
                    },
                )

                vaga_id = cur.fetchone()["id"]

                cur.execute(
                    f"""
                    SELECT count(*) AS qtd
                    FROM
                        {self.schema}.analise_curricular_candidatos
                    WHERE vaga_id = %s
                    """,
                    (vaga_id,),
                )

                qtd_anterior = cur.fetchone()["qtd"]

                if qtd_anterior > 0 and len(registros) == 0:
                    raise RuntimeError(
                        "Extracao retornou 0 registros para "
                        "uma origem que ja possuia "
                        f"{qtd_anterior} registro(s). "
                        "Substituicao bloqueada para "
                        "preservar os dados."
                    )

                cur.execute(
                    f"""
                    DELETE FROM
                        {self.schema}.analise_curricular_candidatos
                    WHERE vaga_id = %s
                    """,
                    (vaga_id,),
                )

                if registros:
                    colunas = [
                        "edital_id",
                        "vaga_id",
                        "linha_origem",
                        "candidato",
                        "codigo_candidato",
                        "data_nascimento",
                        "idade",
                        "nota_empregare",
                        "modalidade_concorrencia",
                        "nota_final_ajustada",
                        "somatorio",
                        "pontuacao_escolaridade",
                        "pontuacao_cursos_aperfeicoamento",
                        "pontuacao_experiencia_profissional",
                        "pontuacao_criterio_etnico",
                        "experiencia_profissional_anos",
                        "experiencia_profissional_meses",
                        "experiencia_profissional_dias",
                        "experiencia_profissional_total",
                        "experiencia_saude_indigena_anos",
                        "experiencia_saude_indigena_meses",
                        "experiencia_saude_indigena_dias",
                        "experiencia_saude_indigena_total",
                        "experiencia_atencao_basica_anos",
                        "experiencia_atencao_basica_meses",
                        "experiencia_atencao_basica_dias",
                        "experiencia_atencao_basica_total",
                        "etapa",
                        "data_analise",
                        "analise",
                        "pcd",
                        "responsavel_analise",
                        "coord_demandante",
                        "email_demandante",
                        "status_consolidado",
                        "hash_registro",
                    ]

                    placeholders = ", ".join(
                        ["%s"] * len(colunas)
                    )

                    sql_insert = f"""
                        INSERT INTO
                            {self.schema}.analise_curricular_candidatos
                            ({', '.join(colunas)})
                        VALUES ({placeholders})
                    """

                    dados = []

                    for registro in registros:
                        item = {
                            "edital_id": fonte["edital_id"],
                            "vaga_id": vaga_id,
                            **registro,
                        }

                        dados.append(
                            tuple(
                                item.get(coluna)
                                for coluna in colunas
                            )
                        )

                    cur.executemany(
                        sql_insert,
                        dados,
                    )

                cur.execute(
                    f"""
                    UPDATE {self.schema}.analise_curricular_vagas
                    SET
                        ultima_sincronizacao = now(),
                        qtd_registros = %s,
                        status_sync = 'SINCRONIZADO',
                        mensagem = NULL,
                        ativo_na_fonte = true,
                        atualizado_em = now()
                    WHERE id = %s
                    """,
                    (
                        len(registros),
                        vaga_id,
                    ),
                )

                cur.execute(
                    f"""
                    INSERT INTO
                        {self.schema}.analise_curricular_sync_log (
                            edital_id,
                            vaga_id,
                            planilha_origem_id,
                            status,
                            qtd_registros,
                            iniciado_em,
                            finalizado_em
                        )
                    VALUES (
                        %s,
                        %s,
                        %s,
                        'SUCESSO',
                        %s,
                        %s,
                        now()
                    )
                    """,
                    (
                        fonte["edital_id"],
                        vaga_id,
                        arquivo.id,
                        len(registros),
                        inicio,
                    ),
                )

            conn.commit()

        return {
            "status": "SINCRONIZADO",
            "qtd": len(registros),
            "vaga_id": str(vaga_id),
            "indicadores": indicadores.as_dict(),
        }

    def registrar_erro(
        self,
        fonte: dict[str, Any] | None,
        arquivo: Any | None,
        mensagem: str,
    ) -> None:
        edital_id = (
            fonte.get("edital_id")
            if fonte
            else None
        )

        planilha_id = (
            arquivo.id
            if arquivo
            else None
        )

        with self.conectar() as conn, conn.cursor() as cur:
            vaga_id = None

            if planilha_id:
                cur.execute(
                    f"""
                    SELECT id
                    FROM {self.schema}.analise_curricular_vagas
                    WHERE planilha_origem_id = %s
                    LIMIT 1
                    """,
                    (planilha_id,),
                )

                row = cur.fetchone()

                vaga_id = (
                    row["id"]
                    if row
                    else None
                )

                if vaga_id:
                    cur.execute(
                        f"""
                        UPDATE
                            {self.schema}.analise_curricular_vagas
                        SET
                            status_sync = 'ERRO',
                            mensagem = %s,
                            ultima_sincronizacao = now(),
                            atualizado_em = now()
                        WHERE id = %s
                        """,
                        (
                            mensagem[:4000],
                            vaga_id,
                        ),
                    )

            cur.execute(
                f"""
                INSERT INTO
                    {self.schema}.analise_curricular_sync_log (
                        edital_id,
                        vaga_id,
                        planilha_origem_id,
                        status,
                        mensagem,
                        iniciado_em,
                        finalizado_em
                    )
                VALUES (
                    %s,
                    %s,
                    %s,
                    'ERRO',
                    %s,
                    now(),
                    now()
                )
                """,
                (
                    edital_id,
                    vaga_id,
                    planilha_id,
                    mensagem[:4000],
                ),
            )