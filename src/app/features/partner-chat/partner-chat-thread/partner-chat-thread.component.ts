import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { PartnerChatMode, PartnerThreadMessage } from '../partner-chat.models';
import { PartnerThreadFacadeService } from '../partner-thread-facade.service';
import { PartnerChatIdentityService } from '../partner-chat-identity.service';

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

  @ViewChild('logContainer') logContainer?: ElementRef<HTMLElement>;

  messages: PartnerThreadMessage[] = [];
  draft = '';
  sending = false;
  err = '';

  private offMessages: (() => void) | null = null;

  constructor(
    private facade: PartnerThreadFacadeService,
    private identity: PartnerChatIdentityService,
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
    this.detachMessages();
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

  trackById(_: number, m: PartnerThreadMessage): string {
    return m.id;
  }

  async send(): Promise<void> {
    this.err = '';
    this.sending = true;
    this.cdr.markForCheck();
    try {
      await this.facade.sendMessage(this.mode, this.threadId, this.draft);
      this.draft = '';
    } catch (e: unknown) {
      this.err = e instanceof Error ? e.message : 'Falha ao enviar';
    } finally {
      this.sending = false;
      this.cdr.markForCheck();
      queueMicrotask(() => this.scrollLogToBottom());
    }
  }

  private detachMessages(): void {
    try {
      this.offMessages?.();
    } catch {
      /* ignore */
    }
    this.offMessages = null;
  }

  private async attachMessages(): Promise<void> {
    this.detachMessages();
    this.messages = [];
    this.err = '';
    this.cdr.markForCheck();
    try {
      await this.identity.ensureFirebaseForChat(this.mode);
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
      queueMicrotask(() => this.scrollLogToBottom());
    });
  }

  private scrollLogToBottom(): void {
    const el = this.logContainer?.nativeElement;
    if (!el) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }
}
