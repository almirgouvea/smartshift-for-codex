import * as vscode from "vscode";
import { AppServerClient, Json } from "./appServer";
import { CodexNotFoundError, locateCodex } from "./codexLocator";
import { dictionary, getLocale, t, tierLabel } from "./i18n";
import {
  classify,
  decide,
  defaultWindowsInstructions,
  trackCommand,
  escalationSignals,
  signalsForTurn,
  executePrompt,
  maxTier,
  ModelInfo,
  nextTier,
  normalizeTierKeys,
  Override,
  planInstructions,
  PlanWhen,
  resolveTier,
  RouterConfig,
  SignalConfig,
  Tier,
  TierName,
  TIER_ORDER,
  toTierName,
  TurnStats,
} from "./router";

const DEFAULT_TIERS: Record<TierName, Tier> = {
  simple: { model: "gpt-6-luna", effort: "low" },
  medium: { model: "gpt-6.1-sol", effort: "medium" },
  complex: { model: "gpt-6-astra", effort: "high" },
};

interface Route {
  tier: TierName;
  model: string;
  effort: string;
  auto: boolean;
  /** Presente no modo planejar → executar: quem planeja. */
  plan?: { model: string; effort: string };
  score?: number;
  reasons: string[];
  notes: string[];
}

interface Selection {
  label: string;
  block: string;
  lines: number;
}

interface TokenTotals {
  inputTokens: number;
  cachedInputTokens: number;
  totalTokens: number;
}

interface ThreadState {
  id: string;
  /** Nível mínimo da conversa. Só sobe; volta a "simple" numa conversa nova. */
  floor: TierName;
  floorReasons: string[];
  lastModel?: string;
  /** Política de sandbox da conversa, para restaurar depois de um turno de planejamento (só leitura). */
  sandbox: Json;
  totals?: TokenTotals;
}

type TurnKind = "normal" | "plan" | "execute";

interface TurnState {
  id?: string;
  kind: TurnKind;
  tier: TierName;
  model: string;
  forced: boolean;
  stats: TurnStats;
  startTotals?: TokenTotals;
  /** Chamadas ao modelo neste pedido (uma atualização de uso de tokens por chamada). */
  modelCalls: number;
}

interface PendingPlan {
  tier: TierName;
  model: string;
  effort: string;
}

interface PlanExecuteConfig {
  when: PlanWhen;
  planner: Tier;
  executor: TierName;
  autoExecute: boolean;
}

export class RouterPanel implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private client?: AppServerClient;
  private starting?: Promise<void>;
  private models: ModelInfo[] = [];
  private thread?: ThreadState;
  private turn?: TurnState;
  private pendingPlan?: PendingPlan;
  private lastPrompt?: { text: string; tier: TierName };
  private lastStatus?: Json;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly log: vscode.OutputChannel,
  ) {}

  // ---------- Webview ----------

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    const media = vscode.Uri.joinPath(this.context.extensionUri, "media");
    view.webview.options = { enableScripts: true, localResourceRoots: [media] };
    view.webview.html = this.html(view.webview, media);
    view.webview.onDidReceiveMessage((m) => this.onMessage(m).catch((e) => this.fail(e)));
  }

  private post(msg: Json): void {
    if (msg.type === "status") this.lastStatus = msg;
    void this.view?.webview.postMessage(msg);
  }

  /** Redesenha o painel (ex.: troca de idioma). A conversa recomeça. */
  reload(): void {
    if (!this.view) return;
    this.newThread();
    this.view.webview.html = this.html(this.view.webview, vscode.Uri.joinPath(this.context.extensionUri, "media"));
  }

  private async onMessage(m: Json): Promise<void> {
    switch (m.type) {
      case "ready":
        this.postFloor();
        if (this.lastStatus) this.post(this.lastStatus);
        await this.ensureServer();
        break;
      case "preview":
        this.post({ type: "preview", route: this.route(m.text ?? "", m.override as Override, this.selection()) });
        break;
      case "send":
        await this.send(String(m.text ?? ""), m.override as Override);
        break;
      case "executePlan":
        await this.executePlan();
        break;
      case "discardPlan":
        this.pendingPlan = undefined;
        break;
      case "escalate":
        await this.escalate();
        break;
      case "interrupt":
        await this.interrupt();
        break;
      case "newThread":
        this.newThread();
        break;
      case "login":
        await this.login();
        break;
      case "showLog":
        this.log.show();
        break;
      case "installCodex":
        this.installCodex();
        break;
      case "pickCodex":
        await this.pickCodex();
        break;
      case "retry":
        this.restart();
        break;
      case "openFolder":
        await vscode.commands.executeCommand("workbench.action.files.openFolder");
        break;
    }
  }

  // ---------- Servidor ----------

  async ensureServer(): Promise<void> {
    if (this.client?.running) return;
    if (!this.starting) this.starting = this.startServer().finally(() => (this.starting = undefined));
    return this.starting;
  }

  private async startServer(): Promise<void> {
    const cfg = vscode.workspace.getConfiguration("smartShift");
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    // Sem pasta aberta o Codex trabalharia numa pasta qualquer (ex.: a do próprio VS Code).
    if (!folder) {
      this.post({
        type: "status",
        state: "error",
        message: t("status.noFolder"),
        actions: [{ label: t("action.openFolder"), type: "openFolder" }],
      });
      return;
    }

    let command: string;
    try {
      command = locateCodex(cfg.get<string>("codexPath", ""), folder, vscode.extensions.getExtension("openai.chatgpt")?.extensionPath);
    } catch (e) {
      if (!(e instanceof CodexNotFoundError)) throw e;
      this.log.appendLine("Codex not found: no smartShift.codexPath, no official extension and no codex on PATH.");
      this.post({
        type: "status",
        state: "error",
        message: t("status.notInstalled"),
        actions: [
          { label: t("action.installCodex"), type: "installCodex" },
          { label: t("action.pickCodex"), type: "pickCodex" },
          { label: t("action.retry"), type: "retry" },
        ],
      });
      return;
    }
    this.post({ type: "status", state: "starting", message: t("status.starting", { cmd: command }) });

    const client = new AppServerClient(command, folder);
    client.on("log", (l) => this.log.appendLine(l));
    client.on("notification", (method, params) => this.onNotification(method, params));
    client.on("serverRequest", (id, method, params) => void this.onServerRequest(id, method, params));
    client.on("exit", () => {
      if (this.client === client) {
        this.client = undefined;
        this.thread = undefined;
        this.turn = undefined;
        this.pendingPlan = undefined;
        this.postFloor();
        this.post({ type: "status", state: "error", message: t("status.exited") });
        this.post({ type: "busy", busy: false });
      }
    });

    try {
      await client.start(String(this.context.extension.packageJSON.version ?? "0.0.0"));
    } catch (e) {
      client.stop();
      this.log.appendLine(`ERROR: ${(e as Error).message}`);
      this.post({
        type: "status",
        state: "error",
        message: t("status.startFailed", { cmd: command, error: (e as Error).message }),
        actions: [
          { label: t("action.pickCodex"), type: "pickCodex" },
          { label: t("action.retry"), type: "retry" },
          { label: t("action.showLog"), type: "showLog" },
        ],
      });
      return;
    }
    this.client = client;
    await this.refreshAccount();
    void this.checkWindowsSandbox().catch((e) => this.log.appendLine(`windows sandbox: ${(e as Error).message}`));
  }

  /** No Windows, `workspace-write` só funciona com o sandbox do Windows configurado; sem ele o Codex fica só leitura. */
  private async checkWindowsSandbox(): Promise<void> {
    if (process.platform !== "win32" || this.cfg().get("sandbox", "workspace-write") !== "workspace-write") return;
    const res = await this.client!.request("windowsSandbox/readiness", {});
    this.log.appendLine(`windows sandbox: ${res.status}`);
    if (res.status === "ready") return;
    const elevated = t("sandbox.elevated");
    const unelevated = t("sandbox.unelevated");
    const choice = await vscode.window.showWarningMessage(
      res.status === "updateRequired" ? t("sandbox.updateRequired") : t("sandbox.notConfigured"),
      elevated,
      unelevated,
      t("sandbox.notNow"),
    );
    if (choice !== elevated && choice !== unelevated) return;
    await this.client!.request("windowsSandbox/setupStart", {
      mode: choice === elevated ? "elevated" : "unelevated",
      cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null,
    });
    this.post({ type: "status", state: "starting", message: t("status.sandboxSetup") });
  }

  private async refreshAccount(): Promise<void> {
    const client = this.client!;
    const acc = await client.request("account/read", {});
    if (!acc.account && acc.requiresOpenaiAuth) {
      this.post({
        type: "status",
        state: "needsLogin",
        message: t("status.needsLogin"),
        actions: [{ label: t("action.login"), type: "login" }],
      });
      return;
    }
    await this.loadModels();
    const who = acc.account?.email ?? acc.account?.type ?? t("status.connected");
    this.post({ type: "status", state: "ready", message: t("status.ready", { who, n: this.models.length }) });
  }

  private async loadModels(): Promise<void> {
    const models: ModelInfo[] = [];
    let cursor: string | null | undefined;
    do {
      const page = await this.client!.request("model/list", { cursor: cursor ?? null });
      for (const m of page.data ?? []) {
        models.push({
          id: m.id,
          isDefault: !!m.isDefault,
          defaultReasoningEffort: m.defaultReasoningEffort,
          supportedReasoningEfforts: (m.supportedReasoningEfforts ?? []).map((e: Json) => e.reasoningEffort),
        });
      }
      cursor = page.nextCursor;
    } while (cursor);
    this.models = models;
    this.log.appendLine(`models: ${models.map((m) => m.id).join(", ")}`);
  }

  private installCodex(): void {
    const term = vscode.window.createTerminal({ name: t("terminal.install") });
    term.show();
    term.sendText("npm i -g @openai/codex");
    this.post({
      type: "status",
      state: "starting",
      message: t("status.installing"),
      actions: [{ label: t("action.retry"), type: "retry" }],
    });
  }

  private async pickCodex(): Promise<void> {
    const picked = await vscode.window.showOpenDialog({
      title: t("dialog.pickCodex"),
      canSelectMany: false,
      filters: process.platform === "win32" ? { Codex: ["exe", "cmd", "bat"] } : undefined,
    });
    if (!picked?.[0]) return;
    // A mudança de configuração reinicia o servidor (ver extension.ts).
    await this.cfg().update("codexPath", picked[0].fsPath, vscode.ConfigurationTarget.Global);
  }

  private async login(): Promise<void> {
    await this.ensureServer();
    if (!this.client) return;
    const res = await this.client.request("account/login/start", { type: "chatgpt" });
    if (res.authUrl) {
      await vscode.env.openExternal(vscode.Uri.parse(res.authUrl));
      this.post({ type: "status", state: "starting", message: t("status.loginBrowser") });
    }
  }

  restart(): void {
    this.client?.stop();
    this.client = undefined;
    this.thread = undefined;
    this.turn = undefined;
    this.pendingPlan = undefined;
    this.postFloor();
    void this.ensureServer().catch((e) => this.fail(e));
  }

  dispose(): void {
    this.client?.stop();
  }

  // ---------- Configuração ----------

  private cfg() {
    return vscode.workspace.getConfiguration("smartShift");
  }

  private routerConfig(): RouterConfig {
    const cfg = this.cfg();
    const tiers = normalizeTierKeys(cfg.get<Record<string, Tier>>("tiers"));
    const thresholds = normalizeTierKeys(cfg.get<Record<string, number>>("thresholds"));
    return {
      tiers: { ...DEFAULT_TIERS, ...tiers },
      thresholds: { medium: thresholds.medium ?? 2, complex: thresholds.complex ?? 5 },
      extraComplexKeywords: cfg.get<string[]>("extraComplexKeywords", []),
      extraSimpleKeywords: cfg.get<string[]>("extraSimpleKeywords", []),
    };
  }

  private planConfig(): PlanExecuteConfig {
    const raw = this.cfg().get<Record<string, any>>("planExecute", {});
    return {
      when: raw.when === "never" ? "never" : "complex",
      planner: raw.planner ?? { model: "gpt-6-astra", effort: "high" },
      executor: toTierName(raw.executor) ?? "medium",
      autoExecute: !!raw.autoExecute,
    };
  }

  private signalConfig(): SignalConfig {
    const raw = this.cfg().get<Partial<SignalConfig>>("signals", {});
    return { failedCommands: raw.failedCommands ?? 2, filesChanged: raw.filesChanged ?? 8 };
  }

  // ---------- Roteamento ----------

  private route(text: string, override: Override, sel: Selection | undefined, forced?: TierName): Route {
    const config = this.routerConfig();
    const plan = this.planConfig();
    const floor = this.thread?.floor ?? "simple";

    const classified = !forced && override === "auto" ? classify(text, config, { selectionLines: sel?.lines }) : undefined;
    const d = forced
      ? { tier: forced, plan: false, auto: false, reasons: [t("decide.manualUp")] }
      : decide({
          classified,
          override,
          floor,
          floorReasons: this.thread?.floorReasons ?? [],
          planWhen: plan.when,
          executor: plan.executor,
        });

    const exec = resolveTier(config.tiers[d.tier], this.models);
    const notes = [...exec.notes];
    let planner: { model: string; effort: string } | undefined;
    if (d.plan) {
      const p = resolveTier(plan.planner, this.models);
      notes.push(...p.notes);
      planner = { model: p.model, effort: p.effort };
    }

    // O cache de prompt é por modelo: trocar de modelo reprocessa o histórico inteiro.
    const first = planner?.model ?? exec.model;
    if (this.thread?.lastModel && first !== this.thread.lastModel) {
      notes.push(t("note.modelSwitch", { from: this.thread.lastModel, to: first }));
    }

    return {
      tier: d.tier,
      model: exec.model,
      effort: exec.effort,
      auto: d.auto,
      plan: planner,
      score: classified?.score,
      reasons: d.reasons,
      notes,
    };
  }

  private selection(): Selection | undefined {
    const ed = vscode.window.activeTextEditor;
    if (!ed || ed.selection.isEmpty) return undefined;
    const s = ed.selection;
    const rel = vscode.workspace.asRelativePath(ed.document.uri);
    const label = `${rel}:${s.start.line + 1}-${s.end.line + 1}`;
    const code = ed.document.getText(s);
    return {
      label,
      lines: s.end.line - s.start.line + 1,
      block: `\n\n${t("prompt.selection", { label })}\n\`\`\`${ed.document.languageId}\n${code}\n\`\`\``,
    };
  }

  // ---------- Conversa ----------

  private async ensureThread(): Promise<ThreadState> {
    if (this.thread) return this.thread;
    const cfg = this.cfg();
    // null = automático (instrução contra consultas de 1 s no Windows); "" desliga.
    const custom = cfg.get<string | null>("developerInstructions", null);
    const developerInstructions = custom ?? (process.platform === "win32" ? defaultWindowsInstructions() : "");
    const res = await this.client!.request("thread/start", {
      cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null,
      sandbox: cfg.get("sandbox", "workspace-write"),
      approvalPolicy: cfg.get("approvalPolicy", "on-request"),
      developerInstructions: developerInstructions || null,
    });
    this.thread = { id: res.thread.id as string, floor: "simple", floorReasons: [], sandbox: res.sandbox };
    this.log.appendLine(`thread started: ${this.thread.id} (sandbox ${res.sandbox?.type})`);
    if (cfg.get("sandbox") === "workspace-write" && res.sandbox?.type === "readOnly") {
      this.post({ type: "note", kind: "info", text: t("note.readOnly") });
    }
    return this.thread;
  }

  private async send(text: string, override: Override, forced?: TierName): Promise<void> {
    if (!text.trim()) return;
    if (this.turn) {
      void vscode.window.showInformationMessage(t("msg.busy"));
      return;
    }
    await this.ensureServer();
    if (!this.client) return; // Codex ausente ou sem pasta: o painel já mostra o motivo
    if (this.models.length === 0) await this.refreshAccount();
    if (this.models.length === 0) return; // ainda sem login

    const sel = forced ? undefined : this.selection();
    await this.ensureThread();
    const route = this.route(text, override, sel, forced);
    const input = text + (sel?.block ?? "");

    this.lastPrompt = { text, tier: route.tier };
    this.pendingPlan = undefined;
    this.post({ type: "userMessage", text, route, selection: sel?.label });
    this.log.appendLine(
      `request → ${route.plan ? `plan ${route.plan.model}/${route.plan.effort}, execute ` : ""}${route.tier} (${route.model}, ${route.effort}) ` +
        `score=${route.score ?? "-"} [${route.reasons.join("; ")}]`,
    );

    if (route.plan) {
      this.pendingPlan = { tier: route.tier, model: route.model, effort: route.effort };
      await this.startTurn("plan", route.tier, route.plan.model, route.plan.effort, input + planInstructions(), false);
    } else {
      await this.startTurn("normal", route.tier, route.model, route.effort, input, !route.auto);
    }
  }

  private async executePlan(): Promise<void> {
    const p = this.pendingPlan;
    if (!p || this.turn) return;
    this.pendingPlan = undefined;
    this.post({ type: "systemMessage", text: t("sys.executingPlan", { model: p.model, effort: p.effort }) });
    await this.startTurn("execute", p.tier, p.model, p.effort, executePrompt(), false);
  }

  private async startTurn(kind: TurnKind, tier: TierName, model: string, effort: string, text: string, forced: boolean): Promise<void> {
    const thread = this.thread!;
    this.turn = {
      kind,
      tier,
      model,
      forced,
      stats: { status: "inProgress", failedCommands: 0, failedFileChanges: 0, filesChanged: 0 },
      startTotals: thread.totals,
      modelCalls: 0,
    };
    this.post({ type: "busy", busy: true });
    try {
      const res = await this.client!.request("turn/start", {
        threadId: thread.id,
        input: [{ type: "text", text }],
        model,
        effort,
        // O sandbox passado aqui vale para os próximos turnos também, então é sempre explícito:
        // só leitura ao planejar, o da conversa nos demais.
        sandboxPolicy: kind === "plan" ? { type: "readOnly" } : thread.sandbox,
      });
      if (this.turn) this.turn.id = res.turn?.id;
      thread.lastModel = model;
      // O modelo (e o cache dele) muda quando o pedido começa, então o nível da conversa sobe já aqui.
      // O planejador não conta: quem segue a conversa é o executor.
      if (kind !== "plan") this.raiseFloor(tier, [t("floor.keepsCache", { tier: tierLabel(tier) })]);
    } catch (e) {
      this.turn = undefined;
      this.post({ type: "busy", busy: false });
      throw e;
    }
  }

  private async escalate(): Promise<void> {
    if (!this.lastPrompt) return;
    const up = nextTier(this.lastPrompt.tier);
    if (!up) return;
    await this.send(this.lastPrompt.text, "auto", up);
  }

  private async interrupt(): Promise<void> {
    if (!this.client || !this.thread || !this.turn?.id) return;
    await this.client.request("turn/interrupt", { threadId: this.thread.id, turnId: this.turn.id });
  }

  newThread(): void {
    this.thread = undefined;
    this.turn = undefined;
    this.pendingPlan = undefined;
    this.lastPrompt = undefined;
    this.post({ type: "reset" });
    this.postFloor();
  }

  private postFloor(): void {
    this.post({ type: "floor", tier: this.thread?.floor ?? "simple", reasons: this.thread?.floorReasons ?? [] });
  }

  private raiseFloor(tier: TierName, reasons: string[]): boolean {
    const t = this.thread;
    if (!t) return false;
    const next = maxTier(t.floor, tier);
    if (next === t.floor) return false;
    t.floor = next;
    t.floorReasons = reasons;
    this.postFloor();
    return true;
  }

  // ---------- Eventos do Codex ----------

  private onNotification(method: string, p: Json): void {
    if (p?.threadId && this.thread && p.threadId !== this.thread.id) return;
    switch (method) {
      case "item/agentMessage/delta":
        this.post({ type: "agentDelta", itemId: p.itemId, delta: p.delta });
        break;
      case "item/started":
        this.onItem(p.item, false);
        break;
      case "item/completed":
        this.onItem(p.item, true);
        break;
      case "thread/tokenUsage/updated":
        if (this.thread && p.tokenUsage?.total) this.thread.totals = p.tokenUsage.total;
        if (this.turn && (!p.turnId || !this.turn.id || p.turnId === this.turn.id)) this.turn.modelCalls++;
        break;
      case "turn/completed":
        this.onTurnCompleted(p.turn ?? {});
        break;
      case "error":
        if (!p.willRetry) this.post({ type: "note", kind: "error", text: p.error?.message ?? t("note.unknownError") });
        break;
      case "model/rerouted":
        this.post({ type: "note", kind: "info", text: t("note.rerouted", { from: p.fromModel, to: p.toModel, reason: JSON.stringify(p.reason) }) });
        break;
      case "account/login/completed":
        if (p.success) void this.refreshAccount().catch((e) => this.fail(e));
        else this.post({ type: "status", state: "needsLogin", message: t("status.loginFailed", { error: p.error ?? t("status.tryAgain") }) });
        break;
      case "account/updated":
        void this.refreshAccount().catch((e) => this.fail(e));
        break;
      case "windowsSandbox/setupCompleted":
        if (p.success) {
          // A conversa atual guardou a política só leitura; os próximos turnos passam a poder escrever.
          if (this.thread) this.thread.sandbox = { type: "workspaceWrite" };
          void vscode.window.showInformationMessage(t("sandbox.done"));
          void this.refreshAccount().catch((e) => this.fail(e));
        } else {
          void vscode.window.showErrorMessage(t("sandbox.failed", { error: p.error ?? t("note.unknownError") }));
        }
        break;
    }
  }

  private onTurnCompleted(turnInfo: Json): void {
    const turn = this.turn;
    this.turn = undefined;
    this.post({ type: "busy", busy: false });
    const status: string = turnInfo.status ?? "completed";
    if (!turn) return;
    turn.stats.status = status;

    this.postUsage(turn);

    if (turn.kind === "plan") {
      if (status === "completed" && this.pendingPlan) {
        if (this.planConfig().autoExecute) {
          void this.executePlan().catch((e) => this.fail(e));
        } else {
          this.post({ type: "planReady", model: this.pendingPlan.model, effort: this.pendingPlan.effort });
        }
      } else {
        this.pendingPlan = undefined;
        this.post({ type: "turnDone", status, error: turnInfo.error?.message, canEscalate: false });
      }
      return;
    }

    // Sinais gratuitos: sobe o nível da conversa para os próximos pedidos.
    const signals = escalationSignals(turn.stats, signalsForTurn(this.signalConfig(), turn.kind));
    const up = nextTier(turn.tier);
    if (signals.length && up && this.raiseFloor(up, signals)) {
      this.post({ type: "note", kind: "info", text: t("note.escalated", { tier: tierLabel(up), reasons: signals.join("; ") }) });
    }

    const next = this.lastPrompt && nextTier(this.lastPrompt.tier);
    this.post({ type: "turnDone", status, error: turnInfo.error?.message, canEscalate: status === "failed" && !!next, next });
  }

  private postUsage(turn: TurnState): void {
    const end = this.thread?.totals;
    if (!end) return;
    const start = turn.startTotals ?? { inputTokens: 0, cachedInputTokens: 0, totalTokens: 0 };
    const total = end.totalTokens - start.totalTokens;
    const input = end.inputTokens - start.inputTokens;
    const cached = end.cachedInputTokens - start.cachedInputTokens;
    if (total <= 0) return;
    const pct = input > 0 ? Math.round((cached / input) * 100) : 0;
    this.post({ type: "usage", model: turn.model, total, cachedPct: pct, calls: turn.modelCalls });
  }

  private onItem(item: Json, done: boolean): void {
    if (!item) return;
    const stats = this.turn?.stats;
    if (!done) {
      const activities = ["reasoning", "commandExecution", "fileChange", "agentMessage", "mcpToolCall", "webSearch", "contextCompaction"] as const;
      const kind = activities.find((a) => a === item.type);
      if (kind) this.post({ type: "activity", text: t(`activity.${kind}`) });
    }
    switch (item.type) {
      case "agentMessage":
        if (done) this.post({ type: "agentDone", itemId: item.id, text: item.text });
        break;
      case "commandExecution":
        if (done) {
          const failed = item.status === "failed" || (typeof item.exitCode === "number" && item.exitCode !== 0);
          if (stats) trackCommand(stats, failed);
          const out = String(item.aggregatedOutput ?? "").trimEnd();
          this.post({ type: "tool", itemId: item.id, title: `$ ${item.command}`, detail: t("tool.exitCode", { code: item.exitCode ?? "?" }), body: out.slice(-2000), failed });
        } else {
          this.post({ type: "tool", itemId: item.id, title: `$ ${item.command}`, detail: t("tool.running") });
        }
        break;
      case "fileChange":
        if (done) {
          const changes: Json[] = item.changes ?? [];
          if (stats) {
            stats.filesChanged += changes.length;
            if (item.status === "failed") stats.failedFileChanges++;
          }
          const files = changes.map((c) => vscode.workspace.asRelativePath(c.path)).join(", ");
          this.post({ type: "tool", itemId: item.id, title: t("tool.filesChanged"), detail: String(item.status ?? ""), body: files, failed: item.status === "failed" });
        }
        break;
      case "mcpToolCall":
      case "webSearch":
        if (done) this.post({ type: "tool", itemId: item.id, title: item.type === "webSearch" ? t("tool.search", { q: item.query }) : t("tool.mcp", { name: item.tool ?? "" }), detail: "" });
        break;
    }
  }

  private async onServerRequest(id: number | string, method: string, p: Json): Promise<void> {
    const client = this.client;
    if (!client) return;
    const ask = async (message: string, detail: string) => {
      const allow = t("approval.allow");
      const allowSession = t("approval.allowSession");
      const choice = await vscode.window.showWarningMessage(message, { modal: true, detail: detail || undefined }, allow, allowSession, t("approval.deny"));
      client.respond(id, { decision: choice === allow ? "accept" : choice === allowSession ? "acceptForSession" : "decline" });
    };
    if (method === "item/commandExecution/requestApproval") {
      const detail = [
        p.command && t("approval.commandLabel", { v: p.command }),
        p.cwd && t("approval.folderLabel", { v: p.cwd }),
        p.reason && t("approval.reasonLabel", { v: p.reason }),
      ];
      await ask(t("approval.command"), detail.filter(Boolean).join("\n"));
    } else if (method === "item/fileChange/requestApproval") {
      const detail = [p.reason && t("approval.reasonLabel", { v: p.reason }), p.grantRoot && t("approval.folderLabel", { v: p.grantRoot })];
      await ask(t("approval.files"), detail.filter(Boolean).join("\n"));
    } else {
      this.log.appendLine(`unsupported server request: ${method}`);
      client.respondError(id, t("server.unsupported", { method }));
    }
  }

  private fail(e: unknown): void {
    const msg = e instanceof Error ? e.message : String(e);
    this.log.appendLine(`ERROR: ${msg}`);
    this.post({ type: "status", state: "error", message: msg });
  }

  // ---------- HTML ----------

  private html(webview: vscode.Webview, media: vscode.Uri): string {
    const nonce = Array.from({ length: 32 }, () => Math.floor(Math.random() * 36).toString(36)).join("");
    const js = webview.asWebviewUri(vscode.Uri.joinPath(media, "main.js"));
    const css = webview.asWebviewUri(vscode.Uri.joinPath(media, "main.css"));
    const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const tiers = TIER_ORDER.map((tier) => `<option value="${tier}">${esc(t("ui.force", { tier: tierLabel(tier) }))}</option>`).join("");
    // Textos do painel: JSON dentro de <script type="application/json"> (não é executado; o "<" é escapado).
    const strings = JSON.stringify(dictionary()).replace(/</g, "\\u003c");
    return `<!doctype html>
<html lang="${getLocale() === "pt" ? "pt-BR" : "en"}">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${css}">
</head>
<body>
  <header>
    <select id="override" title="${esc(t("ui.overrideTitle"))}">
      <option value="auto">${esc(t("ui.auto"))}</option>
      <option value="plan">${esc(t("ui.plan"))}</option>${tiers}
    </select>
    <button id="new" class="secondary" title="${esc(t("ui.newTitle"))}">${esc(t("ui.new"))}</button>
  </header>
  <div id="floor" class="floor"></div>
  <div id="status" class="status"></div>
  <div id="status-actions" class="status-actions"></div>
  <main id="log"></main>
  <footer>
    <div id="working" class="working hidden"><span class="spinner"></span><span id="working-text"></span></div>
    <div id="preview" class="preview"></div>
    <textarea id="input" rows="4" placeholder="${esc(t("ui.placeholder"))}"></textarea>
    <div class="actions">
      <button id="stop" class="secondary hidden">${esc(t("ui.stop"))}</button>
      <button id="send">${esc(t("ui.send"))}</button>
    </div>
  </footer>
  <script id="strings" type="application/json">${strings}</script>
  <script nonce="${nonce}" src="${js}"></script>
</body>
</html>`;
  }
}
