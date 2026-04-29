import {
  LOG_LIMIT,
  normalizeUCType,
  PHASE_DURATIONS,
  PLAYER_IDS,
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
  createTurnView,
} from "./initial-state.js";

function pushLog(state, text) {
  state.publicLog = [text, ...state.publicLog].slice(0, LOG_LIMIT);
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

function clearTurnView(state) {
  state.turnView = createTurnView();
}

function pushTurnCard(state, seat, bucket, { card = null, title, text }) {
  const cards = state.turnView[seat][bucket];
  cards.push({
    key: `${seat}-${bucket}-${cards.length + 1}`,
    card,
    title,
    text,
  });
}

function pushPublicCard(state, seat, card, title, text) {
  pushTurnCard(state, seat, "publicCards", {
    card,
    title,
    text,
  });
}

function pushPrivateCard(state, seat, card, title, text) {
  pushTurnCard(state, seat, "privateCards", {
    card,
    title,
    text,
  });
}

function addRestPrivateCards(state) {
  for (const seat of PLAYER_IDS) {
    const player = state.players[seat];
    const rested = normalizeUCType(player.selectedUC);
    if (!rested) continue;

    if (rested === "dummy") {
      pushPrivateCard(
        state,
        seat,
        "dummy",
        "Seu descanso",
        "Você escolheu Dummy. Ninguém descansou neste turno.",
      );
      continue;
    }

    pushPrivateCard(
      state,
      seat,
      rested,
      "Seu descanso",
      `Você descansou com ${UC_LABELS[rested]}.`,
    );
  }
}

function prepareTurnView(state) {
  clearTurnView(state);
  addRestPrivateCards(state);
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
  state.screen = "game";
  state.phase = "phase_0_start_effects";
  state.phaseTicksRemaining = PHASE_DURATIONS.phase_0_start_effects;
  state.winner = null;
  state.victoryType = null;
  state.reportAction = null;

  for (const player of Object.values(state.players)) {
    player.tradeRouteBlockedThisTurn = player.tradeRouteBlockedNextTurn;
    player.tradeRouteBlockedNextTurn = false;
    player.selectedUC = null;
    player.selectedUE = null;
    player.confirmed = false;
  }

  updatePoisonAvailability(state);
  clearBoard(state);
  clearTurnView(state);
  pushLog(state, `Turno ${state.turnNumber} iniciado.`);
}

function enterSelectionPhase(state) {
  state.phase = "phase_1_selection";
  state.phaseTicksRemaining = 0;
  clearBoard(state);
  clearTurnView(state);
  pushLog(state, "Seleção simultânea aberta.");
}

function bothPlayersReady(state) {
  return Boolean(
    state.players.C1.selectedUC &&
      state.players.C1.selectedUE &&
      state.players.C1.confirmed &&
      state.players.C2.selectedUC &&
      state.players.C2.selectedUE &&
      state.players.C2.confirmed,
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

function setPhaseResults(state) {
  state.phase = "phase_2_results";
  state.phaseTicksRemaining = 0;
}

function pushAssassinCards(state, attackerId, defenderId, killedKing) {
  const attackerText = killedKing
    ? "Você enviou um assassino e matou o rei inimigo."
    : "Você enviou um assassino, mas ele foi pego.";
  const defenderText = killedKing
    ? "O inimigo enviou um assassino e o seu rei morreu enquanto descansava."
    : "O inimigo enviou um assassino, mas ele foi pego.";

  pushPublicCard(state, attackerId, "assassin", "Assassino", attackerText);
  pushPublicCard(state, defenderId, "assassin", "Assassino", defenderText);
}

function applyAssassin(state, attackerId, defenderId) {
  const attacker = state.players[attackerId];
  const defender = state.players[defenderId];
  const defendingCard = normalizeUCType(defender.selectedUC);
  const killedKing = defendingCard === "king";

  pushAssassinCards(state, attackerId, defenderId, killedKing);

  if (killedKing) {
    defender.ucs.king.status = "dead";
    setWinner(
      state,
      attackerId,
      "assassination",
      `${attacker.name} assassinou o rei de ${defender.name}.`,
    );
    return;
  }

  attacker.ues.assassin.status = "dead";
  pushLog(
    state,
    `${attacker.name} perdeu o Assassino. O rei de ${defender.name} foi exposto.`,
  );
}

function applySpy(state, attackerId, defenderId) {
  const attacker = state.players[attackerId];
  const defender = state.players[defenderId];
  const defendingCard = normalizeUCType(defender.selectedUC);

  pushPrivateCard(
    state,
    attackerId,
    "spy",
    "Você enviou Spy",
    "Seu agente tentou descobrir quem descansou do outro lado.",
  );

  if (defendingCard === "dummy") {
    pushPublicCard(
      state,
      attackerId,
      "spy",
      "Spy pego",
      "Você enviou um Spy, mas ele foi pego porque ninguém descansou.",
    );
    pushPublicCard(
      state,
      defenderId,
      "spy",
      "Spy pego",
      "O inimigo enviou um Spy, mas ninguém descansou e ele foi pego.",
    );
    pushPrivateCard(
      state,
      attackerId,
      null,
      "Relatório do Spy",
      "Seu Spy foi pego porque ninguém descansou neste turno.",
    );
    attacker.ues.spy.status = "imprisoned";
    pushLog(state, `${attacker.name} perdeu o Spy porque ninguém descansou.`);
    return;
  }

  pushPrivateCard(
    state,
    attackerId,
    null,
    "Relatório do Spy",
    `Seu Spy descobriu que o inimigo descansou com ${UC_LABELS[defendingCard]}.`,
  );
  pushLog(
    state,
    `${attacker.name} usou Spy e encontrou ${UC_LABELS[defendingCard]} em descanso.`,
  );
}

function pushInvaderCards(
  state,
  attackerId,
  defenderId,
  defendingCard,
  guardBefore,
  guardAfter,
) {
  if (defendingCard === "guard") {
    pushPublicCard(
      state,
      attackerId,
      "invader",
      "Invasores",
      "Você enviou invasores e o guarda do inimigo estava dormindo.",
    );
    pushPublicCard(
      state,
      defenderId,
      "invader",
      "Invasores",
      "O inimigo enviou invasores e o seu guarda estava dormindo.",
    );
    return;
  }

  if (guardAfter !== null) {
    pushPublicCard(
      state,
      attackerId,
      "invader",
      "Invasores",
      `Você enviou invasores e o guarda do inimigo defendeu. A vida do guarda caiu de ${guardBefore} para ${guardAfter}.`,
    );
    pushPublicCard(
      state,
      defenderId,
      "invader",
      "Invasores",
      `O inimigo enviou invasores e o seu guarda defendeu. A vida do guarda caiu de ${guardBefore} para ${guardAfter}.`,
    );
    return;
  }

  pushPublicCard(
    state,
    attackerId,
    "invader",
    "Invasores",
    "Você enviou invasores e o guarda do inimigo não estava disponível. O rei foi capturado.",
  );
  pushPublicCard(
    state,
    defenderId,
    "invader",
    "Invasores",
    "O inimigo enviou invasores e o seu guarda não estava disponível. O rei foi capturado.",
  );
}

function applyInvader(state, attackerId, defenderId) {
  const attacker = state.players[attackerId];
  const defender = state.players[defenderId];
  const defendingCard = normalizeUCType(defender.selectedUC);
  const guardBefore = defender.guardDamage;

  attacker.ues.invader.available = Math.max(0, attacker.ues.invader.available - 1);
  applyTradeBlockFromInvader(state, defenderId);

  if (defendingCard === "guard") {
    defender.ucs.guard.status = "dead";
    pushInvaderCards(state, attackerId, defenderId, defendingCard, guardBefore, null);
    pushLog(state, `${attacker.name} derrubou o guarda de ${defender.name}.`);
    return;
  }

  if (defender.ucs.guard.status !== "dead") {
    defender.guardDamage += 2;
    pushInvaderCards(
      state,
      attackerId,
      defenderId,
      defendingCard,
      guardBefore,
      defender.guardDamage,
    );
    if (defender.guardDamage >= 6) {
      defender.ucs.guard.status = "dead";
      pushLog(state, `O guarda de ${defender.name} caiu por excesso de dano.`);
    }
    return;
  }

  defender.ucs.king.status = "dead";
  pushInvaderCards(state, attackerId, defenderId, defendingCard, guardBefore, null);
  setWinner(
    state,
    attackerId,
    "capture",
    `${attacker.name} capturou o rei de ${defender.name}.`,
  );
}

function applyTribute(state, attackerId, defenderId) {
  const attacker = state.players[attackerId];
  const defender = state.players[defenderId];
  const trustBefore = defender.castleTrust;

  attacker.ues.tribute.available = Math.max(0, attacker.ues.tribute.available - 1);
  defender.ues.tribute.available += 1;
  defender.castleTrust = Math.min(3, defender.castleTrust + 1);

  pushPublicCard(
    state,
    attackerId,
    "tribute",
    "Tributo",
    `Você enviou um tributo. A confiança do inimigo subiu de ${trustBefore} para ${defender.castleTrust}.`,
  );
  pushPublicCard(
    state,
    defenderId,
    "tribute",
    "Tributo",
    `Você recebeu um tributo. Sua confiança subiu de ${trustBefore} para ${defender.castleTrust}.`,
  );
  pushLog(
    state,
    `${attacker.name} enviou Tributo. A confiança de ${defender.name} subiu.`,
  );
}

function applyPoisonedTribute(state, attackerId, defenderId) {
  const attacker = state.players[attackerId];
  const defender = state.players[defenderId];
  const defendingCard = normalizeUCType(defender.selectedUC);
  const trustBefore = defender.castleTrust;

  if (defendingCard === "chef") {
    pushPublicCard(
      state,
      attackerId,
      "poisoned_tribute",
      "Tributo envenenado",
      "Você enviou um tributo envenenado enquanto o cozinheiro inimigo dormia. O rei foi envenenado.",
    );
    pushPublicCard(
      state,
      defenderId,
      "poisoned_tribute",
      "Tributo envenenado",
      "O inimigo enviou um tributo envenenado enquanto o seu cozinheiro dormia. O rei foi envenenado.",
    );
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

  pushPublicCard(
    state,
    attackerId,
    "poisoned_tribute",
    "Tributo envenenado",
    `Você enviou um tributo envenenado. A confiança do inimigo caiu de ${trustBefore} para ${defender.castleTrust}.`,
  );
  pushPublicCard(
    state,
    defenderId,
    "poisoned_tribute",
    "Tributo envenenado",
    `O inimigo enviou um tributo envenenado. Sua confiança caiu de ${trustBefore} para ${defender.castleTrust}.`,
  );
  pushLog(
    state,
    `${attacker.name} derrubou a confiança de ${defender.name} com veneno.`,
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

function applyExhaustion(state) {
  for (const player of Object.values(state.players)) {
    for (const key of UC_TYPES) {
      if (key === "dummy") continue;
      if (player.ucs[key].status === "dead") continue;
      if (player.selectedUC === key) {
        player.ucs[key].exhaustion = 0;
      } else {
        player.ucs[key].exhaustion += 1;
      }
    }
  }

  pushLog(state, "Contadores de exaustão atualizados.");
}

function resolveTurn(state) {
  prepareTurnView(state);
  clearBoard(state);
  setPhaseResults(state);

  resolveInteraction(state, "C1", "C2");

  if (!state.winner) {
    resolveInteraction(state, "C2", "C1");
  }

  if (!state.winner) {
    applyExhaustion(state);
    updatePoisonAvailability(state);
    pushLog(state, "Resultados do turno prontos.");
  } else {
    pushLog(state, "O turno terminou com uma vitória.");
  }
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
  if (card === "dummy") return true;
  return player.ucs[normalizeUCType(card)]?.status !== "dead";
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
  const tagged = cardTag(card);
  const selected = kind === "uc" ? normalizeUCType(tagged) : tagged;

  if (!selected || player.confirmed) return state;

  if (kind === "uc") {
    if (!canSelectUC(player, selected)) return state;
    player.selectedUC = selected;
    pushLog(next, `${seat} travou uma carta de castelo.`);
  } else {
    if (!canSelectUE(player, selected)) return state;
    player.selectedUE = selected;
    pushLog(next, `${seat} travou uma carta de estratégia.`);
  }

  return next;
}

function handleConfirm(state, user) {
  const seat = seatForUser(state, user);
  if (!seat || state.screen !== "game" || state.phase !== "phase_1_selection") {
    return state;
  }

  const next = cloneState(state);
  const player = next.players[seat];
  if (player.confirmed || !player.selectedUC || !player.selectedUE) {
    return state;
  }

  player.confirmed = true;
  pushLog(next, `${seat} confirmou suas escolhas.`);

  if (bothPlayersReady(next)) {
    resolveTurn(next);
  }

  return next;
}

function handleNextTurn(state, user) {
  if (!user || state.screen !== "game" || state.phase !== "phase_2_results") {
    return state;
  }

  const next = cloneState(state);

  if (next.winner) {
    enterWinnerTransition(next);
    return next;
  }

  next.turnNumber += 1;
  pushLog(next, `${user} abriu o próximo turno.`);
  startTurn(next);
  return next;
}

function handleLeave(state, user) {
  if (!user || !state.roster.includes(user)) {
    return state;
  }

  return createLobbyState(
    state.roster.filter((name) => name !== user),
    state.matchNumber,
    [
      `${user} saiu da sala.`,
      state.roster.length > 1
        ? "Aguardando outro jogador para completar a sala."
        : "A sala ficou vazia.",
    ],
  );
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
    case "confirm":
      return handleConfirm(state, post.user.trim());
    case "next_turn":
      return handleNextTurn(state, post.user.trim());
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
    resolveTurn(next);
    return next;
  }

  if (state.phase === "phase_2_results") {
    return state;
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
  return "Sem vitória";
}

export function getCardLabel(card) {
  return UC_LABELS[normalizeUCType(card)] ?? UE_LABELS[card] ?? card;
}
