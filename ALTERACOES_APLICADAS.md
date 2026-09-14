# Integração aplicada — Permissões modulares + Lista de Aprovados

Este pacote já contém as alterações aplicadas diretamente ao repositório atual.

## Ordem de implantação

1. No Supabase SQL Editor, execute `sql/01_permissoes_modulares.sql`.
2. Depois execute `sql/02_lista_aprovados_operacional.sql`.
3. Depois execute `sql/03_perfil_gestor_edital.sql`.
4. Só então publique/deploy esta versão do código.
5. Faça login com uma conta administradora e valide `/permissoes`.
6. Valide `/lista` com um administrador, um contratador e um usuário de leitura.
7. Valide `/editais` com um gestor de edital: deve conseguir cadastrar,
   mas não deve ver os botões **Editar**, **Inativar/Ativar** e **Excluir**.

## O que mudou

### Permissões

- Mantidos os perfis existentes: `usuario`, `contratador`, `admin`.
- Adicionado o perfil `gestor_edital`.
- Adicionado controle de acesso por módulo:
  - Lista de aprovados;
  - Dashboards;
  - Editais;
  - Permissões;
  - Configurações.
- O módulo pode **restringir** um perfil, mas não elevar privilégios:
  - `usuario`: Lista e Dashboards;
  - `gestor_edital`: Lista, Dashboards e Editais;
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

### Perfil `gestor_edital`

O que o perfil **pode** fazer:

- ver os dashboards;
- ver a lista de aprovados (somente leitura);
- cadastrar novos editais.

O que o perfil **não pode** fazer:

- alterar o status dos aprovados;
- alterar editais já cadastrados;
- inativar/ativar editais;
- excluir editais;
- importar nova lista de aprovados;
- configurar a integração automática de um edital;
- acessar Permissões ou Configurações.

A restrição é aplicada em três camadas:

1. **RLS** — `editais_insert` aceita `gestor_edital`; `editais_update` e
   `editais_delete` continuam restritas a `contratador`/`admin`. As policies de
   escrita em `lista_aprovados` também não incluem o novo perfil.
2. **Rotas server-side** — `exigirModulo` libera `/lista`, `/dashboards` e
   `/editais` para o perfil.
3. **Interface** — em `/editais` os botões de editar, inativar/ativar, excluir e
   o botão **Nova lista** não são renderizados para o gestor de edital.

> Atenção: as funções `cadastrar_edital` e `importar_lista_aprovados` já existem
> no banco e não fazem parte deste repositório. O script `03` termina com um
> bloco de diagnóstico que emite um `WARNING` caso alguma delas valide o perfil
> internamente sem conhecer `gestor_edital` — nesse caso a função precisa ser
> ajustada no Supabase para que o cadastro de edital funcione para o novo perfil.

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
- `src/components/editais/gerenciamento-editais.tsx`
- `src/app/actions/usuarios.ts`
- `sql/01_permissoes_modulares.sql`
- `sql/02_lista_aprovados_operacional.sql`
- `sql/03_perfil_gestor_edital.sql`

## Validação realizada neste pacote

Foi feita validação sintática de todos os arquivos `.ts`/`.tsx` com o compilador TypeScript. Não foram encontrados erros de sintaxe.

O `npm ci` não pôde ser concluído no ambiente de geração porque o acesso ao `registry.npmjs.org` estava indisponível (`EAI_AGAIN`). Portanto, o build completo do Next.js deve ser executado localmente após extrair o ZIP:

```powershell
npm ci
npm run build
```

Nenhuma credencial ou arquivo `.env.local` foi incluído ou alterado.
