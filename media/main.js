// @ts-check
(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi();
  const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
  const log = $("log");
  const input = /** @type {HTMLTextAreaElement} */ ($("input"));
  const override = /** @type {HTMLSelectElement} */ ($("override"));
  const preview = $("preview");
  const status = $("status");
  const sendBtn = /** @type {HTMLButtonElement} */ ($("send"));
  const stopBtn = $("stop");
  const statusActions = $("status-actions");

  /** @type {Record<string, string>} */
  const strings = JSON.parse($("strings").textContent || "{}");
  /** Texto no idioma da extensão, com {parâmetros}. */
  function t(key, params = {}) {
    return (strings[key] ?? key).replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
  }
  const tierLabel = (tier) => t("tier." + tier);

  const saved = vscode.getState() || {};
  if (saved.override && [...override.options].some((o) => o.value === saved.override)) override.value = saved.override;

  /** @type {Map<string, HTMLElement>} */
  const agentEls = new Map();
  /** @type {Map<string, HTMLElement>} */
  const toolEls = new Map();

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function scroll() {
    log.scrollTop = log.scrollHeight;
  }

  function routeLabel(r) {
    const mode = r.auto ? t("ui.modeAuto") : t("ui.modeManual");
    const head = r.plan
      ? t("ui.routePlan", { mode, pm: r.plan.model, pe: r.plan.effort, m: r.model, e: r.effort })
      : t("ui.routeSingle", { mode, tier: tierLabel(r.tier), m: r.model, e: r.effort });
    return r.score !== undefined ? head + t("ui.routeScore", { n: r.score }) : head;
  }

  function fmtTokens(n) {
    return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n);
  }

  function routeDetails(r) {
    return [...r.reasons, ...r.notes.map((n) => "⚠ " + n)].join("\n");
  }

  let workingTimer;
  let workingStart = 0;
  let activity = "";
  function renderWorking() {
    const s = Math.floor((Date.now() - workingStart) / 1000);
    const time = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    $("working-text").textContent = t("ui.working", { activity, time });
  }

  let previewTimer;
  function requestPreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      if (!input.value.trim()) {
        preview.textContent = "";
        return;
      }
      vscode.postMessage({ type: "preview", text: input.value, override: override.value });
    }, 250);
  }

  function send() {
    const text = input.value;
    if (!text.trim() || sendBtn.disabled) return;
    vscode.postMessage({ type: "send", text, override: override.value });
    input.value = "";
    preview.textContent = "";
  }

  sendBtn.addEventListener("click", send);
  stopBtn.addEventListener("click", () => vscode.postMessage({ type: "interrupt" }));
  $("new").addEventListener("click", () => vscode.postMessage({ type: "newThread" }));
  input.addEventListener("input", requestPreview);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      send();
    }
  });
  override.addEventListener("change", () => {
    vscode.setState({ ...vscode.getState(), override: override.value });
    requestPreview();
  });

  window.addEventListener("message", (event) => {
    const m = event.data;
    switch (m.type) {
      case "status":
        status.textContent = m.message;
        status.className = "status " + m.state;
        statusActions.replaceChildren();
        for (const [i, a] of (m.actions || []).entries()) {
          const b = el("button", i === 0 ? "" : "secondary", a.label);
          b.addEventListener("click", () => vscode.postMessage({ type: a.type }));
          statusActions.appendChild(b);
        }
        if (m.state === "error" && !(m.actions || []).some((a) => a.type === "showLog")) {
          const link = el("a", "", t("ui.seeLog"));
          link.href = "#";
          link.addEventListener("click", () => vscode.postMessage({ type: "showLog" }));
          status.appendChild(link);
        }
        break;
      case "preview":
        // Avisos (troca de modelo = perda de cache, modelo indisponível) ficam visíveis, não só no tooltip.
        preview.replaceChildren(
          el("div", "", t("ui.willUse", { route: routeLabel(m.route) })),
          ...m.route.notes.map((n) => el("div", "warn", "⚠ " + n)),
        );
        preview.title = routeDetails(m.route);
        break;
      case "busy":
        sendBtn.disabled = m.busy;
        stopBtn.classList.toggle("hidden", !m.busy);
        $("working").classList.toggle("hidden", !m.busy);
        clearInterval(workingTimer);
        if (m.busy) {
          workingStart = Date.now();
          activity = t("activity.starting");
          renderWorking();
          workingTimer = setInterval(renderWorking, 1000);
        }
        break;
      case "activity":
        activity = m.text;
        renderWorking();
        break;
      case "userMessage": {
        const box = el("div", "msg user");
        box.appendChild(el("div", "text", m.text));
        if (m.selection) box.appendChild(el("div", "meta", t("ui.selection", { label: m.selection })));
        const badge = el("details", "route");
        badge.appendChild(el("summary", "", routeLabel(m.route)));
        badge.appendChild(el("pre", "", routeDetails(m.route)));
        box.appendChild(badge);
        log.appendChild(box);
        scroll();
        break;
      }
      case "agentDelta": {
        let e = agentEls.get(m.itemId);
        if (!e) {
          e = el("div", "msg agent");
          agentEls.set(m.itemId, e);
          log.appendChild(e);
        }
        e.textContent += m.delta;
        scroll();
        break;
      }
      case "agentDone": {
        let e = agentEls.get(m.itemId);
        if (!e) {
          e = el("div", "msg agent");
          agentEls.set(m.itemId, e);
          log.appendChild(e);
        }
        e.textContent = m.text;
        scroll();
        break;
      }
      case "tool": {
        let e = toolEls.get(m.itemId);
        if (!e) {
          e = el("details", "tool");
          toolEls.set(m.itemId, e);
          log.appendChild(e);
        }
        e.classList.toggle("failed", !!m.failed);
        e.replaceChildren(el("summary", "", `${m.title}${m.detail ? " — " + m.detail : ""}`));
        if (m.body) e.appendChild(el("pre", "", m.body));
        scroll();
        break;
      }
      case "note":
        log.appendChild(el("div", "note " + m.kind, m.text));
        scroll();
        break;
      case "systemMessage":
        log.appendChild(el("div", "msg system", m.text));
        scroll();
        break;
      case "floor": {
        const floor = $("floor");
        floor.textContent = t("ui.floor", { tier: tierLabel(m.tier) });
        floor.title = m.reasons.length ? m.reasons.join("\n") : t("ui.floorTip");
        floor.className = "floor " + m.tier;
        break;
      }
      case "usage":
        log.appendChild(el("div", "usage", t("ui.usage", { model: m.model, calls: m.calls, tokens: fmtTokens(m.total), pct: m.cachedPct })));
        scroll();
        break;
      case "planReady": {
        const box = el("div", "plan-actions");
        const run = el("button", "", t("ui.runPlan", { model: m.model, effort: m.effort }));
        const discard = el("button", "secondary", t("ui.discard"));
        run.addEventListener("click", () => {
          box.remove();
          vscode.postMessage({ type: "executePlan" });
        });
        discard.addEventListener("click", () => {
          box.remove();
          vscode.postMessage({ type: "discardPlan" });
        });
        box.append(run, discard);
        log.appendChild(box);
        scroll();
        break;
      }
      case "turnDone": {
        if (m.status !== "completed") {
          const box = el("div", "note error", m.status === "interrupted" ? t("ui.interrupted") : t("ui.failed", { error: m.error || m.status }));
          if (m.canEscalate) {
            const b = el("button", "", t("ui.retryUp", { tier: tierLabel(m.next) }));
            b.addEventListener("click", () => {
              b.remove();
              vscode.postMessage({ type: "escalate" });
            });
            box.appendChild(b);
          }
          log.appendChild(box);
        } else if (m.next) {
          const row = el("div", "after");
          const b = el("button", "link", t("ui.notGood", { tier: tierLabel(m.next) }));
          b.addEventListener("click", () => {
            row.remove();
            vscode.postMessage({ type: "escalate" });
          });
          row.appendChild(b);
          log.appendChild(row);
        }
        scroll();
        break;
      }
      case "reset":
        log.replaceChildren();
        agentEls.clear();
        toolEls.clear();
        break;
    }
  });

  vscode.postMessage({ type: "ready" });
})();
