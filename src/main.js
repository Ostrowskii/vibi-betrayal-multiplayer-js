import "./styles.css";

import { ASSETS } from "./assets.js";
import {
  normalizeUCType,
  UC_LABELS,
  UC_TYPES,
  UE_LABELS,
  UE_TYPES,
} from "./game/constants.js";
import { getVictoryLabel } from "./game/engine.js";
import { SERVER_CHOICES } from "./network/config.js";
import { ServerDirectory } from "./network/server-directory.js";
import { MatchSession } from "./network/session.js";

const root = document.querySelector("#app");

const app = {
  form: {
    user: "",
    room: "",
  },
  menuPage: "user",
  selectedServerId: "",
  serverDirectory: new ServerDirectory(),
  session: null,
  state: null,
  notice: "",
  lastMarkup: "",
  lastPhase: null,
  lastScreen: null,
  hadLiveMatch: false,
  panelView: "rest",
  viewingTurn: null,
  localPhaseView: null,
};

const audioPool = new Map();

const FIRST_GAME_SCREEN_IMAGES = [
  ASSETS.castle1,
  ASSETS.castle2,
  ASSETS.iconRest,
  ASSETS.iconForward,
  ASSETS.cardBack,
  ASSETS.cardBackHidden,
  ASSETS.cards.king.color,
  ASSETS.cards.chef.color,
  ASSETS.cards.guard.color,
  ASSETS.cards.dummy.color,
];

function collectImageUrls(node, out = new Set()) {
  if (typeof node === "string") {
    if (/\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(node)) out.add(node);
  } else if (node && typeof node === "object") {
    for (const value of Object.values(node)) collectImageUrls(value, out);
  }
  return out;
}

const preloadedImageCache = new Map();

function preloadImage(url) {
  const cached = preloadedImageCache.get(url);
  if (cached) return cached;
  const promise = new Promise((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => resolve();
    img.src = url;
  });
  preloadedImageCache.set(url, promise);
  return promise;
}

function preloadImages(urls) {
  return Promise.all(urls.map(preloadImage));
}

function scheduleIdle(callback) {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(callback, { timeout: 4000 });
  } else {
    setTimeout(callback, 50);
  }
}

let assetPreloadStarted = false;

function startAssetPreload() {
  if (assetPreloadStarted) return;
  assetPreloadStarted = true;

  preloadImages(FIRST_GAME_SCREEN_IMAGES).then(() => {
    const remaining = [...collectImageUrls(ASSETS)].filter(
      (url) => !preloadedImageCache.has(url),
    );
    let index = 0;
    const pump = () => {
      if (index >= remaining.length) return;
      const url = remaining[index++];
      preloadImage(url).then(() => scheduleIdle(pump));
    };
    scheduleIdle(pump);
  });
}

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
  return app.serverDirectory?.snapshot() ?? [];
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
  clone.volume = Math.max(0, Math.min(1, volume * 0.5));
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

function cardCountBadge() {
  return "";
}

function cardExhaustionBadge(player, card, handType) {
  if (handType !== "uc") return "";
  const normalizedCard = normalizeUCType(card);
  if (!normalizedCard || normalizedCard === "dummy") return "";
  const exhaustion = player.ucs[normalizedCard]?.exhaustion ?? 0;
  return String(exhaustion);
}

function visibleAttackCards() {
  return UE_TYPES.filter((card) => card !== "poisoned_tribute");
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
  const exhaustionBadge = cardExhaustionBadge(player, card, handType);
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
      <div class="card-art-shell">
        <img class="card-art" src="${getCardArt(card, disabled)}" alt="${escapeHtml(label)}" />
        <div class="card-caption">
          <span class="card-title">${escapeHtml(label)}</span>
        </div>
        ${badge ? `<span class="card-badge">${escapeHtml(badge)}</span>` : ""}
        ${
          exhaustionBadge
            ? `<span class="card-inline-stack"><img src="${ASSETS.zzz}" alt="" aria-hidden="true" /><span>${escapeHtml(exhaustionBadge)}</span></span>`
            : ""
        }
      </div>
    </button>
  `;
}

function renderSelectionGroup({
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

function renderStageChoiceButton({ player, handType, view, icon, ariaLabel }) {
  const selectedCard =
    handType === "uc"
      ? normalizeUCType(player.selectedUC)
      : player.selectedUE === "poisoned_tribute"
        ? null
        : player.selectedUE;
  const label = selectedCard
    ? handType === "uc"
      ? UC_LABELS[selectedCard]
      : UE_LABELS[selectedCard]
    : view === "rest"
      ? "Descanso"
      : "Ataque";
  const badge = selectedCard ? cardCountBadge(player, selectedCard) : "";
  const exhaustionBadge = selectedCard
    ? cardExhaustionBadge(player, selectedCard, handType)
    : "";

  return `
    <button
      class="center-slot stage-choice-button ${app.panelView === view ? "is-active" : ""}"
      data-action="set-panel-view"
      data-view="${view}"
      aria-label="${escapeHtml(ariaLabel)}"
    >
      ${
        selectedCard
          ? `
            <div class="card-art-shell">
              <img class="card-art" src="${getCardArt(selectedCard, false)}" alt="${escapeHtml(label)}" />
              <div class="card-caption">
                <span class="card-title">${escapeHtml(label)}</span>
              </div>
              ${badge ? `<span class="card-badge">${escapeHtml(badge)}</span>` : ""}
              ${
                exhaustionBadge
                  ? `<span class="card-inline-stack"><img src="${ASSETS.zzz}" alt="" aria-hidden="true" /><span>${escapeHtml(exhaustionBadge)}</span></span>`
                  : ""
              }
            </div>
          `
          : `
            <span class="stage-choice-empty">
              <img src="${icon}" alt="" aria-hidden="true" />
              <strong>${escapeHtml(label)}</strong>
            </span>
          `
      }
    </button>
  `;
}

function renderHiddenEnemySlot() {
  return `
    <div class="center-slot stage-hidden-slot" aria-hidden="true">
      <img class="stage-slot-art" src="${ASSETS.cardBackHidden}" alt="" />
    </div>
  `;
}

function renderRevealSlot(card, handType) {
  if (!card) {
    return `<div class="center-slot stage-empty-slot" aria-hidden="true"></div>`;
  }
  const label = handType === "uc"
    ? UC_LABELS[normalizeUCType(card)]
    : UE_LABELS[card];
  return `
    <div class="center-slot stage-reveal-slot">
      <img class="stage-slot-art" src="${getCardArt(card, false)}" alt="${escapeHtml(label ?? "")}" />
    </div>
  `;
}

function renderRevealStage(state, self) {
  const enemy = self === "C1" ? "C2" : "C1";
  const snap = state.lastTurnSnapshot;
  const selfSnap = snap.players[self];
  const enemySnap = snap.players[enemy];

  return `
    <section class="center-stage decision-stage is-reveal">
      <div class="decision-row is-enemy">
        ${renderRevealSlot(enemySnap.selectedUE, "ue")}
        ${renderRevealSlot(enemySnap.selectedUC, "uc")}
      </div>
      <div class="decision-row is-self">
        ${renderRevealSlot(selfSnap.selectedUE, "ue")}
        ${renderRevealSlot(selfSnap.selectedUC, "uc")}
      </div>
    </section>
  `;
}

function renderCenterStage(state, self) {
  if (app.localPhaseView === "reveal" && state.lastTurnSnapshot) {
    return renderRevealStage(state, self);
  }

  const player = state.players[self];
  const enemy = self === "C1" ? "C2" : "C1";
  const enemyPlayer = state.players[enemy];

  const enemySlotUE = enemyPlayer.selectedUE
    ? renderHiddenEnemySlot()
    : `<div class="center-slot stage-empty-slot" aria-hidden="true"></div>`;
  const enemySlotUC = enemyPlayer.selectedUC
    ? renderHiddenEnemySlot()
    : `<div class="center-slot stage-empty-slot" aria-hidden="true"></div>`;

  return `
    <section class="center-stage decision-stage">
      <div class="decision-row is-enemy">
        ${enemySlotUE}
        ${enemySlotUC}
      </div>
      <div class="decision-row is-self">
        ${renderStageChoiceButton({
          player,
          handType: "ue",
          view: "attack",
          icon: ASSETS.iconForward,
          ariaLabel: "Abrir visualização de ataque",
        })}
        ${renderStageChoiceButton({
          player,
          handType: "uc",
          view: "rest",
          icon: ASSETS.iconRest,
          ariaLabel: "Abrir visualização de descanso",
        })}
      </div>
    </section>
  `;
}

function renderOwnChoices(state, seat) {
  const player = state.players[seat];
  const inReveal = app.localPhaseView === "reveal";
  const interactive =
    !inReveal &&
    state.screen === "game" &&
    state.phase === "phase_1_selection" &&
    !player.confirmed;
  const currentView = app.panelView === "attack" ? "attack" : "rest";

  const content = inReveal
    ? ""
    : currentView === "attack"
      ? renderSelectionGroup({
        cards: visibleAttackCards(),
        handType: "ue",
        player,
        seat,
        interactive,
        tone: "tone-attack",
      })
      : renderSelectionGroup({
        cards: UC_TYPES,
        handType: "uc",
        player,
        seat,
        interactive,
        tone: "tone-rest",
      });

  return `
    <div class="selection-stack ${inReveal ? "is-reveal" : ""}">
      <div class="selection-stage">${content}</div>
      <div class="selection-footer">
        ${renderHeaderAction(state, seat)}
      </div>
    </div>
  `;
}

function renderHeaderAction(state, seat) {
  const player = state.players[seat];
  if (app.localPhaseView === "reveal") {
    return `
      <button
        class="confirm-button confirm-button-square"
        data-action="advance-local-view"
        data-seat="${seat}"
      >
        Próximo turno
      </button>
    `;
  }
  if (state.phase === "phase_2_results") {
    const buttonLabel = "OK";

    return `
      <button
        class="confirm-button confirm-button-square"
        data-action="advance-turn"
        data-seat="${seat}"
      >
        ${escapeHtml(buttonLabel)}
      </button>
    `;
  }

  const canConfirm =
    state.screen === "game" &&
    state.phase === "phase_1_selection" &&
    !player.confirmed &&
    player.selectedUC &&
    player.selectedUE;
  const buttonLabel = player.confirmed ? "..." : "OK";
  const disabledAttr = canConfirm ? "" : "disabled";

  return `
    <button
      class="confirm-button confirm-button-square ${player.confirmed ? "is-waiting" : ""}"
      data-action="confirm-selection"
      data-seat="${seat}"
      ${player.confirmed ? "disabled" : disabledAttr}
    >
      ${escapeHtml(buttonLabel)}
    </button>
  `;
}

function renderEnemyMetric(label, value, accent = false) {
  return `
    <div class="enemy-metric ${accent ? "is-maxed" : ""}">
      <span class="enemy-metric-label">${escapeHtml(label)}</span>
      <strong class="enemy-metric-value">${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderPlayerPanel(state, seat, perspective) {
  const player = state.players[seat];
  const isLocal = perspective === "self";
  const blockValue = player.tradeRouteBlockedThisTurn ? "Bloqueada" : "Livre";
  const roleLabel = isLocal ? "Voce" : "Inimigo";

  if (!isLocal) {
    return `
      <section class="player-panel player-enemy">
        <div class="player-header enemy-header">
          <div class="enemy-identity">
            <div class="player-crest enemy-crest">
              <img src="${getCastleIcon(seat, false)}" alt="${seat}" />
            </div>
            <div class="player-heading enemy-heading">
              <div class="player-name">${escapeHtml(player.name || "Aguardando...")}</div>
              <div class="enemy-id-line">
                <div class="player-seat">${roleLabel}</div>
              </div>
            </div>
          </div>
          <div class="player-meta enemy-meta">
            ${renderEnemyMetric("Confianca", `${player.castleTrust}/3`, player.castleTrust >= 3)}
            ${renderEnemyMetric("Guard", `${player.guardDamage}/6`)}
            ${renderEnemyMetric("Rota", blockValue)}
          </div>
        </div>
      </section>
    `;
  }

  return `
    <section class="player-panel player-local">
      <div class="player-header enemy-header">
        <div class="enemy-identity">
          <div class="player-crest enemy-crest">
            <img src="${getCastleIcon(seat, false)}" alt="${seat}" />
          </div>
          <div class="player-heading enemy-heading">
            <div class="player-name">${escapeHtml(player.name || "Aguardando...")}</div>
            <div class="enemy-id-line">
              <div class="player-seat">${roleLabel}</div>
            </div>
          </div>
        </div>
        <div class="player-meta enemy-meta">
          ${renderEnemyMetric("Confianca", `${player.castleTrust}/3`, player.castleTrust >= 3)}
          ${renderEnemyMetric("Guard", `${player.guardDamage}/6`)}
          ${renderEnemyMetric("Rota", blockValue)}
        </div>
      </div>
      <div class="player-body">${renderOwnChoices(state, seat)}</div>
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
        ${renderCenterStage(state, self)}
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
  return `
    <div class="screen menu-screen">
      <div class="menu-backdrop"></div>
      <div class="menu-shell">
        <img class="menu-title" src="${ASSETS.title}" alt="Betrayal" />
        <div class="menu-card">
          <div class="menu-copy">
            <span class="menu-kicker">vibinet room play</span>
            <h1>Usuario.</h1>
          </div>
          <label class="field">
            <span>Usuario</span>
            <input
              data-field="user"
              placeholder="ex: Zorro"
              maxlength="24"
            />
          </label>
          ${
            app.notice
              ? `<div class="notice">${escapeHtml(app.notice)}</div>`
              : ""
          }
          <button class="menu-button" data-action="open-server-list">Ver servidores</button>
        </div>
      </div>
    </div>
  `;
}

function getSelectedServer() {
  return SERVER_CHOICES.find((entry) => entry.id === app.selectedServerId) ?? null;
}

function renderServerList() {
  const entries = serverStatus();
  const selected = getSelectedServer();

  return `
    <div class="screen menu-screen">
      <div class="menu-backdrop"></div>
      <div class="menu-shell">
        <img class="menu-title" src="${ASSETS.title}" alt="Betrayal" />
        <div class="menu-card server-menu-card">
          <div class="server-menu-header">
            <div class="menu-copy">
              <span class="menu-kicker">lista fixa</span>
              <h1>Servidores.</h1>
            </div>
            <button class="menu-button server-connect-inline" data-action="connect-selected-server" ${
              selected ? "" : "disabled"
            }>Conectar</button>
          </div>
          <div class="server-list-shell">
            ${entries
              .map(
                (entry) => `
                  <button
                    class="server-row ${entry.id === app.selectedServerId ? "is-selected" : ""}"
                    data-action="select-server"
                    data-server-id="${entry.id}"
                  >
                    <span class="server-row-name">${escapeHtml(entry.name)}</span>
                    <span class="server-row-detail is-${entry.kind}">${escapeHtml(entry.detail)}</span>
                  </button>
                `,
              )
              .join("")}
          </div>
          ${
            app.notice
              ? `<div class="notice">${escapeHtml(app.notice)}</div>`
              : ""
          }
          <div class="server-menu-actions">
            <button class="menu-button is-secondary" data-action="back-to-user-menu">Voltar</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderApp() {
  if (!app.session || !app.state) {
    return app.menuPage === "servers" ? renderServerList() : renderMenu();
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
    app.notice = "Preencha usuario e selecione um servidor.";
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
  app.panelView = "rest";
  app.state = null;
  app.menuPage = "user";
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
  app.panelView = "rest";
  app.menuPage = "user";
}

function openServerList() {
  const user = app.form.user.trim();
  if (!user) {
    app.notice = "Preencha usuario.";
    playSound("invalid", 0.55);
    return;
  }
  app.notice = "";
  app.menuPage = "servers";
  if (!app.selectedServerId && SERVER_CHOICES[0]) {
    app.selectedServerId = SERVER_CHOICES[0].id;
  }
  startAssetPreload();
  playSound("click", 0.35);
}

function backToUserMenu() {
  app.notice = "";
  app.menuPage = "user";
  playSound("click", 0.35);
}

function connectSelectedServer() {
  const selected = getSelectedServer();
  if (!selected) {
    app.notice = "Selecione um servidor.";
    playSound("invalid", 0.55);
    return;
  }
  app.form.room = selected.room;
  joinRoom();
}

function handleStateSideEffects(prev, next) {
  if (!next) return;

  if (next.screen === "game" || next.screen === "winner_transition" || next.screen === "report") {
    app.hadLiveMatch = true;
  }

  if (next.screen === "game") {
    if (app.viewingTurn === null) {
      app.viewingTurn = next.turnNumber;
      app.localPhaseView = "selection";
    } else if (
      next.lastTurnSnapshot &&
      next.lastTurnSnapshot.turnNumber === app.viewingTurn &&
      next.turnNumber > app.viewingTurn &&
      app.localPhaseView !== "reveal"
    ) {
      app.localPhaseView = "reveal";
      playSound("place", 0.5);
    }
  } else {
    app.viewingTurn = null;
    app.localPhaseView = null;
  }

  if (prev?.phase !== next.phase) {
    if (next.phase === "phase_0_start_effects") playSound("turnStart", 0.45);
    if (next.phase === "phase_2_results") {
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

  const { action, card, view } = actionNode.dataset;

  switch (action) {
    case "open-server-list":
      openServerList();
      return;
    case "back-to-user-menu":
      backToUserMenu();
      return;
    case "connect-selected-server":
      connectSelectedServer();
      return;
    case "select-server":
      if (!actionNode.dataset.serverId) return;
      app.selectedServerId = actionNode.dataset.serverId;
      playSound("click", 0.22);
      return;
    case "back-to-menu":
      backToMenu();
      return;
    case "confirm-selection":
      app.session?.confirmSelection();
      return;
    case "advance-turn":
      if (app.session?.advanceTurn()) {
        playSound("turnConfirm", 0.42);
      }
      return;
    case "advance-local-view":
      if (app.localPhaseView === "reveal" && app.state) {
        app.viewingTurn = app.state.turnNumber;
        app.localPhaseView = "selection";
        playSound("turnConfirm", 0.42);
      }
      return;
    case "set-panel-view":
      if (!view) return;
      app.panelView = view;
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
  app.serverDirectory?.close();
});

window.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  if (app.state?.screen === "winner_transition") {
    app.session?.continueWinner();
    playSound("click", 0.35);
  }
});

update();
