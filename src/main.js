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
  keyboardCursor: {
    uc: null,
    ue: null,
  },
  metricAnimations: null,
  finalBoardReview: false,
};

const audioPool = new Map();
const METRIC_CONFIG = [
  { key: "castleTrust", label: "Confianca", max: 3, className: "is-trust" },
  { key: "guardDamage", label: "Guard", max: 6, className: "is-guard" },
];

const FIRST_GAME_SCREEN_IMAGES = [
  ASSETS.castle1,
  ASSETS.castle2,
  ASSETS.cardBack,
  ASSETS.cardBackHidden,
  ASSETS.cardBackHiddenRest,
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

function pct(value, max) {
  const safeMax = Math.max(1, max);
  const safeValue = Math.max(0, Math.min(safeMax, value));
  return `${((safeValue / safeMax) * 100).toFixed(3)}%`;
}

function buildMetricAnimations(prevState, nextState) {
  if (!nextState?.players) return null;
  const seats = ["C1", "C2"];
  const animations = {};

  for (const seat of seats) {
    const nextPlayer = nextState.players[seat];
    const prevPlayer = prevState?.players?.[seat] ?? nextPlayer;
    animations[seat] = {};

    for (const metric of METRIC_CONFIG) {
      const current = nextPlayer[metric.key] ?? 0;
      const prev = prevPlayer[metric.key] ?? current;
      animations[seat][metric.key] = {
        prev,
        current,
        max: metric.max,
        isIncreasing: current > prev,
      };
    }
  }

  return animations;
}

function cardCountBadge(player, card) {
  if (card === "invader") return `x${player.ues.invader.available}`;
  if (card === "tribute") return `x${player.ues.tribute.available}`;
  return "";
}

function cardExhaustionBadge(player, card, handType) {
  if (handType !== "uc") return "";
  const normalizedCard = normalizeUCType(card);
  if (!normalizedCard || normalizedCard === "dummy") return "";
  const exhaustion = player.ucs[normalizedCard]?.exhaustion ?? 0;
  return String(exhaustion);
}

function visibleAttackCards(player) {
  return UE_TYPES.filter(
    (card) =>
      card !== "poisoned_tribute" ||
      player.ues.poisoned_tribute.status === "active",
  );
}

function resetKeyboardCursor() {
  app.keyboardCursor.uc = null;
  app.keyboardCursor.ue = null;
}

function handTypeFromView(view) {
  return view === "attack" ? "ue" : "uc";
}

function getKeyboardCards(player, handType) {
  return handType === "uc" ? UC_TYPES : visibleAttackCards(player);
}

function getSelectedCardForHand(player, handType) {
  return handType === "uc"
    ? normalizeUCType(player.selectedUC)
    : player.selectedUE;
}

function getSelectedCardIndex(player, handType, cards) {
  const selectedCard = getSelectedCardForHand(player, handType);
  return selectedCard ? cards.indexOf(selectedCard) : -1;
}

function findSelectableIndex(player, handType, cards, startIndex, delta = 1) {
  for (
    let index = startIndex;
    index >= 0 && index < cards.length;
    index += delta
  ) {
    if (!getCardDisabled(player, cards[index], handType)) {
      return index;
    }
  }
  return -1;
}

function getKeyboardContext() {
  const state = app.state;
  if (!state || state.screen !== "game" || state.phase !== "phase_1_selection") {
    return null;
  }
  const seat = localSeat(state);
  if (!seat) return null;
  const player = state.players[seat];
  if (!player || player.confirmed) return null;
  return { state, seat, player };
}

function setPanelView(view) {
  app.panelView = view === "attack" ? "attack" : "rest";
}

function selectKeyboardCard(player, handType, index) {
  const cards = getKeyboardCards(player, handType);
  const card = cards[index];
  if (!card || getCardDisabled(player, card, handType)) {
    return false;
  }
  const changed = handType === "uc"
    ? app.session?.selectUC(card)
    : app.session?.selectUE(card);
  if (!changed) return false;
  app.keyboardCursor[handType] = index;
  playSound("select", 0.45);
  return true;
}

function moveKeyboardSelection(player, handType, delta) {
  const cards = getKeyboardCards(player, handType);
  if (!cards.length) return false;

  const selectedIndex = getSelectedCardIndex(player, handType, cards);
  const currentIndex = selectedIndex >= 0
    ? selectedIndex
    : app.keyboardCursor[handType];

  if (currentIndex === null || currentIndex < 0 || currentIndex >= cards.length) {
    const firstIndex = findSelectableIndex(player, handType, cards, 0, 1);
    if (firstIndex < 0) return false;
    return selectKeyboardCard(player, handType, firstIndex);
  }

  const nextIndex = findSelectableIndex(
    player,
    handType,
    cards,
    currentIndex + delta,
    delta,
  );
  if (nextIndex < 0) return false;
  return selectKeyboardCard(player, handType, nextIndex);
}

function clearKeyboardSelection(player, handType) {
  const hasSelection = handType === "uc"
    ? Boolean(player.selectedUC)
    : Boolean(player.selectedUE);
  if (!hasSelection) return false;
  const changed = handType === "uc"
    ? app.session?.clearUC()
    : app.session?.clearUE();
  if (!changed) return false;
  app.keyboardCursor[handType] = null;
  return true;
}

function confirmKeyboardSelection(player) {
  if (!player.selectedUC || !player.selectedUE || player.confirmed) {
    return false;
  }
  return app.session?.confirmSelection() ?? false;
}

function handleSelectionKeydown(event) {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  if (
    event.target instanceof HTMLElement &&
    (event.target.tagName === "INPUT" ||
      event.target.tagName === "TEXTAREA" ||
      event.target.isContentEditable)
  ) {
    return false;
  }

  const context = getKeyboardContext();
  if (!context) return false;

  const { player } = context;
  const handType = handTypeFromView(app.panelView);
  const lowerKey = event.key.length === 1 ? event.key.toLowerCase() : event.key;

  if (event.key === "Tab") {
    event.preventDefault();
    setPanelView(app.panelView === "attack" ? "rest" : "attack");
    return true;
  }

  if (lowerKey === "q") {
    event.preventDefault();
    setPanelView("rest");
    return true;
  }

  if (lowerKey === "e") {
    event.preventDefault();
    setPanelView("attack");
    return true;
  }

  if (/^[1-5]$/.test(event.key)) {
    const index = Number(event.key) - 1;
    event.preventDefault();
    return selectKeyboardCard(player, handType, index);
  }

  if (lowerKey === "a") {
    event.preventDefault();
    return moveKeyboardSelection(player, handType, -1);
  }

  if (lowerKey === "d") {
    event.preventDefault();
    return moveKeyboardSelection(player, handType, 1);
  }

  if (
    event.key === "Backspace" ||
    event.key === "Delete" ||
    event.key === "Escape"
  ) {
    event.preventDefault();
    return clearKeyboardSelection(player, handType);
  }

  if (event.key === "Enter" || event.code === "Space") {
    event.preventDefault();
    return confirmKeyboardSelection(player);
  }

  return false;
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
  const cardCount = Math.max(1, cards.length);

  return `
    <section class="selection-group ${kindClass}">
      <div
        class="selection-strip ${kindClass} ${tone}"
        style="--selection-card-count: ${cardCount};"
      >
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

function renderStageChoiceButton({ player, handType, view, ariaLabel }) {
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
  const badge = "";
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
              <span class="stage-choice-plus" aria-hidden="true">+</span>
              <strong>${escapeHtml(label)}</strong>
            </span>
          `
      }
    </button>
  `;
}

function renderHiddenEnemySlot(handType) {
  const src = handType === "uc" ? ASSETS.cardBackHiddenRest : ASSETS.cardBackHidden;
  return `
    <div class="center-slot stage-hidden-slot" aria-hidden="true">
      <img class="stage-slot-art" src="${src}" alt="" />
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

function isFinalBoardReview(state) {
  return Boolean(
    app.finalBoardReview &&
      state?.screen === "report" &&
      state.lastTurnSnapshot,
  );
}

function isSummaryView(state) {
  return Boolean(
    state?.lastTurnSnapshot &&
      (app.localPhaseView === "reveal" || isFinalBoardReview(state)),
  );
}

function getTurnSummary(state, seat) {
  return state.lastTurnSnapshot?.reportBySeat?.[seat] ?? {
    enemyLine: "O inimigo não causou um efeito que precisasse ser relatado.",
    selfLine: "Sua jogada não causou um efeito que precisasse ser relatado.",
  };
}

function shouldRevealEnemyRestCard(state, self) {
  const snap = state.lastTurnSnapshot;
  if (!snap?.resolvedBySeat?.[self]) return false;

  const enemy = self === "C1" ? "C2" : "C1";
  const selfUE = snap.players?.[self]?.selectedUE ?? null;
  const enemyUC = normalizeUCType(snap.players?.[enemy]?.selectedUC);

  if (!selfUE || !enemyUC) return false;
  if (selfUE === "spy") return true;
  if (selfUE === "assassin" && enemyUC === "king") return true;
  if (selfUE === "poisoned_tribute" && enemyUC === "chef") return true;
  if (selfUE === "invader" && enemyUC === "guard") return true;
  return false;
}

function renderRoundReport(state, seat) {
  const summary = getTurnSummary(state, seat);

  return `
    <section class="round-report">
      <div class="round-report-kicker">Ultima rodada</div>
      <div class="round-report-list">
        <div class="round-report-item">
          <strong>Inimigo</strong>
          <p>${escapeHtml(summary.enemyLine)}</p>
        </div>
        <div class="round-report-item">
          <strong>Voce</strong>
          <p>${escapeHtml(summary.selfLine)}</p>
        </div>
      </div>
    </section>
  `;
}

function renderRevealStage(state, self) {
  const enemy = self === "C1" ? "C2" : "C1";
  const snap = state.lastTurnSnapshot;
  const selfSnap = snap.players[self];
  const enemySnap = snap.players[enemy];
  const selfPlayer = state.players[self];
  const enemyPlayer = state.players[enemy];
  const enemyRestSlot = shouldRevealEnemyRestCard(state, self)
    ? renderRevealSlot(enemySnap.selectedUC, "uc")
    : renderHiddenEnemySlot("uc");

  return `
    <section class="center-stage decision-stage is-reveal">
      <div class="stage-lane stage-lane-enemy">
        <div class="decision-row stage-board-row is-enemy">
          ${renderRevealSlot(enemySnap.selectedUE, "ue")}
          ${enemyRestSlot}
        </div>
        ${renderStageSidebar(enemyPlayer, enemy, "enemy")}
      </div>
      <div class="stage-lane stage-lane-self">
        ${renderStageSidebar(selfPlayer, self, "self")}
        <div class="decision-row stage-board-row is-self">
          ${renderRevealSlot(selfSnap.selectedUE, "ue")}
          ${renderRevealSlot(selfSnap.selectedUC, "uc")}
        </div>
      </div>
    </section>
  `;
}

function renderCenterStage(state, self) {
  if (isSummaryView(state)) {
    return renderRevealStage(state, self);
  }

  const player = state.players[self];
  const enemy = self === "C1" ? "C2" : "C1";
  const enemyPlayer = state.players[enemy];

  const enemySlotUE = enemyPlayer.selectedUE
    ? renderHiddenEnemySlot("ue")
    : `<div class="center-slot stage-empty-slot" aria-hidden="true"></div>`;
  const enemySlotUC = enemyPlayer.selectedUC
    ? renderHiddenEnemySlot("uc")
    : `<div class="center-slot stage-empty-slot" aria-hidden="true"></div>`;

  return `
    <section class="center-stage decision-stage">
      <div class="stage-lane stage-lane-enemy">
        <div class="decision-row stage-board-row is-enemy">
          ${enemySlotUE}
          ${enemySlotUC}
        </div>
        ${renderStageSidebar(enemyPlayer, enemy, "enemy")}
      </div>
      <div class="stage-lane stage-lane-self">
        ${renderStageSidebar(player, self, "self")}
        <div class="decision-row stage-board-row is-self">
          ${renderStageChoiceButton({
            player,
            handType: "ue",
            view: "attack",
            ariaLabel: "Abrir visualização de ataque",
          })}
          ${renderStageChoiceButton({
            player,
            handType: "uc",
            view: "rest",
            ariaLabel: "Abrir visualização de descanso",
          })}
        </div>
      </div>
    </section>
  `;
}

function renderOwnChoices(state, seat) {
  const player = state.players[seat];
  const summaryView = isSummaryView(state);
  const interactive =
    !summaryView &&
    state.screen === "game" &&
    state.phase === "phase_1_selection" &&
    !player.confirmed;
  const currentView = app.panelView === "attack" ? "attack" : "rest";

  const content = summaryView
    ? renderRoundReport(state, seat)
    : currentView === "attack"
      ? renderSelectionGroup({
        cards: visibleAttackCards(player),
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
    <div class="selection-stack ${summaryView ? "is-reveal" : ""}">
      <div class="selection-stage ${summaryView ? "is-summary" : ""}">${content}</div>
      <div class="selection-footer">
        ${renderHeaderAction(state, seat)}
      </div>
    </div>
  `;
}

function renderHeaderAction(state, seat) {
  const player = state.players[seat];
  if (isFinalBoardReview(state)) {
    return `
      <div class="selection-actions is-single">
        <button
          class="confirm-button confirm-button-square"
          data-action="back-to-servers"
        >
          Voltar para servidores
        </button>
      </div>
    `;
  }
  if (app.localPhaseView === "reveal") {
    return `
      <div class="selection-actions is-single">
        <button
          class="confirm-button confirm-button-square"
          data-action="advance-local-view"
          data-seat="${seat}"
        >
          Próximo turno
        </button>
      </div>
    `;
  }
  if (state.phase === "phase_2_results") {
    const buttonLabel = "OK";

    return `
      <div class="selection-actions is-single">
        <button
          class="confirm-button confirm-button-square"
          data-action="advance-turn"
          data-seat="${seat}"
        >
          ${escapeHtml(buttonLabel)}
        </button>
      </div>
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
  const confirmStateClass = player.confirmed ? "is-waiting" : canConfirm ? "" : "is-incomplete";
  const swapView = app.panelView === "attack" ? "rest" : "attack";
  const swapDisabledAttr = player.confirmed ? "disabled" : "";

  return `
    <div class="selection-actions">
      <button
        class="swap-button"
        data-action="set-panel-view"
        data-view="${swapView}"
        aria-label="Trocar entre ataque e descanso"
        ${swapDisabledAttr}
      >
        <img src="${ASSETS.iconSwap}" alt="" aria-hidden="true" />
      </button>
      <button
        class="confirm-button confirm-button-square ${confirmStateClass}"
        data-action="confirm-selection"
        data-seat="${seat}"
        ${player.confirmed ? "disabled" : disabledAttr}
      >
        ${escapeHtml(buttonLabel)}
      </button>
    </div>
  `;
}

function renderMetricDividers(max) {
  return Array.from({ length: max - 1 }, (_, index) => {
    const offset = (((index + 1) / max) * 100).toFixed(3);
    return `<span class="status-track-divider" style="left: ${offset}%"></span>`;
  }).join("");
}

function getMetricAnimation(seat, player, metric) {
  return app.metricAnimations?.[seat]?.[metric.key] ?? {
    prev: player[metric.key] ?? 0,
    current: player[metric.key] ?? 0,
    max: metric.max,
    isIncreasing: false,
  };
}

function renderStatusMetric(seat, player, metric) {
  const animation = getMetricAnimation(seat, player, metric);
  const fromPct = pct(animation.isIncreasing ? animation.prev : animation.current, metric.max);
  const toPct = pct(animation.current, metric.max);
  const maxedClass = animation.current >= metric.max ? "is-maxed" : "";
  const animClass = animation.isIncreasing ? "is-growing" : "";

  return `
    <div class="enemy-metric status-metric ${metric.className} ${maxedClass}">
      <div class="status-metric-head">
        <span class="enemy-metric-label status-metric-label">${escapeHtml(metric.label)}</span>
        <strong class="enemy-metric-value status-metric-value">${animation.current}/${metric.max}</strong>
      </div>
      <div
        class="status-track ${animClass}"
        style="--status-fill-from: ${fromPct}; --status-fill-to: ${toPct};"
      >
        <span class="status-track-fill"></span>
        ${renderMetricDividers(metric.max)}
      </div>
    </div>
  `;
}

function renderStageStatusMetric(seat, player, metric, perspective) {
  const animation = getMetricAnimation(seat, player, metric);
  const fromPct = pct(animation.isIncreasing ? animation.prev : animation.current, metric.max);
  const toPct = pct(animation.current, metric.max);
  const maxedClass = animation.current >= metric.max ? "is-maxed" : "";
  const animClass = animation.isIncreasing ? "is-growing" : "";

  return `
    <div class="stage-metric status-metric ${metric.className} ${maxedClass} is-${perspective}">
      <div class="stage-metric-label">${escapeHtml(metric.label)}</div>
      <div
        class="status-track ${animClass}"
        style="--status-fill-from: ${fromPct}; --status-fill-to: ${toPct};"
      >
        <span class="status-track-fill"></span>
        ${renderMetricDividers(metric.max)}
      </div>
    </div>
  `;
}

function renderStageSidebar(player, seat, perspective) {
  return `
    <aside class="stage-sidebar is-${perspective}">
      <div class="stage-player-name">${escapeHtml(player.name || "Aguardando...")}</div>
      ${METRIC_CONFIG.map((metric) => renderStageStatusMetric(seat, player, metric, perspective)).join("")}
    </aside>
  `;
}

function renderLocalHand(state, seat) {
  return `
    <section class="player-hand player-local">
      ${renderOwnChoices(state, seat)}
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
        <h2>Fim da Partida</h2>
        <div class="report-row"><span>Turnos</span><strong>${state.turnNumber}</strong></div>
        <div class="report-row"><span>Vencedor</span><strong>${escapeHtml(winnerName)}</strong></div>
        <div class="report-row"><span>Tipo</span><strong>${escapeHtml(
          getVictoryLabel(state.victoryType),
        )}</strong></div>
        <div class="report-actions">
          <button class="is-accent" data-action="report-restart">Outra partida</button>
          <button data-action="open-final-board">Ver tabuleiro</button>
        </div>
      </div>
    </div>
  `;
}

function renderBoardScreen(state) {
  const { self } = perspectiveSeats(state);
  const overlays = [];

  if (state.screen === "winner_transition") overlays.push(renderWinnerOverlay(state));
  if (state.screen === "report" && !isFinalBoardReview(state)) {
    overlays.push(renderReportOverlay(state));
  }

  return `
    <div class="screen board-screen">
      <div class="board-backdrop"></div>
      <div class="board-shell">
        <div class="board-zone">
          ${renderCenterStage(state, self)}
        </div>
        <div class="hand-zone">
          ${renderLocalHand(state, self)}
        </div>
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
  setPanelView("rest");
  resetKeyboardCursor();
  app.state = null;
  app.metricAnimations = null;
  app.finalBoardReview = false;
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
  setPanelView("rest");
  resetKeyboardCursor();
  app.metricAnimations = null;
  app.finalBoardReview = false;
  app.menuPage = "user";
}

function backToServers() {
  if (app.session) {
    app.session.close();
  }
  app.session = null;
  app.state = null;
  app.hadLiveMatch = false;
  app.lastPhase = null;
  app.lastScreen = null;
  setPanelView("rest");
  resetKeyboardCursor();
  app.viewingTurn = null;
  app.localPhaseView = null;
  app.metricAnimations = null;
  app.finalBoardReview = false;
  app.notice = "";
  app.menuPage = "servers";
  if (!app.selectedServerId && SERVER_CHOICES[0]) {
    app.selectedServerId = SERVER_CHOICES[0].id;
  }
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
  app.finalBoardReview = false;
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

  if (next.screen !== "report") {
    app.finalBoardReview = false;
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
    app.metricAnimations = buildMetricAnimations(app.state, nextState);
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
    case "back-to-servers":
      backToServers();
      playSound("click", 0.45);
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
    case "open-final-board":
      if (app.state?.screen === "report" && app.state.lastTurnSnapshot) {
        app.finalBoardReview = true;
        playSound("click", 0.42);
      }
      return;
    case "set-panel-view":
      if (!view) return;
      setPanelView(view);
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
  if (handleSelectionKeydown(event)) {
    return;
  }
  if (app.state?.screen === "winner_transition") {
    app.session?.continueWinner();
    playSound("click", 0.35);
  }
});

update();
