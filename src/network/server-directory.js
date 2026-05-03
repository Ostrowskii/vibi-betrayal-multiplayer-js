import { VibiNet } from "vibinet";
import { gameConfig } from "../game/engine.js";
import { packer } from "./packer.js";
import { SERVER_CHOICES, VIBINET_SERVER_URL } from "./config.js";

const OFFLINE_TIMEOUT_MS = 4500;

class ServerRoomProbe {
  constructor(entry) {
    this.entry = entry;
    this.createdAt = Date.now();
    this.synced = false;
    this.bootError = null;

    try {
      this.game = new VibiNet.game({
        room: entry.room,
        server: VIBINET_SERVER_URL,
        initial: gameConfig.initial,
        on_tick: gameConfig.on_tick,
        on_post: gameConfig.on_post,
        packer,
        tick_rate: gameConfig.tick_rate,
        tolerance: gameConfig.tolerance,
      });

      this.game.on_sync(() => {
        this.synced = true;
      });
    } catch (error) {
      this.bootError = error;
      this.game = null;
    }
  }

  snapshot() {
    if (this.bootError) {
      return {
        kind: "offline",
        people: null,
        detail: "indisponivel",
      };
    }

    if (!this.synced) {
      const waitMs = Date.now() - this.createdAt;
      if (waitMs >= OFFLINE_TIMEOUT_MS) {
        return {
          kind: "offline",
          people: null,
          detail: "sem resposta",
        };
      }
      return {
        kind: "checking",
        people: null,
        detail: "verificando",
      };
    }

    try {
      const state = this.game.compute_render_state();
      const people = state.roster?.length ?? 0;
      return {
        kind: "online",
        people,
        detail: people === 1 ? "1 pessoa" : `${people} pessoas`,
      };
    } catch {
      return {
        kind: "checking",
        people: null,
        detail: "sincronizando",
      };
    }
  }

  close() {
    this.game?.close();
  }
}

export class ServerDirectory {
  constructor(entries = SERVER_CHOICES) {
    this.items = entries.map((entry) => ({
      ...entry,
      probe: new ServerRoomProbe(entry),
    }));
  }

  snapshot() {
    return this.items.map(({ probe, ...entry }) => ({
      ...entry,
      ...probe.snapshot(),
    }));
  }

  close() {
    for (const item of this.items) {
      item.probe.close();
    }
  }
}
