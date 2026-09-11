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
# CAMPOS QUE SERÃO GRAVADOS
# ============================================================

CAMPOS = [
    "codigo_vaga",
    "edital",
    "nome_dsei",
    "inscritos",
    "aptos_para_analise",
    "cancelados",
    "reprovados_nao_finalizar_questionario",
    "eliminados_por_nota",
    "reprovados_analise",
    "triados",
    "observacao",
    "total_convocados_entrevista",
    "total_aprovados",
    "total_contratados",
    "linha_origem",
]


# ============================================================
# VALIDAÇÃO FINAL DA FONTE
# ============================================================

def preparar_dados():
    print("Lendo a planilha...")

    linhas = ler_planilha()

    registros, erros = transformar(linhas)

    duplicidades = localizar_duplicidades(registros)

    print(f"Registros válidos: {len(registros)}")
    print(f"Erros: {len(erros)}")
    print(
        "Duplicidades Edital + Vaga: "
        f"{len(duplicidades)}"
    )

    if erros:
        print("\nCarga cancelada. Existem erros:")

        for erro in erros[:30]:
            print(f" - {erro}")

        raise RuntimeError(
            "A fonte possui registros inválidos."
        )

    if duplicidades:
        print("\nCarga cancelada. Existem duplicidades:")

        for (
            edital,
            vaga,
        ), quantidade in duplicidades.items():

            print(
                f" - Edital {edital} / "
                f"Vaga {vaga}: "
                f"{quantidade} registros"
            )

        raise RuntimeError(
            "A fonte possui chaves duplicadas."
        )

    if not registros:
        raise RuntimeError(
            "Nenhum registro válido encontrado. "
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
        "triados": sum(
            r["triados"] or 0
            for r in registros
        ),
        "convocados": sum(
            r["total_convocados_entrevista"] or 0
            for r in registros
        ),
        "aprovados": sum(
            r["total_aprovados"] or 0
            for r in registros
        ),
        "contratados": sum(
            r["total_contratados"] or 0
            for r in registros
        ),
    }


# ============================================================
# SINCRONIZAÇÃO
# ============================================================

def sincronizar(registros):

    totais_fonte = calcular_totais(registros)

    print("\nConectando ao PostgreSQL...")

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

                # =================================================
                # 1. MARCAR COMO INATIVOS OS REGISTROS ANTERIORES
                #
                # Tudo está dentro da mesma transação.
                # Se qualquer passo falhar, haverá ROLLBACK.
                # =================================================

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


                # =================================================
                # 2. UPSERT
                # =================================================

                print(
                    f"Sincronizando {len(registros)} registros..."
                )

                sql_upsert = """
                    INSERT INTO
                        gerenciamento_concursos
                        .analise_curricular_saude_indigena
                    (
                        codigo_vaga,
                        edital,
                        nome_dsei,
                        inscritos,
                        aptos_para_analise,
                        cancelados,
                        reprovados_nao_finalizar_questionario,
                        eliminados_por_nota,
                        reprovados_analise,
                        triados,
                        observacao,
                        total_convocados_entrevista,
                        total_aprovados,
                        total_contratados,
                        linha_origem,
                        ativo_na_fonte,
                        sincronizado_em
                    )
                    VALUES
                    (
                        %(codigo_vaga)s,
                        %(edital)s,
                        %(nome_dsei)s,
                        %(inscritos)s,
                        %(aptos_para_analise)s,
                        %(cancelados)s,
                        %(reprovados_nao_finalizar_questionario)s,
                        %(eliminados_por_nota)s,
                        %(reprovados_analise)s,
                        %(triados)s,
                        %(observacao)s,
                        %(total_convocados_entrevista)s,
                        %(total_aprovados)s,
                        %(total_contratados)s,
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

                        observacao =
                            EXCLUDED.observacao,

                        total_convocados_entrevista =
                            EXCLUDED.total_convocados_entrevista,

                        total_aprovados =
                            EXCLUDED.total_aprovados,

                        total_contratados =
                            EXCLUDED.total_contratados,

                        linha_origem =
                            EXCLUDED.linha_origem,

                        ativo_na_fonte = true,

                        sincronizado_em = now();
                """

                cursor.executemany(
                    sql_upsert,
                    registros,
                )


                # =================================================
                # 3. VALIDAR QUANTIDADE NO BANCO
                # =================================================

                cursor.execute("""
                    SELECT COUNT(*)
                    FROM
                        gerenciamento_concursos
                        .analise_curricular_saude_indigena
                    WHERE
                        ativo_na_fonte = true;
                """)

                total_ativos = cursor.fetchone()[0]

                print(
                    "Registros ativos após carga: "
                    f"{total_ativos}"
                )

                if total_ativos != len(registros):
                    raise RuntimeError(
                        "Quantidade de registros no banco "
                        "não corresponde à fonte. "
                        f"Fonte={len(registros)} / "
                        f"Banco={total_ativos}"
                    )


                # =================================================
                # 4. VALIDAR OS TOTAIS NO PRÓPRIO BANCO
                # =================================================

                cursor.execute("""
                    SELECT
                        COALESCE(SUM(inscritos), 0),
                        COALESCE(SUM(aptos_para_analise), 0),
                        COALESCE(SUM(triados), 0),
                        COALESCE(
                            SUM(total_convocados_entrevista),
                            0
                        ),
                        COALESCE(SUM(total_aprovados), 0),
                        COALESCE(SUM(total_contratados), 0)

                    FROM
                        gerenciamento_concursos
                        .analise_curricular_saude_indigena

                    WHERE
                        ativo_na_fonte = true;
                """)

                (
                    inscritos_banco,
                    aptos_banco,
                    triados_banco,
                    convocados_banco,
                    aprovados_banco,
                    contratados_banco,
                ) = cursor.fetchone()


                totais_banco = {
                    "inscritos": inscritos_banco,
                    "aptos": aptos_banco,
                    "triados": triados_banco,
                    "convocados": convocados_banco,
                    "aprovados": aprovados_banco,
                    "contratados": contratados_banco,
                }


                # =================================================
                # 5. COMPARAR GOOGLE x POSTGRESQL
                # =================================================

                if totais_fonte != totais_banco:

                    print("\nTOTAIS DA FONTE:")
                    print(totais_fonte)

                    print("\nTOTAIS DO BANCO:")
                    print(totais_banco)

                    raise RuntimeError(
                        "Os totais do PostgreSQL não correspondem "
                        "aos totais do Google Sheets."
                    )


            # =====================================================
            # Só chega aqui se TODAS as validações passaram
            # =====================================================

            conn.commit()

        except Exception:
            conn.rollback()

            print("\nROLLBACK executado.")
            print(
                "Nenhuma alteração desta execução "
                "foi mantida no banco."
            )

            raise


    return totais_fonte


# ============================================================
# EXECUÇÃO
# ============================================================

def main():

    print("=" * 65)
    print("ETL SAÚDE INDÍGENA - SINCRONIZAÇÃO")
    print("=" * 65)

    # --------------------------------------------------------
    # TRAVA CONTRA EXECUÇÃO ACIDENTAL
    # --------------------------------------------------------

    if "--executar" not in sys.argv:

        print("\nMODO SEGURO.")
        print(
            "Nenhum dado será gravado no Supabase."
        )

        print("\nPara realizar a carga execute:")
        print(
            "python etl/saude_indigena/"
            "sincronizar.py --executar"
        )

        return


    registros = preparar_dados()

    print("\nATENÇÃO:")
    print(
        f"{len(registros)} registros serão "
        "sincronizados com o Supabase."
    )

    totais = sincronizar(registros)

    print("\n" + "=" * 65)
    print("SINCRONIZAÇÃO CONCLUÍDA COM SUCESSO")
    print("=" * 65)

    print(
        f"Inscritos: {totais['inscritos']:,}"
        .replace(",", ".")
    )

    print(
        f"Aptos: {totais['aptos']:,}"
        .replace(",", ".")
    )

    print(
        f"Triados: {totais['triados']:,}"
        .replace(",", ".")
    )

    print(
        f"Convocados: {totais['convocados']:,}"
        .replace(",", ".")
    )

    print(
        f"Aprovados: {totais['aprovados']:,}"
        .replace(",", ".")
    )

    print(
        f"Contratados: {totais['contratados']:,}"
        .replace(",", ".")
    )


if __name__ == "__main__":
    main()