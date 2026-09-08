import {
  GerenciamentoEditais,
} from "@/components/editais/gerenciamento-editais";

import {
  NovaListaModal,
} from "@/components/editais/nova-lista-modal";

import {
  exigirPermissao,
} from "@/lib/auth/usuario-atual";

import {
  createClient,
} from "@/lib/supabase/server";

export default async function EditaisPage() {
  const usuarioAtual =
    await exigirPermissao([
      "contratador",
      "admin",
    ]);

  const supabase =
    await createClient();

  const {
    data: permissao,
    error: erroPermissao,
  } = await supabase
    .from("permissoes")
    .select(
      "tipo_permissao"
    )
    .ilike(
      "email",
      usuarioAtual.email
    )
    .maybeSingle();

  if (
    erroPermissao ||
    !permissao
  ) {
    throw new Error(
      "Não foi possível identificar a permissão do usuário."
    );
  }

  const {
    data: editais,
    error,
  } = await supabase
    .from("editais")
    .select(`
      id,
      processo_seletivo,
      edital,
      status_edital,
      data_inicio,
      data_fim,
      prazo_validade,
      prorrogavel
    `)
    .order(
      "created_at",
      {
        ascending: false,
      }
    );

  if (error) {
    throw new Error(
      `Erro ao carregar editais: ${error.message}`
    );
  }

  const podeExcluir =
    permissao.tipo_permissao ===
    "admin";

  return (
    <section>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">
            Gerenciamento dos Editais
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Cadastre, pesquise e gerencie os editais dos processos seletivos.
          </p>
        </div>

        <NovaListaModal />
      </div>

      <GerenciamentoEditais
        editaisIniciais={
          editais ?? []
        }
        podeExcluir={
          podeExcluir
        }
      />
    </section>
  );
}