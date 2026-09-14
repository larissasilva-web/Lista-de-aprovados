import { GerenciamentoPermissoes } from "@/components/permissoes/gerenciamento-permissoes";
import { exigirModulo } from "@/lib/auth/usuario-atual";

export default async function PermissoesPage() {
  await exigirModulo("permissoes", ["admin"]);

  return <GerenciamentoPermissoes />;
}
