import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv


# ============================================================
# CARREGAR .env.local DA RAIZ DO PROJETO
# ============================================================

RAIZ_PROJETO = Path(__file__).resolve().parents[2]
ARQUIVO_ENV = RAIZ_PROJETO / ".env.local"

load_dotenv(ARQUIVO_ENV)


# ============================================================
# CONFIGURAÇÕES
# ============================================================

PGHOST = os.getenv("PGHOST")
PGPORT = os.getenv("PGPORT", "5432")
PGDATABASE = os.getenv("PGDATABASE", "postgres")
PGUSER = os.getenv("PGUSER")
PGPASSWORD = os.getenv("PGPASSWORD")
PGSSLMODE = os.getenv("PGSSLMODE", "require")


if not PGHOST:
    raise RuntimeError("PGHOST não encontrado no .env.local")

if not PGUSER:
    raise RuntimeError("PGUSER não encontrado no .env.local")

if not PGPASSWORD:
    raise RuntimeError("PGPASSWORD não encontrado no .env.local")


# ============================================================
# TESTE DE CONEXÃO
# ============================================================

print("Conectando ao PostgreSQL do Supabase...")


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
                current_database(),
                current_user,
                now();
        """)

        banco, usuario, data_hora = cursor.fetchone()

        print("Conexão estabelecida!")
        print(f"Banco: {banco}")
        print(f"Usuário: {usuario}")
        print(f"Data/hora do banco: {data_hora}")

        cursor.execute("""
            SELECT COUNT(*)
            FROM gerenciamento_concursos.analise_curricular_saude_indigena;
        """)

        quantidade = cursor.fetchone()[0]

        print(
            "Registros atuais na tabela: "
            f"{quantidade}"
        )


print("Teste concluído com sucesso.")