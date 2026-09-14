import { redirect } from "next/navigation";

import {
  ContextoAcesso,
  limitarModulosAoPerfil,
  ModuloSistema,
  rotaInicialPorModulos,
  TipoPermissao,
} from "@/lib/acesso/modulos";
import { createClient } from "@/lib/supabase/server";

export type { TipoPermissao } from "@/lib/acesso/modulos";

export async function obterUsuarioAtual(): Promise<ContextoAcesso> {
  const supabase = await createClient();

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    redirect("/login");
  }

  const email = String(claimsData.claims.email ?? "")
    .trim()
    .toLowerCase();

  if (!email) {
    redirect("/login");
  }

  const { data: permissao, error } = await supabase
    .from("permissoes")
    .select(`
      id,
      auth_user_id,
      email,
      nome,
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

  if (error) {
    throw new Error(
      `Erro ao consultar a permissão do usuário: ${error.message}`
    );
  }

  if (!permissao || permissao.ativo === false) {
    redirect("/login?erro=sem-permissao");
  }

  const tipoPermissao = permissao.tipo_permissao as TipoPermissao;

  const modulos = limitarModulosAoPerfil(tipoPermissao, {
    lista: Boolean(permissao.acesso_lista),
    dashboards: Boolean(permissao.acesso_dashboards),
    editais: Boolean(permissao.acesso_editais),
    permissoes: Boolean(permissao.acesso_permissoes),
    configuracoes: Boolean(permissao.acesso_configuracoes),
  });

  return {
    id: permissao.id,
    auth_user_id: permissao.auth_user_id,
    email: permissao.email,
    nome: permissao.nome,
    tipo_permissao: tipoPermissao,
    ativo: true,
    modulos,
  };
}

export async function exigirPermissao(
  permissoesPermitidas: readonly TipoPermissao[]
) {
  const usuario = await obterUsuarioAtual();

  if (!permissoesPermitidas.includes(usuario.tipo_permissao)) {
    const rota = rotaInicialPorModulos(usuario.modulos);
    redirect(rota ?? "/login?erro=sem-permissao");
  }

  return {
    ...usuario,
    tipoPermissao: usuario.tipo_permissao,
  };
}

export async function exigirModulo(
  modulo: ModuloSistema,
  permissoesPermitidas?: readonly TipoPermissao[]
) {
  const usuario = await obterUsuarioAtual();

  const perfilPermitido =
    !permissoesPermitidas ||
    permissoesPermitidas.includes(usuario.tipo_permissao);

  if (!perfilPermitido || !usuario.modulos[modulo]) {
    const rota = rotaInicialPorModulos(usuario.modulos);

    if (rota && rota !== rotaDoModulo(modulo)) {
      redirect(`${rota}?erro=sem-permissao`);
    }

    redirect("/login?erro=sem-permissao");
  }

  return {
    ...usuario,
    tipoPermissao: usuario.tipo_permissao,
  };
}

function rotaDoModulo(modulo: ModuloSistema) {
  switch (modulo) {
    case "lista":
      return "/lista";
    case "dashboards":
      return "/dashboards/saude-indigena";
    case "editais":
      return "/editais";
    case "permissoes":
      return "/permissoes";
    case "configuracoes":
      return "/configuracoes";
  }
}
