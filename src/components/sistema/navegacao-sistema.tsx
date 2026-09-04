"use client";

import Link from "next/link";

import {
  usePathname,
} from "next/navigation";

import {
  useState,
} from "react";

import {
  createClient,
} from "@/lib/supabase/client";

import {
  ConfiguracaoSistema,
} from "@/lib/configuracoes/tema";

type TipoPermissao =
  | "usuario"
  | "contratador"
  | "admin";

type Usuario = {
  nome: string;
  email: string;
  tipoPermissao:
    TipoPermissao;
};

type Props = {
  usuario: Usuario;

  configuracao:
    ConfiguracaoSistema;
};

export function NavegacaoSistema({
  usuario,
  configuracao,
}: Props) {
  const pathname =
    usePathname();

  const [
    saindo,
    setSaindo,
  ] = useState(false);

  const itens = [
    {
      nome:
        "Lista de Aprovados",
      href:
        "/lista",
      perfis: [
        "usuario",
        "contratador",
        "admin",
      ],
    },
    {
      nome:
        "Editais",
      href:
        "/editais",
      perfis: [
        "contratador",
        "admin",
      ],
    },
    {
      nome:
        "Permissões",
      href:
        "/permissoes",
      perfis: [
        "admin",
      ],
    },
    {
      nome:
        "Configurações",
      href:
        "/configuracoes",
      perfis: [
        "admin",
      ],
    },
  ];

  async function sair() {
    setSaindo(true);

    const supabase =
      createClient();

    await supabase.auth
      .signOut();

    window.location.href =
      "/login";
  }

  const rotuloPerfil =
    usuario.tipoPermissao ===
    "admin"
      ? "Administrador"
      : usuario.tipoPermissao ===
          "contratador"
        ? "Contratador"
        : "Usuário";

  return (
    <aside
      className="flex w-full shrink-0 flex-col lg:min-h-[calc(100vh-64px)] lg:w-64"
      style={{
        backgroundColor:
          configuracao.corSidebar,

        color:
          configuracao.corTextoSidebar,
      }}
    >
      <nav className="flex flex-1 gap-2 overflow-x-auto p-4 lg:flex-col lg:overflow-visible">
        {itens
          .filter((item) =>
            item.perfis.includes(
              usuario.tipoPermissao
            )
          )
          .map((item) => {
            const ativo =
              pathname ===
                item.href ||
              pathname.startsWith(
                `${item.href}/`
              );

            return (
              <Link
                key={
                  item.href
                }
                href={
                  item.href
                }
                className="whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-medium transition"
                style={{
                  backgroundColor:
                    ativo
                      ? configuracao.corPrimaria
                      : "transparent",

                  color:
                    ativo
                      ? "#FFFFFF"
                      : configuracao.corTextoSidebar,
                }}
              >
                {
                  item.nome
                }
              </Link>
            );
          })}
      </nav>

      <div className="hidden border-t border-white/10 p-4 lg:block">
        <p className="truncate text-sm font-medium">
          {
            usuario.nome
          }
        </p>

        <p className="mt-1 truncate text-xs opacity-70">
          {
            usuario.email
          }
        </p>

        <p className="mt-1 text-xs opacity-70">
          {rotuloPerfil}
        </p>

        <button
          type="button"
          onClick={sair}
          disabled={saindo}
          className="mt-4 w-full rounded-lg border border-white/20 px-3 py-2 text-sm transition hover:bg-white/10 disabled:opacity-50"
        >
          {saindo
            ? "Saindo..."
            : "Sair"}
        </button>
      </div>
    </aside>
  );
}