import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TelemedicinaQueueMockService } from '../../restrito/area-cliente/telemedicina/telemedicina-queue-mock.service';
import {
  TELEMEDICINA_MOCK_CONFIG,
  TELEMEDICINA_MOCK_PRICING,
} from './telemedicina-emergencial.mock';
import {
  EmergencyRequest,
  EmergencyRequestStatus,
  TelemedicinaConfig,
  TelemedicinaPricing,
  TelemedicinaTab,
} from './telemedicina-emergencial.types';

@Component({
  selector: 'app-telemedicina-emergencial',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './telemedicina-emergencial.component.html',
  styleUrls: ['./telemedicina-emergencial.component.scss'],
})
export class TelemedicinaEmergencialComponent {
  readonly tabs: Array<{ id: TelemedicinaTab; label: string; icon: string }> = [
    { id: 'prontidao', label: 'Prontidao', icon: 'fa-heart-pulse' },
    { id: 'fila', label: 'Fila emergencial', icon: 'fa-bell' },
    { id: 'config', label: 'Precos e config', icon: 'fa-sliders' },
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-line' },
    { id: 'agenda', label: 'Ir para agenda', icon: 'fa-calendar' },
  ];

  readonly activeTab = signal<TelemedicinaTab>('prontidao');
  readonly emergencyOnline = signal<boolean>(false);
  readonly inAttendance = signal<boolean>(false);
  readonly loadingSimulation = signal<boolean>(false);

  /** Lista filtrada quando o mock “visão do profissional” está ativo (só pedidos TUT direcionados àquele vet). */
  readonly requestList = computed(() => {
    const all = this.queueMock.requests();
    const vid = this.queueMock.parceiroViewerVetId();
    if (!vid) return all;
    return all.filter((item) => {
      if (!this.queueMock.isTutorLiveRequest(item.id)) return true;
      const dir = this.queueMock.getDirectedVetId(item.id);
      if (!dir) return true;
      return dir === vid;
    });
  });

  readonly config = signal<TelemedicinaConfig>({ ...TELEMEDICINA_MOCK_CONFIG });
  readonly pricing = signal<TelemedicinaPricing>({ ...TELEMEDICINA_MOCK_PRICING });

  readonly pendingCount = computed(
    () => this.requestList().filter((item) => item.status === 'PENDENTE').length,
  );
  readonly acceptedCount = computed(
    () => this.requestList().filter((item) => item.status === 'ACEITA').length,
  );
  readonly refusedCount = computed(
    () => this.requestList().filter((item) => item.status === 'RECUSADA').length,
  );

  readonly maxHourlyVolume = computed(() => {
    const all = this.queueMock.dashboardSeed().horas.map((item) => item.volume);
    return Math.max(...all, 1);
  });

  readonly responseSlaColor = computed(() => {
    const max = this.config().tempoRespostaMaxMin;
    if (max <= 5) return 'sla-good';
    if (max <= 10) return 'sla-ok';
    return 'sla-risk';
  });

  readonly topPriorityCall = computed(() => {
    const pending = this.requestList().filter((item) => item.status === 'PENDENTE');
    if (pending.length === 0) return null;
    const rank = { ALTA: 3, MEDIA: 2, BAIXA: 1 } as const;
    return [...pending].sort((a, b) => rank[b.prioridade] - rank[a.prioridade] || a.aguardandoMin - b.aguardandoMin)[0];
  });

  constructor(
    private readonly router: Router,
    readonly queueMock: TelemedicinaQueueMockService,
  ) {}

  setTab(tab: TelemedicinaTab): void {
    this.activeTab.set(tab);
    if (tab === 'agenda') {
      this.goToAgenda();
    }
  }

  toggleProntidao(): void {
    this.loadingSimulation.set(true);
    window.setTimeout(() => {
      this.emergencyOnline.update((state) => !state);
      if (!this.emergencyOnline()) {
        this.inAttendance.set(false);
      }
      this.loadingSimulation.set(false);
    }, 420);
  }

  setRequestStatus(id: string, status: EmergencyRequestStatus): void {
    this.queueMock.applyVetDecision(id, status, this.pricing().consultaBase);

    if (status === 'ACEITA') {
      this.inAttendance.set(true);
    }
  }

  simulateIncomingRequest(): void {
    this.queueMock.pushSimulatedPartnerRequest();
    this.activeTab.set('fila');
  }

  goToAgenda(): void {
    void this.router.navigate(['/parceiros/agenda']);
  }

  getPriorityLabel(priority: EmergencyRequest['prioridade']): string {
    if (priority === 'ALTA') return 'Urgente';
    if (priority === 'MEDIA') return 'Atenção';
    return 'Estavel';
  }

  formatMoney(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  hourlyBarWidth(volume: number): number {
    const max = this.maxHourlyVolume();
    if (max <= 0) return 0;
    return Math.max(8, Math.round((volume / max) * 100));
  }

  updateConfigFlag(
    field: 'disponibilidade24h' | 'aceitaNoturno' | 'aceitaFimSemana',
    value: boolean,
  ): void {
    this.config.update((current) => ({ ...current, [field]: value }));
  }

  updateConfigNumber(field: 'tempoRespostaMaxMin' | 'raioAtendimentoKm', value: number): void {
    const sanitized = Number.isFinite(Number(value)) ? Number(value) : 0;
    this.config.update((current) => ({ ...current, [field]: sanitized }));
  }

  updateConfigMessage(value: string): void {
    this.config.update((current) => ({ ...current, mensagemAutomatica: value }));
  }

  updatePricingNumber(
    field: 'consultaBase' | 'adicionalNoturnoPct' | 'adicionalFimSemanaPct' | 'adicionalFeriadoPct',
    value: number,
  ): void {
    const sanitized = Number.isFinite(Number(value)) ? Number(value) : 0;
    this.pricing.update((current) => ({ ...current, [field]: sanitized }));
  }

  updatePricingFlag(field: 'retorno72hGratis', value: boolean): void {
    this.pricing.update((current) => ({ ...current, [field]: value }));
  }

  vetNomeNoPainel(vetId: string): string {
    return this.queueMock.vets().find((v) => v.id === vetId)?.nome ?? vetId;
  }
}
