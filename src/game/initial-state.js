import { PHASE_DURATIONS } from "./constants.js";

export function cloneState(state) {
  return structuredClone(state);
}

export function createPlayerState(id, name = "") {
  return {
    id,
    name,
    castleTrust: 0,
    guardDamage: 0,
    tradeRouteBlockedThisTurn: false,
    tradeRouteBlockedNextTurn: false,
    selectedUC: null,
    selectedUE: null,
    confirmed: false,
    ucs: {
      king: { status: "active", exhaustion: 0 },
      chef: { status: "active", exhaustion: 0 },
      guard: { status: "active", exhaustion: 0 },
      dummy: { status: "active", exhaustion: 0 },
    },
    ues: {
      assassin: { status: "alive" },
      spy: { status: "active" },
      invader: { available: 3 },
      tribute: { available: 3 },
      poisoned_tribute: { status: "disabled" },
    },
  };
}

export function createBoardSlot(key, owner, role) {
  return {
    key,
    owner,
    role,
    card: null,
    revealed: false,
    hidden: false,
    detail: "",
  };
}

export function createBoardState() {
  return {
    c1Send: createBoardSlot("c1Send", "C1", "send"),
    c2Rest: createBoardSlot("c2Rest", "C2", "rest"),
    c2Send: createBoardSlot("c2Send", "C2", "send"),
    c1Rest: createBoardSlot("c1Rest", "C1", "rest"),
    spotlight: null,
  };
}

export function createInitialState() {
  return {
    screen: "lobby",
    phase: "lobby",
    phaseTicksRemaining: 0,
    turnNumber: 1,
    matchNumber: 1,
    roster: [],
    players: {
      C1: createPlayerState("C1"),
      C2: createPlayerState("C2"),
    },
    board: createBoardState(),
    winner: null,
    victoryType: null,
    reportAction: null,
    publicLog: ["Aguardando dois jogadores entrarem na sala."],
  };
}

export function createLobbyState(roster = [], matchNumber = 1, publicLog = null) {
  const state = createInitialState();
  state.roster = roster.slice(0, 2);
  state.players.C1.name = state.roster[0] ?? "";
  state.players.C2.name = state.roster[1] ?? "";
  state.matchNumber = matchNumber;
  if (Array.isArray(publicLog) && publicLog.length > 0) {
    state.publicLog = publicLog;
  }
  return state;
}

export function createFreshMatchState(roster, matchNumber = 1) {
  const state = createLobbyState(roster, matchNumber);
  state.screen = "game";
  state.phase = "phase_0_start_effects";
  state.phaseTicksRemaining = PHASE_DURATIONS.phase_0_start_effects;
  state.matchNumber = matchNumber;
  state.publicLog = [
    `Partida ${matchNumber} iniciada. Preparando o turno 1.`,
  ];
  return state;
}
