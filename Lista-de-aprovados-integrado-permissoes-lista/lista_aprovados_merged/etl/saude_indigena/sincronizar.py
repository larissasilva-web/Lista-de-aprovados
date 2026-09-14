import sys

import psycopg

from carga import (
    PGHOST,
    PGPORT,
    PGDATABASE,
    PGUSER,
    PGPASSWORD,
    PGSSLMODE,
    ler_planilha,
    transformar,
    localizar_duplicidades,
)


# ============================================================
# PREPARAR DADOS
# ============================================================

def preparar_dados():

    print(
        "Lendo a planilha..."
    )

    linhas = ler_planilha()

    registros, erros = transformar(
        linhas
    )

    duplicidades = localizar_duplicidades(
        registros
    )

    print(
        f"Registros válidos: "
        f"{len(registros)}"
    )

    print(
        f"Erros: "
        f"{len(erros)}"
    )

    print(
        "Duplicidades Edital + Vaga: "
        f"{len(duplicidades)}"
    )

    if erros:

        print(
            "\nCarga cancelada. "
            "Existem erros:"
        )

        for erro in erros[:30]:

            print(
                f" - {erro}"
            )

        raise RuntimeError(
            "A fonte possui "
            "registros inválidos."
        )

    if duplicidades:

        print(
            "\nCarga cancelada. "
            "Existem duplicidades:"
        )

        for (
            edital,
            vaga,
        ), quantidade in (
            duplicidades.items()
        ):

            print(
                f" - Edital {edital} / "
                f"Vaga {vaga}: "
                f"{quantidade} registros"
            )

        raise RuntimeError(
            "A fonte possui "
            "chaves duplicadas."
        )

    if not registros:

        raise RuntimeError(
            "Nenhum registro válido "
            "encontrado. "
            "Carga cancelada por segurança."
        )

    return registros


# ============================================================
# TOTAIS DA FONTE
# ============================================================

def calcular_totais(registros):

    return {

        "inscritos": sum(
            r["inscritos"] or 0
            for r in registros
        ),

        "aptos": sum(
            r["aptos_para_analise"] or 0
            for r in registros
        ),

        "cancelados": sum(
            r["cancelados"] or 0
            for r in registros
        ),

        "questionario": sum(
            r[
                "reprovados_nao_finalizar_questionario"
            ] or 0
            for r in registros
        ),

        "eliminados_nota": sum(
            r["eliminados_por_nota"] or 0
            for r in registros
        ),

        "reprovados_analise": sum(
            r["reprovados_analise"] or 0
            for r in registros
        ),

        "triados": sum(
            r["triados"] or 0
            for r in registros
        ),

        # --------------------------------------------
        # ENTREVISTAS - LEGADO
        # --------------------------------------------

        "vagas_com_legado": sum(
            1
            for r in registros
            if r[
                "total_convocados_entrevista_legado"
            ] is not None
        ),

        "vagas_com_convocados": sum(
            1
            for r in registros
            if (
                r[
                    "total_convocados_entrevista_legado"
                ] is not None
                and
                r[
                    "total_convocados_entrevista_legado"
                ] > 0
            )
        ),

        "convocados_legado": sum(
            r[
                "total_convocados_entrevista_legado"
            ] or 0
            for r in registros
        ),
    }


# ============================================================
# SINCRONIZAÇÃO
# ============================================================

def sincronizar(registros):

    totais_fonte = calcular_totais(
        registros
    )

    print(
        "\nConectando ao PostgreSQL..."
    )

    with psycopg.connect(
        host=PGHOST,
        port=PGPORT,
        dbname=PGDATABASE,
        user=PGUSER,
        password=PGPASSWORD,
        sslmode=PGSSLMODE,
        connect_timeout=15,
    ) as conn:

        try:

            with conn.cursor() as cursor:

                # ============================================
                # 1. INATIVAR REGISTROS ANTERIORES
                # ============================================

                print(
                    "Marcando registros anteriores "
                    "como inativos..."
                )

                cursor.execute("""
                    UPDATE
                        gerenciamento_concursos
                        .analise_curricular_saude_indigena
                    SET
                        ativo_na_fonte = false
                    WHERE
                        ativo_na_fonte = true;
                """)

                # ============================================
                # 2. UPSERT
                # ============================================

                print(
                    f"Sincronizando "
                    f"{len(registros)} registros..."
                )

                sql_upsert = """
                    INSERT INTO
                        gerenciamento_concursos
                        .analise_curricular_saude_indigena
                    (
                        codigo_vaga,
                        edital,
                        nome_dsei,
                        cargo,

                        inscritos,
                        aptos_para_analise,
                        cancelados,
                        reprovados_nao_finalizar_questionario,
                        eliminados_por_nota,
                        reprovados_analise,
                        triados,

                        total_convocados_entrevista_legado,

                        observacao,
                        linha_origem,

                        ativo_na_fonte,
                        sincronizado_em
                    )

                    VALUES
                    (
                        %(codigo_vaga)s,
                        %(edital)s,
                        %(nome_dsei)s,
                        %(cargo)s,

                        %(inscritos)s,
                        %(aptos_para_analise)s,
                        %(cancelados)s,
                        %(reprovados_nao_finalizar_questionario)s,
                        %(eliminados_por_nota)s,
                        %(reprovados_analise)s,
                        %(triados)s,

                        %(total_convocados_entrevista_legado)s,

                        %(observacao)s,
                        %(linha_origem)s,

                        true,
                        now()
                    )

                    ON CONFLICT (
                        edital,
                        codigo_vaga
                    )

                    DO UPDATE SET

                        nome_dsei =
                            EXCLUDED.nome_dsei,

                        cargo =
                            EXCLUDED.cargo,

                        inscritos =
                            EXCLUDED.inscritos,

                        aptos_para_analise =
                            EXCLUDED.aptos_para_analise,

                        cancelados =
                            EXCLUDED.cancelados,

                        reprovados_nao_finalizar_questionario =
                            EXCLUDED.reprovados_nao_finalizar_questionario,

                        eliminados_por_nota =
                            EXCLUDED.eliminados_por_nota,

                        reprovados_analise =
                            EXCLUDED.reprovados_analise,

                        triados =
                            EXCLUDED.triados,

                        total_convocados_entrevista_legado =
                            EXCLUDED.total_convocados_entrevista_legado,

                        observacao =
                            EXCLUDED.observacao,

                        linha_origem =
                            EXCLUDED.linha_origem,

                        ativo_na_fonte =
                            true,

                        sincronizado_em =
                            now();
                """

                cursor.executemany(
                    sql_upsert,
                    registros,
                )

                # ============================================
                # 3. VALIDAR QUANTIDADE DE REGISTROS
                # ============================================

                cursor.execute("""
                    SELECT
                        COUNT(*)

                    FROM
                        gerenciamento_concursos
                        .analise_curricular_saude_indigena

                    WHERE
                        ativo_na_fonte = true;
                """)

                total_ativos = (
                    cursor.fetchone()[0]
                )

                print(
                    "Registros ativos após carga: "
                    f"{total_ativos}"
                )

                if (
                    total_ativos
                    != len(registros)
                ):

                    raise RuntimeError(
                        "Quantidade de registros "
                        "no banco não corresponde "
                        "à fonte. "
                        f"Fonte={len(registros)} / "
                        f"Banco={total_ativos}"
                    )

                # ============================================
                # 4. VALIDAR TOTAIS NO BANCO
                # ============================================

                cursor.execute("""
                    SELECT

                        COALESCE(
                            SUM(inscritos),
                            0
                        ),

                        COALESCE(
                            SUM(aptos_para_analise),
                            0
                        ),

                        COALESCE(
                            SUM(cancelados),
                            0
                        ),

                        COALESCE(
                            SUM(
                                reprovados_nao_finalizar_questionario
                            ),
                            0
                        ),

                        COALESCE(
                            SUM(eliminados_por_nota),
                            0
                        ),

                        COALESCE(
                            SUM(reprovados_analise),
                            0
                        ),

                        COALESCE(
                            SUM(triados),
                            0
                        ),

                        COUNT(
                            total_convocados_entrevista_legado
                        ),

                        COUNT(*) FILTER (
                            WHERE
                                total_convocados_entrevista_legado
                                > 0
                        ),

                        COALESCE(
                            SUM(
                                total_convocados_entrevista_legado
                            ),
                            0
                        )

                    FROM
                        gerenciamento_concursos
                        .analise_curricular_saude_indigena

                    WHERE
                        ativo_na_fonte = true;
                """)

                (
                    inscritos_banco,
                    aptos_banco,
                    cancelados_banco,
                    questionario_banco,
                    eliminados_nota_banco,
                    reprovados_analise_banco,
                    triados_banco,
                    vagas_com_legado_banco,
                    vagas_com_convocados_banco,
                    convocados_legado_banco,
                ) = cursor.fetchone()

                totais_banco = {

                    "inscritos":
                        inscritos_banco,

                    "aptos":
                        aptos_banco,

                    "cancelados":
                        cancelados_banco,

                    "questionario":
                        questionario_banco,

                    "eliminados_nota":
                        eliminados_nota_banco,

                    "reprovados_analise":
                        reprovados_analise_banco,

                    "triados":
                        triados_banco,

                    "vagas_com_legado":
                        vagas_com_legado_banco,

                    "vagas_com_convocados":
                        vagas_com_convocados_banco,

                    "convocados_legado":
                        convocados_legado_banco,
                }

                # ============================================
                # 5. COMPARAR GOOGLE x POSTGRESQL
                # ============================================

                if (
                    totais_fonte
                    != totais_banco
                ):

                    print(
                        "\nTOTAIS DA FONTE:"
                    )

                    print(
                        totais_fonte
                    )

                    print(
                        "\nTOTAIS DO BANCO:"
                    )

                    print(
                        totais_banco
                    )

                    raise RuntimeError(
                        "Os totais do PostgreSQL "
                        "não correspondem aos "
                        "totais do Google Sheets."
                    )

            # ================================================
            # Todas as validações passaram
            # ================================================

            conn.commit()

        except Exception:

            conn.rollback()

            print(
                "\nROLLBACK executado."
            )

            print(
                "Nenhuma alteração desta "
                "execução foi mantida "
                "no banco."
            )

            raise

    return totais_fonte


# ============================================================
# EXECUÇÃO
# ============================================================

def main():

    print(
        "=" * 65
    )

    print(
        "ETL SAÚDE INDÍGENA - SINCRONIZAÇÃO"
    )

    print(
        "=" * 65
    )

    # --------------------------------------------------------
    # TRAVA CONTRA EXECUÇÃO ACIDENTAL
    # --------------------------------------------------------

    if "--executar" not in sys.argv:

        print(
            "\nMODO SEGURO."
        )

        print(
            "Nenhum dado será gravado "
            "no Supabase."
        )

        print(
            "\nPara realizar a carga execute:"
        )

        print(
            "python etl/saude_indigena/"
            "sincronizar.py --executar"
        )

        return

    # --------------------------------------------------------
    # Preparar
    # --------------------------------------------------------

    registros = preparar_dados()

    print(
        "\nATENÇÃO:"
    )

    print(
        f"{len(registros)} registros "
        "serão sincronizados "
        "com o Supabase."
    )

    # --------------------------------------------------------
    # Sincronizar
    # --------------------------------------------------------

    totais = sincronizar(
        registros
    )

    # ========================================================
    # RESULTADO
    # ========================================================

    print(
        "\n" + "=" * 65
    )

    print(
        "SINCRONIZAÇÃO CONCLUÍDA COM SUCESSO"
    )

    print(
        "=" * 65
    )

    print(
        f"Inscritos: "
        f"{totais['inscritos']:,}"
        .replace(",", ".")
    )

    print(
        f"Aptos: "
        f"{totais['aptos']:,}"
        .replace(",", ".")
    )

    print(
        f"Cancelados: "
        f"{totais['cancelados']:,}"
        .replace(",", ".")
    )

    print(
        "Não finalizaram questionário: "
        f"{totais['questionario']:,}"
        .replace(",", ".")
    )

    print(
        f"Eliminados por nota: "
        f"{totais['eliminados_nota']:,}"
        .replace(",", ".")
    )

    print(
        f"Reprovados na análise: "
        f"{totais['reprovados_analise']:,}"
        .replace(",", ".")
    )

    print(
        f"Triados: "
        f"{totais['triados']:,}"
        .replace(",", ".")
    )

    print(
        "\nENTREVISTAS - FONTE LEGADA:"
    )

    print(
        "Vagas com dado legado: "
        f"{totais['vagas_com_legado']}"
    )

    print(
        "Vagas com convocados: "
        f"{totais['vagas_com_convocados']}"
    )

    print(
        "Total convocados legado: "
        f"{totais['convocados_legado']:,}"
        .replace(",", ".")
    )


if __name__ == "__main__":
    main()