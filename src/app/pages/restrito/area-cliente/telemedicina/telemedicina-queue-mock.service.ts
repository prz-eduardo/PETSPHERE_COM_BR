import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import {
  EmergencyRequest,
  EmergencyRequestStatus,
  TelemedicinaDashboardSeed,
} from '../../../parceiros/telemedicina-emergencial/telemedicina-emergencial.types';
import {
  TELEMEDICINA_MOCK_DASHBOARD,
  TELEMEDICINA_MOCK_REQUESTS,
} from '../../../parceiros/telemedicina-emergencial/telemedicina-emergencial.mock';
import {
  buildAgendaDiasMock,
  TELEMEDICINA_EMERGENCIA_PRECO_FIXO,
  TELEMEDICINA_TEMPO_ESPERA_MEDIO_MIN,
  TELEMEDICINA_TUTOR_VETS_MOCK,
} from './telemedicina-tutor.mock';
import type {
  AgendaDiaMock,
  MockAgendamentoConfirmado,
  MockVetCard,
  TutorPerfilMock,
  TutorPlanoMock,
  TutorQueueMeta,
  TutorTelemedicinaFlowState,
} from './telemedicina-tutor.types';

interface TutorRequestMeta {
  queueKind: 'global' | 'directed';
  directedVetId?: string;
  plano: TutorPlanoMock;
}

const LS_SCHEDULED = 'fp_telemed_sched_v1';
/** Após N minutos em espera, pedido do tutor expira (simulação). */
const TUTOR_WAIT_TIMEOUT_MIN = 45;

@Injectable({ providedIn: 'root' })
export class TelemedicinaQueueMockService {
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly _requests = signal<EmergencyRequest[]>(this.cloneRequests(TELEMEDICINA_MOCK_REQUESTS));
  readonly requests = this._requests.asReadonly();

  private readonly tutorRequestMeta = new Map<string, TutorRequestMeta>();
  private tutorActiveRequestId: string | null = null;

  private readonly _tutorFlow = signal<TutorTelemedicinaFlowState>('idle');
  readonly tutorFlow = this._tutorFlow.asReadonly();

  private readonly _tutorQueueMeta = signal<TutorQueueMeta | null>(null);
  readonly tutorQueueMeta = this._tutorQueueMeta.asReadonly();

  private readonly _scheduled = signal<MockAgendamentoConfirmado[]>([]);
  readonly scheduledConsultations = this._scheduled.asReadonly();

  readonly vets = signal<MockVetCard[]>([...TELEMEDICINA_TUTOR_VETS_MOCK]);

  readonly agendaDias = signal<AgendaDiaMock[]>(buildAgendaDiasMock(TELEMEDICINA_TUTOR_VETS_MOCK));

  readonly vetsOnlineCount = computed(() => this.vets().filter((v) => v.online).length);

  readonly emergencyFixedPrice = TELEMEDICINA_EMERGENCIA_PRECO_FIXO;
  readonly estimatedWaitMinutesPublic = TELEMEDICINA_TEMPO_ESPERA_MEDIO_MIN;

  private readonly _dashboardSeed = signal<TelemedicinaDashboardSeed>({ ...TELEMEDICINA_MOCK_DASHBOARD });
  readonly dashboardSeed = this._dashboardSeed.asReadonly();

  /** Mensagem quando não é possível entrar na fila ou após sair. */
  private readonly _queueFeedback = signal<string | null>(null);
  readonly queueFeedback = this._queueFeedback.asReadonly();

  /**
   * Filtro do painel parceiro (mock): id do vet (`vet-1`, `pa-12`) ou null = ver todos.
   * Pedidos direcionados só aparecem para o vet correspondente quando filtro está ativo.
   */
  private readonly _parceiroViewerVetId = signal<string | null>(null);
  readonly parceiroViewerVetId = this._parceiroViewerVetId.asReadonly();

  private joiningTimer: ReturnType<typeof setTimeout> | null = null;
  private calledTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.hydrateScheduledFromStorage();
    interval(3000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.onTick());
  }

  clearQueueFeedback(): void {
    this._queueFeedback.set(null);
  }

  setParceiroViewerVetId(vetId: string | null): void {
    this._parceiroViewerVetId.set(vetId && vetId.trim() ? vetId.trim() : null);
  }

  getDirectedVetId(requestId: string): string | undefined {
    return this.tutorRequestMeta.get(requestId)?.directedVetId;
  }

  /** Remove o tutor da fila (pedido pendente vira EXPIRADA). */
  leaveTutorQueue(): void {
    const id = this.tutorActiveRequestId;
    if (!id) {
      this._queueFeedback.set('Você não está na fila no momento.');
      return;
    }
    this._requests.update((all) =>
      all.map((r) => (r.id === id && r.status === 'PENDENTE' ? { ...r, status: 'EXPIRADA' as EmergencyRequestStatus } : r)),
    );
    this.tutorRequestMeta.delete(id);
    this.tutorActiveRequestId = null;
    this._tutorQueueMeta.set(null);
    this._tutorFlow.set('idle');
    this.clearTimers();
    this._queueFeedback.set('Você saiu da fila.');
  }

  replaceVetsFromCatalog(cards: MockVetCard[]): void {
    const next = cards.length ? cards : [...TELEMEDICINA_TUTOR_VETS_MOCK];
    this.vets.set(next);
    this.agendaDias.set(buildAgendaDiasMock(next));
  }

  private hydrateScheduledFromStorage(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const raw = localStorage.getItem(LS_SCHEDULED);
      if (!raw) return;
      const parsed = JSON.parse(raw) as MockAgendamentoConfirmado[];
      if (Array.isArray(parsed) && parsed.length) {
        this._scheduled.set(parsed);
      }
    } catch {
      /* ignore */
    }
  }

  private persistScheduled(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(LS_SCHEDULED, JSON.stringify(this._scheduled()));
    } catch {
      /* ignore */
    }
  }

  /** Prioridade exibida na fila emergência (mock). */
  enterGlobalQueue(
    perfil: TutorPerfilMock,
    plano: TutorPlanoMock,
    prioridade: EmergencyRequest['prioridade'] = 'MEDIA',
    sintomas?: string,
  ): boolean {
    this.clearQueueFeedback();
    this.clearTimers();
    if (this.isTutorFlowBlockingNewQueue()) {
      this._queueFeedback.set(
        'Finalize ou saia da fila atual antes de iniciar outro atendimento de emergência.',
      );
      return false;
    }
    this._tutorFlow.set('joining');
    this.joiningTimer = setTimeout(() => {
      const id = this.nextTutorRequestId();
      const req = this.buildEmergencyRequest(id, perfil, prioridade, sintomas);
      this.tutorRequestMeta.set(id, { queueKind: 'global', plano });
      this.tutorActiveRequestId = id;
      this._requests.update((all) => [req, ...all]);
      this._tutorFlow.set('waiting_global');
      this.recomputeTutorQueueMeta(id);
    }, 520);
    return true;
  }

  enterDirectedQueue(
    vetId: string,
    perfil: TutorPerfilMock,
    plano: TutorPlanoMock,
    prioridade: EmergencyRequest['prioridade'] = 'MEDIA',
    sintomas?: string,
  ): boolean {
    this.clearQueueFeedback();
    this.clearTimers();
    if (this.isTutorFlowBlockingNewQueue()) {
      this._queueFeedback.set(
        'Finalize ou saia da fila antes de chamar outro veterinário.',
      );
      return false;
    }
    this._tutorFlow.set('joining');
    this.joiningTimer = setTimeout(() => {
      const id = this.nextTutorRequestId();
      const req = this.buildEmergencyRequest(id, perfil, prioridade, sintomas);
      this.tutorRequestMeta.set(id, { queueKind: 'directed', directedVetId: vetId, plano });
      this.tutorActiveRequestId = id;
      this._requests.update((all) => [req, ...all]);
      this._tutorFlow.set('waiting_directed');
      this.recomputeTutorQueueMeta(id);
    }, 520);
    return true;
  }

  applyVetDecision(id: string, status: EmergencyRequestStatus, consultaBase = TELEMEDICINA_EMERGENCIA_PRECO_FIXO): void {
    this._requests.update((all) =>
      all.map((item) => (item.id === id ? { ...item, status } : item)),
    );

    if (status === 'ACEITA') {
      this._dashboardSeed.update((seed) => ({
        ...seed,
        atendimentosHoje: seed.atendimentosHoje + 1,
        receitaEstimadaHoje: seed.receitaEstimadaHoje + consultaBase,
      }));
    }

    if (id !== this.tutorActiveRequestId) return;

    if (status === 'ACEITA') {
      this.clearCalledTimer();
      this._tutorFlow.set('called');
      this._tutorQueueMeta.update((m) =>
        m
          ? {
              ...m,
              position: 0,
              etaMinutes: 0,
            }
          : m,
      );
      this.calledTimer = setTimeout(() => {
        this._tutorFlow.set('in_consult');
      }, 2200);
    } else if (status === 'RECUSADA' || status === 'EXPIRADA') {
      this.resetTutorSessionAfterVetDecline();
    }
  }

  endMockConsultation(): void {
    this._tutorFlow.set('finished');
    this.tutorActiveRequestId = null;
    this._tutorQueueMeta.set(null);
    this.clearTimers();
    setTimeout(() => {
      if (this._tutorFlow() === 'finished') {
        this._tutorFlow.set('idle');
      }
    }, 2400);
  }

  dismissFinishedState(): void {
    if (this._tutorFlow() === 'finished') {
      this._tutorFlow.set('idle');
    }
  }

  confirmAgendamento(payload: Omit<MockAgendamentoConfirmado, 'id'>): string {
    const id = `AG-${Date.now()}`;
    this._scheduled.update((list) => [{ ...payload, id }, ...list]);
    this.persistScheduled();
    this._tutorFlow.set('scheduled_future');
    setTimeout(() => {
      if (this._tutorFlow() === 'scheduled_future') {
        this._tutorFlow.set('idle');
      }
    }, 3200);
    return id;
  }

  patchScheduledApiId(localId: string, apiIntencaoId: number): void {
    this._scheduled.update((list) =>
      list.map((b) => (b.id === localId ? { ...b, apiIntencaoId } : b)),
    );
    this.persistScheduled();
  }

  /** Botão "Simular notificação" no painel parceiro. */
  pushSimulatedPartnerRequest(): EmergencyRequest {
    const nextIndex = this._requests().length + 1;
    const item: EmergencyRequest = {
      id: `EMG-${4900 + nextIndex}`,
      prioridade: nextIndex % 2 === 0 ? 'ALTA' : 'MEDIA',
      sintomas:
        nextIndex % 2 === 0
          ? 'Dificuldade respiratoria apos episodio de ansiedade intensa.'
          : 'Tremores e perda de apetite desde a madrugada.',
      tutor: {
        nome: nextIndex % 2 === 0 ? 'Carlos Meireles' : 'Luana Brito',
        petNome: nextIndex % 2 === 0 ? 'Mika' : 'Zeus',
        petEspecie: nextIndex % 2 === 0 ? 'Felino' : 'Canino',
        petRaca: nextIndex % 2 === 0 ? 'Persa' : 'Golden Retriever',
      },
      distanciaKm: nextIndex % 2 === 0 ? 4.1 : 7.6,
      aguardandoMin: 1,
      faixaHorario: 'Agora',
      status: 'PENDENTE',
    };
    this._requests.update((all) => [item, ...all]);
    return item;
  }

  isTutorLiveRequest(id: string): boolean {
    return this.tutorRequestMeta.has(id);
  }

  private isTutorFlowBlockingNewQueue(): boolean {
    const f = this._tutorFlow();
    return (
      f === 'joining' ||
      f === 'waiting_global' ||
      f === 'waiting_directed' ||
      f === 'called' ||
      f === 'in_consult' ||
      f === 'scheduled_future'
    );
  }

  private resetTutorSessionAfterVetDecline(): void {
    this.tutorActiveRequestId = null;
    this._tutorQueueMeta.set(null);
    this._tutorFlow.set('idle');
    this.clearCalledTimer();
  }

  private onTick(): void {
    this._requests.update((all) =>
      all.map((r) =>
        r.status === 'PENDENTE' ? { ...r, aguardandoMin: r.aguardandoMin + 1 } : r,
      ),
    );

    const tid = this.tutorActiveRequestId;
    const flow = this._tutorFlow();
    if (tid && (flow === 'waiting_global' || flow === 'waiting_directed')) {
      const req = this._requests().find((r) => r.id === tid);
      if (req && req.status === 'PENDENTE' && req.aguardandoMin >= TUTOR_WAIT_TIMEOUT_MIN) {
        this._queueFeedback.set('Tempo máximo de espera atingido. Você saiu da fila automaticamente.');
        this.applyVetDecision(tid, 'EXPIRADA');
      }
    }

    if (
      tid &&
      (flow === 'waiting_global' || flow === 'waiting_directed' || flow === 'joining')
    ) {
      if (flow !== 'joining') {
        this.recomputeTutorQueueMeta(tid);
      }
    }
  }

  private recomputeTutorQueueMeta(activeId: string): void {
    const all = this._requests();
    const req = all.find((r) => r.id === activeId);
    const meta = this.tutorRequestMeta.get(activeId);
    if (!req || req.status !== 'PENDENTE' || !meta) {
      return;
    }

    const pending = all.filter((r) => r.status === 'PENDENTE');
    const subset = pending.filter((r) => {
      const m = this.tutorRequestMeta.get(r.id);
      if (meta.queueKind === 'global') {
        return !m || m.queueKind === 'global';
      }
      return m?.queueKind === 'directed' && m.directedVetId === meta.directedVetId;
    });

    const scored = subset
      .map((r) => {
        const m = this.tutorRequestMeta.get(r.id);
        const plano = m?.plano ?? 'basico';
        return {
          r,
          score: this.priorityScore(r.prioridade, r.aguardandoMin, plano),
        };
      })
      .sort((a, b) => b.score - a.score);

    const idx = scored.findIndex((s) => s.r.id === activeId);
    const position = idx >= 0 ? idx + 1 : subset.length;
    const ahead = Math.max(0, position - 1);
    const etaMinutes = Math.max(2, ahead * TELEMEDICINA_TEMPO_ESPERA_MEDIO_MIN + Math.round(req.aguardandoMin * 0.35));

    this._tutorQueueMeta.set({
      requestId: activeId,
      queueKind: meta.queueKind,
      directedVetId: meta.directedVetId ?? null,
      position,
      etaMinutes,
      waitMinutes: req.aguardandoMin,
      precoEmergenciaFixo: TELEMEDICINA_EMERGENCIA_PRECO_FIXO,
    });
  }

  private priorityScore(
    prioridade: EmergencyRequest['prioridade'],
    waitMin: number,
    plano: TutorPlanoMock,
  ): number {
    const rank = { ALTA: 100, MEDIA: 55, BAIXA: 25 } as const;
    const planBoost = plano === 'premium' ? 40 : 0;
    const waitBoost = Math.min(waitMin, 60) * 1.5;
    return rank[prioridade] + planBoost + waitBoost;
  }

  private buildEmergencyRequest(
    id: string,
    perfil: TutorPerfilMock,
    prioridade: EmergencyRequest['prioridade'],
    sintomas?: string,
  ): EmergencyRequest {
    return {
      id,
      prioridade,
      sintomas: sintomas?.trim() || 'Paciente aguardando atendimento (telemedicina).',
      tutor: {
        nome: perfil.nome,
        petNome: perfil.petNome,
        petEspecie: perfil.petEspecie,
        petRaca: perfil.petRaca,
      },
      distanciaKm: 0,
      aguardandoMin: 0,
      faixaHorario: 'Agora',
      status: 'PENDENTE',
    };
  }

  private nextTutorRequestId(): string {
    return `TUT-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
  }

  private cloneRequests(items: EmergencyRequest[]): EmergencyRequest[] {
    return items.map((item) => ({ ...item, tutor: { ...item.tutor } }));
  }

  private clearTimers(): void {
    if (this.joiningTimer) {
      clearTimeout(this.joiningTimer);
      this.joiningTimer = null;
    }
    this.clearCalledTimer();
  }

  private clearCalledTimer(): void {
    if (this.calledTimer) {
      clearTimeout(this.calledTimer);
      this.calledTimer = null;
    }
  }
}
