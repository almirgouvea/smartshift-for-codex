import { test } from "node:test";
import assert from "node:assert/strict";
import { dictionary, MessageKey, setLocale, t } from "../i18n";
import { classify, decide, escalationSignals, maxTier, nextTier, normalizeTierKeys, resolveTier, signalsForTurn, toTierName, trackCommand, RouterConfig, ModelInfo, DecideInput, TurnStats } from "../router";

const config: RouterConfig = {
  tiers: {
    simple: { model: "gpt-6-luna", effort: "low" },
    medium: { model: "gpt-6.1-sol", effort: "medium" },
    complex: { model: "gpt-6-astra", effort: "high" },
  },
  thresholds: { medium: 2, complex: 5 },
  extraComplexKeywords: [],
  extraSimpleKeywords: [],
};

// Os testes abaixo conferem os textos em português; os de idioma ficam no fim do arquivo.
setLocale("pt");

test("pedidos simples vão para o nível simples", () => {
  for (const p of [
    "o que é um closure?",
    "explique esta função",
    "renomeie a variável x para total",
    "adicione um comentário nesta linha",
    "corrija o typo no README",
  ]) {
    assert.equal(classify(p, config).tier, "simple", p);
  }
});

test("pedidos de complexidade média", () => {
  for (const p of [
    "implemente um endpoint de upload no server.ts",
    "investigue por que o teste de login está flaky",
    "refatore a função parseConfig para aceitar YAML",
  ]) {
    assert.equal(classify(p, config).tier, "medium", p);
  }
});

test("pedidos complexos vão para o nível complexo", () => {
  for (const p of [
    "redesenhe a arquitetura do módulo de pagamentos e migre o banco para Postgres",
    "existe uma race condition no worker; investigue a causa raiz e corrija",
    "crie do zero um sistema completo de autenticação com testes",
    "refatore auth.ts, user.ts, session.ts, db.ts e routes.ts para usar injeção de dependência",
  ]) {
    assert.equal(classify(p, config).tier, "complex", p);
  }
});

test("lista com várias etapas aumenta a pontuação", () => {
  const p = "faça isto:\n1. a\n2. b\n3. c\n4. d\n5. e";
  const r = classify(p, config);
  assert.ok(r.reasons.some((x) => x.includes("etapas")));
  assert.ok(r.score >= 3);
});

test("stack trace colado conta como depuração", () => {
  const p = "deu isso:\nTraceback (most recent call last):\n  File \"a.py\", line 1\nValueError";
  assert.ok(classify(p, config).reasons.some((x) => x.includes("stack trace")));
});

test("seleção grande no editor aumenta a pontuação", () => {
  assert.ok(classify("melhore isto", config, { selectionLines: 300 }).score >= 2);
});

test("palavras-chave extras da configuração", () => {
  const c = { ...config, extraComplexKeywords: ["kubernetes"] };
  assert.equal(classify("ajuste o kubernetes", c).score >= 3, true);
});

test("nextTier sobe um nível e para no topo", () => {
  assert.equal(nextTier("simple"), "medium");
  assert.equal(nextTier("medium"), "complex");
  assert.equal(nextTier("complex"), undefined);
});

test("resolveTier troca modelo indisponível e esforço não suportado", () => {
  const models: ModelInfo[] = [
    { id: "gpt-6.1-sol", isDefault: true, defaultReasoningEffort: "low", supportedReasoningEfforts: ["low", "medium", "high"] },
    { id: "gpt-6-luna", isDefault: false, defaultReasoningEffort: "medium", supportedReasoningEfforts: ["low", "medium"] },
  ];
  assert.deepEqual(resolveTier({ model: "gpt-6-luna", effort: "low" }, models), { model: "gpt-6-luna", effort: "low", notes: [] });
  const r1 = resolveTier({ model: "nao-existe", effort: "high" }, models);
  assert.equal(r1.model, "gpt-6.1-sol");
  assert.equal(r1.effort, "high");
  const r2 = resolveTier({ model: "gpt-6-luna", effort: "ultra" }, models);
  assert.equal(r2.effort, "medium");
  assert.equal(r2.notes.length, 1);
});

// ---------- Decisão por conversa e sinais ----------

const base: DecideInput = {
  override: "auto",
  floor: "simple",
  floorReasons: [],
  planWhen: "complex",
  executor: "medium",
};
const cls = (tier: "simple" | "medium" | "complex") => ({ tier, score: 0, reasons: ["r"] });

test("maxTier escolhe o maior nível", () => {
  assert.equal(maxTier("simple", "medium"), "medium");
  assert.equal(maxTier("complex", "medium"), "complex");
});

test("o nível da conversa não desce: pedido simples numa conversa média fica médio", () => {
  const d = decide({ ...base, classified: cls("simple"), floor: "medium", floorReasons: ["o pedido falhou"] });
  assert.equal(d.tier, "medium");
  assert.equal(d.plan, false);
  assert.ok(d.reasons.some((r) => r.includes("mantido em média") && r.includes("o pedido falhou")));
});

test("o nível sobe quando o pedido é mais complexo que a conversa", () => {
  assert.equal(decide({ ...base, classified: cls("medium") }).tier, "medium");
});

test("pedido complexo dispara planejar → executar com o executor", () => {
  const d = decide({ ...base, classified: cls("complex") });
  assert.equal(d.plan, true);
  assert.equal(d.tier, "medium");
});

test("planejar desligado: pedido complexo vai direto ao nível complexo", () => {
  const d = decide({ ...base, classified: cls("complex"), planWhen: "never" });
  assert.equal(d.plan, false);
  assert.equal(d.tier, "complex");
});

test("piso complexo não dispara o planejamento sozinho", () => {
  const d = decide({ ...base, classified: cls("simple"), floor: "complex" });
  assert.equal(d.plan, false);
  assert.equal(d.tier, "complex");
});

test("executor nunca fica abaixo do piso da conversa", () => {
  const d = decide({ ...base, classified: cls("complex"), floor: "complex" });
  assert.equal(d.plan, true);
  assert.equal(d.tier, "complex");
});

test("nível forçado é respeitado e avisa quando fica abaixo da conversa", () => {
  const d = decide({ ...base, override: "simple", floor: "medium" });
  assert.equal(d.tier, "simple");
  assert.equal(d.auto, false);
  assert.ok(d.reasons.some((r) => r.includes("abaixo do nível da conversa")));
});

test("modo planejar escolhido manualmente", () => {
  const d = decide({ ...base, override: "plan" });
  assert.equal(d.plan, true);
  assert.equal(d.tier, "medium");
});

test("sinais: nada de errado mantém o nível", () => {
  const cfg = { failedCommands: 2, filesChanged: 8 };
  assert.deepEqual(escalationSignals({ status: "completed", failedCommands: 1, failedFileChanges: 0, filesChanged: 3 }, cfg), []);
});

test("sinais: falha, comandos com erro e muitos arquivos sobem o nível", () => {
  const cfg = { failedCommands: 2, filesChanged: 8 };
  assert.deepEqual(escalationSignals({ status: "failed", failedCommands: 0, failedFileChanges: 0, filesChanged: 0 }, cfg), ["o pedido falhou"]);
  assert.equal(escalationSignals({ status: "completed", failedCommands: 2, failedFileChanges: 0, filesChanged: 0 }, cfg).length, 1);
  assert.equal(escalationSignals({ status: "completed", failedCommands: 0, failedFileChanges: 1, filesChanged: 0 }, cfg).length, 1);
  assert.equal(escalationSignals({ status: "completed", failedCommands: 0, failedFileChanges: 0, filesChanged: 9 }, cfg).length, 1);
});

test("sinais: limite 0 desliga o sinal", () => {
  const cfg = { failedCommands: 0, filesChanged: 0 };
  assert.deepEqual(escalationSignals({ status: "completed", failedCommands: 9, failedFileChanges: 0, filesChanged: 99 }, cfg), []);
});

test("pedido interrompido não sobe o nível", () => {
  const cfg = { failedCommands: 2, filesChanged: 8 };
  assert.deepEqual(escalationSignals({ status: "interrupted", failedCommands: 0, failedFileChanges: 0, filesChanged: 0 }, cfg), []);
});

test("erros resolvidos no meio do pedido não contam (caso real: rg sem resultado e depois sucesso)", () => {
  const stats: TurnStats = { status: "inProgress", failedCommands: 0, failedFileChanges: 0, filesChanged: 0 };
  // Sequência do registro real: Get-ChildItem ok, rg exit 1, Get-ChildItem exit 1, Get-ChildItem ok, python ok.
  for (const failed of [false, true, true, false, false]) trackCommand(stats, failed);
  stats.status = "completed";
  assert.equal(stats.failedCommands, 0);
  assert.deepEqual(escalationSignals(stats, { failedCommands: 2, filesChanged: 8 }), []);
});

test("executar um plano: muitos arquivos não sobe o nível, mas falha e erros sobem (caso real: 12 arquivos)", () => {
  const cfg = signalsForTurn({ failedCommands: 2, filesChanged: 8 }, "execute");
  assert.deepEqual(escalationSignals({ status: "completed", failedCommands: 0, failedFileChanges: 0, filesChanged: 12 }, cfg), []);
  assert.equal(escalationSignals({ status: "completed", failedCommands: 2, failedFileChanges: 0, filesChanged: 12 }, cfg).length, 1);
  assert.deepEqual(escalationSignals({ status: "failed", failedCommands: 0, failedFileChanges: 0, filesChanged: 0 }, cfg), ["o pedido falhou"]);
  assert.equal(escalationSignals({ status: "completed", failedCommands: 0, failedFileChanges: 0, filesChanged: 12 }, signalsForTurn({ failedCommands: 2, filesChanged: 8 }, "normal")).length, 1);
});

test("terminar com erros seguidos sobe o nível", () => {
  const stats: TurnStats = { status: "inProgress", failedCommands: 0, failedFileChanges: 0, filesChanged: 0 };
  for (const failed of [false, true, true]) trackCommand(stats, failed);
  stats.status = "completed";
  assert.equal(stats.failedCommands, 2);
  assert.equal(escalationSignals(stats, { failedCommands: 2, filesChanged: 8 }).length, 1);
});

// ---------- Idiomas e nomes antigos ----------

test("inglês: motivos, sinais e avisos saem em inglês", () => {
  setLocale("en");
  try {
    assert.ok(classify("explain this function", config).reasons.some((r) => r.startsWith("explanation")));
    const d = decide({ ...base, classified: cls("simple"), floor: "medium", floorReasons: [] });
    assert.ok(d.reasons.some((r) => r.includes("kept at medium by the conversation")));
    assert.deepEqual(escalationSignals({ status: "failed", failedCommands: 0, failedFileChanges: 0, filesChanged: 0 }, { failedCommands: 2, filesChanged: 8 }), ["the request failed"]);
    const models: ModelInfo[] = [{ id: "a", isDefault: true, defaultReasoningEffort: "low", supportedReasoningEfforts: ["low"] }];
    assert.equal(resolveTier({ model: "x", effort: "low" }, models).notes[0], 'model "x" not available, using "a"');
  } finally {
    setLocale("pt");
  }
});

test("português: nomes dos níveis traduzidos", () => {
  const d = decide({ ...base, classified: cls("simple"), floor: "complex", floorReasons: [] });
  assert.ok(d.reasons.some((r) => r.includes("mantido em complexa pela conversa")));
});

test("dicionários: inglês e português têm as mesmas chaves e os mesmos parâmetros", async () => {
  setLocale("en");
  const keys = Object.keys(dictionary()) as MessageKey[];
  assert.ok(keys.length > 100);
  for (const key of keys) {
    setLocale("en");
    const en = (t(key).match(/\{\w+\}/g) ?? []).sort();
    setLocale("pt");
    const pt = (t(key).match(/\{\w+\}/g) ?? []).sort();
    assert.deepEqual(pt, en, key);
  }
});

test("nomes antigos dos níveis (simples, media, complexa) continuam valendo", () => {
  assert.equal(toTierName("simples"), "simple");
  assert.equal(toTierName("media"), "medium");
  assert.equal(toTierName("média"), "medium");
  assert.equal(toTierName("complexa"), "complex");
  assert.equal(toTierName("Medium"), "medium");
  assert.equal(toTierName("outro"), undefined);
  assert.deepEqual(normalizeTierKeys({ simples: 1, media: 2, complexa: 3, lixo: 4 }), { simple: 1, medium: 2, complex: 3 });
});
