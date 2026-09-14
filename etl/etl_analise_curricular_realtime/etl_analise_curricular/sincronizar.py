from __future__ import annotations

import argparse
import sys
from typing import Any

from .config import obter_config
from .db import Banco
from .google_client import ArquivoGoogle, GoogleClient
from .parser_analise import (
    calcular_indicadores_importacao,
    extrair_registros,
    parsear_nome_arquivo,
    resumir_etapas,
)


def _resolver_fonte_planilha(
    banco: Banco,
    arquivo: ArquivoGoogle,
    edital_id: str | None,
) -> dict[str, Any]:
    if edital_id:
        fonte = banco.obter_fonte_por_edital(edital_id)
        if not fonte:
            raise RuntimeError(f"Nao existe fontes_editais para edital_id={edital_id}.")
        return fonte

    for pasta_id in arquivo.parents:
        fonte = banco.obter_fonte_por_pasta(pasta_id)
        if fonte:
            return fonte

    raise RuntimeError(
        "Nao foi possivel descobrir o edital pela pasta pai da planilha. "
        "Cadastre pasta_analise_id em fontes_editais ou informe --edital-id."
    )


def _processar_planilha(
    *,
    banco: Banco,
    google: GoogleClient,
    fonte: dict[str, Any] | None,
    arquivo: ArquivoGoogle,
    nome_aba_analise: str,
    nome_aba_importacao: str,
    dry_run: bool,
    forcar: bool,
) -> dict[str, Any]:
    vaga = parsear_nome_arquivo(arquivo.nome)
    if not vaga.codigo_vaga:
        return {"status": "IGNORADA", "motivo": "Nome do arquivo sem codigo de vaga detectavel."}

    if not dry_run:
        if not fonte:
            raise RuntimeError("Fonte do edital obrigatoria para gravacao.")
        existente = banco.obter_vaga_por_planilha(arquivo.id)
        if (
            existente
            and existente.get("drive_ultima_atualizacao")
            and arquivo.modified_time <= existente["drive_ultima_atualizacao"]
            and not forcar
        ):
            return {"status": "SEM_ALTERACAO", "qtd": existente.get("qtd_registros") or 0}

    valores_aptos = google.ler_aba(arquivo.id, nome_aba_analise)
    registros = extrair_registros(valores_aptos)

    valores_importacao = google.ler_aba(arquivo.id, nome_aba_importacao)
    indicadores = calcular_indicadores_importacao(
        valores_importacao,
        total_aptos=len(registros),
    )
    etapas = resumir_etapas(registros)

    if dry_run:
        resumo_status = {}
        for r in registros:
            resumo_status[r["status_consolidado"]] = resumo_status.get(r["status_consolidado"], 0) + 1

        return {
            "status": "DRY_RUN",
            "codigo_vaga": vaga.codigo_vaga,
            "nome_vaga": vaga.nome_vaga,
            "unidade": vaga.unidade,
            "indicadores": indicadores.as_dict(),
            "etapas_analise": etapas,
            "status_consolidado": resumo_status,
        }

    return banco.sincronizar_vaga(
        fonte=fonte,
        arquivo=arquivo,
        vaga=vaga,
        registros=registros,
        indicadores=indicadores,
        forcar=forcar,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Sincroniza analise curricular diretamente das planilhas individuais.")
    parser.add_argument("--edital-id", help="UUID do edital para limitar a execucao.")
    parser.add_argument("--planilha-id", help="ID de uma unica planilha para teste/execucao isolada.")
    parser.add_argument("--dry-run", action="store_true", help="Le e valida sem gravar no banco.")
    parser.add_argument("--forcar", action="store_true", help="Reprocessa mesmo sem mudanca no modifiedTime.")
    args = parser.parse_args()

    cfg = obter_config()
    banco = Banco(cfg.database_url, cfg.db_schema)
    google = GoogleClient(str(cfg.google_credentials_file))

    if args.planilha_id:
        arquivo = google.obter_arquivo(args.planilha_id)
        fonte = None
        try:
            try:
                fonte = _resolver_fonte_planilha(banco, arquivo, args.edital_id)
            except RuntimeError:
                if not args.dry_run:
                    raise

            resultado = _processar_planilha(
                banco=banco,
                google=google,
                fonte=fonte,
                arquivo=arquivo,
                nome_aba_analise=cfg.analise_sheet_name,
                nome_aba_importacao=cfg.importacao_sheet_name,
                dry_run=args.dry_run,
                forcar=args.forcar,
            )
            print(f"[{resultado['status']}] {arquivo.nome}")
            print(resultado)
            return 0
        except Exception as exc:
            if not args.dry_run:
                banco.registrar_erro(fonte, arquivo, str(exc))
            print(f"[ERRO] {arquivo.nome}: {exc}", file=sys.stderr)
            return 1

    fontes = banco.listar_fontes(edital_id=args.edital_id, incluir_desabilitado=False)
    if not fontes:
        print("Nenhuma fonte habilitada encontrada.")
        return 0

    total_ok = 0
    total_sem_alteracao = 0
    total_ignoradas = 0
    total_erros = 0

    for fonte in fontes:
        pasta_id = fonte["pasta_analise_id"]
        erros_edital = 0
        print(f"\nEdital {fonte['edital']} | pasta {pasta_id}")
        try:
            arquivos = google.listar_planilhas_pasta(pasta_id)
            ids_presentes = [a.id for a in arquivos]

            for arquivo in arquivos:
                try:
                    resultado = _processar_planilha(
                        banco=banco,
                        google=google,
                        fonte=fonte,
                        arquivo=arquivo,
                        nome_aba_analise=cfg.analise_sheet_name,
                        nome_aba_importacao=cfg.importacao_sheet_name,
                        dry_run=args.dry_run,
                        forcar=args.forcar,
                    )
                    print(f"  [{resultado['status']}] {arquivo.nome}")
                    if resultado["status"] in {"SINCRONIZADO", "DRY_RUN"}:
                        total_ok += 1
                    elif resultado["status"] == "SEM_ALTERACAO":
                        total_sem_alteracao += 1
                    else:
                        total_ignoradas += 1
                except Exception as exc:
                    total_erros += 1
                    erros_edital += 1
                    print(f"  [ERRO] {arquivo.nome}: {exc}", file=sys.stderr)
                    if not args.dry_run:
                        banco.registrar_erro(fonte, arquivo, str(exc))

            if not args.dry_run:
                inativadas = banco.marcar_ausentes_como_inativas(fonte["edital_id"], ids_presentes)
                status = "SUCESSO" if erros_edital == 0 else "PARCIAL"
                mensagem = None if erros_edital == 0 else f"Execucao concluida com {erros_edital} erro(s) neste edital."
                banco.atualizar_status_fonte(fonte["edital_id"], status, mensagem)
                if inativadas:
                    print(f"  [INFO] {inativadas} origem(ns) ausente(s) marcada(s) como inativa(s).")

        except Exception as exc:
            total_erros += 1
            print(f"  [ERRO PASTA] {exc}", file=sys.stderr)
            if not args.dry_run:
                banco.registrar_erro(fonte, None, str(exc))
                banco.atualizar_status_fonte(fonte["edital_id"], "ERRO", str(exc)[:4000])

    print(
        "\nResumo: "
        f"processadas={total_ok}, sem_alteracao={total_sem_alteracao}, "
        f"ignoradas={total_ignoradas}, erros={total_erros}"
    )
    return 1 if total_erros else 0


if __name__ == "__main__":
    raise SystemExit(main())
