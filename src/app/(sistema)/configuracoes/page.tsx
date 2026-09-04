import {
  FormularioConfiguracoes,
} from "@/components/configuracoes/formulario-configuracoes";

import {
  exigirPermissao,
} from "@/lib/auth/usuario-atual";

import {
  createClient,
} from "@/lib/supabase/server";

export default async function ConfiguracoesPage() {
  await exigirPermissao([
    "admin",
  ]);

  const supabase =
    await createClient();

  const {
    data,
    error,
  } = await supabase
    .from("configuracoes")
    .select(`
      id,
      titulo_sistema,
      cor_primaria,
      logo_url
    `)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Erro ao carregar configurações: ${error.message}`
    );
  }

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-slate-900">
          Configurações
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Personalize as informações gerais e a identidade visual do sistema.
        </p>
      </div>

      <FormularioConfiguracoes
        configuracaoInicial={{
          id:
            data?.id ??
            null,

          tituloSistema:
            data?.titulo_sistema ??
            "Lista de Aprovados",

          corPrimaria:
            data?.cor_primaria ??
            "#094780",

          logoUrl:
            data?.logo_url ??
            null,
        }}
      />
    </section>
  );
}