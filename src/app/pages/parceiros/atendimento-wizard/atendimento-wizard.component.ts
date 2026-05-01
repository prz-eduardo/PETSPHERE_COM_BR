import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, signal, NgZone } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';
import {
  VetWizardSessionService,
  WizardSession,
  WizardStep,
  TipoAtendimento,
  DecisaoOperacional,
} from '../../../services/vet-wizard-session.service';
import { ParceiroAuthService } from '../../../services/parceiro-auth.service';
import { AuthService } from '../../../services/auth.service';
import { ApiService } from '../../../services/api.service';
import { ToastService } from '../../../services/toast.service';

interface StepMeta {
  id: WizardStep;
  label: string;
  shortLabel: string;
}

interface WizardTutor {
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  endereco: string;
  pets: WizardPet[];
}

interface WizardPet {
  id?: string;
  nome: string;
  especie: string;
  idade: number;
  peso: number;
  raca: string;
  sexo: 'Macho' | 'Fêmea';
  photoURL?: string;
  alergias?: string[];
  alergias_predefinidas?: Array<{ nome: string; alergia_id: number | null; ativo_id: number | null; observacoes?: string | null }>;
  statusTutor?: string;
  cadastradoPorVet?: boolean;
}

const STEPS: StepMeta[] = [
  { id: 'identificacao',      label: 'Identificação',        shortLabel: '1' },
  { id: 'clinica',            label: 'Clínica',              shortLabel: '2' },
  { id: 'finalizacao-clinica',label: 'Finalização clínica',  shortLabel: '3' },
  { id: 'decisao',            label: 'Decisão',              shortLabel: '4' },
  { id: 'operacao',           label: 'Operação',             shortLabel: '5' },
  { id: 'ia',                 label: 'IA (opcional)',         shortLabel: '6' },
];

@Component({
  selector: 'app-atendimento-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NgxMaskDirective],
  providers: [provideNgxMask()],
  templateUrl: './atendimento-wizard.component.html',
  styleUrls: ['./atendimento-wizard.component.scss'],
})
export class AtendimentoWizardComponent implements OnInit, OnDestroy {
  readonly steps = STEPS;

  session = signal<WizardSession | null>(null);

  cpf = '';
  carregandoTutor = false;
  tutorEncontrado: WizardTutor | null = null;
  petSelecionado: WizardPet | null = null;
  cadastroManualTutor = false;
  clienteIdSelecionado: number | null = null;
  novoTutor: WizardTutor = { nome: '', cpf: '', telefone: '', email: '', endereco: '', pets: [] };

  form = {
    petNomeManual: '',
    tipoAtendimento: 'presencial' as TipoAtendimento,
  };

  // Etapa 3 — checklist
  checklist = {
    anamnese: false,
    diagnostico: false,
    receita: false,
  };

  // Etapa 4 — decisão
  decisao: DecisaoOperacional | null = null;

  private sub = new Subscription();

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private ngZone: NgZone,
    private sanitizer: DomSanitizer,
    private wizardSvc: VetWizardSessionService,
    private route: ActivatedRoute,
    private router: Router,
    private parceiroAuth: ParceiroAuthService,
    private authService: AuthService,
    private apiService: ApiService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.sub.add(
      this.wizardSvc.session$.subscribe(s => this.session.set(s)),
    );

    // Detecta retorno de página externa (gerar-receita, panorama, ia)
    const wizardReturn = this.route.snapshot.queryParamMap.get('wizardReturn');
    if (wizardReturn && this.wizardSvc.snapshot) {
      // Sessão já existe — permanecer no step atual
      return;
    }

    // Se não há sessão ativa, inicia no step de identificação
    if (!this.wizardSvc.snapshot) {
      this.wizardSvc.patch({ step: 'identificacao' } as any);
      this.session.set({ step: 'identificacao' } as WizardSession);
    }
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  get currentStep(): WizardStep {
    return this.session()?.step ?? 'identificacao';
  }

  stepIndex(step: WizardStep): number {
    return STEPS.findIndex(s => s.id === step);
  }

  stepState(step: WizardStep): 'done' | 'active' | 'pending' {
    const current = this.currentStep;
    const ci = this.stepIndex(current);
    const si = this.stepIndex(step);
    if (si < ci) return 'done';
    if (si === ci) return 'active';
    return 'pending';
  }

  get baseLink(): string {
    return '/parceiros';
  }

  get gerarReceitaLink(): string {
    const id = this.session()?.atendimentoId;
    const q = id ? `?atendimentoId=${id}&wizardReturn=1` : '?wizardReturn=1';
    return `${this.baseLink}/gerar-receita${q}`;
  }

  get panoramaLink(): string {
    return `${this.baseLink}/panorama-atendimento?wizardReturn=1`;
  }

  get iaLink(): string {
    const id = this.session()?.atendimentoId;
    return id ? `${this.baseLink}/vet-atendimento-ia/${id}?wizardReturn=1` : '';
  }

  getEffectiveToken(): string | null {
    try {
      const t = this.authService?.getToken && this.authService.getToken();
      if (t) return t;
    } catch {}
    try {
      const pt = this.parceiroAuth?.getToken && this.parceiroAuth.getToken();
      if (pt) return pt;
    } catch {}
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('token') || sessionStorage.getItem('token') || null;
    }
    return null;
  }

  private petPhotoFromApiRow(pet: any): string | undefined {
    if (!pet) return undefined;
    const raw = (pet.photoURL || pet.foto || pet.photo || pet.photo_url || pet.imagem || '').toString().trim();
    if (!raw) return undefined;
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:') || raw.startsWith('blob:')) {
      return raw;
    }
    if (raw.startsWith('/')) return raw;
    return '/' + raw.replace(/^\/+/, '');
  }

  getPetPrimaryPhotoUrl(pet: WizardPet | null | undefined): string | null {
    return this.petPhotoFromApiRow(pet) ?? null;
  }

  petCardBackgroundImage(pet: WizardPet): SafeStyle | null {
    const url = this.getPetPrimaryPhotoUrl(pet);
    if (!url) return null;
    const escaped = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return this.sanitizer.bypassSecurityTrustStyle(`url("${escaped}")`);
  }

  trackByPet(_i: number, pet: WizardPet): string {
    return pet.id || pet.nome;
  }

  isPetPendente(p: WizardPet): boolean {
    return !!(p && (p.statusTutor === 'pendente' || p.cadastradoPorVet === true));
  }

  formatarCpf(cpf: string): string {
    if (!cpf) return '';
    const cpfLimpo = cpf.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) return cpf;
    return cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  private formatarEndereco(end: any): string {
    if (!end) return '';
    if (typeof end === 'string') return end;
    const p: string[] = [];
    const log = end.logradouro || '';
    const num = end.numero ? `${end.numero}` : '';
    const comp = end.complemento || '';
    const bairro = end.bairro || '';
    const cidade = end.cidade || '';
    const uf = (end.estado || end.uf || '') ? String(end.estado || end.uf).toUpperCase() : '';
    const cep = end.cep ? `CEP: ${String(end.cep)}` : '';
    const linha1 = [log, num].filter(Boolean).join(', ');
    if (linha1) p.push(linha1);
    if (comp) p.push(comp);
    if (bairro) p.push(bairro);
    const cidadeUf = [cidade, uf].filter(Boolean).join(' - ');
    if (cidadeUf) p.push(cidadeUf);
    if (cep) p.push(cep);
    return p.join(' - ');
  }

  private normalizePeso(pet: any): number {
    const v = pet?.pesoKg ?? pet?.peso_kg ?? pet?.peso;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private normalizeIdade(pet: any): number {
    const v = pet?.idade ?? pet?.idadeAnos ?? pet?.idade_anos;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private normalizeAlergias(al: any): string[] {
    if (!al) return [];
    if (Array.isArray(al)) {
      return al
        .map((x: any) => typeof x === 'object' && x && 'nome' in x ? String(x.nome) : String(x))
        .map(s => s.trim())
        .filter(Boolean);
    }
    const s = String(al).trim();
    if (!s) return [];
    return s.includes(',') ? s.split(',').map(x => x.trim()).filter(Boolean) : [s];
  }

  private extractAlergiasToStrings(pet: any): string[] {
    const pre = pet?.alergias_predefinidas;
    if (Array.isArray(pre) && pre.length) {
      return pre
        .map((x: any) => (x && typeof x === 'object' ? x.nome : x))
        .map((s: any) => String(s).trim())
        .filter(Boolean);
    }
    return this.normalizeAlergias(pet?.alergias);
  }

  onCpfInput(): void {
    if (this.cpf.replace(/\D/g, '').length === 11) void this.buscarTutor();
  }

  limparBuscaTutor(): void {
    this.cpf = '';
    this.tutorEncontrado = null;
    this.petSelecionado = null;
    this.clienteIdSelecionado = null;
    this.cadastroManualTutor = false;
    this.novoTutor = { nome: '', cpf: '', telefone: '', email: '', endereco: '', pets: [] };
    this.form.petNomeManual = '';
  }

  async buscarTutor(): Promise<void> {
    this.carregandoTutor = true;
    this.tutorEncontrado = null;
    this.petSelecionado = null;
    this.cadastroManualTutor = false;
    this.clienteIdSelecionado = null;

    const cpfLimpo = this.cpf.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
      this.carregandoTutor = false;
      this.toastService.error('CPF inválido. Deve conter 11 dígitos.', 'Erro de Validação');
      return;
    }

    try {
      const token = this.getEffectiveToken();
      if (!token) {
        this.toastService.error('Token de autenticação não encontrado. Faça login novamente.', 'Erro de Autenticação');
        this.carregandoTutor = false;
        return;
      }

      const response = await this.apiService.buscarClienteComPets(cpfLimpo, token).toPromise();

      if (response && response.cliente) {
        this.ngZone.run(() => {
          const enderecoStr = this.formatarEndereco(response.endereco ?? response.cliente?.endereco);
          this.tutorEncontrado = {
            nome: response.cliente.nome || '',
            cpf: this.formatarCpf(response.cliente.cpf) || this.cpf,
            telefone: response.cliente.telefone || '',
            email: response.cliente.email || '',
            endereco: enderecoStr,
            pets: (response.pets || []).map((pet: any) => ({
              id: pet.id?.toString() || '',
              nome: pet.nome || '',
              especie: pet.especie || pet.tipo || '',
              idade: this.normalizeIdade(pet),
              peso: this.normalizePeso(pet),
              raca: pet.raca || '',
              sexo: pet.sexo || 'Macho',
              photoURL: this.petPhotoFromApiRow(pet),
              alergias: this.extractAlergiasToStrings(pet),
              alergias_predefinidas: Array.isArray(pet.alergias_predefinidas) ? pet.alergias_predefinidas : [],
              statusTutor: pet.statusTutor,
              cadastradoPorVet: pet.cadastradoPorVet,
            })),
          };
          this.clienteIdSelecionado = Number(response.cliente.id) || null;
          this.novoTutor.endereco = enderecoStr;
        });
        this.toastService.success(`Cliente ${response.cliente.nome} encontrado com sucesso!`, 'Sucesso');
      } else {
        this.ngZone.run(() => {
          this.cadastroManualTutor = true;
          this.novoTutor.cpf = this.cpf;
        });
        this.toastService.info('Cliente não encontrado. Por favor, preencha os dados manualmente.', 'Cliente não cadastrado');
      }
    } catch (error: any) {
      console.error('Erro ao buscar cliente:', error);
      if (error.status === 404) {
        this.ngZone.run(() => {
          this.cadastroManualTutor = true;
          this.novoTutor.cpf = this.cpf;
        });
        this.toastService.info('Cliente não encontrado. Por favor, preencha os dados manualmente.', 'Cliente não cadastrado');
      } else {
        const errorMessage = error.error?.message || error.message || 'Erro desconhecido ao buscar cliente';
        this.toastService.error(errorMessage, 'Erro ao buscar cliente');
      }
    } finally {
      this.carregandoTutor = false;
    }
  }

  selecionarPet(pet: WizardPet): void {
    this.petSelecionado = pet;
    this.form.petNomeManual = '';
  }

  get podeIniciarAtendimento(): boolean {
    if (this.tutorEncontrado) {
      if (this.petSelecionado) return true;
      if (!this.tutorEncontrado.pets?.length && this.form.petNomeManual.trim()) return true;
      return false;
    }
    if (this.cadastroManualTutor) {
      const cpfOk = this.novoTutor.cpf.replace(/\D/g, '').length === 11;
      return !!(
        this.novoTutor.nome?.trim() &&
        cpfOk &&
        this.form.petNomeManual.trim()
      );
    }
    return false;
  }

  // ── Etapa 1 ──────────────────────────────────────────────────────────────

  submitIdentificacao(): void {
    if (!this.podeIniciarAtendimento) return;

    if (this.tutorEncontrado && this.petSelecionado) {
      const cpfDigits = this.cpf.replace(/\D/g, '');
      this.wizardSvc.iniciar({
        tutorNome: this.tutorEncontrado.nome,
        tutorTelefone: this.tutorEncontrado.telefone,
        petNome: this.petSelecionado.nome,
        tipoAtendimento: this.form.tipoAtendimento,
        tutorCpf: cpfDigits,
        clienteId: this.clienteIdSelecionado,
        petId: this.petSelecionado.id || null,
      });
      return;
    }

    if (this.tutorEncontrado && !this.tutorEncontrado.pets?.length && this.form.petNomeManual.trim()) {
      const cpfDigits = this.cpf.replace(/\D/g, '');
      this.wizardSvc.iniciar({
        tutorNome: this.tutorEncontrado.nome,
        tutorTelefone: this.tutorEncontrado.telefone,
        petNome: this.form.petNomeManual.trim(),
        tipoAtendimento: this.form.tipoAtendimento,
        tutorCpf: cpfDigits,
        clienteId: this.clienteIdSelecionado,
        petId: null,
      });
      return;
    }

    if (this.cadastroManualTutor) {
      const cpfDigits = this.novoTutor.cpf.replace(/\D/g, '');
      this.wizardSvc.iniciar({
        tutorNome: this.novoTutor.nome.trim(),
        tutorTelefone: this.novoTutor.telefone.trim(),
        petNome: this.form.petNomeManual.trim(),
        tipoAtendimento: this.form.tipoAtendimento,
        tutorCpf: cpfDigits,
        clienteId: null,
        petId: null,
      });
    }
  }

  // ── Etapa 2 — clínica já realizada ───────────────────────────────────────

  clinicaConcluida(): void {
    this.wizardSvc.avancar('finalizacao-clinica');
  }

  // ── Etapa 3 ──────────────────────────────────────────────────────────────

  get checklistOk(): boolean {
    return this.checklist.anamnese && this.checklist.diagnostico;
  }

  submitFinalizacao(): void {
    this.wizardSvc.avancar('decisao');
  }

  // ── Etapa 4 ──────────────────────────────────────────────────────────────

  submitDecisao(): void {
    if (!this.decisao) return;
    this.wizardSvc.avancar(
      this.decisao === 'encerrar' ? 'ia' : 'operacao',
      { decisaoOperacional: this.decisao },
    );
  }

  // ── Etapa 5 ──────────────────────────────────────────────────────────────

  operacaoConcluida(): void {
    this.wizardSvc.avancar('ia');
  }

  // ── Etapa 6 / Conclusão ──────────────────────────────────────────────────

  concluir(): void {
    this.wizardSvc.encerrar();
    this.router.navigate(['/parceiros/vet-cockpit']);
  }
}
