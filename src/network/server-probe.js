import { create_client } from "vibinet";
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
        text: `Servidor ${VIBINET_SERVER_LABEL} indisponivel.`,
        detail: "A conexao inicial nem conseguiu abrir o cliente de rede.",
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
        text: `Servidor ${VIBINET_SERVER_LABEL} online.`,
        detail: "A conexao com o servidor configurado respondeu ao sync inicial.",
      };
    }

    if (readyState === WS_CONNECTING && waitMs < OFFLINE_TIMEOUT_MS && !reconnecting) {
      return {
        kind: "checking",
        text: `Verificando ${VIBINET_SERVER_LABEL}...`,
        detail: "A tela inicial ainda esta aguardando a primeira resposta de sync.",
      };
    }

    if (readyState === WS_OPEN && !synced) {
      return {
        kind: "checking",
        text: "Conexao aberta, aguardando sync inicial...",
        detail: "O websocket abriu, mas o servidor ainda nao respondeu ao on_sync.",
      };
    }

    if (readyState === WS_CLOSING || reconnecting) {
      return {
        kind: "offline",
        text: `Servidor ${VIBINET_SERVER_LABEL} reconectando.`,
        detail: "A conexao caiu ou nao respondeu. O cliente esta tentando reconectar.",
      };
    }

    return {
      kind: "offline",
      text: `Servidor ${VIBINET_SERVER_LABEL} offline ou sem resposta.`,
      detail: "Se o botao de entrar nao fizer nada, o problema provavelmente esta no endpoint configurado.",
    };
  }

  close() {
    this.client?.close();
  }
}
