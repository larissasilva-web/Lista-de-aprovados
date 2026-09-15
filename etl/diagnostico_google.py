"""
Diagnóstico de acesso ao Google Drive / Sheets.

Responde a uma pergunta só: a conta de serviço configurada consegue
enxergar as planilhas — agindo como ela mesma e/ou em nome de um
usuário do Workspace?

Uso:
    python etl/diagnostico_google.py
    python etl/diagnostico_google.py <ID_DA_PASTA>

    # testar outro JSON sem mexer no .env.local:
    python etl/diagnostico_google.py <ID_DA_PASTA> --cred "C:\\caminho\\outro.json"

    # testar a personificação sem mexer no .env.local:
    python etl/diagnostico_google.py <ID_DA_PASTA> --user alguem@agenciasus.org.br

    # testar o OAuth de usuário (autoriza no navegador, sem precisar de admin):
    python etl/diagnostico_google.py <ID_DA_PASTA> --oauth "C:\\caminho\\oauth_client.json"

Sem --cred/--user, lê GOOGLE_CREDENTIALS_FILE e GOOGLE_IMPERSONATE_USER
do .env.local na raiz do projeto.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


RAIZ = Path(__file__).resolve().parents[1]
load_dotenv(RAIZ / ".env.local")

SCOPES = [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/spreadsheets.readonly",
]

MIME_SHEETS = "application/vnd.google-apps.spreadsheet"


def montar_credencial(caminho: str, usuario: str | None):
    credencial = Credentials.from_service_account_file(caminho, scopes=SCOPES)

    if usuario:
        credencial = credencial.with_subject(usuario)

    return credencial


def testar(credencial, rotulo: str, pasta: str | None) -> None:
    print(f"\n=== {rotulo} ===")

    if pasta:
        consulta = (
            f"'{pasta}' in parents and trashed = false "
            f"and mimeType = '{MIME_SHEETS}'"
        )
    else:
        consulta = f"trashed = false and mimeType = '{MIME_SHEETS}'"

    try:
        drive = build("drive", "v3", credentials=credencial, cache_discovery=False)

        resposta = (
            drive.files()
            .list(
                q=consulta,
                fields="files(id,name,owners(emailAddress))",
                pageSize=10,
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            )
            .execute()
        )

    except HttpError as erro:
        print(f"  FALHOU (HTTP {erro.resp.status})")
        print(f"  {str(erro)[:400]}")
        explicar(erro)
        return

    except Exception as erro:  # noqa: BLE001 - diagnóstico precisa ver tudo
        print(f"  FALHOU ({type(erro).__name__})")
        print(f"  {str(erro)[:400]}")
        explicar(erro)
        return

    arquivos = resposta.get("files", [])
    print(f"  planilhas visíveis: {len(arquivos)}")

    for arquivo in arquivos[:10]:
        dono = (arquivo.get("owners") or [{}])[0].get("emailAddress", "?")
        print(f"    - {arquivo['name'][:55]:55} (dono: {dono})")

    if not arquivos:
        print("    (nenhuma — nada foi compartilhado com esta identidade)")


def explicar(erro: Exception) -> None:
    texto = str(erro).lower()

    if "unauthorized_client" in texto:
        print(
            "\n  >> A delegação em todo o domínio NÃO está autorizada.\n"
            "     Um super admin precisa liberar o client_id em\n"
            "     admin.google.com > Segurança > Controles de API >\n"
            "     Delegação em todo o domínio, com exatamente estes escopos:\n"
            f"     {','.join(SCOPES)}"
        )
    elif "invalid_grant" in texto:
        print(
            "\n  >> O usuário informado em GOOGLE_IMPERSONATE_USER não existe\n"
            "     neste domínio do Workspace, ou o e-mail está errado."
        )
    elif "403" in texto or "insufficient" in texto:
        print(
            "\n  >> Sem permissão. Se estiver agindo como a própria conta de\n"
            "     serviço, compartilhe a pasta do Drive com o e-mail dela."
        )


def main() -> None:
    analisador = argparse.ArgumentParser(
        description="Testa o acesso ao Google Drive / Sheets."
    )
    analisador.add_argument(
        "pasta",
        nargs="?",
        help="ID da pasta do Drive a testar (opcional)",
    )
    analisador.add_argument(
        "--cred",
        help="JSON da conta de serviço (sobrepõe GOOGLE_CREDENTIALS_FILE)",
    )
    analisador.add_argument(
        "--user",
        help="E-mail a personificar (sobrepõe GOOGLE_IMPERSONATE_USER)",
    )
    analisador.add_argument(
        "--oauth",
        help=(
            "JSON do cliente OAuth (app para computador). Autoriza uma vez "
            "no navegador e passa a agir como você. Não exige admin."
        ),
    )
    argumentos = analisador.parse_args()

    # Modo OAuth: testa e encerra, não depende de conta de serviço.
    cliente_oauth = (
        argumentos.oauth or os.getenv("GOOGLE_OAUTH_CLIENT_FILE") or ""
    ).strip()

    if cliente_oauth:
        from google_auth import obter_credenciais_oauth

        print("=== C) OAuth de usuário ===")
        print(f"  cliente: {cliente_oauth}")

        testar(
            obter_credenciais_oauth(Path(cliente_oauth).expanduser()),
            "C) Agindo como o usuário que autorizou no navegador",
            argumentos.pasta,
        )
        return

    caminho = (
        argumentos.cred or os.getenv("GOOGLE_CREDENTIALS_FILE") or ""
    ).strip()

    if not caminho:
        raise SystemExit(
            "Nenhuma credencial informada. Use --cred ou defina "
            "GOOGLE_CREDENTIALS_FILE no .env.local"
        )

    caminho = str(Path(caminho).expanduser())

    if not Path(caminho).exists():
        raise SystemExit(f"Arquivo de credenciais não encontrado: {caminho}")

    with open(caminho, encoding="utf-8") as arquivo:
        info = json.load(arquivo)

    print("=== CONTA DE SERVIÇO CONFIGURADA ===")
    print(f"  projeto      : {info.get('project_id')}")
    print(f"  client_email : {info.get('client_email')}")
    print(f"  client_id    : {info.get('client_id')}")
    print("\n  (compartilhe as pastas do Drive com o client_email acima,")
    print("   ou autorize o client_id na delegação em todo o domínio)")

    pasta = argumentos.pasta

    if pasta:
        print(f"\n  filtrando pela pasta: {pasta}")

    testar(
        montar_credencial(caminho, None),
        "A) Agindo como a própria conta de serviço",
        pasta,
    )

    usuario = (
        argumentos.user or os.getenv("GOOGLE_IMPERSONATE_USER") or ""
    ).strip()

    if usuario:
        testar(
            montar_credencial(caminho, usuario),
            f"B) Agindo em nome de {usuario}",
            pasta,
        )
    else:
        print("\n=== B) Personificação ===")
        print("  Nenhum usuário informado — teste pulado.")
        print("  Passe --user para testar sem alterar o .env.local:")
        print("  --user dados.recursoshumanos@agenciasus.org.br")


if __name__ == "__main__":
    main()
