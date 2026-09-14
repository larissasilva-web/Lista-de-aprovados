# Integração aplicada — Permissões modulares + Lista de Aprovados

Este pacote já contém as alterações aplicadas diretamente ao repositório atual.

## Ordem de implantação

1. No Supabase SQL Editor, execute `sql/01_permissoes_modulares.sql`.
2. Depois execute `sql/02_lista_aprovados_operacional.sql`.
3. Só então publique/deploy esta versão do código.
4. Faça login com uma conta administradora e valide `/permissoes`.
5. Valide `/lista` com um administrador, um contratador e um usuário de leitura.

## O que mudou

### Permissões

- Mantidos os perfis existentes: `usuario`, `contratador`, `admin`.
- Adicionado controle de acesso por módulo:
  - Lista de aprovados;
  - Dashboards;
  - Editais;
  - Permissões;
  - Configurações.
- O módulo pode **restringir** um perfil, mas não elevar privilégios:
  - `usuario`: Lista e Dashboards;
  - `contratador`: Lista, Dashboards e Editais;
  - `admin`: todos os módulos.
- Usuário pode ser marcado como ativo/inativo.
- Usuário ativo precisa ter pelo menos um módulo liberado.
- Administrador não consegue retirar o próprio perfil/acessos.
- A inativação também passa a afetar `tipo_permissao_atual()`, reforçando as RLS existentes.
- A RLS da Lista passa a respeitar `acesso_lista`.
- Escritas em Editais passam a respeitar `acesso_editais`.
- Navegação e rotas server-side respeitam os módulos liberados.
- O login redireciona para o primeiro módulo que o usuário realmente pode acessar.

### Lista de aprovados

- Novo visual operacional inspirado no AgSUS Monitora antigo, mas implementado nativamente em React/Next.js.
- KPIs por status.
- Filtros por unidade, edital, cargo, código da vaga, status e Sub judice.
- Busca por candidato, matrícula ou processo SEI.
- Unidade herdada de `editais.unidade`; não foi duplicada em `lista_aprovados`.
- Drawer lateral para detalhamento do candidato.
- Modo leitura para `usuario` e modo operacional para `contratador/admin`.
- Alteração de status preservada.
- Matrícula e data de contratação continuam obrigatórias para `Contratado`.
- Inclusão de candidato Sub judice preservada e integrada ao novo visual.
- Remoção de Sub judice preservada e registrada pelo RPC existente.

## Arquivos principais alterados

- `src/lib/acesso/modulos.ts`
- `src/lib/auth/usuario-atual.ts`
- `src/app/auth/callback/route.ts`
- `src/app/(sistema)/layout.tsx`
- `src/app/(sistema)/lista/page.tsx`
- `src/app/(sistema)/permissoes/page.tsx`
- `src/app/(sistema)/editais/page.tsx`
- `src/app/(sistema)/dashboards/saude-indigena/page.tsx`
- `src/app/(sistema)/configuracoes/page.tsx`
- `src/components/sistema/sistema-shell.tsx`
- `src/components/sistema/navegacao-sistema.tsx`
- `src/components/permissoes/gerenciamento-permissoes.tsx`
- `src/components/lista/lista-aprovados.tsx`
- `src/app/globals.css`
- `sql/01_permissoes_modulares.sql`
- `sql/02_lista_aprovados_operacional.sql`

## Validação realizada neste pacote

Foi feita validação sintática de todos os arquivos `.ts`/`.tsx` com o compilador TypeScript. Não foram encontrados erros de sintaxe.

O `npm ci` não pôde ser concluído no ambiente de geração porque o acesso ao `registry.npmjs.org` estava indisponível (`EAI_AGAIN`). Portanto, o build completo do Next.js deve ser executado localmente após extrair o ZIP:

```powershell
npm ci
npm run build
```

Nenhuma credencial ou arquivo `.env.local` foi incluído ou alterado.
