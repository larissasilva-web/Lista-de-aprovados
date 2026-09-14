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
    normalizar_chave,
)


# ============================================================
# PREPARAR DADOS
# ============================================================

def preparar_dados():

    print("Lendo a planilha...")

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
        f"Chaves duplicadas: "
        f"{len(duplicidades)}"
    )

    # --------------------------------------------------------
    # ERROS
    # --------------------------------------------------------

    if erros:

        print(
            "\nCarga cancelada. "
            "Existem erros na fonte:"
        )

        for erro in erros[:30]:

            print(
                f" - {erro}"
            )

        raise RuntimeError(
            "A fonte possui "
            "registros inválidos."
        )

    # --------------------------------------------------------
    # DUPLICIDADES
    # --------------------------------------------------------

    if duplicidades:

        print(
            "\nCarga cancelada. "
            "Existem chaves duplicadas."
        )

        for (
            chave,
            quantidade,
        ) in list(
            duplicidades.items()
        )[:30]:

            print(
                f" - {chave}: "
                f"{quantidade} registros"
            )

        raise RuntimeError(
            "A fonte possui "
            "chaves duplicadas."
        )

    # --------------------------------------------------------
    # PROTEÇÃO CONTRA FONTE VAZIA
    # --------------------------------------------------------

    if not registros:

        raise RuntimeError(
            "Nenhum registro válido "
            "encontrado. "
            "Carga cancelada por segurança."
        )

    return registros


# ============================================================
# CONTAR VALOR
# ============================================================

def contar_valor(
    registros,
    campo,
    valor_esperado,
):

    esperado = normalizar_chave(
        valor_esperado
    )

    return sum(
        1
        for registro
        in registros
        if normalizar_chave(
            registro.get(campo)
        )
        == esperado
    )


# ============================================================
# TOTAIS DA FONTE
# ============================================================

def calcular_totais(
    registros
):

    vagas = {
        (
            registro["edital"],
            registro["codigo_vaga"],
        )
        for registro
        in registros
    }

    editais = {
        registro["edital"]
        for registro
        in registros
    }

    compareceram = contar_valor(
        registros,
        "comparecimento",
        "sim",
    )

    nao_compareceram = (
        contar_valor(
            registros,
            "comparecimento",
            "não",
        )
        +
        contar_valor(
            registros,
            "comparecimento",
            "nao",
        )
    )

    aptos = contar_valor(
        registros,
        "parecer",
        "apto",
    )

    inaptos = contar_valor(
        registros,
        "parecer",
        "inapto",
    )

    return {
        "registros":
            len(registros),

        "editais":
            len(editais),

        "vagas":
            len(vagas),

        "compareceram":
            compareceram,

        "nao_compareceram":
            nao_compareceram,

        "aptos":
            aptos,

        "inaptos":
            inaptos,
    }


# ============================================================
# SINCRONIZAÇÃO
# ============================================================

def sincronizar(
    registros
):

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
                        .entrevistas_candidatos
                    SET
                        ativo_na_fonte = false
                    WHERE
                        ativo_na_fonte = true;
                """)

                # ============================================
                # 2. UPSERT DOS REGISTROS
                # ============================================

                print(
                    f"Sincronizando "
                    f"{len(registros)} registros..."
                )

                sql_upsert = """
                    INSERT INTO
                        gerenciamento_concursos
                        .entrevistas_candidatos
                    (
                        chave_fonte,

                        edital,
                        codigo_vaga,

                        dsei,
                        cargo,

                        codigo_candidato,
                        nome,
                        modalidade_concorrencia,

                        nota_total,
                        parecer,
                        comparecimento,

                        criterio_1,
                        nota_1,

                        criterio_2,
                        nota_2,

                        criterio_3,
                        nota_3,

                        criterio_4,
                        nota_4,

                        link_planilha_entrevista,

                        linha_origem,

                        ativo_na_fonte,
                        sincronizado_em
                    )

                    VALUES
                    (
                        %(chave_fonte)s,

                        %(edital)s,
                        %(codigo_vaga)s,

                        %(dsei)s,
                        %(cargo)s,

                        %(codigo_candidato)s,
                        %(nome)s,
                        %(modalidade_concorrencia)s,

                        %(nota_total)s,
                        %(parecer)s,
                        %(comparecimento)s,

                        %(criterio_1)s,
                        %(nota_1)s,

                        %(criterio_2)s,
                        %(nota_2)s,

                        %(criterio_3)s,
                        %(nota_3)s,

                        %(criterio_4)s,
                        %(nota_4)s,

                        %(link_planilha_entrevista)s,

                        %(linha_origem)s,

                        true,
                        now()
                    )

                    ON CONFLICT (
                        chave_fonte
                    )

                    DO UPDATE SET

                        edital =
                            EXCLUDED.edital,

                        codigo_vaga =
                            EXCLUDED.codigo_vaga,

                        dsei =
                            EXCLUDED.dsei,

                        cargo =
                            EXCLUDED.cargo,

                        codigo_candidato =
                            EXCLUDED.codigo_candidato,

                        nome =
                            EXCLUDED.nome,

                        modalidade_concorrencia =
                            EXCLUDED.modalidade_concorrencia,

                        nota_total =
                            EXCLUDED.nota_total,

                        parecer =
                            EXCLUDED.parecer,

                        comparecimento =
                            EXCLUDED.comparecimento,

                        criterio_1 =
                            EXCLUDED.criterio_1,

                        nota_1 =
                            EXCLUDED.nota_1,

                        criterio_2 =
                            EXCLUDED.criterio_2,

                        nota_2 =
                            EXCLUDED.nota_2,

                        criterio_3 =
                            EXCLUDED.criterio_3,

                        nota_3 =
                            EXCLUDED.nota_3,

                        criterio_4 =
                            EXCLUDED.criterio_4,

                        nota_4 =
                            EXCLUDED.nota_4,

                        link_planilha_entrevista =
                            EXCLUDED.link_planilha_entrevista,

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
                # 3. CONTAR REGISTROS ATIVOS
                # ============================================

                cursor.execute("""
                    SELECT
                        COUNT(*)

                    FROM
                        gerenciamento_concursos
                        .entrevistas_candidatos

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
                        "ativos no banco não "
                        "corresponde à fonte. "
                        f"Fonte={len(registros)} / "
                        f"Banco={total_ativos}"
                    )

                # ============================================
                # 4. VALIDAR RESUMO DO BANCO
                # ============================================

                cursor.execute("""
                    SELECT

                        COUNT(*),

                        COUNT(
                            DISTINCT edital
                        ),

                        COUNT(
                            DISTINCT (
                                edital,
                                codigo_vaga
                            )
                        ),

                        COUNT(*) FILTER (
                            WHERE
                                LOWER(
                                    TRIM(
                                        comparecimento
                                    )
                                ) = 'sim'
                        ),

                        COUNT(*) FILTER (
                            WHERE
                                LOWER(
                                    TRIM(
                                        comparecimento
                                    )
                                ) IN (
                                    'não',
                                    'nao'
                                )
                        ),

                        COUNT(*) FILTER (
                            WHERE
                                LOWER(
                                    TRIM(
                                        parecer
                                    )
                                ) = 'apto'
                        ),

                        COUNT(*) FILTER (
                            WHERE
                                LOWER(
                                    TRIM(
                                        parecer
                                    )
                                ) = 'inapto'
                        )

                    FROM
                        gerenciamento_concursos
                        .entrevistas_candidatos

                    WHERE
                        ativo_na_fonte = true;
                """)

                (
                    registros_banco,
                    editais_banco,
                    vagas_banco,
                    compareceram_banco,
                    nao_compareceram_banco,
                    aptos_banco,
                    inaptos_banco,
                ) = cursor.fetchone()

                totais_banco = {

                    "registros":
                        registros_banco,

                    "editais":
                        editais_banco,

                    "vagas":
                        vagas_banco,

                    "compareceram":
                        compareceram_banco,

                    "nao_compareceram":
                        nao_compareceram_banco,

                    "aptos":
                        aptos_banco,

                    "inaptos":
                        inaptos_banco,
                }

                # ============================================
                # 5. COMPARAR FONTE x BANCO
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

                # ============================================
                # 6. VALIDAR VIEW POR VAGA
                # ============================================

                cursor.execute("""
                    SELECT
                        COUNT(*),
                        COALESCE(
                            SUM(
                                total_convocados_entrevista
                            ),
                            0
                        )

                    FROM
                        gerenciamento_concursos
                        .vw_entrevistas_por_vaga;
                """)

                (
                    total_vagas_view,
                    total_convocados_view,
                ) = cursor.fetchone()

                if (
                    total_vagas_view
                    != totais_fonte["vagas"]
                ):

                    raise RuntimeError(
                        "A quantidade de vagas "
                        "da view de entrevistas "
                        "não corresponde à fonte. "
                        f"Fonte="
                        f"{totais_fonte['vagas']} / "
                        f"View="
                        f"{total_vagas_view}"
                    )

                if (
                    total_convocados_view
                    != totais_fonte["registros"]
                ):

                    raise RuntimeError(
                        "A soma dos convocados "
                        "da view não corresponde "
                        "à quantidade de registros. "
                        f"Fonte="
                        f"{totais_fonte['registros']} / "
                        f"View="
                        f"{total_convocados_view}"
                    )

            # ================================================
            # TUDO CERTO
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
        "ETL ENTREVISTAS - SINCRONIZAÇÃO"
    )

    print(
        "=" * 65
    )

    # --------------------------------------------------------
    # PROTEÇÃO CONTRA EXECUÇÃO ACIDENTAL
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
            "python etl/entrevistas/"
            "sincronizar.py --executar"
        )

        return

    # --------------------------------------------------------
    # PREPARAR
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
    # SINCRONIZAR
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
        f"Registros: "
        f"{totais['registros']:,}"
        .replace(",", ".")
    )

    print(
        f"Editais: "
        f"{totais['editais']}"
    )

    print(
        f"Vagas: "
        f"{totais['vagas']}"
    )

    print(
        f"Compareceram: "
        f"{totais['compareceram']:,}"
        .replace(",", ".")
    )

    print(
        f"Não compareceram: "
        f"{totais['nao_compareceram']:,}"
        .replace(",", ".")
    )

    print(
        f"Aptos: "
        f"{totais['aptos']:,}"
        .replace(",", ".")
    )

    print(
        f"Inaptos: "
        f"{totais['inaptos']:,}"
        .replace(",", ".")
    )


if __name__ == "__main__":
    main()