import os
import re
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
    "Vaga":
        "codigo_vaga",

    "Edital":
        "edital",

    "Nome DSEI":
        "nome_dsei",

    "Inscritos":
        "inscritos",

    "Aptos para analise":
        "aptos_para_analise",

    "Cancelados":
        "cancelados",

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

    "Nome do cargo":
        "cargo",

    # Coluna V da planilha Auditoria.
    #
    # Este campo será utilizado somente como fallback
    # para processos em que não houver dados individuais
    # disponíveis na tabela de entrevistas.
    "Total convocados para entrevista":
        "total_convocados_entrevista_legado",
}


CAMPOS_NUMERICOS = {
    "inscritos",
    "aptos_para_analise",
    "cancelados",
    "reprovados_nao_finalizar_questionario",
    "eliminados_por_nota",
    "reprovados_analise",
    "triados",
    "total_convocados_entrevista_legado",
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
# REGRA HISTÓRICA DA ETAPA DE ENTREVISTA
# ============================================================

def edital_sem_etapa_entrevista(edital):

    """
    Até o edital 09/2025 não existia etapa de entrevista.

    Consequentemente, valores 0 eventualmente existentes
    na coluna V desses editais não significam que houve
    entrevista com zero convocados.

    Para esses processos o valor correto é NULL /
    "não se aplica".
    """

    if not edital:
        return False

    match = re.match(
        r"^\s*(\d{1,3})/(\d{4})",
        str(edital),
    )

    if not match:
        return False

    numero_edital = int(
        match.group(1)
    )

    ano = int(
        match.group(2)
    )

    # Editais anteriores a 2025 também não possuem
    # a etapa histórica que estamos tratando.
    if ano < 2025:
        return True

    # Em 2025, a etapa passou a existir depois do
    # edital 09/2025.
    if (
        ano == 2025
        and numero_edital <= 9
    ):
        return True

    return False


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

    return resposta.get(
        "values",
        [],
    )


# ============================================================
# TRANSFORMAÇÃO
# ============================================================

def transformar(linhas):

    if not linhas:

        raise RuntimeError(
            "Planilha vazia."
        )

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

        # ----------------------------------------------------
        # Ignorar linha completamente vazia
        # ----------------------------------------------------

        if not any(
            str(valor).strip()
            for valor in linha
            if valor is not None
        ):
            continue

        # ----------------------------------------------------
        # Completar eventuais colunas ausentes
        # ----------------------------------------------------

        linha = linha + [None] * (
            len(cabecalho)
            - len(linha)
        )

        origem = dict(
            zip(
                cabecalho,
                linha,
            )
        )

        registro = {
            "linha_origem":
                numero_linha
        }

        try:

            # ------------------------------------------------
            # Mapear campos
            # ------------------------------------------------

            for (
                coluna_origem,
                coluna_destino,
            ) in COLUNAS.items():

                valor = origem.get(
                    coluna_origem
                )

                if (
                    coluna_destino
                    in CAMPOS_NUMERICOS
                ):

                    valor = inteiro(
                        valor
                    )

                else:

                    valor = texto(
                        valor
                    )

                registro[
                    coluna_destino
                ] = valor

            # ------------------------------------------------
            # Regra histórica
            #
            # Até o edital 09/2025 não existia etapa
            # de entrevista.
            #
            # Portanto, mesmo que a planilha possua
            # 0 na coluna V, o valor será NULL.
            # ------------------------------------------------

            if edital_sem_etapa_entrevista(
                registro.get("edital")
            ):

                registro[
                    "total_convocados_entrevista_legado"
                ] = None

            # ------------------------------------------------
            # Campos obrigatórios
            # ------------------------------------------------

            if not registro[
                "codigo_vaga"
            ]:

                raise ValueError(
                    "Vaga vazia"
                )

            if not registro[
                "edital"
            ]:

                raise ValueError(
                    "Edital vazio"
                )

            # ------------------------------------------------
            # Não permitir números negativos
            # ------------------------------------------------

            for campo in CAMPOS_NUMERICOS:

                valor = registro.get(
                    campo
                )

                if (
                    valor is not None
                    and valor < 0
                ):

                    raise ValueError(
                        f"{campo} possui "
                        "valor negativo"
                    )

            registros.append(
                registro
            )

        except Exception as erro:

            erros.append(
                f"Linha "
                f"{numero_linha}: "
                f"{erro}"
            )

    return (
        registros,
        erros,
    )


# ============================================================
# DUPLICIDADES
# ============================================================

def localizar_duplicidades(
    registros
):

    chaves = [
        (
            registro["edital"],
            registro["codigo_vaga"],
        )
        for registro
        in registros
    ]

    contador = Counter(
        chaves
    )

    return {
        chave: quantidade
        for chave, quantidade
        in contador.items()
        if quantidade > 1
    }


# ============================================================
# COMPARAÇÃO COM POSTGRESQL
# ============================================================

def comparar_com_banco(
    registros
):

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
                FROM
                    gerenciamento_concursos
                    .analise_curricular_saude_indigena;
            """)

            existentes = {
                (
                    edital,
                    codigo_vaga,
                )
                for (
                    edital,
                    codigo_vaga,
                )
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

        chaves_fonte.add(
            chave
        )

        if chave in existentes:

            atualizar += 1

        else:

            inserir += 1

    inativar = len(
        existentes
        - chaves_fonte
    )

    return (
        inserir,
        atualizar,
        inativar,
    )


# ============================================================
# EXECUÇÃO
# ============================================================

def main():

    print("=" * 65)

    print(
        "ETL SAÚDE INDÍGENA - DRY RUN"
    )

    print("=" * 65)

    # --------------------------------------------------------
    # Ler Google Sheets
    # --------------------------------------------------------

    linhas = ler_planilha()

    print(
        f"Linhas recebidas do Google: "
        f"{len(linhas) - 1}"
    )

    # --------------------------------------------------------
    # Transformar
    # --------------------------------------------------------

    (
        registros,
        erros,
    ) = transformar(
        linhas
    )

    # --------------------------------------------------------
    # Duplicidades
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # Mostrar erros
    # --------------------------------------------------------

    if erros:

        print(
            "\nERROS ENCONTRADOS:"
        )

        for erro in erros[:30]:

            print(
                f" - {erro}"
            )

    # --------------------------------------------------------
    # Mostrar duplicidades
    # --------------------------------------------------------

    if duplicidades:

        print(
            "\nDUPLICIDADES ENCONTRADAS:"
        )

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

    # --------------------------------------------------------
    # Bloquear em caso de erro
    # --------------------------------------------------------

    if (
        erros
        or duplicidades
    ):

        print(
            "\nCarga bloqueada."
        )

        print(
            "Corrija os problemas antes "
            "de gravar no banco."
        )

        return

    # --------------------------------------------------------
    # Comparar com PostgreSQL
    # --------------------------------------------------------

    (
        inserir,
        atualizar,
        inativar,
    ) = comparar_com_banco(
        registros
    )

    print(
        "\n" + "=" * 65
    )

    print(
        "PLANO DA SINCRONIZAÇÃO"
    )

    print("=" * 65)

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
        f"TOTAL NA FONTE: "
        f"{len(registros)}"
    )

    # ========================================================
    # TOTAIS DA ANÁLISE CURRICULAR
    # ========================================================

    total_inscritos = sum(
        registro[
            "inscritos"
        ] or 0
        for registro
        in registros
    )

    total_aptos = sum(
        registro[
            "aptos_para_analise"
        ] or 0
        for registro
        in registros
    )

    total_cancelados = sum(
        registro[
            "cancelados"
        ] or 0
        for registro
        in registros
    )

    total_questionario = sum(
        registro[
            "reprovados_nao_finalizar_questionario"
        ] or 0
        for registro
        in registros
    )

    total_eliminados_nota = sum(
        registro[
            "eliminados_por_nota"
        ] or 0
        for registro
        in registros
    )

    total_reprovados_analise = sum(
        registro[
            "reprovados_analise"
        ] or 0
        for registro
        in registros
    )

    total_triados = sum(
        registro[
            "triados"
        ] or 0
        for registro
        in registros
    )

    print(
        "\nTOTAIS DA FONTE:"
    )

    print(
        f"Inscritos: "
        f"{total_inscritos:,}"
        .replace(",", ".")
    )

    print(
        f"Aptos para análise: "
        f"{total_aptos:,}"
        .replace(",", ".")
    )

    print(
        f"Cancelados: "
        f"{total_cancelados:,}"
        .replace(",", ".")
    )

    print(
        "Não finalizaram questionário: "
        f"{total_questionario:,}"
        .replace(",", ".")
    )

    print(
        f"Eliminados por nota: "
        f"{total_eliminados_nota:,}"
        .replace(",", ".")
    )

    print(
        f"Reprovados na análise: "
        f"{total_reprovados_analise:,}"
        .replace(",", ".")
    )

    print(
        f"Triados: "
        f"{total_triados:,}"
        .replace(",", ".")
    )

    # ========================================================
    # ENTREVISTAS - FONTE LEGADA
    # ========================================================

    vagas_com_legado = sum(
        1
        for registro
        in registros
        if registro[
            "total_convocados_entrevista_legado"
        ] is not None
    )

    vagas_com_convocados = sum(
        1
        for registro
        in registros
        if (
            registro[
                "total_convocados_entrevista_legado"
            ] is not None
            and
            registro[
                "total_convocados_entrevista_legado"
            ] > 0
        )
    )

    total_convocados_legado = sum(
        registro[
            "total_convocados_entrevista_legado"
        ] or 0
        for registro
        in registros
    )

    vagas_sem_etapa_historica = sum(
        1
        for registro
        in registros
        if edital_sem_etapa_entrevista(
            registro.get("edital")
        )
    )

    vagas_sem_dado_entrevista = sum(
        1
        for registro
        in registros
        if (
            not edital_sem_etapa_entrevista(
                registro.get("edital")
            )
            and
            registro[
                "total_convocados_entrevista_legado"
            ] is None
        )
    )

    print(
        "\nENTREVISTAS - FONTE LEGADA:"
    )

    print(
        f"Vagas com dado legado: "
        f"{vagas_com_legado}"
    )

    print(
        f"Vagas com convocados: "
        f"{vagas_com_convocados}"
    )

    print(
        "Total convocados legado: "
        f"{total_convocados_legado:,}"
        .replace(",", ".")
    )

    print(
        "Vagas sem etapa histórica "
        "de entrevista: "
        f"{vagas_sem_etapa_historica}"
    )

    print(
        "Vagas posteriores sem dado "
        "de entrevista: "
        f"{vagas_sem_dado_entrevista}"
    )

    # ========================================================
    # FINAL
    # ========================================================

    print(
        "\nDRY RUN concluído."
    )

    print(
        "Nenhum dado foi alterado "
        "no Supabase."
    )


if __name__ == "__main__":
    main()