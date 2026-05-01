import { Injectable } from '@angular/core';
import { onValue, push, ref, update } from 'firebase/database';
import { supportRtdb } from '../../firebase-config';
import { PartnerChatApiService } from './partner-chat-api.service';
import { PartnerChatIdentityService } from './partner-chat-identity.service';
import type { PartnerChatMode, PartnerThreadMessage } from './partner-chat.models';
import * as P from './partner-paths';

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

  async sendMessage(mode: PartnerChatMode, threadId: string, text: string): Promise<void> {
    const trimmed = (text || '').trim();
    if (!trimmed) {
      return;
    }
    await this.identity.ensureFirebaseForChat(mode);
    const uid = this.identity.getChatUidOrThrow();
    const senderRole: PartnerThreadMessage['senderRole'] =
      mode === 'cliente' ? 'cliente' : 'parceiro_staff';
    const msg: Omit<PartnerThreadMessage, 'id'> = {
      text: trimmed.slice(0, 4000),
      senderRole,
      senderUid: uid,
      ts: Date.now(),
    };
    const mid = push(ref(supportRtdb, P.pathThreadMessages(threadId))).key;
    if (!mid) {
      throw new Error('Falha ao enviar');
    }
    await update(ref(supportRtdb), {
      [`${P.pathThreadMessages(threadId)}/${mid}`]: msg,
    });
    if (mode === 'cliente') {
      void this.api.logMensagemClienteFireAndForget({
        threadId,
        firebaseMessageId: mid,
        text: msg.text,
        senderRole: 'cliente',
        ts: msg.ts,
      });
    } else {
      void this.api.logMensagemParceiroFireAndForget({
        threadId,
        firebaseMessageId: mid,
        text: msg.text,
        senderRole: 'parceiro_staff',
        ts: msg.ts,
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
}
