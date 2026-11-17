// Textos da extensão em inglês e português. Não depende do VS Code, para o classificador poder ser testado isolado.

export type Locale = "en" | "pt";

const en = {
  // Níveis
  "tier.simple": "simple",
  "tier.medium": "medium",
  "tier.complex": "complex",

  // Classificador
  "reason.veryLong": "very long request",
  "reason.long": "long request",
  "reason.mediumLength": "medium-length request",
  "rule.architecture": "architecture",
  "rule.migration": "migration",
  "rule.fromScratch": "build from scratch",
  "rule.concurrency": "concurrency",
  "rule.security": "security",
  "rule.refactor": "refactoring",
  "rule.performance": "performance",
  "rule.feature": "new feature",
  "rule.debug": "debugging",
  "rule.broadScope": "broad scope",
  "rule.data": "integration/data",
  "rule.tests": "tests",
  "rule.explain": "explanation",
  "rule.smallFix": "small fix",
  "rule.comments": "comments",
  "rule.formatting": "formatting",
  "rule.translation": "translation",
  "rule.smallScope": "small scope",
  "reason.keyword": 'keyword "{kw}"',
  "reason.steps": "{n} steps listed",
  "reason.files": "{n} files mentioned",
  "reason.stackTrace": "pasted stack trace",
  "reason.selection": "{n} lines selected",
  "reason.shortQuestion": "short question",
  "reason.none": "no complexity signals",

  // Decisão
  "decide.planManual": "plan → execute chosen manually",
  "decide.manual": "tier chosen manually",
  "decide.belowFloor": "below the conversation tier ({tier})",
  "decide.planAuto": "complex request: plan with the strong model, execute with the mid-tier one",
  "decide.keptByFloor": "kept at {tier} by the conversation{why}",
  "decide.manualUp": "tier raised manually",
  "floor.keepsCache": "conversation already uses {tier} (keeps the cache)",

  // Sinais
  "signal.failed": "the request failed",
  "signal.failedCommands": "ended with {n} failed commands in a row",
  "signal.failedFileChanges": "failed to apply changes",
  "signal.filesChanged": "{n} files changed",

  // Modelos
  "resolve.modelUnavailable": 'model "{model}" not available, using "{fallback}"',
  "resolve.effortUnsupported": 'effort "{effort}" not supported by {model}, using "{fallback}"',
  "note.modelSwitch": "model switch ({from} → {to}): this conversation's history will be reprocessed without cache",

  // Textos enviados ao Codex
  "prompt.plan":
    "\n\n---\nPlanning mode: do NOT change files and do not run commands that modify the project. " +
    "Read what you need and reply with a short, concrete numbered plan: files to change, steps and how to verify. " +
    "Another model will execute the plan next, so be specific.",
  "prompt.execute": "Execute the plan above. Follow the steps in order and verify the result at the end.",
  "prompt.windows":
    "In this environment (Windows with sandbox), terminal commands take 5 to 30 seconds to finish. " +
    "When running commands, use a long wait time (yield_time_ms of 15000 or more in exec_command and wait) " +
    "instead of polling the result every second; each extra poll costs a full model call.",
  "prompt.selection": "Selected code ({label}):",

  // Servidor
  "server.exitedDuring": "codex app-server exited during {method}",
  "server.spawnFailed": 'could not start "{cmd}": {error}',
  "server.notRunning": "codex app-server is not running",
  "server.unsupported": "SmartShift does not support {method} yet",
  "codex.notFound": "Codex was not found on this computer.",

  // Status
  "status.noFolder": "Open your project folder to use Codex.",
  "status.notInstalled":
    "Codex is not installed. SmartShift needs it to work.\nInstall it with the button below (requires Node.js) or choose the Codex executable.",
  "status.starting": "Starting Codex ({cmd})...",
  "status.exited": "Codex stopped. Send again to restart.",
  "status.startFailed": 'Could not start Codex at "{cmd}".\n{error}',
  "status.sandboxSetup": "Setting up the Windows sandbox...",
  "status.needsLogin": "Sign in with your ChatGPT account to use Codex.",
  "status.ready": "Ready · {who} · {n} models",
  "status.connected": "connected account",
  "status.installing": "Installing Codex in the terminal. When it finishes, click Try again.",
  "status.loginBrowser": "Finish signing in in your browser...",
  "status.loginFailed": "Sign-in failed: {error}",
  "status.tryAgain": "try again",
  "action.openFolder": "Open folder",
  "action.installCodex": "Install Codex",
  "action.pickCodex": "Choose executable…",
  "action.retry": "Try again",
  "action.showLog": "Show log",
  "action.login": "Sign in with ChatGPT",
  "terminal.install": "Install Codex",
  "dialog.pickCodex": "Choose the Codex executable",

  // Sandbox do Windows
  "sandbox.elevated": "Set up (asks for admin)",
  "sandbox.unelevated": "Set up without admin",
  "sandbox.notNow": "Not now",
  "sandbox.updateRequired": "The Codex Windows sandbox needs an update. Until then, Codex can only read files.",
  "sandbox.notConfigured": "The Codex Windows sandbox is not set up. Until then, Codex can only read files.",
  "sandbox.done": "Windows sandbox is set up: Codex can now edit project files.",
  "sandbox.failed": "Could not set up the Windows sandbox: {error}",
  "note.readOnly": "Note: Codex is read-only in this conversation (on Windows, set up the sandbox when prompted).",

  // Conversa
  "msg.busy": "Wait for the current request to finish or interrupt it.",
  "sys.executingPlan": "Executing the plan with {model} (effort {effort})",
  "note.unknownError": "unknown error",
  "note.rerouted": "Codex switched {from} to {to} ({reason})",
  "note.escalated": "Next requests in this conversation use at least {tier}: {reasons}.",
  "activity.reasoning": "thinking",
  "activity.commandExecution": "running a command",
  "activity.fileChange": "editing files",
  "activity.agentMessage": "writing",
  "activity.mcpToolCall": "using a tool",
  "activity.webSearch": "searching the web",
  "activity.contextCompaction": "summarizing the history",
  "activity.starting": "starting",
  "tool.exitCode": "exit code {code}",
  "tool.running": "running...",
  "tool.filesChanged": "Files changed",
  "tool.search": "Search: {q}",
  "tool.mcp": "Tool: {name}",

  // Aprovação
  "approval.command": "Codex wants to run a command.",
  "approval.files": "Codex wants to change files.",
  "approval.allow": "Allow",
  "approval.allowSession": "Allow for this session",
  "approval.deny": "Deny",
  "approval.commandLabel": "Command: {v}",
  "approval.folderLabel": "Folder: {v}",
  "approval.reasonLabel": "Reason: {v}",

  // Painel (HTML e main.js)
  "ui.overrideTitle": "How to pick the model",
  "ui.auto": "Automatic",
  "ui.plan": "Plan → execute",
  "ui.force": "Force {tier}",
  "ui.new": "New",
  "ui.newTitle": "New conversation",
  "ui.placeholder": "Ask Codex something. Ctrl+Enter sends.",
  "ui.stop": "Interrupt",
  "ui.send": "Send",
  "ui.modeAuto": "Auto",
  "ui.modeManual": "Manual",
  "ui.routePlan": "{mode} · plan with {pm} ({pe}) → execute with {m} ({e})",
  "ui.routeSingle": "{mode} · {tier} · {m} · effort {e}",
  "ui.routeScore": " · score {n}",
  "ui.willUse": "Will use: {route}",
  "ui.working": "Codex working · {activity} · {time}",
  "ui.selection": "Selection included: {label}",
  "ui.floor": "Conversation tier: {tier}",
  "ui.floorTip": "Goes up during the conversation; back to simple in a new conversation.",
  "ui.usage": "{model} · {calls} model calls · {tokens} tokens · {pct}% of input from cache",
  "ui.runPlan": "Execute plan with {model} ({effort})",
  "ui.discard": "Discard",
  "ui.interrupted": "Request interrupted.",
  "ui.failed": "The request failed: {error}",
  "ui.retryUp": "Retry at tier {tier}",
  "ui.notGood": "Not good enough? Retry at tier {tier}",
  "ui.seeLog": " Show log",
};

export type MessageKey = keyof typeof en;

const pt: Record<MessageKey, string> = {
  "tier.simple": "simples",
  "tier.medium": "média",
  "tier.complex": "complexa",

  "reason.veryLong": "pedido muito longo",
  "reason.long": "pedido longo",
  "reason.mediumLength": "pedido médio",
  "rule.architecture": "arquitetura",
  "rule.migration": "migração",
  "rule.fromScratch": "construir do zero",
  "rule.concurrency": "concorrência",
  "rule.security": "segurança",
  "rule.refactor": "refatoração",
  "rule.performance": "desempenho",
  "rule.feature": "nova funcionalidade",
  "rule.debug": "depuração",
  "rule.broadScope": "escopo amplo",
  "rule.data": "integração/dados",
  "rule.tests": "testes",
  "rule.explain": "explicação",
  "rule.smallFix": "ajuste pontual",
  "rule.comments": "comentários",
  "rule.formatting": "formatação",
  "rule.translation": "tradução",
  "rule.smallScope": "escopo pequeno",
  "reason.keyword": 'palavra-chave "{kw}"',
  "reason.steps": "{n} etapas listadas",
  "reason.files": "{n} arquivos citados",
  "reason.stackTrace": "stack trace colado",
  "reason.selection": "{n} linhas selecionadas",
  "reason.shortQuestion": "pergunta curta",
  "reason.none": "nenhum sinal de complexidade",

  "decide.planManual": "planejar → executar escolhido manualmente",
  "decide.manual": "nível escolhido manualmente",
  "decide.belowFloor": "abaixo do nível da conversa ({tier})",
  "decide.planAuto": "pedido complexo: planejar com o modelo forte, executar com o intermediário",
  "decide.keptByFloor": "mantido em {tier} pela conversa{why}",
  "decide.manualUp": "subiu de nível manualmente",
  "floor.keepsCache": "conversa já usa {tier} (mantém o cache)",

  "signal.failed": "o pedido falhou",
  "signal.failedCommands": "terminou com {n} comandos seguidos com erro",
  "signal.failedFileChanges": "falha ao aplicar alterações",
  "signal.filesChanged": "{n} arquivos alterados",

  "resolve.modelUnavailable": 'modelo "{model}" indisponível, usando "{fallback}"',
  "resolve.effortUnsupported": 'esforço "{effort}" não suportado por {model}, usando "{fallback}"',
  "note.modelSwitch": "troca de modelo ({from} → {to}): o histórico desta conversa será reprocessado sem cache",

  "prompt.plan":
    "\n\n---\nModo planejamento: NÃO altere arquivos e não execute comandos que modifiquem o projeto. " +
    "Leia o que precisar e responda com um plano numerado, curto e concreto: arquivos a alterar, passos e como verificar. " +
    "O plano será executado em seguida por outro modelo, então seja específico.",
  "prompt.execute": "Execute o plano acima. Siga os passos na ordem e verifique o resultado no final.",
  "prompt.windows":
    "Neste ambiente (Windows com sandbox), os comandos de terminal levam de 5 a 30 segundos para terminar. " +
    "Ao executar comandos, use um tempo de espera longo (yield_time_ms de 15000 ou mais em exec_command e em wait) " +
    "em vez de consultar o resultado a cada segundo; cada consulta extra custa uma chamada inteira ao modelo.",
  "prompt.selection": "Trecho selecionado ({label}):",

  "server.exitedDuring": "codex app-server encerrou durante {method}",
  "server.spawnFailed": 'não foi possível iniciar "{cmd}": {error}',
  "server.notRunning": "codex app-server não está rodando",
  "server.unsupported": "SmartShift ainda não suporta {method}",
  "codex.notFound": "Codex não encontrado neste computador.",

  "status.noFolder": "Abra a pasta do seu projeto para usar o Codex.",
  "status.notInstalled":
    "O Codex não está instalado. O SmartShift precisa dele para funcionar.\nInstale com o botão abaixo (requer Node.js) ou escolha o executável do Codex.",
  "status.starting": "Iniciando o Codex ({cmd})...",
  "status.exited": "O Codex encerrou. Envie de novo para reiniciar.",
  "status.startFailed": 'Não foi possível iniciar o Codex em "{cmd}".\n{error}',
  "status.sandboxSetup": "Configurando o sandbox do Windows...",
  "status.needsLogin": "Entre com sua conta do ChatGPT para usar o Codex.",
  "status.ready": "Pronto · {who} · {n} modelos",
  "status.connected": "conta conectada",
  "status.installing": "Instalando o Codex no terminal. Quando terminar, clique em Tentar de novo.",
  "status.loginBrowser": "Conclua o login no navegador...",
  "status.loginFailed": "Login falhou: {error}",
  "status.tryAgain": "tente de novo",
  "action.openFolder": "Abrir pasta",
  "action.installCodex": "Instalar o Codex",
  "action.pickCodex": "Escolher executável…",
  "action.retry": "Tentar de novo",
  "action.showLog": "Ver log",
  "action.login": "Entrar com ChatGPT",
  "terminal.install": "Instalar Codex",
  "dialog.pickCodex": "Escolha o executável do Codex",

  "sandbox.elevated": "Configurar (pede administrador)",
  "sandbox.unelevated": "Configurar sem administrador",
  "sandbox.notNow": "Agora não",
  "sandbox.updateRequired": "O sandbox do Windows do Codex precisa ser atualizado. Até lá, o Codex só consegue ler arquivos.",
  "sandbox.notConfigured": "O sandbox do Windows do Codex não está configurado. Até lá, o Codex só consegue ler arquivos.",
  "sandbox.done": "Sandbox do Windows configurado: o Codex já pode editar arquivos do projeto.",
  "sandbox.failed": "Não foi possível configurar o sandbox do Windows: {error}",
  "note.readOnly": "Atenção: o Codex está em modo só leitura nesta conversa (no Windows, configure o sandbox quando o aviso aparecer).",

  "msg.busy": "Aguarde o pedido atual terminar ou interrompa.",
  "sys.executingPlan": "Executando o plano com {model} (esforço {effort})",
  "note.unknownError": "erro desconhecido",
  "note.rerouted": "O Codex trocou {from} por {to} ({reason})",
  "note.escalated": "Próximos pedidos desta conversa usam no mínimo {tier}: {reasons}.",
  "activity.reasoning": "pensando",
  "activity.commandExecution": "executando comando",
  "activity.fileChange": "editando arquivos",
  "activity.agentMessage": "escrevendo",
  "activity.mcpToolCall": "usando ferramenta",
  "activity.webSearch": "pesquisando na web",
  "activity.contextCompaction": "resumindo o histórico",
  "activity.starting": "começando",
  "tool.exitCode": "código {code}",
  "tool.running": "executando...",
  "tool.filesChanged": "Arquivos alterados",
  "tool.search": "Busca: {q}",
  "tool.mcp": "Ferramenta: {name}",

  "approval.command": "O Codex quer executar um comando.",
  "approval.files": "O Codex quer alterar arquivos.",
  "approval.allow": "Permitir",
  "approval.allowSession": "Permitir nesta sessão",
  "approval.deny": "Negar",
  "approval.commandLabel": "Comando: {v}",
  "approval.folderLabel": "Pasta: {v}",
  "approval.reasonLabel": "Motivo: {v}",

  "ui.overrideTitle": "Como escolher o modelo",
  "ui.auto": "Automático",
  "ui.plan": "Planejar → executar",
  "ui.force": "Forçar {tier}",
  "ui.new": "Nova",
  "ui.newTitle": "Nova conversa",
  "ui.placeholder": "Peça algo ao Codex. Ctrl+Enter envia.",
  "ui.stop": "Interromper",
  "ui.send": "Enviar",
  "ui.modeAuto": "Auto",
  "ui.modeManual": "Manual",
  "ui.routePlan": "{mode} · planejar com {pm} ({pe}) → executar com {m} ({e})",
  "ui.routeSingle": "{mode} · {tier} · {m} · esforço {e}",
  "ui.routeScore": " · pontos {n}",
  "ui.willUse": "Vai usar: {route}",
  "ui.working": "Codex trabalhando · {activity} · {time}",
  "ui.selection": "Seleção incluída: {label}",
  "ui.floor": "Nível da conversa: {tier}",
  "ui.floorTip": "Sobe conforme a conversa; volta a simples numa conversa nova.",
  "ui.usage": "{model} · {calls} chamadas ao modelo · {tokens} tokens · {pct}% da entrada veio do cache",
  "ui.runPlan": "Executar plano com {model} ({effort})",
  "ui.discard": "Descartar",
  "ui.interrupted": "Pedido interrompido.",
  "ui.failed": "O pedido falhou: {error}",
  "ui.retryUp": "Repetir com nível {tier}",
  "ui.notGood": "Não ficou bom? Repetir com nível {tier}",
  "ui.seeLog": " Ver log",
};

const dictionaries: Record<Locale, Record<MessageKey, string>> = { en, pt };

let current: Locale = "en";

/** "pt", "pt-br", "pt-BR" → português; qualquer outro → inglês. */
export function toLocale(language: string | undefined): Locale {
  return language?.toLowerCase().startsWith("pt") ? "pt" : "en";
}

export function setLocale(locale: Locale): void {
  current = locale;
}

export function getLocale(): Locale {
  return current;
}

export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  return dictionaries[current][key].replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

/** Nome do nível no idioma atual. */
export function tierLabel(tier: "simple" | "medium" | "complex"): string {
  return t(`tier.${tier}`);
}

/** Dicionário inteiro do idioma atual, para o painel (webview). */
export function dictionary(): Record<MessageKey, string> {
  return dictionaries[current];
}
