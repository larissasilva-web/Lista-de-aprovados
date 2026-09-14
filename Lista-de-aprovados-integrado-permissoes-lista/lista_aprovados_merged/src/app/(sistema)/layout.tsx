import { SistemaShell } from "@/components/sistema/sistema-shell";
import { obterUsuarioAtual } from "@/lib/auth/usuario-atual";
import { obterConfiguracoesSistema } from "@/lib/configuracoes/obter-configuracoes";

export default async function SistemaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [usuario, configuracao] = await Promise.all([
    obterUsuarioAtual(),
    obterConfiguracoesSistema(),
  ]);

  return (
    <SistemaShell
      usuario={{
        nome: usuario.nome || usuario.email,
        email: usuario.email,
        tipoPermissao: usuario.tipo_permissao,
        modulos: usuario.modulos,
      }}
      configuracao={configuracao}
    >
      {children}
    </SistemaShell>
  );
}
