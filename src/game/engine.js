import {
  LOG_LIMIT,
  PHASE_DURATIONS,
  TICK_RATE,
  TOLERANCE_MS,
  UC_LABELS,
  UC_TYPES,
  UE_LABELS,
} from "./constants.js";
import {
  cloneState,
  createBoardState,
  createFreshMatchState,
  createInitialState,
  createLobbyState,
} from "./initial-state.js";

function pushLog(state, text) {
  state.publicLog = [text, ...state.publicLog].slice(0, LOG_LIMIT);
}

function getOpponentId(playerId) {
  return playerId === "C1" ? "C2" : "C1";
}

function cardTag(card) {
  return card?.$ ?? null;
}

function seatForUser(state, user) {
  if (state.players.C1.name === user) return "C1";
  if (state.players.C2.name === user) return "C2";
  return null;
}

function clearBoard(state) {
  state.board = createBoardState();
}

function syncBoardFromSelections(state) {
  clearBoard(state);
  state.board.c1Send.card = state.players.C1.selectedUE;
  state.board.c2Rest.card = state.players.C2.selectedUC;
  state.board.c2Send.card = state.players.C2.selectedUE;
  state.board.c1Rest.card = state.players.C1.selectedUC;
}

function setSpotlight(state, owner, card, label) {
  state.board.spotlight = { owner, card, label };
}

function revealAttack(state, attackerId, defenderId, revealRest = true) {
  const sendSlot = attackerId === "C1" ? state.board.c1Send : state.board.c2Send;
  const restSlot = defenderId === "C1" ? state.board.c1Rest : state.board.c2Rest;
  sendSlot.revealed = true;
  restSlot.revealed = revealRest;
}

function hideRestingCard(state, defenderId) {
  const restSlot = defenderId === "C1" ? state.board.c1Rest : state.board.c2Rest;
  restSlot.hidden = true;
  restSlot.revealed = false;
}

function updatePoisonAvailability(state) {
  const c1TargetTrust = state.players.C2.castleTrust;
  const c2TargetTrust = state.players.C1.castleTrust;
  state.players.C1.ues.poisoned_tribute.status =
    c1TargetTrust >= 3 ? "active" : "disabled";
  state.players.C2.ues.poisoned_tribute.status =
    c2TargetTrust >= 3 ? "active" : "disabled";
}

function startTurn(state) {
  state.phase = "phase_0_start_effects";
  state.phaseTicksRemaining = PHASE_DURATIONS.phase_0_start_effects;

  for (const player of Object.values(state.players)) {
    player.tradeRouteBlockedThisTurn = player.tradeRouteBlockedNextTurn;
    player.tradeRouteBlockedNextTurn = false;
  }

  updatePoisonAvailability(state);
  clearBoard(state);
  pushLog(state, `Turno ${state.turnNumber} iniciado.`);
}

function enterSelectionPhase(state) {
  state.phase = "phase_1_selection";
  state.phaseTicksRemaining = 0;
  clearBoard(state);
  pushLog(state, "Selecao simultanea aberta.");
}

function bothPlayersReady(state) {
  return Boolean(
    state.players.C1.selectedUC &&
      state.players.C1.selectedUE &&
      state.players.C2.selectedUC &&
      state.players.C2.selectedUE,
  );
}

function setWinner(state, playerId, victoryType, text) {
  state.winner = playerId;
  state.victoryType = victoryType;
  pushLog(state, text);
}

function applyTradeBlockFromInvader(state, defenderId) {
  state.players[defenderId].tradeRouteBlockedNextTurn = true;
}

function applyAssassin(state, attackerId, defenderId) {
  const attacker = state.players[attackerId];
  const defender = state.players[defenderId];
  const defendingCard = defender.selectedUC;

  revealAttack(state, attackerId, defenderId, defendingCard === "king");

  if (defendingCard === "king") {
    defender.ucs.king.status = "dead";
    setWinner(
      state,
      attackerId,
      "assassination",
      `${attacker.name} assassinou o Rei de ${defender.name}.`,
    );
    return;
  }

  attacker.ues.assassin.status = "dead";
  hideRestingCard(state, defenderId);
  setSpotlight(state, defenderId, "king", "SHOWDOWN");
  pushLog(
    state,
    `${attacker.name} perdeu o Assassino. O Rei de ${defender.name} foi exposto.`,
  );
}

function applySpy(state, attackerId, defenderId) {
  const attacker = state.players[attackerId];
  const defender = state.players[defenderId];
  const defendingCard = defender.selectedUC;

  revealAttack(state, attackerId, defenderId, true);

  if (defendingCard === "dummy") {
    attacker.ues.spy.status = "imprisoned";
    pushLog(state, `${attacker.name} perdeu o Spy para uma emboscada do Dummy.`);
    return;
  }

  pushLog(
    state,
    `${attacker.name} usou Scout e encontrou ${UC_LABELS[defendingCard]} em descanso.`,
  );
}

function applyInvader(state, attackerId, defenderId) {
  const attacker = state.players[attackerId];
  const defender = state.players[defenderId];
  const defendingCard = defender.selectedUC;

  attacker.ues.invader.available = Math.max(0, attacker.ues.invader.available - 1);
  applyTradeBlockFromInvader(state, defenderId);
  revealAttack(state, attackerId, defenderId, true);

  if (defendingCard === "guard") {
    defender.ucs.guard.status = "dead";
    pushLog(state, `${attacker.name} derrubou o Guarda de ${defender.name}.`);
    return;
  }

  if (defender.ucs.guard.status !== "dead") {
    defender.guardDamage += 2;
    setSpotlight(state, defenderId, "guard", "SHOWDOWN +2");
    pushLog(
      state,
      `${attacker.name} acertou o Guarda de ${defender.name} com SHOWDOWN.`,
    );
    if (defender.guardDamage >= 6) {
      defender.ucs.guard.status = "dead";
      pushLog(state, `O Guarda de ${defender.name} caiu por excesso de dano.`);
    }
    return;
  }

  defender.ucs.king.status = "dead";
  setSpotlight(state, defenderId, "king", "SHOWDOWN");
  setWinner(
    state,
    attackerId,
    "capture",
    `${attacker.name} capturou o Rei de ${defender.name}.`,
  );
}

function applyTribute(state, attackerId, defenderId) {
  const attacker = state.players[attackerId];
  const defender = state.players[defenderId];

  attacker.ues.tribute.available = Math.max(0, attacker.ues.tribute.available - 1);
  defender.ues.tribute.available += 1;
  defender.castleTrust = Math.min(3, defender.castleTrust + 1);

  revealAttack(state, attackerId, defenderId, false);
  hideRestingCard(state, defenderId);
  pushLog(
    state,
    `${attacker.name} enviou Tributo. A confianca de ${defender.name} subiu.`,
  );
}

function applyPoisonedTribute(state, attackerId, defenderId) {
  const attacker = state.players[attackerId];
  const defender = state.players[defenderId];
  const defendingCard = defender.selectedUC;

  revealAttack(state, attackerId, defenderId, true);

  if (defendingCard === "chef") {
    setWinner(
      state,
      attackerId,
      "assassination",
      `${attacker.name} venceu com Tributo Envenenado sobre ${defender.name}.`,
    );
    return;
  }

  defender.castleTrust = Math.max(0, defender.castleTrust - 1);
  attacker.ues.poisoned_tribute.status = "disabled";
  pushLog(
    state,
    `${attacker.name} derrubou a confianca de ${defender.name} com veneno.`,
  );
}

function resolveInteraction(state, attackerId, defenderId) {
  const attacker = state.players[attackerId];
  const ue = attacker.selectedUE;

  if (!ue) return;

  switch (ue) {
    case "assassin":
      applyAssassin(state, attackerId, defenderId);
      break;
    case "spy":
      applySpy(state, attackerId, defenderId);
      break;
    case "invader":
      applyInvader(state, attackerId, defenderId);
      break;
    case "tribute":
      applyTribute(state, attackerId, defenderId);
      break;
    case "poisoned_tribute":
      applyPoisonedTribute(state, attackerId, defenderId);
      break;
  }
}

function enterPhase2(state) {
  state.phase = "phase_2_reveal_c1";
  state.phaseTicksRemaining = PHASE_DURATIONS.phase_2_reveal_c1;
  syncBoardFromSelections(state);
  resolveInteraction(state, "C1", "C2");
}

function enterPhase3(state) {
  state.phase = "phase_3_check_winner";
  state.phaseTicksRemaining = PHASE_DURATIONS.phase_3_check_winner;
  pushLog(state, state.winner ? "Vitoria detectada apos a jogada de C1." : "Sem vitoria apos C1.");
}

function enterPhase4(state) {
  state.phase = "phase_4_reveal_c2";
  state.phaseTicksRemaining = PHASE_DURATIONS.phase_4_reveal_c2;
  syncBoardFromSelections(state);
  resolveInteraction(state, "C2", "C1");
}

function enterPhase5(state) {
  state.phase = "phase_5_check_winner";
  state.phaseTicksRemaining = PHASE_DURATIONS.phase_5_check_winner;
  pushLog(state, state.winner ? "Vitoria detectada apos a jogada de C2." : "Sem vitoria apos C2.");
}

function enterPhase6(state) {
  state.phase = "phase_6_exhaustion";
  state.phaseTicksRemaining = PHASE_DURATIONS.phase_6_exhaustion;

  for (const player of Object.values(state.players)) {
    for (const key of UC_TYPES) {
      if (player.ucs[key].status === "dead") continue;
      if (player.selectedUC === key) {
        player.ucs[key].exhaustion = 0;
      } else {
        player.ucs[key].exhaustion += 1;
      }
    }
  }

  pushLog(state, "Contadores de exaustao atualizados.");
}

function enterPhase7(state) {
  state.phase = "phase_7_maintenance";
  state.phaseTicksRemaining = PHASE_DURATIONS.phase_7_maintenance;
  clearBoard(state);

  for (const player of Object.values(state.players)) {
    player.selectedUC = null;
    player.selectedUE = null;
  }

  updatePoisonAvailability(state);
  pushLog(state, "Manutencao concluida. Preparando a proxima rodada.");
}

function enterWinnerTransition(state) {
  state.screen = "winner_transition";
  state.phase = "winner_transition";
  state.phaseTicksRemaining = PHASE_DURATIONS.winner_transition;
}

function enterReport(state) {
  state.screen = "report";
  state.phase = "report";
  state.phaseTicksRemaining = 0;
  state.reportAction = null;
}

function canSelectUC(player, card) {
  return player.ucs[card]?.status !== "dead";
}

function canSelectUE(player, card) {
  switch (card) {
    case "assassin":
      return player.ues.assassin.status === "alive";
    case "spy":
      return player.ues.spy.status === "active";
    case "invader":
      return player.ues.invader.available > 0;
    case "tribute":
      return !player.tradeRouteBlockedThisTurn && player.ues.tribute.available > 0;
    case "poisoned_tribute":
      return (
        !player.tradeRouteBlockedThisTurn &&
        player.ues.poisoned_tribute.status === "active"
      );
    default:
      return false;
  }
}

function handleJoin(state, user) {
  if (!user || state.roster.includes(user) || state.roster.length >= 2) {
    return state;
  }

  const next = cloneState(state);
  next.roster.push(user);
  next.players.C1.name = next.roster[0] ?? "";
  next.players.C2.name = next.roster[1] ?? "";
  pushLog(next, `${user} entrou na sala.`);

  if (next.roster.length === 2) {
    const fresh = createFreshMatchState(next.roster, next.matchNumber);
    startTurn(fresh);
    return fresh;
  }

  return next;
}

function handleSelection(state, user, card, kind) {
  const seat = seatForUser(state, user);
  if (!seat || state.screen !== "game" || state.phase !== "phase_1_selection") {
    return state;
  }

  const next = cloneState(state);
  const player = next.players[seat];
  const selected = cardTag(card);

  if (!selected) return state;

  if (kind === "uc") {
    if (!canSelectUC(player, selected)) return state;
    player.selectedUC = selected;
    pushLog(next, `${seat} travou uma carta de castelo.`);
  } else {
    if (!canSelectUE(player, selected)) return state;
    player.selectedUE = selected;
    pushLog(next, `${seat} travou uma carta de estrategia.`);
  }

  syncBoardFromSelections(next);
  return next;
}

function handleLeave(state, user) {
  if (!user || !state.roster.includes(user)) {
    return state;
  }

  const remaining = state.roster.filter((name) => name !== user);
  const next = createLobbyState(remaining, state.matchNumber, [
    `${user} saiu da sala.`,
    remaining.length
      ? "Aguardando outro jogador para completar a sala."
      : "A sala ficou vazia.",
  ]);

  return next;
}

function handleContinue(state, user) {
  if (!user || state.screen !== "winner_transition") return state;
  const next = cloneState(state);
  enterReport(next);
  return next;
}

function handleReportAction(state, user, action) {
  const seat = seatForUser(state, user);
  if (!seat || state.screen !== "report") {
    return state;
  }

  const actionTag = cardTag(action);
  if (!actionTag) return state;

  if (actionTag === "menu") {
    const next = createInitialState();
    next.publicLog = [`${user} encerrou a partida e voltou ao menu.`];
    return next;
  }

  if (actionTag === "restart") {
    const next = createFreshMatchState(state.roster, state.matchNumber + 1);
    pushLog(next, `${user} reiniciou a sala para a partida ${next.matchNumber}.`);
    startTurn(next);
    return next;
  }

  return state;
}

export function onPost(post, state) {
  switch (post.$) {
    case "join":
      return handleJoin(state, post.user.trim());
    case "leave":
      return handleLeave(state, post.user.trim());
    case "select_uc":
      return handleSelection(state, post.user.trim(), post.card, "uc");
    case "select_ue":
      return handleSelection(state, post.user.trim(), post.card, "ue");
    case "continue":
      return handleContinue(state, post.user.trim());
    case "report_action":
      return handleReportAction(state, post.user.trim(), post.action);
    default:
      return state;
  }
}

export function onTick(state) {
  if (state.screen === "lobby" || state.screen === "report") {
    return state;
  }

  if (state.screen === "winner_transition") {
    const next = cloneState(state);
    if (next.phaseTicksRemaining > 1) {
      next.phaseTicksRemaining -= 1;
      return next;
    }
    enterReport(next);
    return next;
  }

  if (state.phase === "phase_1_selection") {
    if (!bothPlayersReady(state)) return state;
    const next = cloneState(state);
    enterPhase2(next);
    return next;
  }

  const next = cloneState(state);

  if (next.phaseTicksRemaining > 1) {
    next.phaseTicksRemaining -= 1;
    return next;
  }

  switch (next.phase) {
    case "phase_0_start_effects":
      enterSelectionPhase(next);
      return next;
    case "phase_2_reveal_c1":
      enterPhase3(next);
      return next;
    case "phase_3_check_winner":
      if (next.winner) {
        enterWinnerTransition(next);
      } else {
        enterPhase4(next);
      }
      return next;
    case "phase_4_reveal_c2":
      enterPhase5(next);
      return next;
    case "phase_5_check_winner":
      if (next.winner) {
        enterWinnerTransition(next);
      } else {
        enterPhase6(next);
      }
      return next;
    case "phase_6_exhaustion":
      enterPhase7(next);
      return next;
    case "phase_7_maintenance":
      next.turnNumber += 1;
      startTurn(next);
      return next;
    default:
      return next;
  }
}

export const gameConfig = {
  initial: createInitialState(),
  on_tick: onTick,
  on_post: onPost,
  tick_rate: TICK_RATE,
  tolerance: TOLERANCE_MS,
};

export function getVictoryLabel(victoryType) {
  if (victoryType === "capture") return "Captura";
  if (victoryType === "assassination") return "Assassinato";
  return "Sem vitoria";
}

export function getCardLabel(card) {
  return UC_LABELS[card] ?? UE_LABELS[card] ?? card;
}
