# Testes e resultados

[English](TESTING.md) · **Português**

Este documento registra como o SmartShift foi testado antes da versão 1.0.0 e o que foi medido. Os números vêm do próprio painel (chamadas ao modelo, tokens, cache) e dos registros de sessão do Codex (`~/.codex/sessions`).

Cada teste foi feito uma vez, numa máquina real. Os números são indicativos, não um benchmark controlado.

## Ambiente

| | |
|---|---|
| Sistema | Windows 10 Pro, VS Code portátil |
| Codex | `codex-cli` 0.169.0 (`npm i -g @openai/codex`), conta do ChatGPT |
| Modelos | simples `gpt-6-luna` / `low`, média `gpt-6.1-sol` / `medium`, complexa e planejador `gpt-6-astra` / `high` |
| Projeto de teste | um pequeno projeto Python de RAG (busca TF-IDF e resposta extrativa), criado pelo próprio Codex no primeiro teste |
| Interface | português (os testes manuais foram feitos antes da tradução para o inglês) |

## Testes automáticos

`npm test` roda 34 testes:

- **Classificador e decisão** (`src/test/router.test.ts`): níveis simples, média e complexa; etapas, stack trace e seleção; nível da conversa que não desce; planejar → executar; sinais de subida; erros resolvidos que não contam; troca de modelo indisponível; textos em inglês e português; nomes antigos dos níveis.
- **Integração** (`src/test/appServer.test.ts`): sobe o `codex app-server` real e confere `initialize`, `account/read`, `model/list`, `thread/start`, o sandbox do Windows e o erro de método desconhecido. Só testa `turn/start` sem login, para não gastar tokens.
- **Localização do Codex** (`src/test/codexLocator.test.ts`): caminho configurado, PATH, extensão oficial no VS Code portátil, Codex ausente.

## Testes manuais

### 1. Pedido simples

| Pedido | Esperado | Resultado |
|---|---|---|
| `explique o conceito de rag e me traga um exemplo pratico…` | simples | ✅ simples, `gpt-6-luna`, −2 pontos · 15,8 mil tokens · 75% do cache |

### 2. Pedido médio, antes e depois da instrução do Windows

Pedido: implementar um exemplo de RAG em Python no `rag.py`.

| | v0.2.2 | v0.2.3 |
|---|---|---|
| Chamadas ao modelo | 40 | 5 |
| Consultas "já terminou?" (`wait`) | 33 | 0 |
| Tokens | 935,5 mil | 88 mil |
| Cache | 93% | 86% |
| Nível depois | subiu para complexa (falso alarme) | média ✅ |

O primeiro comando no sandbox do Windows levou 25,8 s. Na v0.2.2, o Codex consultava o resultado a cada segundo, e cada consulta reenviava o histórico. A v0.2.3 manda uma instrução para ele esperar mais. A primeira execução também incluiu a primeira inicialização do sandbox, então a comparação não é totalmente controlada.

### 3. Sequência na mesma conversa

| # | Pedido | Esperado | Resultado |
|---|---|---|---|
| 3a | `crie testes para o rag.py e rode os testes` | sozinho daria simples, mas a conversa mantém média | ✅ 1 ponto, mantido em média · 3 chamadas · 65,9 mil tokens · 90% do cache · 17 testes passaram |
| 3b | `redesenhe a arquitetura do projeto para separar ingestão, busca e geração em módulos, migre o código existente e crie testes` | planejar com `gpt-6-astra`, executar com `gpt-6.1-sol` | ✅ 7 pontos. Plano: 2 chamadas · 61,9 mil tokens · 47% do cache (troca de modelo). Execução: 6 chamadas · 265 mil tokens · 84% do cache · 23 testes passaram |
| 3c | depois da execução | nível continua média | ❌ subiu para complexa por "12 arquivos alterados". **Corrigido na v0.2.4**: ao executar um plano, a quantidade de arquivos não conta |

### 4. Roteiro completo (v0.2.4 e v0.2.5)

| # | Teste | Esperado | Resultado |
|---|---|---|---|
| 4.1 | `redesenhe a arquitetura para usar embeddings e migre a busca para um índice vetorial`, numa conversa nova | planejar → executar | ✅ 6 pontos · plano: 6 chamadas · 119,6 mil tokens · 79% do cache |
| 4.2 | `o que faz a função de busca do rag.py` depois do plano | mantido em média | ✅ −2 pontos, média |
| 4.3 | Aprovação de rede durante a execução | janela Permitir / Negar | ✅ O sandbox bloqueou o `pip`. O Codex pediu permissão para consultar o PyPI, baixar o `uv` e instalar Python 3.12 no projeto (o `faiss-cpu` não tinha versão para o Python 3.15 da máquina) |
| 4.4 | Interromper a execução | "Pedido interrompido", nível não sobe | ✅ depois de 25 chamadas · 1,07 milhão de tokens · 91% do cache |
| 4.5 | Forçar simples: `adicione um comentário explicando a função principal` | usa `gpt-6-luna` | ✅ Manual · simples · `gpt-6-luna` |
| 4.6 | Forçar simples: `adicione suporte a arquivos .md na ingestão` | perde o cache ao trocar de modelo | ✅ 1 chamada · 58,4 mil tokens · **12% do cache**. Na v0.2.5, o aviso de troca de modelo passou a aparecer em amarelo na prévia (antes só aparecia passando o mouse) |
| 4.7 | **Repetir com nível média** no pedido 4.6 | mesmo pedido no `gpt-6.1-sol` | ✅ 3 chamadas · 201,2 mil tokens · 93% do cache · 29 testes passaram |
| 4.8 | Stack trace colado (`Traceback… KeyError`) | média | ✅ 2 pontos, "stack trace colado (+2)" |
| 4.9 | 53 linhas selecionadas + `melhore isto` | seleção soma pontos e vai junto | ✅ "Seleção incluída: rag.py:1-53", +1, mantido em média |
| 4.10 | `instale a biblioteca requests com pip…` | janela de aprovação | ✅ "O Codex quer executar um comando" com comando, pasta e motivo |
| 4.11 | `smartShift.tiers.simple.model = "gpt-inexistente"` + `o que é um closure?` | usa o modelo padrão e avisa | ✅ simples · `gpt-6.1-sol`, aviso "modelo "gpt-inexistente" indisponível, usando "gpt-6.1-sol"" |

### 5. Instalação

| Teste | Resultado |
|---|---|
| Codex ausente no VS Code portátil | ✅ v0.2.1 mostra "Instalar o Codex / Escolher executável / Tentar de novo" em vez de um erro técnico |
| Sem pasta aberta | ✅ pede para abrir a pasta do projeto |
| Primeiro login | ✅ botão "Entrar com ChatGPT" abre o navegador |
| Página da extensão em inglês e ícone | ✅ conferidos no VS Code em inglês com o pacote 1.0.0 |

## Problemas encontrados e corrigidos

| Versão | Problema | Correção |
|---|---|---|
| 0.2.1 | "codex app-server encerrou durante initialize" no VS Code portátil: Codex não instalado e nenhuma pasta aberta | Localiza o Codex na extensão oficial, no VS Code portátil e na pasta global do npm. Mostra botões de instalar e escolher executável. Pede para abrir uma pasta |
| 0.2.1 | Processos `codex.exe` órfãos no Windows ao fechar | Encerra a árvore de processos inteira (`taskkill /T /F`) |
| 0.2.2 | O nível só subia no fim do pedido, e o painel parecia parado durante comandos lentos | O nível sobe quando o pedido começa. Indicador "Codex trabalhando · atividade · tempo" |
| 0.2.3 | Falso alarme de "2 comandos com erro" (buscas sem resultado que o Codex resolveu depois) | Conta só os erros seguidos no fim do pedido |
| 0.2.3 | 935 mil tokens num pedido médio por consultas a cada segundo | Instrução no Windows para esperar mais pelos comandos, e contador de chamadas ao modelo |
| 0.2.4 | Subir para complexa depois de executar um plano grande | Ao executar um plano, a quantidade de arquivos não sobe o nível |
| 0.2.5 | Aviso de perda de cache escondido no tooltip | Avisos visíveis em amarelo na prévia |

## Ainda não testado manualmente

- Painel em inglês, ponta a ponta. As traduções têm testes automáticos, e a página da extensão em inglês foi conferida.
- macOS e Linux. O CI roda os testes automáticos no Ubuntu e no Windows.
- Configuração do sandbox do Windows pelo botão do SmartShift. Na máquina de teste, o sandbox já tinha sido configurado.
