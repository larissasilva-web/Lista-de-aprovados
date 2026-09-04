import {
  FormularioConfiguracoes,
} from "@/components/configuracoes/formulario-configuracoes";

import {
  exigirPermissao,
} from "@/lib/auth/usuario-atual";

import {
  obterConfiguracoesSistema,
} from "@/lib/configuracoes/obter-configuracoes";

export default async function ConfiguracoesPage() {
  await exigirPermissao([
    "admin",
  ]);

  const configuracao =
    await obterConfiguracoesSistema();

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">
          Configurações
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Personalize a identidade visual e a aparência do sistema.
        </p>
      </div>

      <FormularioConfiguracoes
        configuracaoInicial={
          configuracao
        }
      />
    </section>
  );
}