"""
Autenticação Google compartilhada pelos ETLs.

Três modos, nesta ordem de preferência:

1. OAuth de usuário (GOOGLE_OAUTH_CLIENT_FILE)
   Você autoriza uma vez no navegador e o token fica salvo em disco.
   O script passa a agir COMO VOCÊ e enxerga tudo que você enxerga,
   inclusive "Compartilhados comigo". Não exige admin do Workspace.

2. Conta de serviço com personificação (GOOGLE_IMPERSONATE_USER)
   Exige delegação em todo o domínio autorizada por um super admin.

3. Conta de serviço pura (GOOGLE_CREDENTIALS_FILE)
   Só enxerga o que foi compartilhado com o e-mail dela.

Os escopos são sempre os mesmos para que um único token sirva aos
dois ETLs.
"""

from __future__ import annotations

import os
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials as CredenciaisUsuario
from google.oauth2.service_account import Credentials as CredenciaisServico


ESCOPOS = [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/spreadsheets.readonly",
]


def _caminho(valor: str | None) -> Path | None:
    valor = (valor or "").strip()
    return Path(valor).expanduser() if valor else None


def _token_padrao(cliente: Path) -> Path:
    return cliente.with_name("token_google.json")


def obter_credenciais_oauth(
    arquivo_cliente: Path,
    arquivo_token: Path | None = None,
):
    """
    Fluxo de aplicativo instalado. Abre o navegador na primeira vez e
    reaproveita o token salvo nas execuções seguintes.
    """
    # Importado aqui porque só este modo depende da biblioteca.
    from google_auth_oauthlib.flow import InstalledAppFlow

    arquivo_token = arquivo_token or _token_padrao(arquivo_cliente)
    credenciais = None

    if arquivo_token.exists():
        credenciais = CredenciaisUsuario.from_authorized_user_file(
            str(arquivo_token), ESCOPOS
        )

    if credenciais and credenciais.valid:
        return credenciais

    if (
        credenciais
        and credenciais.expired
        and credenciais.refresh_token
    ):
        try:
            credenciais.refresh(Request())
            arquivo_token.write_text(
                credenciais.to_json(), encoding="utf-8"
            )
            return credenciais
        except Exception:  # noqa: BLE001 - cai para o fluxo interativo
            credenciais = None

    if not arquivo_cliente.exists():
        raise RuntimeError(
            f"Arquivo de cliente OAuth não encontrado: {arquivo_cliente}"
        )

    fluxo = InstalledAppFlow.from_client_secrets_file(
        str(arquivo_cliente), ESCOPOS
    )

    print(
        "\nAbrindo o navegador para você autorizar o acesso.\n"
        "Entre com a conta que enxerga as pastas do Drive.\n"
    )

    credenciais = fluxo.run_local_server(port=0)

    arquivo_token.parent.mkdir(parents=True, exist_ok=True)
    arquivo_token.write_text(credenciais.to_json(), encoding="utf-8")

    print(f"Token salvo em: {arquivo_token}\n")

    return credenciais


def obter_credenciais(
    arquivo_credenciais: str | None = None,
    impersonar: str | None = None,
    arquivo_cliente_oauth: str | None = None,
    arquivo_token: str | None = None,
):
    """
    Devolve a credencial conforme o que estiver configurado.
    Parâmetros vazios caem para as variáveis de ambiente.
    """
    cliente_oauth = _caminho(
        arquivo_cliente_oauth or os.getenv("GOOGLE_OAUTH_CLIENT_FILE")
    )

    if cliente_oauth:
        token = _caminho(
            arquivo_token or os.getenv("GOOGLE_OAUTH_TOKEN_FILE")
        )
        return obter_credenciais_oauth(cliente_oauth, token)

    conta_servico = _caminho(
        arquivo_credenciais or os.getenv("GOOGLE_CREDENTIALS_FILE")
    )

    if not conta_servico:
        raise RuntimeError(
            "Nenhuma credencial configurada. Defina GOOGLE_OAUTH_CLIENT_FILE "
            "(recomendado, não exige admin) ou GOOGLE_CREDENTIALS_FILE."
        )

    if not conta_servico.exists():
        raise RuntimeError(
            f"Arquivo de credenciais não encontrado: {conta_servico}"
        )

    credenciais = CredenciaisServico.from_service_account_file(
        str(conta_servico), scopes=ESCOPOS
    )

    usuario = (
        impersonar or os.getenv("GOOGLE_IMPERSONATE_USER") or ""
    ).strip()

    if usuario:
        credenciais = credenciais.with_subject(usuario)

    return credenciais


def descrever_modo() -> str:
    """Uma linha dizendo qual modo está ativo, para os logs dos ETLs."""
    if (os.getenv("GOOGLE_OAUTH_CLIENT_FILE") or "").strip():
        return "OAuth de usuário (token local)"

    usuario = (os.getenv("GOOGLE_IMPERSONATE_USER") or "").strip()

    if usuario:
        return f"Conta de serviço personificando {usuario}"

    return "Conta de serviço (acesso próprio)"
