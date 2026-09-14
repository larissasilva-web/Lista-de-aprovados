export const FONTES_SISTEMA = [
  {
    valor: "system",
    rotulo: "Padrão do sistema",
  },
  {
    valor: "arial",
    rotulo: "Arial",
  },
  {
    valor: "verdana",
    rotulo: "Verdana",
  },
  {
    valor: "trebuchet",
    rotulo: "Trebuchet MS",
  },
  {
    valor: "georgia",
    rotulo: "Georgia",
  },
] as const;

export type FonteSistema =
  (typeof FONTES_SISTEMA)[number]["valor"];

export type ConfiguracaoSistema = {
  id: string | null;

  tituloSistema: string;

  corPrimaria: string;

  logoLoginUrl: string | null;

  imagemLoginUrl: string | null;

  logoHeaderUrl: string | null;

  corFundoLogin: string;

  corCardLogin: string;

  corTextoCardLogin: string;

  corSidebar: string;

  corTextoSidebar: string;

  corTextoPrincipal: string;

  fonteSistema: FonteSistema;
};

export const CONFIGURACAO_PADRAO:
  ConfiguracaoSistema = {
  id: null,

  tituloSistema:
    "Lista de Aprovados",

  corPrimaria:
    "#094780",

  logoLoginUrl:
    null,

  imagemLoginUrl:
    null,

  logoHeaderUrl:
    null,

  corFundoLogin:
    "#F1F5F9",

  corCardLogin:
    "#FFFFFF",

  corTextoCardLogin:
    "#0F172A",

  corSidebar:
    "#0F172A",

  corTextoSidebar:
    "#E2E8F0",

  corTextoPrincipal:
    "#0F172A",

  fonteSistema:
    "system",
};

export function obterFonteCss(
  fonte: FonteSistema
) {
  switch (fonte) {
    case "arial":
      return "Arial, Helvetica, sans-serif";

    case "verdana":
      return "Verdana, Geneva, sans-serif";

    case "trebuchet":
      return '"Trebuchet MS", Arial, sans-serif';

    case "georgia":
      return "Georgia, serif";

    default:
      return "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  }
}