import { GerenciamentoEditais } from "@/components/editais/gerenciamento-editais";
import { exigirPermissao } from "@/lib/auth/usuario-atual";
import { createClient } from "@/lib/supabase/server";
import { NovaListaModal } from "@/components/editais/nova-lista-modal";

export default async function EditaisPage() {
  const usuario =
    await exigirPermissao([
      "contratador",
      "admin",
    ]);

  const supabase =
    await createClient();

  const { data, error } =
    await supabase
      .from("editais")
      .select(`
        id,
        processo_seletivo,
        edital,
        status_edital,
        data_inicio,
        data_fim,
        prazo_validade,
        prorrogavel,
        created_at
      `)
      .order(
        "processo_seletivo",
        {
          ascending: true,
        }
      )
      .order("edital", {
        ascending: true,
      });

  if (error) {
    throw new Error(
      `Erro ao carregar editais: ${error.message}`
    );
  }

  const editais = data ?? [];

  const admin =
    usuario.tipoPermissao ===
    "admin";

  return (
    <section>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            Gerenciamento dos Editais
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Cadastre e gerencie os
            processos seletivos e suas
            listas de aprovados.
          </p>
        </div>

        <NovaListaModal />
      </div>

      <GerenciamentoEditais
        editais={editais}
        admin={admin}
      />
    </section>
  );
}