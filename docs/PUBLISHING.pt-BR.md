# Publicação

[English](PUBLISHING.md) · **Português**

Onde o SmartShift está publicado, como cada loja foi configurada e o que ainda falta. Os passos para lançar versões novas estão no [CONTRIBUTING.pt-BR.md](../CONTRIBUTING.pt-BR.md#lançar-uma-versão).

## Situação

| Onde | Situação | Link |
|---|---|---|
| Visual Studio Marketplace | ✅ 1.0.0 publicada e verificada em 16/11/2026 | [almirgouvea.smartshift-for-codex](https://marketplace.visualstudio.com/items?itemName=almirgouvea.smartshift-for-codex) |
| GitHub | ✅ repositório público, CI passando no Ubuntu e no Windows, tag `v1.0.0` | [almirgouvea/smartshift-for-codex](https://github.com/almirgouvea/smartshift-for-codex) |
| Open VSX | ✅ 1.0.0 enviada em 16/11/2026, ativa e com namespace verificado desde 17/11/2026 | [almirgouvea/smartshift-for-codex](https://open-vsx.org/extension/almirgouvea/smartshift-for-codex) |

## Visual Studio Marketplace

- Publisher `almirgouvea`, criado em https://marketplace.visualstudio.com/manage com uma conta Microsoft. Só os membros desse publisher conseguem publicar.
- A versão 1.0.0 foi enviada à mão (**New extension → Visual Studio Code**, arrastando o `.vsix`). A verificação automática levou poucos minutos.
- Nenhum token foi criado. O envio à mão não precisa.

## GitHub

- Repositório `almirgouvea/smartshift-for-codex`, público, licença MIT.
- Os commits usam o e-mail anônimo do GitHub, então nenhum e-mail pessoal fica público.
- A seção *About* tem a descrição, o link do Marketplace e os tópicos `vscode-extension`, `codex`, `openai`, `llm`, `model-routing`, `ai-coding`, `token-optimization`, `typescript`.
- O CI (`.github/workflows/ci.yml`) roda os testes no Ubuntu e no Windows a cada push e pull request e guarda o `.vsix` gerado. Ele não publica.

## Open VSX

O Open VSX é a loja usada pelo Cursor, Windsurf, VSCodium e outros editores que não podem usar o Marketplace da Microsoft.

O que foi feito:

1. Login em https://open-vsx.org com o GitHub (`almirgouvea`).
2. Criação de uma conta na Eclipse Foundation, ligada à mesma conta do GitHub.
3. Assinatura do Open VSX Publisher Agreement (**Profile → Log in with Eclipse**).
4. Criação do namespace `almirgouvea` pelo site (**Namespaces → +**).
5. Criação de um token **só de publicação**. Ele publica versões, mas não cria namespaces, não apaga extensões e não mexe na conta.
6. Publicação pelo PowerShell:

   ```powershell
   $env:OVSX_PAT = "<token>"
   npx ovsx publish smartshift-for-codex-1.0.0.vsix
   ```

Verificação do namespace (concluída em 17/11/2026):

- Depois da publicação, o Open VSX viu que `almirgouvea` já existe em outra loja (o Marketplace da Microsoft). Por isso a extensão ficou **inativa** até a equipe do Open VSX confirmar que o namespace é do mesmo dono.
- O pedido de propriedade foi feito em **Claim Ownership**, na página da extensão, que abre uma issue em https://github.com/EclipseFdn/open-vsx.org/issues. A prova enviada: o namespace, o usuário do GitHub, o repositório e o publisher do Marketplace são todos `almirgouvea`, com links para o repositório, um commit desse usuário, o `package.json` e a página do Marketplace.
- O pedido foi aprovado no dia seguinte. A extensão ficou ativa sem precisar publicar de novo, e a API do Open VSX passou a mostrar o namespace como verificado.

As próximas versões são publicadas com o mesmo token e o mesmo comando; o namespace continua verificado.

## Tokens

- Tokens nunca ficam no repositório nem são colados em issues ou conversas.
- No PowerShell, o `$env:OVSX_PAT` só vale enquanto aquele terminal estiver aberto.
- Para publicar automaticamente no futuro, o Open VSX oferece **Trusted Publishers**: o GitHub Actions se autentica com um token de curta duração na hora de publicar, sem guardar nenhum segredo. O Marketplace pode ser automatizado com um token salvo como segredo no GitHub. O GitHub não entrega segredos a pull requests de forks.
