# Publishing

**English** · [Português](PUBLISHING.pt-BR.md)

Where SmartShift is published, how each store was set up, and what is still pending. The release steps for new versions are in [CONTRIBUTING.md](../CONTRIBUTING.md#releasing).

## Status

| Where | Status | Link |
|---|---|---|
| Visual Studio Marketplace | ✅ 1.0.0 published and verified on 2026-11-16 | [almirgouvea.smartshift-for-codex](https://marketplace.visualstudio.com/items?itemName=almirgouvea.smartshift-for-codex) |
| GitHub | ✅ public repository, CI passing on Ubuntu and Windows, tag `v1.0.0` | [almirgouvea/smartshift-for-codex](https://github.com/almirgouvea/smartshift-for-codex) |
| Open VSX | ✅ 1.0.0 uploaded on 2026-11-16, active with a verified namespace since 2026-11-17 | [almirgouvea/smartshift-for-codex](https://open-vsx.org/extension/almirgouvea/smartshift-for-codex) |

## Visual Studio Marketplace

- Publisher `almirgouvea`, created at https://marketplace.visualstudio.com/manage with a Microsoft account. Only members of this publisher can publish.
- Version 1.0.0 was uploaded by hand (**New extension → Visual Studio Code**, dragging the `.vsix`). The automatic verification took a few minutes.
- No token was created. Uploading by hand doesn't need one.

## GitHub

- Repository `almirgouvea/smartshift-for-codex`, public, MIT license.
- Commits use the GitHub no-reply e-mail, so no personal e-mail is public.
- The *About* section has the description, the Marketplace link and the topics `vscode-extension`, `codex`, `openai`, `llm`, `model-routing`, `ai-coding`, `token-optimization`, `typescript`.
- CI (`.github/workflows/ci.yml`) runs the tests on Ubuntu and Windows for every push and pull request and keeps the built `.vsix` as an artifact. It does not publish.

## Open VSX

Open VSX is the store used by Cursor, Windsurf, VSCodium and other editors that can't use the Microsoft Marketplace.

What was done:

1. Signed in at https://open-vsx.org with GitHub (`almirgouvea`).
2. Created an Eclipse Foundation account and linked it to the same GitHub account.
3. Signed the Open VSX Publisher Agreement (**Profile → Log in with Eclipse**).
4. Created the `almirgouvea` namespace on the website (**Namespaces → +**).
5. Created a **publishing-only** access token. It can publish versions, but can't create namespaces, delete extensions or change the account.
6. Published from PowerShell:

   ```powershell
   $env:OVSX_PAT = "<token>"
   npx ovsx publish smartshift-for-codex-1.0.0.vsix
   ```

Namespace verification (done on 2026-11-17):

- After publishing, Open VSX found that `almirgouvea` already exists in another store (the Microsoft Marketplace), so the extension stayed **inactive** until the Open VSX team confirmed the namespace belongs to the same owner.
- The ownership claim was made with **Claim Ownership** on the extension page, which opens an issue at https://github.com/EclipseFdn/open-vsx.org/issues. The evidence sent: the namespace, the GitHub user, the repository and the Marketplace publisher are all `almirgouvea`, with links to the repository, a commit by this user, `package.json` and the Marketplace page.
- The claim was approved the next day. The extension became active without publishing again, and the Open VSX API now reports the namespace as verified.

Next versions are published with the same token and command; the namespace stays verified.

## Tokens

- Tokens are never stored in the repository or pasted in issues or chats.
- In PowerShell, `$env:OVSX_PAT` only lasts while that terminal is open.
- For automatic publishing later, Open VSX offers **Trusted Publishers**: the GitHub Actions workflow authenticates with a short-lived token at publish time, so no secret needs to be stored. The Marketplace can be automated with a token saved as a GitHub secret. GitHub doesn't give secrets to pull requests from forks.
