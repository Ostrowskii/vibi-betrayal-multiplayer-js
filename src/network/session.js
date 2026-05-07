import { VibiNet } from "vibinet";
import { gameConfig } from "../game/engine.js";
import { VIBINET_SERVER_LABEL, VIBINET_SERVER_URL } from "./config.js";
import { packer } from "./packer.js";

export class MatchSession {
  constructor({ room, user, onSync = null }) {
    this.room = room;
    this.user = user;
    this.onSync = onSync;
    this.synced = false;
    this.joinPosted = false;
    this.leavePosted = false;
    this.closeTimer = null;
    this.createdAt = Date.now();
    this.placeholderState = structuredClone(gameConfig.initial);
    this.placeholderState.publicLog = [
      "Conectando ao servidor...",
      `Sala alvo: ${room}`,
      `Servidor: ${VIBINET_SERVER_LABEL}`,
    ];

    this.game = new VibiNet.game({
      room,
      server: VIBINET_SERVER_URL,
      initial: gameConfig.initial,
      on_tick: gameConfig.on_tick,
      on_post: gameConfig.on_post,
      packer,
      smooth: (_remote, local) => local,
      tick_rate: gameConfig.tick_rate,
      tolerance: gameConfig.tolerance,
    });

    this.game.on_sync(() => {
      this.synced = true;
      this.postJoin();
      window.setTimeout(() => this.onSync?.(), 0);
    });
  }

  postJoin(force = false) {
    if (!this.synced) return false;
    if (this.joinPosted && !force) return false;
    this.game.post({ $: "join", user: this.user });
    this.joinPosted = true;
    return true;
  }

  computeState() {
    if (!this.synced) {
      const waitMs = Date.now() - this.createdAt;
      if (waitMs >= 5000) {
        this.placeholderState.publicLog = [
          "Ainda sem sync inicial.",
          `Servidor: ${VIBINET_SERVER_LABEL}`,
          "Se isso nao sair dessa tela, o endpoint configurado nao respondeu ao on_sync.",
        ];
      }
      return this.placeholderState;
    }
    return this.game.compute_render_state();
  }

  leave() {
    if (!this.synced || this.leavePosted) return false;
    this.game.post({ $: "leave", user: this.user });
    this.leavePosted = true;
    return true;
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

  confirmSelection() {
    if (!this.synced) return false;
    this.game.post({ $: "confirm", user: this.user });
    return true;
  }

  advanceTurn() {
    if (!this.synced) return false;
    this.game.post({ $: "next_turn", user: this.user });
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
    if (this.closeTimer !== null) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
    this.leave();
    this.closeTimer = window.setTimeout(() => {
      this.game.close();
      this.closeTimer = null;
    }, 40);
  }
}
