import {
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

export async function GET(
  request: Request
) {
  const url =
    new URL(request.url);

  const code =
    url.searchParams.get(
      "code"
    );

  const origin =
    url.origin;

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?erro=oauth`
    );
  }

  const supabase =
    await createClient();

  // ----------------------------------------------------------
  // Troca o código recebido do Google por uma sessão Supabase
  // ----------------------------------------------------------

  const {
    error:
      erroSessao,
  } =
    await supabase.auth
      .exchangeCodeForSession(
        code
      );

  if (erroSessao) {
    return NextResponse.redirect(
      `${origin}/login?erro=oauth`
    );
  }

  // ----------------------------------------------------------
  // Descobrir quem entrou
  // ----------------------------------------------------------

  const {
    data: {
      user,
    },
  } =
    await supabase.auth
      .getUser();

  const email =
    user?.email
      ?.trim()
      .toLowerCase();

  if (!email) {
    await supabase.auth
      .signOut();

    return NextResponse.redirect(
      `${origin}/login?erro=sem-email`
    );
  }

  // ----------------------------------------------------------
  // Verificar se esse e-mail está autorizado no sistema
  // ----------------------------------------------------------

  const {
    data:
      permissao,
    error:
      erroPermissao,
  } =
    await supabase
      .from(
        "permissoes"
      )
      .select(`
        id,
        email,
        tipo_permissao
      `)
      .ilike(
        "email",
        email
      )
      .maybeSingle();

  if (
    erroPermissao ||
    !permissao
  ) {
    await supabase.auth
      .signOut();

    return NextResponse.redirect(
      `${origin}/login?erro=sem-permissao`
    );
  }

  // ----------------------------------------------------------
  // Usuário autenticado e autorizado
  // ----------------------------------------------------------

  return NextResponse.redirect(
    `${origin}/lista`
  );
}