import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  SimpleChanges,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Agendamento,
  AgendaSavePayload,
  AgendaConfig,
  AgendaStatus,
  PetResumido,
  Profissional,
  Servico,
  SlotInfo,
} from '../../../../types/agenda.types';
import {
  AgendaApiService,
  DiscoveryCandidateRow,
  PanoramaClientePermitidoPet,
  PanoramaClientePermitidoResponse,
  PermissaoDadosRow,
} from '../services/agenda-api.service';
import { getTime } from '../utils/date-helpers';

@Component({
  selector: 'app-agenda-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './agenda-sidebar.component.html',
  styleUrls: ['./agenda-sidebar.component.scss'],
})
export class AgendaSidebarComponent implements OnInit, OnChanges {
  @Input() slot: SlotInfo | null = null;
  @Input() profissionais: Profissional[] = [];
  @Input() servicos: Servico[] = [];
  @Input() config!: AgendaConfig;
  /** Pets derivados dos agendamentos retornados pela API (fallback quando não há panorama). */
  @Input() catalogPets: PetResumido[] = [];
  @Input() existingAgendamentos: Agendamento[] = [];
  @Output() save = new EventEmitter<AgendaSavePayload>();
  @Output() close = new EventEmitter<void>();

  searchPet = signal('');
  selectedPet = signal<PetResumido | null>(null);

  tutorQuery = signal('');
  tutorCandidates = signal<DiscoveryCandidateRow[]>([]);
  discoverLoading = signal(false);
  discoverError = signal<string | null>(null);

  /** Alterna busca principal entre tutor (contato) e pet (nome na agenda / base). */
  searchMode = signal<'tutor' | 'pet'>('tutor');
  petSearchQuery = signal('');

  selectedCliente = signal<DiscoveryCandidateRow | null>(null);

  panoramaLoading = signal(false);
  panoramaPets = signal<PanoramaClientePermitidoPet[]>([]);
  /** Dados reais do tutor após panorama (complementa discovery quando já há consentimento). */
  panoramaTutor = signal<PanoramaClientePermitidoResponse['tutor'] | null>(null);

  /** Fluxo rápido sem discovery (nome + pet + telefone/email). */
  guestWalkInMode = signal(false);

  tutorEmailGuest = signal('');
  notificarPorEmail = signal(true);

  selectedProfId = signal('');
  selectedServicoId = signal('');
  dateStr = signal('');
  timeStr = signal('');
  durMin = signal(60);
  obs = signal('');

  allPetsCatalog = signal<PetResumido[]>([]);

  filteredPets = computed(() => {
    const panorama = this.panoramaPets().map((p) => this.fromPanoramaPet(p));
    if (panorama.length) return panorama;
    const q = this.searchPet().toLowerCase().trim();
    const base = this.allPetsCatalog();
    if (!q) return base.slice(0, 12);
    return base.filter(
      (pet) =>
        pet.nome.toLowerCase().includes(q) ||
        pet.tutor.nome.toLowerCase().includes(q) ||
        (pet.tutor.email && pet.tutor.email.toLowerCase().includes(q)) ||
        (pet.tutor.telefone && pet.tutor.telefone.replace(/\D/g, '').includes(q.replace(/\D/g, ''))),
    ).slice(0, 12);
  });

  /** Pets do histórico da agenda filtrados pelo modo “Por pet”. */
  catalogPetsForPetMode = computed(() => {
    if (this.searchMode() !== 'pet') return [];
    const q = this.petSearchQuery().toLowerCase().trim();
    if (q.length < 2) return [];
    const base = this.allPetsCatalog();
    return base
      .filter(
        (pet) =>
          pet.nome.toLowerCase().includes(q) ||
          (pet.raca && pet.raca.toLowerCase().includes(q)) ||
          pet.tutor.nome.toLowerCase().includes(q),
      )
      .slice(0, 16);
  });

  /** Pets do panorama filtrados pelo texto em modo pet. */
  panoramaPetsForPetMode = computed(() => {
    if (this.searchMode() !== 'pet') return [];
    const q = this.petSearchQuery().toLowerCase().trim();
    const raw = this.panoramaPets();
    if (!q.length) return raw;
    return raw.filter(
      (p) =>
        String(p.nome || '')
          .toLowerCase()
          .includes(q) ||
        String(p.raca || '')
          .toLowerCase()
          .includes(q),
    );
  });

  sugeridoHorario = computed(() => {
    const now = new Date();
    const busy = this.existingAgendamentos
      .filter((a) => a.status !== 'CANCELADO')
      .sort((a, b) => getTime(a.inicio) - getTime(b.inicio));

    for (let h = Math.max(now.getHours(), this.config?.workStart ?? 8); h < (this.config?.workEnd ?? 19); h++) {
      for (const m of [0, 30]) {
        const candidate = new Date();
        candidate.setHours(h, m, 0, 0);
        if (candidate <= now) continue;
        const dur = this.durMin() * 60000;
        const conflict = busy.find(
          (a) => a.inicio < new Date(candidate.getTime() + dur) && a.fim > candidate,
        );
        if (!conflict) {
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }
      }
    }
    return null;
  });

  showPetDropdown = signal(false);

  permissionStatus = signal<'pendente' | 'concedido' | 'revogado' | null>(null);
  showRequestModal = signal(false);
  requesting = signal(false);
  inviteSent = signal(false);
  inviteInfo: unknown = null;
  emailInput = signal('');

  private discoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private petDiscoveryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private agendaApi: AgendaApiService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['catalogPets']) {
      this.allPetsCatalog.set(this.catalogPets || []);
    }
  }

  ngOnInit(): void {
    this.allPetsCatalog.set(this.catalogPets || []);

    if (this.slot) {
      const d = this.slot.hora;
      this.dateStr.set(d.toISOString().substring(0, 10));
      this.timeStr.set(
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      );
      if (this.slot.profissionalId) this.selectedProfId.set(this.slot.profissionalId);
    } else {
      const today = new Date();
      this.dateStr.set(today.toISOString().substring(0, 10));
      this.timeStr.set(this.sugeridoHorario() ?? '08:00');
    }

    if (this.servicos.length) {
      this.selectedServicoId.set(this.servicos[0].id);
      this.durMin.set(this.servicos[0].duracaoMin);
    }

    if (this.profissionais.length && !this.selectedProfId()) {
      this.selectedProfId.set(this.profissionais[0].id);
    }
  }

  onTutorQueryChange(value: string): void {
    if (this.searchMode() !== 'tutor') return;
    this.tutorQuery.set(value);
    this.discoverError.set(null);

    if (this.discoveryTimer) clearTimeout(this.discoveryTimer);
    const q = value.trim();

    if (this.guestWalkInMode()) {
      return;
    }

    if (!q.length) {
      this.tutorCandidates.set([]);
      return;
    }
    if (q.length < 3) {
      this.tutorCandidates.set([]);
      return;
    }

    this.discoveryTimer = setTimeout(() => void this.runDiscovery(q), 280);
  }

  onPetSearchQueryChange(value: string): void {
    if (this.searchMode() !== 'pet') return;
    this.petSearchQuery.set(value);
    this.discoverError.set(null);

    if (this.petDiscoveryTimer) clearTimeout(this.petDiscoveryTimer);
    const q = value.trim();

    if (this.guestWalkInMode()) return;

    if (!q.length) {
      this.tutorCandidates.set([]);
      return;
    }
    if (q.length < 3) {
      this.tutorCandidates.set([]);
      return;
    }

    this.petDiscoveryTimer = setTimeout(() => void this.runDiscovery(q), 280);
  }

  setSearchMode(mode: 'tutor' | 'pet'): void {
    if (this.searchMode() === mode) return;
    this.searchMode.set(mode);
    this.tutorCandidates.set([]);
    this.discoverError.set(null);
    if (this.discoveryTimer) clearTimeout(this.discoveryTimer);
    if (this.petDiscoveryTimer) clearTimeout(this.petDiscoveryTimer);
    if (mode === 'pet') {
      this.petSearchQuery.set('');
    } else {
      this.showPetDropdown.set(false);
    }
  }

  displayClienteNome(row: DiscoveryCandidateRow | null): string {
    if (!row) return '';
    if (row.permissao_status === 'concedido' && row.nome) return String(row.nome).trim();
    return (row.nome_masked || 'Cliente').trim();
  }

  displayClienteEmail(row: DiscoveryCandidateRow | null): string {
    if (!row) return '';
    if (row.permissao_status === 'concedido' && row.email) return String(row.email).trim();
    return (row.email_masked || '').trim();
  }

  displayClienteTelefone(row: DiscoveryCandidateRow | null): string {
    if (!row) return '';
    if (row.permissao_status === 'concedido' && row.telefone) return String(row.telefone).trim();
    return (row.telefone_masked || '').trim();
  }

  displayClienteCpf(row: DiscoveryCandidateRow | null): string {
    if (!row) return '';
    if (row.permissao_status === 'concedido' && row.cpf) return String(row.cpf).trim();
    return (row.cpf_masked || '').trim();
  }

  private async runDiscovery(q: string): Promise<void> {
    if (this.guestWalkInMode()) return;
    this.discoverLoading.set(true);
    try {
      const rows = await this.agendaApi.discoverClientes(q);
      this.tutorCandidates.set(Array.isArray(rows) ? rows : []);
      this.discoverError.set(null);
    } catch (e: unknown) {
      const msg =
        (e as { error?: { error?: string } })?.error?.error || 'Não foi possível buscar tutores.';
      this.discoverError.set(msg);
      this.tutorCandidates.set([]);
    } finally {
      this.discoverLoading.set(false);
    }
  }

  async selectClienteDiscovered(row: DiscoveryCandidateRow): Promise<void> {
    this.selectedCliente.set(row);
    this.selectedPet.set(null);
    this.searchPet.set('');
    const label =
      this.displayClienteNome(row) ||
      this.displayClienteTelefone(row) ||
      this.displayClienteEmail(row) ||
      'Cliente';
    this.tutorQuery.set(label);
    this.petSearchQuery.set('');
    this.tutorCandidates.set([]);
    this.panoramaPets.set([]);
    this.panoramaTutor.set(null);

    void this.loadPermissaoForSelectedCliente(row);
    this.prefillNotificationsFromCliente(row);
    await this.maybeLoadPanorama(Number(row.cliente_id), row);
  }

  /** Carrega lista de pets permitidos quando o consentimento permite. */
  private async maybeLoadPanorama(clienteId: number, cand?: DiscoveryCandidateRow | null): Promise<void> {
    const effective = cand ?? this.selectedCliente();
    if (!rowClienteHasConcedido(effective)) return;
    this.panoramaLoading.set(true);
    try {
      const pan = await this.agendaApi.getClientePanoramaDados(clienteId);
      this.panoramaTutor.set(pan?.tutor ?? null);
      const pets = Array.isArray(pan?.pets) ? pan.pets : [];
      this.panoramaPets.set(pets);
      if (pets.length === 1) this.selectPet(this.fromPanoramaPet(pets[0]));
    } catch {
      this.panoramaPets.set([]);
      this.panoramaTutor.set(null);
    } finally {
      this.panoramaLoading.set(false);
    }
  }

  /** Usa conta da própria plataforma: notificação no e-mail oficial do cliente quando possível. */
  clienteJaComContaParaNotificacao(): boolean {
    return rowClienteHasConcedido(this.selectedCliente());
  }

  private prefillNotificationsFromCliente(row: DiscoveryCandidateRow | null): void {
    if (!row) {
      this.tutorEmailGuest.set('');
      return;
    }
    if (row.permissao_status === 'concedido' && row.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(row.email))) {
      this.tutorEmailGuest.set(String(row.email).trim().toLowerCase());
      return;
    }
    const em = this.displayClienteEmail(row);
    if (em && em.includes('@') && !/[•*■]/.test(em)) {
      this.tutorEmailGuest.set(em.toLowerCase());
      return;
    }
    const q = this.tutorQuery().trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q)) this.tutorEmailGuest.set(q.toLowerCase());
    else this.tutorEmailGuest.set('');
  }

  clearClienteSelection(): void {
    this.selectedCliente.set(null);
    this.panoramaPets.set([]);
    this.panoramaTutor.set(null);
    this.permissionStatus.set(null);
    this.tutorEmailGuest.set('');
  }

  clearPet(): void {
    this.selectedPet.set(null);
    this.searchPet.set('');
  }

  toggleGuestWalkIn(): void {
    const next = !this.guestWalkInMode();
    this.guestWalkInMode.set(next);
    if (next) {
      this.selectedCliente.set(null);
      this.tutorCandidates.set([]);
      this.panoramaPets.set([]);
      this.panoramaTutor.set(null);
      this.permissionStatus.set(null);
      this.selectedPet.set(null);
      this.searchMode.set('tutor');
    }
  }

  /** PetResumido a partir da linha de panorama autorizado pelo tutor. */
  private fromPanoramaPet(p: PanoramaClientePermitidoPet): PetResumido {
    const c = this.selectedCliente();
    const pt = this.panoramaTutor();
    const nomeTutor =
      (pt?.nome && String(pt.nome).trim()) ||
      this.displayClienteNome(c) ||
      'Tutor';

    let tutorId = '';
    if (pt?.cliente_id != null) tutorId = String(pt.cliente_id);
    else if (c?.cliente_id) tutorId = String(c.cliente_id);

    const tel =
      (pt?.telefone && String(pt.telefone).trim()) ||
      this.displayClienteTelefone(c) ||
      '';
    const mail =
      (pt?.email && String(pt.email).trim()) ||
      this.displayClienteEmail(c) ||
      undefined;

    const especieNorm = (String(p.especie || '').toLowerCase()) as string;
    const especie: PetResumido['especie'] =
      especieNorm.startsWith('gato') ? 'Gato' : especieNorm.startsWith('c') ? 'Cão' : 'Outro';

    return {
      id: String(p.id),
      nome: String(p.nome || 'Pet'),
      especie,
      raca: p.raca || undefined,
      alergias: [],
      observacoes: '',
      temMedicacao: false,
      temRestricao: false,
      temAlimentacaoEspecial: false,
      historicoRecente: [],
      tutor: {
        id: tutorId,
        nome: nomeTutor.replace(/\*+/g, '').trim() || 'Tutor',
        telefone: tel,
        email:
          mail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)
            ? mail.trim().toLowerCase()
            : extractEmailGuess(mail),
      },
    };
  }

  pickPanoramaPet(p: PanoramaClientePermitidoPet): void {
    this.selectPet(this.fromPanoramaPet(p));
  }

  selectPet(pet: PetResumido): void {
    this.selectedPet.set(pet);
    this.searchPet.set(pet.nome);
    this.showPetDropdown.set(false);

    const fromPanorama =
      !!this.selectedCliente()?.cliente_id &&
      this.panoramaPets().some((pp) => String(pp.id) === pet.id);
    if (fromPanorama) {
      void this.loadPermissaoForSelectedCliente(this.selectedCliente());
      return;
    }

    void this.loadPermissaoLegacyCatalogPet(pet);
  }

  onServicoChange(id: string): void {
    this.selectedServicoId.set(id);
    const s = this.servicos.find((serv) => serv.id === id);
    if (s) this.durMin.set(s.duracaoMin);
  }

  useSugestao(): void {
    if (this.sugeridoHorario()) this.timeStr.set(this.sugeridoHorario()!);
  }

  getSelectedServico(): Servico | null {
    return this.servicos.find((s) => s.id === this.selectedServicoId()) ?? null;
  }

  getSelectedProfissional(): Profissional | null {
    return this.profissionais.find((p) => p.id === this.selectedProfId()) ?? null;
  }

  podeEnviarNotificacao(): boolean {
    if (!this.notificarPorEmail()) return false;
    if (this.clienteJaComContaParaNotificacao()) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.tutorEmailGuest().trim());
  }

  podeAgendarSomenteSnapshots(): boolean {
    /** Permissão pendente ou sem vínculo: parceiro ainda marca na grade com nome contato manual. */
    return this.guestWalkInMode();
  }

  canSave(): boolean {
    const servOk = !!(this.selectedProfId() && this.selectedServicoId() && this.dateStr() && this.timeStr());

    let tutorOk = false;
    if (this.selectedPet()) tutorOk = true;
    else if (this.guestWalkInMode()) {
      tutorOk = this.tutorQuery().trim().length >= 2;
    } else {
      const nomeRef =
        this.searchMode() === 'pet' ? this.petSearchQuery().trim() : this.tutorQuery().trim();
      tutorOk = nomeRef.length >= 2 || this.selectedCliente() != null;
    }

    if (!servOk || !tutorOk) return false;

    if (this.notificarPorEmail() && !this.podeEnviarNotificacao()) return false;

    return true;
  }

  private buildNotificationsPayload(): AgendaSavePayload['tutorNotificacao'] | undefined {
    if (!this.notificarPorEmail()) return { enviar: false };

    if (this.clienteJaComContaParaNotificacao() && rowClienteHasConcedido(this.selectedCliente())) {
      return { enviar: true, modo: 'cadastrado' };
    }
    const em = this.tutorEmailGuest().trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      return { enviar: true, modo: 'guest', emailGuest: em };
    }
    /** fallback: mesmo sem formato perfeito, não bloqueia agendamento de mesa quando notificação falhar */
    return { enviar: false, modo: 'guest' };
  }

  private buildClienteIdSnapshotPetId(): {
    clienteId?: number;
    petId?: number | null;
  } {
    const row = this.selectedCliente();
    if (!rowClienteHasConcedido(row)) return {};

    const pet = this.selectedPet();
    let petIdNum: number | null = null;
    if (pet && this.panoramaPets().length) {
      const matched = this.panoramaPets().some((pp) => String(pp.id) === String(pet.id));
      const numericOk = /^[0-9]+$/.test(String(pet.id));
      if (matched && numericOk) petIdNum = Number(pet.id);
    }

    return {
      clienteId: row!.cliente_id,
      petId: petIdNum,
    };
  }

  onSave(): void {
    if (!this.canSave()) return;

    /* Catálogo local (pets das visitas sem discovery): igual fluxo antigo LGPD */
    if (
      this.selectedPet() &&
      this.permissionStatus() === 'pendente' &&
      !this.selectedCliente()
    ) {
      return;
    }
    if (
      this.selectedPet() &&
      this.permissionStatus() !== 'concedido' &&
      this.permissionStatus() != null &&
      !this.selectedCliente()
    ) {
      this.openRequestModal();
      return;
    }

    const [year, month, day] = this.dateStr().split('-').map(Number);
    const [hour, min] = this.timeStr().split(':').map(Number);

    const inicio = new Date(year, month - 1, day, hour, min, 0, 0);
    const fim = new Date(inicio.getTime() + this.durMin() * 60000);

    const prof = this.getSelectedProfissional();
    const serv = this.getSelectedServico();
    if (!prof || !serv) return;

    const nomeCliente = (
      (this.selectedPet()?.tutor?.nome || '').trim() ||
      (this.panoramaTutor()?.nome || '').trim() ||
      this.displayClienteNome(this.selectedCliente()) ||
      this.tutorQuery().trim() ||
      'Cliente'
    ).trim();

    const tutorMeta = this.buildClienteIdSnapshotPetId();

    const tutorEmailForManual =
      tutorMeta.clienteId != null
        ? (this.panoramaTutor()?.email ||
            this.selectedCliente()?.email ||
            extractEmailGuess(this.displayClienteEmail(this.selectedCliente())))
        : this.tutorEmailGuest().trim() || undefined;

    const petManual: PetResumido =
      this.selectedPet() ??
      ({
        id: 'manual',
        nome: this.searchPet().trim() || '—',
        especie: 'Outro',
        alergias: [],
        temMedicacao: false,
        temRestricao: false,
        temAlimentacaoEspecial: false,
        historicoRecente: [],
        tutor: {
          id: 'manual',
          nome: nomeCliente || 'Cliente',
          telefone:
            (this.panoramaTutor()?.telefone || this.displayClienteTelefone(this.selectedCliente()) || '').trim(),
          email: tutorEmailForManual,
        },
      } as PetResumido);

    const novo: Agendamento = {
      id: 'new-' + Date.now(),
      pet: petManual,
      profissional: prof,
      servico: serv,
      inicio,
      fim,
      status: 'AGENDADO' as AgendaStatus,
      observacoes: this.obs() || undefined,
      recorrente: false,
      cliente_id: tutorMeta.clienteId,
      pet_id: tutorMeta.petId ?? null,
      servico_id: /^[0-9]+$/.test(String(serv.id)) ? Number(serv.id) : undefined,
    };

    this.save.emit({
      agendamento: novo,
      tutorNotificacao: this.buildNotificationsPayload(),
    });
  }

  /* ── Solicitações de permissão LGPD (catálogo legado) ─────────────────── */

  openRequestModal(): void {
    this.emailInput.set(this.selectedPet()?.tutor?.email || '');
    this.showRequestModal.set(true);
  }

  closeRequestModal(): void {
    this.showRequestModal.set(false);
  }

  private async loadPermissaoLegacyCatalogPet(pet: PetResumido): Promise<void> {
    this.permissionStatus.set(null);
    this.inviteSent.set(false);
    this.inviteInfo = null;
    this.emailInput.set(pet.tutor?.email || '');
    try {
      const permissoes = await this.agendaApi.listPermissoesDados();
      let found: PermissaoDadosRow | undefined;
      if (pet.tutor?.email) {
        found = permissoes.find(
          (pp: PermissaoDadosRow) =>
            pp.cliente_email === pet.tutor!.email ||
            String(pp.cliente_id) === String(pet.tutor.id),
        );
      } else if (pet.tutor?.id) {
        found = permissoes.find((pp: PermissaoDadosRow) => String(pp.cliente_id) === String(pet.tutor.id));
      }
      this.permissionStatus.set((found?.status ?? null) as 'pendente' | 'concedido' | 'revogado' | null);
    } catch {
      this.permissionStatus.set(null);
    }
  }

  private async loadPermissaoForSelectedCliente(row: DiscoveryCandidateRow | null): Promise<void> {
    if (!row) return;

    /** Status vem já da linha discovery; sincroniza com permissões detalhadas quando possível */
    this.permissionStatus.set((row.permissao_status ?? null) as 'pendente' | 'concedido' | 'revogado' | null);

    try {
      const permissoes = await this.agendaApi.listPermissoesDados();
      const found = permissoes.find(
        (pp: { cliente_id?: number }) => String(pp.cliente_id) === String(row.cliente_id),
      );
      const st =
        ((found?.status ?? row.permissao_status ?? null) as 'pendente' | 'concedido' | 'revogado' | null);

      const effective = row.permissao_status === 'pendente'
        ? 'pendente'
        : st ??
          ((row.permissao_status ?? null) as 'pendente' | 'concedido' | 'revogado' | null);

      this.permissionStatus.set(effective);
    } catch {
      this.permissionStatus.set((row.permissao_status ?? null) as never);
    }
  }

  async doInvite(): Promise<void> {
    const email = this.emailInput().trim();
    if (!email) return;
    this.requesting.set(true);
    try {
      const convite = await this.agendaApi.inviteClient({ cliente_email: email, escopo: 'pets' });
      this.inviteInfo = convite;
      this.inviteSent.set(true);
      this.permissionStatus.set('pendente');
      this.showRequestModal.set(false);
    } catch {
      //
    } finally {
      this.requesting.set(false);
    }
  }

  permissaoBadge(): string | null {
    const st =
      rowClienteHasConcedido(this.selectedCliente()) ? 'concedido' : this.permissionStatus();

    switch (st) {
      case 'concedido':
        return 'Dados visíveis: cliente já compartilhou consentimento com este estabelecimento.';
      case 'pendente':
        return '⏳ Aguardando consentimento do cliente';
      case 'revogado':
        return '⛔ Consentimento revogado anteriormente';

      default:
        return '📭 Cliente existe na base, mas ainda não vinculamos dados LGPD.';
    }
  }

  trackCandidate(_idx: number, row: DiscoveryCandidateRow): number {
    return row.cliente_id;
  }

  trackPetCatalog(_idx: number, pet: PetResumido): string {
    return pet.id;
  }
}

/** Descoberta: linha sugere conta ativa quando o parceiro já tem vínculo de dados válido. */
function rowClienteHasConcedido(row: DiscoveryCandidateRow | null): boolean {
  return row != null && row.permissao_status === 'concedido';
}

function extractEmailGuess(mask?: string | null): string | undefined {
  if (!mask) return undefined;
  if (mask.includes('@') && !/[•*■]/.test(mask)) return mask.trim().toLowerCase();
  return undefined;
}
