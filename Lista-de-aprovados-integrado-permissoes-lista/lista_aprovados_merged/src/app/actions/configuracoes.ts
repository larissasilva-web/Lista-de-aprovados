"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  exigirPermissao,
} from "@/lib/auth/usuario-atual";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  FONTES_SISTEMA,
  FonteSistema,
} from "@/lib/configuracoes/tema";

type DadosConfiguracao = {
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

type Resultado = {
  sucesso: boolean;
  mensagem: string;
};

function corValida(
  cor: string
) {
  return /^#[0-9A-F]{6}$/.test(
    cor.toUpperCase()
  );
}

export async function salvarConfiguracoes(
  dados: DadosConfiguracao
): Promise<Resultado> {
  const adminAtual =
    await exigirPermissao([
      "admin",
    ]);

  const tituloSistema =
    dados.tituloSistema.trim();

  if (!tituloSistema) {
    return {
      sucesso: false,
      mensagem:
        "Informe o título do sistema.",
    };
  }

  const cores = [
    dados.corPrimaria,
    dados.corFundoLogin,
    dados.corCardLogin,
    dados.corTextoCardLogin,
    dados.corSidebar,
    dados.corTextoSidebar,
    dados.corTextoPrincipal,
  ].map((cor) =>
    cor.toUpperCase()
  );

  if (
    cores.some(
      (cor) =>
        !corValida(cor)
    )
  ) {
    return {
      sucesso: false,
      mensagem:
        "Uma ou mais cores estão em formato inválido.",
    };
  }

  const fonteValida =
    FONTES_SISTEMA.some(
      (fonte) =>
        fonte.valor ===
        dados.fonteSistema
    );

  if (!fonteValida) {
    return {
      sucesso: false,
      mensagem:
        "Fonte inválida.",
    };
  }

  const supabase =
    await createClient();

  const payload = {
    titulo_sistema:
      tituloSistema,

    cor_primaria:
      dados.corPrimaria.toUpperCase(),

    logo_login_url:
      dados.logoLoginUrl,

    imagem_login_url:
      dados.imagemLoginUrl,

    logo_header_url:
      dados.logoHeaderUrl,

    cor_fundo_login:
      dados.corFundoLogin.toUpperCase(),

    cor_card_login:
      dados.corCardLogin.toUpperCase(),

    cor_texto_card_login:
      dados.corTextoCardLogin.toUpperCase(),

    cor_sidebar:
      dados.corSidebar.toUpperCase(),

    cor_texto_sidebar:
      dados.corTextoSidebar.toUpperCase(),

    cor_texto_principal:
      dados.corTextoPrincipal.toUpperCase(),

    fonte_sistema:
      dados.fonteSistema,
  };

  const {
    data: existente,
    error: erroConsulta,
  } = await supabase
    .from("configuracoes")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (erroConsulta) {
    return {
      sucesso: false,
      mensagem:
        `Erro ao consultar configurações: ${erroConsulta.message}`,
    };
  }

  let erroSalvar;

  if (existente) {
    const { error } =
      await supabase
        .from("configuracoes")
        .update(payload)
        .eq(
          "id",
          existente.id
        );

    erroSalvar =
      error;
  } else {
    const { error } =
      await supabase
        .from("configuracoes")
        .insert(payload);

    erroSalvar =
      error;
  }

  if (erroSalvar) {
    return {
      sucesso: false,
      mensagem:
        `Não foi possível salvar: ${erroSalvar.message}`,
    };
  }

  const {
    error: erroLog,
  } = await supabase
    .from("logs")
    .insert({
      usuario_alterou:
        adminAtual.email,

      alteracoes: {
        acao:
          "ATUALIZACAO_CONFIGURACOES",

        titulo_sistema:
          tituloSistema,

        fonte_sistema:
          dados.fonteSistema,

        cor_primaria:
          dados.corPrimaria,

        cor_sidebar:
          dados.corSidebar,
      },
    });

  if (erroLog) {
    console.error(
      "Configuração salva, mas o log falhou:",
      erroLog
    );
  }

  revalidatePath(
    "/configuracoes"
  );

  revalidatePath(
    "/login"
  );

  revalidatePath(
    "/",
    "layout"
  );

  return {
    sucesso: true,
    mensagem:
      "Configurações salvas com sucesso.",
  };
}