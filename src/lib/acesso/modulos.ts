export type TipoPermissao =
  | "usuario"
  | "gestor_edital"
  | "contratador"
  | "admin";

export type ModuloSistema =
  | "lista"
  | "dashboards"
  | "editais"
  | "permissoes"
  | "configuracoes";

export type ContextoAcesso = {
  id: string;
  auth_user_id: string | null;
  email: string;
  nome: string | null;
  tipo_permissao: TipoPermissao;
  ativo: boolean;
  modulos: Record<ModuloSistema, boolean>;
};

export const ROTULO_PERMISSAO: Record<TipoPermissao, string> = {
  usuario: "Usuário",
  gestor_edital: "Gestor de edital",
  contratador: "Contratador",
  admin: "Administrador",
};

export const ROTULO_MODULO: Record<ModuloSistema, string> = {
  lista: "Lista de aprovados",
  dashboards: "Dashboards",
  editais: "Editais",
  permissoes: "Permissões",
  configuracoes: "Configurações",
};

export const MODULOS_SISTEMA: ModuloSistema[] = [
  "lista",
  "dashboards",
  "editais",
  "permissoes",
  "configuracoes",
];

export function modulosPermitidosPorPerfil(
  tipo: TipoPermissao
): Record<ModuloSistema, boolean> {
  if (tipo === "admin") {
    return {
      lista: true,
      dashboards: true,
      editais: true,
      permissoes: true,
      configuracoes: true,
    };
  }

  if (tipo === "contratador" || tipo === "gestor_edital") {
    return {
      lista: true,
      dashboards: true,
      editais: true,
      permissoes: false,
      configuracoes: false,
    };
  }

  return {
    lista: true,
    dashboards: true,
    editais: false,
    permissoes: false,
    configuracoes: false,
  };
}

export function acessoPadraoPorPerfil(
  tipo: TipoPermissao
): Record<ModuloSistema, boolean> {
  return modulosPermitidosPorPerfil(tipo);
}

export function limitarModulosAoPerfil(
  tipo: TipoPermissao,
  modulos: Record<ModuloSistema, boolean>
): Record<ModuloSistema, boolean> {
  const permitidos = modulosPermitidosPorPerfil(tipo);

  return {
    lista: Boolean(permitidos.lista && modulos.lista),
    dashboards: Boolean(permitidos.dashboards && modulos.dashboards),
    editais: Boolean(permitidos.editais && modulos.editais),
    permissoes: Boolean(permitidos.permissoes && modulos.permissoes),
    configuracoes: Boolean(
      permitidos.configuracoes && modulos.configuracoes
    ),
  };
}

export function podeOperarLista(
  contexto: ContextoAcesso | null
): boolean {
  return Boolean(
    contexto?.ativo &&
      contexto.modulos.lista &&
      (contexto.tipo_permissao === "contratador" ||
        contexto.tipo_permissao === "admin")
  );
}

// ============================================================
// Editais: cadastrar e alterar sao privilegios distintos.
// O gestor de edital cadastra novos editais, mas nao altera,
// inativa nem exclui os que ja estao cadastrados.
// ============================================================

export function podeCadastrarEdital(tipo: TipoPermissao): boolean {
  return (
    tipo === "gestor_edital" ||
    tipo === "contratador" ||
    tipo === "admin"
  );
}

export function podeEditarEdital(tipo: TipoPermissao): boolean {
  return tipo === "contratador" || tipo === "admin";
}

export function podeExcluirEdital(tipo: TipoPermissao): boolean {
  return tipo === "admin";
}

export function rotaInicialPorModulos(
  modulos: Record<ModuloSistema, boolean>
): string | null {
  if (modulos.lista) return "/lista";
  if (modulos.dashboards) return "/dashboards/saude-indigena";
  if (modulos.editais) return "/editais";
  if (modulos.permissoes) return "/permissoes";
  if (modulos.configuracoes) return "/configuracoes";

  return null;
}
