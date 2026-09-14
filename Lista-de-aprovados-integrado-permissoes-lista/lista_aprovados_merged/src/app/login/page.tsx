"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  createClient,
} from "@/lib/supabase/client";

import {
  CONFIGURACAO_PADRAO,
  ConfiguracaoSistema,
  obterFonteCss,
} from "@/lib/configuracoes/tema";

export default function LoginPage() {
  const [
    configuracao,
    setConfiguracao,
  ] =
    useState<ConfiguracaoSistema>(
      CONFIGURACAO_PADRAO
    );

  const [
    carregando,
    setCarregando,
  ] = useState(false);

  const [
    erro,
    setErro,
  ] = useState("");

  useEffect(() => {
    async function carregar() {
      const supabase =
        createClient();

      const {
        data,
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

      if (data) {
        setConfiguracao({
          id:
            data.id,

          tituloSistema:
            data.titulo_sistema ??
            CONFIGURACAO_PADRAO.tituloSistema,

          corPrimaria:
            data.cor_primaria ??
            CONFIGURACAO_PADRAO.corPrimaria,

          logoLoginUrl:
            data.logo_login_url,

          imagemLoginUrl:
            data.imagem_login_url,

          logoHeaderUrl:
            data.logo_header_url,

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
            data.fonte_sistema ??
            "system",
        });
      }

      const parametros =
        new URLSearchParams(
          window.location.search
        );

      const codigoErro =
        parametros.get("erro");

      if (
        codigoErro ===
        "sem-permissao"
      ) {
        setErro(
          "Sua conta Google não possui permissão para acessar este sistema."
        );
      }

      if (
        codigoErro ===
        "oauth"
      ) {
        setErro(
          "Não foi possível concluir a autenticação com o Google."
        );
      }
    }

    carregar();
  }, []);

  async function entrarComGoogle() {
    setErro("");
    setCarregando(true);

    const supabase =
      createClient();

    const {
      error,
    } =
      await supabase.auth
        .signInWithOAuth({
          provider:
            "google",

          options: {
            redirectTo:
              `${window.location.origin}/auth/callback`,

            queryParams: {
              prompt:
                "select_account",
            },
          },
        });

    if (error) {
      setErro(
        error.message
      );

      setCarregando(false);
    }
  }

  return (
    <main
      className="min-h-screen lg:grid lg:grid-cols-[1.15fr_0.85fr]"
      style={{
        fontFamily:
          obterFonteCss(
            configuracao.fonteSistema
          ),

        backgroundColor:
          configuracao.corFundoLogin,
      }}
    >
      {/* IMAGEM */}

      <section
        className="hidden min-h-screen bg-cover bg-center lg:block"
        style={{
          backgroundColor:
            configuracao.corFundoLogin,

          backgroundImage:
            configuracao.imagemLoginUrl
              ? `url("${configuracao.imagemLoginUrl}")`
              : undefined,
        }}
      />

      {/* LOGIN */}

      <section
        className="flex min-h-screen items-center justify-center px-5 py-10"
        style={{
          backgroundColor:
            configuracao.corFundoLogin,
        }}
      >
        <div
          className="w-full max-w-md rounded-2xl border border-black/10 p-8 shadow-lg"
          style={{
            backgroundColor:
              configuracao.corCardLogin,

            color:
              configuracao.corTextoCardLogin,
          }}
        >
          <div className="text-center">
            {configuracao.logoLoginUrl ? (
              <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-black/10">
                <img
                  src={
                    configuracao.logoLoginUrl
                  }
                  alt="Logo"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div
                className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-xl text-xl font-bold text-white"
                style={{
                  backgroundColor:
                    configuracao.corPrimaria,
                }}
              >
                LA
              </div>
            )}

            <h1 className="text-2xl font-semibold">
              {
                configuracao.tituloSistema
              }
            </h1>

            <p className="mt-2 text-sm opacity-70">
              Acesse utilizando sua conta Google.
            </p>
          </div>

          {erro && (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {erro}
            </div>
          )}

          <button
            type="button"
            onClick={
              entrarComGoogle
            }
            disabled={
              carregando
            }
            className="mt-7 flex w-full items-center justify-center gap-3 rounded-lg px-4 py-3 font-medium text-white transition disabled:opacity-60"
            style={{
              backgroundColor:
                configuracao.corPrimaria,
            }}
          >
            <span className="rounded bg-white px-1.5 py-0.5 font-bold text-[#4285F4]">
              G
            </span>

            {carregando
              ? "Redirecionando..."
              : "Entrar com Google"}
          </button>

          <p className="mt-6 text-center text-xs opacity-60">
            Acesso permitido somente para usuários cadastrados.
          </p>
        </div>
      </section>
    </main>
  );
}