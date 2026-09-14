import {
  GerenciamentoEditais,
} from "@/components/editais/gerenciamento-editais";

import {
  NovaListaModal,
} from "@/components/editais/nova-lista-modal";

import {
  NovoEditalModal,
} from "@/components/editais/novo-edital-modal";

import {
  exigirModulo,
} from "@/lib/auth/usuario-atual";

import {
  createClient,
} from "@/lib/supabase/server";

export default async function EditaisPage() {
  const usuarioAtual =
    await exigirModulo("editais", [
      "contratador",
      "admin",
    ]);

  const supabase =
    await createClient();

  const {
    data: editais,
    error: erroEditais,
  } = await supabase
    .from("editais")
    .select(`
      id,
      processo_seletivo,
      edital,
      unidade,
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

  if (erroEditais) {
    throw new Error(
      `Erro ao carregar editais: ${erroEditais.message}`
    );
  }

  const {
    data: fontesEditais,
    error: erroFontes,
  } = await supabase
    .from("fontes_editais")
    .select(`
      edital_id,
      pasta_analise_id,
      pasta_entrevistas_id,
      planilha_cruzamento_id,
      etl_habilitado,
      ultima_sincronizacao,
      status_sincronizacao,
      mensagem_erro
    `);

  if (erroFontes) {
    throw new Error(
      `Erro ao carregar integrações dos editais: ${erroFontes.message}`
    );
  }

  const fontesPorEdital =
    new Map(
      (
        fontesEditais ?? []
      ).map(
        (fonte) => [
          fonte.edital_id,
          fonte,
        ]
      )
    );

  const editaisComIntegracao =
    (
      editais ?? []
    ).map(
      (edital) => ({
        ...edital,
        fonte_integracao:
          fontesPorEdital.get(
            edital.id
          ) ?? null,
      })
    );

  const ehAdmin =
    usuarioAtual.tipoPermissao ===
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

        <div className="flex flex-wrap gap-3">
          <NovoEditalModal />
          <NovaListaModal />
        </div>
      </div>

      <GerenciamentoEditais
        editaisIniciais={
          editaisComIntegracao
        }
        podeExcluir={
          ehAdmin
        }
        podeConfigurarIntegracao={
          ehAdmin
        }
      />
    </section>
  );
}
