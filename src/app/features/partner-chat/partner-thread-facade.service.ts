import { Injectable } from '@angular/core';
import { onValue, push, ref, update } from 'firebase/database';
import { supportRtdb } from '../../firebase-config';
import { PartnerChatApiService } from './partner-chat-api.service';
import { PartnerChatIdentityService } from './partner-chat-identity.service';
import type {
  PartnerChatMode,
  PartnerMessageKind,
  PartnerSendPayload,
  PartnerThreadMessage,
} from './partner-chat.models';
import * as P from './partner-paths';

/** Payload gravado no RTDB (sem `id`). */
type PartnerOutboundMessage = Omit<PartnerThreadMessage, 'id'>;

@Injectable({ providedIn: 'root' })
export class PartnerThreadFacadeService {
  constructor(
    private identity: PartnerChatIdentityService,
    private api: PartnerChatApiService
  ) {}

  async ensureThreadAsCliente(parceiroId: number): Promise<string> {
    const { threadId } = await this.api.ensureThreadCliente(parceiroId);
    return threadId;
  }

  async ensureThreadAsParceiro(clienteId: number): Promise<string> {
    const { threadId } = await this.api.ensureThreadParceiro(clienteId);
    return threadId;
  }

  /**
   * Aceita texto simples (retrocompat) ou payload com resposta, áudio e anexos.
   */
  async sendMessage(
    mode: PartnerChatMode,
    threadId: string,
    textOrPayload: string | PartnerSendPayload
  ): Promise<void> {
    const p: PartnerSendPayload =
      typeof textOrPayload === 'string' ? { text: textOrPayload } : textOrPayload;
    const trimmed = (p.text || '').trim();
    const hasMedia = !!(p.audioUrl || (p.attachments && p.attachments.length > 0));
    if (!trimmed && !hasMedia) {
      return;
    }
    await this.identity.ensureFirebaseForChat(mode);
    const uid = this.identity.getChatUidOrThrow();
    const senderRole: PartnerThreadMessage['senderRole'] =
      mode === 'cliente' ? 'cliente' : 'parceiro_staff';
    const ts = Date.now();
    const kind: PartnerMessageKind =
      p.kind ||
      (p.audioUrl && trimmed
        ? 'mixed'
        : p.audioUrl
          ? 'audio'
          : p.attachments?.length
            ? 'file'
            : 'text');
    const msg: PartnerOutboundMessage = {
      text: trimmed.slice(0, 4000),
      senderRole,
      senderUid: uid,
      ts,
      kind,
    };
    if (p.replyTo) {
      msg.replyTo = p.replyTo;
      if (p.replySnippet != null) {
        msg.replySnippet = String(p.replySnippet).slice(0, 500);
      }
      if (p.replyRole) {
        msg.replyRole = p.replyRole;
      }
    }
    if (p.audioUrl) {
      msg.audioUrl = p.audioUrl;
      if (p.audioMime) {
        msg.audioMime = p.audioMime;
      }
      if (p.audioDurationSec != null && Number.isFinite(p.audioDurationSec)) {
        msg.audioDurationSec = p.audioDurationSec;
      }
    }
    if (p.attachments?.length) {
      msg.attachments = p.attachments.map((a) => ({
        url: a.url,
        name: a.name,
        mime: a.mime,
      }));
    }
    const mid = push(ref(supportRtdb, P.pathThreadMessages(threadId))).key;
    if (!mid) {
      throw new Error('Falha ao enviar');
    }
    await update(ref(supportRtdb), {
      [`${P.pathThreadMessages(threadId)}/${mid}`]: msg,
    });
    const extras = this.buildExtrasForMysql(p, kind);
    if (mode === 'cliente') {
      void this.api.logMensagemClienteFireAndForget({
        threadId,
        firebaseMessageId: mid,
        text: msg.text,
        senderRole: 'cliente',
        ts,
        extras,
      });
    } else {
      void this.api.logMensagemParceiroFireAndForget({
        threadId,
        firebaseMessageId: mid,
        text: msg.text,
        senderRole: 'parceiro_staff',
        ts,
        extras,
      });
    }
  }

  subscribeMessages(threadId: string, onNext: (list: PartnerThreadMessage[]) => void): () => void {
    const mref = ref(supportRtdb, P.pathThreadMessages(threadId));
    return onValue(mref, (snap) => {
      const v = snap.val() as Record<string, Omit<PartnerThreadMessage, 'id'>> | null;
      if (!v) {
        onNext([]);
        return;
      }
      const list: PartnerThreadMessage[] = Object.keys(v)
        .map((id) => ({ id, ...v[id]! }))
        .sort((a, b) => a.ts - b.ts);
      onNext(list);
    });
  }

  /** Mapa uid Firebase → timestamp da última leitura do outro participante. */
  subscribeReads(
    threadId: string,
    onNext: (reads: Record<string, number>) => void
  ): () => void {
    const rref = ref(supportRtdb, P.pathThreadReads(threadId));
    return onValue(rref, (snap) => {
      const v = snap.val() as Record<string, number> | null;
      onNext(v && typeof v === 'object' ? v : {});
    });
  }

  /**
   * Atualiza recibo de leitura; `mode` evita depender do prefixo do uid.
   */
  async updateMyReadReceiptForMode(
    mode: PartnerChatMode,
    threadId: string,
    lastSeenTs: number
  ): Promise<void> {
    await this.identity.ensureFirebaseForChat(mode);
    const uid = this.identity.getChatUidOrThrow();
    const ts = Math.max(1, Math.floor(lastSeenTs));
    await update(ref(supportRtdb), {
      [`${P.pathThreadReads(threadId)}/${uid}`]: ts,
    });
  }

  private buildExtrasForMysql(
    p: PartnerSendPayload,
    kind: PartnerMessageKind | undefined
  ): Record<string, unknown> | null {
    const o: Record<string, unknown> = {};
    if (kind) {
      o['kind'] = kind;
    }
    if (p.replyTo) {
      o['replyTo'] = p.replyTo;
      if (p.replySnippet != null) {
        o['replySnippet'] = String(p.replySnippet).slice(0, 500);
      }
      if (p.replyRole) {
        o['replyRole'] = p.replyRole;
      }
    }
    if (p.audioUrl) {
      o['audioUrl'] = p.audioUrl;
      if (p.audioMime) {
        o['audioMime'] = p.audioMime;
      }
      if (p.audioDurationSec != null) {
        o['audioDurationSec'] = p.audioDurationSec;
      }
    }
    if (p.attachments?.length) {
      o['attachments'] = p.attachments;
    }
    return Object.keys(o).length ? o : null;
  }
}
