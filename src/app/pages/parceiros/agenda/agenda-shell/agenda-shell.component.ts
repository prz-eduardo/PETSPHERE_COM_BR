import {
  Component, OnInit, signal, computed, effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  Agendamento, AgendaConfig, AgendaFiltros, AgendaStatus,
  PartnerType, Profissional, Recurso, Servico, SlotInfo, ViewMode
} from '../../../../types/agenda.types';
import { ParceiroAuthService } from '../../../../services/parceiro-auth.service';
import { AgendaConfigService } from '../services/agenda-config.service';
import { AgendaApiService } from '../services/agenda-api.service';
import { AgendaFiltersComponent } from '../agenda-filters/agenda-filters.component';
import { AgendaGridComponent } from '../agenda-grid/agenda-grid.component';
import { AgendaTimelineComponent } from '../agenda-timeline/agenda-timeline.component';
import { AgendaWeekComponent } from '../agenda-week/agenda-week.component';
import { AgendaListComponent } from '../agenda-list/agenda-list.component';
import { AgendaSidebarComponent } from '../agenda-sidebar/agenda-sidebar.component';
import { AgendaModalComponent } from '../agenda-modal/agenda-modal.component';
import { AgendaConvitesDadosComponent } from '../agenda-convites-dados/agenda-convites-dados.component';
import { toDate } from '../utils/date-helpers';
import {
  catalogPetsFromAgendamentos,
  mapParceiroAgendamentoRow,
  ParceiroAgendamentoApiRow,
} from '../services/agenda-parceiro-mapper';

@Component({
  selector: 'app-agenda-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    AgendaConvitesDadosComponent,
    AgendaFiltersComponent,
    AgendaGridComponent,
    AgendaTimelineComponent,
    AgendaWeekComponent,
    AgendaListComponent,
    AgendaSidebarComponent,
    AgendaModalComponent,
  ],
  templateUrl: './agenda-shell.component.html',
  styleUrls: ['./agenda-shell.component.scss'],
})
export class AgendaShellComponent implements OnInit {

  viewMode = signal<ViewMode>('DAY');
  selectedDate = signal<Date>(new Date());
  filters = signal<AgendaFiltros>({});
  sidebarOpen = signal(false);
  sidebarSlot = signal<SlotInfo | null>(null);
  modalAgendamentoId = signal<string | null>(null);

  rawAgendamentos = signal<Agendamento[]>([]);

  partnerType = signal<PartnerType>('PETSHOP');
  config = signal<AgendaConfig | null>(null);
  profissionais = signal<Profissional[]>([]);
  servicos = signal<Servico[]>([]);
  recursos = signal<Recurso[]>([]);
  loading = signal(false);

  // Day view window presets
  windowPreset = signal<'default' | '12-24' | '9-18' | '0-24' | 'custom'>('default');
  customWindowStart = signal<number | null>(null);
  customWindowEnd = signal<number | null>(null);

  // Computed config with optional window overrides for the active view
  viewConfig = computed<AgendaConfig | null>(() => {
    const base = this.config();
    if (!base) return null;
    switch (this.windowPreset()) {
      case '12-24': return { ...base, workStart: 12, workEnd: 24 };
      case '9-18': return { ...base, workStart: 9, workEnd: 18 };
      case '0-24': return { ...base, workStart: 0, workEnd: 24 };
      case 'custom': {
        const s = this.customWindowStart();
        const e = this.customWindowEnd();
        if (typeof s === 'number' && typeof e === 'number') return { ...base, workStart: s, workEnd: e };
        return base;
      }
      default: return base;
    }
  });

  catalogPets = computed(() => catalogPetsFromAgendamentos(this.agendamentos()));

  agendamentos = computed<Agendamento[]>(() => {
    const now = new Date();
    return this.rawAgendamentos().map(a => {
      if (
        toDate(a.fim) < now &&
        (a.status === 'AGENDADO' || a.status === 'CONFIRMADO')
      ) {
        return { ...a, status: 'ATRASADO' as AgendaStatus };
      }
      return a;
    });
  });

  filteredAgendamentos = computed<Agendamento[]>(() => {
    const f = this.filters();
    return this.agendamentos().filter(a => {
      if (f.profissionalId && a.profissional?.id !== f.profissionalId) return false;
      if (f.servicoId && a.servico?.id !== f.servicoId) return false;
      if (f.status?.length && !f.status.includes(a.status)) return false;
      if (f.search) {
        const q = f.search.toLowerCase();
        if (
          !(a.pet?.nome || a.pet_nome || a.pet_nome_snapshot || '').toLowerCase().includes(q) &&
          !(a.pet?.tutor?.nome || a.cliente_nome || a.cliente_nome_snapshot || '').toLowerCase().includes(q) &&
          !a.servico?.nome?.toLowerCase().includes(q) &&
          !a.profissional?.nome?.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  });

  /** Dia atual (DAY / TIMELINE); semana/lista usam o intervalo já carregado na API. */
  agendamentosForView = computed(() => {
    const vm = this.viewMode();
    const base = this.filteredAgendamentos();
    if (vm === 'WEEK' || vm === 'LIST') return base;
    const d = this.selectedDate();
    const target = d.toDateString();
    return base.filter(a => toDate(a.inicio).toDateString() === target);
  });

  totalCount = computed(() => this.agendamentos().filter(a => a.status !== 'CANCELADO').length);
  atrasadosCount = computed(() => this.agendamentos().filter(a => a.status === 'ATRASADO').length);

  modalAgendamento = computed(() => {
    const id = this.modalAgendamentoId();
    if (!id) return null;
    return this.agendamentos().find(a => String(a.id) === id) ?? null;
  });

  dateLabel = computed(() => {
    const d = this.selectedDate();
    if (this.viewMode() === 'WEEK') {
      const start = this.getWeekStart(d);
      const end = new Date(start.getTime() + 6 * 86400000);
      return `${start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${end.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    }
    return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  });

  isToday = computed(() => {
    const d = this.selectedDate();
    const t = new Date();
    return d.toDateString() === t.toDateString();
  });

  readonly MODE_LABELS: Record<ViewMode, string> = {
    DAY: 'Dia',
    WEEK: 'Semana',
    TIMELINE: 'Timeline',
    LIST: 'Lista',
  };

  readonly ALL_MODES: ViewMode[] = ['DAY', 'WEEK', 'TIMELINE', 'LIST'];

  constructor(
    private auth: ParceiroAuthService,
    private configSvc: AgendaConfigService,
    private api: AgendaApiService,
  ) {
    effect(() => {
      this.partnerType();
      this.selectedDate();
      this.viewMode();
      const tipo = this.partnerType();
      const cfg = this.configSvc.getConfig(tipo);
      this.config.set(cfg);
      this.servicos.set([{
        id: 'srv-default',
        nome: 'Atendimento',
        duracaoMin: cfg.defaultDuration,
      }]);
      void this.reloadFromApi();
    });
  }

  async ngOnInit(): Promise<void> {
    await this.auth.refreshPartnerProfile();
    const parceiro = this.auth.getCurrentParceiro();
    if (parceiro) {
      this.partnerType.set(parceiro.tipo);
    }

    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      this.viewMode.set('LIST');
    }
    void this.reloadFromApi();
  }

  private formatLocalYmd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private getWeekStart(d: Date): Date {
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const start = new Date(d);
    start.setDate(d.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private getApiDateRange(): { data_inicio: string; data_fim: string } {
    const d = this.selectedDate();
    if (this.viewMode() === 'WEEK') {
      const start = this.getWeekStart(d);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { data_inicio: this.formatLocalYmd(start), data_fim: this.formatLocalYmd(end) };
    }
    const one = this.formatLocalYmd(d);
    return { data_inicio: one, data_fim: one };
  }

  private async reloadFromApi(): Promise<void> {
    try {
      const recursos = await this.api.getRecursos();
      const ativos = (recursos || []).filter((r: { ativo?: boolean | number }) => r.ativo !== false && r.ativo !== 0);
      const recursoById = new Map<number, { nome: string }>();
      for (const r of ativos as { id: number; nome: string }[]) {
        recursoById.set(Number(r.id), { nome: String(r.nome || 'Recurso') });
      }
      this.profissionais.set(ativos.map((r: { id: number; nome: string }) => ({
        id: String(r.id),
        nome: String(r.nome || 'Recurso'),
        ativo: true,
      })));

      const range = this.getApiDateRange();
      const raw = await this.api.getAgendamentos(range);
      const defServ = this.servicos()[0] ?? {
        id: 'srv-default',
        nome: 'Atendimento',
        duracaoMin: 60,
      };
      const mapped = (raw as ParceiroAgendamentoApiRow[]).map(row =>
        mapParceiroAgendamentoRow(row, recursoById, defServ)
      );
      this.rawAgendamentos.set(mapped);
    } catch (err) {
      console.error('Agenda: falha ao carregar API', err);
      this.rawAgendamentos.set([]);
      this.profissionais.set([]);
    }
  }

  prevDate(): void {
    const d = new Date(this.selectedDate());
    const delta = this.viewMode() === 'WEEK' ? 7 : 1;
    d.setDate(d.getDate() - delta);
    this.selectedDate.set(d);
  }

  nextDate(): void {
    const d = new Date(this.selectedDate());
    const delta = this.viewMode() === 'WEEK' ? 7 : 1;
    d.setDate(d.getDate() + delta);
    this.selectedDate.set(d);
  }

  goToToday(): void {
    this.selectedDate.set(new Date());
  }

  setViewMode(m: ViewMode): void {
    this.viewMode.set(m);
  }

  setWindow(preset: 'default' | '12-24' | '9-18' | '0-24' | 'custom', start?: number, end?: number): void {
    if (preset === 'custom' && typeof start === 'number' && typeof end === 'number') {
      this.customWindowStart.set(start);
      this.customWindowEnd.set(end);
    }
    this.windowPreset.set(preset);
  }

  // ── Filters ─────────────────────────────────────────────────────────────
  onFiltersChange(f: AgendaFiltros): void {
    this.filters.set(f);
  }

  openSidebar(slot?: SlotInfo): void {
    this.sidebarSlot.set(slot ?? null);
    this.sidebarOpen.set(true);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
    this.sidebarSlot.set(null);
  }

  async onAgendamentoSaved(novo: Agendamento): Promise<void> {
    const profId = Number(novo.profissional?.id);
    if (!Number.isFinite(profId)) return;
    const inicio = novo.inicio instanceof Date ? novo.inicio : new Date(novo.inicio);
    const fim = novo.fim instanceof Date ? novo.fim : new Date(novo.fim);
    const pet = novo.pet;
    const clienteNome = (pet?.tutor?.nome ?? '').trim() || 'Cliente';
    try {
      await this.api.createAgendamento({
        recurso_id: profId,
        cliente_nome: clienteNome,
        cliente_telefone: pet?.tutor?.telefone || undefined,
        pet_nome: pet?.nome && pet.nome !== '—' ? pet.nome : undefined,
        inicio,
        fim,
        observacoes: novo.observacoes || undefined,
      });
      await this.reloadFromApi();
      this.closeSidebar();
    } catch (e) {
      console.error(e);
    }
  }

  openModal(id: string): void {
    this.modalAgendamentoId.set(id);
  }

  closeModal(): void {
    this.modalAgendamentoId.set(null);
  }

  onQuickAction(evt: { id: string; action: string }): void {
    const nextStatus: Record<string, AgendaStatus> = {
      CONFIRMAR: 'CONFIRMADO',
      INICIAR: 'EM_ANDAMENTO',
      FINALIZAR: 'FINALIZADO',
      CANCELAR: 'CANCELADO',
    };
    const newStatus = nextStatus[evt.action];
    if (!newStatus) return;
    void this.patchAgendamentoStatus(Number(evt.id), newStatus);
  }

  onStatusChanged(evt: { id: string; status: AgendaStatus }): void {
    void this.patchAgendamentoStatus(Number(evt.id), evt.status);
  }

  private async patchAgendamentoStatus(id: number, status: AgendaStatus): Promise<void> {
    if (!Number.isFinite(id)) return;
    try {
      await this.api.patchStatus(id, status);
      await this.reloadFromApi();
    } catch (e) {
      console.error(e);
    }
  }

  onDaySelected(d: Date): void {
    this.selectedDate.set(d);
    this.viewMode.set('DAY');
  }

  isViewAvailable(m: ViewMode): boolean {
    return this.config()?.viewModes.includes(m) ?? true;
  }

}
