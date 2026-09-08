import {
  redirect,
} from "next/navigation";

import {
  SistemaShell,
} from "@/components/sistema/sistema-shell";

import {
  exigirPermissao,
} from "@/lib/auth/usuario-atual";

import {
  obterConfiguracoesSistema,
} from "@/lib/configuracoes/obter-configuracoes";

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
  ] =
    await Promise.all([
      obterConfiguracoesSistema(),

      supabase
        .from(
          "permissoes"
        )
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
    <SistemaShell
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
    >
      {children}
    </SistemaShell>
  );
}