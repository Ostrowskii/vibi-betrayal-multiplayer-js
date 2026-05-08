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
export const DEFAULT_LOCALE = "en";

export const PHASE_DURATIONS = {
  phase_0_start_effects: 10,
  phase_2_results: 0,
  winner_transition: 28,
};

export const CARD_LABELS = {
  en: {
    king: "King",
    chef: "Cook",
    guard: "Guard",
    dummy: "Dummy",
    assassin: "Assassin",
    spy: "Spy",
    invader: "Invader",
    tribute: "Tribute",
    poisoned_tribute: "Betrayl",
  },
  ptBR: {
    king: "Rei",
    chef: "Cozinheiro",
    guard: "Guarda",
    dummy: "Dummy",
    assassin: "Assassino",
    spy: "Spy",
    invader: "Invasor",
    tribute: "Tributo",
    poisoned_tribute: "Traicao",
  },
};

export const SUPPORTED_LOCALES = Object.keys(CARD_LABELS);

const pickCardLabels = (keys, locale = "en") =>
  Object.fromEntries(keys.map((key) => [key, CARD_LABELS[locale][key]]));

export const UC_LABELS = pickCardLabels(UC_TYPES);

export const UE_LABELS = pickCardLabels(UE_TYPES);

export const PHASE_LABELS = {
  en: {
    lobby: "Room",
    phase_0_start_effects: "Turn Start",
    phase_1_selection: "Simultaneous Choices",
    phase_2_results: "Turn Results",
    winner_transition: "Victory",
    report: "Report",
  },
  ptBR: {
    lobby: "Sala",
    phase_0_start_effects: "Inicio do Turno",
    phase_1_selection: "Decisoes Simultaneas",
    phase_2_results: "Resultados do Turno",
    winner_transition: "Vitoria",
    report: "Relatorio",
  },
};

export function normalizeUCType(card) {
  return card;
}

export function getCardLabel(card, locale = DEFAULT_LOCALE) {
  const normalized = normalizeUCType(card);
  return CARD_LABELS[locale]?.[normalized] ?? CARD_LABELS[locale]?.[card] ?? card;
}

export function getCardLabels(keys, locale = DEFAULT_LOCALE) {
  return Object.fromEntries(keys.map((key) => [key, getCardLabel(key, locale)]));
}

export function getPhaseLabel(phase, locale = DEFAULT_LOCALE) {
  return PHASE_LABELS[locale]?.[phase] ?? PHASE_LABELS.en[phase] ?? phase;
}
