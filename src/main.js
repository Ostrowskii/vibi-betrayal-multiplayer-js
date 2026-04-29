import "./styles.css";

import { ASSETS } from "./assets.js";
import {
  normalizeUCType,
  PHASE_LABELS,
  UC_LABELS,
  UC_TYPES,
  UE_LABELS,
  UE_TYPES,
} from "./game/constants.js";
import { getVictoryLabel } from "./game/engine.js";
import { VIBINET_SERVER_LABEL } from "./network/config.js";
import { OfficialServerProbe } from "./network/server-probe.js";
import { MatchSession } from "./network/session.js";

const root = document.querySelector("#app");

const app = {
  form: {
    user: "",
    room: "",
  },
  serverProbe: new OfficialServerProbe(),
  session: null,
  state: null,
  notice: "",
  lastMarkup: "",
  lastPhase: null,
  lastScreen: null,
  hadLiveMatch: false,
};

const audioPool = new Map();

function captureActiveField() {
  const active = document.activeElement;
  if (!active || active.tagName !== "INPUT") return null;
  const field = active.dataset.field;
  if (!field) return null;
  return {
    field,
    start: active.selectionStart ?? null,
    end: active.selectionEnd ?? null,
  };
}

function restoreActiveField(snapshot) {
  if (!snapshot) return;
  const input = root.querySelector(`input[data-field="${snapshot.field}"]`);
  if (!input) return;
  input.focus();
  if (snapshot.start !== null && snapshot.end !== null) {
    input.setSelectionRange(snapshot.start, snapshot.end);
  }
}

function syncFormInputs() {
  const inputs = root.querySelectorAll("input[data-field]");
  for (const input of inputs) {
    const field = input.dataset.field;
    if (!field) continue;
    const wanted = app.form[field] ?? "";
    if (input.value !== wanted) {
      input.value = wanted;
    }
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function serverStatus() {
  return (
    app.serverProbe?.snapshot() ?? {
      kind: "checking",
      text: `Verificando ${VIBINET_SERVER_LABEL}...`,
      detail: "",
    }
  );
}

function playSound(key, volume = 0.7) {
  const src = ASSETS.sounds[key];
  if (!src) return;
  let audio = audioPool.get(key);
  if (!audio) {
    audio = new Audio(src);
    audioPool.set(key, audio);
  }
  const clone = audio.cloneNode();
  clone.volume = volume;
  clone.play().catch(() => {});
}

function localSeat(state) {
  if (!state || !app.form.user) return null;
  if (state.players.C1.name === app.form.user) return "C1";
  if (state.players.C2.name === app.form.user) return "C2";
  return null;
}

function perspectiveSeats(state) {
  const self = localSeat(state) ?? "C1";
  return {
    self,
    enemy: self === "C1" ? "C2" : "C1",
  };
}

function getCastleIcon(seat, gray = false) {
  if (seat === "C1") return gray ? ASSETS.castle1Gray : ASSETS.castle1;
  return gray ? ASSETS.castle2Gray : ASSETS.castle2;
}

function getCardArt(card, disabled = false) {
  const key = normalizeUCType(card);
  if (!key) return ASSETS.cardBack;
  const set = ASSETS.cards[key];
  if (!set) return ASSETS.cardBack;
  return disabled ? set.gray : set.color;
}

function cardCountBadge(player, card) {
  if (card === "invader") return `x${player.ues.invader.available}`;
  if (card === "tribute") return `x${player.ues.tribute.available}`;
  return "";
}

function getCardDisabled(player, card, handType) {
  if (handType === "uc") {
    if (card === "dummy") return false;
    return player.ucs[normalizeUCType(card)].status === "dead";
  }
  if (card === "assassin") return player.ues.assassin.status !== "alive";
  if (card === "spy") return player.ues.spy.status !== "active";
  if (card === "invader") return player.ues.invader.available <= 0;
  if (card === "tribute") {
    return player.tradeRouteBlockedThisTurn || player.ues.tribute.available <= 0;
  }
  return (
    player.tradeRouteBlockedThisTurn ||
    player.ues.poisoned_tribute.status !== "active"
  );
}

function renderCardButton({ card, handType, player, seat, interactive }) {
  const normalizedCard = handType === "uc" ? normalizeUCType(card) : card;
  const label = handType === "uc" ? UC_LABELS[normalizedCard] : UE_LABELS[card];
  const selected =
    handType === "uc"
      ? normalizeUCType(player.selectedUC) === normalizedCard
      : player.selectedUE === card;

  const disabled = getCardDisabled(player, card, handType);
  const badge = cardCountBadge(player, card);
  const action = handType === "uc" ? "select-uc" : "select-ue";
  const disabledClass = disabled || !interactive ? "is-disabled" : "";
  const selectedClass = selected ? "is-selected" : "";
  const disabledAttr = disabled || !interactive ? "disabled" : "";

  return `
    <button
      class="card-button ${disabledClass} ${selectedClass}"
      data-action="${action}"
      data-card="${normalizedCard}"
      data-seat="${seat}"
      ${disabledAttr}
    >
      <img src="${getCardArt(card, disabled)}" alt="${escapeHtml(label)}" />
      <span class="card-title">${escapeHtml(label)}</span>
      ${badge ? `<span class="card-badge">${escapeHtml(badge)}</span>` : ""}
      <span class="card-status">${selected ? "Selecionado" : "Toque para escolher"}</span>
    </button>
  `;
}

function renderSelectionGroup({
  title,
  hint,
  cards,
  handType,
  player,
  seat,
  interactive,
  tone,
}) {
  const kindClass = handType === "uc" ? "is-rest" : "is-attack";

  return `
    <section class="selection-group ${kindClass}">
      <div class="selection-head">
        <span class="selection-kicker">${escapeHtml(title)}</span>
        <strong>${escapeHtml(hint)}</strong>
      </div>
      <div class="selection-strip ${kindClass} ${tone}">
        ${cards
          .map((card) =>
            renderCardButton({
              card,
              handType,
              player,
              seat,
              interactive,
            }),
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderOwnChoices(state, seat) {
  const player = state.players[seat];
  const interactive =
    state.screen === "game" &&
    state.phase === "phase_1_selection" &&
    !player.confirmed;
  const showConfirm = state.screen === "game" && state.phase === "phase_1_selection";

  return `
    <div class="selection-stack">
      ${renderSelectionGroup({
        title: "Descanso",
        hint: "Escolha quem descansa neste turno.",
        cards: UC_TYPES,
        handType: "uc",
        player,
        seat,
        interactive,
        tone: "tone-rest",
      })}
      ${renderSelectionGroup({
        title: "Ataque",
        hint: "Escolha qual estrategia enviar ao inimigo.",
        cards: UE_TYPES,
        handType: "ue",
        player,
        seat,
        interactive,
        tone: "tone-attack",
      })}
      ${showConfirm ? renderConfirmBar(state, seat) : ""}
    </div>
  `;
}

function renderConfirmBar(state, seat) {
  const player = state.players[seat];
  const enemy = state.players[seat === "C1" ? "C2" : "C1"];
  const canConfirm =
    state.screen === "game" &&
    state.phase === "phase_1_selection" &&
    !player.confirmed &&
    player.selectedUC &&
    player.selectedUE;
  const buttonLabel = player.confirmed ? "Aguardando" : "Confirmar";
  const helperText = player.confirmed
    ? "Suas escolhas foram travadas."
    : "Escolha descanso e ataque para fechar o turno.";
  const enemyText = enemy.confirmed ? "Confirmado" : "Aguardando";
  const disabledAttr = canConfirm ? "" : "disabled";

  return `
    <div class="confirm-bar">
      <div class="confirm-copy">
        <strong>${escapeHtml(buttonLabel)}</strong>
        <span>${escapeHtml(helperText)}</span>
        <span>Inimigo: ${escapeHtml(enemyText)}</span>
      </div>
      <button
        class="confirm-button ${player.confirmed ? "is-waiting" : ""}"
        data-action="confirm-selection"
        data-seat="${seat}"
        ${player.confirmed ? "disabled" : disabledAttr}
      >
        ${escapeHtml(buttonLabel)}
      </button>
    </div>
  `;
}

function renderDecisionCard({
  title,
  slot,
  emptyLabel,
  emptyDetail,
}) {
  const visible = Boolean(slot?.card) && slot.revealed && !slot.hidden;
  const label = visible ? UC_LABELS[slot.card] ?? UE_LABELS[slot.card] : emptyLabel;
  const image = visible ? getCardArt(slot.card, false) : ASSETS.cardBack;
  const stateClass = visible ? "is-revealed" : "is-empty";
  const detail = visible ? slot.detail || "Aviso publico." : emptyDetail;

  return `
    <article class="decision-card ${stateClass}">
      <div class="decision-card-top">
        <span class="decision-title">${escapeHtml(title)}</span>
        <span class="decision-hint">${escapeHtml(detail)}</span>
      </div>
      <div class="decision-art">
        <img src="${image}" alt="${escapeHtml(label)}" />
      </div>
      <div class="decision-caption">${escapeHtml(label)}</div>
      <div class="decision-foot">${visible ? "Aviso publico" : "Carta vazia"}</div>
    </article>
  `;
}

function slotForSeat(state, seat, role) {
  if (seat === "C1") {
    return role === "send" ? state.board.c1Send : state.board.c1Rest;
  }
  return role === "send" ? state.board.c2Send : state.board.c2Rest;
}

function renderDecisionPanel(state, seat, perspective) {
  const sendSlot = slotForSeat(state, seat, "send");
  const restSlot = slotForSeat(state, seat, "rest");
  const isSelf = perspective === "self";
  const title = isSelf ? "Seus avisos publicos" : "Avisos do inimigo";
  const subtitle = isSelf
    ? "So aparece algo aqui quando sua jogada gera aviso publico."
    : "So aparece algo aqui quando a jogada do inimigo gera aviso publico.";

  return `
    <section class="decision-panel ${isSelf ? "is-self" : "is-enemy"}">
      <div class="decision-panel-head">
        <span class="decision-kicker">${escapeHtml(title)}</span>
        <strong>${escapeHtml(subtitle)}</strong>
      </div>
      <div class="decision-grid">
        ${renderDecisionCard({
          title: "Ataque visivel",
          slot: sendSlot,
          emptyLabel: "Sem aviso",
          emptyDetail: "Nada publico foi detectado.",
        })}
        ${renderDecisionCard({
          title: "Descanso revelado",
          slot: restSlot,
          emptyLabel: "Sem info",
          emptyDetail: "Nenhuma carta de descanso foi revelada.",
        })}
      </div>
    </section>
  `;
}

function renderEnemyNote() {
  return `
    <div class="enemy-note">
      <strong>Informacao oculta.</strong>
      <span>As escolhas do inimigo aparecem no painel central quando forem reveladas pela fase.</span>
    </div>
  `;
}

function renderPlayerPanel(state, seat, perspective) {
  const player = state.players[seat];
  const isLocal = perspective === "self";
  const trustClass = player.castleTrust >= 3 ? "is-maxed" : "";
  const blockText = player.tradeRouteBlockedThisTurn ? "bloqueada" : "livre";
  const roleLabel = isLocal ? "Voce" : "Inimigo";

  return `
    <section class="player-panel ${isLocal ? "player-local" : "player-enemy"}">
      <div class="player-header">
        <div class="player-crest">
          <img src="${getCastleIcon(seat, false)}" alt="${seat}" />
        </div>
        <div class="player-heading">
          <div class="player-seat">${roleLabel}</div>
          <div class="player-name">${escapeHtml(player.name || "Aguardando...")}</div>
          <div class="player-subhead">${escapeHtml(seat)}</div>
        </div>
        <div class="player-meta">
          <span class="meta-pill ${trustClass}">Confianca ${player.castleTrust}/3</span>
          <span class="meta-pill">Guarda ${player.guardDamage}/6</span>
          <span class="meta-pill">Rota ${escapeHtml(blockText)}</span>
        </div>
      </div>
      <div class="player-body">
        ${
          isLocal
            ? renderOwnChoices(state, seat)
            : renderEnemyNote()
        }
      </div>
    </section>
  `;
}

function renderCenterStage(state) {
  const { self, enemy } = perspectiveSeats(state);

  return `
    <section class="center-stage">
      <div class="phase-panel">
        <div class="phase-kicker">Partida ${state.matchNumber}</div>
        <h1>${escapeHtml(PHASE_LABELS[state.phase] ?? state.phase)}</h1>
        <div class="phase-subline">
          <span>Turno ${state.turnNumber}</span>
          ${
            state.phaseTicksRemaining
              ? `<span>${state.phaseTicksRemaining} ticks</span>`
              : `<span>livre</span>`
          }
        </div>
      </div>
      <div class="decision-stage">
        ${renderDecisionPanel(state, enemy, "enemy")}
        ${renderDecisionPanel(state, self, "self")}
      </div>
      <div class="center-lower center-lower-single">
        <div class="event-feed">
          <div class="event-feed-title">Relatorio do tabuleiro</div>
          <div class="event-feed-list">
            ${state.publicLog
              .map((line) => `<div class="event-line">${escapeHtml(line)}</div>`)
              .join("")}
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderWinnerOverlay(state) {
  const winnerName = state.players[state.winner]?.name || state.winner;
  return `
    <div class="overlay overlay-winner" data-action="continue-winner">
      <div class="winner-shell">
        <img class="winner-title" src="${ASSETS.textWinner}" alt="Winner" />
        <img class="winner-crest" src="${getCastleIcon(state.winner)}" alt="${escapeHtml(winnerName)}" />
        <h2>${escapeHtml(winnerName)}</h2>
        <p>${escapeHtml(getVictoryLabel(state.victoryType))}</p>
        <span class="overlay-hint">toque ou pressione qualquer tecla</span>
      </div>
    </div>
  `;
}

function renderReportOverlay(state) {
  const winnerName = state.players[state.winner]?.name || state.winner || "Ninguem";

  return `
    <div class="overlay overlay-report">
      <div class="report-shell">
        <h2>Relatorio Final</h2>
        <div class="report-row"><span>Turnos</span><strong>${state.turnNumber}</strong></div>
        <div class="report-row"><span>Vencedor</span><strong>${escapeHtml(winnerName)}</strong></div>
        <div class="report-row"><span>Tipo</span><strong>${escapeHtml(
          getVictoryLabel(state.victoryType),
        )}</strong></div>
        <div class="report-actions">
          <button data-action="report-menu">Menu principal</button>
          <button class="is-accent" data-action="report-restart">Restart na mesma sala</button>
        </div>
      </div>
    </div>
  `;
}

function renderBoardScreen(state) {
  const { self, enemy } = perspectiveSeats(state);
  const overlays = [];

  if (state.screen === "winner_transition") overlays.push(renderWinnerOverlay(state));
  if (state.screen === "report") overlays.push(renderReportOverlay(state));

  return `
    <div class="screen board-screen">
      <div class="board-backdrop"></div>
      <div class="board-shell">
        ${renderPlayerPanel(state, enemy, "enemy")}
        ${renderCenterStage(state)}
        ${renderPlayerPanel(state, self, "self")}
      </div>
      ${overlays.join("")}
    </div>
  `;
}

function renderLobby(state) {
  const connecting = !app.session?.synced;
  const names = state.roster.length
    ? state.roster.map((name, index) => `<div class="lobby-name">${index + 1}. ${escapeHtml(name)}</div>`).join("")
    : `<div class="lobby-name">Nenhum jogador na sala ainda.</div>`;

  return `
    <div class="screen menu-screen">
      <div class="menu-backdrop"></div>
      <div class="menu-shell">
        <img class="menu-title" src="${ASSETS.title}" alt="Betrayal" />
        <div class="menu-card">
          <h2>Sala ${escapeHtml(app.form.room)}</h2>
          <p>${
            connecting
              ? "Sincronizando com o servidor da sala."
              : "Esperando dois usuarios ativos na sala."
          }</p>
          <div class="lobby-list">${names}</div>
          <button class="menu-button" data-action="back-to-menu">Voltar ao menu local</button>
        </div>
      </div>
    </div>
  `;
}

function renderRoomBlocked(state) {
  const roster = state.roster.length
    ? state.roster.map((name, index) => `<div class="lobby-name">${index + 1}. ${escapeHtml(name)}</div>`).join("")
    : `<div class="lobby-name">Nenhum jogador confirmado nesta sala.</div>`;

  const title =
    state.roster.length >= 2
      ? "Sala ocupada"
      : "Voce nao entrou nessa partida";
  const copy =
    state.roster.length >= 2
      ? "Essa sala ja tem dois jogadores. Use outra sala ou reinicie a partida existente."
      : "Seu navegador sincronizou a sala, mas este usuario nao virou um dos dois jogadores ativos.";

  return `
    <div class="screen menu-screen">
      <div class="menu-backdrop"></div>
      <div class="menu-shell">
        <img class="menu-title" src="${ASSETS.title}" alt="Betrayal" />
        <div class="menu-card">
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(copy)}</p>
          <div class="lobby-list">${roster}</div>
          <div class="notice">Dica: teste com uma sala nova e dois usuarios diferentes.</div>
          <button class="menu-button" data-action="back-to-menu">Voltar ao menu local</button>
        </div>
      </div>
    </div>
  `;
}

function renderMenu() {
  const status = serverStatus();

  return `
    <div class="screen menu-screen">
      <div class="menu-backdrop"></div>
      <div class="menu-shell">
        <img class="menu-title" src="${ASSETS.title}" alt="Betrayal" />
        <div class="menu-card">
          <div class="menu-copy">
            <span class="menu-kicker">vibinet room play</span>
            <h1>Usuario e sala.</h1>
            <p>Entre direto na sala compartilhada.</p>
            <p class="server-note is-${status.kind}">${escapeHtml(status.text)}</p>
          </div>
          <div class="server-banner is-${status.kind}">${escapeHtml(status.detail)}</div>
          <label class="field">
            <span>Usuario</span>
            <input
              data-field="user"
              placeholder="ex: Zorro"
              maxlength="24"
            />
          </label>
          <label class="field">
            <span>Sala</span>
            <input
              data-field="room"
              placeholder="ex: betrayal-001"
              maxlength="36"
            />
          </label>
          ${
            app.notice
              ? `<div class="notice">${escapeHtml(app.notice)}</div>`
              : ""
          }
          <button class="menu-button" data-action="join-room">Entrar na sala</button>
        </div>
      </div>
    </div>
  `;
}

function renderApp() {
  if (!app.session || !app.state) {
    return renderMenu();
  }
  if (app.session.synced && app.state.roster.length >= 2 && !localSeat(app.state)) {
    return renderRoomBlocked(app.state);
  }
  if (app.state.screen === "lobby") {
    return renderLobby(app.state);
  }
  return renderBoardScreen(app.state);
}

function joinRoom() {
  const user = app.form.user.trim();
  const room = app.form.room.trim();

  if (!user || !room) {
    app.notice = "Preencha usuario e sala.";
    playSound("invalid", 0.55);
    return;
  }

  if (app.session) {
    app.session.close();
  }

  app.notice = "";
  app.hadLiveMatch = false;
  app.lastPhase = null;
  app.lastScreen = null;
  app.state = null;
  app.session = new MatchSession({ room, user });
  playSound("click", 0.45);
}

function backToMenu() {
  if (app.session) {
    app.session.close();
  }
  app.session = null;
  app.state = null;
  app.hadLiveMatch = false;
  app.lastPhase = null;
  app.lastScreen = null;
}

function handleStateSideEffects(prev, next) {
  if (!next) return;

  if (next.screen === "game" || next.screen === "winner_transition" || next.screen === "report") {
    app.hadLiveMatch = true;
  }

  if (prev?.phase !== next.phase) {
    if (next.phase === "phase_0_start_effects") playSound("turnStart", 0.45);
    if (next.phase === "phase_2_reveal_c1" || next.phase === "phase_4_reveal_c2") {
      playSound("place", 0.5);
    }
  }

  if (prev?.screen !== next.screen) {
    const viewerSeat = localSeat(next);
    if (next.screen === "winner_transition") {
      playSound(next.winner === viewerSeat ? "victory" : "defeat", 0.6);
    }
  }

  if (
    app.hadLiveMatch &&
    next.screen === "lobby" &&
    next.roster.length === 0
  ) {
    backToMenu();
    app.notice = "A partida voltou ao menu compartilhado.";
  }
}

function update() {
  if (app.session) {
    const nextState = app.session.computeState();
    handleStateSideEffects(app.state, nextState);
    app.state = nextState;
  }

  const markup = renderApp();
  if (markup !== app.lastMarkup) {
    const activeField = captureActiveField();
    root.innerHTML = markup;
    app.lastMarkup = markup;
    syncFormInputs();
    restoreActiveField(activeField);
  }

  requestAnimationFrame(update);
}

root.addEventListener("input", (event) => {
  const field = event.target.dataset.field;
  if (!field) return;
  app.form[field] = event.target.value;
});

root.addEventListener("click", (event) => {
  const actionNode = event.target.closest("[data-action]");
  if (!actionNode) return;

  const { action, card } = actionNode.dataset;

  switch (action) {
    case "join-room":
      joinRoom();
      return;
    case "back-to-menu":
      backToMenu();
      return;
    case "confirm-selection":
      if (app.session?.confirmSelection()) {
        playSound("turnConfirm", 0.42);
      }
      return;
    case "select-uc":
      if (app.session?.selectUC(card)) {
        playSound("select", 0.45);
      }
      return;
    case "select-ue":
      if (app.session?.selectUE(card)) {
        playSound("select", 0.45);
      }
      return;
    case "continue-winner":
      if (app.session?.continueWinner()) {
        playSound("click", 0.4);
      }
      return;
    case "report-menu":
      if (app.session?.reportAction("menu")) {
        playSound("click", 0.45);
      }
      return;
    case "report-restart":
      if (app.session?.reportAction("restart")) {
        playSound("turnConfirm", 0.45);
      }
      return;
  }
});

window.addEventListener("beforeunload", () => {
  app.session?.leave();
  app.serverProbe?.close();
});

window.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  if (app.state?.screen === "winner_transition") {
    app.session?.continueWinner();
    playSound("click", 0.35);
  }
});

update();
