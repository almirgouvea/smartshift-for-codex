# Contributing

**English** · [Português](CONTRIBUTING.pt-BR.md)

Issues and pull requests are welcome, in English or Portuguese.

## Setup

You need Node.js 24 and Codex (`npm i -g @openai/codex`, or the official Codex extension).

```sh
npm install
npm test          # builds and runs all tests
```

Press **F5** in VS Code to open a test window that loads only SmartShift and opens the `test-workspace` folder, where Codex can edit files without touching the extension's code. The first launch is slow (about 10 s) because of the debugger.

## Project structure

| Path | What it does |
|---|---|
| `src/extension.ts` | Activation: registers the panel and the commands, sets the language |
| `src/panel.ts` | The chat panel: picks the route for each request, keeps the conversation tier, runs plan → execute, handles Codex events and approvals |
| `src/router.ts` | Pure decision logic, with no VS Code dependency: `classify`, `decide`, `escalationSignals`, `resolveTier` |
| `src/i18n.ts` | English and Portuguese texts for the panel, the classifier and the instructions sent to Codex |
| `src/appServer.ts` | JSON-RPC client for `codex app-server` over stdio |
| `src/codexLocator.ts` | Finds the Codex executable (setting, official extension, PATH) |
| `media/main.js`, `media/main.css` | Panel UI (webview) |
| `package.nls.json`, `package.nls.pt-br.json` | Texts for commands and settings |
| `src/test/` | Unit tests and an integration test against the real `codex app-server` |
| `docs/TESTING.md` | Manual tests and measured results |

Code comments are in Portuguese.

## Common changes

**Classifier rules.** Edit `COMPLEX_RULES` or `SIMPLE_RULES` in `src/router.ts`. Rules use English and Portuguese word stems. Add a case to `src/test/router.test.ts`.

**Texts.** Add the key to both `en` and `pt` in `src/i18n.ts`. TypeScript fails if a key is missing in Portuguese, and a test fails if the `{parameters}` differ. Texts for commands and settings go in `package.nls.json` and `package.nls.pt-br.json`.

**Protocol.** To see every method and field of your Codex version:

```sh
npx codex app-server generate-json-schema --out .schema
```

## Tests

- `npm test` runs the unit tests and the integration test. The integration test starts the real `codex app-server`; it only starts a turn when you are logged out, so it never spends tokens.
- CI runs the same tests on Ubuntu and Windows for every push and pull request.
- For changes in behavior, also test by hand with the checklist in [docs/TESTING.md](docs/TESTING.md) and add the result there.

## Releasing

Where the extension is published and how each store was set up: [docs/PUBLISHING.md](docs/PUBLISHING.md).

1. Update `version` in `package.json` and add the changes to `CHANGELOG.md`.
2. `npm test`
3. `npm run package` builds `smartshift-for-codex-<version>.vsix`.
4. Test the package: uninstall SmartShift, install from the `.vsix`, and fully close and reopen VS Code (it caches the icon).
5. Publish the same `.vsix` in both stores. Only the maintainer can do this: publishing needs access to the `almirgouvea` publisher and namespace.
   - **Visual Studio Marketplace:** upload it at https://marketplace.visualstudio.com/manage/publishers/almirgouvea (**Update** on the extension's menu).
   - **Open VSX** (Cursor, Windsurf, VSCodium): with a publishing token from https://open-vsx.org/user-settings/tokens, in PowerShell:

     ```powershell
     $env:OVSX_PAT = "<token>"
     npx ovsx publish smartshift-for-codex-<version>.vsix
     ```
6. Commit, tag and push:

   ```sh
   git tag v<version>
   git push && git push --tags
   ```
