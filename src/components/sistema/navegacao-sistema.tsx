"use client";

import Link from "next/link";

import {
  usePathname,
} from "next/navigation";

import {
  ReactNode,
  useEffect,
  useState,
} from "react";

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

  recolhida: boolean;

  mobileAberto: boolean;

  onFecharMobile:
    () => void;
};


type TipoIcone =
  | "lista"
  | "dashboard"
  | "editais"
  | "usuarios"
  | "configuracoes";


function Icone({
  tipo,
}: {
  tipo: TipoIcone;
}) {
  const classe =
    "h-5 w-5 shrink-0";

  const base = (
    children:
      ReactNode
  ) => (
    <svg
      viewBox="0 0 24 24"
      className={
        classe
      }
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );


  switch (tipo) {

    case "lista":
      return base(
        <>
          <path d="M8 6h13" />
          <path d="M8 12h13" />
          <path d="M8 18h13" />
          <path d="M3 6h.01" />
          <path d="M3 12h.01" />
          <path d="M3 18h.01" />
        </>
      );


    case "dashboard":
      return base(
        <>
          <rect
            x="3"
            y="3"
            width="7"
            height="7"
            rx="1"
          />

          <rect
            x="14"
            y="3"
            width="7"
            height="7"
            rx="1"
          />

          <rect
            x="3"
            y="14"
            width="7"
            height="7"
            rx="1"
          />

          <rect
            x="14"
            y="14"
            width="7"
            height="7"
            rx="1"
          />
        </>
      );


    case "editais":
      return base(
        <>
          <path d="M6 2h9l5 5v15H6z" />
          <path d="M14 2v6h6" />
          <path d="M9 13h8" />
          <path d="M9 17h8" />
        </>
      );


    case "usuarios":
      return base(
        <>
          <circle
            cx="9"
            cy="8"
            r="4"
          />

          <path d="M3 21v-2a6 6 0 0 1 12 0v2" />

          <path d="M17 11a4 4 0 0 1 4 4v2" />
        </>
      );


    case "configuracoes":
      return base(
        <>
          <circle
            cx="12"
            cy="12"
            r="3"
          />

          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-2.83 2.83-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21h-4v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06-2.83-2.83.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3v-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06L7.04 4.3l.06.06a1.65 1.65 0 0 0 1.82.33h.01A1.65 1.65 0 0 0 10 3.18V3h4v.18a1.65 1.65 0 0 0 1.07 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06 2.83 2.83-.06.06A1.65 1.65 0 0 0 19.4 9v.01A1.65 1.65 0 0 0 20.91 10H21v4h-.09A1.65 1.65 0 0 0 19.4 15Z" />
        </>
      );
  }
}


function Seta({
  aberta,
}: {
  aberta: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`
        h-4
        w-4
        shrink-0
        transition-transform
        duration-200
        ${
          aberta
            ? "rotate-90"
            : ""
        }
      `}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}


export function NavegacaoSistema({
  usuario,
  configuracao,
  recolhida,
  mobileAberto,
  onFecharMobile,
}: Props) {

  const pathname =
    usePathname();


  const dashboardAtivo =
    pathname.startsWith(
      "/dashboards"
    );


  const [
    dashboardAberto,
    setDashboardAberto,
  ] = useState(
    dashboardAtivo
  );


  useEffect(
    () => {

      if (
        dashboardAtivo
      ) {
        setDashboardAberto(
          true
        );
      }

    },
    [dashboardAtivo]
  );


  const itensAntesDashboard: {
    nome: string;
    href: string;
    icone: TipoIcone;
    perfis:
      TipoPermissao[];
  }[] = [
    {
      nome:
        "Lista de Aprovados",

      href:
        "/lista",

      icone:
        "lista",

      perfis: [
        "usuario",
        "contratador",
        "admin",
      ],
    },
  ];


  const itensDepoisDashboard: {
    nome: string;
    href: string;
    icone: TipoIcone;
    perfis:
      TipoPermissao[];
  }[] = [
    {
      nome:
        "Editais",

      href:
        "/editais",

      icone:
        "editais",

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

      icone:
        "usuarios",

      perfis: [
        "admin",
      ],
    },

    {
      nome:
        "Configurações",

      href:
        "/configuracoes",

      icone:
        "configuracoes",

      perfis: [
        "admin",
      ],
    },
  ];


  function renderizarItem(
    item: {
      nome: string;
      href: string;
      icone: TipoIcone;
      perfis:
        TipoPermissao[];
    }
  ) {

    if (
      !item.perfis.includes(
        usuario.tipoPermissao
      )
    ) {
      return null;
    }


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
        title={
          recolhida
            ? item.nome
            : undefined
        }
        onClick={
          onFecharMobile
        }
        className={`
          flex
          min-h-11
          items-center
          gap-3
          rounded-lg
          px-3
          text-sm
          font-medium
          transition

          ${
            recolhida
              ? "lg:justify-center"
              : ""
          }
        `}
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

        <Icone
          tipo={
            item.icone
          }
        />

        <span
          className={
            recolhida
              ? "lg:hidden"
              : ""
          }
        >
          {
            item.nome
          }
        </span>

      </Link>
    );
  }


  return (
    <>

      {/* OVERLAY MOBILE */}

      {mobileAberto && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={
            onFecharMobile
          }
          className="fixed inset-0 top-16 z-30 bg-black/40 lg:hidden"
        />
      )}


      {/* SIDEBAR */}

      <aside
        className={`
          fixed bottom-0 left-0 top-16 z-40
          flex flex-col
          overflow-y-auto
          transition-all duration-200

          ${
            mobileAberto
              ? "translate-x-0"
              : "-translate-x-full"
          }

          w-64

          lg:sticky
          lg:top-16
          lg:z-20
          lg:h-[calc(100vh-4rem)]
          lg:translate-x-0

          ${
            recolhida
              ? "lg:w-20"
              : "lg:w-64"
          }
        `}
        style={{
          backgroundColor:
            configuracao.corSidebar,

          color:
            configuracao.corTextoSidebar,
        }}
      >

        <nav
          className="
            flex
            flex-1
            flex-col
            gap-1.5
            p-3
          "
        >

          {/* LISTA */}

          {itensAntesDashboard.map(
            renderizarItem
          )}


          {/* =================================================
              DASHBOARDS
          ================================================= */}

          <div>

            <button
              type="button"
              title={
                recolhida
                  ? "Dashboards"
                  : undefined
              }
              onClick={
                () =>
                  setDashboardAberto(
                    (
                      valor
                    ) =>
                      !valor
                  )
              }
              className={`
                flex
                min-h-11
                w-full
                items-center
                gap-3
                rounded-lg
                px-3
                text-sm
                font-medium
                transition

                ${
                  recolhida
                    ? "lg:justify-center"
                    : ""
                }
              `}
              style={{
                backgroundColor:
                  dashboardAtivo
                    ? configuracao.corPrimaria
                    : "transparent",

                color:
                  dashboardAtivo
                    ? "#FFFFFF"
                    : configuracao.corTextoSidebar,
              }}
            >

              <Icone
                tipo="dashboard"
              />


              <span
                className={`
                  flex
                  flex-1
                  items-center
                  justify-between

                  ${
                    recolhida
                      ? "lg:hidden"
                      : ""
                  }
                `}
              >

                <span>
                  Dashboards
                </span>

                <Seta
                  aberta={
                    dashboardAberto
                  }
                />

              </span>

            </button>


            {/* SUBMENU */}

            {dashboardAberto && (

              <div
                className={`
                  mt-1
                  space-y-1

                  ${
                    recolhida
                      ? "lg:ml-0"
                      : "ml-5"
                  }
                `}
              >

                <Link
                  href="/dashboards/saude-indigena"
                  title={
                    recolhida
                      ? "Saúde Indígena"
                      : undefined
                  }
                  onClick={
                    onFecharMobile
                  }
                  className={`
                    flex
                    min-h-10
                    items-center
                    gap-3
                    rounded-lg
                    px-3
                    text-sm
                    transition

                    ${
                      recolhida
                        ? "lg:justify-center"
                        : ""
                    }
                  `}
                  style={{
                    backgroundColor:
                      pathname ===
                        "/dashboards/saude-indigena" ||
                      pathname.startsWith(
                        "/dashboards/saude-indigena/"
                      )
                        ? configuracao.corPrimaria
                        : "transparent",

                    color:
                      pathname ===
                        "/dashboards/saude-indigena" ||
                      pathname.startsWith(
                        "/dashboards/saude-indigena/"
                      )
                        ? "#FFFFFF"
                        : configuracao.corTextoSidebar,
                  }}
                >

                  <span
                    className="
                      h-1.5
                      w-1.5
                      shrink-0
                      rounded-full
                      bg-current
                    "
                  />


                  <span
                    className={
                      recolhida
                        ? "lg:hidden"
                        : ""
                    }
                  >
                    Saúde Indígena
                  </span>

                </Link>

              </div>

            )}

          </div>


          {/* RESTANTE DO MENU */}

          {itensDepoisDashboard.map(
            renderizarItem
          )}

        </nav>


        {/* PERFIL NO MOBILE */}

        <div className="border-t border-white/10 p-4 lg:hidden">

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

        </div>

      </aside>

    </>
  );
}