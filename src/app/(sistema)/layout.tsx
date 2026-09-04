import {
  redirect,
} from "next/navigation";

import {
  NavegacaoSistema,
} from "@/components/sistema/navegacao-sistema";

import {
  exigirPermissao,
} from "@/lib/auth/usuario-atual";

import {
  obterConfiguracoesSistema,
} from "@/lib/configuracoes/obter-configuracoes";

import {
  obterFonteCss,
} from "@/lib/configuracoes/tema";

import {
  createClient,
} from "@/lib/supabase/server";

export default async function SistemaLayout({
  children,
}: Readonly<{
  children:
    React.ReactNode;
}>) {
  const usuarioAutenticado =
    await exigirPermissao([
      "usuario",
      "contratador",
      "admin",
    ]);

  const supabase =
    await createClient();

  const [
    configuracao,
    resultadoPermissao,
  ] = await Promise.all([
    obterConfiguracoesSistema(),

    supabase
      .from("permissoes")
      .select(`
        nome,
        email,
        tipo_permissao
      `)
      .ilike(
        "email",
        usuarioAutenticado.email
      )
      .maybeSingle(),
  ]);

  const permissao =
    resultadoPermissao.data;

  if (!permissao) {
    redirect(
      "/login?erro=sem-permissao"
    );
  }

  const tipoPermissao =
    permissao.tipo_permissao as
      | "usuario"
      | "contratador"
      | "admin";

  return (
    <div
      className="min-h-screen bg-slate-50"
      style={{
        color:
          configuracao.corTextoPrincipal,

        fontFamily:
          obterFonteCss(
            configuracao.fonteSistema
          ),
      }}
    >
      {/* HEADER */}

      <header className="flex h-16 items-center border-b border-slate-200 bg-white px-5 lg:px-7">
        <div className="flex items-center gap-3">
          {configuracao.logoHeaderUrl ? (
            <img
              src={
                configuracao.logoHeaderUrl
              }
              alt="Logo"
              className="h-10 max-w-40 object-contain"
            />
          ) : (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{
                backgroundColor:
                  configuracao.corPrimaria,
              }}
            >
              LA
            </div>
          )}

          <h1 className="text-lg font-semibold">
            {
              configuracao.tituloSistema
            }
          </h1>
        </div>
      </header>

      <div className="lg:flex">
        <NavegacaoSistema
          usuario={{
            nome:
              permissao.nome,

            email:
              permissao.email,

            tipoPermissao,
          }}
          configuracao={
            configuracao
          }
        />

        <main className="min-w-0 flex-1 p-5 lg:p-7">
          {children}
        </main>
      </div>
    </div>
  );
}