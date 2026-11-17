// Cliente JSON-RPC (JSONL via stdio) para `codex app-server`.
// Esquema de referência: `codex app-server generate-json-schema --out <dir>`.

import { ChildProcess, spawn, SpawnOptions } from "node:child_process";
import { EventEmitter } from "node:events";
import readline from "node:readline";
import { t } from "./i18n";

export type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

interface Pending {
  resolve: (v: Json) => void;
  reject: (e: Error) => void;
  method: string;
}

export interface AppServerEvents {
  notification: (method: string, params: Json) => void;
  serverRequest: (id: number | string, method: string, params: Json) => void;
  exit: (code: number | null) => void;
  log: (line: string) => void;
}

export class AppServerClient extends EventEmitter {
  private proc?: ChildProcess;
  private nextId = 1;
  private pending = new Map<number, Pending>();

  constructor(private readonly command: string, private readonly cwd: string) {
    super();
  }

  override on<E extends keyof AppServerEvents>(event: E, listener: AppServerEvents[E]): this {
    return super.on(event, listener);
  }

  async start(version: string): Promise<Json> {
    // No Windows, `codex` no PATH costuma ser um .cmd, que só roda via shell.
    const useShell = process.platform === "win32" && !/\.exe$/i.test(this.command);
    const cmd = useShell && /\s/.test(this.command) ? `"${this.command}"` : this.command;
    this.emit("log", `iniciando: ${cmd} app-server (cwd=${this.cwd})`);
    const opts: SpawnOptions = { cwd: this.cwd, stdio: "pipe", windowsHide: true };
    // Com shell, o comando vai inteiro numa string (args separados são concatenados sem escape).
    const proc: ChildProcess = useShell ? spawn(`${cmd} app-server`, { ...opts, shell: true }) : spawn(cmd, ["app-server"], opts);
    this.proc = proc;

    proc.stderr!.on("data", (d: Buffer) => this.emit("log", `[stderr] ${d.toString().trimEnd()}`));
    readline.createInterface({ input: proc.stdout! }).on("line", (line) => this.onLine(line));
    proc.on("exit", (code) => {
      this.emit("log", `codex app-server saiu (código ${code})`);
      for (const p of this.pending.values()) p.reject(new Error(t("server.exitedDuring", { method: p.method })));
      this.pending.clear();
      this.proc = undefined;
      this.emit("exit", code);
    });

    const spawned = new Promise<void>((resolve, reject) => {
      proc.once("spawn", () => resolve());
      proc.once("error", (e) => reject(new Error(t("server.spawnFailed", { cmd: this.command, error: e.message }))));
    });
    await spawned;

    const init = await this.request("initialize", {
      clientInfo: { name: "smartshift-for-codex", title: "SmartShift", version },
    });
    this.notify("initialized");
    return init;
  }

  get running(): boolean {
    return !!this.proc;
  }

  stop(): void {
    const proc = this.proc;
    this.proc = undefined;
    if (!proc) return;
    // Fechar a entrada já faz o app-server encerrar sozinho.
    proc.stdin?.end();
    if (process.platform === "win32" && proc.pid) {
      // Via shell a cadeia é cmd.exe → node → codex.exe, e kill() só derruba o cmd.exe.
      spawn("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }).on("error", () => proc.kill());
    } else {
      proc.kill();
    }
  }

  request<T = Json>(method: string, params: Json = {}): Promise<T> {
    if (!this.proc) return Promise.reject(new Error(t("server.notRunning")));
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.write({ id, method, params });
    });
  }

  notify(method: string, params?: Json): void {
    this.write(params === undefined ? { method } : { method, params });
  }

  respond(id: number | string, result: Json): void {
    this.write({ id, result });
  }

  respondError(id: number | string, message: string): void {
    this.write({ id, error: { code: -32601, message } });
  }

  private write(msg: Json): void {
    this.proc?.stdin?.write(JSON.stringify(msg) + "\n");
  }

  private onLine(line: string): void {
    if (!line.trim()) return;
    let msg: Json;
    try {
      msg = JSON.parse(line);
    } catch {
      this.emit("log", `[stdout não-JSON] ${line}`);
      return;
    }
    const hasId = msg.id !== undefined && msg.id !== null;
    if (hasId && msg.method === undefined) {
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message ?? JSON.stringify(msg.error)}`));
      else p.resolve(msg.result);
    } else if (hasId) {
      this.emit("serverRequest", msg.id, msg.method, msg.params);
    } else if (msg.method) {
      this.emit("notification", msg.method, msg.params);
    }
  }
}
