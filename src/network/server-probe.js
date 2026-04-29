import { create_client } from "vibinet";

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
      this.client = create_client();
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
        text: "Servidor oficial do vibinet indisponivel.",
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
        text: "Servidor oficial do vibinet online.",
        detail: "A conexao com o servidor oficial respondeu ao sync inicial.",
      };
    }

    if (readyState === WS_CONNECTING && waitMs < OFFLINE_TIMEOUT_MS && !reconnecting) {
      return {
        kind: "checking",
        text: "Verificando o servidor oficial do vibinet...",
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
        text: "Servidor oficial do vibinet reconectando.",
        detail: "A conexao caiu ou nao respondeu. O cliente esta tentando reconectar.",
      };
    }

    return {
      kind: "offline",
      text: "Servidor oficial do vibinet offline ou sem resposta.",
      detail: "Se o botao de entrar nao fizer nada, o problema provavelmente esta no servidor oficial.",
    };
  }

  close() {
    this.client?.close();
  }
}
