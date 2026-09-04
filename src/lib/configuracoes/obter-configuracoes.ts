import "server-only";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  CONFIGURACAO_PADRAO,
  ConfiguracaoSistema,
  FonteSistema,
} from "@/lib/configuracoes/tema";

export async function obterConfiguracoesSistema():
  Promise<ConfiguracaoSistema> {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("configuracoes")
    .select(`
      id,
      titulo_sistema,
      cor_primaria,
      logo_login_url,
      imagem_login_url,
      logo_header_url,
      cor_fundo_login,
      cor_card_login,
      cor_texto_card_login,
      cor_sidebar,
      cor_texto_sidebar,
      cor_texto_principal,
      fonte_sistema
    `)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "Erro ao carregar configurações:",
      error
    );

    return CONFIGURACAO_PADRAO;
  }

  if (!data) {
    return CONFIGURACAO_PADRAO;
  }

  return {
    id:
      data.id,

    tituloSistema:
      data.titulo_sistema ??
      CONFIGURACAO_PADRAO.tituloSistema,

    corPrimaria:
      data.cor_primaria ??
      CONFIGURACAO_PADRAO.corPrimaria,

    logoLoginUrl:
      data.logo_login_url ??
      null,

    imagemLoginUrl:
      data.imagem_login_url ??
      null,

    logoHeaderUrl:
      data.logo_header_url ??
      null,

    corFundoLogin:
      data.cor_fundo_login ??
      CONFIGURACAO_PADRAO.corFundoLogin,

    corCardLogin:
      data.cor_card_login ??
      CONFIGURACAO_PADRAO.corCardLogin,

    corTextoCardLogin:
      data.cor_texto_card_login ??
      CONFIGURACAO_PADRAO.corTextoCardLogin,

    corSidebar:
      data.cor_sidebar ??
      CONFIGURACAO_PADRAO.corSidebar,

    corTextoSidebar:
      data.cor_texto_sidebar ??
      CONFIGURACAO_PADRAO.corTextoSidebar,

    corTextoPrincipal:
      data.cor_texto_principal ??
      CONFIGURACAO_PADRAO.corTextoPrincipal,

    fonteSistema:
      (
        data.fonte_sistema ??
        CONFIGURACAO_PADRAO.fonteSistema
      ) as FonteSistema,
  };
}