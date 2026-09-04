import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { obterUsuarioAtual } from "@/lib/auth/usuario-atual";

export default async function SistemaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const usuario = await obterUsuarioAtual();

  const podeGerenciarEditais =
    usuario.tipoPermissao === "contratador" ||
    usuario.tipoPermissao === "admin";

  const admin =
    usuario.tipoPermissao === "admin";

  const descricaoPermissao = {
    usuario: "Usuário",
    contratador: "Contratador",
    admin: "Administrador",
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="flex h-16 items-center justify-between px-6">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              Lista de Aprovados
            </h1>
          </div>

          <div className="flex items-center gap-5">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-800">
                {usuario.nome}
              </p>

              <p className="text-xs text-slate-500">
                {
                  descricaoPermissao[
                    usuario.tipoPermissao
                  ]
                }
              </p>
            </div>

            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-64px)]">
        <aside className="w-64 border-r border-slate-200 bg-white p-4">
          <nav className="space-y-1">
            <Link
              href="/lista"
              className="block rounded-lg px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Lista
            </Link>

            {podeGerenciarEditais && (
              <Link
                href="/editais"
                className="block rounded-lg px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Gerenciamento dos Editais
              </Link>
            )}

            {admin && (
              <Link
                href="/permissoes"
                className="block rounded-lg px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Permissões
              </Link>
            )}

            {admin && (
              <Link
                href="/configuracoes"
                className="block rounded-lg px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Configurações
              </Link>
            )}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}