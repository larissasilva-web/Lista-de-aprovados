"use server";

import { revalidatePath } from "next/cache";

import { TipoPermissao } from "@/lib/acesso/modulos";
import { exigirPermissao } from "@/lib/auth/usuario-atual";
import { createClient } from "@/lib/supabase/server";

type ResultadoAcao = {
  sucesso: boolean;
  mensagem: string;
};

type NovoUsuario = {
  nome: string;
  email: string;
  tipoPermissao: TipoPermissao;
};


// ============================================================
// ADICIONAR USUÁRIO
// ============================================================

export async function adicionarUsuario(
  dados: NovoUsuario
): Promise<ResultadoAcao> {
  const adminAtual =
    await exigirPermissao([
      "admin",
    ]);

  const nome =
    dados.nome.trim();

  const email =
    dados.email
      .trim()
      .toLowerCase();

  const tipoPermissao =
    dados.tipoPermissao;

  if (!nome) {
    return {
      sucesso: false,
      mensagem:
        "Informe o nome do usuário.",
    };
  }

  if (!email) {
    return {
      sucesso: false,
      mensagem:
        "Informe o e-mail do usuário.",
    };
  }

  const emailValido =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    );

  if (!emailValido) {
    return {
      sucesso: false,
      mensagem:
        "Informe um e-mail válido.",
    };
  }

  const permissoesValidas:
    TipoPermissao[] = [
      "usuario",
      "gestor_edital",
      "contratador",
      "admin",
    ];

  if (
    !permissoesValidas.includes(
      tipoPermissao
    )
  ) {
    return {
      sucesso: false,
      mensagem:
        "Tipo de permissão inválido.",
    };
  }

  const supabase =
    await createClient();

  // ----------------------------------------------------------
  // Verificar se já existe
  // ----------------------------------------------------------

  const {
    data: usuarioExistente,
    error: erroConsulta,
  } = await supabase
    .from("permissoes")
    .select("id, email")
    .ilike(
      "email",
      email
    )
    .maybeSingle();

  if (erroConsulta) {
    return {
      sucesso: false,
      mensagem:
        `Erro ao verificar usuário: ${erroConsulta.message}`,
    };
  }

  if (usuarioExistente) {
    return {
      sucesso: false,
      mensagem:
        "Já existe um usuário cadastrado com este e-mail.",
    };
  }

  // ----------------------------------------------------------
  // Inserir permissão
  // ----------------------------------------------------------

  const {
    data: novoUsuario,
    error: erroCadastro,
  } = await supabase
    .from("permissoes")
    .insert({
      nome,
      email,
      tipo_permissao:
        tipoPermissao,

      // O usuário pode ainda nunca ter entrado com Google.
      auth_user_id:
        null,
    })
    .select(`
      id,
      email,
      nome,
      tipo_permissao
    `)
    .single();

  if (
    erroCadastro ||
    !novoUsuario
  ) {
    return {
      sucesso: false,
      mensagem:
        erroCadastro
          ? `Não foi possível cadastrar o usuário: ${erroCadastro.message}`
          : "Não foi possível cadastrar o usuário.",
    };
  }

  // ----------------------------------------------------------
  // Log
  // ----------------------------------------------------------

  const {
    error: erroLog,
  } = await supabase
    .from("logs")
    .insert({
      usuario_alterou:
        adminAtual.email,

      alteracoes: {
        acao:
          "CRIACAO_USUARIO",

        usuario_nome:
          nome,

        usuario_email:
          email,

        tipo_permissao:
          tipoPermissao,
      },
    });

  if (erroLog) {
    console.error(
      "Usuário criado, mas houve erro ao registrar log:",
      erroLog
    );
  }

  revalidatePath(
    "/permissoes"
  );

  return {
    sucesso: true,
    mensagem:
      `Usuário ${email} cadastrado com sucesso.`,
  };
}


// ============================================================
// EXCLUIR USUÁRIO / REVOGAR ACESSO
// ============================================================

export async function excluirUsuario(
  permissaoId: string
): Promise<ResultadoAcao> {
  const adminAtual =
    await exigirPermissao([
      "admin",
    ]);

  if (!permissaoId) {
    return {
      sucesso: false,
      mensagem:
        "Usuário não informado.",
    };
  }

  const supabase =
    await createClient();

  // ----------------------------------------------------------
  // Buscar usuário
  // ----------------------------------------------------------

  const {
    data: usuario,
    error: erroUsuario,
  } = await supabase
    .from("permissoes")
    .select(`
      id,
      nome,
      email,
      tipo_permissao
    `)
    .eq(
      "id",
      permissaoId
    )
    .maybeSingle();

  if (erroUsuario) {
    return {
      sucesso: false,
      mensagem:
        `Erro ao localizar usuário: ${erroUsuario.message}`,
    };
  }

  if (!usuario) {
    return {
      sucesso: false,
      mensagem:
        "Usuário não encontrado.",
    };
  }

  // ----------------------------------------------------------
  // Impedir autoexclusão
  // ----------------------------------------------------------

  if (
    usuario.email
      .toLowerCase() ===
    adminAtual.email
      .toLowerCase()
  ) {
    return {
      sucesso: false,
      mensagem:
        "Você não pode remover o acesso da sua própria conta.",
    };
  }

  // ----------------------------------------------------------
  // Excluir somente da tabela de permissões
  //
  // Não precisamos excluir auth.users.
  // Sem permissão, o usuário não acessa o sistema.
  // ----------------------------------------------------------

  const {
    error: erroExclusao,
  } = await supabase
    .from("permissoes")
    .delete()
    .eq(
      "id",
      permissaoId
    );

  if (erroExclusao) {
    return {
      sucesso: false,
      mensagem:
        `Não foi possível remover o acesso: ${erroExclusao.message}`,
    };
  }

  // ----------------------------------------------------------
  // Log
  // ----------------------------------------------------------

  const {
    error: erroLog,
  } = await supabase
    .from("logs")
    .insert({
      usuario_alterou:
        adminAtual.email,

      alteracoes: {
        acao:
          "EXCLUSAO_USUARIO",

        usuario_nome:
          usuario.nome,

        usuario_email:
          usuario.email,

        tipo_permissao:
          usuario.tipo_permissao,
      },
    });

  if (erroLog) {
    console.error(
      "Acesso removido, mas houve erro ao registrar log:",
      erroLog
    );
  }

  revalidatePath(
    "/permissoes"
  );

  return {
    sucesso: true,
    mensagem:
      `Acesso de ${usuario.email} removido com sucesso.`,
  };
}