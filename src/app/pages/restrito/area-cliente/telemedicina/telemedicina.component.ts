import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, Subscription } from 'rxjs';
import { ApiService, TelemedicinaCatalogoVet } from '../../../../services/api.service';
import { AuthService } from '../../../../services/auth.service';
import { TenantLojaService } from '../../../../services/tenant-loja.service';
import { WebrtcService } from '../../../../services/webrtc.service';
import type { EmergencyRequest } from '../../../parceiros/telemedicina-emergencial/telemedicina-emergencial.types';
import { TelemedicinaQueueMockService } from './telemedicina-queue-mock.service';
import type {
  MockVetCard,
  TutorPerfilMock,
  TutorPlanoMock,
  TutorTelemedicinaFlowState,
  TutorTelemedicinaTab,
} from './telemedicina-tutor.types';

type TelemedicinaConsulta = {
  id: number;
  cliente_id?: number | null;
  veterinario_id?: number | null;
  status: string;
  telemedicina_habilitada: number | boolean;
  janela_inicio: string;
  janela_fim: string;
  video_chamada_id?: number | null;
  sala_codigo?: string | null;
  video_status?: string | null;
};

type TelemedicinaListResponse = { consultas: TelemedicinaConsulta[] };
type TelemedicinaJoinResponse = {
  consulta_id: number;
  sala_codigo: string;
  signaling_event: string;
  signaling_channel: string;
};

export type TelemedicinaPetOption = { id: string | number; nome: string; tipo?: string };

@Component({
  selector: 'app-telemedicina-cliente',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  providers: [WebrtcService],
  templateUrl: './telemedicina.component.html',
  styleUrl: './telemedicina.component.scss',
})
export class TelemedicinaComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() modal = false;
  /** Pets do tutor para agendamento (preenchido pela área do cliente). */
  @Input() petsCatalogo: TelemedicinaPetOption[] = [];
  @Input()
  set tutorPerfil(v: TutorPerfilMock | null) {
    this._tutorPerfil = v;
    if (v) {
      this.perfilEfetivo = { ...v };
    }
  }
  get tutorPerfil(): TutorPerfilMock | null {
    return this._tutorPerfil;
  }
  private _tutorPerfil: TutorPerfilMock | null = null;
  @Output() close = new EventEmitter<void>();

  readonly tabs: Array<{ id: TutorTelemedicinaTab; label: string; short: string }> = [
    { id: 'emergencia', label: 'Atender agora', short: 'Agora' },
    { id: 'escolher', label: 'Escolher veterinário', short: 'Vets' },
    { id: 'fila', label: 'Fila', short: 'Fila' },
    { id: 'agendar', label: 'Agendar', short: 'Agendar' },
  ];

  activeTab = signal<TutorTelemedicinaTab>('emergencia');

  urgency: EmergencyRequest['prioridade'] = 'MEDIA';
  plano: TutorPlanoMock = 'basico';
  sintomasEmergencia = '';

  readonly vetSearch = signal('');
  readonly vetSort = signal<'nome' | 'preco' | 'resposta'>('nome');

  onVetSortChange(value: string): void {
    if (value === 'nome' || value === 'preco' || value === 'resposta') {
      this.vetSort.set(value);
    }
  }

  readonly vetsDisplay = computed(() => {
    const q = this.vetSearch().trim().toLowerCase();
    let list = [...this.queueMock.vets()];
    if (q) {
      list = list.filter(
        (v) =>
          v.nome.toLowerCase().includes(q) ||
          v.especialidade.toLowerCase().includes(q) ||
          (v.crmv && String(v.crmv).toLowerCase().includes(q)),
      );
    }
    const sort = this.vetSort();
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sort === 'preco') return a.precoAgendamento - b.precoAgendamento;
      if (sort === 'resposta') return a.tempoRespostaMedioMin - b.tempoRespostaMedioMin;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
    return sorted;
  });

  /** Agendamento */
  agendaModoAutomatico = true;
  agendaVetId: string | null = null;
  agendaDiaKey: string | null = null;
  agendaHorario: string | null = null;
  agendaPetId: string | null = null;
  agendaMotivo = '';

  /** API consultas reais */
  loading = false;
  joinLoadingId: number | null = null;
  erro = '';
  consultas: TelemedicinaConsulta[] = [];
  chamadaAtiva: { sala_codigo: string; signaling_channel: string } | null = null;
  callState = 'idle';
  muted = false;
  videoEnabled = true;

  catalogoCarregado: 'idle' | 'ok' | 'erro' = 'idle';

  @ViewChild('localVideo') localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideo!: ElementRef<HTMLVideoElement>;
  private subs: Subscription[] = [];

  private perfilEfetivo: TutorPerfilMock = {
    nome: 'Tutor',
    petNome: 'Pet',
    petEspecie: 'Canino',
    petRaca: 'SRD',
  };

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private webrtc: WebrtcService,
    readonly queueMock: TelemedicinaQueueMockService,
    readonly tenantLoja: TenantLojaService,
  ) {}

  ngOnInit(): void {
    void this.loadConsultas();
    void this.loadCatalogoPublico();
  }

  private mapCatalogVetToCard(v: TelemedicinaCatalogoVet): MockVetCard {
    const reais =
      v.preco_agendamento_centavos != null
        ? Math.round(Number(v.preco_agendamento_centavos) / 100)
        : 120;
    return {
      id: v.id,
      nome: v.nome,
      especialidade: v.especialidade || 'Telemedicina',
      tempoRespostaMedioMin: v.tempo_resposta_medio_min ?? 8,
      online: v.online !== false,
      avaliacao: null,
      precoAgendamento: reais,
      crmv: v.crmv ?? null,
      source: v.source || 'api',
    };
  }

  async loadCatalogoPublico(): Promise<void> {
    const slug = this.tenantLoja.lojaSlug();
    if (!slug) {
      this.catalogoCarregado = 'idle';
      return;
    }
    try {
      const cat = await firstValueFrom(this.api.getPublicTelemedicinaCatalogo(slug));
      if (cat.vets?.length) {
        this.queueMock.replaceVetsFromCatalog(cat.vets.map((v) => this.mapCatalogVetToCard(v)));
      }
      this.catalogoCarregado = 'ok';
    } catch {
      this.catalogoCarregado = 'erro';
    }
  }

  ngAfterViewInit(): void {
    this.subs.push(
      this.webrtc.localStream$.subscribe((s) => {
        try {
          if (this.localVideo?.nativeElement) this.localVideo.nativeElement.srcObject = s || null;
        } catch {
          /* ignore */
        }
      }),
    );
    this.subs.push(
      this.webrtc.remoteStream$.subscribe((s) => {
        try {
          if (this.remoteVideo?.nativeElement) this.remoteVideo.nativeElement.srcObject = s || null;
        } catch {
          /* ignore */
        }
      }),
    );
    this.subs.push(
      this.webrtc.callState$.subscribe((st) => {
        this.callState = st;
      }),
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    try {
      this.webrtc.endCall();
    } catch {
      /* ignore */
    }
  }

  setTab(tab: TutorTelemedicinaTab): void {
    this.queueMock.clearQueueFeedback();
    this.activeTab.set(tab);
  }

  flow(): TutorTelemedicinaFlowState {
    return this.queueMock.tutorFlow();
  }

  queueMeta() {
    return this.queueMock.tutorQueueMeta();
  }

  formatMoney(n: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
  }

  /** Rota do mapa contextual à loja (tenant), quando houver slug. */
  mapaTelemedicinaLink(): string[] {
    const s = this.tenantLoja.lojaSlug()?.trim();
    return s ? ['/mapa', s] : ['/mapa'];
  }

  petIdAsString(id: string | number): string {
    return String(id);
  }

  flowBadge(): { label: string; tone: 'neutral' | 'wait' | 'live' | 'ok' | 'schedule' } {
    const f = this.flow();
    switch (f) {
      case 'idle':
        return { label: 'Nenhum atendimento ativo', tone: 'neutral' };
      case 'joining':
        return { label: 'Entrando na fila…', tone: 'wait' };
      case 'waiting_global':
      case 'waiting_directed':
        return { label: 'Aguardando atendimento', tone: 'wait' };
      case 'called':
        return { label: 'Veterinário chamando você', tone: 'live' };
      case 'in_consult':
        return { label: 'Em consulta', tone: 'live' };
      case 'finished':
        return { label: 'Atendimento finalizado', tone: 'ok' };
      case 'scheduled_future':
        return { label: 'Consulta agendada', tone: 'schedule' };
      default:
        return { label: f, tone: 'neutral' };
    }
  }

  statusFilaLabel(): string {
    const f = this.flow();
    if (f === 'called') return 'Chamado';
    if (f === 'in_consult') return 'Conectado';
    if (f === 'waiting_global' || f === 'waiting_directed' || f === 'joining') return 'Aguardando';
    return '—';
  }

  iniciarEmergencia(): void {
    const ok = this.queueMock.enterGlobalQueue(
      this.perfilEfetivo,
      this.plano,
      this.urgency,
      this.sintomasEmergencia,
    );
    if (ok) {
      this.activeTab.set('fila');
    }
  }

  chamarVet(vetId: string): void {
    const ok = this.queueMock.enterDirectedQueue(vetId, this.perfilEfetivo, this.plano, 'MEDIA');
    if (ok) {
      this.activeTab.set('fila');
    }
  }

  sairDaFila(): void {
    this.queueMock.leaveTutorQueue();
  }

  encerrarSessaoMock(): void {
    this.queueMock.endMockConsultation();
  }

  dispensarFinalizado(): void {
    this.queueMock.dismissFinishedState();
  }

  limparFeedbackFila(): void {
    this.queueMock.clearQueueFeedback();
  }

  vetsOnlineList() {
    return this.vetsDisplay().filter((v) => v.online);
  }

  todosVets() {
    return this.vetsDisplay();
  }

  vetNomePorId(id: string | null): string {
    if (!id) return '';
    return this.queueMock.vets().find((v) => v.id === id)?.nome ?? id;
  }

  diasAgenda() {
    return this.queueMock.agendaDias();
  }

  slotsDoDia() {
    const key = this.agendaDiaKey;
    if (!key) return [];
    const dia = this.queueMock.agendaDias().find((d) => d.dateKey === key);
    const slots = dia?.slots ?? [];
    if (this.agendaModoAutomatico || !this.agendaVetId) {
      return slots;
    }
    return slots.filter((s) => s.vetId === this.agendaVetId || s.vetId === null);
  }

  onDiaChange(): void {
    this.agendaHorario = null;
  }

  onAgendaVetChange(): void {
    this.agendaHorario = null;
  }

  async confirmarAgendamento(): Promise<void> {
    const day = this.queueMock.agendaDias().find((d) => d.dateKey === this.agendaDiaKey);
    const slot = day?.slots.find((s) => s.horario === this.agendaHorario);
    if (!day || !slot) return;

    if (!this.agendaPetId) {
      this.erro = 'Selecione o pet para o qual é a consulta.';
      return;
    }
    this.erro = '';

    let vetNome = slot.vetNome;
    let vetId = slot.vetId;
    let preco = slot.preco;

    if (this.agendaModoAutomatico) {
      const online = this.queueMock.vets().filter((v) => v.online);
      const pick = online[0] ?? this.queueMock.vets()[0];
      vetNome = `Automático · ${pick.nome}`;
      vetId = pick.id;
      preco = pick.precoAgendamento;
    } else if (this.agendaVetId) {
      const v = this.queueMock.vets().find((x) => x.id === this.agendaVetId);
      if (v) {
        vetNome = v.nome;
        vetId = v.id;
        preco = v.precoAgendamento;
      }
    }

    const pet = this.petsCatalogo.find((p) => String(p.id) === String(this.agendaPetId));
    const petNome = pet?.nome ?? 'Pet';

    const bookingId = this.queueMock.confirmAgendamento({
      dataLabel: day.label,
      horario: slot.horario,
      vetNome,
      vetId,
      preco,
      automatico: this.agendaModoAutomatico,
      petNome,
      motivo: this.agendaMotivo.trim() || null,
    });

    const token = this.auth.getToken();
    const lojaSlug = this.tenantLoja.lojaSlug();
    const petIdNum = parseInt(String(this.agendaPetId), 10);
    if (token && lojaSlug && Number.isFinite(petIdNum) && petIdNum > 0) {
      try {
        const start = new Date(`${this.agendaDiaKey}T${slot.horario}:00`);
        const end = new Date(start.getTime() + 30 * 60 * 1000);
        const res = await firstValueFrom(
          this.api.createTelemedicinaIntencaoAgendamento(token, {
            loja_slug: lojaSlug,
            pet_id: petIdNum,
            vet_ref: this.agendaModoAutomatico ? null : vetId,
            automatico: this.agendaModoAutomatico,
            slot_inicio: start.toISOString(),
            slot_fim: end.toISOString(),
            motivo: this.agendaMotivo.trim() || null,
            preco_centavos: Math.round(preco * 100),
          }),
        );
        if (res?.id) {
          this.queueMock.patchScheduledApiId(bookingId, res.id);
        }
      } catch {
        /* tabela pode não existir — fluxo local continua válido */
      }
    }
  }

  get now(): number {
    return Date.now();
  }

  janelaDisponivel(c: TelemedicinaConsulta): boolean {
    const inicio = new Date(c.janela_inicio).getTime();
    const fim = new Date(c.janela_fim).getTime();
    if (!Number.isFinite(inicio) || !Number.isFinite(fim)) return false;
    return this.now >= inicio && this.now <= fim;
  }

  async loadConsultas(): Promise<void> {
    const token = this.auth.getToken();
    if (!token) {
      this.consultas = [];
      return;
    }

    this.loading = true;
    this.erro = '';
    try {
      const res: TelemedicinaListResponse = await firstValueFrom(this.api.listMyTelemedicina(token));
      this.consultas = (res?.consultas || []).sort(
        (a: TelemedicinaConsulta, b: TelemedicinaConsulta) =>
          new Date(b.janela_inicio).getTime() - new Date(a.janela_inicio).getTime(),
      );
    } catch {
      this.consultas = [];
    } finally {
      this.loading = false;
    }
  }

  async entrar(c: TelemedicinaConsulta): Promise<void> {
    const token = this.auth.getToken();
    if (!token || this.joinLoadingId) return;
    this.joinLoadingId = c.id;
    this.erro = '';
    try {
      const consent = window.confirm(
        'Ao entrar na chamada você concorda em compartilhar câmera e microfone. Apenas metadados serão registrados. Deseja continuar?',
      );
      if (!consent) {
        this.erro = 'Consentimento não concedido.';
        return;
      }

      const joined: TelemedicinaJoinResponse = await firstValueFrom(this.api.joinMyTelemedicina(token, c.id));
      if (!joined?.sala_codigo) throw new Error('Resposta inválida ao entrar na chamada');
      this.chamadaAtiva = {
        sala_codigo: joined.sala_codigo,
        signaling_channel: joined.signaling_channel,
      };

      await this.webrtc.joinCall(c.id, joined.sala_codigo);
    } catch (err: unknown) {
      const e = err as { error?: { error?: string; message?: string } };
      this.erro = e?.error?.error || e?.error?.message || 'Não foi possível entrar na chamada.';
    } finally {
      this.joinLoadingId = null;
    }
  }

  endCall(): void {
    try {
      this.webrtc.endCall();
    } catch {
      /* ignore */
    }
    this.chamadaAtiva = null;
  }

  toggleMute(): void {
    try {
      this.muted = this.webrtc.toggleMute();
    } catch {
      /* ignore */
    }
  }

  toggleVideo(): void {
    try {
      this.videoEnabled = this.webrtc.toggleVideo();
    } catch {
      /* ignore */
    }
  }
}
