import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AgendaApiService,
  HotelHospedagemCatalogBundle,
  HotelLeitoRow,
  HotelReservaRow,
  HotelReservaStatus,
} from '../agenda/services/agenda-api.service';
import { SideDrawerComponent } from '../../../shared/side-drawer/side-drawer.component';
import { ParceiroAuthService } from '../../../services/parceiro-auth.service';
import { EspacoConfigWizardComponent } from '../espaco-config-wizard/espaco-config-wizard.component';

type PeriodoFiltro = 'todos' | 'hoje' | '7dias' | '30dias';
type AbaAtiva = 'reservas' | 'leitos';
type DrawerMode = 'create' | 'details';

@Component({
  selector: 'app-reservas-hotel',
  standalone: true,
  imports: [CommonModule, FormsModule, SideDrawerComponent, EspacoConfigWizardComponent],
  templateUrl: './reservas-hotel.component.html',
  styleUrls: ['./reservas-hotel.component.scss'],
})
export class ReservasHotelComponent implements OnInit {
  readonly statusOptions: Array<{ value: HotelReservaStatus | 'todos'; label: string }> = [
    { value: 'todos', label: 'Todos os status' },
    { value: 'confirmada', label: 'Confirmada' },
    { value: 'pendente', label: 'Pendente' },
    { value: 'checkin_hoje', label: 'Chegada prevista hoje' },
    { value: 'em_hospedagem', label: 'Pet na unidade' },
    { value: 'checkout_concluido', label: 'Estadia concluída' },
    { value: 'cancelada', label: 'Cancelada' },
  ];

  readonly periodOptions: Array<{ value: PeriodoFiltro; label: string }> = [
    { value: 'todos', label: 'Qualquer período' },
    { value: 'hoje', label: 'Hoje' },
    { value: '7dias', label: 'Próximos 7 dias' },
    { value: '30dias', label: 'Próximos 30 dias' },
  ];

  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly reservas = signal<HotelReservaRow[]>([]);
  readonly leitos = signal<HotelLeitoRow[]>([]);
  readonly occupancyRate = signal(0);
  readonly checkInHojeCount = signal(0);
  readonly pendentesCount = signal(0);
  readonly confirmadasCount = signal(0);

  readonly activeTab = signal<AbaAtiva>('reservas');
  readonly filterStatus = signal<HotelReservaStatus | 'todos'>('todos');
  readonly filterPeriod = signal<PeriodoFiltro>('todos');
  readonly searchTerm = signal('');

  readonly drawerOpen = signal(false);
  readonly drawerMode = signal<DrawerMode>('details');
  readonly selectedReserva = signal<HotelReservaRow | null>(null);

  readonly draftTutor = signal('');
  readonly draftPet = signal('');
  readonly draftLeitoId = signal<number | null>(null);
  readonly draftCheckIn = signal('');
  readonly draftCheckOut = signal('');
  readonly draftObservacoes = signal('');
  readonly draftCuidadosEspeciais = signal('');
  readonly draftAlimentacaoObs = signal('');
  readonly formError = signal<string | null>(null);
  readonly hospedagemCatalog = signal<HotelHospedagemCatalogBundle>({ catalog: [], infra: [], acomodacao_tipos: [] });
  readonly espacoWizardOpen = signal(false);
  readonly espacoWizardLeito = signal<HotelLeitoRow | null>(null);

  /** Rascunho no drawer de detalhes para salvar notas operacionais */
  readonly detailObservacoes = signal('');
  readonly detailCuidados = signal('');
  readonly detailAlimentacao = signal('');

  readonly filteredReservas = computed(() => {
    const normalizedQuery = this.normalize(this.searchTerm());
    const status = this.filterStatus();
    const period = this.filterPeriod();
    const today = this.toDateOnly(new Date());

    return this.reservas().filter((reserva) => {
      if (status !== 'todos' && reserva.status !== status) return false;
      if (!this.matchesPeriod(reserva.check_in, period, today)) return false;
      if (!normalizedQuery) return true;

      const haystack = this.normalize(
        `${reserva.id} ${this.getTutorNome(reserva)} ${this.getPetNome(reserva)} ${reserva.leito_nome || ''} ${reserva.status}`
      );
      return haystack.includes(normalizedQuery);
    });
  });

  readonly leitosDisponiveisCount = computed(() => this.leitos().filter((leito) => !this.toBool(leito.ocupado)).length);

  constructor(
    private readonly agendaApi: AgendaApiService,
    public readonly auth: ParceiroAuthService
  ) {}

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadHospedagemCatalog(), this.reload()]);
  }

  private async loadHospedagemCatalog(): Promise<void> {
    try {
      const b = await this.agendaApi.getHotelHospedagemCatalog();
      this.hospedagemCatalog.set(b);
    } catch {
      this.hospedagemCatalog.set({ catalog: [], infra: [], acomodacao_tipos: [] });
    }
  }

  trackReserva(_: number, reserva: HotelReservaRow): number {
    return reserva.id;
  }

  trackLeito(_: number, leito: HotelLeitoRow): number {
    return leito.id;
  }

  setTab(tab: AbaAtiva): void {
    this.activeTab.set(tab);
  }

  clearFilters(): void {
    this.filterStatus.set('todos');
    this.filterPeriod.set('todos');
    this.searchTerm.set('');
  }

  openCreateDrawer(): void {
    this.drawerMode.set('create');
    this.selectedReserva.set(null);
    this.formError.set(null);
    this.draftTutor.set('');
    this.draftPet.set('');
    this.draftLeitoId.set(this.leitos()[0]?.id ?? null);
    this.draftCheckIn.set('');
    this.draftCheckOut.set('');
    this.draftObservacoes.set('');
    this.draftCuidadosEspeciais.set('');
    this.draftAlimentacaoObs.set('');
    this.drawerOpen.set(true);
  }

  openCreateLeitoDrawer(): void {
    if (!this.auth.isMaster()) return;
    this.espacoWizardLeito.set(null);
    this.espacoWizardOpen.set(true);
  }

  openEditLeitoDrawer(leito: HotelLeitoRow): void {
    if (!this.auth.isMaster()) return;
    this.espacoWizardLeito.set(leito);
    this.espacoWizardOpen.set(true);
  }

  onEspacoWizardDismiss(): void {
    this.espacoWizardOpen.set(false);
    this.espacoWizardLeito.set(null);
  }

  async onEspacoWizardSaved(_leito: HotelLeitoRow): Promise<void> {
    this.espacoWizardOpen.set(false);
    this.espacoWizardLeito.set(null);
    await this.reload();
  }

  leitoCoverUrl(leito: HotelLeitoRow): string | null {
    const g = Array.isArray(leito.galeria_urls) ? leito.galeria_urls : [];
    const first = g.find((u) => typeof u === 'string' && /^https?:\/\//i.test(u));
    return first || leito.foto_url || null;
  }

  vitrineNivelLabel(leito: HotelLeitoRow): string | null {
    const v = String(leito.vitrine_nivel || 'basico').toLowerCase();
    if (v === 'destaque') return 'Destaque';
    if (v === 'top') return 'Top';
    return null;
  }

  confortoChipLabel(leito: HotelLeitoRow): string | null {
    const k = String(leito.nivel_conforto || '').trim().toLowerCase();
    const map: Record<string, string> = {
      basico: 'Básico',
      conforto: 'Conforto',
      premium: 'Premium',
      luxo: 'Luxo',
    };
    return map[k] || null;
  }

  galleryCount(leito: HotelLeitoRow): number {
    return Array.isArray(leito.galeria_urls) ? leito.galeria_urls.filter((u) => typeof u === 'string').length : 0;
  }

  getLeitoOfertaLabels(leito: HotelLeitoRow): string[] {
    const cat = this.hospedagemCatalog();
    const mapServ = new Map(cat.catalog.map((e) => [e.slug, e.label_pt]));
    const mapInf = new Map(cat.infra.map((e) => [e.slug, e.label_pt]));
    const out: string[] = [];
    const serv = Array.isArray(leito.servicos_oferta) ? leito.servicos_oferta.map(String) : [];
    for (const s of serv) out.push(mapServ.get(s) || s);
    const inf = Array.isArray(leito.infra_slugs) ? leito.infra_slugs.map(String) : [];
    for (const s of inf) out.push(mapInf.get(s) || s);
    return out;
  }

  private syncDetailDraftsFromReserva(r: HotelReservaRow): void {
    this.detailObservacoes.set(r.observacoes ?? '');
    this.detailCuidados.set(r.cuidados_especiais ?? '');
    this.detailAlimentacao.set(r.alimentacao_obs ?? '');
  }

  async openDetailsDrawer(reserva: HotelReservaRow): Promise<void> {
    this.drawerMode.set('details');
    try {
      const full = await this.agendaApi.getHotelReserva(reserva.id);
      const row = full || reserva;
      this.selectedReserva.set(row);
      this.syncDetailDraftsFromReserva(row);
    } catch {
      this.selectedReserva.set(reserva);
      this.syncDetailDraftsFromReserva(reserva);
    }
    this.formError.set(null);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  readonly statusAllowsCancel = (s: HotelReservaStatus): boolean =>
    s === 'pendente' || s === 'confirmada' || s === 'checkin_hoje' || s === 'em_hospedagem';

  async patchReservaStatus(next: HotelReservaStatus): Promise<void> {
    const r = this.selectedReserva();
    if (!r) return;
    try {
      this.saving.set(true);
      this.formError.set(null);
      const updated = await this.agendaApi.updateHotelReserva(r.id, { status: next });
      if (!updated) {
        this.formError.set('Não foi possível atualizar o status.');
        return;
      }
      this.selectedReserva.set(updated);
      this.syncDetailDraftsFromReserva(updated);
      await this.reload();
    } catch (err: unknown) {
      const msg = (err as { error?: { error?: string } })?.error?.error || 'Falha ao atualizar status';
      this.formError.set(msg);
    } finally {
      this.saving.set(false);
    }
  }

  async saveNotasOperacao(): Promise<void> {
    const r = this.selectedReserva();
    if (!r) return;
    try {
      this.saving.set(true);
      this.formError.set(null);
      const updated = await this.agendaApi.updateHotelReserva(r.id, {
        observacoes: this.detailObservacoes().trim() || null,
        cuidados_especiais: this.detailCuidados().trim() || null,
        alimentacao_obs: this.detailAlimentacao().trim() || null,
      });
      if (!updated) {
        this.formError.set('Não foi possível salvar as notas.');
        return;
      }
      this.selectedReserva.set(updated);
      this.syncDetailDraftsFromReserva(updated);
      await this.reload();
    } catch (err: unknown) {
      const msg = (err as { error?: { error?: string } })?.error?.error || 'Falha ao salvar notas';
      this.formError.set(msg);
    } finally {
      this.saving.set(false);
    }
  }

  async saveReservaRapida(): Promise<void> {
    const tutorNome = this.draftTutor().trim();
    const petNome = this.draftPet().trim();
    const checkIn = this.draftCheckIn();
    const checkOut = this.draftCheckOut();

    if (!tutorNome || !petNome || !checkIn || !checkOut) {
      this.formError.set('Preencha tutor, pet e período.');
      return;
    }

    if (new Date(checkOut) < new Date(checkIn)) {
      this.formError.set('A saída deve ser no mesmo dia ou depois da entrada.');
      return;
    }

    try {
      this.saving.set(true);
      this.formError.set(null);
      const nights = Math.max(1, this.diffDays(checkIn, checkOut));
      const created = await this.agendaApi.createHotelReserva({
        leito_id: this.draftLeitoId() || null,
        cliente_nome_snapshot: tutorNome,
        pet_nome_snapshot: petNome,
        check_in: `${checkIn}T12:00:00`,
        check_out: `${checkOut}T12:00:00`,
        status: 'pendente',
        valor_total: nights * 135,
        observacoes: this.draftObservacoes().trim() || null,
        cuidados_especiais: this.draftCuidadosEspeciais().trim() || null,
        alimentacao_obs: this.draftAlimentacaoObs().trim() || null,
      });

      if (!created) {
        this.formError.set('Não foi possível criar a reserva.');
        return;
      }

      await this.reload();
      this.drawerMode.set('details');
      this.selectedReserva.set(created);
      this.syncDetailDraftsFromReserva(created);
    } catch (err: unknown) {
      const msg = (err as { error?: { error?: string } })?.error?.error || 'Falha ao salvar reserva';
      this.formError.set(msg);
    } finally {
      this.saving.set(false);
    }
  }

  statusLabel(status: HotelReservaStatus): string {
    switch (status) {
      case 'confirmada':
        return 'Confirmada';
      case 'pendente':
        return 'Pendente';
      case 'checkin_hoje':
        return 'Chegada prevista hoje';
      case 'em_hospedagem':
        return 'Pet na unidade';
      case 'checkout_concluido':
        return 'Estadia concluída';
      case 'cancelada':
        return 'Cancelada';
      default:
        return status;
    }
  }

  formatDate(dateIso: string): string {
    const d = new Date(dateIso);
    return Number.isNaN(d.getTime())
      ? dateIso
      : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  getTutorNome(reserva: HotelReservaRow): string {
    return reserva.cliente_nome_snapshot || 'Tutor';
  }

  getPetNome(reserva: HotelReservaRow): string {
    return reserva.pet_nome_snapshot || '-';
  }

  getAcomodacaoNome(reserva: HotelReservaRow): string {
    if (reserva.leito_nome) return reserva.leito_nome;
    if (reserva.leito_tipo) return `Espaço (${reserva.leito_tipo})`;
    return 'Sem espaço vinculado';
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const [reservas, leitos, resumo] = await Promise.all([
        this.agendaApi.listHotelReservas(),
        this.agendaApi.listHotelLeitos(),
        this.agendaApi.getHotelResumo(),
      ]);
      this.reservas.set(reservas);
      this.leitos.set(leitos);
      this.occupancyRate.set(Number(resumo?.ocupacao_percentual || 0));
      this.checkInHojeCount.set(Number(resumo?.checkins_hoje || 0));
      this.pendentesCount.set(Number(resumo?.reservas_pendentes || 0));
      this.confirmadasCount.set(Number(resumo?.reservas_confirmadas || 0));

      const selId = this.selectedReserva()?.id;
      if (selId != null && this.drawerMode() === 'details' && this.drawerOpen()) {
        try {
          const full = await this.agendaApi.getHotelReserva(selId);
          if (full) {
            this.selectedReserva.set(full);
            this.syncDetailDraftsFromReserva(full);
          }
        } catch {
          const fresh = reservas.find((x) => x.id === selId);
          if (fresh) {
            this.selectedReserva.set(fresh);
            this.syncDetailDraftsFromReserva(fresh);
          }
        }
      }
    } catch {
      this.loadError.set('Não foi possível carregar hospedagem e reservas.');
      this.reservas.set([]);
      this.leitos.set([]);
      this.occupancyRate.set(0);
      this.checkInHojeCount.set(0);
      this.pendentesCount.set(0);
      this.confirmadasCount.set(0);
    } finally {
      this.loading.set(false);
    }
  }

  private matchesPeriod(checkInIso: string, period: PeriodoFiltro, today: Date): boolean {
    if (period === 'todos') return true;
    const checkInDate = this.toDateOnly(new Date(checkInIso));
    if (period === 'hoje') return checkInDate.getTime() === today.getTime();

    const limit = new Date(today);
    limit.setDate(limit.getDate() + (period === '7dias' ? 7 : 30));
    return checkInDate >= today && checkInDate <= limit;
  }

  private toDateOnly(date: Date): Date {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  private diffDays(startIso: string, endIso: string): number {
    const start = new Date(`${startIso}T00:00:00`).getTime();
    const end = new Date(`${endIso}T00:00:00`).getTime();
    return Math.max(1, Math.ceil((end - start) / 86400000));
  }

  private normalize(value: string): string {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private toBool(value: unknown): boolean {
    return value === true || value === 1 || value === '1';
  }
}
