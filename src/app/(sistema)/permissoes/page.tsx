import { GerenciamentoPermissoes } from "@/components/permissoes/gerenciamento-permissoes";
import { exigirPermissao } from "@/lib/auth/usuario-atual";
import { createClient } from "@/lib/supabase/server";

export default async function PermissoesPage() {
  const usuarioAtual = await exigirPermissao([
    "admin",
  ]);

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("permissoes")
    .select(`
      id,
      auth_user_id,
      email,
      nome,
      tipo_permissao
    `)
    .order("nome", {
      ascending: true,
    });

  if (error) {
    throw new Error(
      `Erro ao carregar usuários: ${error.message}`
    );
  }

  const usuarios = (data ?? []).map((item) => ({
    id: item.id,

    auth_user_id: item.auth_user_id,

    email: item.email,

    nome: item.nome,

    tipo_permissao:
      item.tipo_permissao as
        | "usuario"
        | "contratador"
        | "admin",
  }));

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-900">
          Permissões
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Gerencie os usuários e os níveis de acesso ao sistema.
        </p>
      </div>

      <GerenciamentoPermissoes
        usuariosIniciais={usuarios}
        emailUsuarioAtual={usuarioAtual.email}
      />
    </section>
  );
}