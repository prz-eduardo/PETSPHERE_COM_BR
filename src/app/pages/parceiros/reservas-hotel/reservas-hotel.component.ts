import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AgendaApiService,
  DiscoveryCandidateRow,
  HotelHospedagemCatalogBundle,
  HotelLeitoRow,
  PanoramaClientePermitidoPet,
  HotelReservaRow,
  HotelReservaStatus,
} from '../agenda/services/agenda-api.service';
import { SideDrawerComponent } from '../../../shared/side-drawer/side-drawer.component';
import { ParceiroAuthService } from '../../../services/parceiro-auth.service';
import { PartnerType } from '../../../types/agenda.types';
import { EspacoConfigWizardComponent } from '../espaco-config-wizard/espaco-config-wizard.component';
import { defaultCheckInOutForModo, type HospedagemModoFiltro } from './hospedagem-modo-presets';

const LS_HOSPEDAGEM_MODO = 'petsphere_hospedagem_modo';

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
  private clienteDiscoveryTimer: ReturnType<typeof setTimeout> | null = null;

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
  readonly selectedClienteId = signal<number | null>(null);
  readonly selectedPetId = signal<number | null>(null);
  readonly clienteSearchTerm = signal('');
  readonly clienteSearchLoading = signal(false);
  readonly clienteSearchError = signal<string | null>(null);
  readonly clienteCandidates = signal<DiscoveryCandidateRow[]>([]);
  readonly selectedCliente = signal<DiscoveryCandidateRow | null>(null);
  readonly clientePermissaoStatus = signal<string | null>(null);
  readonly clientePermissaoEscopo = signal<string | null>(null);
  readonly clienteConvitePendenteId = signal<number | null>(null);
  readonly clientePanoramaPets = signal<PanoramaClientePermitidoPet[]>([]);
  readonly loadingPanoramaPets = signal(false);
  readonly quickPetNome = signal('');
  readonly quickPetEspecie = signal('');
  readonly quickPetRaca = signal('');
  readonly quickPetPorte = signal('');
  readonly quickPetError = signal<string | null>(null);
  readonly quickPetSaving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly hospedagemCatalog = signal<HotelHospedagemCatalogBundle>({ catalog: [], infra: [], acomodacao_tipos: [] });
  readonly espacoWizardOpen = signal(false);
  readonly espacoWizardLeito = signal<HotelLeitoRow | null>(null);

  readonly partnerTipo = signal<PartnerType>('PETSHOP');
  /** Para parceiros hotel (mistos): segmento ativo. Creche-only fixa em daycare. */
  readonly modoSegmento = signal<HospedagemModoFiltro>('hospedagem');

  readonly isDaycarePartner = computed(() => this.partnerTipo() === 'DAYCARE');
  readonly effectiveModoFiltro = computed<HospedagemModoFiltro>(() =>
    this.partnerTipo() === 'DAYCARE' ? 'daycare' : this.modoSegmento()
  );

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
    await this.auth.refreshPartnerProfile();
    const tipo = this.auth.getCurrentParceiro()?.tipo ?? 'PETSHOP';
    this.partnerTipo.set(tipo);
    if (tipo === 'DAYCARE') {
      this.modoSegmento.set('daycare');
    } else {
      try {
        const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(LS_HOSPEDAGEM_MODO) : null;
        if (raw === 'hospedagem' || raw === 'daycare') this.modoSegmento.set(raw);
      } catch {
        /* noop */
      }
    }
    await Promise.all([this.loadHospedagemCatalog(), this.reload()]);
  }

  setModoSegmento(m: HospedagemModoFiltro): void {
    if (this.partnerTipo() === 'DAYCARE') return;
    this.modoSegmento.set(m);
    try {
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(LS_HOSPEDAGEM_MODO, m);
    } catch {
      /* noop */
    }
    void this.reload();
  }

  private checkInOutIsoForPayload(checkInYmd: string, checkOutYmd: string): { check_in: string; check_out: string } {
    const modo = this.effectiveModoFiltro();
    if (modo === 'daycare') {
      return {
        check_in: `${checkInYmd}T08:00:00`,
        check_out: `${checkOutYmd}T18:00:00`,
      };
    }
    return {
      check_in: `${checkInYmd}T14:00:00`,
      check_out: `${checkOutYmd}T12:00:00`,
    };
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
    const def = defaultCheckInOutForModo(this.effectiveModoFiltro());
    this.draftCheckIn.set(def.checkInDate);
    this.draftCheckOut.set(def.checkOutDate);
    this.draftObservacoes.set('');
    this.draftCuidadosEspeciais.set('');
    this.draftAlimentacaoObs.set('');
    this.selectedClienteId.set(null);
    this.selectedPetId.set(null);
    this.clienteSearchTerm.set('');
    this.clienteSearchError.set(null);
    this.clienteCandidates.set([]);
    this.selectedCliente.set(null);
    this.clientePermissaoStatus.set(null);
    this.clientePermissaoEscopo.set(null);
    this.clienteConvitePendenteId.set(null);
    this.clientePanoramaPets.set([]);
    this.quickPetNome.set('');
    this.quickPetEspecie.set('');
    this.quickPetRaca.set('');
    this.quickPetPorte.set('');
    this.quickPetError.set(null);
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

  leitoUsoLabel(leito: HotelLeitoRow): string | null {
    const u = String(leito.uso_operacao || 'hospedagem').toLowerCase();
    if (u === 'daycare') return 'Creche / dia';
    if (u === 'ambos') return 'Hotel e creche';
    if (u === 'hospedagem') return 'Hospedagem';
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

  onClienteSearchInput(value: string): void {
    this.clienteSearchTerm.set(value);
    this.draftTutor.set(value);
    this.selectedCliente.set(null);
    this.selectedClienteId.set(null);
    this.selectedPetId.set(null);
    this.clientePanoramaPets.set([]);
    this.clientePermissaoStatus.set(null);
    this.clientePermissaoEscopo.set(null);
    this.clienteConvitePendenteId.set(null);
    this.clienteSearchError.set(null);
    if (this.clienteDiscoveryTimer) clearTimeout(this.clienteDiscoveryTimer);
    const q = value.trim();
    if (q.length < 3) {
      this.clienteCandidates.set([]);
      return;
    }
    this.clienteDiscoveryTimer = setTimeout(() => void this.searchClientes(q), 260);
  }

  private async searchClientes(q: string): Promise<void> {
    try {
      this.clienteSearchLoading.set(true);
      const rows = await this.agendaApi.discoverClientes(q);
      this.clienteCandidates.set(Array.isArray(rows) ? rows : []);
      this.clienteSearchError.set(null);
    } catch (err: unknown) {
      const msg = (err as { error?: { error?: string } })?.error?.error || 'Falha ao buscar clientes';
      this.clienteSearchError.set(msg);
      this.clienteCandidates.set([]);
    } finally {
      this.clienteSearchLoading.set(false);
    }
  }

  async selectClienteCandidate(c: DiscoveryCandidateRow): Promise<void> {
    this.selectedCliente.set(c);
    this.selectedClienteId.set(c.cliente_id);
    this.draftTutor.set((c.nome || c.nome_masked || '').trim());
    this.clienteSearchTerm.set(this.draftTutor());
    this.clienteCandidates.set([]);
    this.clientePermissaoStatus.set(c.permissao_status || null);
    this.clientePermissaoEscopo.set(c.permissao_escopo || null);
    this.clienteConvitePendenteId.set(c.convite_pendente_id ?? null);
    this.selectedPetId.set(null);
    this.clientePanoramaPets.set([]);
    this.quickPetError.set(null);

    if (c.permissao_status === 'concedido') {
      await this.loadClientePanoramaPets(c.cliente_id);
    }
  }

  private async loadClientePanoramaPets(clienteId: number): Promise<void> {
    try {
      this.loadingPanoramaPets.set(true);
      const pan = await this.agendaApi.getClientePanoramaDados(clienteId);
      this.clientePanoramaPets.set(Array.isArray(pan?.pets) ? pan.pets : []);
      if (this.clientePanoramaPets().length === 1) {
        this.selectedPetId.set(this.clientePanoramaPets()[0].id);
        this.draftPet.set(this.clientePanoramaPets()[0].nome || '');
      }
    } catch {
      this.clientePanoramaPets.set([]);
    } finally {
      this.loadingPanoramaPets.set(false);
    }
  }

  onSelectPet(petId: number | null): void {
    this.selectedPetId.set(petId);
    if (!petId) return;
    const hit = this.clientePanoramaPets().find((p) => p.id === petId);
    if (hit) this.draftPet.set(hit.nome || '');
  }

  async criarPetRapido(): Promise<void> {
    const clienteId = this.selectedClienteId();
    const nome = this.quickPetNome().trim();
    if (!clienteId) {
      this.quickPetError.set('Selecione um cliente antes de cadastrar pet.');
      return;
    }
    if (!nome) {
      this.quickPetError.set('Informe o nome do pet.');
      return;
    }
    try {
      this.quickPetSaving.set(true);
      this.quickPetError.set(null);
      const pet = await this.agendaApi.createClientePetQuick(clienteId, {
        nome,
        especie: this.quickPetEspecie().trim() || null,
        raca: this.quickPetRaca().trim() || null,
        porte: this.quickPetPorte().trim() || null,
      });
      if (!pet) {
        this.quickPetError.set('Não foi possível cadastrar o pet.');
        return;
      }
      const next = [...this.clientePanoramaPets(), pet];
      this.clientePanoramaPets.set(next);
      this.selectedPetId.set(pet.id);
      this.draftPet.set(pet.nome || '');
      this.quickPetNome.set('');
      this.quickPetEspecie.set('');
      this.quickPetRaca.set('');
      this.quickPetPorte.set('');
    } catch (err: unknown) {
      const msg = (err as { error?: { error?: string } })?.error?.error || 'Falha ao criar pet';
      this.quickPetError.set(msg);
    } finally {
      this.quickPetSaving.set(false);
    }
  }

  async solicitarPermissaoCliente(): Promise<void> {
    const c = this.selectedCliente();
    if (!c) return;
    try {
      this.saving.set(true);
      this.formError.set(null);
      const res = await this.agendaApi.postConviteCliente({
        cliente_id: c.cliente_id,
        escopo: 'pets',
        days_valid: 7,
      });
      this.clienteConvitePendenteId.set(res?.convite?.id ?? this.clienteConvitePendenteId());
      this.formError.set('Convite de permissão enviado ao cliente.');
    } catch (err: unknown) {
      const msg = (err as { error?: { error?: string } })?.error?.error || 'Falha ao enviar convite';
      this.formError.set(msg);
    } finally {
      this.saving.set(false);
    }
  }

  clientePermissaoBadge(): string | null {
    const st = String(this.clientePermissaoStatus() || '').toLowerCase();
    if (!st) return null;
    if (st === 'concedido') return 'Permissão concedida';
    if (st === 'pendente') return 'Permissão pendente';
    if (st === 'revogado') return 'Permissão revogada';
    return st;
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
    const clienteId = this.selectedClienteId();
    const petId = this.selectedPetId();
    const permissao = String(this.clientePermissaoStatus() || '').toLowerCase();

    if (!tutorNome || !petNome || !checkIn || !checkOut) {
      this.formError.set('Preencha tutor, pet e período.');
      return;
    }
    if (clienteId && permissao === 'concedido' && !petId) {
      this.formError.set('Selecione um pet do cliente ou cadastre um pet rápido.');
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
      const { check_in, check_out } = this.checkInOutIsoForPayload(checkIn, checkOut);
      const created = await this.agendaApi.createHotelReserva({
        leito_id: this.draftLeitoId() || null,
        cliente_id: clienteId && permissao === 'concedido' ? clienteId : null,
        pet_id: clienteId && permissao === 'concedido' ? petId || null : null,
        cliente_nome_snapshot: tutorNome,
        pet_nome_snapshot: petNome,
        check_in,
        check_out,
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
      const uso = this.effectiveModoFiltro();
      const [reservas, leitos, resumo] = await Promise.all([
        this.agendaApi.listHotelReservas({ uso }),
        this.agendaApi.listHotelLeitos({ uso }),
        this.agendaApi.getHotelResumo({ uso }),
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
