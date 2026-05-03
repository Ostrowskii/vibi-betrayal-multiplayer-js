export const PLAYER_IDS = ["C1", "C2"];
export const UC_TYPES = ["king", "chef", "guard", "dummy"];
export const UE_TYPES = [
  "assassin",
  "spy",
  "invader",
  "tribute",
  "poisoned_tribute",
];

export const TICK_RATE = 12;
export const TOLERANCE_MS = 350;
export const LOG_LIMIT = 14;

export const PHASE_DURATIONS = {
  phase_0_start_effects: 10,
  phase_2_results: 0,
  winner_transition: 28,
};

export const UC_LABELS = {
  king: "King",
  chef: "Cook",
  guard: "Guard",
  dummy: "Dummy",
};

export const UE_LABELS = {
  assassin: "Assassino",
  spy: "Spy",
  invader: "Invasor",
  tribute: "Tributo",
  poisoned_tribute: "Betrayl",
};

export const PHASE_LABELS = {
  lobby: "Sala",
  phase_0_start_effects: "Início do Turno",
  phase_1_selection: "Decisões Simultâneas",
  phase_2_results: "Resultados do Turno",
  winner_transition: "Vitória",
  report: "Relatório",
};

export function normalizeUCType(card) {
  return card;
}
