import { Component, OnInit, ViewChild, ElementRef, NgZone, AfterViewInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxMaskDirective, provideNgxMask } from 'ngx-mask';
import { ApiService, AlergiaLookup, CriarAtendimentoPayload } from '../../../../services/api.service';
import { AuthService } from '../../../../services/auth.service';
import { ParceiroAuthService } from '../../../../services/parceiro-auth.service';
import { ToastService } from '../../../../services/toast.service';
import { debounce, slice } from 'lodash-es';
import jsPDF from 'jspdf';
import { jwtDecode } from "jwt-decode";
import html2canvas from 'html2canvas';
import { isPlatformBrowser } from '@angular/common';
import { Inject, PLATFORM_ID } from '@angular/core'
import { ChangeDetectorRef } from '@angular/core'
import { NavmenuComponent } from '../../../../navmenu/navmenu.component';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MARCA_LOGO_PATH, MARCA_NOME } from '../../../../constants/loja-public';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';





interface Tutor {
  nome: string;
  cpf: string;
  telefone: string;
  email: string;
  endereco: string;
  pets: Pet[];
}

interface Pet {
  id?: string;
  nome: string;
  especie: string;
  idade: number;
  peso: number;
  raca: string;
  sexo: 'Macho' | 'Fêmea';
  alergias?: string[];
  alergias_predefinidas?: Array<{ nome: string; alergia_id: number | null; ativo_id: number | null; observacoes?: string | null }>;
}

interface Ativo {
  id: string;
  nome: string;
  descricao: string;
  doseCaes: string;
  doseGatos: string;
  letra?: string;
}

interface Veterinario {
  id: string;
  nome: string;
  cpf: string;
  email: string;
  crmv: string;
}

interface AtendimentoExame {
  nome: string;
  status: string;
  observacoes: string;
}

interface AtendimentoFoto {
  descricao: string;
  base64: string;
  nomeArquivo: string;
}


@Component({
  selector: 'app-gerar-receita',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxMaskDirective,NavmenuComponent],
  providers: [provideNgxMask()],
  templateUrl: './gerar-receita.component.html',
  styleUrls: ['./gerar-receita.component.scss']
})
export class GerarReceitaComponent implements OnInit, AfterViewInit {
  /** Quando true, a página roda dentro do shell `/parceiros/*` (sem menu do site). */
  embedInParceiroShell = false;

  readonly marcaNome = MARCA_NOME;
  readonly marcaLogoPath = MARCA_LOGO_PATH;
  @ViewChild('pdfContent') pdfContent!: ElementRef;
  cpf = '';
  tutorEncontrado: Tutor | null = null;
  cadastroManualTutor = false;
  novoTutor: Tutor = { nome: '', cpf: '', telefone: '', email: '', endereco: '', pets: [] };

  petSelecionado: Pet | null = null;
  novosDadosPet: Pet = { nome: '', idade: 0, peso: 0, raca: '', sexo: 'Macho', alergias: [], especie:'' };
  private originalPetSnapshot: Pet | null = null;
  observacoes = '';
  queixaPrincipal = '';
  anamnese = '';
  exameFisico = '';
  diagnostico = '';
  planoTerapeutico = '';
  examesSolicitados: AtendimentoExame[] = [{ nome: '', status: 'solicitado', observacoes: '' }];
  fotosAtendimento: AtendimentoFoto[] = [];
  /** Retorno: notificar tutor na conta PetSphere e por e-mail. */
  retornoNotificarCliente = false;
  retornoData = '';
  retornoMensagemTutor = '';
  veterinario: any;
isBrowser: any;
  ativos: Ativo[] = [];
  alfabetico: { letra: string; ativos: Ativo[] }[] = [];
  ativosSelecionados: string[] = [];
  ativosColapsados = false;
  ativosSearch = '';
  carregandoAtivos = false;
  gruposColapsados = new Set<string>();
  showAllAtivos = false;
  private highlightTerm = '';
  // Sinaliza se houve confirmação de inclusão de ativo com alergia
  alerta_alergia = false;
  // Modal de alerta de alergia
  showAlergiaModal = false;
  private pendingAtivoId: string | null = null;

  assinaturaManual = '';
  assinaturaCursiva = '';
  assinaturaICP = '';
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fsCanvas') fsCanvasRef!: ElementRef<HTMLCanvasElement>;
  private ctx?: CanvasRenderingContext2D | null;
  private fsCtx?: CanvasRenderingContext2D | null;
  private fsSnapshotUrl: string | null = null;
  private isDrawing = false;
  private lastX = 0;
  private lastY = 0;
  // Show/hide controle para o canvas de assinatura
  showSignatureCanvas = false;
  showSignatureFullscreen = false;
  isMobile = false;
  alergiaInput: string = '';

  // Guided Tour (balões flutuantes)
  showTour = false;
  tourIndex = 0;
  tourPopoverStyle: any = {};
  tourHighlightStyle: any = {};
  tourSteps: Array<{ id: string; title: string; text: string; position?: 'top'|'right'|'bottom'|'left' }>= [
    { id: 'cpfInput', title: 'Identificação na recepção', text: 'Informe o CPF do tutor (responsável legal) — o mesmo que você usaria no balcão.', position: 'bottom' },
    { id: 'buscarBtn', title: 'Buscar cadastro', text: 'Carrega dados já existentes na plataforma, quando o tutor já é cliente.', position: 'right' },
    { id: 'dadosTutor', title: 'Tutor localizado', text: 'Confira nome e contato antes de seguir para o paciente.', position: 'bottom' },
    { id: 'listaPets', title: 'Paciente da consulta', text: 'Selecione o animal atendido ou preencha os dados como primeiro atendimento.', position: 'bottom' },
    { id: 'dadosPet', title: 'Ficha do paciente', text: 'Peso, idade e alergias importam para dose e segurança da prescrição.', position: 'bottom' },
    { id: 'alergiasVet', title: 'Alergias conhecidas', text: 'Registre alergias medicamentosas para alertas ao prescrever.', position: 'bottom' },
    { id: 'passo-retorno', title: 'Retorno', text: 'Opcional: informe data e avise o tutor — ele recebe alerta na conta e por e-mail.', position: 'bottom' },
    { id: 'ativosCard', title: 'Prescrição', text: 'Escolha os princípios ativos conforme a conduta clínica.', position: 'top' },
    { id: 'btnExibirTodosAtivos', title: 'Guia de medicamentos', text: 'Pesquise por nome ou expanda a lista completa do guia.', position: 'left' },
    { id: 'assinaturaSec', title: 'Assinatura', text: 'Assinatura opcional no canvas; o documento segue com os dados do profissional.', position: 'top' },
    { id: 'salvarReceitaBtn', title: 'Encerrar atendimento', text: 'Salva prontuário e receita — equivalente a arquivar a consulta.', position: 'top' },
  ];

  carregandoTutor = false;
  private debouncedFiltrarAtivos: () => void;
  // Scroll lock state for guided tour
  private bodyScrollY = 0;
  // Handlers to prevent user-initiated scrolling while allowing programmatic scrollIntoView
  private _preventScroll = (ev: Event) => { try { ev.preventDefault(); } catch {} };
  private _preventKeyScroll = (ev: KeyboardEvent) => {
    const keys = new Set([' ', 'Spacebar', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown']);
    if (keys.has(ev.key)) { try { ev.preventDefault(); } catch {} }
  };
  // Item predefinido "Outras" para mapeamento de legados
  private outraPredefinida: AlergiaLookup | null = null;
  // Vet-side alergias search-select state
  alergiaBuscaVet: string = '';
  sugestoesVet: AlergiaLookup[] = [];
  showSugestoesVet = false;
  alergiasSelecionadasVet: AlergiaLookup[] = [];

  // Controle de cliente/pet
  clienteIdSelecionado: number | null = null;
  showPetEditModal = false;
  petSavePlan: 'novo' | 'editar' | null = null;
  // Exibe o modal de decisão apenas uma vez por sessão de edição/seleção
  private petEditPromptShown = false;

  constructor(
    private apiService: ApiService,
    private toastService: ToastService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
  @Inject(PLATFORM_ID) private platformId: Object,
  private sanitizer: DomSanitizer,
  private authService: AuthService,
  private parceiroAuth: ParceiroAuthService,
  private router: Router,
    ) {
    this.debouncedFiltrarAtivos = debounce(this.filtrarAtivos.bind(this), 250);
    this.syncParceiroShellContext();
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.syncParceiroShellContext());
  }

  private syncParceiroShellContext(): void {
    this.embedInParceiroShell = this.router.url.includes('/parceiros/');
  }

  /** Data mínima (hoje) para o campo de retorno. */
  get minDataRetorno(): string {
    if (!isPlatformBrowser(this.platformId)) return '';
    const d = new Date();
    return d.toISOString().slice(0, 10);
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

  ngOnInit(): void { 
    this.isBrowser = isPlatformBrowser(this.platformId);
    if (isPlatformBrowser(this.platformId)) {
      // Detecta mobile por largura (heurística simples) logo no início
      this.isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
      // Atualiza em redimensionamento
      window.addEventListener('resize', this._onResizeUpdateMobile);
      this.loadAtivos();
      this.carregarVeterinario();
    }
  }

  private _onResizeUpdateMobile = () => {
    if (!isPlatformBrowser(this.platformId)) return;
    this.isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  }

  async carregarVeterinario() {
    if (!isPlatformBrowser(this.platformId)) return;
    const token = this.getEffectiveToken();
    if (!token) {
      // no token available (shouldn't happen if partner shell protects route)
      console.warn('Nenhum token disponível para carregar veterinário');
      return;
    }

    try {
      const decoded: any = jwtDecode(token);
      const role = decoded?.tipo || decoded?.role;
      if (decoded?.id && (role === 'vet' || role === 'veterinario' || role === undefined)) {
        const vetId = decoded.id;
        const response = await this.apiService.getVeterinario(vetId, token).toPromise();
        this.veterinario = response;
      } else {
        // Partner token: populate basic collaborator info if available
        const colaborador = this.parceiroAuth.getCurrentColaborador();
        if (colaborador) {
          this.veterinario = {
            id: String(colaborador.id),
            nome: colaborador.nome,
            cpf: '',
            crmv: '',
            email: colaborador.email,
            tipo: 'parceiro',
            approved: true
          } as any;
        }
      }
    } catch (error) {
      console.error(error);
    }
  }

  getPetSexoAbreviado(pet: Pet | null) {
    if (!pet) return '';
    return pet.sexo === 'Macho' ? 'M' : pet.sexo === 'Fêmea' ? 'F' : '';
  }

  onCpfInput() { if (this.cpf.replace(/\D/g, '').length === 11) this.buscarTutor(); }

  async buscarTutor() {
    this.carregandoTutor = true;
    this.tutorEncontrado = null;
    this.petSelecionado = null;
    this.cadastroManualTutor = false;

    // Validação básica de CPF
    const cpfLimpo = this.cpf.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) {
      this.carregandoTutor = false;
      this.toastService.error('CPF inválido. Deve conter 11 dígitos.', 'Erro de Validação');
      return;
    }

    try {
      // Obter token efetivo (vet ou parceiro)
      const token = this.getEffectiveToken();
      if (!token) {
        this.toastService.error('Token de autenticação não encontrado. Faça login novamente.', 'Erro de Autenticação');
        this.carregandoTutor = false;
        return;
      }

      // Buscar cliente e pets no backend
  const response = await this.apiService.buscarClienteComPets(cpfLimpo, token).toPromise();
      
      if (response && response.cliente) {
        this.ngZone.run(() => {
          const enderecoStr = this.formatarEndereco(response.endereco ?? response.cliente?.endereco);
          // Mapear os dados do backend para o formato esperado
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
              alergias: this.extractAlergiasToStrings(pet),
              alergias_predefinidas: Array.isArray(pet.alergias_predefinidas) ? pet.alergias_predefinidas : []
            }))
          };
          this.clienteIdSelecionado = Number(response.cliente.id) || null;
        });
        // Fallback: também preenche o campo de endereço do cadastro manual
  const teAddr = (this.tutorEncontrado as Tutor | null)?.endereco || '';
  this.novoTutor.endereco = teAddr;
        // Não auto-seleciona pet; usuário escolhe manualmente
        this.toastService.success(`Cliente ${response.cliente.nome} encontrado com sucesso!`, 'Sucesso');
        this.cdr.detectChanges();
      } else {
        // Cliente não encontrado - habilitar cadastro manual
        this.ngZone.run(() => {
          this.cadastroManualTutor = true;
          this.novoTutor.cpf = this.cpf;
        });
        this.toastService.info('Cliente não encontrado. Por favor, preencha os dados manualmente.', 'Cliente não cadastrado');
      }
    } catch (error: any) {
      console.error('Erro ao buscar cliente:', error);
      
      // Se for erro 404, habilitar cadastro manual
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

  // Método auxiliar para formatar CPF
  formatarCpf(cpf: string): string {
    if (!cpf) return '';
    const cpfLimpo = cpf.replace(/\D/g, '');
    if (cpfLimpo.length !== 11) return cpf;
    return cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  // Método auxiliar para formatar endereço vindo do backend
  private formatarEndereco(end: any): string {
    if (!end) return '';
    if (typeof end === 'string') return end;
    // objeto: montar com as partes disponíveis (hífen entre blocos)
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

  // Normalizadores de dados de pets (peso/idade/alergias)
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
    // Legacy helper: keeps ability to parse a plain field into string[] if needed
    if (!al) return [];
    if (Array.isArray(al)) {
      // could be array of strings or array of objects
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
    // Prefer predefined array when present
    const pre = pet?.alergias_predefinidas;
    if (Array.isArray(pre) && pre.length) {
      return pre
        .map((x: any) => (x && typeof x === 'object' ? x.nome : x))
        .map((s: any) => String(s).trim())
        .filter(Boolean);
    }
    // Fallback to legacy field
    return this.normalizeAlergias(pet?.alergias);
  }

  isPetPendente(p: any): boolean {
    return p && (p.statusTutor === 'pendente' || p.cadastradoPorVet === true);
  }

  // --- Fluxo de salvar alterações do pet ---
  hasPetChanges(): boolean {
    if (!this.originalPetSnapshot) return false;
    const a = this.originalPetSnapshot;
    const b = this.novosDadosPet;
    const sameArr = (x?: string[], y?: string[]) => JSON.stringify((x||[]).slice().sort()) === JSON.stringify((y||[]).slice().sort());
    return (
      a.nome !== b.nome ||
      a.especie !== b.especie ||
      a.idade !== b.idade ||
      a.peso !== b.peso ||
      a.raca !== b.raca ||
      a.sexo !== b.sexo ||
      !sameArr(a.alergias, b.alergias)
    );
  }

  onPetFieldChange(){
    if (!this.petEditPromptShown && this.hasPetChanges()) {
      this.showPetEditModal = true;
      this.petEditPromptShown = true;
    }
  }

  abrirModalEditarPet(){
    if (!this.petSelecionado) return;
    if (!this.hasPetChanges()) { this.toastService.info('Nenhuma alteração no pet para salvar.'); return; }
    this.showPetEditModal = true;
  }

  fecharModalEditarPet(){ this.showPetEditModal = false; this.petEditPromptShown = true; }

  cancelarAlteracoesPet(){
    if (this.originalPetSnapshot) {
      this.novosDadosPet = JSON.parse(JSON.stringify(this.originalPetSnapshot));
    }
    this.showPetEditModal = false;
    // Como voltamos ao estado original, uma próxima edição deve reabrir o modal na primeira mudança
    this.petEditPromptShown = false;
  }

  async onEscolhaEdicaoPet(acao: 'novo'|'editar'|'cancelar'){
    if (acao === 'cancelar') { this.showPetEditModal = false; return; }
    // Apenas marca o plano; não chama a API agora
    if (acao === 'novo') this.petSavePlan = 'novo';
    if (acao === 'editar') this.petSavePlan = 'editar';
    this.toastService.info('As alterações do pet serão salvas ao salvar a receita.');
    this.showPetEditModal = false;
    this.cdr.detectChanges();
  }

  private buildPetFormData(pet: Pet, cadastradoPorVet: boolean){
    const fd = new FormData();
    fd.append('nome', pet.nome || '');
    fd.append('especie', pet.especie || '');
    fd.append('raca', pet.raca || '');
    fd.append('sexo', pet.sexo || 'Macho');
    fd.append('idade', String(pet.idade ?? 0));
    // backend espera pesoKg
    fd.append('pesoKg', String(pet.peso ?? 0));
    // Flags para identificar operação iniciada pelo veterinário
    fd.append('salvamento_pet_pelo_vet', 'true');
    if (this.clienteIdSelecionado != null) {
      fd.append('tutor_id', String(this.clienteIdSelecionado));
    }
    if (this.veterinario?.id) {
      fd.append('salvo_vet_id', String(this.veterinario.id));
    }
    // Tutor ainda não aceitou estas alterações
    fd.append('aceito_tutor', '0');
    // alergias_predefinidas será anexado no momento da chamada (create/update), após resolver as strings
    // Flags de controle para o backend implementar aceitação do tutor
    fd.append('cadastradoPorVet', String(!!cadastradoPorVet));
    if (cadastradoPorVet) {
      fd.append('statusTutor', 'pendente');
    } else {
      // Edição feita pelo vet
      fd.append('editadoPorVet', 'true');
      fd.append('statusTutor', 'pendente');
    }
    return fd;
  }

  selecionarPet(pet: Pet) {
    this.petSelecionado = pet;
    // guarda snapshot para poder cancelar
    this.originalPetSnapshot = JSON.parse(JSON.stringify(pet));
    this.novosDadosPet = JSON.parse(JSON.stringify(pet));
    // Inicializa o search-select com as predefinidas atuais do pet (se houver)
    this.alergiasSelecionadasVet = Array.isArray(pet.alergias_predefinidas)
      ? pet.alergias_predefinidas.map((x: any) => ({
          nome: String(x?.nome ?? '').trim(),
          alergia_id: x?.alergia_id ?? null,
          ativo_id: x?.ativo_id ?? null
        }))
        .filter(x => x.nome)
      : [];
    // Mantém a lista de nomes em sincronismo para exibição rápida
    this.novosDadosPet.alergias = this.alergiasSelecionadasVet.map(x => x.nome);
    // Nova sessão de edição para este pet: permitir que o modal apareça na primeira mudança
    this.petEditPromptShown = false;
    // Resetar plano pendente ao trocar de pet
    this.petSavePlan = null;
  }

  async loadAtivos() {
    this.carregandoAtivos = true;
    try {
      const ativosFromApi = await this.apiService.getAtivos().toPromise();
      this.ativos = ativosFromApi || [];
    } catch {
      this.ativos = [
        { id: '1', nome: 'Dipirona', descricao: 'Analgésico', doseCaes: '20mg/kg', doseGatos: '10mg/kg' },
        { id: '2', nome: 'Ivermectina', descricao: 'Antiparasitário', doseCaes: '0,2mg/kg', doseGatos: '—' },
        { id: '3', nome: 'Doxiciclina', descricao: 'Antibiótico', doseCaes: '5mg/kg', doseGatos: '5mg/kg' }
      ];
    } finally {
      // Respeita a regra: lista oculta até pesquisar, a menos que o usuário opte por exibir todos
      this.filtrarAtivos();
      this.carregandoAtivos = false;
    }
  }

  organizarAtivos() {
    const grupos: Record<string, Ativo[]> = {};
    this.ativos.forEach(a => {
      const letra = (a.nome?.charAt(0) || '#').toUpperCase();
      a.letra = letra;
      if (!grupos[letra]) grupos[letra] = [];
      grupos[letra].push(a);
    });
    this.alfabetico = Object.keys(grupos).sort().map(l => ({ letra: l, ativos: grupos[l] }));
  }

  filtrarAtivos() {
    const termo = this.ativosSearch.trim().toLowerCase();
    this.highlightTerm = termo;
    if (!termo) {
      if (!this.showAllAtivos) {
        this.alfabetico = [];
        return;
      }
      return this.organizarAtivos();
    }
    const res = this.ativos.filter(a => a.nome.toLowerCase().includes(termo) || a.descricao.toLowerCase().includes(termo));
    const grupos: Record<string, Ativo[]> = {};
    res.forEach(a => {
      const letra = (a.nome[0] || '#').toUpperCase();
      if (!grupos[letra]) grupos[letra] = [];
      grupos[letra].push(a);
    });
    this.alfabetico = Object.keys(grupos).sort().map(l => ({ letra: l, ativos: grupos[l] }));
  }

  onAtivosSearchChange() { this.debouncedFiltrarAtivos(); }

  toggleGrupo(letra: string) { this.gruposColapsados.has(letra) ? this.gruposColapsados.delete(letra) : this.gruposColapsados.add(letra); }
  isGrupoColapsado(letra: string) { return this.gruposColapsados.has(letra); }

  toggleTodosAtivos() {
    this.showAllAtivos = !this.showAllAtivos;
    if (this.showAllAtivos) {
      this.organizarAtivos();
    } else {
      if (!this.ativosSearch.trim()) this.alfabetico = [];
    }
  }

  toggleAtivo(id: string) {
    const jaSelecionado = this.ativosSelecionados.includes(id);
    if (jaSelecionado) {
      this.ativosSelecionados = this.ativosSelecionados.filter(x => x !== id);
      return;
    }
    // Se não está selecionado, verifica alergias do pet
    if (this.isAtivoAlergenoParaPet(id)) {
      // Abre modal in-page para confirmar inclusão
      this.pendingAtivoId = id;
      this.showAlergiaModal = true;
      return;
    }
    this.ativosSelecionados.push(id);
  }

  trackByPet(index: number, pet: Pet) { return pet.id ?? pet.nome ?? `${index}`; }
  trackByAtivo(index: number, ativo: Ativo) { return ativo.id; }

  ngAfterViewInit() { 
    if (isPlatformBrowser(this.platformId) && this.showSignatureCanvas) {
      this.initCanvas();
    }
  }

  // --- Guided Tour methods ---
  startTour() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.showTour = true;
    this.tourIndex = 0;
    // Bind listeners to keep popover aligned
    window.addEventListener('resize', this._onRescroll);
    window.addEventListener('scroll', this._onRescroll, true);
    // Kick off layout after a tick
    setTimeout(() => { this._focusCurrentStep(); this._lockScroll(); });
  }

  nextTour() {
    if (!this.showTour) return;
    const i = this.tourIndex + 1;
    if (i >= this.tourSteps.length) { this.endTour(); return; }
    this.tourIndex = i;
    this._focusCurrentStep();
  }

  prevTour() {
    if (!this.showTour) return;
    const i = this.tourIndex - 1;
    this.tourIndex = Math.max(0, i);
    this._focusCurrentStep();
  }

  endTour() {
    this.showTour = false;
    this.tourIndex = 0;
    this.tourPopoverStyle = {};
    this.tourHighlightStyle = {};
    window.removeEventListener('resize', this._onRescroll);
    window.removeEventListener('scroll', this._onRescroll, true);
    this._unlockScroll();
  }

  private _onRescroll = () => {
    if (!this.showTour) return;
    this._positionCurrentStep(false);
  }

  private _focusCurrentStep() {
    const step = this.tourSteps[this.tourIndex];
    if (!step) return;
    const el = document.getElementById(step.id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
    setTimeout(() => this._positionCurrentStep(!!el), 250);
  }

  private _positionCurrentStep(withHighlight: boolean) {
    const step = this.tourSteps[this.tourIndex];
    if (!step) return;
    const el = document.getElementById(step.id);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxWidth = Math.min(340, vw - 24);
    if (!el) {
      // Fallback: centraliza o popover e esconde o highlight
      this.tourHighlightStyle = { display: 'none' } as any;
      // Tenta medir o tamanho real do popover para centralizar exatamente em mobile
      const pop = document.querySelector('.tour-popover') as HTMLElement | null;
      const popW = Math.min(pop?.offsetWidth || maxWidth, maxWidth);
      const popH = pop?.offsetHeight || 180;
      const left = Math.max(12, Math.round((vw - popW) / 2));
      const top = Math.max(12, Math.round((vh - popH) / 2));
      this.tourPopoverStyle = { top: `${top}px`, left: `${left}px`, maxWidth: `${maxWidth}px` };
      return;
    }
    const rect = el.getBoundingClientRect();
    const margin = 6;
    // Highlight box (position: fixed)
    if (withHighlight) {
      this.tourHighlightStyle = {
        top: `${Math.max(8, rect.top - margin)}px`,
        left: `${Math.max(8, rect.left - margin)}px`,
        width: `${Math.max(0, rect.width + margin * 2)}px`,
        height: `${Math.max(0, rect.height + margin * 2)}px`,
      };
    }

    // Popover placement with viewport fit
    const pop = document.querySelector('.tour-popover') as HTMLElement | null;
    const popW = Math.min(pop?.offsetWidth || maxWidth, maxWidth);
    const popH = pop?.offsetHeight || 180;
    const gap = 10;
    const marginOuter = 12;
    const prefer = step.position || 'bottom';
    const orders: Record<string, Array<'bottom'|'top'|'right'|'left'>> = {
      bottom: ['bottom', 'top', 'right', 'left'],
      top: ['top', 'bottom', 'right', 'left'],
      right: ['right', 'bottom', 'top', 'left'],
      left: ['left', 'bottom', 'top', 'right']
    };
  const tryOrder = orders[prefer] || orders['bottom'];

    let finalTop = 0;
    let finalLeft = 0;
    let placed = false;

    for (const pos of tryOrder) {
      let top = 0, left = 0;
      if (pos === 'bottom') { top = rect.bottom + gap; left = rect.left; }
      if (pos === 'top') { top = rect.top - gap - popH; left = rect.left; }
      if (pos === 'right') { top = rect.top; left = rect.right + gap; }
      if (pos === 'left') { top = rect.top; left = rect.left - gap - popW; }

      // Clamp horizontally within viewport margins
      left = Math.min(Math.max(marginOuter, left), vw - popW - marginOuter);
      // Clamp vertically within viewport margins
      top = Math.min(Math.max(marginOuter, top), vh - popH - marginOuter);

      // Check fit
      const fitsH = left >= marginOuter && left + popW <= vw - marginOuter;
      const fitsV = top >= marginOuter && top + popH <= vh - marginOuter;
      if (fitsH && fitsV) {
        finalTop = top; finalLeft = left; placed = true; break;
      }
    }

    if (!placed) {
      // As a last resort, anchor below and clamp
      finalLeft = Math.min(Math.max(marginOuter, rect.left), vw - popW - marginOuter);
      finalTop = Math.min(Math.max(marginOuter, rect.bottom + gap), vh - popH - marginOuter);
    }

    this.tourPopoverStyle = {
      top: `${finalTop}px`,
      left: `${finalLeft}px`,
      maxWidth: `${maxWidth}px`,
    };
  }

  private _lockScroll() {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      // Prevent user-initiated scrolling (wheel/touch/keys) but allow programmatic scrollIntoView
      document.addEventListener('wheel', this._preventScroll, { passive: false, capture: true } as any);
      document.addEventListener('touchmove', this._preventScroll, { passive: false, capture: true } as any);
      document.addEventListener('keydown', this._preventKeyScroll, { passive: false, capture: true } as any);
    } catch {}
  }

  private _unlockScroll() {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      document.removeEventListener('wheel', this._preventScroll, true);
      document.removeEventListener('touchmove', this._preventScroll, true);
      document.removeEventListener('keydown', this._preventKeyScroll, true);
    } catch {}
  }

  initCanvas() {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.canvasRef || !this.canvasRef.nativeElement) return;
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d');
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * ratio;
    canvas.height = canvas.clientHeight * ratio;
    if (this.ctx) { this.ctx.scale(ratio, ratio); this.ctx.lineCap = 'round'; this.ctx.lineJoin = 'round'; this.ctx.lineWidth = 2.4; this.ctx.strokeStyle = '#000'; this.ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  toggleSignatureCanvas() {
    this.showSignatureCanvas = !this.showSignatureCanvas;
    if (this.showSignatureCanvas) {
      // Aguarda renderização do canvas antes de inicializar
      setTimeout(() => this.initCanvas());
    }
  }

  canvasPointerDown(ev: PointerEvent) { this.isDrawing = true; this.setLast(ev); }
  canvasPointerMove(ev: PointerEvent) { if (this.isDrawing) this.draw(ev); }
  canvasPointerUp() { this.isDrawing = false; }

  private setLast(ev: PointerEvent) {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    this.lastX = ev.clientX - rect.left;
    this.lastY = ev.clientY - rect.top;
  }

  private draw(ev: PointerEvent) {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    if (!this.ctx) return;
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
    this.lastX = x;
    this.lastY = y;
  }

  // --- Assinatura em tela cheia ---
  abrirAssinaturaFullscreen() {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.isMobile) return; // fullscreen apenas no celular
    // Captura a assinatura atual (se existir) para popular o FS
    try { this.fsSnapshotUrl = this.canvasRef?.nativeElement?.toDataURL('image/png') || null; } catch { this.fsSnapshotUrl = null; }
    this.showSignatureFullscreen = true;
    window.addEventListener('resize', this._onFsResize, { passive: true } as any);
    setTimeout(() => this.initFsCanvas(), 0);
  }

  private initFsCanvas() {
    if (!this.fsCanvasRef) return;
    const canvas = this.fsCanvasRef.nativeElement;
    this.fsCtx = canvas.getContext('2d');
    // Ajusta o canvas para ocupar quase toda a tela, respeitando padding do container
    const ratio = window.devicePixelRatio || 1;
    const parent = canvas.parentElement as HTMLElement;
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    if (this.fsCtx) {
      this.fsCtx.scale(ratio, ratio);
      this.fsCtx.lineCap = 'round';
      this.fsCtx.lineJoin = 'round';
      this.fsCtx.lineWidth = 2.8;
      this.fsCtx.strokeStyle = '#000';
      this.fsCtx.clearRect(0, 0, canvas.width, canvas.height);
      // Se há uma assinatura prévia, desenha no FS sem rotação (letterbox)
      if (this.fsSnapshotUrl) {
        const img = new Image();
        img.onload = () => {
          const ctx = this.fsCtx!;
          const targetW = canvas.clientWidth;
          const targetH = canvas.clientHeight;
          const srcW = img.width;
          const srcH = img.height;
          const srcRatio = srcW / srcH;
          const dstRatio = targetW / targetH;
          let drawW = targetW, drawH = targetH;
          if (srcRatio > dstRatio) { drawW = targetW; drawH = Math.round(targetW / srcRatio); }
          else { drawH = targetH; drawW = Math.round(targetH * srcRatio); }
          const dx = Math.round((targetW - drawW) / 2);
          const dy = Math.round((targetH - drawH) / 2);
          ctx.clearRect(0, 0, targetW, targetH);
          ctx.drawImage(img, dx, dy, drawW, drawH);
        };
        img.src = this.fsSnapshotUrl;
      }
    }
  }

  fsPointerDown(ev: PointerEvent) { this.isDrawing = true; this.setFsLast(ev); }
  fsPointerMove(ev: PointerEvent) { if (this.isDrawing) this.drawFs(ev); }
  fsPointerUp() { this.isDrawing = false; }

  private setFsLast(ev: PointerEvent) {
    const rect = this.fsCanvasRef.nativeElement.getBoundingClientRect();
    this.lastX = ev.clientX - rect.left;
    this.lastY = ev.clientY - rect.top;
  }
  private drawFs(ev: PointerEvent) {
    const rect = this.fsCanvasRef.nativeElement.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    if (!this.fsCtx) return;
    this.fsCtx.beginPath();
    this.fsCtx.moveTo(this.lastX, this.lastY);
    this.fsCtx.lineTo(x, y);
    this.fsCtx.stroke();
    this.lastX = x;
    this.lastY = y;
  }

  limparFsCanvas() {
    if (!this.fsCtx || !this.fsCanvasRef) return;
    const canvas = this.fsCanvasRef.nativeElement;
    this.fsCtx.clearRect(0, 0, canvas.width, canvas.height);
  }

  cancelarAssinaturaFullscreen() {
    this.showSignatureFullscreen = false;
    window.removeEventListener('resize', this._onFsResize as any);
    this.fsSnapshotUrl = null;
  }

  confirmarAssinaturaFullscreen() {
    // Copia o desenho do fullscreen para o canvas principal
    if (!isPlatformBrowser(this.platformId)) { this.showSignatureFullscreen = false; return; }
    const fsCanvas = this.fsCanvasRef?.nativeElement;
    if (!fsCanvas) { this.showSignatureFullscreen = false; return; }
    if (!this.showSignatureCanvas) this.showSignatureCanvas = true;
    setTimeout(() => {
      this.initCanvas();
      const mainCanvas = this.canvasRef?.nativeElement;
      if (!mainCanvas || !this.ctx) { this.showSignatureFullscreen = false; return; }
      // Transfere do canvas fullscreen rotacionando 90° para caber no campo vertical, preservando aspecto
      const ctx = this.ctx!;
      const ratio = window.devicePixelRatio || 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(ratio, ratio);
      ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);

      const targetW = mainCanvas.clientWidth;
      const targetH = mainCanvas.clientHeight;
      // Trabalhar em CSS px para consistência com layout
      const srcCssW = fsCanvas.clientWidth || (fsCanvas.width / ratio);
      const srcCssH = fsCanvas.clientHeight || (fsCanvas.height / ratio);
      // Após rotacionar 90°, o conteúdo terá largura=srcCssH*s e altura=srcCssW*s
      const scaleX = targetH / srcCssW;
      const scaleY = targetW / srcCssH;
      const s = Math.min(scaleX, scaleY);
      const drawW = srcCssW * s; // largura antes da rotação
      const drawH = srcCssH * s; // altura antes da rotação
      // Centralização após rotação: ocupa drawH x drawW
      const offsetX = (targetW - drawH) / 2;
      const offsetY = (targetH - drawW) / 2;

      ctx.save();
      // Translada para o centro do retângulo onde a imagem rotacionada ficará
      ctx.translate(offsetX + drawH / 2, offsetY + drawW / 2);
      // Rotaciona 90 graus sentido horário
      ctx.rotate(Math.PI / 2);
      // Desenha o fsCanvas centralizado considerando o tamanho antes da rotação
      ctx.drawImage(fsCanvas, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
      this.showSignatureFullscreen = false;
      window.removeEventListener('resize', this._onFsResize as any);
      this.fsSnapshotUrl = null;
    }, 0);
  }

  private _onFsResize = () => {
    if (this.showSignatureFullscreen) {
      this.initFsCanvas();
    }
  }

  // --- Alergias como badges (chips) ---
  alergiasList(): string[] {
    // Exibir sempre o estado em edição (novosDadosPet), para refletir alterações imediatamente
    const src = this.novosDadosPet.alergias ?? [];
    return (src as string[]).map(s => String(s).trim()).filter(Boolean);
  }

  addAlergiaChip() {
    const raw = (this.alergiaInput || '').trim();
    if (!raw) return;
    // Suporta múltiplas separadas por vírgula
    const incoming = raw.split(',').map(s => s.trim()).filter(Boolean);
    const current = this.alergiasList();
    const existingLc = new Set(current.map(s => s.toLowerCase()));
    const merged = [...current];
    incoming.forEach(item => {
      const lc = item.toLowerCase();
      if (!existingLc.has(lc)) {
        merged.push(item);
        existingLc.add(lc);
      }
    });
    this.setAlergiasFromList(merged);
    this.alergiaInput = '';
  }

  removeAlergiaChip(idx: number) {
    const list = this.alergiasList();
    list.splice(idx, 1);
    this.setAlergiasFromList(list);
  }

  private setAlergiasFromList(list: string[]) {
    const arr = [...list];
    this.novosDadosPet.alergias = arr;
    this.onPetFieldChange();
  }

  limparAssinaturaCanvas() {
    if (!this.ctx) return;
    const canvas = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.assinaturaICP = '';
  }

  gerarAssinaturaCursiva(nome: string) {
    if (!this.ctx) return;
    const canvas = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.ctx.font = `${Math.min(36, canvas.height/2)}px "Segoe Script", cursive`;
    this.ctx.fillStyle = '#000';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(nome, 10, canvas.height/2);
    this.assinaturaCursiva = nome;
    this.assinaturaICP = `icp-mock-${Date.now()}`;
  }

  async salvarReceita() {
    const tutor = this.tutorEncontrado ?? this.novoTutor;
    const assinaturaImg = isPlatformBrowser(this.platformId)
      ? this.canvasRef?.nativeElement.toDataURL()
      : null;

    if (this.retornoNotificarCliente) {
      const d = (this.retornoData || '').trim();
      if (!d) {
        this.toastService.error('Informe a data sugerida para o retorno ou desmarque a notificação ao tutor.', 'Retorno');
        return;
      }
      const temCliente = !!this.clienteIdSelecionado;
      const temEmailTutor = !!(tutor?.email || '').trim();
      if (!temCliente && !temEmailTutor) {
        this.toastService.error('Para avisar o tutor, busque o CPF na base ou preencha o e-mail no cadastro manual.', 'Retorno');
        return;
      }
    }

    // Persistir alterações de pet se necessário
    let petUsado: Pet | null = this.petSelecionado ? { ...this.petSelecionado } : null;
    const token = this.getEffectiveToken();
    try {
      if (this.petSavePlan && !this.clienteIdSelecionado) {
        this.toastService.error('Não é possível salvar o pet sem um cliente. Busque o CPF novamente.');
        return;
      }

      if (this.petSavePlan === 'novo' && this.clienteIdSelecionado && token) {
        const fd = this.buildPetFormData(this.novosDadosPet, true);
        // Preferir a seleção direta do vet (predefinidas); fallback para resolução por nome
        let alergiasPre = this.alergiasSelecionadasVet?.length ? this.alergiasSelecionadasVet : [];
        if (!alergiasPre.length) {
          const alergiasStr = this.alergiasList();
          alergiasPre = await this.resolveAlergiasPredefinidas(alergiasStr, token);
        }
        fd.append('alergias_predefinidas', JSON.stringify(alergiasPre));
        const created = await this.apiService.createPet(this.clienteIdSelecionado, fd, token).toPromise();
        const novoId = String(created?.id ?? created?.pet?.id ?? `tmp-${Date.now()}`);
        // Refetch para garantir estado final do backend
  let novoPet: Pet | null = null;
        try {
          const lista = await this.apiService.getPetsByCliente(this.clienteIdSelecionado, token).toPromise();
          const p = (Array.isArray(lista) ? lista : []).find((x: any) => String(x.id) === String(novoId));
          if (p) {
            novoPet = {
              id: String(p.id),
              nome: p.nome || '',
              especie: p.especie || p.tipo || '',
              idade: this.normalizeIdade(p),
              peso: this.normalizePeso(p),
              raca: p.raca || '',
              sexo: p.sexo || 'Macho',
              alergias: this.extractAlergiasToStrings(p),
              alergias_predefinidas: Array.isArray(p.alergias_predefinidas) ? p.alergias_predefinidas : []
            };
          }
        } catch {}
        if (!novoPet) {
          novoPet = { ...this.novosDadosPet, id: novoId, alergias: (alergiasPre || []).map(x => x.nome), alergias_predefinidas: alergiasPre as any } as any;
        }
        const novoPetSeguro: Pet = novoPet as Pet;
        if (this.tutorEncontrado) {
          const others = (this.tutorEncontrado.pets || []).filter((p: any) => String(p.id) !== String(novoId));
          this.tutorEncontrado.pets = [...others, novoPetSeguro];
        }
        this.selecionarPet(novoPetSeguro);
        petUsado = novoPetSeguro;
        this.toastService.success('Novo pet cadastrado (pendente de aceitação do tutor).');
      }

      if (this.petSavePlan === 'editar' && this.clienteIdSelecionado && token && this.petSelecionado?.id != null) {
        const fd = this.buildPetFormData(this.novosDadosPet, false);
        let alergiasPre = this.alergiasSelecionadasVet?.length ? this.alergiasSelecionadasVet : [];
        if (!alergiasPre.length) {
          const alergiasStr = this.alergiasList();
          alergiasPre = await this.resolveAlergiasPredefinidas(alergiasStr, token);
        }
        fd.append('alergias_predefinidas', JSON.stringify(alergiasPre));
        await this.apiService.updatePet(this.clienteIdSelecionado, this.petSelecionado.id!, fd, token).toPromise();
        // Refetch do pet para estado atualizado
        try {
          const lista = await this.apiService.getPetsByCliente(this.clienteIdSelecionado, token).toPromise();
          const p = (Array.isArray(lista) ? lista : []).find((x: any) => String(x.id) === String(this.petSelecionado!.id));
          if (p) {
            const atualizado: Pet = {
              id: String(p.id),
              nome: p.nome || '',
              especie: p.especie || p.tipo || '',
              idade: this.normalizeIdade(p),
              peso: this.normalizePeso(p),
              raca: p.raca || '',
              sexo: p.sexo || 'Macho',
              alergias: this.extractAlergiasToStrings(p),
              alergias_predefinidas: Array.isArray(p.alergias_predefinidas) ? p.alergias_predefinidas : []
            };
            if (this.tutorEncontrado) {
              this.tutorEncontrado.pets = (this.tutorEncontrado.pets || []).map((orig: any) => String(orig.id) === String(atualizado.id) ? atualizado : orig);
            }
            this.selecionarPet(atualizado);
            petUsado = { ...atualizado };
          } else {
            Object.assign(this.petSelecionado, this.novosDadosPet, { alergias_predefinidas: alergiasPre as any });
            petUsado = { ...this.petSelecionado };
          }
        } catch {
          Object.assign(this.petSelecionado, this.novosDadosPet, { alergias_predefinidas: alergiasPre as any });
          petUsado = { ...this.petSelecionado };
        }
        this.toastService.success('Pet atualizado com sucesso.');
      }
    } catch (e: any) {
      const msg = e?.error?.message || e?.message || 'Erro ao persistir alterações do pet';
      this.toastService.error(msg, 'Erro');
      return;
    } finally {
      this.petSavePlan = null;
    }

    // Monta alergias somente como strings (predefinidas) para a receita
    const alergiasStrings = (this.alergiasSelecionadasVet && this.alergiasSelecionadasVet.length)
      ? this.alergiasSelecionadasVet.map(a => String(a.nome).trim()).filter(Boolean)
      : ((petUsado?.alergias ?? this.novosDadosPet.alergias) || []).map(s => String(s).trim()).filter(Boolean);

    // Garante que não enviamos alergias_predefinidas no payload da receita
    const basePet = petUsado ?? this.novosDadosPet;
    const petParaReceita = {
      id: (basePet as any)?.id ?? undefined,
      nome: basePet?.nome || '',
      especie: basePet?.especie || '',
      raca: basePet?.raca || '',
      sexo: basePet?.sexo || 'Macho',
      idade: basePet?.idade ?? 0,
      peso: basePet?.peso ?? 0,
      alergias: alergiasStrings
    };

    // Define alerta de alergia no momento do salvamento (há algum ativo selecionado que conflita?)
    const alertaAlergiaNoMomento = this.ativosSelecionados.some(id => this.isAtivoAlergenoParaPet(id));

    const atendimentoPayload: CriarAtendimentoPayload = {
      tutor: {
        nome: tutor?.nome || '',
        cpf: tutor?.cpf || '',
        telefone: tutor?.telefone || '',
        email: tutor?.email || '',
        endereco: tutor?.endereco || ''
      },
      pet: petParaReceita,
      atendimento: {
        queixaPrincipal: this.queixaPrincipal,
        anamnese: this.anamnese,
        exameFisico: this.exameFisico,
        diagnostico: this.diagnostico,
        planoTerapeutico: this.planoTerapeutico,
        observacoes: this.observacoes,
        examesSolicitados: this.examesSolicitados
          .map((ex) => ({
            nome: (ex.nome || '').trim(),
            status: (ex.status || 'solicitado').trim().toLowerCase(),
            observacoes: (ex.observacoes || '').trim(),
          }))
          .filter((ex) => ex.nome),
        fotos: this.fotosAtendimento.map((foto) => ({ descricao: foto.descricao, base64: foto.base64 })),
        retorno: this.retornoNotificarCliente
          ? {
              notificarCliente: true,
              data: (this.retornoData || '').trim(),
              observacao: (this.retornoMensagemTutor || '').trim().slice(0, 500) || undefined,
            }
          : undefined,
      },
      receita: {
        ativosSelecionados: this.ativosSelecionados,
        alerta_alergia: alertaAlergiaNoMomento,
        observacoes: this.observacoes,
        assinatura: {
          manual: this.assinaturaManual,
          cursiva: this.assinaturaCursiva,
          imagem: assinaturaImg,
          icp: this.assinaturaICP
        },
        alergias: alergiasStrings,
      },
    };

    try {
      const tokenReceita = this.getEffectiveToken() || undefined;
      await this.apiService.criarAtendimento(atendimentoPayload, tokenReceita).toPromise();
      const msgRetorno = this.retornoNotificarCliente
        ? ' O tutor foi notificado sobre o retorno.'
        : '';
      this.toastService.success(`Prontuário do atendimento salvo com sucesso.${msgRetorno}`);
      // Evita carregar o alerta de alergia para a próxima receita
      this.alerta_alergia = false;
    } catch (e: any) {
      if (e?.status === 401) {
        this.toastService.error('Sessão expirada ou não autenticado. Faça login novamente para salvar a receita.', 'Não autorizado');
      } else {
        const msg = e?.error?.message || e?.message || 'Falha ao salvar receita';
        this.toastService.error(msg, 'Erro');
      }
    }
  }

  adicionarExameSolicitado() {
    this.examesSolicitados.push({ nome: '', status: 'solicitado', observacoes: '' });
  }

  removerExameSolicitado(index: number) {
    this.examesSolicitados.splice(index, 1);
    if (!this.examesSolicitados.length) {
      this.examesSolicitados.push({ nome: '', status: 'solicitado', observacoes: '' });
    }
  }

  async onFotoAtendimentoSelecionada(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    try {
      const base64 = await this.fileToDataUrl(file);
      this.fotosAtendimento.push({
        descricao: '',
        base64,
        nomeArquivo: file.name || `foto-${Date.now()}.png`,
      });
    } catch {
      this.toastService.error('Não foi possível carregar a foto selecionada.');
    } finally {
      if (input) input.value = '';
    }
  }

  removerFotoAtendimento(index: number) {
    this.fotosAtendimento.splice(index, 1);
  }

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  // --- Resolução de alergias pré-definidas ---
  private async resolveAlergiasPredefinidas(strings: string[], token: string): Promise<AlergiaLookup[]> {
    const termos = Array.from(new Set((strings || []).map(s => String(s).trim()).filter(Boolean)));
    const resultado: AlergiaLookup[] = [];
    const chave = (i: AlergiaLookup) => `${i.alergia_id ?? ''}|${i.ativo_id ?? ''}`;
    const jaTem = new Set<string>();
    const naoCorrespondidas: string[] = [];

    for (const termo of termos) {
      try {
        const lista = await this.apiService.getListaAlergias(token, termo).toPromise();
        const hit = (lista || []).find(i => String(i.nome).trim().toLowerCase() === termo.toLowerCase());
        if (hit) {
          const ck = chave(hit);
          if (!jaTem.has(ck)) { resultado.push(hit); jaTem.add(ck); }
        } else {
          naoCorrespondidas.push(termo);
        }
      } catch {
        naoCorrespondidas.push(termo);
      }
    }

    if (naoCorrespondidas.length) {
      const outras = await this.getOutrasPredefinida(token);
      if (outras) {
        const ck = chave(outras);
        if (!jaTem.has(ck)) { resultado.push(outras); jaTem.add(ck); }
      }
    }

    return resultado;
  }

  private async getOutrasPredefinida(token: string): Promise<AlergiaLookup | null> {
    if (this.outraPredefinida) return this.outraPredefinida;
    try {
      const lista = await this.apiService.getListaAlergias(token, 'outras').toPromise();
      const found = (lista || []).find(i => String(i.nome).trim().toLowerCase() === 'outras');
      this.outraPredefinida = found || null;
      return this.outraPredefinida;
    } catch { return null; }
  }

  getNomeAtivo(id: string): string {
  const ativo = this.ativos.find(a => a.id === id);
  return ativo ? ativo.nome : '';
}

gerarPdf() {
  const element = this.pdfContent.nativeElement as HTMLElement;

  html2canvas(element, { scale: 2 }).then(canvas => {
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`receita_${this.petSelecionado?.nome || 'pet'}.pdf`);
  });
}

getDoseCaes(id: string): string {
  const ativo = this.ativos.find(a => a.id === id);
  return ativo?.doseCaes || '-';
}

getDoseGatos(id: string): string {
  const ativo = this.ativos.find(a => a.id === id);
  return ativo?.doseGatos || '-';
}

  highlight(text: string): SafeHtml {
    if (!text) return '' as any;
    if (!this.highlightTerm) return text as any;
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(${esc(this.highlightTerm)})`, 'ig');
    const html = text.replace(re, '<mark>$1</mark>');
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  private isAtivoAlergenoParaPet(ativoId: string): boolean {
    // Prioriza o que o vet selecionou no editor
    const lista = (this.alergiasSelecionadasVet && this.alergiasSelecionadasVet.length)
      ? this.alergiasSelecionadasVet
      : (this.petSelecionado?.alergias_predefinidas || []);
    if (!lista || !lista.length) return false;
    return !!lista.find((a: any) => a && a.ativo_id != null && String(a.ativo_id) === String(ativoId));
  }

  confirmarAlergiaAtivo() {
    if (this.pendingAtivoId && !this.ativosSelecionados.includes(this.pendingAtivoId)) {
      this.ativosSelecionados.push(this.pendingAtivoId);
      this.alerta_alergia = true;
    }
    this.pendingAtivoId = null;
    this.showAlergiaModal = false;
  }

  cancelarAlergiaAtivo() {
    this.pendingAtivoId = null;
    this.showAlergiaModal = false;
  }

  // --- Vet alergias search-select methods ---
  filtrarSugestoesVet() {
    const termo = (this.alergiaBuscaVet || '').trim();
    this.showSugestoesVet = false;
    this.sugestoesVet = [];
    if (!termo) return;
    const token = this.getEffectiveToken();
    if (!token) return;
    const jaSelecionados = new Set(this.alergiasSelecionadasVet.map(a => `${a.alergia_id ?? ''}|${a.ativo_id ?? ''}`));
    this.apiService.getListaAlergias(token, termo).subscribe({
      next: (lista) => {
        const base = (lista || []).filter(i => !jaSelecionados.has(`${i.alergia_id ?? ''}|${i.ativo_id ?? ''}`));
        const lower = termo.toLowerCase();
        this.sugestoesVet = base.filter(i => i.nome?.toLowerCase().includes(lower)).slice(0, 20);
        this.showSugestoesVet = this.sugestoesVet.length > 0;
      },
      error: () => { this.sugestoesVet = []; this.showSugestoesVet = false; }
    });
  }

  adicionarSugestaoVet(item: AlergiaLookup) {
    const key = `${item.alergia_id ?? ''}|${item.ativo_id ?? ''}`;
    const exists = this.alergiasSelecionadasVet.some(a => `${a.alergia_id ?? ''}|${a.ativo_id ?? ''}` === key);
    if (!exists) {
      this.alergiasSelecionadasVet.push(item);
      // Reflete nomes no modelo de edição para visual imediato
      this.novosDadosPet.alergias = this.alergiasSelecionadasVet.map(x => x.nome);
      this.onPetFieldChange();
    }
    this.alergiaBuscaVet = '';
    this.filtrarSugestoesVet();
  }

  removerAlergiaVet(idx: number) {
    this.alergiasSelecionadasVet.splice(idx, 1);
    this.novosDadosPet.alergias = this.alergiasSelecionadasVet.map(x => x.nome);
    this.onPetFieldChange();
  }


}
