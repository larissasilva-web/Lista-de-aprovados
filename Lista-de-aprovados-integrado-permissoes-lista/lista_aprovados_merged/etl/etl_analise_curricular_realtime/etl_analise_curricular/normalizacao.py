from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any


def limpar_texto(valor: Any) -> str:
    if valor is None:
        return ""
    texto = str(valor).strip()
    if len(texto) >= 2 and texto[0] == texto[-1] and texto[0] in {'"', "'"}:
        texto = texto[1:-1].strip()
    return texto


def sem_acentos(texto: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", texto) if unicodedata.category(c) != "Mn"
    )


def normalizar_cabecalho(valor: Any) -> str:
    texto = limpar_texto(valor).replace("_", " ").lower()
    texto = sem_acentos(texto)
    texto = re.sub(r"[^\w\s]", " ", texto, flags=re.UNICODE)
    return re.sub(r"\s+", " ", texto).strip()


def normalizar_booleano_texto(valor: Any) -> str:
    return normalizar_cabecalho(valor)


def _decimal_ptbr(valor: Any) -> Decimal | None:
    texto = limpar_texto(valor).replace(" ", "")
    if not texto:
        return None

    if re.fullmatch(r"\d{1,2}/\d{1,2}/\d{4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?", texto):
        dia, mes, *_ = re.split(r"[/\s:]", texto)
        texto = f"{int(dia)}.{int(mes)}"
    elif "," in texto:
        texto = texto.replace(".", "").replace(",", ".")

    try:
        return Decimal(texto)
    except InvalidOperation:
        return None


def normalizar_score(valor: Any) -> Decimal | None:
    return _decimal_ptbr(valor)


def normalizar_inteiro(valor: Any) -> int | None:
    texto = limpar_texto(valor)
    if not texto:
        return None
    texto = texto.replace(",", ".")
    try:
        return int(float(texto))
    except ValueError:
        return None


def parse_data(valor: Any) -> date | None:
    if valor is None or valor == "":
        return None
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor

    texto = limpar_texto(valor)
    if not texto:
        return None

    for formato in ("%d/%m/%Y", "%Y-%m-%d", "%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M"):
        try:
            return datetime.strptime(texto, formato).date()
        except ValueError:
            pass

    if re.fullmatch(r"\d+(?:\.0+)?", texto):
        numero = float(texto)
        if 20000 <= numero <= 80000:
            return date(1899, 12, 30) + timedelta(days=int(numero))

    return None


def calcular_idade(data_nascimento: date | None) -> int | None:
    if not data_nascimento:
        return None
    hoje = date.today()
    idade = hoje.year - data_nascimento.year - (
        (hoje.month, hoje.day) < (data_nascimento.month, data_nascimento.day)
    )
    return idade if 0 <= idade <= 120 else None


def calcular_total_dias(anos: Any, meses: Any, dias: Any) -> int | None:
    a = normalizar_inteiro(anos)
    m = normalizar_inteiro(meses)
    d = normalizar_inteiro(dias)
    if a is None and m is None and d is None:
        return None
    return (a or 0) * 365 + (m or 0) * 30 + (d or 0)


def normalizar_modalidade(valor: Any) -> str | None:
    raw = "" if valor is None else str(valor).strip()
    if not raw:
        return None

    mapa = {
        "ampla concorrencia": "Ampla concorrência",
        "indigenas": "Indígenas",
        "indigena": "Indígenas",
        "pretos e pardos": "Pretos e pardos",
        "preto e pardo": "Pretos e pardos",
        "pessoas com deficiencia pcd": "Pessoas com deficiência (PCD)",
        "pessoa com deficiencia pcd": "Pessoas com deficiência (PCD)",
        "pcd": "Pessoas com deficiência (PCD)",
        "ppiq": "PPIQ",
        "ppq": "PPQ",
    }

    # Algumas planilhas trazem mais de uma modalidade, por exemplo:
    # "Ampla concorrência", "Indígenas". Preservamos todas, sem aspas literais.
    partes = [p.strip().strip('\"\'').strip() for p in re.split(r"\s*,\s*", raw) if p.strip()]
    saida: list[str] = []
    for parte in partes:
        chave = normalizar_booleano_texto(parte)
        valor_norm = mapa.get(chave, parte)
        if valor_norm and valor_norm not in saida:
            saida.append(valor_norm)

    return ", ".join(saida) or None


def tem_analise_suficiente(analise: Any) -> bool:
    raw = limpar_texto(analise)
    chave = normalizar_cabecalho(raw)
    if not chave:
        return False
    placeholders = {
        "-", "--", ".", "na", "n a", "n d", "ok", "sim", "nao",
        "sem analise", "sem observacao", "nao se aplica", "nada consta",
    }
    if chave in placeholders or raw in placeholders:
        return False
    return len(chave) >= 8


def derivar_status_consolidado(etapa: Any, analise: Any) -> str:
    etapa_n = normalizar_cabecalho(etapa)
    tem_analise = tem_analise_suficiente(analise)

    if not etapa_n:
        return "Revisar" if tem_analise else "Pendente"

    reprovada = any(
        termo in etapa_n
        for termo in (
            "reprovado", "reprovada", "inabilitado", "inabilitada", "eliminado",
            "eliminada", "indeferido", "indeferida", "nao habilitado", "nao habilitada",
        )
    )
    triada = any(termo in etapa_n for termo in ("triado", "triados", "triada", "triadas"))
    aprovada = any(
        termo in etapa_n
        for termo in (
            "aprovado", "aprovada", "habilitado", "habilitada", "classificado",
            "classificada", "deferido", "deferida",
        )
    ) or etapa_n in {"apto", "apta"}

    if reprovada:
        return "Reprovado" if tem_analise else "Revisar"
    if triada or aprovada:
        return "Aprovado" if tem_analise else "Revisar"
    return "Revisar"


def extrair_pontuacao_por_rotulos(texto: Any, rotulos: list[str]) -> Decimal | None:
    raw = limpar_texto(texto)
    if not raw:
        return None

    for rotulo in rotulos:
        padrao_ponto = re.compile(
            rotulo + r"[\s\S]{0,220}?(?:pontua[cç][aã]o\s*(?:de)?\s*[:\-]?\s*)?(-?\d+(?:[\.,]\d+)?)\s*ponto",
            re.I,
        )
        achado = padrao_ponto.search(raw)
        if achado:
            return normalizar_score(achado.group(1))

        padrao_direto = re.compile(rotulo + r"\s*[:\-]\s*(-?\d+(?:[\.,]\d+)?)", re.I)
        achado = padrao_direto.search(raw)
        if achado:
            return normalizar_score(achado.group(1))

    return None


def extrair_pontuacoes_analise(analise: Any) -> dict[str, Decimal | None]:
    return {
        "escolaridade": extrair_pontuacao_por_rotulos(
            analise,
            [r"Escolaridade", r"Especializa[cç][aã]o", r"Nota Especializa[cç][aã]o", r"Titula[cç][aã]o Acad[eê]mica", r"Titula[cç][aã]o"],
        ),
        "cursos": extrair_pontuacao_por_rotulos(
            analise,
            [r"Cursos de Aperfei[cç]oamento", r"Nota Cursos", r"Cursos"],
        ),
        "experiencia": extrair_pontuacao_por_rotulos(
            analise,
            [r"Experi[eê]ncia Profissional", r"Nota Experi[eê]ncia", r"Experi[eê]ncia"],
        ),
        "criterio_etnico": extrair_pontuacao_por_rotulos(
            analise,
            [r"Crit[eé]rio [EÉeé]tnico", r"[EÉeé]tnico", r"Ind[ií]gena residente em aldeia"],
        ),
        "experiencia_total_desempate": extrair_pontuacao_por_rotulos(
            analise,
            [r"Crit[eé]rio de Desempate", r"Crit[eé]rio Desempate", r"Maior tempo de experi[eê]ncia profissional"],
        ),
    }


ALIASES: dict[str, list[str]] = {
    "candidato": ["nome", "candidato"],
    "id": ["codigo", "código", "id"],
    "idade": ["idade"],
    "data_nascimento": ["data de nascimento", "data nascimento", "nascimento"],
    "nota_empregare": ["nota empregare", "nota empregare final", "nota"],
    "modalidade_concorrencia": [
        "modalidade_concorrencia", "modalidade concorrencia", "modalidade concorrência",
        "modalidade de concorrencia", "modalidade de concorrência", "categoria de concorrencia",
        "categoria de concorrência", "etnia",
    ],
    "nota_final_ajustada": ["nota final ajustada", "nota final", "pontuacao final", "pontuação final"],
    "somatorio": ["somatorio", "somatório"],
    "pontuacao_escolaridade": [
        "pontuacao_escolaridade", "pontuacao escolaridade", "pontuação escolaridade",
        "nota especializacao", "nota especialização", "nota de especializacao", "nota de especialização",
        "titulacao academica", "titulação acadêmica", "titulacao", "titulação", "especializacao",
        "especialização", "mestrado", "doutorado", "escolaridade pergunta 15",
        "escolaridade pontuacao pergunta 15", "escolaridade pontuação pergunta 15",
        "escolaridade pontuacao pergunta 6", "escolaridade pontuação pergunta 6",
        "escolaridade pontuacao", "escolaridade pontuação", "escolaridade - pontuacao",
        "escolaridade - pontuação",
    ],
    "pontuacao_cursos_aperfeicoamento": [
        "pontuacao_cursos_aperfeicoamento", "pontuacao cursos aperfeicoamento",
        "pontuação cursos aperfeiçoamento", "pontuacao cursos de aperfeicoamento",
        "pontuação cursos de aperfeiçoamento", "nota cursos", "nota de cursos",
        "cursos de aperfeicoamento", "cursos de aperfeiçoamento", "cursos relacionados",
        "aperfeicoamento", "aperfeiçoamento", "nota cursos pergunta 17",
        "nota cursos pontuacao pergunta 17", "nota cursos pontuação pergunta 17",
        "cursos de aperfeicoamento pontuacao pergunta 8", "cursos de aperfeiçoamento pontuação pergunta 8",
        "cursos de aperfeicoamento pontuacao", "cursos de aperfeiçoamento pontuação",
        "cursos de aperfeicoamento - pontuacao", "cursos de aperfeiçoamento - pontuação",
    ],
    "pontuacao_experiencia_profissional": [
        "pontuacao_experiencia_profissional", "pontuacao experiencia profissional",
        "pontuação experiência profissional", "nota experiencia", "nota experiência",
        "nota de experiencia", "nota de experiência", "experiencia pergunta 9", "experiência pergunta 9",
        "experiencia pontuacao pergunta 9", "experiência pontuação pergunta 9",
        "experiencia profissional pontuacao pergunta 10", "experiência profissional pontuação pergunta 10",
        "experiencia profissional pontuacao", "experiência profissional pontuação",
        "experiencia profissional - pontuacao", "experiência profissional - pontuação",
        "experiencia profissional", "experiência profissional", "experiencia na area",
        "experiência na área", "experiencia no sus", "experiência no sus",
    ],
    "pontuacao_criterio_etnico": [
        "pontuacao_criterio_etnico", "pontuacao criterio etnico", "pontuação critério étnico",
        "criterio etnico pontuacao", "critério étnico pontuação", "indigena pergunta 5",
        "indígena pergunta 5", "indigena pontuacao pergunta 5", "indígena pontuação pergunta 5",
        "criterio etnico - pontuacao", "critério étnico - pontuação",
        "e indigena e mora em aldeia pontuacao pergunta 16",
        "é indígena e mora em aldeia pontuação pergunta 16", "indigena mora aldeia pontuacao",
        "indígena mora aldeia pontuação", "e indigena e mora em aldeia - pontuacao",
        "é indígena e mora em aldeia - pontuação",
    ],
    "experiencia_profissional_anos": [
        "experiencia anos", "experiência anos", "experiencia (anos)", "experiência (anos)",
        "experiencia ano", "experiência ano", "experiencia profissional anos",
        "experiência profissional anos", "experiencia profissional (anos)", "experiência profissional (anos)",
    ],
    "experiencia_profissional_meses": [
        "experiencia meses", "experiência meses", "experiencia (meses)", "experiência (meses)",
        "experiencia mes", "experiência mês", "experiencia profissional meses",
        "experiência profissional meses", "experiencia profissional (meses)", "experiência profissional (meses)",
    ],
    "experiencia_profissional_dias": [
        "experiencia dias", "experiência dias", "experiencia (dias)", "experiência (dias)",
        "experiencia dia", "experiência dia", "experiencia profissional dias",
        "experiência profissional dias", "experiencia profissional (dias)", "experiência profissional (dias)",
    ],
    "experiencia_profissional_total": [
        "experiencia total", "experiência total", "experiencia profissional total",
        "experiência profissional total", "total experiencia profissional", "total experiência profissional",
        "criterio desempate", "critério desempate", "criterio de desempate", "critério de desempate",
        "maior tempo de experiencia profissional", "maior tempo de experiência profissional",
        "tempo de experiencia profissional", "tempo de experiência profissional",
    ],
    "experiencia_saude_indigena_anos": [
        "experiencia na saude indigena anos", "experiência na saúde indígena anos",
        "experiencia na saude indigena (anos)", "experiência na saúde indígena (anos)",
    ],
    "experiencia_saude_indigena_meses": [
        "experiencia na saude indigena meses", "experiência na saúde indígena meses",
        "experiencia na saude indigena (meses)", "experiência na saúde indígena (meses)",
    ],
    "experiencia_saude_indigena_dias": [
        "experiencia na saude indigena dias", "experiência na saúde indígena dias",
        "experiencia na saude indigena (dias)", "experiência na saúde indígena (dias)",
    ],
    "experiencia_saude_indigena_total": [
        "experiencia total na saude indigena", "experiência total na saúde indígena",
        "experiencia total saude indigena", "experiência total saúde indígena",
    ],
    "experiencia_atencao_basica_anos": [
        "experiencia na atencao basica anos", "experiência na atenção básica anos",
        "experiencia na atencao basica (anos)", "experiência na atenção básica (anos)",
    ],
    "experiencia_atencao_basica_meses": [
        "experiencia na atencao basica meses", "experiência na atenção básica meses",
        "experiencia na atencao basica (meses)", "experiência na atenção básica (meses)",
    ],
    "experiencia_atencao_basica_dias": [
        "experiencia na atencao basica dias", "experiência na atenção básica dias",
        "experiencia na atencao basica (dias)", "experiência na atenção básica (dias)",
    ],
    "experiencia_atencao_basica_total": [
        "experiencia total na atencao basica", "experiência total na atenção básica",
        "experiencia total atencao basica", "experiência total atenção básica",
    ],
    "etapa": ["etapa"],
    "data_analise": ["data da analise", "data da análise", "data analise", "data análise"],
    "analise": ["analise", "análise"],
    "pcd": ["pcd"],
    "responsavel_analise": [
        "responsavel pela analise", "responsável pela análise", "responsavel analise",
        "responsável análise", "responsavel da analise", "responsável da análise", "responsavel",
    ],
    "coord_demandante": ["coord demandante", "coordenacao demandante", "coordenação demandante"],
    "email_demandante": ["email demandante", "e mail demandante"],
}
