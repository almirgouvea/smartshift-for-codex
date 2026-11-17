import * as vscode from "vscode";
import { setLocale, toLocale } from "./i18n";
import { RouterPanel } from "./panel";

/** Idioma: configuração `smartShift.language` ou, em "auto", o idioma do VS Code. */
function applyLocale(): void {
  const chosen = vscode.workspace.getConfiguration("smartShift").get<string>("language", "auto");
  setLocale(toLocale(chosen === "auto" ? vscode.env.language : chosen));
}

export function activate(context: vscode.ExtensionContext): void {
  applyLocale();
  const log = vscode.window.createOutputChannel("SmartShift");
  const panel = new RouterPanel(context, log);

  context.subscriptions.push(
    log,
    { dispose: () => panel.dispose() },
    vscode.window.registerWebviewViewProvider("smartShift.chat", panel, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand("smartShift.newThread", () => panel.newThread()),
    vscode.commands.registerCommand("smartShift.restartServer", () => panel.restart()),
    vscode.commands.registerCommand("smartShift.showLog", () => log.show()),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("smartShift.codexPath")) panel.restart();
      if (e.affectsConfiguration("smartShift.language")) {
        applyLocale();
        panel.reload();
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => panel.restart()),
  );
}

export function deactivate(): void {}
