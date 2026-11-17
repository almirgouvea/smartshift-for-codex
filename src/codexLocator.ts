import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { t } from "./i18n";

export class CodexNotFoundError extends Error {
  constructor() {
    super(t("codex.notFound"));
  }
}

/**
 * Decide qual executável do Codex usar:
 * 1. a configuração `smartShift.codexPath` (aceita ${workspaceFolder});
 * 2. o binário embutido na extensão oficial do Codex (openai.chatgpt), se instalada;
 * 3. `codex` no PATH ou na pasta global do npm.
 * Lança CodexNotFoundError se nada for encontrado.
 */
export function locateCodex(configured: string, workspaceFolder: string | undefined, officialExtensionPath?: string): string {
  if (configured.trim()) {
    return configured.replace(/\$\{workspaceFolder\}/g, workspaceFolder ?? "").trim();
  }
  const exe = process.platform === "win32" ? "codex.exe" : "codex";
  if (officialExtensionPath) {
    const found = findFile(officialExtensionPath, exe, 4);
    if (found) return found;
  }
  const bundled = findOfficialExtensionBinary(exe);
  if (bundled) return bundled;
  const onPath = findOnPath();
  if (onPath) return onPath;
  throw new CodexNotFoundError();
}

function findOnPath(): string | undefined {
  const names = process.platform === "win32" ? ["codex.cmd", "codex.exe", "codex.bat"] : ["codex"];
  const dirs = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  // Pasta global do npm, caso não esteja no PATH do VS Code.
  if (process.platform === "win32" && process.env.APPDATA) dirs.push(path.join(process.env.APPDATA, "npm"));
  else dirs.push("/usr/local/bin", path.join(os.homedir(), ".npm-global", "bin"));
  for (const dir of dirs) {
    for (const name of names) {
      const full = path.join(dir, name);
      if (isFile(full)) return full;
    }
  }
  return undefined;
}

function findOfficialExtensionBinary(exe: string): string | undefined {
  const roots = [".vscode", ".vscode-insiders", ".cursor", ".windsurf"].map((d) => path.join(os.homedir(), d, "extensions"));
  // VS Code portátil guarda as extensões em <pasta>/data/extensions.
  if (process.env.VSCODE_PORTABLE) roots.unshift(path.join(process.env.VSCODE_PORTABLE, "extensions"));
  for (const root of roots) {
    let entries: string[];
    try {
      entries = fs.readdirSync(root);
    } catch {
      continue;
    }
    // Versão mais nova primeiro.
    const exts = entries.filter((e) => e.startsWith("openai.chatgpt-")).sort().reverse();
    for (const ext of exts) {
      const found = findFile(path.join(root, ext), exe, 4);
      if (found) return found;
    }
  }
  return undefined;
}

function isFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function findFile(dir: string, name: string, depth: number): string | undefined {
  if (depth < 0) return undefined;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return undefined;
  }
  for (const e of entries) if (e.isFile() && e.name === name) return path.join(dir, e.name);
  for (const e of entries) {
    if (e.isDirectory() && e.name !== "node_modules") {
      const r = findFile(path.join(dir, e.name), name, depth - 1);
      if (r) return r;
    }
  }
  return undefined;
}
