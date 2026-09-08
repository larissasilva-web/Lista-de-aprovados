import {
  ResumoEditais,
  ResumoEdital,
} from "@/components/resumo/resumo-editais";

import {
  exigirPermissao,
} from "@/lib/auth/usuario-atual";

import {
  createClient,
} from "@/lib/supabase/server";

export default async function ResumoPage() {
  await exigirPermissao([
    "usuario",
    "contratador",
    "admin",
  ]);

  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from(
      "vw_resumo_editais"
    )
    .select(`
      edital_id,
      processo_seletivo,
      edital,
      status_edital,
      total_lista,
      total_sub_judice,
      total_status_aprovado,
      total_convocados,
      total_contratados,
      total_desistentes,
      total_documentacao_rejeitada,
      total_desligamento,
      total_migracao
    `)
    .order(
      "processo_seletivo",
      {
        ascending: true,
      }
    )
    .order(
      "edital",
      {
        ascending: true,
      }
    );

  if (error) {
    throw new Error(
      `Erro ao carregar resumo: ${error.message}`
    );
  }

  const dados:
    ResumoEdital[] =
    (data ?? []).map(
      (item) => ({
        edital_id:
          item.edital_id,

        processo_seletivo:
          item.processo_seletivo,

        edital:
          item.edital,

        status_edital:
          item.status_edital,

        total_lista:
          Number(
            item.total_lista ??
              0
          ),

        total_sub_judice:
          Number(
            item.total_sub_judice ??
              0
          ),

        total_status_aprovado:
          Number(
            item.total_status_aprovado ??
              0
          ),

        total_convocados:
          Number(
            item.total_convocados ??
              0
          ),

        total_contratados:
          Number(
            item.total_contratados ??
              0
          ),

        total_desistentes:
          Number(
            item.total_desistentes ??
              0
          ),

        total_documentacao_rejeitada:
          Number(
            item.total_documentacao_rejeitada ??
              0
          ),

        total_desligamento:
          Number(
            item.total_desligamento??
              0
          ),

        total_migracao:
          Number(
            item.total_migracao ??
              0
          ),
      })
    );

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">
          Resumo
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Acompanhe os quantitativos consolidados por edital.
        </p>
      </div>

      <ResumoEditais
        dadosIniciais={
          dados
        }
      />
    </section>
  );
}