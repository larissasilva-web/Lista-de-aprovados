"use server";

import { revalidatePath } from "next/cache";

import { exigirPermissao } from "@/lib/auth/usuario-atual";
import { createClient } from "@/lib/supabase/server";

type DadosConfiguracao = {
  id: string | null;
  tituloSistema: string;
  corPrimaria: string;
  logoUrl: string | null;
};

type Resultado = {
  sucesso: boolean;
  mensagem: string;
};

export async function salvarConfiguracoes(
  dados: DadosConfiguracao
): Promise<Resultado> {
  const adminAtual =
    await exigirPermissao(["admin"]);

  const tituloSistema =
    dados.tituloSistema.trim();

  const corPrimaria =
    dados.corPrimaria
      .trim()
      .toUpperCase();

  const logoUrl =
    dados.logoUrl?.trim() || null;

  // ----------------------------------------------------------
  // Validações
  // ----------------------------------------------------------

  if (!tituloSistema) {
    return {
      sucesso: false,
      mensagem:
        "Informe o título do sistema.",
    };
  }

  if (
    tituloSistema.length > 100
  ) {
    return {
      sucesso: false,
      mensagem:
        "O título do sistema pode possuir no máximo 100 caracteres.",
    };
  }

  const corValida =
    /^#[0-9A-F]{6}$/.test(
      corPrimaria
    );

  if (!corValida) {
    return {
      sucesso: false,
      mensagem:
        "Informe uma cor hexadecimal válida. Exemplo: #094780.",
    };
  }

  const supabase =
    await createClient();

  // ----------------------------------------------------------
  // Atualizar ou criar configuração
  // ----------------------------------------------------------

  let erroConfiguracao;

  if (dados.id) {
    const { error } =
      await supabase
        .from("configuracoes")
        .update({
          titulo_sistema:
            tituloSistema,

          cor_primaria:
            corPrimaria,

          logo_url:
            logoUrl,
        })
        .eq(
          "id",
          dados.id
        );

    erroConfiguracao =
      error;
  } else {
    const { error } =
      await supabase
        .from("configuracoes")
        .insert({
          titulo_sistema:
            tituloSistema,

          cor_primaria:
            corPrimaria,

          logo_url:
            logoUrl,
        });

    erroConfiguracao =
      error;
  }

  if (erroConfiguracao) {
    return {
      sucesso: false,
      mensagem:
        `Não foi possível salvar as configurações: ${erroConfiguracao.message}`,
    };
  }

  // ----------------------------------------------------------
  // Registrar log
  // ----------------------------------------------------------

  const { error: erroLog } =
    await supabase
      .from("logs")
      .insert({
        usuario_alterou:
          adminAtual.email,

        alteracoes: {
          acao:
            "ATUALIZACAO_CONFIGURACOES",

          titulo_sistema:
            tituloSistema,

          cor_primaria:
            corPrimaria,

          logo_url:
            logoUrl,
        },
      });

  if (erroLog) {
    console.error(
      "Configuração salva, mas houve erro ao registrar o log:",
      erroLog
    );
  }

  revalidatePath(
    "/configuracoes"
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