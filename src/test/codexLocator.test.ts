import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CodexNotFoundError, locateCodex } from "../codexLocator";

function withEnv(env: Record<string, string | undefined>, fn: () => void): void {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) {
    saved[k] = process.env[k];
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
  try {
    fn();
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

const exeName = process.platform === "win32" ? "codex.cmd" : "codex";
const empty = fs.mkdtempSync(path.join(os.tmpdir(), "codex-locator-empty-"));

test("configuração explícita vence e aceita ${workspaceFolder}", () => {
  assert.equal(locateCodex("${workspaceFolder}/bin/codex", "C:/proj"), "C:/proj/bin/codex");
});

test("sem Codex em lugar nenhum lança CodexNotFoundError (o caso do VS Code portátil sem Codex)", () => {
  withEnv({ PATH: empty, APPDATA: empty, VSCODE_PORTABLE: empty, HOME: empty, USERPROFILE: empty }, () => {
    assert.throws(() => locateCodex("", "C:/proj"), CodexNotFoundError);
  });
});

test("encontra o codex no PATH", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-locator-path-"));
  const exe = path.join(dir, exeName);
  fs.writeFileSync(exe, "");
  withEnv({ PATH: dir, APPDATA: empty, VSCODE_PORTABLE: empty, HOME: empty, USERPROFILE: empty }, () => {
    assert.equal(locateCodex("", "C:/proj"), exe);
  });
});

test("encontra o binário da extensão oficial no VS Code portátil", () => {
  const portable = fs.mkdtempSync(path.join(os.tmpdir(), "codex-locator-portable-"));
  const bin = path.join(portable, "extensions", "openai.chatgpt-1.0.0", "bin", "windows-x86_64");
  fs.mkdirSync(bin, { recursive: true });
  const exe = path.join(bin, process.platform === "win32" ? "codex.exe" : "codex");
  fs.writeFileSync(exe, "");
  withEnv({ PATH: empty, APPDATA: empty, VSCODE_PORTABLE: portable, HOME: empty, USERPROFILE: empty }, () => {
    assert.equal(locateCodex("", "C:/proj"), exe);
  });
});
