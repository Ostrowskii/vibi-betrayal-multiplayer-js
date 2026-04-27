import { VibiNet } from "vibinet";
import { gameConfig } from "../game/engine.js";
import { packer } from "./packer.js";

export class MatchSession {
  constructor({ room, user, server }) {
    this.room = room;
    this.user = user;
    this.server = server ?? null;
    this.synced = false;
    this.joinPosted = false;
    this.createdAt = Date.now();
    this.placeholderState = structuredClone(gameConfig.initial);
    this.placeholderState.publicLog = [
      "Conectando ao servidor...",
      `Sala alvo: ${room}`,
      `Servidor: ${this.server ?? "oficial do vibinet"}`,
    ];

    this.game = new VibiNet.game({
      ...(this.server ? { server: this.server } : {}),
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
    if (!this.synced) {
      const waitMs = Date.now() - this.createdAt;
      if (waitMs >= 5000) {
        this.placeholderState.publicLog = [
          "Ainda sem sync inicial.",
          `Servidor: ${this.server ?? "oficial do vibinet"}`,
          "Se isso nao sair dessa tela, o servidor alvo nao respondeu ao on_sync.",
        ];
      }
      return this.placeholderState;
    }
    return this.game.compute_render_state();
  }

  selectUC(card) {
    if (!this.synced) return false;
    this.game.post({ $: "select_uc", user: this.user, card: { $: card } });
    return true;
  }

  selectUE(card) {
    if (!this.synced) return false;
    this.game.post({ $: "select_ue", user: this.user, card: { $: card } });
    return true;
  }

  continueWinner() {
    if (!this.synced) return false;
    this.game.post({ $: "continue", user: this.user });
    return true;
  }

  reportAction(action) {
    if (!this.synced) return false;
    this.game.post({
      $: "report_action",
      user: this.user,
      action: { $: action },
    });
    return true;
  }

  close() {
    this.game.close();
  }
}
