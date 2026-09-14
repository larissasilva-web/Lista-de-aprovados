import hashlib
import os
from collections import Counter
from decimal import Decimal, InvalidOperation
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

SPREADSHEET_ID = (
    "1xGY9cYNdLvVvnqQGStcGCgsnczqN9DoO1naPt_Y53Ko"
)

SHEET_NAME = "Entrevistados"

CREDENTIALS_FILE = os.getenv(
    "GOOGLE_CREDENTIALS_FILE"
)

if not CREDENTIALS_FILE:
    raise RuntimeError(
        "GOOGLE_CREDENTIALS_FILE não definida."
    )


# ============================================================
# POSTGRESQL
# ============================================================

PGHOST = os.getenv("PGHOST")
PGPORT = os.getenv("PGPORT", "5432")
PGDATABASE = os.getenv(
    "PGDATABASE",
    "postgres",
)
PGUSER = os.getenv("PGUSER")
PGPASSWORD = os.getenv("PGPASSWORD")
PGSSLMODE = os.getenv(
    "PGSSLMODE",
    "require",
)


# ============================================================
# MAPEAMENTO DA PLANILHA
# ============================================================

COLUNAS = {

    "DSEI":
        "dsei",

    "Edital":
        "edital",

    "Link Planilha Entrevista":
        "link_planilha_entrevista",

    "Vaga":
        "codigo_vaga",

    "Nome":
        "nome",

    "Modalidade de Concorrência":
        "modalidade_concorrencia",

    "Cargo":
        "cargo",

    "Código":
        "codigo_candidato",

    "Nota Total":
        "nota_total",

    "Parecer":
        "parecer",

    "Comparecimento":
        "comparecimento",

    "Critério 1":
        "criterio_1",

    "Nota 1":
        "nota_1",

    "Critério 2":
        "criterio_2",

    "Nota 2":
        "nota_2",

    "Critério 3":
        "criterio_3",

    "Nota 3":
        "nota_3",

    "Critério 4":
        "criterio_4",

    "Nota 4":
        "nota_4",
}


CAMPOS_NUMERICOS = {
    "nota_total",
    "nota_1",
    "nota_2",
    "nota_3",
    "nota_4",
}


# ============================================================
# NORMALIZAÇÃO
# ============================================================

def texto(valor):

    if valor is None:
        return None

    valor = str(valor).strip()

    return valor if valor else None


def decimal_ptbr(valor):

    if valor is None:
        return None

    if isinstance(
        valor,
        (int, float),
    ):
        return Decimal(
            str(valor)
        )

    valor = str(valor).strip()

    if not valor:
        return None

    # Exemplo:
    # 15,84 -> 15.84

    if "," in valor:

        valor = (
            valor
            .replace(".", "")
            .replace(",", ".")
        )

    try:

        return Decimal(
            valor
        )

    except InvalidOperation:

        raise ValueError(
            f"Nota inválida: {valor}"
        )


def normalizar_chave(valor):

    valor = texto(
        valor
    )

    if not valor:
        return ""

    return (
        valor
        .casefold()
        .strip()
    )


# ============================================================
# CHAVE ESTÁVEL DA FONTE
# ============================================================

def criar_chave_fonte(
    registro
):

    edital = normalizar_chave(
        registro.get(
            "edital"
        )
    )

    vaga = normalizar_chave(
        registro.get(
            "codigo_vaga"
        )
    )

    codigo = normalizar_chave(
        registro.get(
            "codigo_candidato"
        )
    )

    nome = normalizar_chave(
        registro.get(
            "nome"
        )
    )

    modalidade = normalizar_chave(
        registro.get(
            "modalidade_concorrencia"
        )
    )

    # --------------------------------------------------------
    # REGRA PRINCIPAL
    #
    # edital + vaga + código candidato
    # --------------------------------------------------------

    if codigo:

        conteudo = (
            f"{edital}|"
            f"{vaga}|"
            f"{codigo}"
        )

    else:

        # ----------------------------------------------------
        # FALLBACK
        #
        # Para registros antigos que eventualmente
        # não possuam código de candidato.
        # ----------------------------------------------------

        conteudo = (
            f"{edital}|"
            f"{vaga}|"
            f"{nome}|"
            f"{modalidade}"
        )

    return hashlib.sha256(
        conteudo.encode(
            "utf-8"
        )
    ).hexdigest()


# ============================================================
# GOOGLE SHEETS
# ============================================================

def ler_planilha():

    scopes = [
        "https://www.googleapis.com/auth/"
        "spreadsheets.readonly"
    ]

    credentials = (
        Credentials
        .from_service_account_file(
            CREDENTIALS_FILE,
            scopes=scopes,
        )
    )

    service = build(
        "sheets",
        "v4",
        credentials=credentials,
    )

    print(
        "Lendo Google Sheets..."
    )

    resposta = (
        service
        .spreadsheets()
        .values()
        .get(
            spreadsheetId=SPREADSHEET_ID,
            range=f"{SHEET_NAME}!A:S",
            valueRenderOption=(
                "UNFORMATTED_VALUE"
            ),
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

def transformar(
    linhas
):

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
            + ", ".join(
                faltantes
            )
        )

    registros = []
    erros = []

    for numero_linha, linha in enumerate(
        linhas[1:],
        start=2,
    ):

        # ----------------------------------------------------
        # IGNORAR LINHA COMPLETAMENTE VAZIA
        # ----------------------------------------------------

        if not any(
            str(valor).strip()
            for valor in linha
            if valor is not None
        ):
            continue

        # ----------------------------------------------------
        # COMPLETAR COLUNAS AUSENTES
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
                numero_linha,
        }

        try:

            # ------------------------------------------------
            # MAPEAR CAMPOS
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

                    valor = decimal_ptbr(
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
            # CAMPOS OBRIGATÓRIOS
            # ------------------------------------------------

            if not registro[
                "edital"
            ]:

                raise ValueError(
                    "Edital vazio"
                )

            if not registro[
                "codigo_vaga"
            ]:

                raise ValueError(
                    "Vaga vazia"
                )

            if not registro[
                "nome"
            ]:

                raise ValueError(
                    "Nome vazio"
                )

            # ------------------------------------------------
            # NÃO PERMITIR NOTAS NEGATIVAS
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

            # ------------------------------------------------
            # CRIAR CHAVE ESTÁVEL
            # ------------------------------------------------

            registro[
                "chave_fonte"
            ] = criar_chave_fonte(
                registro
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
        registro[
            "chave_fonte"
        ]
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
                    chave_fonte
                FROM
                    gerenciamento_concursos
                    .entrevistas_candidatos;
            """)

            existentes = {
                linha[0]
                for linha
                in cursor.fetchall()
            }

    chaves_fonte = {
        registro[
            "chave_fonte"
        ]
        for registro
        in registros
    }

    inserir = len(
        chaves_fonte
        - existentes
    )

    atualizar = len(
        chaves_fonte
        & existentes
    )

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
# CONTAR VALORES
# ============================================================

def contar_valor(
    registros,
    campo,
    valor_esperado,
):

    return sum(
        1
        for registro
        in registros
        if normalizar_chave(
            registro.get(
                campo
            )
        )
        ==
        normalizar_chave(
            valor_esperado
        )
    )


# ============================================================
# MOSTRAR DUPLICIDADES DETALHADAS
# ============================================================

def mostrar_duplicidades(
    registros,
    duplicidades,
):

    print(
        "\nDUPLICIDADES ENCONTRADAS:"
    )

    for (
        chave,
        quantidade,
    ) in list(
        duplicidades.items()
    )[:30]:

        print(
            "\n"
            + "-" * 65
        )

        print(
            "Chave duplicada: "
            f"{quantidade} registros"
        )

        print(
            f"Hash: {chave}"
        )

        registros_duplicados = [
            registro
            for registro
            in registros
            if registro[
                "chave_fonte"
            ] == chave
        ]

        for registro in (
            registros_duplicados
        ):

            print(
                "\n"
                "  -------------------------------"
            )

            print(
                "  Linha: "
                f"{registro['linha_origem']}"
            )

            print(
                "  DSEI: "
                f"{registro['dsei']}"
            )

            print(
                "  Edital: "
                f"{registro['edital']}"
            )

            print(
                "  Vaga: "
                f"{registro['codigo_vaga']}"
            )

            print(
                "  Código candidato: "
                f"{registro['codigo_candidato']}"
            )

            print(
                "  Nome: "
                f"{registro['nome']}"
            )

            print(
                "  Modalidade: "
                f"{registro['modalidade_concorrencia']}"
            )

            print(
                "  Cargo: "
                f"{registro['cargo']}"
            )

            print(
                "  Comparecimento: "
                f"{registro['comparecimento']}"
            )

            print(
                "  Parecer: "
                f"{registro['parecer']}"
            )

            print(
                "  Nota total: "
                f"{registro['nota_total']}"
            )

            print(
                "  Nota 1: "
                f"{registro['nota_1']}"
            )

            print(
                "  Nota 2: "
                f"{registro['nota_2']}"
            )

            print(
                "  Nota 3: "
                f"{registro['nota_3']}"
            )

            print(
                "  Nota 4: "
                f"{registro['nota_4']}"
            )

            print(
                "  Link: "
                f"{registro['link_planilha_entrevista']}"
            )


# ============================================================
# EXECUÇÃO
# ============================================================

def main():

    print(
        "=" * 65
    )

    print(
        "ETL ENTREVISTAS - DRY RUN"
    )

    print(
        "=" * 65
    )

    # --------------------------------------------------------
    # LER GOOGLE SHEETS
    # --------------------------------------------------------

    linhas = ler_planilha()

    print(
        "Linhas recebidas do Google: "
        f"{len(linhas) - 1}"
    )

    # --------------------------------------------------------
    # TRANSFORMAR
    # --------------------------------------------------------

    (
        registros,
        erros,
    ) = transformar(
        linhas
    )

    # --------------------------------------------------------
    # DUPLICIDADES
    # --------------------------------------------------------

    duplicidades = (
        localizar_duplicidades(
            registros
        )
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
        "Chaves duplicadas: "
        f"{len(duplicidades)}"
    )

    # --------------------------------------------------------
    # MOSTRAR ERROS
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
    # MOSTRAR DUPLICIDADES DETALHADAS
    # --------------------------------------------------------

    if duplicidades:

        mostrar_duplicidades(
            registros,
            duplicidades,
        )

    # --------------------------------------------------------
    # BLOQUEAR CARGA SE HOUVER PROBLEMAS
    # --------------------------------------------------------

    if (
        erros
        or duplicidades
    ):

        print(
            "\n"
            + "=" * 65
        )

        print(
            "Carga bloqueada."
        )

        print(
            "Nenhum dado foi alterado "
            "no Supabase."
        )

        print(
            "=" * 65
        )

        return

    # --------------------------------------------------------
    # COMPARAR COM BANCO
    # --------------------------------------------------------

    (
        inserir,
        atualizar,
        inativar,
    ) = comparar_com_banco(
        registros
    )

    print(
        "\n"
        + "=" * 65
    )

    print(
        "PLANO DA SINCRONIZAÇÃO"
    )

    print(
        "=" * 65
    )

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
        "TOTAL NA FONTE: "
        f"{len(registros)}"
    )

    # ========================================================
    # ESTATÍSTICAS DA FONTE
    # ========================================================

    editais = {
        registro[
            "edital"
        ]
        for registro
        in registros
    }

    vagas = {
        (
            registro[
                "edital"
            ],
            registro[
                "codigo_vaga"
            ],
        )
        for registro
        in registros
    }

    dseis = {
        registro[
            "dsei"
        ]
        for registro
        in registros
        if registro[
            "dsei"
        ]
    }

    cargos = {
        registro[
            "cargo"
        ]
        for registro
        in registros
        if registro[
            "cargo"
        ]
    }

    # --------------------------------------------------------
    # COMPARECIMENTO
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # PARECER
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # NOTA TOTAL
    # --------------------------------------------------------

    notas = [
        registro[
            "nota_total"
        ]
        for registro
        in registros
        if registro[
            "nota_total"
        ] is not None
    ]

    media_nota = (
        sum(
            notas,
            Decimal("0")
        )
        / Decimal(
            len(notas)
        )
        if notas
        else Decimal("0")
    )

    # --------------------------------------------------------
    # NOTAS POR CRITÉRIO
    # --------------------------------------------------------

    notas_1 = [
        registro["nota_1"]
        for registro
        in registros
        if registro["nota_1"]
        is not None
    ]

    notas_2 = [
        registro["nota_2"]
        for registro
        in registros
        if registro["nota_2"]
        is not None
    ]

    notas_3 = [
        registro["nota_3"]
        for registro
        in registros
        if registro["nota_3"]
        is not None
    ]

    notas_4 = [
        registro["nota_4"]
        for registro
        in registros
        if registro["nota_4"]
        is not None
    ]

    media_nota_1 = (
        sum(
            notas_1,
            Decimal("0")
        )
        / Decimal(
            len(notas_1)
        )
        if notas_1
        else Decimal("0")
    )

    media_nota_2 = (
        sum(
            notas_2,
            Decimal("0")
        )
        / Decimal(
            len(notas_2)
        )
        if notas_2
        else Decimal("0")
    )

    media_nota_3 = (
        sum(
            notas_3,
            Decimal("0")
        )
        / Decimal(
            len(notas_3)
        )
        if notas_3
        else Decimal("0")
    )

    media_nota_4 = (
        sum(
            notas_4,
            Decimal("0")
        )
        / Decimal(
            len(notas_4)
        )
        if notas_4
        else Decimal("0")
    )

    # ========================================================
    # RESULTADOS
    # ========================================================

    print(
        "\nRESUMO DA FONTE:"
    )

    print(
        f"Editais distintos: "
        f"{len(editais)}"
    )

    print(
        f"Vagas distintas: "
        f"{len(vagas)}"
    )

    print(
        f"DSEIs distintos: "
        f"{len(dseis)}"
    )

    print(
        f"Cargos distintos: "
        f"{len(cargos)}"
    )

    print(
        "Convocados para entrevista: "
        f"{len(registros)}"
    )

    print(
        f"Compareceram: "
        f"{compareceram}"
    )

    print(
        f"Não compareceram: "
        f"{nao_compareceram}"
    )

    print(
        f"Aptos: "
        f"{aptos}"
    )

    print(
        f"Inaptos: "
        f"{inaptos}"
    )

    print(
        "Média da nota total: "
        f"{media_nota:.2f}"
    )

    print(
        "Média Critério 1: "
        f"{media_nota_1:.2f}"
    )

    print(
        "Média Critério 2: "
        f"{media_nota_2:.2f}"
    )

    print(
        "Média Critério 3: "
        f"{media_nota_3:.2f}"
    )

    print(
        "Média Critério 4: "
        f"{media_nota_4:.2f}"
    )

    print(
        "\nDRY RUN concluído."
    )

    print(
        "Nenhum dado foi alterado "
        "no Supabase."
    )


if __name__ == "__main__":
    main()