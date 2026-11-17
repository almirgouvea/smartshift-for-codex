# Como contribuir

[English](CONTRIBUTING.md) · **Português**

Issues e pull requests são bem-vindos, em português ou inglês.

## Preparar o ambiente

Você precisa do Node.js 24 e do Codex (`npm i -g @openai/codex` ou a extensão oficial do Codex).

```sh
npm install
npm test          # compila e roda todos os testes
```

Pressione **F5** no VS Code para abrir uma janela de teste. Ela carrega só o SmartShift e abre a pasta `test-workspace`, onde o Codex pode editar arquivos sem mexer no código da extensão. A primeira abertura demora uns 10 s por causa do depurador.

## Estrutura do projeto

| Caminho | O que faz |
|---|---|
| `src/extension.ts` | Ativação: registra o painel e os comandos, define o idioma |
| `src/panel.ts` | O painel de conversa: escolhe a rota de cada pedido, guarda o nível da conversa, roda planejar → executar, trata os eventos do Codex e as aprovações |
| `src/router.ts` | Lógica de decisão pura, sem depender do VS Code: `classify`, `decide`, `escalationSignals`, `resolveTier` |
| `src/i18n.ts` | Textos em inglês e português do painel, do classificador e das instruções enviadas ao Codex |
| `src/appServer.ts` | Cliente JSON-RPC do `codex app-server` via stdio |
| `src/codexLocator.ts` | Encontra o executável do Codex (configuração, extensão oficial, PATH) |
| `media/main.js`, `media/main.css` | Interface do painel (webview) |
| `package.nls.json`, `package.nls.pt-br.json` | Textos dos comandos e das configurações |
| `src/test/` | Testes unitários e um teste de integração com o `codex app-server` real |
| `docs/TESTING.pt-BR.md` | Testes manuais e resultados medidos |

Os comentários do código estão em português.

## Mudanças comuns

**Regras do classificador.** Edite `COMPLEX_RULES` ou `SIMPLE_RULES` em `src/router.ts`. As regras usam radicais de palavras em português e inglês. Acrescente um caso em `src/test/router.test.ts`.

**Textos.** Acrescente a chave em `en` e em `pt` no `src/i18n.ts`. O TypeScript acusa erro se faltar a chave em português, e um teste falha se os `{parâmetros}` forem diferentes. Textos de comandos e configurações ficam em `package.nls.json` e `package.nls.pt-br.json`.

**Protocolo.** Para ver todos os métodos e campos da sua versão do Codex:

```sh
npx codex app-server generate-json-schema --out .schema
```

## Testes

- `npm test` roda os testes unitários e o de integração. O de integração sobe o `codex app-server` real e só inicia um pedido quando você não está logado, então nunca gasta tokens.
- O CI roda os mesmos testes no Ubuntu e no Windows a cada push e pull request.
- Se a mudança altera comportamento, teste também à mão com o roteiro de [docs/TESTING.pt-BR.md](docs/TESTING.pt-BR.md) e registre o resultado lá.

## Lançar uma versão

1. Atualize `version` no `package.json` e registre as mudanças no `CHANGELOG.md`.
2. `npm test`
3. `npm run package` gera o `smartshift-for-codex-<versão>.vsix`.
4. Teste o pacote: desinstale o SmartShift, instale pelo `.vsix` e feche e abra o VS Code por completo (ele guarda o ícone em cache).
5. Publique o mesmo `.vsix` nas duas lojas. Só o mantenedor consegue: publicar exige acesso ao publisher e ao namespace `almirgouvea`.
   - **Visual Studio Marketplace:** envie em https://marketplace.visualstudio.com/manage/publishers/almirgouvea (**Update** no menu da extensão).
   - **Open VSX** (Cursor, Windsurf, VSCodium): com um token de publicação criado em https://open-vsx.org/user-settings/tokens, no PowerShell:

     ```powershell
     $env:OVSX_PAT = "<token>"
     npx ovsx publish smartshift-for-codex-<versão>.vsix
     ```
6. Faça o commit, crie a tag e envie:

   ```sh
   git tag v<versão>
   git push && git push --tags
   ```
