from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


def _carregar_env() -> None:
    candidatos = []
    cwd = Path.cwd().resolve()
    aqui = Path(__file__).resolve()

    for base in [cwd, *cwd.parents, aqui.parent, *aqui.parents]:
        candidatos.extend([base / ".env.local", base / ".env"])

    vistos = set()
    for arquivo in candidatos:
        chave = str(arquivo)
        if chave in vistos:
            continue
        vistos.add(chave)
        if arquivo.exists():
            load_dotenv(arquivo, override=False)


def _montar_database_url() -> str:
    for nome in ("DATABASE_URL", "SUPABASE_DB_URL", "POSTGRES_URL"):
        valor = (os.getenv(nome) or "").strip()
        if valor:
            return valor

    host = (os.getenv("PGHOST") or os.getenv("DB_HOST") or "").strip()
    port = (os.getenv("PGPORT") or os.getenv("DB_PORT") or "5432").strip()
    database = (os.getenv("PGDATABASE") or os.getenv("DB_NAME") or "postgres").strip()
    user = (os.getenv("PGUSER") or os.getenv("DB_USER") or "").strip()
    password = (os.getenv("PGPASSWORD") or os.getenv("DB_PASSWORD") or "").strip()

    if host and user and password:
        from urllib.parse import quote_plus

        return (
            f"postgresql://{quote_plus(user)}:{quote_plus(password)}@"
            f"{host}:{port}/{quote_plus(database)}"
        )

    raise RuntimeError(
        "Banco nao configurado. Defina DATABASE_URL (recomendado) ou as variaveis PGHOST/PGUSER/PGPASSWORD."
    )


@dataclass(frozen=True)
class Config:
    database_url: str
    google_credentials_file: Path
    google_impersonate_user: str | None
    db_schema: str
    analise_sheet_name: str
    importacao_sheet_name: str


def obter_config() -> Config:
    _carregar_env()

    cred = (os.getenv("GOOGLE_CREDENTIALS_FILE") or "").strip()
    if not cred:
        raise RuntimeError("GOOGLE_CREDENTIALS_FILE nao foi definido.")

    cred_path = Path(cred).expanduser().resolve()
    if not cred_path.exists():
        raise RuntimeError(f"Arquivo de credenciais Google nao encontrado: {cred_path}")

    schema = (os.getenv("DB_SCHEMA") or "gerenciamento_concursos").strip()
    if not schema.replace("_", "").isalnum():
        raise RuntimeError("DB_SCHEMA invalido.")

    return Config(
        database_url=_montar_database_url(),
        google_credentials_file=cred_path,
        google_impersonate_user=(os.getenv("GOOGLE_IMPERSONATE_USER") or "").strip() or None,
        db_schema=schema,
        analise_sheet_name=(os.getenv("ANALISE_SHEET_NAME") or "APTOS PARA ANÁLISE").strip(),
        importacao_sheet_name=(os.getenv("IMPORTACAO_SHEET_NAME") or "IMPORTACAO EMPREGARE").strip(),
    )
