import { VibiNet } from "vibinet";
import { gameConfig } from "../game/engine.js";
import { packer } from "./packer.js";

export class MatchSession {
  constructor({ room, user }) {
    this.room = room;
    this.user = user;
    this.synced = false;
    this.joinPosted = false;

    this.game = new VibiNet.game({
      room,
      initial: gameConfig.initial,
      on_tick: gameConfig.on_tick,
      on_post: gameConfig.on_post,
      packer,
      tick_rate: gameConfig.tick_rate,
      tolerance: gameConfig.tolerance,
    });

    this.game.on_sync(() => {
      this.synced = true;
      if (!this.joinPosted) {
        this.game.post({ $: "join", user: this.user });
        this.joinPosted = true;
      }
    });
  }

  computeState() {
    return this.game.compute_render_state();
  }

  selectUC(card) {
    this.game.post({ $: "select_uc", user: this.user, card: { $: card } });
  }

  selectUE(card) {
    this.game.post({ $: "select_ue", user: this.user, card: { $: card } });
  }

  continueWinner() {
    this.game.post({ $: "continue", user: this.user });
  }

  reportAction(action) {
    this.game.post({
      $: "report_action",
      user: this.user,
      action: { $: action },
    });
  }

  close() {
    this.game.close();
  }
}
