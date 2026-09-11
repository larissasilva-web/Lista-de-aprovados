import os
from collections import Counter
from pathlib import Path

import psycopg
from dotenv import load_dotenv
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build


# ============================================================
# CARREGAR .env.local
# ============================================================

RAIZ_PROJETO = Path(__file__).resolve().parents[2]
ARQUIVO_ENV = RAIZ_PROJETO / ".env.local"

load_dotenv(ARQUIVO_ENV)


# ============================================================
# CONFIGURAÇÕES
# ============================================================

SPREADSHEET_ID = "1ZGZRl8m9A2T2lWlQkxKWq-xqQECLAkbqUuihMkOtLyk"
SHEET_NAME = "Resultado"

CREDENTIALS_FILE = os.getenv("GOOGLE_CREDENTIALS_FILE")

if not CREDENTIALS_FILE:
    raise RuntimeError(
        "GOOGLE_CREDENTIALS_FILE não definida."
    )


# ============================================================
# POSTGRESQL
# ============================================================

PGHOST = os.getenv("PGHOST")
PGPORT = os.getenv("PGPORT", "5432")
PGDATABASE = os.getenv("PGDATABASE", "postgres")
PGUSER = os.getenv("PGUSER")
PGPASSWORD = os.getenv("PGPASSWORD")
PGSSLMODE = os.getenv("PGSSLMODE", "require")

# ============================================================
# MAPEAMENTO DAS COLUNAS
# ============================================================

COLUNAS = {
    "Vaga": "codigo_vaga",
    "Edital": "edital",
    "Nome DSEI": "nome_dsei",

    "Inscritos": "inscritos",
    "Aptos para analise": "aptos_para_analise",
    "Cancelados": "cancelados",

    "Reprovados por não finalizar o questionário":
        "reprovados_nao_finalizar_questionario",

    "Eliminados por nota":
        "eliminados_por_nota",

    "Reprovados na Análise":
        "reprovados_analise",

    "Triados":
        "triados",

    "Observação":
        "observacao",

    "Total convocados para entrevista":
        "total_convocados_entrevista",

    "Total de Aprovados":
        "total_aprovados",

    "Total de Contratados":
        "total_contratados",
}


CAMPOS_NUMERICOS = {
    "inscritos",
    "aptos_para_analise",
    "cancelados",
    "reprovados_nao_finalizar_questionario",
    "eliminados_por_nota",
    "reprovados_analise",
    "triados",
    "total_convocados_entrevista",
    "total_aprovados",
    "total_contratados",
}


# ============================================================
# NORMALIZAÇÃO
# ============================================================

def texto(valor):
    if valor is None:
        return None

    valor = str(valor).strip()

    return valor if valor else None


def inteiro(valor):
    if valor is None:
        return None

    if isinstance(valor, str):
        valor = valor.strip()

        if valor == "":
            return None

        valor = valor.replace(",", ".")

    numero = float(valor)

    if not numero.is_integer():
        raise ValueError(
            f"Valor não inteiro encontrado: {valor}"
        )

    return int(numero)


# ============================================================
# GOOGLE SHEETS
# ============================================================

def ler_planilha():

    scopes = [
        "https://www.googleapis.com/auth/spreadsheets.readonly"
    ]

    credentials = Credentials.from_service_account_file(
        CREDENTIALS_FILE,
        scopes=scopes,
    )

    service = build(
        "sheets",
        "v4",
        credentials=credentials,
    )

    print("Lendo Google Sheets...")

    resposta = (
        service
        .spreadsheets()
        .values()
        .get(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{SHEET_NAME}!A:X",
            valueRenderOption="UNFORMATTED_VALUE",
        )
        .execute()
    )

    return resposta.get("values", [])


# ============================================================
# TRANSFORMAÇÃO
# ============================================================

def transformar(linhas):

    if not linhas:
        raise RuntimeError("Planilha vazia.")

    cabecalho = linhas[0]

    faltantes = [
        coluna
        for coluna in COLUNAS
        if coluna not in cabecalho
    ]

    if faltantes:
        raise RuntimeError(
            "Colunas obrigatórias ausentes: "
            + ", ".join(faltantes)
        )

    registros = []
    erros = []

    for numero_linha, linha in enumerate(
        linhas[1:],
        start=2,
    ):

        # Ignora linha completamente vazia
        if not any(
            str(valor).strip()
            for valor in linha
            if valor is not None
        ):
            continue

        linha += [None] * (
            len(cabecalho) - len(linha)
        )

        origem = dict(
            zip(cabecalho, linha)
        )

        registro = {
            "linha_origem": numero_linha
        }

        try:

            for coluna_origem, coluna_destino in COLUNAS.items():

                valor = origem.get(coluna_origem)

                if coluna_destino in CAMPOS_NUMERICOS:
                    valor = inteiro(valor)
                else:
                    valor = texto(valor)

                registro[coluna_destino] = valor

            # Campos obrigatórios
            if not registro["codigo_vaga"]:
                raise ValueError("Vaga vazia")

            if not registro["edital"]:
                raise ValueError("Edital vazio")

            # Não permitir negativos
            for campo in CAMPOS_NUMERICOS:

                valor = registro.get(campo)

                if valor is not None and valor < 0:
                    raise ValueError(
                        f"{campo} possui valor negativo"
                    )

            registros.append(registro)

        except Exception as erro:

            erros.append(
                f"Linha {numero_linha}: {erro}"
            )

    return registros, erros


# ============================================================
# DUPLICIDADES
# ============================================================

def localizar_duplicidades(registros):

    chaves = [
        (
            r["edital"],
            r["codigo_vaga"],
        )
        for r in registros
    ]

    contador = Counter(chaves)

    return {
        chave: quantidade
        for chave, quantidade in contador.items()
        if quantidade > 1
    }


# ============================================================
# COMPARAÇÃO COM POSTGRESQL
# ============================================================

def comparar_com_banco(registros):

    with psycopg.connect(
        host=PGHOST,
        port=PGPORT,
        dbname=PGDATABASE,
        user=PGUSER,
        password=PGPASSWORD,
        sslmode=PGSSLMODE,
        connect_timeout=15,
    ) as conn:

        with conn.cursor() as cursor:

            cursor.execute("""
                SELECT
                    edital,
                    codigo_vaga
                FROM gerenciamento_concursos
                    .analise_curricular_saude_indigena;
            """)

            existentes = {
                (edital, codigo_vaga)
                for edital, codigo_vaga
                in cursor.fetchall()
            }

    inserir = 0
    atualizar = 0

    chaves_fonte = set()

    for registro in registros:

        chave = (
            registro["edital"],
            registro["codigo_vaga"],
        )

        chaves_fonte.add(chave)

        if chave in existentes:
            atualizar += 1
        else:
            inserir += 1

    inativar = len(
        existentes - chaves_fonte
    )

    return inserir, atualizar, inativar


# ============================================================
# EXECUÇÃO
# ============================================================

def main():

    print("=" * 60)
    print("ETL SAÚDE INDÍGENA - DRY RUN")
    print("=" * 60)

    linhas = ler_planilha()

    print(
        f"Linhas recebidas do Google: "
        f"{len(linhas) - 1}"
    )

    registros, erros = transformar(linhas)

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
        f"Duplicidades Edital + Vaga: "
        f"{len(duplicidades)}"
    )

    # --------------------------------------------------------
    # Se houver problemas estruturais, NÃO prosseguir
    # --------------------------------------------------------

    if erros:

        print("\nERROS ENCONTRADOS:")

        for erro in erros[:30]:
            print(f" - {erro}")

    if duplicidades:

        print("\nDUPLICIDADES ENCONTRADAS:")

        for (
            edital,
            vaga,
        ), quantidade in list(
            duplicidades.items()
        )[:30]:

            print(
                f" - Edital {edital} / "
                f"Vaga {vaga}: "
                f"{quantidade} linhas"
            )

    if erros or duplicidades:

        print("\nCarga bloqueada.")
        print(
            "Corrija os problemas antes de gravar no banco."
        )

        return

    # --------------------------------------------------------
    # Comparar com o banco
    # --------------------------------------------------------

    inserir, atualizar, inativar = comparar_com_banco(
        registros
    )

    print("\n" + "=" * 60)
    print("PLANO DA SINCRONIZAÇÃO")
    print("=" * 60)

    print(
        f"INSERT:  {inserir}"
    )

    print(
        f"UPDATE:  {atualizar}"
    )

    print(
        f"INATIVAR: {inativar}"
    )

    print(
        f"TOTAL NA FONTE: {len(registros)}"
    )

    # --------------------------------------------------------
    # Totais para conferência
    # --------------------------------------------------------

    total_inscritos = sum(
        r["inscritos"] or 0
        for r in registros
    )

    total_aptos = sum(
        r["aptos_para_analise"] or 0
        for r in registros
    )

    total_triados = sum(
        r["triados"] or 0
        for r in registros
    )

    total_convocados = sum(
        r["total_convocados_entrevista"] or 0
        for r in registros
    )

    total_aprovados = sum(
        r["total_aprovados"] or 0
        for r in registros
    )

    total_contratados = sum(
        r["total_contratados"] or 0
        for r in registros
    )

    print("\nTOTAIS DA FONTE:")

    print(
        f"Inscritos: {total_inscritos:,}"
        .replace(",", ".")
    )

    print(
        f"Aptos para análise: {total_aptos:,}"
        .replace(",", ".")
    )

    print(
        f"Triados: {total_triados:,}"
        .replace(",", ".")
    )

    print(
        f"Convocados para entrevista: {total_convocados:,}"
        .replace(",", ".")
    )

    print(
        f"Aprovados: {total_aprovados:,}"
        .replace(",", ".")
    )

    print(
        f"Contratados: {total_contratados:,}"
        .replace(",", ".")
    )

    print("\nDRY RUN concluído.")
    print("Nenhum dado foi alterado no Supabase.")


if __name__ == "__main__":
    main()