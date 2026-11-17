# Tests and results

**English** · [Português](TESTING.pt-BR.md)

This document records how SmartShift was tested before version 1.0.0 and what was measured. The numbers come from the panel itself (model calls, tokens, cache) and from the Codex session logs (`~/.codex/sessions`).

Each test was run once, on a real machine. The numbers are indicative, not a controlled benchmark.

Versions 0.2.x were internal builds, under the working name "Codex Router", before the first public release (1.0.0).

## Environment

| | |
|---|---|
| System | Windows 10 Pro, portable VS Code |
| Codex | `codex-cli` 0.169.0 (`npm i -g @openai/codex`), ChatGPT account |
| Models | simple `gpt-6-luna` / `low`, medium `gpt-6.1-sol` / `medium`, complex and planner `gpt-6-astra` / `high` |
| Test project | a small Python RAG project (TF-IDF search and extractive answers), created by Codex itself in the first test |
| UI | Portuguese (the manual tests were done before the English translation). Prompts below are the original Portuguese ones, with a translation |

## Automated tests

`npm test` runs 34 tests:

- **Classifier and decision** (`src/test/router.test.ts`): simple, medium and complex tiers; steps, stack traces and selections; a conversation tier that never goes down; plan → execute; escalation signals; resolved errors not counting; unavailable model fallback; English and Portuguese texts; old tier names.
- **Integration** (`src/test/appServer.test.ts`): starts the real `codex app-server` and checks `initialize`, `account/read`, `model/list`, `thread/start`, the Windows sandbox and the unknown-method error. It only tests `turn/start` when logged out, so it never spends tokens.
- **Codex discovery** (`src/test/codexLocator.test.ts`): configured path, PATH, official extension in portable VS Code, Codex missing.

## Manual tests

### 1. Simple request

| Request | Expected | Result |
|---|---|---|
| `explique o conceito de rag e me traga um exemplo pratico…` (explain RAG with a practical example) | simple | ✅ simple, `gpt-6-luna`, −2 points · 15.8k tokens · 75% from cache |

### 2. Medium request, before and after the Windows instruction

Request: implement a RAG example in Python in `rag.py`.

| | v0.2.2 | v0.2.3 |
|---|---|---|
| Model calls | 40 | 5 |
| "Is it done yet?" polls (`wait`) | 33 | 0 |
| Tokens | 935.5k | 88k |
| Cache | 93% | 86% |
| Tier afterwards | went up to complex (false alarm) | medium ✅ |

The first command in the Windows sandbox took 25.8 s. In v0.2.2, Codex polled the result every second, and each poll resent the history. v0.2.3 sends an instruction telling it to wait longer. The first run also included the first-ever sandbox startup, so the comparison is not fully controlled.

### 3. Sequence in the same conversation

| # | Request | Expected | Result |
|---|---|---|---|
| 3a | `crie testes para o rag.py e rode os testes` (write tests for rag.py and run them) | simple on its own, kept at medium by the conversation | ✅ 1 point, kept at medium · 3 calls · 65.9k tokens · 90% from cache · 17 tests passed |
| 3b | `redesenhe a arquitetura do projeto para separar ingestão, busca e geração em módulos, migre o código existente e crie testes` (redesign into ingestion, search and generation modules, migrate the code, write tests) | plan with `gpt-6-astra`, execute with `gpt-6.1-sol` | ✅ 7 points. Plan: 2 calls · 61.9k tokens · 47% from cache (model switch). Execution: 6 calls · 265k tokens · 84% from cache · 23 tests passed |
| 3c | after the execution | tier stays medium | ❌ went up to complex because of "12 files changed". **Fixed in v0.2.4**: when executing a plan, the number of files doesn't count |

### 4. Full checklist (v0.2.4 and v0.2.5)

| # | Test | Expected | Result |
|---|---|---|---|
| 4.1 | `redesenhe a arquitetura para usar embeddings e migre a busca para um índice vetorial` (move search to embeddings and a vector index), new conversation | plan → execute | ✅ 6 points · plan: 6 calls · 119.6k tokens · 79% from cache |
| 4.2 | `o que faz a função de busca do rag.py` (what does the search function do) after the plan | kept at medium | ✅ −2 points, medium |
| 4.3 | Network approval during execution | Allow / Deny dialog | ✅ The sandbox blocked `pip`. Codex asked to query PyPI, download `uv` and install Python 3.12 in the project (`faiss-cpu` had no build for the machine's Python 3.15) |
| 4.4 | Interrupt the execution | "Request interrupted", tier doesn't go up | ✅ after 25 calls · 1.07M tokens · 91% from cache |
| 4.5 | Force simple: `adicione um comentário explicando a função principal` (add a comment to the main function) | uses `gpt-6-luna` | ✅ Manual · simple · `gpt-6-luna` |
| 4.6 | Force simple: `adicione suporte a arquivos .md na ingestão` (support .md files in ingestion) | loses the cache when switching models | ✅ 1 call · 58.4k tokens · **12% from cache**. In v0.2.5 the model-switch warning became visible in yellow in the preview (before, only on hover) |
| 4.7 | **Retry one tier up** on request 4.6 | same request on `gpt-6.1-sol` | ✅ 3 calls · 201.2k tokens · 93% from cache · 29 tests passed |
| 4.8 | Pasted stack trace (`Traceback… KeyError`) | medium | ✅ 2 points, "pasted stack trace (+2)" |
| 4.9 | 53 selected lines + `melhore isto` (improve this) | selection adds points and is sent along | ✅ "Selection included: rag.py:1-53", +1, kept at medium |
| 4.10 | `instale a biblioteca requests com pip…` (install requests with pip) | approval dialog | ✅ "Codex wants to run a command" with command, folder and reason |
| 4.11 | `smartShift.tiers.simple.model = "gpt-inexistente"` + `o que é um closure?` | falls back to the default model with a warning | ✅ simple · `gpt-6.1-sol`, warning "model "gpt-inexistente" not available, using "gpt-6.1-sol"" |

### 5. Installation

| Test | Result |
|---|---|
| Codex missing in portable VS Code | ✅ v0.2.1 shows "Install Codex / Choose executable / Try again" instead of a technical error |
| No folder open | ✅ asks to open the project folder |
| First sign-in | ✅ "Sign in with ChatGPT" opens the browser |
| English extension page and icon | ✅ checked in English VS Code with the 1.0.0 package |

## Problems found and fixed

| Version | Problem | Fix |
|---|---|---|
| 0.2.1 | "codex app-server exited during initialize" in portable VS Code: Codex not installed and no folder open | Finds Codex in the official extension, in portable VS Code and in the global npm folder. Shows install and choose-executable buttons. Asks to open a folder |
| 0.2.1 | Orphan `codex.exe` processes on Windows after closing | Kills the whole process tree (`taskkill /T /F`) |
| 0.2.2 | The tier only went up at the end of a request, and the panel looked stuck during slow commands | The tier goes up when the request starts. "Codex working · activity · time" indicator |
| 0.2.3 | False "2 failed commands" alarm (searches with no results that Codex resolved later) | Only failed commands in a row at the end of the request count |
| 0.2.3 | 935k tokens on a medium request because of per-second polling | Windows instruction to wait longer for commands, plus a model-call counter |
| 0.2.4 | Going up to complex after executing a large plan | When executing a plan, the number of files doesn't raise the tier |
| 0.2.5 | Cache-loss warning hidden in a tooltip | Warnings shown in yellow in the preview |

## Not yet tested manually

- The English panel end to end. Translations have automated tests, and the English extension page was checked.
- macOS and Linux. CI runs the automated tests on Ubuntu and Windows.
- Setting up the Windows sandbox through SmartShift's button. On the test machine it was already set up.
