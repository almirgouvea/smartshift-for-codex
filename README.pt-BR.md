# SmartShift for Codex

[English](README.md) · **Português**

[![Marketplace](https://vsmarketplacebadges.dev/version-short/almirgouvea.smartshift-for-codex.svg)](https://marketplace.visualstudio.com/items?itemName=almirgouvea.smartshift-for-codex) [![CI](https://img.shields.io/github/actions/workflow/status/almirgouvea/smartshift-for-codex/ci.yml?branch=main&label=CI)](https://github.com/almirgouvea/smartshift-for-codex/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Escolhe **sozinho** o modelo e o esforço de raciocínio do Codex para cada pedido, conforme a complexidade, **sem gastar tokens para decidir**.

Pergunta simples vai para um modelo leve. Tarefa grande vai para um modelo forte, que primeiro planeja e depois passa a execução para um modelo intermediário. Você não precisa trocar o modelo à mão.

> Extensão **não oficial**, sem vínculo com a OpenAI. "Codex" é marca da OpenAI.

## Instalar

- **VS Code:** [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=almirgouvea.smartshift-for-codex), ou procure *SmartShift for Codex* na aba Extensões.
- **Cursor, Windsurf, VSCodium e outros editores que usam o Open VSX:** [Open VSX](https://open-vsx.org/extension/almirgouvea/smartshift-for-codex) (aguardando verificação do namespace, veja [docs/PUBLISHING.pt-BR.md](docs/PUBLISHING.pt-BR.md)).

## O que você precisa

- O **Codex** instalado: a extensão oficial do Codex no VS Code ou a CLI (`npm i -g @openai/codex`). Se não encontrar nenhum dos dois, o SmartShift oferece instalar.
- Uma conta do ChatGPT com acesso ao Codex. No primeiro uso, clique em **Entrar com ChatGPT** no painel. O login fica salvo em `~/.codex` e vale também para a extensão oficial e para a CLI.
- Uma pasta aberta no VS Code.

## Como usar

1. Clique no ícone do **SmartShift** na barra lateral.
2. Escreva o pedido. Enquanto você digita, aparece **"Vai usar: …"** com o modelo que será usado e o motivo.
3. Envie com **Ctrl+Enter**.

Depois de cada pedido aparecem o modelo usado, as chamadas ao modelo, os tokens gastos e quanto da entrada veio do cache.

As conversas ficam no mesmo histórico do Codex, então você também pode continuar uma delas no chat oficial.

## Quanto economiza

O mesmo pedido de complexidade média, medido nos registros do Codex no Windows:

| | Sem as regras do SmartShift | Com o SmartShift |
|---|---|---|
| Chamadas ao modelo | 40 | 5 |
| Tokens | 935 mil | 88 mil |

A maior parte da diferença veio de uma instrução que faz o Codex esperar os comandos terminarem em vez de perguntar a cada segundo (veja `smartShift.developerInstructions`).

Todos os testes manuais e os números medidos estão em [docs/TESTING.pt-BR.md](docs/TESTING.pt-BR.md).

## Como decide

Toda a decisão é local: regras sobre o texto do pedido e eventos que o Codex já envia. Nenhuma chamada extra a modelo.

1. **Classificação do pedido.** Soma pontos por:
   - tamanho do pedido;
   - palavras como *arquitetura, migrar, race condition, refatorar, implementar, depurar* (sobem) e *explique, renomeie, comentário, formatar* (descem);
   - lista com várias etapas, vários arquivos citados, stack trace colado, trecho grande selecionado no editor.

   Pontos ≥ 5 → **complexa**, ≥ 2 → **média**, abaixo → **simples**.
2. **Nível da conversa.** O nível só **sobe** dentro de uma conversa e volta a *simples* numa conversa nova. Motivo: o cache de prompt é por modelo, e trocar de modelo faz o Codex reprocessar o histórico inteiro sem desconto. Um pedido simples no meio de uma conversa *média* continua no modelo *média*.
3. **Planejar → executar.** Quando o próprio pedido é *complexo*, o modelo forte (`gpt-6-astra`) faz só o plano, em modo só leitura. Depois você clica em **Executar plano** e o modelo intermediário (`gpt-6.1-sol`) executa. O plano já está no histórico, então o modelo mais barato o recebe sem custo extra.
4. **Sinais depois de cada pedido.** Os **próximos** pedidos da conversa sobem um nível se o pedido:
   - falhar;
   - terminar com 2 ou mais comandos seguidos com erro (erros que o Codex resolveu depois, como uma busca sem resultado, não contam);
   - falhar ao aplicar alterações;
   - mexer em 8 ou mais arquivos. Ao executar um plano, isso não conta, porque o tamanho já estava previsto.
5. **Modelos da sua conta.** O modelo configurado é conferido contra os modelos da sua conta. Se não existir, o SmartShift usa o padrão do Codex e avisa na prévia. Se o esforço não for suportado, usa o esforço padrão do modelo.

No painel:

- O topo mostra o **nível da conversa**. Passe o mouse para ver por que ele subiu.
- Avisos como **troca de modelo (perda de cache)** e **modelo indisponível** aparecem em amarelo na prévia.
- O seletor permite **Automático**, **Planejar → executar** ou forçar um nível.
- Um botão repete o último pedido **um nível acima**.
- Se houver texto selecionado no editor, ele vai junto com o pedido.
- Comandos e alterações de arquivo que precisem de aprovação abrem uma janela com **Permitir / Permitir nesta sessão / Negar**.

## Níveis padrão

| Nível | Chave | Modelo | Esforço |
|---|---|---|---|
| simples | `simple` | `gpt-6-luna` | `low` |
| média | `medium` | `gpt-6.1-sol` | `medium` |
| complexa | `complex` | `gpt-6-astra` | `high` |
| planejador | `planner` | `gpt-6-astra` | `high` |

Nas configurações, os níveis usam as chaves em inglês. Os nomes antigos (`simples`, `media`, `complexa`) também são aceitos.

```json
"smartShift.tiers": {
  "simple":  { "model": "gpt-6-luna",  "effort": "low" },
  "medium":  { "model": "gpt-6.1-sol", "effort": "medium" },
  "complex": { "model": "gpt-6-astra", "effort": "high" }
},
"smartShift.planExecute": {
  "when": "complex",
  "planner": { "model": "gpt-6-astra", "effort": "high" },
  "executor": "medium",
  "autoExecute": false
},
"smartShift.signals": { "failedCommands": 2, "filesChanged": 8 }
```

## Configurações

| Configuração | Para quê |
|---|---|
| `smartShift.language` | Idioma do painel: `auto` (igual ao VS Code), `en` ou `pt-BR` |
| `smartShift.tiers` | Modelo e esforço de cada nível |
| `smartShift.planExecute` | `when`: `complex` ou `never`. `planner`: quem planeja. `executor`: nível que executa. `autoExecute`: executar sem confirmar |
| `smartShift.signals` | Limites que sobem o nível da conversa (`0` desliga) |
| `smartShift.developerInstructions` | Instruções extras para o Codex em cada conversa nova. Padrão no Windows: esperar mais pelos comandos em vez de consultar a cada segundo (cada consulta reenvia o histórico). `""` desliga |
| `smartShift.thresholds` | Pontos mínimos de cada nível (`{ "medium": 2, "complex": 5 }`) |
| `smartShift.extraComplexKeywords` | Palavras suas que indicam tarefa complexa (+3) |
| `smartShift.extraSimpleKeywords` | Palavras suas que indicam tarefa simples (−2) |
| `smartShift.codexPath` | Caminho do `codex`. Vazio = binário da extensão oficial do Codex, se instalada, senão `codex` no PATH |
| `smartShift.sandbox` | `read-only`, `workspace-write` (padrão) ou `danger-full-access` |
| `smartShift.approvalPolicy` | `untrusted`, `on-request` (padrão) ou `never` |

### Windows

No Windows, o Codex só consegue editar arquivos (`workspace-write`) depois que o **sandbox do Windows** é configurado. Sem ele, fica só leitura. O SmartShift verifica isso ao iniciar e oferece configurar, com ou sem permissão de administrador.

## Limitações

- O classificador usa regras fixas, sem modelo, e as palavras-chave são em português e inglês.
- O histórico do painel não é reaberto ao reiniciar o VS Code. A conversa continua disponível no chat oficial do Codex.
- Pedidos do servidor além de aprovar comandos e arquivos (perguntas ao usuário, elicitação de MCP) são recusados.
- Sem anexar imagens.

## Desenvolvimento

```sh
npm install
npm test          # compila e roda os testes (o de integração sobe o codex app-server real)
npm run package   # gera o .vsix
```

A estrutura do projeto, como acrescentar textos e regras do classificador e os passos para lançar uma versão estão em [CONTRIBUTING.pt-BR.md](CONTRIBUTING.pt-BR.md).
