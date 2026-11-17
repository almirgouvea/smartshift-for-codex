import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { AppServerClient } from "../appServer";

// Usa o Codex instalado como devDependency. Pula se não estiver instalado.
const root = path.resolve(__dirname, "..", "..");
const bin = path.join(root, "node_modules", ".bin", process.platform === "win32" ? "codex.cmd" : "codex");

test("conversa com o codex app-server real", { skip: !fs.existsSync(bin) && "codex não instalado", timeout: 60_000 }, async () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "smartshift-for-codex-test-"));
  const client = new AppServerClient(bin, cwd);
  try {
    const init = await client.start("0.0.0-test");
    assert.ok(init.userAgent, "initialize devolve userAgent");

    const acc = await client.request("account/read", {});
    assert.ok("account" in acc);

    const models = await client.request("model/list", {});
    assert.ok(Array.isArray(models.data) && models.data.length > 0, "há modelos");
    for (const m of models.data) {
      assert.equal(typeof m.id, "string");
      assert.ok(Array.isArray(m.supportedReasoningEfforts));
    }

    const thread = await client.request("thread/start", { cwd, sandbox: "workspace-write", approvalPolicy: "on-request", ephemeral: true });
    assert.equal(typeof thread.thread.id, "string");
    // No Windows sem o sandbox configurado, workspace-write vira readOnly; nos dois casos vem uma política.
    assert.ok(["workspaceWrite", "readOnly"].includes(thread.sandbox?.type), "thread/start devolve a política de sandbox");
    if (process.platform === "win32") {
      const ready = await client.request("windowsSandbox/readiness", {});
      assert.ok(["ready", "notConfigured", "updateRequired"].includes(ready.status));
    }

    // Os parâmetros que a extensão manda em cada turno são aceitos pelo servidor
    // (sem login o turno começa e depois falha na autenticação; por isso é interrompido).
    // Com login o turno iria de verdade ao modelo e gastaria tokens, então essa parte é pulada.
    const turnChecks = acc.account ? [] : [{ type: "readOnly" }, thread.sandbox];
    for (const sandboxPolicy of turnChecks) {
      const model = models.data[0];
      const turn = await client.request("turn/start", {
        threadId: thread.thread.id,
        input: [{ type: "text", text: "teste" }],
        model: model.id,
        effort: model.defaultReasoningEffort,
        sandboxPolicy,
      });
      assert.equal(typeof turn.turn.id, "string");
      // Escuta antes de interromper: o turn/completed pode chegar antes da resposta do interrupt.
      const completed = new Promise<string>((resolve) => {
        const onN = (method: string, p: { turn?: { id?: string; status?: string } }) => {
          if (method === "turn/completed" && p.turn?.id === turn.turn.id) {
            client.off("notification", onN);
            resolve(String(p.turn?.status));
          }
        };
        client.on("notification", onN);
      });
      await client.request("turn/interrupt", { threadId: thread.thread.id, turnId: turn.turn.id });
      const status = await Promise.race([completed, new Promise<string>((r) => setTimeout(() => r("timeout"), 20_000))]);
      assert.notEqual(status, "timeout", "turno interrompido termina");
    }

    await assert.rejects(client.request("metodo/inexistente", {}), /metodo\/inexistente/);
  } finally {
    client.stop();
  }
});
