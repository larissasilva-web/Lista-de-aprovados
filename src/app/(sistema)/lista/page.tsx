import { ListaAprovados } from "@/components/lista/lista-aprovados";
import { exigirModulo } from "@/lib/auth/usuario-atual";

export default async function ListaPage() {
  await exigirModulo("lista", [
    "usuario",
    "gestor_edital",
    "contratador",
    "admin",
  ]);

  return <ListaAprovados />;
}
