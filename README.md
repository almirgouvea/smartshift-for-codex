# SmartShift for Codex

**English** · [Português](README.pt-BR.md)

[![Marketplace](https://vsmarketplacebadges.dev/version-short/almirgouvea.smartshift-for-codex.svg)](https://marketplace.visualstudio.com/items?itemName=almirgouvea.smartshift-for-codex) [![CI](https://img.shields.io/github/actions/workflow/status/almirgouvea/smartshift-for-codex/ci.yml?branch=main&label=CI)](https://github.com/almirgouvea/smartshift-for-codex/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Picks the Codex model and reasoning effort for **each request** based on how complex it is, **without spending tokens to decide**.

Simple questions go to a light model. Big tasks go to a strong model, which writes a plan first and hands execution to a mid-tier model. You don't have to switch models by hand.

> **Unofficial** extension, not affiliated with OpenAI. "Codex" is a trademark of OpenAI.

## Requirements

- **Codex** installed: the official Codex extension for VS Code or the CLI (`npm i -g @openai/codex`). If neither is found, SmartShift offers to install it.
- A ChatGPT account with Codex access. On first use, click **Sign in with ChatGPT** in the panel. The login is stored in `~/.codex` and is shared with the official extension and the CLI.
- A folder open in VS Code.

## How to use

1. Click the **SmartShift** icon in the activity bar.
2. Type your request. While you type, **"Will use: …"** shows which model will run it and why.
3. Send with **Ctrl+Enter**.

After each request you see the model used, the number of model calls, the tokens spent and how much of the input came from the cache.

Conversations are saved in the regular Codex history, so you can also continue one in the official Codex chat.

The panel follows the VS Code display language (English or Portuguese). To force one, set `smartShift.language`.

## How much it saves

The same medium-complexity request, measured in the Codex session logs on Windows:

| | Without SmartShift's rules | With SmartShift |
|---|---|---|
| Model calls | 40 | 5 |
| Tokens | 935k | 88k |

Most of the difference came from one instruction that makes Codex wait for commands to finish instead of polling every second (see `smartShift.developerInstructions`).

Every manual test and its numbers are in [docs/TESTING.md](docs/TESTING.md).

## How it decides

Every decision is local: rules on the request text and on events Codex already sends. No extra model calls.

1. **Request classification.** Adds up points for:
   - request length;
   - words such as *architecture, migrate, race condition, refactor, implement, debug* (up) and *explain, rename, comment, format* (down), in English and Portuguese;
   - a list with several steps, several files mentioned, a pasted stack trace, a large selection in the editor.

   Score ≥ 5 → **complex**, ≥ 2 → **medium**, below → **simple**.
2. **Conversation tier.** The tier only **goes up** within a conversation and resets to *simple* in a new conversation. Reason: the prompt cache is per model, and switching models makes Codex reprocess the whole history at full price. A simple request in the middle of a *medium* conversation stays on the *medium* model.
3. **Plan → execute.** When the request itself is *complex*, the strong model (`gpt-6-astra`) only writes the plan, in read-only mode. Then you click **Execute plan** and the mid-tier model (`gpt-6.1-sol`) carries it out. The plan is already in the history, so the cheaper model gets it at no extra cost.
4. **Signals after each request.** The **next** requests in the conversation go up one tier if the request:
   - failed;
   - ended with 2 or more failed commands in a row (errors Codex fixed later, like a search with no results, don't count);
   - failed to apply changes;
   - changed 8 or more files. When executing a plan this doesn't count, because the size was already planned.
5. **Your account's models.** The configured model is checked against the models on your account. If it doesn't exist, SmartShift uses the Codex default and shows a warning in the preview. If the effort isn't supported, it uses the model's default effort.

In the panel:

- The top shows the **conversation tier**. Hover to see why it went up.
- Warnings such as **model switch (cache loss)** and **model not available** show in yellow in the preview.
- The selector offers **Automatic**, **Plan → execute** or forcing a tier.
- A button retries the last request **one tier up**.
- If text is selected in the editor, it is sent along with the request.
- Commands and file changes that need approval open a dialog with **Allow / Allow for this session / Deny**.

## Default tiers

| Tier | Model | Effort |
|---|---|---|
| `simple` | `gpt-6-luna` | `low` |
| `medium` | `gpt-6.1-sol` | `medium` |
| `complex` | `gpt-6-astra` | `high` |
| planner | `gpt-6-astra` | `high` |

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

## Settings

| Setting | Purpose |
|---|---|
| `smartShift.language` | Panel language: `auto` (same as VS Code), `en` or `pt-BR` |
| `smartShift.tiers` | Model and effort for each tier |
| `smartShift.planExecute` | `when`: `complex` or `never`. `planner`: who plans. `executor`: tier that executes. `autoExecute`: execute without asking |
| `smartShift.signals` | Limits that raise the conversation tier (`0` disables) |
| `smartShift.developerInstructions` | Extra instructions for Codex in every new conversation. Default on Windows: wait longer for commands instead of polling every second (each poll resends the history). `""` disables |
| `smartShift.thresholds` | Minimum score for each tier (`{ "medium": 2, "complex": 5 }`) |
| `smartShift.extraComplexKeywords` | Your own words that indicate a complex task (+3) |
| `smartShift.extraSimpleKeywords` | Your own words that indicate a simple task (−2) |
| `smartShift.codexPath` | Path to `codex`. Empty = the official Codex extension's binary if installed, otherwise `codex` on PATH |
| `smartShift.sandbox` | `read-only`, `workspace-write` (default) or `danger-full-access` |
| `smartShift.approvalPolicy` | `untrusted`, `on-request` (default) or `never` |

### Windows

On Windows, Codex can only edit files (`workspace-write`) after the **Windows sandbox** is set up. Without it, Codex is read-only. SmartShift checks this on startup and offers to set it up, with or without admin rights.

## Limitations

- The classifier uses fixed rules, not a model. Keywords are in English and Portuguese.
- The panel history is not restored after restarting VS Code. The conversation is still available in the official Codex chat.
- Server requests other than approving commands and file changes (questions to the user, MCP elicitation) are declined.
- No image attachments.

## Development

```sh
npm install
npm test          # builds and runs the tests (the integration test starts the real codex app-server)
npm run package   # builds the .vsix
```

Project structure, how to add texts and classifier rules, and the release steps are in [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
