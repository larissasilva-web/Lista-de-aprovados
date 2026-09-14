from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from typing import Any

from .normalizacao import (
    ALIASES,
    calcular_idade,
    calcular_total_dias,
    derivar_status_consolidado,
    extrair_pontuacoes_analise,
    limpar_texto,
    normalizar_booleano_texto,
    normalizar_cabecalho,
    normalizar_inteiro,
    normalizar_modalidade,
    normalizar_score,
    parse_data,
)


@dataclass(frozen=True)
class VagaArquivo:
    codigo_vaga: str
    nome_vaga: str | None
    unidade: str | None
    regime: str | None = None
    carga_horaria: str | None = None


@dataclass(frozen=True)
class IndicadoresVaga:
    total_inscritos: int
    total_aptos: int
    total_cancelados: int
    total_questionarios_pendentes: int
    total_reprovados_nota: int

    def as_dict(self) -> dict[str, int]:
        return {
            "total_inscritos": self.total_inscritos,
            "total_aptos": self.total_aptos,
            "total_cancelados": self.total_cancelados,
            "total_questionarios_pendentes": self.total_questionarios_pendentes,
            "total_reprovados_nota": self.total_reprovados_nota,
        }


def _parece_unidade_saude_indigena(valor: str) -> bool:
    chave = normalizar_booleano_texto(valor)
    return (
        chave.startswith("dsei ")
        or chave == "dsei"
        or chave.startswith("casai ")
        or chave == "casai"
        or chave.startswith("emergencia yanomami")
        or chave.startswith("pey ")
        or chave == "pey"
    )


def parsear_nome_arquivo(nome: str) -> VagaArquivo:
    """
    Exemplo oficial validado:
    [CD] Vaga 152415 - Assistente Administrativo - Cadastro Reserva - DSEI MÉDIO RIO PURUS -

    Resultado:
      codigo_vaga = 152415
      nome_vaga   = Assistente Administrativo - Cadastro Reserva
      unidade     = DSEI MÉDIO RIO PURUS

    Tudo que estiver entre o codigo da vaga e a unidade pertence ao nome da vaga.
    """
    original = re.sub(r"\.[^.]+$", "", limpar_texto(nome))
    achado = re.search(r"\b(\d{4,})\b", original)
    codigo = achado.group(1) if achado else ""
    if not codigo:
        return VagaArquivo("", None, None)

    tail = re.sub(r"^\[[^\]]+\]\s*", "", original, flags=re.I)
    tail = re.sub(r"^vaga\s+", "", tail, flags=re.I)
    tail = re.sub(rf"^.*?\b{re.escape(codigo)}\b\s*-\s*", "", tail, flags=re.I).strip()
    tail = re.sub(r"\s*-\s*$", "", tail).strip()
    partes = [p.strip() for p in tail.split(" - ") if p.strip()]

    unidade_idx = None
    for i in range(len(partes) - 1, -1, -1):
        if _parece_unidade_saude_indigena(partes[i]):
            unidade_idx = i
            break

    if unidade_idx is None:
        return VagaArquivo(codigo, " - ".join(partes).strip() or None, None)

    nome_vaga = " - ".join(partes[:unidade_idx]).strip() or None
    unidade = limpar_texto(partes[unidade_idx]) or None
    return VagaArquivo(codigo, nome_vaga, unidade)


def _indice_cabecalho(cabecalhos: list[Any]) -> dict[str, int]:
    return {normalizar_cabecalho(valor): i for i, valor in enumerate(cabecalhos)}


def _tem_alias(idx: dict[str, int], campo: str) -> bool:
    return any(normalizar_cabecalho(alias) in idx for alias in ALIASES[campo])


def detectar_linha_cabecalho(valores: list[list[Any]], limite: int = 10) -> int:
    for i, linha in enumerate(valores[:limite]):
        idx = _indice_cabecalho(linha)
        if _tem_alias(idx, "candidato") and _tem_alias(idx, "id") and _tem_alias(idx, "etapa"):
            return i
    raise RuntimeError("Cabecalho minimo nao localizado: candidato/nome, codigo/id e etapa sao obrigatorios.")


def _campo(linha: list[Any], idx: dict[str, int], campo: str) -> Any:
    for alias in ALIASES[campo]:
        pos = idx.get(normalizar_cabecalho(alias))
        if pos is not None and pos < len(linha):
            return linha[pos]
    return ""


def _hash_registro(registro: dict[str, Any]) -> str:
    serializavel = {k: str(v) if v is not None else None for k, v in registro.items() if k != "hash_registro"}
    raw = json.dumps(serializavel, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def extrair_registros(valores: list[list[Any]]) -> list[dict[str, Any]]:
    if not valores:
        return []

    cabecalho_idx = detectar_linha_cabecalho(valores)
    idx = _indice_cabecalho(valores[cabecalho_idx])
    registros: list[dict[str, Any]] = []

    for numero_linha, linha in enumerate(valores[cabecalho_idx + 1 :], start=cabecalho_idx + 2):
        candidato = limpar_texto(_campo(linha, idx, "candidato"))
        if not candidato:
            continue

        codigo_candidato = limpar_texto(_campo(linha, idx, "id"))
        if not codigo_candidato:
            raise RuntimeError(f"Linha {numero_linha}: candidato sem codigo/id.")

        data_nascimento = parse_data(_campo(linha, idx, "data_nascimento"))
        idade = normalizar_inteiro(_campo(linha, idx, "idade")) or calcular_idade(data_nascimento)
        analise = limpar_texto(_campo(linha, idx, "analise"))
        etapa = limpar_texto(_campo(linha, idx, "etapa"))
        pontuacoes_texto = extrair_pontuacoes_analise(analise)

        exp_prof_anos = normalizar_inteiro(_campo(linha, idx, "experiencia_profissional_anos"))
        exp_prof_meses = normalizar_inteiro(_campo(linha, idx, "experiencia_profissional_meses"))
        exp_prof_dias = normalizar_inteiro(_campo(linha, idx, "experiencia_profissional_dias"))
        exp_prof_total = normalizar_inteiro(_campo(linha, idx, "experiencia_profissional_total"))
        if exp_prof_total is None:
            exp_prof_total = calcular_total_dias(exp_prof_anos, exp_prof_meses, exp_prof_dias)
        if exp_prof_total is None and pontuacoes_texto["experiencia_total_desempate"] is not None:
            try:
                exp_prof_total = int(pontuacoes_texto["experiencia_total_desempate"])
            except (TypeError, ValueError):
                pass

        pont_escolaridade = normalizar_score(_campo(linha, idx, "pontuacao_escolaridade"))
        pont_cursos = normalizar_score(_campo(linha, idx, "pontuacao_cursos_aperfeicoamento"))
        pont_experiencia = normalizar_score(_campo(linha, idx, "pontuacao_experiencia_profissional"))
        pont_etnico = normalizar_score(_campo(linha, idx, "pontuacao_criterio_etnico"))

        registro = {
            "linha_origem": numero_linha,
            "candidato": candidato,
            "codigo_candidato": codigo_candidato,
            "data_nascimento": data_nascimento,
            "idade": idade,
            "nota_empregare": normalizar_score(_campo(linha, idx, "nota_empregare")),
            "modalidade_concorrencia": normalizar_modalidade(_campo(linha, idx, "modalidade_concorrencia")),
            "nota_final_ajustada": normalizar_score(_campo(linha, idx, "nota_final_ajustada")),
            "somatorio": normalizar_score(_campo(linha, idx, "somatorio")),
            "pontuacao_escolaridade": pont_escolaridade if pont_escolaridade is not None else pontuacoes_texto["escolaridade"],
            "pontuacao_cursos_aperfeicoamento": pont_cursos if pont_cursos is not None else pontuacoes_texto["cursos"],
            "pontuacao_experiencia_profissional": pont_experiencia if pont_experiencia is not None else pontuacoes_texto["experiencia"],
            "pontuacao_criterio_etnico": pont_etnico if pont_etnico is not None else pontuacoes_texto["criterio_etnico"],
            "experiencia_profissional_anos": exp_prof_anos,
            "experiencia_profissional_meses": exp_prof_meses,
            "experiencia_profissional_dias": exp_prof_dias,
            "experiencia_profissional_total": exp_prof_total,
            "experiencia_saude_indigena_anos": normalizar_inteiro(_campo(linha, idx, "experiencia_saude_indigena_anos")),
            "experiencia_saude_indigena_meses": normalizar_inteiro(_campo(linha, idx, "experiencia_saude_indigena_meses")),
            "experiencia_saude_indigena_dias": normalizar_inteiro(_campo(linha, idx, "experiencia_saude_indigena_dias")),
            "experiencia_saude_indigena_total": normalizar_inteiro(_campo(linha, idx, "experiencia_saude_indigena_total")),
            "experiencia_atencao_basica_anos": normalizar_inteiro(_campo(linha, idx, "experiencia_atencao_basica_anos")),
            "experiencia_atencao_basica_meses": normalizar_inteiro(_campo(linha, idx, "experiencia_atencao_basica_meses")),
            "experiencia_atencao_basica_dias": normalizar_inteiro(_campo(linha, idx, "experiencia_atencao_basica_dias")),
            "experiencia_atencao_basica_total": normalizar_inteiro(_campo(linha, idx, "experiencia_atencao_basica_total")),
            "etapa": etapa or None,
            "data_analise": parse_data(_campo(linha, idx, "data_analise")),
            "analise": analise or None,
            "pcd": limpar_texto(_campo(linha, idx, "pcd")) or None,
            "responsavel_analise": limpar_texto(_campo(linha, idx, "responsavel_analise")) or None,
            "coord_demandante": limpar_texto(_campo(linha, idx, "coord_demandante")) or None,
            "email_demandante": limpar_texto(_campo(linha, idx, "email_demandante")) or None,
            "status_consolidado": derivar_status_consolidado(etapa, analise),
        }
        registro["hash_registro"] = _hash_registro(registro)
        registros.append(registro)

    return registros


def _detectar_cabecalho_importacao(valores: list[list[Any]], limite: int = 10) -> tuple[int, dict[str, int], int]:
    """
    Retorna (indice_linha_cabecalho, mapa_cabecalhos, indice_situacao_questionario).

    A coluna geral e exatamente SITUAÇÃO.
    A coluna do questionario comeca com SITUAÇÃO - ... e o restante muda conforme o edital.
    """
    for i, linha in enumerate(valores[:limite]):
        cabecalhos_norm = [normalizar_cabecalho(v) for v in linha]
        idx = {h: pos for pos, h in enumerate(cabecalhos_norm) if h}

        if "situacao" not in idx:
            continue
        if "codigo" not in idx and "nome" not in idx:
            continue

        dinamicas = [
            pos
            for pos, h in enumerate(cabecalhos_norm)
            if h.startswith("situacao ") and h != "situacao"
        ]

        if not dinamicas:
            raise RuntimeError(
                'Aba IMPORTACAO EMPREGARE: nao encontrei a coluna dinamica que comeca com "SITUAÇÃO - ".'
            )
        if len(dinamicas) > 1:
            nomes = [limpar_texto(linha[pos]) for pos in dinamicas]
            raise RuntimeError(
                "Aba IMPORTACAO EMPREGARE: encontrei mais de uma coluna 'SITUAÇÃO - ...': "
                + " | ".join(nomes)
            )

        return i, idx, dinamicas[0]

    raise RuntimeError(
        "Aba IMPORTACAO EMPREGARE: cabecalho nao localizado. Sao necessarios CODIGO/NOME, SITUAÇÃO e SITUAÇÃO - ...."
    )


def calcular_indicadores_importacao(
    valores_importacao: list[list[Any]],
    *,
    total_aptos: int,
) -> IndicadoresVaga:
    if not valores_importacao:
        raise RuntimeError("Aba IMPORTACAO EMPREGARE vazia.")

    header_row, idx, idx_situacao_questionario = _detectar_cabecalho_importacao(valores_importacao)
    idx_codigo = idx.get("codigo")
    idx_nome = idx.get("nome")
    idx_situacao = idx["situacao"]

    total_inscritos = 0
    total_cancelados = 0
    total_questionarios_pendentes = 0

    for linha in valores_importacao[header_row + 1 :]:
        codigo = limpar_texto(linha[idx_codigo]) if idx_codigo is not None and idx_codigo < len(linha) else ""
        nome = limpar_texto(linha[idx_nome]) if idx_nome is not None and idx_nome < len(linha) else ""
        if not codigo and not nome:
            continue

        total_inscritos += 1

        situacao_geral = (
            normalizar_cabecalho(linha[idx_situacao])
            if idx_situacao < len(linha)
            else ""
        )
        situacao_questionario = (
            normalizar_cabecalho(linha[idx_situacao_questionario])
            if idx_situacao_questionario < len(linha)
            else ""
        )

        # Regra oficial: cancelado sempre conta SOMENTE como cancelado,
        # mesmo quando o questionario tambem esta pendente/em andamento.
        if situacao_geral == "cancelado":
            total_cancelados += 1
            continue

        # Para nao cancelados, qualquer valor diferente de FINALIZADO
        # conta como questionario nao finalizado, inclusive vazio.
        if situacao_questionario != "finalizado":
            total_questionarios_pendentes += 1

    total_reprovados_nota = (
        total_inscritos
        - total_aptos
        - total_cancelados
        - total_questionarios_pendentes
    )

    if total_reprovados_nota < 0:
        raise RuntimeError(
            "Funil inconsistente: reprovados por nota ficou negativo. "
            f"inscritos={total_inscritos}, aptos={total_aptos}, "
            f"cancelados={total_cancelados}, questionarios_pendentes={total_questionarios_pendentes}."
        )

    if (
        total_aptos
        + total_cancelados
        + total_questionarios_pendentes
        + total_reprovados_nota
        != total_inscritos
    ):
        raise RuntimeError("Funil inconsistente: a soma das categorias nao fecha com o total de inscritos.")

    return IndicadoresVaga(
        total_inscritos=total_inscritos,
        total_aptos=total_aptos,
        total_cancelados=total_cancelados,
        total_questionarios_pendentes=total_questionarios_pendentes,
        total_reprovados_nota=total_reprovados_nota,
    )


def resumir_etapas(registros: list[dict[str, Any]]) -> dict[str, int]:
    triados = 0
    reprovados = 0
    outros = 0

    for registro in registros:
        etapa = normalizar_cabecalho(registro.get("etapa"))
        if etapa.startswith("triad"):
            triados += 1
        elif etapa.startswith("reprov"):
            reprovados += 1
        else:
            outros += 1

    return {
        "triados": triados,
        "reprovados_analise": reprovados,
        "pendentes_ou_outros": outros,
    }
