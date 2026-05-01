export const PARTNER_CHAT_ROOT = 'partner_chats';

export function pathThreadMessages(threadId: string): string {
  return `${PARTNER_CHAT_ROOT}/threads/${threadId}/messages`;
}
