import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Agendamento, AgendaStatus } from '../../../../types/agenda.types';
import { getTime, toDate } from '../utils/date-helpers';
import { AgendaApiService } from '../services/agenda-api.service';
import { WebrtcService } from '../../../../services/webrtc.service';

interface StatusStep {
  status: AgendaStatus;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-agenda-modal',
  standalone: true,
  imports: [CommonModule],
  providers: [WebrtcService],
  templateUrl: './agenda-modal.component.html',
  styleUrls: ['./agenda-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaModalComponent {
  @ViewChild('localVideo') localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideo!: ElementRef<HTMLVideoElement>;
  private subs: any[] = [];
  telemedicinaActive = false;
  /** Aviso antes de confirmar na loja quando já houve e-mail ao tutor. */
  showTutorEmailAwaitingModal = false;

  constructor(
    private agendaApi: AgendaApiService,
    private webrtc: WebrtcService,
    private cdr: ChangeDetectorRef
  ) {}

  @Input() agendamento!: Agendamento;
  @Output() close = new EventEmitter<void>();
  @Output() statusChanged = new EventEmitter<{ id: string; status: AgendaStatus }>();
  telemedicinaLoading = false;
  telemedicinaInfo: { sala_codigo: string; signaling_channel: string } | null = null;

  readonly STEPS: StatusStep[] = [
    { status: 'AGENDADO',    label: 'Agendado',    icon: '📅' },
    { status: 'CONFIRMADO',  label: 'Confirmado',  icon: '✅' },
    { status: 'EM_ANDAMENTO', label: 'Em andamento', icon: '▶️' },
    { status: 'FINALIZADO',  label: 'Finalizado',  icon: '🏁' },
  ];

  readonly STATUS_LABELS: Record<AgendaStatus, string> = {
    AGENDADO: 'Agendado',
    CONFIRMADO: 'Confirmado',
    EM_ANDAMENTO: 'Em andamento',
    ATRASADO: 'Atrasado',
    FINALIZADO: 'Finalizado',
    CANCELADO: 'Cancelado',
  };

  get currentStepIndex(): number {
    return this.STEPS.findIndex(s => s.status === this.agendamento.status);
  }

  isStepDone(s: StatusStep): boolean {
    const i = this.STEPS.findIndex(x => x.status === s.status);
    return i < this.currentStepIndex;
  }

  isStepActive(s: StatusStep): boolean {
    return s.status === this.agendamento.status;
  }

  get nextStatus(): AgendaStatus | null {
    const next: Partial<Record<AgendaStatus, AgendaStatus>> = {
      AGENDADO: 'CONFIRMADO',
      CONFIRMADO: 'EM_ANDAMENTO',
      EM_ANDAMENTO: 'FINALIZADO',
      ATRASADO: 'EM_ANDAMENTO',
    };
    return next[this.agendamento.status] ?? null;
  }

  get nextStatusLabel(): string | null {
    const ns = this.nextStatus;
    return ns ? this.STATUS_LABELS[ns] : null;
  }

  get isAwaitingTutorEmailConfirmation(): boolean {
    return (
      this.agendamento.status === 'AGENDADO' &&
      !!this.agendamento.tutorNotificacaoEmailEnviadoEm
    );
  }

  requestAdvanceStatus(): void {
    const ns = this.nextStatus;
    if (!ns) return;
    if (ns === 'CONFIRMADO' && this.isAwaitingTutorEmailConfirmation) {
      this.showTutorEmailAwaitingModal = true;
      this.cdr.markForCheck();
      return;
    }
    this.advanceStatus();
  }

  fecharAvisoTutorEmail(): void {
    this.showTutorEmailAwaitingModal = false;
    this.cdr.markForCheck();
  }

  confirmarNaLojaMesmoAssim(): void {
    this.showTutorEmailAwaitingModal = false;
    this.advanceStatus();
    this.cdr.markForCheck();
  }

  advanceStatus(): void {
    const ns = this.nextStatus;
    if (ns) this.statusChanged.emit({ id: String(this.agendamento.id), status: ns });
  }

  cancelAgendamento(): void {
    this.statusChanged.emit({ id: String(this.agendamento.id), status: 'CANCELADO' });
    this.close.emit();
  }

  formatDateTime(d: Date | string): string {
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatTime(d: Date | string): string {
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  get duration(): number {
    return Math.round((getTime(this.agendamento.fim) - getTime(this.agendamento.inicio)) / 60000);
  }

  get telemedicinaDisponivelAgora(): boolean {
    const now = Date.now();
    const inicio = new Date(this.agendamento.inicio).getTime();
    const fim = new Date(this.agendamento.fim).getTime();
    if (!Number.isFinite(inicio) || !Number.isFinite(fim)) return false;
    return now >= inicio && now <= fim;
  }

  async entrarTelemedicina(): Promise<void> {
    const agendamentoId = Number(this.agendamento.id);
    if (!agendamentoId || this.telemedicinaLoading) return;

    this.telemedicinaLoading = true;
    try {
      let consulta: any = null;
      try {
        const found = await this.agendaApi.getTelemedicinaByAgendamento(agendamentoId);
        consulta = found?.consulta || null;
      } catch (_) {
        // 404/erro: tentamos criar a consulta com base no agendamento atual.
      }

      if (!consulta) {
        const created = await this.agendaApi.createTelemedicinaConsulta({
          agendamento_id: agendamentoId,
          telemedicina_habilitada: true,
          janela_inicio: this.agendamento.inicio,
          janela_fim: this.agendamento.fim,
          criar_video_chamada: true,
          observacoes: this.agendamento.observacoes || undefined,
        });
        consulta = created?.consulta;
      }

      const consultaId = Number(consulta?.id);
      if (!consultaId) throw new Error('Consulta inválida para telemedicina');

      const joined = await this.agendaApi.joinTelemedicinaConsulta(consultaId);
      this.telemedicinaInfo = {
        sala_codigo: joined.sala_codigo,
        signaling_channel: joined.signaling_channel,
      };
      try {
        await this.webrtc.joinCall(consultaId, joined.sala_codigo);
        this.telemedicinaActive = true;
      } catch (e) {
        // não bloqueara exibição da sala, apenas avisar
        window.alert(
          'Não foi possível iniciar a media da telemedicina: ' + (((e as any)?.message) || String(e))
        );
      }
    } catch (err: any) {
      const msg = err?.error?.error || err?.error?.message || err?.message || 'Não foi possível entrar na chamada.';
      window.alert(msg);
    } finally {
      this.telemedicinaLoading = false;
    }
  }

  ngAfterViewInit(): void {
    this.subs.push(this.webrtc.localStream$.subscribe((s: MediaStream | null) => {
      try { if (this.localVideo?.nativeElement) this.localVideo.nativeElement.srcObject = s || null; } catch(e) {}
    }));
    this.subs.push(this.webrtc.remoteStream$.subscribe((s: MediaStream | null) => {
      try { if (this.remoteVideo?.nativeElement) this.remoteVideo.nativeElement.srcObject = s || null; } catch(e) {}
    }));
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe?.());
    try { this.webrtc.endCall(); } catch (e) {}
  }

  endCall(): void {
    try { this.webrtc.endCall(); } catch (e) {}
    this.telemedicinaActive = false;
  }

  toggleMute(): void { try { this.webrtc.toggleMute(); } catch (e) {} }

  toggleVideo(): void { try { this.webrtc.toggleVideo(); } catch (e) {} }
}
