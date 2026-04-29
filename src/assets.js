const asset = (path) => new URL(path, import.meta.url).href;

export const ASSETS = {
  background: asset("../assets/image_background.png"),
  title: asset("../assets/image_betrayal3.png"),
  cardBack: asset("../assets/image_card.png"),
  textCastle: asset("../assets/text_castle.png"),
  textCastleGray: asset("../assets/text_castle_gray.png"),
  textStrategy: asset("../assets/text_strategy.png"),
  textStrategyGray: asset("../assets/text_strategy_gray.png"),
  textNewTurn: asset("../assets/text_new_turn.png"),
  textMaintenance: asset("../assets/text_maintence.png"),
  textWinner: asset("../assets/text_winner.png"),
  castle1: asset("../assets/icon_castle1.png"),
  castle1Gray: asset("../assets/icon_castle1_gray.png"),
  castle2: asset("../assets/icon_castle2.png"),
  castle2Gray: asset("../assets/icon_castle2_gray.png"),
  iconSwap: asset("../assets/icon_swap.png"),
  iconRest: asset("../assets/icon_rest.png"),
  iconForward: asset("../assets/icon_forward.png"),
  cards: {
    king: {
      color: asset("../assets/image_king.png"),
      gray: asset("../assets/image_king_gray.png"),
    },
    chef: {
      color: asset("../assets/image_chef.png"),
      gray: asset("../assets/image_chef_gray.png"),
    },
    guard: {
      color: asset("../assets/image_guard.png"),
      gray: asset("../assets/image_guard_gray.png"),
    },
    dummy: {
      color: asset("../assets/image_king.png"),
      gray: asset("../assets/image_king_gray.png"),
    },
    assassin: {
      color: asset("../assets/image_assassin.png"),
      gray: asset("../assets/image_assassin_gray.png"),
    },
    spy: {
      color: asset("../assets/image_spy.png"),
      gray: asset("../assets/image_spy_gray.png"),
    },
    invader: {
      color: asset("../assets/image_invader.png"),
      gray: asset("../assets/image_invader_gray.png"),
    },
    tribute: {
      color: asset("../assets/image_tribute.png"),
      gray: asset("../assets/image_tribute_gray.png"),
    },
    poisoned_tribute: {
      color: asset("../assets/image_poisoned_tribute.png"),
      gray: asset("../assets/image_poisoned_tribute_gray.png"),
    },
  },
  sounds: {
    select: asset("../assets/sound_card_select.mp3"),
    place: asset("../assets/sound_card_place.mp3"),
    hover: asset("../assets/sound_ui_hover.mp3"),
    invalid: asset("../assets/sound_card_invalid.mp3"),
    turnStart: asset("../assets/sound_turn_start.mp3"),
    turnConfirm: asset("../assets/sound_turn_confirm.mp3"),
    victory: asset("../assets/sound_victory_small.mp3"),
    defeat: asset("../assets/sound_defeat_small.mp3"),
    click: asset("../assets/sound_ui_click.wav"),
  },
};
