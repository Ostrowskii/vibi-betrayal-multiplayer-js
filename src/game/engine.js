import {
  LOG_LIMIT,
  normalizeUCType,
  PHASE_DURATIONS,
  PLAYER_IDS,
  TICK_RATE,
  TOLERANCE_MS,
  UC_TYPES,
  getCardLabel as getLocalizedCardLabel,
} from "./constants.js";
import {
  cloneState,
  createBoardState,
  createFreshMatchState,
  createInitialState,
  createLobbyState,
  createTurnView,
} from "./initial-state.js";
import { cardDescriptor, msg, t } from "../i18n.js";

function pushLog(state, text) {
  state.publicLog = [text, ...state.publicLog].slice(0, LOG_LIMIT);
}

function cardName(card) {
  return getLocalizedCardLabel(card);
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
        msg("engine.title.yourRest"),
        msg("engine.rest.dummyText"),
      );
      continue;
    }

    pushPrivateCard(
      state,
      seat,
      rested,
      msg("engine.title.yourRest"),
      msg("engine.rest.withCard", { card: rested }),
    );
  }
}

function prepareTurnView(state) {
  clearTurnView(state);
  addRestPrivateCards(state);
}

function updatePoisonAvailability(state) {
  const c1Player = state.players.C1;
  const c2Player = state.players.C2;
  const c1TargetTrust = c2Player.castleTrust;
  const c2TargetTrust = c1Player.castleTrust;
  state.players.C1.ues.poisoned_tribute.status =
    c1TargetTrust >= 3 && c1Player.ucs.chef.status !== "dead" && c1Player.ucs.chef.exhaustion < 4
      ? "active"
      : "disabled";
  state.players.C2.ues.poisoned_tribute.status =
    c2TargetTrust >= 3 && c2Player.ucs.chef.status !== "dead" && c2Player.ucs.chef.exhaustion < 4
      ? "active"
      : "disabled";
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
  pushLog(state, msg("engine.log.turnStarted", { turnNumber: state.turnNumber }));
  if (immediateSelection) {
    pushLog(state, msg("engine.log.selectionOpened"));
  }
}

function enterSelectionPhase(state) {
  state.phase = "phase_1_selection";
  state.phaseTicksRemaining = 0;
  clearBoard(state);
  clearTurnView(state);
  pushLog(state, msg("engine.log.selectionOpened"));
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
      selfLine: [],
      enemyLine: [],
    },
    C2: {
      selfLine: [],
      enemyLine: [],
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
  ensureTurnReport(state)[seat][bucket] = text ? [text] : [];
}

function appendTurnReportLine(state, seat, bucket, text) {
  if (!text) return;
  const report = ensureTurnReport(state);
  report[seat][bucket].push(text);
}

function finalizeTurnReport(state, resolvedAttackers) {
  const report = ensureTurnReport(state);
  const resolvedSet = new Set(resolvedAttackers);

  for (const seat of PLAYER_IDS) {
    const enemySeat = opposingSeat(seat);

    if (report[seat].selfLine.length === 0) {
      report[seat].selfLine = [
        state.winner && !resolvedSet.has(seat)
          ? msg("engine.report.default.selfVictoryBeforeResolve")
          : msg("engine.report.default.selfNoEffect"),
      ];
    }

    if (report[seat].enemyLine.length === 0) {
      report[seat].enemyLine = [
        state.winner && !resolvedSet.has(enemySeat)
          ? msg("engine.report.default.enemyVictoryBeforeResolve")
          : msg("engine.report.default.enemyNoEffect"),
      ];
    }
  }
}

function pushAssassinCards(state, attackerId, defenderId, killedKing) {
  const attackerText = killedKing
    ? msg("engine.assassin.public.selfKill")
    : msg("engine.assassin.public.selfCaught");
  const defenderText = killedKing
    ? msg("engine.assassin.public.enemyKill")
    : msg("engine.assassin.public.enemyCaught");

  pushPublicCard(state, attackerId, "assassin", cardDescriptor("assassin"), attackerText);
  pushPublicCard(state, defenderId, "assassin", cardDescriptor("assassin"), defenderText);
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
      ? msg("engine.assassin.report.selfKill")
      : msg("engine.assassin.report.selfCaught"),
  );
  setTurnReportLine(
    state,
    defenderId,
    "enemyLine",
    killedKing
      ? msg("engine.assassin.report.enemyKill")
      : msg("engine.assassin.report.enemyCaught"),
  );

  pushAssassinCards(state, attackerId, defenderId, killedKing);

  if (killedKing) {
    defender.ucs.king.status = "dead";
    setWinner(
      state,
      attackerId,
      "assassination",
      msg("engine.winner.assassinatedKing", {
        attacker: attacker.name,
        defender: defender.name,
      }),
    );
    return;
  }

  attacker.ues.assassin.status = "dead";
  pushLog(
    state,
    msg("engine.log.assassinLost", {
      attacker: attacker.name,
      defender: defender.name,
    }),
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
    msg("engine.title.spySent"),
    msg("engine.spy.sentText"),
  );

  if (defendingCard === "dummy") {
    setTurnReportLine(
      state,
      attackerId,
      "selfLine",
      msg("engine.spy.report.selfCaught"),
    );
    setTurnReportLine(
      state,
      defenderId,
      "enemyLine",
      msg("engine.spy.report.enemyCaught"),
    );
    pushPublicCard(
      state,
      attackerId,
      "spy",
      msg("engine.title.spyCaptured"),
      msg("engine.spy.public.selfCaught"),
    );
    pushPublicCard(
      state,
      defenderId,
      "spy",
      msg("engine.title.spyCaptured"),
      msg("engine.spy.public.enemyCaught"),
    );
    pushPrivateCard(
      state,
      attackerId,
      null,
      msg("engine.title.spyReport"),
      msg("engine.spy.private.caught"),
    );
    attacker.ues.spy.status = "imprisoned";
    pushLog(
      state,
      msg("engine.log.spyLostNobodyRested", { attacker: attacker.name }),
    );
    return;
  }

  setTurnReportLine(
    state,
    attackerId,
    "selfLine",
    msg("engine.spy.report.selfFound", { card: defendingCard }),
  );
  setTurnReportLine(
    state,
    defenderId,
    "enemyLine",
    msg("engine.spy.report.enemyFound", { card: defendingCard }),
  );
  pushPrivateCard(
    state,
    attackerId,
    null,
    msg("engine.title.spyReport"),
    msg("engine.spy.private.found", { card: defendingCard }),
  );
  pushLog(
    state,
    msg("engine.log.spyFoundRest", {
      attacker: attacker.name,
      card: defendingCard,
    }),
  );
}

function pushInvaderCards(
  state,
  attackerId,
  defenderId,
  guardBefore,
  guardAfter,
  captureReason,
) {
  if (captureReason === "guard_dead") {
    pushPublicCard(
      state,
      attackerId,
      "invader",
      cardDescriptor("invader"),
      msg("engine.invader.public.selfSleepingGuard"),
    );
    pushPublicCard(
      state,
      defenderId,
      "invader",
      cardDescriptor("invader"),
      msg("engine.invader.public.enemySleepingGuard"),
    );
    return;
  }

  if (captureReason === "guard_exhausted") {
    pushPublicCard(
      state,
      attackerId,
      "invader",
      cardDescriptor("invader"),
      msg("engine.invader.public.selfExhaustedGuard"),
    );
    pushPublicCard(
      state,
      defenderId,
      "invader",
      cardDescriptor("invader"),
      msg("engine.invader.public.enemyExhaustedGuard"),
    );
    return;
  }

  if (guardAfter !== null) {
    pushPublicCard(
      state,
      attackerId,
      "invader",
      cardDescriptor("invader"),
      msg("engine.invader.public.selfGuardDefended", {
        before: guardBefore,
        after: guardAfter,
      }),
    );
    pushPublicCard(
      state,
      defenderId,
      "invader",
      cardDescriptor("invader"),
      msg("engine.invader.public.enemyGuardDefended", {
        before: guardBefore,
        after: guardAfter,
      }),
    );
    return;
  }

  pushPublicCard(
    state,
    attackerId,
    "invader",
    cardDescriptor("invader"),
    msg("engine.invader.public.selfUnavailableGuard"),
  );
  pushPublicCard(
    state,
    defenderId,
    "invader",
    cardDescriptor("invader"),
    msg("engine.invader.public.enemyUnavailableGuard"),
  );
}

function applyInvader(state, attackerId, defenderId) {
  const attacker = state.players[attackerId];
  const defender = state.players[defenderId];
  const defendingCard = normalizeUCType(defender.selectedUC);
  const guardBefore = defender.guardDamage;
  const guardExhaustion = defender.ucs.guard.exhaustion;
  const guardCanBlock = defender.ucs.guard.status !== "dead" && guardExhaustion < 5;
  const guardDamageIncrement = guardExhaustion >= 4 ? 4 : guardExhaustion >= 3 ? 3 : 2;

  attacker.ues.invader.available = Math.max(0, attacker.ues.invader.available - 1);
  applyTradeBlockFromInvader(state, attackerId);

  if (defendingCard === "guard" && guardCanBlock) {
    setTurnReportLine(
      state,
      attackerId,
      "selfLine",
      msg("engine.invader.report.selfKilledRestingGuard"),
    );
    setTurnReportLine(
      state,
      defenderId,
      "enemyLine",
      msg("engine.invader.report.enemyKilledRestingGuard"),
    );
    defender.ucs.guard.status = "dead";
    pushInvaderCards(
      state,
      attackerId,
      defenderId,
      guardBefore,
      null,
      "guard_dead",
    );
    pushLog(
      state,
      msg("engine.log.invaderDroppedGuard", {
        attacker: attacker.name,
        defender: defender.name,
      }),
    );
    return;
  }

  if (guardCanBlock) {
    defender.guardDamage += guardDamageIncrement;
    const guardAfter = defender.guardDamage;
    const deathSuffix = guardAfter >= 6 ? msg("engine.invader.deathSuffix") : "";
    setTurnReportLine(
      state,
      attackerId,
      "selfLine",
      msg("engine.invader.report.selfDefended", {
        before: guardBefore,
        after: guardAfter,
        deathSuffix,
      }),
    );
    setTurnReportLine(
      state,
      defenderId,
      "enemyLine",
      msg("engine.invader.report.enemyDefended", {
        before: guardBefore,
        after: guardAfter,
        deathSuffix,
      }),
    );
    pushInvaderCards(
      state,
      attackerId,
      defenderId,
      guardBefore,
      guardAfter,
      null,
    );
    if (guardAfter >= 6) {
      defender.ucs.guard.status = "dead";
      pushLog(
        state,
        msg("engine.log.guardFellFromDamage", { defender: defender.name }),
      );
    }
    return;
  }

  setTurnReportLine(
    state,
    attackerId,
    "selfLine",
    guardExhaustion >= 5
      ? msg("engine.invader.report.selfCapturedExhausted")
      : msg("engine.invader.report.selfCapturedDead"),
  );
  setTurnReportLine(
    state,
    defenderId,
    "enemyLine",
    guardExhaustion >= 5
      ? msg("engine.invader.report.enemyCapturedExhausted")
      : msg("engine.invader.report.enemyCapturedDead"),
  );
  defender.ucs.king.status = "dead";
  pushInvaderCards(
    state,
    attackerId,
    defenderId,
    guardBefore,
    null,
    guardExhaustion >= 5 ? "guard_exhausted" : "guard_dead",
  );
  setWinner(
    state,
    attackerId,
    "capture",
    msg("engine.winner.captureKing", {
      attacker: attacker.name,
      defender: defender.name,
    }),
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
      ? msg("engine.tribute.report.selfGain", {
        before: trustBefore,
        after: defender.castleTrust,
      })
      : msg("engine.tribute.report.selfMax", {
        value: defender.castleTrust,
      });
  const defenderLine =
    defender.castleTrust > trustBefore
      ? msg("engine.tribute.report.enemyGain", {
        before: trustBefore,
        after: defender.castleTrust,
      })
      : msg("engine.tribute.report.enemyMax", {
        value: defender.castleTrust,
      });

  setTurnReportLine(state, attackerId, "selfLine", attackerLine);
  setTurnReportLine(state, defenderId, "enemyLine", defenderLine);

  pushPublicCard(
    state,
    attackerId,
    "tribute",
    cardDescriptor("tribute"),
    msg("engine.tribute.public.sent", {
      before: trustBefore,
      after: defender.castleTrust,
    }),
  );
  pushPublicCard(
    state,
    defenderId,
    "tribute",
    cardDescriptor("tribute"),
    msg("engine.tribute.public.received", {
      before: trustBefore,
      after: defender.castleTrust,
    }),
  );
  pushLog(
    state,
    msg("engine.log.tributeRaisedTrust", {
      attacker: attacker.name,
      defender: defender.name,
    }),
  );
}

function applyPoisonedTribute(state, attackerId, defenderId) {
  const attacker = state.players[attackerId];
  const defender = state.players[defenderId];
  const defendingCard = normalizeUCType(defender.selectedUC);
  const trustBefore = defender.castleTrust;
  const cookDead = defender.ucs.chef.status === "dead";
  const chefTooTiredToProtect = defender.ucs.chef.exhaustion >= 4;

  if (defendingCard === "chef" && !chefTooTiredToProtect) {
    setTurnReportLine(
      state,
      attackerId,
      "selfLine",
      msg("engine.betrayl.report.selfKill"),
    );
    setTurnReportLine(
      state,
      defenderId,
      "enemyLine",
      msg("engine.betrayl.report.enemyKill"),
    );
    pushPublicCard(
      state,
      attackerId,
      "poisoned_tribute",
      cardDescriptor("poisoned_tribute"),
      msg("engine.betrayl.public.selfKill"),
    );
    pushPublicCard(
      state,
      defenderId,
      "poisoned_tribute",
      cardDescriptor("poisoned_tribute"),
      msg("engine.betrayl.public.enemyKill"),
    );
    setWinner(
      state,
      attackerId,
      "assassination",
      msg("engine.winner.betrayl", {
        attacker: attacker.name,
        defender: defender.name,
      }),
    );
    return;
  }

  if (cookDead) {
    setTurnReportLine(
      state,
      attackerId,
      "selfLine",
      msg("engine.betrayl.report.selfExposedKill"),
    );
    setTurnReportLine(
      state,
      defenderId,
      "enemyLine",
      msg("engine.betrayl.report.enemyExposedKill"),
    );
    pushPublicCard(
      state,
      attackerId,
      "poisoned_tribute",
      cardDescriptor("poisoned_tribute"),
      msg("engine.betrayl.public.selfExposedKill"),
    );
    pushPublicCard(
      state,
      defenderId,
      "poisoned_tribute",
      cardDescriptor("poisoned_tribute"),
      msg("engine.betrayl.public.enemyExposedKill"),
    );
    setWinner(
      state,
      attackerId,
      "assassination",
      msg("engine.winner.betrayl", {
        attacker: attacker.name,
        defender: defender.name,
      }),
    );
    return;
  }

  defender.castleTrust = Math.max(0, defender.castleTrust - 1);
  attacker.ues.poisoned_tribute.status = "disabled";

  const poisonBlockReason =
    chefTooTiredToProtect
      ? msg("engine.betrayl.reason.selfCookTooTired")
      : defender.ucs.chef.status === "dead"
      ? msg("engine.betrayl.reason.enemyCookDead")
      : msg("engine.betrayl.reason.enemyCookNotResting");
  const defendBlockReason =
    chefTooTiredToProtect
      ? msg("engine.betrayl.reason.defendCookTooTired")
      : defender.ucs.chef.status === "dead"
      ? msg("engine.betrayl.reason.defendCookDead")
      : msg("engine.betrayl.reason.defendCookNotResting");

  setTurnReportLine(
    state,
    attackerId,
    "selfLine",
    msg("engine.betrayl.report.selfFail", {
      reason: poisonBlockReason,
      before: trustBefore,
      after: defender.castleTrust,
    }),
  );
  setTurnReportLine(
    state,
    defenderId,
    "enemyLine",
    msg("engine.betrayl.report.enemyFail", {
      reason: defendBlockReason,
      before: trustBefore,
      after: defender.castleTrust,
    }),
  );

  pushPublicCard(
    state,
    attackerId,
    "poisoned_tribute",
    cardDescriptor("poisoned_tribute"),
    msg("engine.betrayl.public.selfFail", {
      before: trustBefore,
      after: defender.castleTrust,
    }),
  );
  pushPublicCard(
    state,
    defenderId,
    "poisoned_tribute",
    cardDescriptor("poisoned_tribute"),
    msg("engine.betrayl.public.enemyFail", {
      before: trustBefore,
      after: defender.castleTrust,
    }),
  );
  pushLog(
    state,
    msg("engine.log.betraylLoweredTrust", {
      attacker: attacker.name,
      defender: defender.name,
    }),
  );
}

function pushKingMadnessResetCards(state, seat) {
  const enemySeat = opposingSeat(seat);

  pushPublicCard(
    state,
    seat,
    "king",
    msg("engine.title.kingFury"),
    msg("engine.kingReset.public.self"),
  );
  pushPublicCard(
    state,
    enemySeat,
    "king",
    msg("engine.title.kingFury"),
    msg("engine.kingReset.public.enemy"),
  );
}

function pushKingMadnessLossCards(state, seat) {
  const enemySeat = opposingSeat(seat);

  pushPublicCard(
    state,
    seat,
    "king",
    msg("engine.title.kingMadness"),
    msg("engine.kingMadness.public.self"),
  );
  pushPublicCard(
    state,
    enemySeat,
    "king",
    msg("engine.title.kingMadness"),
    msg("engine.kingMadness.public.enemy"),
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

  for (const seat of PLAYER_IDS) {
    const player = state.players[seat];
    const chef = player.ucs.chef;
    if (chef.status === "dead" || chef.exhaustion < 5 || player.ucs.king.status === "dead") {
      continue;
    }

    const enemySeat = opposingSeat(seat);
    const enemy = state.players[enemySeat];
    player.ucs.king.status = "dead";
    appendTurnReportLine(
      state,
      seat,
      "selfLine",
      msg("engine.cookCollapse.report.self"),
    );
    appendTurnReportLine(
      state,
      enemySeat,
      "enemyLine",
      msg("engine.cookCollapse.report.enemy"),
    );
    pushPublicCard(
      state,
      seat,
      "chef",
      msg("engine.title.cookCollapse"),
      msg("engine.cookCollapse.public.self"),
    );
    pushPublicCard(
      state,
      enemySeat,
      "chef",
      msg("engine.title.cookCollapse"),
      msg("engine.cookCollapse.public.enemy"),
    );
    setWinner(
      state,
      enemySeat,
      "madness",
      msg("engine.winner.cookCollapse", {
        player: player.name,
        enemy: enemy.name,
      }),
    );
    return;
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
      msg("engine.kingReset.report.self"),
    );
      appendTurnReportLine(
      state,
      opposingSeat(seat),
      "enemyLine",
      msg("engine.kingReset.report.enemy"),
    );
      pushKingMadnessResetCards(state, seat);
      pushLog(
        state,
        msg("engine.log.kingMadnessReset", { player: player.name }),
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
      msg("engine.kingMadness.report.self"),
    );
    appendTurnReportLine(
      state,
      enemySeat,
      "enemyLine",
      msg("engine.kingMadness.report.enemy"),
    );
    pushKingMadnessLossCards(state, seat);
    setWinner(
      state,
      enemySeat,
      "madness",
      msg("engine.log.kingMadnessLoss", {
        player: player.name,
        enemy: enemy.name,
      }),
    );
    return;
  }

  pushLog(state, msg("engine.log.exhaustionUpdated"));
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
      pushLog(state, msg("engine.log.resultsReady"));
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
  pushLog(state, msg("engine.log.turnEndedWithVictory"));
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
  if (player.ucs.king.exhaustion >= 4) return false;
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
  pushLog(next, msg("engine.log.userJoinedRoom", { user }));

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
    pushLog(next, msg("engine.log.lockedCastle", { seat }));
  } else {
    if (!canSelectUE(player, selected)) return state;
    player.selectedUE = selected;
    pushLog(next, msg("engine.log.lockedStrategy", { seat }));
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
    pushLog(next, msg("engine.log.clearedCastle", { seat }));
    return next;
  }

  if (!player.selectedUE) return state;
  player.selectedUE = null;
  pushLog(next, msg("engine.log.clearedStrategy", { seat }));
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
  pushLog(next, msg("engine.log.confirmedChoices", { seat }));

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
  pushLog(next, msg("engine.log.openedNextTurn", { user }));
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
      msg("engine.log.userLeftRoom", { user }),
      state.roster.length > 1
        ? msg("engine.log.waitingAnotherPlayer")
        : msg("engine.log.roomEmpty"),
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
    next.publicLog = [msg("engine.log.closedMatchToMenu", { user })];
    return next;
  }

  if (actionTag === "restart") {
    const next = createFreshMatchState(state.roster, state.matchNumber + 1);
    pushLog(
      next,
      msg("engine.log.restartedMatch", {
        user,
        matchNumber: next.matchNumber,
      }),
    );
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
  get initial() {
    return createInitialState();
  },
  on_tick: onTick,
  on_post: onPost,
  tick_rate: TICK_RATE,
  tolerance: TOLERANCE_MS,
};

export function getVictoryLabel(victoryType) {
  if (victoryType === "capture") return t("victory.capture");
  if (victoryType === "assassination") return t("victory.assassination");
  if (victoryType === "madness") return t("victory.madness");
  return t("victory.none");
}

export function getCardLabel(card) {
  return cardName(card);
}
