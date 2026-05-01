export type PartnerChatMode = 'cliente' | 'parceiro';

export interface PartnerThreadMessage {
  id: string;
  text: string;
  senderRole: 'cliente' | 'parceiro_staff';
  senderUid: string;
  ts: number;
}
