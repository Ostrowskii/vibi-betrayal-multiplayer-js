import { create_client } from "vibinet";
import { t } from "../i18n.js";
import { VIBINET_SERVER_LABEL, VIBINET_SERVER_URL } from "./config.js";

const WS_CONNECTING = 0;
const WS_OPEN = 1;
const WS_CLOSING = 2;
const OFFLINE_TIMEOUT_MS = 4500;

export class OfficialServerProbe {
  constructor() {
    this.createdAt = Date.now();
    this.lastSyncAt = null;
    this.bootError = null;
    this.client = null;

    try {
      this.client = create_client(VIBINET_SERVER_URL);
      this.client.on_sync(() => {
        this.lastSyncAt = Date.now();
      });
    } catch (error) {
      this.bootError = error;
    }
  }

  snapshot() {
    if (this.bootError) {
      return {
        kind: "offline",
        text: t("net.probe.unavailable.text", { server: VIBINET_SERVER_LABEL }),
        detail: t("net.probe.unavailable.detail"),
      };
    }

    const debug =
      this.client && typeof this.client.debug_dump === "function"
        ? this.client.debug_dump()
        : null;

    const readyState = debug?.ws_ready_state ?? WebSocket.CLOSED;
    const synced = Boolean(debug?.is_synced || this.lastSyncAt);
    const reconnecting =
      Boolean(debug?.reconnect_scheduled) || (debug?.reconnect_attempt ?? 0) > 0;
    const waitMs = Date.now() - this.createdAt;

    if (readyState === WS_OPEN && synced) {
      return {
        kind: "online",
        text: t("net.probe.online.text", { server: VIBINET_SERVER_LABEL }),
        detail: t("net.probe.online.detail"),
      };
    }

    if (readyState === WS_CONNECTING && waitMs < OFFLINE_TIMEOUT_MS && !reconnecting) {
      return {
        kind: "checking",
        text: t("net.probe.checking.text", { server: VIBINET_SERVER_LABEL }),
        detail: t("net.probe.checking.detail"),
      };
    }

    if (readyState === WS_OPEN && !synced) {
      return {
        kind: "checking",
        text: t("net.probe.openWaiting.text"),
        detail: t("net.probe.openWaiting.detail"),
      };
    }

    if (readyState === WS_CLOSING || reconnecting) {
      return {
        kind: "offline",
        text: t("net.probe.reconnecting.text", { server: VIBINET_SERVER_LABEL }),
        detail: t("net.probe.reconnecting.detail"),
      };
    }

    return {
      kind: "offline",
      text: t("net.probe.offline.text", { server: VIBINET_SERVER_LABEL }),
      detail: t("net.probe.offline.detail"),
    };
  }

  close() {
    this.client?.close();
  }
}
