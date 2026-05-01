export type PartnerChatMode = 'cliente' | 'parceiro';

export type PartnerMessageKind = 'text' | 'audio' | 'file' | 'mixed';

export interface PartnerAttachment {
  url: string;
  name?: string;
  mime?: string;
}

export interface PartnerThreadMessage {
  id: string;
  text: string;
  senderRole: 'cliente' | 'parceiro_staff';
  senderUid: string;
  ts: number;
  kind?: PartnerMessageKind;
  /** Id da mensagem a que esta responde (RTDB). */
  replyTo?: string | null;
  replySnippet?: string | null;
  replyRole?: 'cliente' | 'parceiro_staff' | null;
  audioUrl?: string | null;
  audioMime?: string | null;
  audioDurationSec?: number | null;
  /** Em RTDB pode vir como objeto indexado; normalizamos na UI. */
  attachments?: PartnerAttachment[] | Record<string, PartnerAttachment> | null;
}

export interface PartnerSendPayload {
  text: string;
  kind?: PartnerMessageKind;
  audioUrl?: string | null;
  audioMime?: string | null;
  audioDurationSec?: number | null;
  attachments?: PartnerAttachment[];
  replyTo?: string | null;
  replySnippet?: string | null;
  replyRole?: 'cliente' | 'parceiro_staff' | null;
}
