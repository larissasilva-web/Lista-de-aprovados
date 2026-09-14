import { NextResponse } from "next/server";

import {
  limitarModulosAoPerfil,
  rotaInicialPorModulos,
  TipoPermissao,
} from "@/lib/acesso/modulos";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const origin = url.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?erro=oauth`);
  }

  const supabase = await createClient();

  const { error: erroSessao } =
    await supabase.auth.exchangeCodeForSession(code);

  if (erroSessao) {
    return NextResponse.redirect(`${origin}/login?erro=oauth`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email?.trim().toLowerCase();

  if (!email) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?erro=sem-email`);
  }

  const { data: permissao, error: erroPermissao } = await supabase
    .from("permissoes")
    .select(`
      id,
      email,
      tipo_permissao,
      ativo,
      acesso_lista,
      acesso_dashboards,
      acesso_editais,
      acesso_permissoes,
      acesso_configuracoes
    `)
    .ilike("email", email)
    .maybeSingle();

  if (erroPermissao || !permissao || permissao.ativo === false) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?erro=sem-permissao`);
  }

  const tipo = permissao.tipo_permissao as TipoPermissao;
  const modulos = limitarModulosAoPerfil(tipo, {
    lista: Boolean(permissao.acesso_lista),
    dashboards: Boolean(permissao.acesso_dashboards),
    editais: Boolean(permissao.acesso_editais),
    permissoes: Boolean(permissao.acesso_permissoes),
    configuracoes: Boolean(permissao.acesso_configuracoes),
  });

  const rotaInicial = rotaInicialPorModulos(modulos);

  if (!rotaInicial) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?erro=sem-permissao`);
  }

  return NextResponse.redirect(`${origin}${rotaInicial}`);
}
