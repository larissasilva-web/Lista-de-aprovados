import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type TipoPermissao =
  | "usuario"
  | "contratador"
  | "admin";

export async function obterUsuarioAtual() {
  const supabase = await createClient();

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    redirect("/login");
  }

  const email = String(
    claimsData.claims.email ?? ""
  ).trim();

  if (!email) {
    redirect("/login");
  }

  const { data: permissao, error } = await supabase
    .from("permissoes")
    .select("id, email, nome, tipo_permissao")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Erro ao consultar a permissão do usuário: ${error.message}`
    );
  }

  if (!permissao) {
    throw new Error(
      "Usuário autenticado, mas sem permissão cadastrada."
    );
  }

  return {
    id: permissao.id,
    email: permissao.email,
    nome: permissao.nome,
    tipoPermissao:
      permissao.tipo_permissao as TipoPermissao,
  };
}

export async function exigirPermissao(
  permissoesPermitidas: readonly TipoPermissao[]
) {
  const usuario = await obterUsuarioAtual();

  if (
    !permissoesPermitidas.includes(
      usuario.tipoPermissao
    )
  ) {
    redirect("/lista?erro=sem-permissao");
  }

  return usuario;
}