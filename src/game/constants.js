export const PLAYER_IDS = ["C1", "C2"];
export const UC_TYPES = ["king", "chef", "guard"];
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
  phase_2_reveal_c1: 18,
  phase_3_check_winner: 8,
  phase_4_reveal_c2: 18,
  phase_5_check_winner: 8,
  phase_6_exhaustion: 8,
  phase_7_maintenance: 10,
  winner_transition: 28,
};

export const UC_LABELS = {
  king: "Rei",
  chef: "Cozinheiro",
  guard: "Guarda",
  dummy: "Rei",
};

export const UE_LABELS = {
  assassin: "Assassino",
  spy: "Spy",
  invader: "Invasor",
  tribute: "Tributo",
  poisoned_tribute: "Tributo Envenenado",
};

export const PHASE_LABELS = {
  lobby: "Sala",
  phase_0_start_effects: "Inicio do Turno",
  phase_1_selection: "Selecao Simultanea",
  phase_2_reveal_c1: "Revelacao de C1",
  phase_3_check_winner: "Checagem de Vitoria",
  phase_4_reveal_c2: "Revelacao de C2",
  phase_5_check_winner: "Checagem de Vitoria",
  phase_6_exhaustion: "Exaustao",
  phase_7_maintenance: "Manutencao",
  winner_transition: "Vitoria",
  report: "Relatorio",
};

export function normalizeUCType(card) {
  return card === "dummy" ? "king" : card;
}
