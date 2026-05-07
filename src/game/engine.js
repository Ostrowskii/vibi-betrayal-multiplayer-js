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

function startTurn(
  state,
  { preserveTurnView = false, immediateSelection = false } = {},
) {
  state.screen = "game";
  state.phase = immediateSelection ? "phase_1_selection" : "phase_0_start_effects";
  state.phaseTicksRemaining = immediateSelection
    ? 0
    : PHASE_DURATIONS.phase_0_start_effects;
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
  if (!preserveTurnView) {
    clearTurnView(state);
  }
  pushLog(state, `Turno ${state.turnNumber} iniciado.`);
  if (immediateSelection) {
    pushLog(state, "Seleção simultânea aberta.");
  }
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

function applyTradeBlockFromInvader(state, attackerId) {
  state.players[attackerId].tradeRouteBlockedNextTurn = true;
}

function setPhaseResults(state) {
  state.phase = "phase_2_results";
  state.phaseTicksRemaining = 0;
}

function opposingSeat(seat) {
  return seat === "C1" ? "C2" : "C1";
}

function createTurnReport() {
  return {
    C1: {
      selfLine: "",
      enemyLine: "",
    },
    C2: {
      selfLine: "",
      enemyLine: "",
    },
  };
}

function ensureTurnReport(state) {
  if (!state.turnReport) {
    state.turnReport = createTurnReport();
  }
  return state.turnReport;
}

function setTurnReportLine(state, seat, bucket, text) {
  ensureTurnReport(state)[seat][bucket] = text;
}

function appendTurnReportLine(state, seat, bucket, text) {
  if (!text) return;
  const report = ensureTurnReport(state);
  const current = report[seat][bucket];
  report[seat][bucket] = current ? `${current} ${text}` : text;
}

function finalizeTurnReport(state, resolvedAttackers) {
  const report = ensureTurnReport(state);
  const resolvedSet = new Set(resolvedAttackers);

  for (const seat of PLAYER_IDS) {
    const enemySeat = opposingSeat(seat);

    if (!report[seat].selfLine) {
      report[seat].selfLine =
        state.winner && !resolvedSet.has(seat)
          ? "Sua estratégia não chegou a resolver porque a partida acabou antes."
          : "Sua jogada não causou um efeito que precisasse ser relatado.";
    }

    if (!report[seat].enemyLine) {
      report[seat].enemyLine =
        state.winner && !resolvedSet.has(enemySeat)
          ? "O inimigo não chegou a resolver a própria estratégia porque o turno terminou antes."
          : "O inimigo não causou um efeito que precisasse ser relatado.";
    }
  }
}

function pushAssassinCards(state, attackerId, defenderId, killedKing) {
  const attackerText = killedKing
    ? "Você enviou um assassino e matou o King inimigo."
    : "Você enviou um assassino, mas ele foi pego.";
  const defenderText = killedKing
    ? "O inimigo enviou um assassino e o seu King morreu enquanto descansava."
    : "O inimigo enviou um assassino, mas ele foi pego.";

  pushPublicCard(state, attackerId, "assassin", "Assassino", attackerText);
  pushPublicCard(state, defenderId, "assassin", "Assassino", defenderText);
}

function applyAssassin(state, attackerId, defenderId) {
  const attacker = state.players[attackerId];
  const defender = state.players[defenderId];
  const defendingCard = normalizeUCType(defender.selectedUC);
  const killedKing = defendingCard === "king";

  setTurnReportLine(
    state,
    attackerId,
    "selfLine",
    killedKing
      ? "Você enviou Assassino e matou o King inimigo enquanto ele descansava."
      : "Você enviou Assassino, mas ele foi executado antes de alcançar o King.",
  );
  setTurnReportLine(
    state,
    defenderId,
    "enemyLine",
    killedKing
      ? "O inimigo enviou Assassino e matou o seu King enquanto ele descansava."
      : "O inimigo enviou Assassino, mas ele foi executado antes de alcançar o seu King.",
  );

  pushAssassinCards(state, attackerId, defenderId, killedKing);

  if (killedKing) {
    defender.ucs.king.status = "dead";
    setWinner(
      state,
      attackerId,
      "assassination",
      `${attacker.name} assassinou o King de ${defender.name}.`,
    );
    return;
  }

  attacker.ues.assassin.status = "dead";
  pushLog(
    state,
    `${attacker.name} perdeu o Assassino. O King de ${defender.name} foi exposto.`,
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
    setTurnReportLine(
      state,
      attackerId,
      "selfLine",
      "Você enviou Spy, mas ele caiu no Dummy e foi preso.",
    );
    setTurnReportLine(
      state,
      defenderId,
      "enemyLine",
      "O inimigo enviou Spy, mas ele caiu no seu Dummy e foi preso.",
    );
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

  setTurnReportLine(
    state,
    attackerId,
    "selfLine",
    `Você enviou Spy e descobriu que o inimigo descansou com ${UC_LABELS[defendingCard]}.`,
  );
  setTurnReportLine(
    state,
    defenderId,
    "enemyLine",
    `O inimigo enviou Spy e descobriu que você descansou com ${UC_LABELS[defendingCard]}.`,
  );
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
      "Você enviou invasores e o Guard do inimigo estava dormindo.",
    );
    pushPublicCard(
      state,
      defenderId,
      "invader",
      "Invasores",
      "O inimigo enviou invasores e o seu Guard estava dormindo.",
    );
    return;
  }

  if (guardAfter !== null) {
    pushPublicCard(
      state,
      attackerId,
      "invader",
      "Invasores",
      `Você enviou invasores e o Guard do inimigo defendeu. A vida do Guard caiu de ${guardBefore} para ${guardAfter}.`,
    );
    pushPublicCard(
      state,
      defenderId,
      "invader",
      "Invasores",
      `O inimigo enviou invasores e o seu Guard defendeu. A vida do Guard caiu de ${guardBefore} para ${guardAfter}.`,
    );
    return;
  }

  pushPublicCard(
    state,
    attackerId,
    "invader",
    "Invasores",
    "Você enviou invasores e o Guard do inimigo não estava disponível. O King foi capturado.",
  );
  pushPublicCard(
    state,
    defenderId,
    "invader",
    "Invasores",
    "O inimigo enviou invasores e o seu Guard não estava disponível. O King foi capturado.",
  );
}

function applyInvader(state, attackerId, defenderId) {
  const attacker = state.players[attackerId];
  const defender = state.players[defenderId];
  const defendingCard = normalizeUCType(defender.selectedUC);
  const guardBefore = defender.guardDamage;

  attacker.ues.invader.available = Math.max(0, attacker.ues.invader.available - 1);
  applyTradeBlockFromInvader(state, attackerId);

  if (defendingCard === "guard") {
    setTurnReportLine(
      state,
      attackerId,
      "selfLine",
      "Você enviou Invasor e encontrou o Guard inimigo descansando. O Guard morreu.",
    );
    setTurnReportLine(
      state,
      defenderId,
      "enemyLine",
      "O inimigo enviou Invasor e encontrou seu Guard descansando. O Guard morreu.",
    );
    defender.ucs.guard.status = "dead";
    pushInvaderCards(state, attackerId, defenderId, defendingCard, guardBefore, null);
    pushLog(state, `${attacker.name} derrubou o Guard de ${defender.name}.`);
    return;
  }

  if (defender.ucs.guard.status !== "dead") {
    defender.guardDamage += 2;
    const guardAfter = defender.guardDamage;
    const deathSuffix = guardAfter >= 6 ? " O Guard morreu com esse dano." : "";
    setTurnReportLine(
      state,
      attackerId,
      "selfLine",
      `Você enviou Invasor. O Guard inimigo defendeu e foi de ${guardBefore} para ${guardAfter} de dano.${deathSuffix}`,
    );
    setTurnReportLine(
      state,
      defenderId,
      "enemyLine",
      `O inimigo enviou Invasor. Seu Guard defendeu e foi de ${guardBefore} para ${guardAfter} de dano.${deathSuffix}`,
    );
    pushInvaderCards(
      state,
      attackerId,
      defenderId,
      defendingCard,
      guardBefore,
      guardAfter,
    );
    if (guardAfter >= 6) {
      defender.ucs.guard.status = "dead";
      pushLog(state, `O Guard de ${defender.name} caiu por excesso de dano.`);
    }
    return;
  }

  setTurnReportLine(
    state,
    attackerId,
    "selfLine",
    "Você enviou Invasor enquanto o Guard inimigo já estava morto. O King foi capturado.",
  );
  setTurnReportLine(
    state,
    defenderId,
    "enemyLine",
    "O inimigo enviou Invasor enquanto seu Guard já estava morto. O King foi capturado.",
  );
  defender.ucs.king.status = "dead";
  pushInvaderCards(state, attackerId, defenderId, defendingCard, guardBefore, null);
  setWinner(
    state,
    attackerId,
    "capture",
    `${attacker.name} capturou o King de ${defender.name}.`,
  );
}

function applyTribute(state, attackerId, defenderId) {
  const attacker = state.players[attackerId];
  const defender = state.players[defenderId];
  const trustBefore = defender.castleTrust;

  attacker.ues.tribute.available = Math.max(0, attacker.ues.tribute.available - 1);
  defender.ues.tribute.available += 1;
  defender.castleTrust = Math.min(3, defender.castleTrust + 1);

  const attackerLine =
    defender.castleTrust > trustBefore
      ? `Você enviou Tributo e ganhou 1 confiança com o inimigo (${trustBefore} -> ${defender.castleTrust}).`
      : `Você enviou Tributo e manteve a confiança do inimigo no máximo (${defender.castleTrust}).`;
  const defenderLine =
    defender.castleTrust > trustBefore
      ? `O inimigo enviou Tributo e ganhou 1 confiança com você (${trustBefore} -> ${defender.castleTrust}).`
      : `O inimigo enviou Tributo, mas a sua confiança nele já estava no máximo (${defender.castleTrust}).`;

  setTurnReportLine(state, attackerId, "selfLine", attackerLine);
  setTurnReportLine(state, defenderId, "enemyLine", defenderLine);

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
    setTurnReportLine(
      state,
      attackerId,
      "selfLine",
      "Você enviou Tributo Envenenado e pegou o Cook inimigo descansando. O King foi envenenado.",
    );
    setTurnReportLine(
      state,
      defenderId,
      "enemyLine",
      "O inimigo enviou Tributo Envenenado e pegou seu Cook descansando. O King foi envenenado.",
    );
    pushPublicCard(
      state,
      attackerId,
      "poisoned_tribute",
      "Betrayl",
      "Você enviou um tributo envenenado enquanto o Cook inimigo dormia. O King foi envenenado.",
    );
    pushPublicCard(
      state,
      defenderId,
      "poisoned_tribute",
      "Betrayl",
      "O inimigo enviou um tributo envenenado enquanto o seu Cook dormia. O King foi envenenado.",
    );
    setWinner(
      state,
      attackerId,
      "assassination",
      `${attacker.name} venceu com Betrayl sobre ${defender.name}.`,
    );
    return;
  }

  defender.castleTrust = Math.max(0, defender.castleTrust - 1);
  attacker.ues.poisoned_tribute.status = "disabled";

  const poisonBlockReason =
    defender.ucs.chef.status === "dead"
      ? "o Cook inimigo já estava morto"
      : "o Cook inimigo não estava descansando";
  const defendBlockReason =
    defender.ucs.chef.status === "dead"
      ? "seu Cook já estava morto"
      : "seu Cook não estava descansando";

  setTurnReportLine(
    state,
    attackerId,
    "selfLine",
    `Você enviou Tributo Envenenado, mas ${poisonBlockReason}. A confiança caiu de ${trustBefore} para ${defender.castleTrust}.`,
  );
  setTurnReportLine(
    state,
    defenderId,
    "enemyLine",
    `O inimigo enviou Tributo Envenenado, mas ${defendBlockReason}. Sua confiança caiu de ${trustBefore} para ${defender.castleTrust}.`,
  );

  pushPublicCard(
    state,
    attackerId,
    "poisoned_tribute",
    "Betrayl",
    `Você enviou um tributo envenenado. A confiança do inimigo caiu de ${trustBefore} para ${defender.castleTrust}.`,
  );
  pushPublicCard(
    state,
    defenderId,
    "poisoned_tribute",
    "Betrayl",
    `O inimigo enviou um tributo envenenado. Sua confiança caiu de ${trustBefore} para ${defender.castleTrust}.`,
  );
  pushLog(
    state,
    `${attacker.name} derrubou a confiança de ${defender.name} com veneno.`,
  );
}

function pushKingMadnessResetCards(state, seat) {
  const enemySeat = opposingSeat(seat);

  pushPublicCard(
    state,
    seat,
    "king",
    "Fúria do King",
    "Seu King chegou a 5 stacks, matou o próprio Cook e zerou a exaustão.",
  );
  pushPublicCard(
    state,
    enemySeat,
    "king",
    "Fúria do King",
    "O King inimigo chegou a 5 stacks, matou o próprio Cook e zerou a exaustão.",
  );
}

function pushKingMadnessLossCards(state, seat) {
  const enemySeat = opposingSeat(seat);

  pushPublicCard(
    state,
    seat,
    "king",
    "Loucura do King",
    "Seu King chegou ao próximo 5º stack, enlouqueceu e entregou a vitória ao inimigo.",
  );
  pushPublicCard(
    state,
    enemySeat,
    "king",
    "Loucura do King",
    "O King inimigo chegou ao próximo 5º stack, enlouqueceu e entregou a vitória ao seu reino.",
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

  const madnessSeats = [];

  for (const seat of PLAYER_IDS) {
    const player = state.players[seat];
    const king = player.ucs.king;
    if (king.status === "dead" || king.exhaustion < 5) continue;

    if (king.madnessStage === 0 && player.ucs.chef.status !== "dead") {
      player.ucs.chef.status = "dead";
      player.ucs.chef.exhaustion = 0;
      king.exhaustion = 0;
      king.madnessStage = 1;
      appendTurnReportLine(
        state,
        seat,
        "selfLine",
        "Seu King chegou ao limite de exaustão, matou o próprio Cook e zerou a loucura.",
      );
      appendTurnReportLine(
        state,
        opposingSeat(seat),
        "enemyLine",
        "O King inimigo chegou ao limite de exaustão, matou o próprio Cook e zerou a loucura.",
      );
      pushKingMadnessResetCards(state, seat);
      pushLog(
        state,
        `${player.name} deixou o King chegar a 5 stacks. O Cook morreu e a exaustão do King foi zerada.`,
      );
      continue;
    }

    madnessSeats.push(seat);
  }

  if (madnessSeats.length > 0) {
    const seat = madnessSeats[0];
    const player = state.players[seat];
    const enemySeat = opposingSeat(seat);
    const enemy = state.players[enemySeat];

    player.ucs.king.status = "dead";
    appendTurnReportLine(
      state,
      seat,
      "selfLine",
      "Seu King enlouqueceu ao chegar ao próximo limite de exaustão e você perdeu a partida.",
    );
    appendTurnReportLine(
      state,
      enemySeat,
      "enemyLine",
      "O King inimigo enlouqueceu ao chegar ao próximo limite de exaustão e entregou a vitória para você.",
    );
    pushKingMadnessLossCards(state, seat);
    setWinner(
      state,
      enemySeat,
      "madness",
      `${player.name} deixou o King enlouquecer no 5º stack. ${enemy.name} venceu imediatamente.`,
    );
    return;
  }

  pushLog(state, "Contadores de exaustão atualizados.");
}

function captureTurnSnapshot(state, resolvedAttackers = []) {
  const resolvedSet = new Set(resolvedAttackers);
  state.lastTurnSnapshot = {
    turnNumber: state.turnNumber,
    players: {
      C1: {
        selectedUC: state.players.C1.selectedUC,
        selectedUE: state.players.C1.selectedUE,
      },
      C2: {
        selectedUC: state.players.C2.selectedUC,
        selectedUE: state.players.C2.selectedUE,
      },
    },
    turnView: structuredClone(state.turnView),
    reportBySeat: structuredClone(state.turnReport ?? createTurnReport()),
    resolvedBySeat: {
      C1: resolvedSet.has("C1"),
      C2: resolvedSet.has("C2"),
    },
    winner: state.winner,
    victoryType: state.victoryType,
  };
}

function resolveTurn(state) {
  prepareTurnView(state);
  state.turnReport = createTurnReport();
  clearBoard(state);
  state.lastResolvedTurn = state.turnNumber;
  const resolvedAttackers = [];

  resolveInteraction(state, "C1", "C2");
  resolvedAttackers.push("C1");

  if (!state.winner) {
    resolveInteraction(state, "C2", "C1");
    resolvedAttackers.push("C2");
  }

  if (!state.winner) {
    applyExhaustion(state);
    if (!state.winner) {
      finalizeTurnReport(state, resolvedAttackers);
      updatePoisonAvailability(state);
      pushLog(state, "Resultados do turno prontos.");
      captureTurnSnapshot(state, resolvedAttackers);
      state.turnNumber += 1;
      startTurn(state, {
        preserveTurnView: true,
        immediateSelection: true,
      });
      return;
    }
  }

  finalizeTurnReport(state, resolvedAttackers);
  captureTurnSnapshot(state, resolvedAttackers);
  setPhaseResults(state);
  pushLog(state, "O turno terminou com uma vitória.");
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

function handleClearSelection(state, user, kind) {
  const seat = seatForUser(state, user);
  if (!seat || state.screen !== "game" || state.phase !== "phase_1_selection") {
    return state;
  }

  const next = cloneState(state);
  const player = next.players[seat];
  if (player.confirmed) return state;

  if (kind === "uc") {
    if (!player.selectedUC) return state;
    player.selectedUC = null;
    pushLog(next, `${seat} limpou a carta de castelo.`);
    return next;
  }

  if (!player.selectedUE) return state;
  player.selectedUE = null;
  pushLog(next, `${seat} limpou a carta de estratégia.`);
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
    case "clear_uc":
      return handleClearSelection(state, post.user.trim(), "uc");
    case "clear_ue":
      return handleClearSelection(state, post.user.trim(), "ue");
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
  if (victoryType === "madness") return "Loucura";
  return "Sem vitória";
}

export function getCardLabel(card) {
  return UC_LABELS[normalizeUCType(card)] ?? UE_LABELS[card] ?? card;
}
