export const UNIDADES_SAUDE_INDIGENA = [
  "CASAI DF",
  "CASAI SP",
  "DSEI Alagoas e Sergipe",
  "DSEI Altamira",
  "DSEI Alto Rio Juruá",
  "DSEI Alto Rio Negro",
  "DSEI Alto Rio Purus",
  "DSEI Alto Rio Solimões",
  "DSEI Amapá e Norte do Pará",
  "DSEI Araguaia",
  "DSEI Bahia",
  "DSEI Ceará",
  "DSEI Cuiabá",
  "DSEI Guamá-Tocantins",
  "DSEI Interior Sul",
  "DSEI Kaiapó do Mato Grosso",
  "DSEI Kaiapó do Pará",
  "DSEI Leste de Roraima",
  "DSEI Litoral Sul",
  "DSEI Manaus",
  "DSEI Maranhão",
  "DSEI Mato Grosso do Sul",
  "DSEI Médio Rio Purus",
  "DSEI Médio Rio Solimões e Afluentes",
  "DSEI Minas Gerais e Espírito Santo",
  "DSEI Parintins",
  "DSEI Pernambuco",
  "DSEI Porto Velho",
  "DSEI Potiguara",
  "DSEI Rio Tapajós",
  "DSEI Tocantins",
  "DSEI Vale do Javari",
  "DSEI Vilhena",
  "DSEI Xavante",
  "DSEI Xingu",
  "DSEI Yanomami",
  "Emergência Yanomami (PEY)",
] as const;

function chaveUnidade(
  valor: string
) {
  return valor
    .trim()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .toLocaleLowerCase(
      "pt-BR"
    )
    .replace(
      /\s+/g,
      " "
    );
}

export function obterUnidadeCanonica(
  valor: string
) {
  const chave =
    chaveUnidade(valor);

  return (
    UNIDADES_SAUDE_INDIGENA.find(
      (item) =>
        chaveUnidade(item) ===
        chave
    ) ?? valor.trim()
  );
}

export function unidadeSaudeIndigenaValida(
  valor: string
) {
  const chave =
    chaveUnidade(valor);

  return UNIDADES_SAUDE_INDIGENA.some(
    (item) =>
      chaveUnidade(item) ===
      chave
  );
}