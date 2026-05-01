import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostBinding,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { PartnerAttachment, PartnerChatMode, PartnerThreadMessage } from '../partner-chat.models';
import { PartnerThreadFacadeService } from '../partner-thread-facade.service';
import { PartnerChatIdentityService } from '../partner-chat-identity.service';
import { PartnerChatUploadService } from '../partner-chat-upload.service';

@Component({
  selector: 'app-partner-chat-thread',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './partner-chat-thread.component.html',
  styleUrls: ['./partner-chat-thread.component.scss'],
})
export class PartnerChatThreadComponent implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) threadId!: string;
  @Input({ required: true }) mode!: PartnerChatMode;
  /** Tema visual: área cliente (claro) ou painel do parceiro (tokens admin escuros). */
  @Input() variant: 'default' | 'painel' = 'default';

  @HostBinding('class.partner-thread--painel')
  get painelVariantClass(): boolean {
    return this.variant === 'painel';
  }

  @ViewChild('logContainer') logContainer?: ElementRef<HTMLElement>;
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  messages: PartnerThreadMessage[] = [];
  reads: Record<string, number> = {};
  myChatUid = '';
  draft = '';
  sending = false;
  err = '';
  replyingTo: PartnerThreadMessage | null = null;
  recording = false;
  recordElapsedSec = 0;
  pendingAttachments: PartnerAttachment[] = [];

  private offMessages: (() => void) | null = null;
  private offReads: (() => void) | null = null;
  private readDebounce: ReturnType<typeof setTimeout> | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: BlobPart[] = [];
  private recordTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private facade: PartnerThreadFacadeService,
    private identity: PartnerChatIdentityService,
    private upload: PartnerChatUploadService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    void this.attachMessages();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['threadId'] && !changes['threadId'].firstChange) {
      void this.attachMessages();
    }
  }

  ngOnDestroy(): void {
    this.stopRecording(false);
    this.detachMessages();
    if (this.readDebounce) {
      clearTimeout(this.readDebounce);
      this.readDebounce = null;
    }
  }

  messageMap(): Record<string, PartnerThreadMessage> {
    const o: Record<string, PartnerThreadMessage> = {};
    for (const m of this.messages) {
      o[m.id] = m;
    }
    return o;
  }

  attachmentList(m: PartnerThreadMessage): PartnerAttachment[] {
    const a = m.attachments;
    if (!a) {
      return [];
    }
    if (Array.isArray(a)) {
      return a.filter((x) => x && x.url);
    }
    return Object.keys(a)
      .sort()
      .map((k) => (a as Record<string, PartnerAttachment>)[k])
      .filter((x) => x && x.url);
  }

  labelFor(m: PartnerThreadMessage): string {
    const me =
      (this.mode === 'cliente' && m.senderRole === 'cliente') ||
      (this.mode === 'parceiro' && m.senderRole === 'parceiro_staff');
    if (me) {
      return 'Você';
    }
    return m.senderRole === 'cliente' ? 'Cliente' : 'Loja';
  }

  isMine(m: PartnerThreadMessage): boolean {
    return (
      (this.mode === 'cliente' && m.senderRole === 'cliente') ||
      (this.mode === 'parceiro' && m.senderRole === 'parceiro_staff')
    );
  }

  /** Última leitura conhecida do outro lado (qualquer uid ≠ o meu). */
  peerLastReadTs(): number {
    const me = this.myChatUid;
    let best = 0;
    for (const [k, v] of Object.entries(this.reads)) {
      if (!me || k === me) {
        continue;
      }
      if (typeof v === 'number' && v > best) {
        best = v;
      }
    }
    return best;
  }

  readStatus(m: PartnerThreadMessage): string {
    if (!this.isMine(m)) {
      return '';
    }
    return this.peerLastReadTs() >= m.ts ? 'Visto' : '';
  }

  trackById(_: number, m: PartnerThreadMessage): string {
    return m.id;
  }

  startReply(m: PartnerThreadMessage): void {
    this.replyingTo = m;
    this.cdr.markForCheck();
  }

  cancelReply(): void {
    this.replyingTo = null;
    this.cdr.markForCheck();
  }

  replyPreviewText(m: PartnerThreadMessage): string {
    const map = this.messageMap();
    if (m.replyTo && map[m.replyTo]) {
      const parent = map[m.replyTo];
      const pt = parent.text?.trim();
      if (pt) {
        return pt.slice(0, 160);
      }
      if (parent.audioUrl) {
        return 'Mensagem de áudio';
      }
      const at = this.attachmentList(parent);
      if (at.length) {
        return at.length === 1 ? at[0].name || 'Anexo' : `${at.length} anexos`;
      }
    }
    if (m.replySnippet?.trim()) {
      return m.replySnippet.trim().slice(0, 160);
    }
    const t = m.text?.trim();
    if (t) {
      return t.slice(0, 160);
    }
    if (m.audioUrl) {
      return 'Mensagem de áudio';
    }
    if (this.attachmentList(m).length) {
      return 'Anexo';
    }
    return 'Mensagem';
  }

  triggerFilePick(): void {
    this.fileInput?.nativeElement?.click();
  }

  async onFilesSelected(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const files = input.files;
    if (!files?.length || !this.threadId) {
      return;
    }
    this.err = '';
    this.sending = true;
    this.cdr.markForCheck();
    try {
      await this.identity.ensureFirebaseForChat(this.mode);
      const uid = this.identity.getChatUidOrThrow();
      for (let i = 0; i < files.length; i++) {
        const f = files.item(i);
        if (!f) {
          continue;
        }
        const up = await this.upload.uploadFile(this.threadId, uid, f);
        this.pendingAttachments.push({ url: up.url, name: up.name, mime: up.mime });
      }
    } catch (e: unknown) {
      this.err = e instanceof Error ? e.message : 'Falha no envio do ficheiro';
    } finally {
      input.value = '';
      this.sending = false;
      this.cdr.markForCheck();
    }
  }

  removePendingAtt(i: number): void {
    this.pendingAttachments.splice(i, 1);
    this.cdr.markForCheck();
  }

  async startRecording(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      this.err = 'Gravação de áudio não suportada neste navegador';
      this.cdr.markForCheck();
      return;
    }
    this.err = '';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime =
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : '';
      this.audioChunks = [];
      this.mediaRecorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.audioChunks.push(e.data);
        }
      };
      this.mediaRecorder.start(200);
      this.recording = true;
      this.recordElapsedSec = 0;
      this.recordTimer = setInterval(() => {
        this.recordElapsedSec += 1;
        this.cdr.markForCheck();
      }, 1000);
      this.cdr.markForCheck();
    } catch (e: unknown) {
      this.err = e instanceof Error ? e.message : 'Não foi possível aceder ao microfone';
      this.cdr.markForCheck();
    }
  }

  async stopRecording(send: boolean): Promise<void> {
    if (this.recordTimer) {
      clearInterval(this.recordTimer);
      this.recordTimer = null;
    }
    const durSec = this.recordElapsedSec;
    const rec = this.mediaRecorder;
    this.mediaRecorder = null;
    if (!rec) {
      this.recording = false;
      this.recordElapsedSec = 0;
      this.cdr.markForCheck();
      return;
    }
    const tracks = rec.stream?.getTracks() ?? [];
    this.recording = false;
    this.cdr.markForCheck();
    await new Promise<void>((resolve) => {
      if (rec.state === 'inactive') {
        resolve();
        return;
      }
      rec.onstop = () => resolve();
      try {
        rec.stop();
      } catch {
        resolve();
      }
    });
    tracks.forEach((t) => {
      try {
        t.stop();
      } catch {
        /* ignore */
      }
    });
    if (!send) {
      this.audioChunks = [];
      this.recordElapsedSec = 0;
      this.cdr.markForCheck();
      return;
    }
    const mime = rec.mimeType || 'audio/webm';
    const blob = new Blob(this.audioChunks, { type: mime });
    this.audioChunks = [];
    this.recordElapsedSec = 0;
    if (blob.size < 32) {
      this.cdr.markForCheck();
      return;
    }
    this.sending = true;
    this.cdr.markForCheck();
    try {
      await this.identity.ensureFirebaseForChat(this.mode);
      const uid = this.identity.getChatUidOrThrow();
      const file = new File([blob], `audio_${Date.now()}.webm`, { type: mime });
      const up = await this.upload.uploadFile(this.threadId, uid, file);
      await this.facade.sendMessage(this.mode, this.threadId, {
        text: '',
        kind: 'audio',
        audioUrl: up.url,
        audioMime: up.mime,
        audioDurationSec: durSec > 0 ? durSec : undefined,
        replyTo: this.replyingTo?.id ?? null,
        replySnippet: this.replySnippetForSend(),
        replyRole: this.replyingTo?.senderRole ?? null,
      });
      this.replyingTo = null;
    } catch (e: unknown) {
      this.err = e instanceof Error ? e.message : 'Falha ao enviar áudio';
    } finally {
      this.sending = false;
      this.cdr.markForCheck();
    }
  }

  private replySnippetForSend(): string | null {
    if (!this.replyingTo) {
      return null;
    }
    const t = this.replyingTo.text?.trim();
    if (t) {
      return t.slice(0, 400);
    }
    if (this.replyingTo.audioUrl) {
      return 'Áudio';
    }
    if (this.attachmentList(this.replyingTo).length) {
      return 'Anexo';
    }
    return 'Mensagem';
  }

  canSend(): boolean {
    return !!this.draft.trim() || this.pendingAttachments.length > 0;
  }

  async send(): Promise<void> {
    const text = this.draft.trim();
    if (!text && !this.pendingAttachments.length) {
      return;
    }
    this.err = '';
    this.sending = true;
    this.cdr.markForCheck();
    try {
      await this.facade.sendMessage(this.mode, this.threadId, {
        text: text || (this.pendingAttachments.length ? ' ' : ''),
        kind: this.pendingAttachments.length && text ? 'mixed' : this.pendingAttachments.length ? 'file' : 'text',
        attachments: this.pendingAttachments.length ? [...this.pendingAttachments] : undefined,
        replyTo: this.replyingTo?.id ?? null,
        replySnippet: this.replySnippetForSend(),
        replyRole: this.replyingTo?.senderRole ?? null,
      });
      this.draft = '';
      this.pendingAttachments = [];
      this.replyingTo = null;
    } catch (e: unknown) {
      this.err = e instanceof Error ? e.message : 'Falha ao enviar';
    } finally {
      this.sending = false;
      this.cdr.markForCheck();
      queueMicrotask(() => this.scrollLogToBottom());
    }
  }

  onLogScroll(): void {
    this.scheduleReadReceipt();
  }

  private scheduleReadReceipt(): void {
    if (this.readDebounce) {
      clearTimeout(this.readDebounce);
    }
    this.readDebounce = setTimeout(() => {
      this.readDebounce = null;
      if (!this.threadId || !this.messages.length) {
        return;
      }
      const maxTs = Math.max(...this.messages.map((m) => m.ts));
      void this.facade.updateMyReadReceiptForMode(this.mode, this.threadId, maxTs).catch(() => {});
    }, 650);
  }

  private detachMessages(): void {
    try {
      this.offMessages?.();
    } catch {
      /* ignore */
    }
    try {
      this.offReads?.();
    } catch {
      /* ignore */
    }
    this.offMessages = null;
    this.offReads = null;
  }

  private async attachMessages(): Promise<void> {
    this.detachMessages();
    this.messages = [];
    this.reads = {};
    this.myChatUid = '';
    this.err = '';
    this.cdr.markForCheck();
    try {
      await this.identity.ensureFirebaseForChat(this.mode);
      this.myChatUid = this.identity.getChatUidOrThrow();
    } catch (e: unknown) {
      this.err = e instanceof Error ? e.message : 'Não foi possível preparar o chat';
      this.cdr.markForCheck();
      return;
    }
    if (!this.threadId) {
      return;
    }
    this.offMessages = this.facade.subscribeMessages(this.threadId, (list) => {
      this.messages = list;
      this.cdr.markForCheck();
      queueMicrotask(() => {
        this.scrollLogToBottom();
        this.scheduleReadReceipt();
      });
    });
    this.offReads = this.facade.subscribeReads(this.threadId, (r) => {
      this.reads = r;
      this.cdr.markForCheck();
    });
    this.scheduleReadReceipt();
  }

  private scrollLogToBottom(): void {
    const el = this.logContainer?.nativeElement;
    if (!el) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }
}
