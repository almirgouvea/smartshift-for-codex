// Classificador de complexidade. Não depende do VS Code, para poder ser testado isolado.

import { MessageKey, t, tierLabel } from "./i18n";

export type TierName = "simple" | "medium" | "complex";
export const TIER_ORDER: TierName[] = ["simple", "medium", "complex"];

/** Aceita também os nomes antigos em português (simples, media/média, complexa). */
const TIER_ALIASES: Record<string, TierName> = {
  simple: "simple",
  simples: "simple",
  medium: "medium",
  media: "medium",
  "média": "medium",
  complex: "complex",
  complexa: "complex",
};

export function toTierName(value: unknown): TierName | undefined {
  return typeof value === "string" ? TIER_ALIASES[value.trim().toLowerCase()] : undefined;
}

/** Normaliza um objeto com chaves de nível (ex.: `tiers`, `thresholds`), aceitando os nomes antigos. */
export function normalizeTierKeys<T>(obj: Record<string, T> | undefined): Partial<Record<TierName, T>> {
  const out: Partial<Record<TierName, T>> = {};
  for (const [k, v] of Object.entries(obj ?? {})) {
    const tier = toTierName(k);
    if (tier) out[tier] = v;
  }
  return out;
}

export interface Tier {
  model: string;
  effort: string;
}

export interface RouterConfig {
  tiers: Record<TierName, Tier>;
  thresholds: { medium: number; complex: number };
  extraComplexKeywords: string[];
  extraSimpleKeywords: string[];
}

export interface PromptContext {
  /** Linhas selecionadas no editor que vão junto com o pedido. */
  selectionLines?: number;
}

export interface Classification {
  tier: TierName;
  score: number;
  reasons: string[];
}

interface Rule {
  pattern: RegExp;
  weight: number;
  label: MessageKey;
}

// Radicais em português e inglês. \b no início evita casar no meio de outras palavras.
const COMPLEX_RULES: Rule[] = [
  { pattern: /\b(arquitetura|architecture|redesign|redesenh|reestrutur|restructur)/i, weight: 3, label: "rule.architecture" },
  { pattern: /\b(migr[aeo]|upgrade d[aeo] (framework|vers))/i, weight: 3, label: "rule.migration" },
  { pattern: /\b(do zero|from scratch|sistema completo|full system)/i, weight: 3, label: "rule.fromScratch" },
  { pattern: /\b(race condition|condição de corrida|deadlock|concorr[eê]ncia|concurren|thread[- ]safe)/i, weight: 3, label: "rule.concurrency" },
  { pattern: /\b(vulnerab|seguran[çc]a|security|exploit|autentica[çc]|authenticat)/i, weight: 2, label: "rule.security" },
  { pattern: /\b(refator|refactor)/i, weight: 2, label: "rule.refactor" },
  { pattern: /\b(otimiz|optimi[sz]|performance|desempenho|lentid|memory leak|vazamento de mem)/i, weight: 2, label: "rule.performance" },
  { pattern: /\b(implement|criar? (uma |um )?(feature|funcionalidade|m[oó]dulo|servi[çc]o|api)|add (a )?feature|build (a|an) )/i, weight: 2, label: "rule.feature" },
  { pattern: /\b(debug|depur|investig|descobr(ir|a) (por ?que|a causa)|root cause|causa raiz|intermitente|flaky)/i, weight: 2, label: "rule.debug" },
  { pattern: /\b(todo o (projeto|reposit[oó]rio|c[oó]digo)|whole (codebase|repo|project)|em todos os arquivos|across (the )?(codebase|files))/i, weight: 2, label: "rule.broadScope" },
  { pattern: /\b(integra[çcr]|integrat|banco de dados|database|schema)/i, weight: 1, label: "rule.data" },
  { pattern: /\b(testes?|tests?|cobertura|coverage)\b/i, weight: 1, label: "rule.tests" },
];

const SIMPLE_RULES: Rule[] = [
  { pattern: /\b(o que (é|significa|faz)|what (is|does)|explique|explica|explain|resuma|summari[sz]e)/i, weight: -2, label: "rule.explain" },
  { pattern: /\b(renome|rename|typo|erro de digita|ortografia|spelling)/i, weight: -2, label: "rule.smallFix" },
  { pattern: /\b(coment[aá]rio|comment|docstring|jsdoc)/i, weight: -2, label: "rule.comments" },
  { pattern: /\b(format(ar|e|ação)?|format(ting)?|indenta|lint|prettier)\b/i, weight: -2, label: "rule.formatting" },
  { pattern: /\b(traduz|translate)/i, weight: -2, label: "rule.translation" },
  { pattern: /\b(s[oó] (uma|um|essa|esse)|apenas (uma|um)|just (one|this)|uma linha|one[- ]liner)/i, weight: -1, label: "rule.smallScope" },
];

const FILE_REF = /[\w./\\-]+\.(ts|tsx|js|jsx|mjs|cjs|py|java|kt|go|rs|rb|php|cs|cpp|c|h|hpp|swift|vue|svelte|sql|json|ya?ml|toml|md|css|scss|html)\b/gi;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function classify(prompt: string, config: RouterConfig, ctx: PromptContext = {}): Classification {
  const text = prompt.trim();
  let score = 0;
  const reasons: string[] = [];
  const add = (weight: number, label: string) => {
    score += weight;
    reasons.push(`${label} (${weight > 0 ? "+" : ""}${weight})`);
  };

  // Tamanho do pedido.
  if (text.length > 2000) add(3, t("reason.veryLong"));
  else if (text.length > 800) add(2, t("reason.long"));
  else if (text.length > 300) add(1, t("reason.mediumLength"));

  for (const rule of COMPLEX_RULES) if (rule.pattern.test(text)) add(rule.weight, t(rule.label));
  for (const rule of SIMPLE_RULES) if (rule.pattern.test(text)) add(rule.weight, t(rule.label));

  for (const kw of config.extraComplexKeywords) {
    if (kw && new RegExp(escapeRegExp(kw), "i").test(text)) add(3, t("reason.keyword", { kw }));
  }
  for (const kw of config.extraSimpleKeywords) {
    if (kw && new RegExp(escapeRegExp(kw), "i").test(text)) add(-2, t("reason.keyword", { kw }));
  }

  // Várias etapas: lista numerada ou com marcadores.
  const steps = text.split(/\r?\n/).filter((l) => /^\s*(\d+[.)]|[-*•])\s+\S/.test(l)).length;
  if (steps >= 5) add(3, t("reason.steps", { n: steps }));
  else if (steps >= 3) add(2, t("reason.steps", { n: steps }));

  // Arquivos citados.
  const files = new Set((text.match(FILE_REF) ?? []).map((f) => f.toLowerCase()));
  if (files.size >= 5) add(3, t("reason.files", { n: files.size }));
  else if (files.size >= 3) add(2, t("reason.files", { n: files.size }));

  // Stack trace ou log colado.
  if (/Traceback \(most recent call last\)|^\s+at .+:\d+(:\d+)?\)?$|Exception in thread|panicked at/m.test(text)) {
    add(2, t("reason.stackTrace"));
  }

  // Código selecionado no editor.
  const sel = ctx.selectionLines ?? 0;
  if (sel > 200) add(2, t("reason.selection", { n: sel }));
  else if (sel > 50) add(1, t("reason.selection", { n: sel }));

  // Pergunta curta.
  if (text.length < 120 && text.endsWith("?")) add(-1, t("reason.shortQuestion"));

  const tier: TierName =
    score >= config.thresholds.complex ? "complex" : score >= config.thresholds.medium ? "medium" : "simple";
  if (reasons.length === 0) reasons.push(t("reason.none"));
  return { tier, score, reasons };
}

export function nextTier(tier: TierName): TierName | undefined {
  const i = TIER_ORDER.indexOf(tier);
  return TIER_ORDER[i + 1];
}

export function maxTier(a: TierName, b: TierName): TierName {
  return TIER_ORDER.indexOf(a) >= TIER_ORDER.indexOf(b) ? a : b;
}

// ---------- Decisão por conversa ----------

/** "auto", "plan" (planejar → executar) ou um nível forçado. */
export type Override = "auto" | "plan" | TierName;
export type PlanWhen = "complex" | "never";

export interface DecideInput {
  /** Classificação do pedido (ausente quando o nível é forçado). */
  classified?: Classification;
  override: Override;
  /** Nível mínimo da conversa: só sobe, e só volta a "simple" numa conversa nova. */
  floor: TierName;
  floorReasons: string[];
  planWhen: PlanWhen;
  /** Nível usado para executar depois de planejar. */
  executor: TierName;
}

export interface Decision {
  /** Nível que executa o pedido (no modo planejar, o que executa o plano). */
  tier: TierName;
  plan: boolean;
  auto: boolean;
  reasons: string[];
}

export function decide(input: DecideInput): Decision {
  const { classified, override, floor, floorReasons } = input;

  if (override === "plan") {
    return { tier: maxTier(input.executor, floor), plan: true, auto: false, reasons: [t("decide.planManual")] };
  }
  if (override !== "auto") {
    const reasons = [t("decide.manual")];
    if (TIER_ORDER.indexOf(override) < TIER_ORDER.indexOf(floor)) reasons.push(t("decide.belowFloor", { tier: tierLabel(floor) }));
    return { tier: override, plan: false, auto: false, reasons };
  }

  const cls = classified!;
  const reasons = [...cls.reasons];
  // Planejar só quando o próprio pedido é complexo, não quando o piso da conversa é que está alto.
  if (input.planWhen === "complex" && cls.tier === "complex") {
    reasons.push(t("decide.planAuto"));
    return { tier: maxTier(input.executor, floor), plan: true, auto: true, reasons };
  }
  const tier = maxTier(cls.tier, floor);
  if (tier !== cls.tier) {
    reasons.push(t("decide.keptByFloor", { tier: tierLabel(floor), why: floorReasons.length ? ": " + floorReasons.join("; ") : "" }));
  }
  return { tier, plan: false, auto: true, reasons };
}

// ---------- Sinais depois de cada pedido ----------

export interface TurnStats {
  status: string;
  /**
   * Comandos com erro seguidos, sem nenhum sucesso depois. Erros no meio do caminho que o Codex
   * resolveu (ex.: `rg` sem resultado, teste que falhou e depois passou) não contam.
   */
  failedCommands: number;
  failedFileChanges: number;
  filesChanged: number;
}

export interface SignalConfig {
  /** Comandos com erro num pedido para subir de nível (0 desliga). */
  failedCommands: number;
  /** Arquivos alterados num pedido para subir de nível (0 desliga). */
  filesChanged: number;
}

/**
 * Sinais que valem para o tipo de pedido. Ao executar um plano, alterar muitos arquivos era o
 * tamanho previsto do trabalho, não sinal de dificuldade; falhas e erros continuam valendo.
 */
export function signalsForTurn(cfg: SignalConfig, kind: "normal" | "plan" | "execute"): SignalConfig {
  return kind === "execute" ? { ...cfg, filesChanged: 0 } : cfg;
}

/** Motivos para subir o nível da conversa. Lista vazia = manter. Não gasta tokens: usa só eventos do Codex. */
export function escalationSignals(stats: TurnStats, cfg: SignalConfig): string[] {
  const reasons: string[] = [];
  if (stats.status === "failed") reasons.push(t("signal.failed"));
  if (cfg.failedCommands > 0 && stats.failedCommands >= cfg.failedCommands) {
    reasons.push(t("signal.failedCommands", { n: stats.failedCommands }));
  }
  if (stats.failedFileChanges > 0) reasons.push(t("signal.failedFileChanges"));
  if (cfg.filesChanged > 0 && stats.filesChanged >= cfg.filesChanged) {
    reasons.push(t("signal.filesChanged", { n: stats.filesChanged }));
  }
  return reasons;
}

export const planInstructions = (): string => t("prompt.plan");

/** Atualiza a contagem de erros seguidos depois de cada comando. */
export function trackCommand(stats: TurnStats, failed: boolean): void {
  stats.failedCommands = failed ? stats.failedCommands + 1 : 0;
}

/**
 * Instrução padrão no Windows: os comandos no sandbox demoram para começar, e o Codex tende a
 * consultar o resultado a cada 1 s. Cada consulta reenvia o histórico (~20 mil tokens).
 */
export const defaultWindowsInstructions = (): string => t("prompt.windows");

export const executePrompt = (): string => t("prompt.execute");

export interface ModelInfo {
  id: string;
  isDefault: boolean;
  defaultReasoningEffort: string;
  supportedReasoningEfforts: string[];
}

export interface ResolvedTier extends Tier {
  notes: string[];
}

/** Ajusta o nível configurado aos modelos que a conta realmente tem. */
export function resolveTier(tier: Tier, models: ModelInfo[]): ResolvedTier {
  const notes: string[] = [];
  if (models.length === 0) return { ...tier, notes };
  let model = models.find((m) => m.id === tier.model);
  if (!model) {
    const fallback = models.find((m) => m.isDefault) ?? models[0];
    notes.push(t("resolve.modelUnavailable", { model: tier.model, fallback: fallback.id }));
    model = fallback;
  }
  let effort = tier.effort;
  if (!model.supportedReasoningEfforts.includes(effort)) {
    notes.push(t("resolve.effortUnsupported", { effort, model: model.id, fallback: model.defaultReasoningEffort }));
    effort = model.defaultReasoningEffort;
  }
  return { model: model.id, effort, notes };
}
