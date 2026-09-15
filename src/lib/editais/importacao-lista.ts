export const COLUNAS_ESPERADAS = [
  "codigo_vaga",
  "cargo",
  "classificacao",
  "nota",
  "nome",
  "modalidade",
] as const;

export type LinhaImportacao = {
  codigo_vaga: string;
  cargo: string;
  classificacao: string;
  nota: string;
  nome: string;
  modalidade: string;
};

export function limparTexto(valor: unknown): string {
  return String(valor ?? "")
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .trim();
}

export function normalizarCabecalho(texto: string): string {
  let resultado = String(texto ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (
    resultado === "codigo_da_vaga" ||
    resultado === "cod_vaga" ||
    resultado === "cod_da_vaga"
  ) {
    resultado = "codigo_vaga";
  }

  if (resultado === "modalidade_de_candidatura") {
    resultado = "modalidade";
  }

  return resultado;
}

export function validarCabecalhos(cabecalhos: string[]): boolean {
  return (
    cabecalhos.length === COLUNAS_ESPERADAS.length &&
    cabecalhos.every(
      (coluna, indice) => coluna === COLUNAS_ESPERADAS[indice]
    )
  );
}

export function normalizarLinha(
  linha: Record<string, unknown>
): LinhaImportacao {
  return {
    codigo_vaga: limparTexto(linha.codigo_vaga),
    cargo: limparTexto(linha.cargo),
    classificacao: limparTexto(linha.classificacao),
    nota: limparTexto(linha.nota),
    nome: limparTexto(linha.nome),
    modalidade: limparTexto(linha.modalidade),
  };
}

export function validarLinhas(linhas: LinhaImportacao[]): string | null {
  if (linhas.length === 0) {
    return "O arquivo não possui candidatos.";
  }

  for (let indice = 0; indice < linhas.length; indice++) {
    const linha = linhas[indice];
    const numeroLinha = indice + 2;

    if (!linha.codigo_vaga) {
      return `Linha ${numeroLinha}: código da vaga não informado.`;
    }

    if (!linha.cargo) {
      return `Linha ${numeroLinha}: cargo não informado.`;
    }

    if (!linha.classificacao) {
      return `Linha ${numeroLinha}: classificação não informada.`;
    }

    if (!/^[0-9]+$/.test(linha.classificacao) || Number(linha.classificacao) <= 0) {
      return `Linha ${numeroLinha}: classificação inválida.`;
    }

    if (!linha.nota) {
      return `Linha ${numeroLinha}: nota não informada.`;
    }

    const nota = Number(linha.nota.replace(",", "."));

    if (!Number.isFinite(nota) || nota < 0) {
      return `Linha ${numeroLinha}: nota inválida.`;
    }

    if (!linha.nome) {
      return `Linha ${numeroLinha}: nome não informado.`;
    }

    if (!linha.modalidade) {
      return `Linha ${numeroLinha}: modalidade não informada.`;
    }
  }

  return null;
}
