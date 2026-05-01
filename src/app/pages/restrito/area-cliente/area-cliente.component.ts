import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID, ElementRef, ViewChild, Input, ViewContainerRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { NavmenuComponent } from '../../../navmenu/navmenu.component';
import { LoginClienteComponent } from './login-cliente/login-cliente.component';
import { CrieSuaContaClienteComponent } from './crie-sua-conta-cliente/crie-sua-conta-cliente.component';
import { ClienteSuportePanelComponent } from '../../../features/support-chat/cliente-suporte-panel/cliente-suporte-panel.component';
import { GaleriaPetComponent } from './galeria-pet/galeria-pet.component';
import { ToastService } from '../../../services/toast.service';
import { AuthService } from '../../../services/auth.service';
import { ApiService } from '../../../services/api.service';
import { StoreService } from '../../../services/store.service';
import { Subscription } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { MARCA_NOME } from '../../../constants/loja-public';
import { ClienteAreaModalService, ClienteAreaModalView } from '../../../services/cliente-area-modal.service';
import { PartnerChatLauncherService } from '../../../features/partner-chat/partner-chat-launcher.service';
interface Pet {
  id: string;
  nome: string;
  tipo: string;
  photoURL?: string;
}

interface ConviteDadosPendente {
  id: number;
  parceiro_id: number;
  parceiro_nome?: string | null;
  escopo: string;
  token: string;
  status: string;
  created_at?: string;
}

interface PermissaoParceiro {
  id: number;
  parceiro_id: number;
  parceiro_nome?: string | null;
  status: string;
  escopo: string;
}

@Component({
  selector: 'app-area-cliente',
  standalone: true, // <-- importante
  imports: [CommonModule, FormsModule, RouterModule, NavmenuComponent, LoginClienteComponent, CrieSuaContaClienteComponent, ClienteSuportePanelComponent, GaleriaPetComponent], // <-- importa o que usa no template
  templateUrl: './area-cliente.component.html',
  styleUrls: ['./area-cliente.component.scss']
})
export class AreaClienteComponent implements OnInit, OnDestroy {
  readonly marcaNome = MARCA_NOME;
  @Input() modal: boolean = false;
  @Input() initialView: ClienteAreaModalView = null;
  @ViewChild('internalHost', { read: ViewContainerRef }) internalHost?: ViewContainerRef;
  @ViewChild('overlayHost', { read: ViewContainerRef }) overlayHost?: ViewContainerRef;
  // Render gating and auth state (storage-based)
  ready = false;
  hasAuth = false;
  titulo = 'Bem-vindo!';
  clienteData: any = null;
  pets: Pet[] = [];
  private sub?: Subscription;
  // Promise that resolves when loadProfile finishes (success or failure)
  private profilePromise?: Promise<void>;
  private _resolveProfile?: () => void;
  private _rejectProfile?: (err?: any) => void;
  private profileLoading: boolean = false;
  private lastProfileToken?: string | null = null;
  consentLoading = false;
  consentError: string | null = null;
  consentSuccess: string | null = null;
  consentActionKey: string | null = null;
  pendingConvites: ConviteDadosPendente[] = [];
  permissoesParceiros: PermissaoParceiro[] = [];

  // Internal navigation state when in modal
  internalView: 'meus-pedidos' | 'meus-pets' | 'novo-pet' | 'perfil' | 'meus-enderecos' | 'meus-cartoes' | 'telemedicina' | 'suporte' | 'postar-foto' | 'minha-galeria' | null = null;
  // track which internal view originated the last navigation (used to return)
  private lastInternalOrigin: string | null = null;
  private pendingInitialView: ClienteAreaModalView = null;

  modalLoginAberto = false;
  modalCadastroAberto = false;
  modalLogoutAberto = false;
  menuAberto = false;
  popoverTop = 0;
  popoverLeft = 0;

  @ViewChild('gearBtn') gearBtn?: ElementRef<HTMLButtonElement>;

  abrirModalLogin() { this.modalLoginAberto = true; }
  fecharModalLogin() { this.modalLoginAberto = false; }
  abrirModalCadastro() { this.modalCadastroAberto = true; }
  fecharModalCadastro() { this.modalCadastroAberto = false; }

  openLogoutModal() { this.modalLogoutAberto = true; }
  closeLogoutModal() { this.modalLogoutAberto = false; }
  confirmLogout() {
    try { this.closeLogoutModal(); } catch (e) {}
    try { this.logout(); } catch (e) {}
    // After logging out, send user to homepage
    try { this.router.navigateByUrl('/'); } catch (e) { window.location.href = '/'; }
  }

  toggleMenu(event?: Event) {
    if (event) event.stopPropagation();
    this.menuAberto = !this.menuAberto;
    if (this.menuAberto) {
      this.positionPopover();
    }
  }
  fecharMenu() {
    this.menuAberto = false;
  }

  onLogin() {
    this.hasAuth = !!this.auth.getToken() && !!this.getStoredUserType();
    if (this.hasAuth) {
      const token = this.auth.getToken()!;
      const chatParceiroFromUrl = this.route.snapshot.queryParamMap.get('chatParceiro');
      this.loadProfile(token);
      this.loadConsentimentoData(token);
      this.queueInitialViewOpen();
      setTimeout(() => this.tryNavigateToChatAfterLogin(chatParceiroFromUrl), 0);
    }
  }

  logout() {
    this.auth.logout();
    this.hasAuth = false;
    this.clienteData = null;
    this.pets = [];
    this.pendingConvites = [];
    this.permissoesParceiros = [];
    this.consentError = null;
    this.consentSuccess = null;
    if (this.isBrowser) {
      localStorage.removeItem('userType');
      sessionStorage.removeItem('userType');
    }
    // Limpa a sacola ao sair
    try { this.store.clearCart(); } catch {}
  }

  private onDocClick = (e: MouseEvent) => {
    const el = e.target as HTMLElement | null;
    if (el && el.closest && (el.closest('.menu') || el.closest('.app-navbar'))) return;
    if (this.menuAberto) this.menuAberto = false;
  };

  constructor(
    private toast: ToastService,
    public auth: AuthService,
    private api: ApiService,
  private route: ActivatedRoute,
  private router: Router,
    private el: ElementRef,
    private store: StoreService,
    @Inject(PLATFORM_ID) private platformId: Object,
    private clienteAreaModal: ClienteAreaModalService,
    private partnerChatLauncher: PartnerChatLauncherService
  ) {
    if (isPlatformBrowser(this.platformId)) {
      document.addEventListener('click', this.onDocClick);
    }
  }

  private positionPopover() {
    try {
      const btn = this.gearBtn?.nativeElement;
      if (!btn) { this.popoverTop = 100; this.popoverLeft = 100; return; }
      const rect = btn.getBoundingClientRect();
      // valores aproximados; o container tem padding e pode crescer, usamos clamp no CSS e aqui
      const popW = 240;
      const popH = 160;
      let top = rect.bottom + window.scrollY + 8;
      let left = rect.right + window.scrollX - popW; // alinhar à direita do botão
      const maxLeft = window.scrollX + window.innerWidth - popW - 8;
      const maxTop = window.scrollY + window.innerHeight - popH - 8;
      this.popoverLeft = Math.max(window.scrollX + 8, Math.min(left, maxLeft));
      this.popoverTop = Math.max(window.scrollY + 8, Math.min(top, maxTop));
    } catch {
      this.popoverTop = 100; this.popoverLeft = 100;
    }
  }

  ngOnInit(): void {
    // In SSR, avoid rendering logged-out card to prevent flicker; compute only on browser
    if (!this.isBrowser) {
      this.ready = false;
      return;
    }
    // Check storage synchronously before rendering on client
    const token = this.auth.getToken();
    const utype = this.getStoredUserType();
    this.hasAuth = !!token && !!utype;
    this.ready = true;
    this.pendingInitialView = this.initialView;
    if (this.hasAuth && token) {
      this.loadProfile(token);
      this.loadConsentimentoData(token);
      this.queueInitialViewOpen();
      const cp = this.route.snapshot.queryParamMap.get('chatParceiro');
      setTimeout(() => this.tryNavigateToChatAfterLogin(cp), 0);
    }

    // Cross-sync with global auth: react when login/logout happens elsewhere (e.g., Loja popover)
    this.sub = this.auth.isLoggedIn$.subscribe(ok => {
      const tokenNow = this.auth.getToken();
      const typeNow = this.getStoredUserType();
      this.hasAuth = !!ok && !!tokenNow && !!typeNow;
      if (this.hasAuth && tokenNow) {
        // refresh profile quickly
        const cp = this.route.snapshot.queryParamMap.get('chatParceiro');
        this.loadProfile(tokenNow);
        this.loadConsentimentoData(tokenNow);
        this.queueInitialViewOpen();
        setTimeout(() => this.tryNavigateToChatAfterLogin(cp), 0);
      } else {
        // reflect logout immediately in the modal
        this.clienteData = null;
        this.pets = [];
        this.pendingConvites = [];
        this.permissoesParceiros = [];
      }
    });

    // Abrir modais conforme query params
    if (this.isBrowser) {
      this.route.queryParamMap.subscribe(pm => {
        const cadastro = pm.get('cadastro');
        const login = pm.get('login');
        if (cadastro === '1') {
          this.modalCadastroAberto = true;
          this.modalLoginAberto = false;
        } else         if (login === '1') {
          this.modalLoginAberto = true;
          this.modalCadastroAberto = false;
        }
        const viewParam = pm.get('view');
        if (viewParam === 'telemedicina') {
          this.tryMountTelemedicinaFromRoute();
        }
      });
    }
  }
  private get isBrowser(): boolean { return isPlatformBrowser(this.platformId); }

  /**
   * Considera a conta desativada APENAS quando o backend devolve explicitamente
   * `ativo === 0` (ou `false`). Valores `undefined`/`null` (ausência do campo
   * em respostas legadas) são tratados como ATIVO para não bloquear o cliente
   * indevidamente.
   */
  get isContaDesativada(): boolean {
    if (!this.clienteData) return false;
    const a = this.clienteData.ativo;
    return a === 0 || a === false || a === '0';
  }

  private getStoredUserType(): string | null {
    if (!this.isBrowser) return null;
    return localStorage.getItem('userType') || sessionStorage.getItem('userType');
  }

  /** Atualiza só a lista de pets (cliente já em `clienteData`). */
  private refreshPetsForCliente(token: string) {
    const id = Number(this.clienteData?.id);
    if (isNaN(id) || id <= 0) return;
    this.api.getPetsByCliente(id, token).subscribe({
      next: (pets) => {
        this.pets = pets || [];
      },
      error: (err) => {
        const msg =
          (err && err.error && (err.error.message || err.error.error)) || err.message || 'Erro ao buscar pets';
        this.toast.error(msg, 'Erro');
        this.pets = [];
      }
    });
  }

  private loadProfile(token: string) {
    // silent load; if it fails, disconnect
    // avoid duplicate concurrent loads for the same token
    if (this.profileLoading && this.lastProfileToken === token) {
      return;
    }
    this.profileLoading = true;
    this.lastProfileToken = token || null;

    // create a promise so callers (like open('meus-pets')) can wait for completion
    if (!this.profilePromise) {
      this.profilePromise = new Promise<void>((resolve, reject) => {
        this._resolveProfile = () => { resolve(); };
        this._rejectProfile = (err?: any) => { reject(err); };
      });
    }

    this.api.getClienteMe(token).subscribe({
      next: (res) => {
        if (res && res.user) {
          this.clienteData = res.user;
          // carregar pets em seguida
          const id = Number(res.user.id);
          if (!isNaN(id)) {
            this.api.getPetsByCliente(id, token).subscribe({
              next: (pets) => {
                this.pets = pets || [];
                try { this._resolveProfile && this._resolveProfile(); } catch {}
                this.profileLoading = false;
                this.profilePromise = undefined;
                this.tryMountTelemedicinaFromRoute();
              },
              error: (err) => {
                const msg = (err && err.error && (err.error.message || err.error.error)) || err.message || 'Erro ao buscar pets';
                this.toast.error(msg, 'Erro');
                this.pets = [];
                try { this._resolveProfile && this._resolveProfile(); } catch {}
                this.profileLoading = false;
                this.profilePromise = undefined;
                this.tryMountTelemedicinaFromRoute();
              }
            });
          } else {
            try { this._resolveProfile && this._resolveProfile(); } catch {}
            this.profileLoading = false;
            this.profilePromise = undefined;
            this.tryMountTelemedicinaFromRoute();
          }
        } else {
          // resposta inesperada
          this.toast.error('Resposta inesperada do servidor', 'Erro');
          this.logout();
          try { this._resolveProfile && this._resolveProfile(); } catch {}
          this.profileLoading = false;
          this.profilePromise = undefined;
        }
      },
      error: (err) => {
        const msg = (err && err.error && (err.error.message || err.error.error)) || err.message || 'Erro ao validar sessão';
        this.toast.error(msg, 'Sessão inválida');
        // desconecta ao falhar validação
        this.logout();
        try { this._resolveProfile && this._resolveProfile(); } catch {}
        this.profileLoading = false;
        this.profilePromise = undefined;
      }
    });
  }

  private loadConsentimentoData(token: string): void {
    this.consentLoading = true;
    this.consentError = null;

    this.api.listClienteConvitesDadosPendentes(token).subscribe({
      next: (res) => {
        this.pendingConvites = Array.isArray(res?.convites) ? res.convites : [];
      },
      error: () => {
        this.pendingConvites = [];
      },
    });

    this.api.listClientePermissoesDadosParceiros(token).subscribe({
      next: (res) => {
        this.permissoesParceiros = Array.isArray(res?.permissoes) ? res.permissoes : [];
        this.consentLoading = false;
      },
      error: (err) => {
        this.permissoesParceiros = [];
        this.consentLoading = false;
        this.consentError =
          (err && err.error && (err.error.message || err.error.error)) ||
          'Não foi possível carregar as permissões de dados.';
      },
    });
  }

  aceitarConviteDados(convite: ConviteDadosPendente): void {
    const clienteId = Number(this.clienteData?.id);
    const conviteToken = String(convite?.token || '');
    const authToken = this.auth.getToken();
    if (!authToken || !clienteId || !conviteToken) return;

    this.consentActionKey = `accept:${convite.id}`;
    this.consentError = null;
    this.consentSuccess = null;
    this.api.acceptConviteDadosParceiro(conviteToken, clienteId).subscribe({
      next: () => {
        this.consentSuccess = 'Solicitação aceita com sucesso.';
        this.loadConsentimentoData(authToken);
      },
      error: (err) => {
        this.consentError =
          (err && err.error && (err.error.message || err.error.error)) ||
          'Não foi possível aceitar a solicitação.';
      },
      complete: () => {
        this.consentActionKey = null;
      },
    });
  }

  recusarConviteDados(convite: ConviteDadosPendente): void {
    const clienteId = Number(this.clienteData?.id);
    const conviteToken = String(convite?.token || '');
    const authToken = this.auth.getToken();
    if (!authToken || !clienteId || !conviteToken) return;

    this.consentActionKey = `reject:${convite.id}`;
    this.consentError = null;
    this.consentSuccess = null;
    this.api.rejectConviteDadosParceiro(conviteToken, clienteId).subscribe({
      next: () => {
        this.consentSuccess = 'Solicitação recusada.';
        this.loadConsentimentoData(authToken);
      },
      error: (err) => {
        this.consentError =
          (err && err.error && (err.error.message || err.error.error)) ||
          'Não foi possível recusar a solicitação.';
      },
      complete: () => {
        this.consentActionKey = null;
      },
    });
  }

  revogarPermissaoParceiro(parceiroId: number): void {
    const authToken = this.auth.getToken();
    if (!authToken || !parceiroId) return;

    this.consentActionKey = `revoke:${parceiroId}`;
    this.consentError = null;
    this.consentSuccess = null;
    this.api.revokeClientePermissaoParceiro(authToken, parceiroId).subscribe({
      next: () => {
        this.consentSuccess = 'Acesso revogado com sucesso.';
        this.loadConsentimentoData(authToken);
      },
      error: (err) => {
        this.consentError =
          (err && err.error && (err.error.message || err.error.error)) ||
          'Não foi possível revogar o acesso.';
      },
      complete: () => {
        this.consentActionKey = null;
      },
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.isBrowser) {
      document.removeEventListener('click', this.onDocClick);
    }
  }

  abrirCadastroPet() {
    this.toast.info('Abrir modal de cadastro de pet');
  }

  /** Extrai iniciais (máx. 2) a partir do nome para uso no avatar */
  getInitials(nome?: string | null): string {
    if (!nome) return '?';
    const parts = String(nome).trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    const first = parts[0].charAt(0) || '';
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
    return (first + last).toUpperCase();
  }

  verDetalhesPet(pet: Pet) {
    this.toast.info(`Detalhes do pet: ${pet.nome}`);
  }

  // ---- Internal modal navigation helpers ----
  async open(view: 'meus-pedidos' | 'meus-pets' | 'novo-pet' | 'consultar-pedidos' | 'loja' | 'perfil' | 'favoritos' | 'carrinho' | 'meus-enderecos' | 'meus-cartoes' | 'telemedicina' | 'suporte' | 'postar-foto' | 'minha-galeria') {
    if (view === 'suporte') {
      if (!this.hasAuth) {
        this.toast.error('Faça login para usar o atendimento por chat.', 'Atendimento');
        return;
      }
      const ut = this.getStoredUserType();
      if (ut && ut !== 'cliente') {
        this.toast.error('O chat está disponível apenas para clientes.', 'Atendimento');
        return;
      }
      if (this.internalView === 'suporte') {
        return;
      }
      this.internalView = 'suporte';
      this.titulo = 'Atendimento';
      return;
    }
    if (!this.modal) {
      // Navigate normally when not in modal
      if (view === 'meus-pedidos') return this.router.navigateByUrl('/meus-pedidos');
      if (view === 'meus-pets') return this.router.navigateByUrl('/meus-pets');
      if (view === 'novo-pet') return this.router.navigateByUrl('/novo-pet');
      if (view === 'perfil') return this.router.navigateByUrl('/editar-perfil');
      if (view === 'favoritos') return this.router.navigateByUrl('/favoritos');
      if (view === 'carrinho') return this.router.navigateByUrl('/carrinho');
      if (view === 'meus-cartoes') return this.router.navigateByUrl('/meus-cartoes');
      if (view === 'telemedicina') {
        void this.router.navigateByUrl('/area-cliente?view=telemedicina');
        return;
      }
      if (view === 'loja') return this.router.navigateByUrl('/loja');
      if (view === 'consultar-pedidos') {
        return this.router.navigate([{ outlets: { modal: ['consultar-pedidos'] } }], { relativeTo: this.route });
      }
      return;
    }
    if (view === 'loja') {
      // Close modal entirely and go to loja
      window.location.href = '/loja';
      return;
    }
    if (view === 'favoritos') {
      window.location.href = '/favoritos';
      return;
    }
    if (view === 'carrinho') {
      window.location.href = '/carrinho';
      return;
    }
    if (view === 'consultar-pedidos') {
      this.titulo = 'Histórico de receitas';
      return this.openConsultarPedidosOverlay();
    }
    if (view === 'meus-cartoes') {
      if (!this.modal) return this.router.navigateByUrl('/meus-cartoes');
      this.internalView = 'meus-cartoes';
      this.titulo = 'Meus Cartões';
      if (!this.internalHost) return;
      this.internalHost.clear();
      try {
        const mod = await import('./meus-cartoes/meus-cartoes.component');
        const Cmp = (mod as any).MeusCartoesComponent;
        const ref = this.internalHost.createComponent(Cmp);
        if (ref?.instance) {
          (ref.instance as any).modal = true;
          if ((ref.instance as any).close) {
            (ref.instance as any).close.subscribe(() => this.goBack());
          }
        }
      } catch (e) {
        console.error('Falha ao abrir Meus Cartões', e);
        this.toast.error('Não foi possível abrir agora');
      }
      return;
    }
    if (view === 'telemedicina') {
      await this.mountTelemedicinaEmbedded(true);
      return;
    }
    if (view === 'minha-galeria') {
      if (!this.modal) return this.router.navigateByUrl('/area-cliente?view=minha-galeria');

      // Aguarda um curto período para evitar abrir a galeria com pets vazios enquanto o perfil ainda carrega.
      if ((!this.clienteData || !this.pets || this.pets.length === 0) && this.profilePromise) {
        try {
          await Promise.race([
            this.profilePromise,
            new Promise(resolve => setTimeout(resolve, 2000))
          ]);
        } catch {}
      }

      this.internalView = 'minha-galeria';
      this.titulo = 'Minha Galeria';
      if (!this.internalHost) return;
      this.internalHost.clear();
      try {
        const ref = this.internalHost.createComponent(GaleriaPetComponent);
        if (ref?.instance) {
          (ref.instance as any).modal = true;
          try { (ref.instance as any).pets = this.pets || []; } catch {}
          try { (ref.instance as any).clienteMe = this.clienteData; } catch {}
          if ((ref.instance as any).close) {
            (ref.instance as any).close.subscribe(() => this.goBack());
          }
          if ((ref.instance as any).petsChanged) {
            (ref.instance as any).petsChanged.subscribe(() => {
              const tk = this.auth.getToken();
              if (tk) this.refreshPetsForCliente(tk);
            });
          }
        }
      } catch (e) {
        console.error('Falha ao abrir Minha Galeria', e);
        this.toast.error('Não foi possível abrir agora');
      }
      return;
    }
      if (view === 'meus-enderecos') {
      if (!this.modal) return this.router.navigateByUrl('/meus-enderecos');
      this.internalView = 'meus-enderecos';
      this.titulo = 'Meus Endereços';
      if (!this.internalHost) return;
      this.internalHost.clear();
      try {
        const mod = await import('../../../pages/meus-enderecos/meus-enderecos.component');
        const Cmp = (mod as any).MeusEnderecosComponent;
        const ref = this.internalHost.createComponent(Cmp);
        if (ref?.instance) {
          (ref.instance as any).modal = true;
          // If we opened this from Perfil, allow MeusEnderecos to request returning to Perfil
          (ref.instance as any).returnToPerfil = this.lastInternalOrigin === 'perfil';
          if ((ref.instance as any).close) {
            (ref.instance as any).close.subscribe((payload?: string) => {
              if (payload === 'perfil') {
                // reopen perfil inside the modal
                try { this.internalHost?.clear(); } catch {}
                this.open('perfil');
                return;
              }
              this.goBack();
            });
          }
        }
      } catch (e) {
        console.error('Falha ao abrir Meus Endereços', e);
        this.toast.error('Não foi possível abrir agora');
      }
      return;
    }
  // Prevent duplicate internal view creation if the same view is already open
  if (this.internalView === view) return;
  this.internalView = view as any;
    // Update title by selection
    const titles: Record<string,string> = {
      'meus-pedidos': 'Meus Pedidos',
      'meus-pets': 'Meus Pets',
      'novo-pet': 'Cadastrar Pet',
      'perfil': 'Perfil',
      'telemedicina': 'Telemedicina',
      'postar-foto': 'Postar foto',
      'minha-galeria': 'Minha Galeria',
    };
    this.titulo = titles[view] || 'Área do Cliente';
    if (!this.internalHost) return;
    this.internalHost.clear();
    try {
      if (view === 'meus-pedidos') {
        const mod = await import('../../../pages/meus-pedidos/meus-pedidos.component');
        const Cmp = (mod as any).MeusPedidosComponent;
        const ref = this.internalHost.createComponent(Cmp);
        if (ref?.instance) {
          (ref.instance as any).modal = true;
          if ((ref.instance as any).close) {
            (ref.instance as any).close.subscribe(() => this.goBack());
          }
          if ((ref.instance as any).openStatus) {
            (ref.instance as any).openStatus.subscribe((codigo: string) => {
              this.openConsultarPedidosOverlayWithCode(codigo);
            });
          }
        }
      } else if (view === 'meus-pets') {
        const mod = await import('../../../pages/meus-pets/meus-pets.component');
        const Cmp = (mod as any).MeusPetsComponent;
        const pendingPetEditId = this.clienteAreaModal.consumePendingPetEditId();

        // If we are still loading profile, wait for it to finish (with a short timeout)
        if ((!this.clienteData || !this.pets || this.pets.length === 0) && this.profilePromise) {
          try {
            // await but don't hang forever: 2s timeout
            await Promise.race([
              this.profilePromise,
              new Promise(resolve => setTimeout(resolve, 2000))
            ]);
          } catch {}
        }

        const ref = this.internalHost.createComponent(Cmp);
        if (ref?.instance) {
          (ref.instance as any).modal = true;
          // Provide parent-loaded cliente/pets to avoid duplicate API calls
          try { (ref.instance as any).clienteMe = this.clienteData; } catch {}
          try { (ref.instance as any).pets = this.pets || []; } catch {}
          if ((ref.instance as any).close) {
            (ref.instance as any).close.subscribe(() => this.goBack());
          }
          // If the MeusPets child requests creating a new pet while embedded,
          // open the 'novo-pet' internal view so the form appears inside this modal.
          if ((ref.instance as any).newPet) {
            (ref.instance as any).newPet.subscribe(() => {
              try { this.open('novo-pet'); } catch (e) {}
            });
          }
          // If MeusPets requests editing a pet (emits id), open the NovoPetComponent
          // inside the modal and pass the `editId` so it loads the pet for editing.
          if ((ref.instance as any).editPet) {
            (ref.instance as any).editPet.subscribe((petId: string | number) => {
              this.openPetEditorInModal(petId);
            });
          }
          if ((ref.instance as any).petDeleted) {
            (ref.instance as any).petDeleted.subscribe(() => {
              const t = this.auth.getToken();
              if (t) this.refreshPetsForCliente(t);
            });
          }
        }
        if (pendingPetEditId !== null && pendingPetEditId !== undefined && pendingPetEditId !== '') {
          this.openPetEditorInModal(pendingPetEditId);
        }
      } else if (view === 'novo-pet') {
        const mod = await import('../../../pages/novo-pet/novo-pet.component');
        const Cmp = (mod as any).NovoPetComponent;
        const ref = this.internalHost.createComponent(Cmp);
        if (ref?.instance) {
          (ref.instance as any).modal = true;
          try { (ref.instance as any).clienteDataInjected = this.clienteData; } catch {}
          this.wireNovoPetModalListeners(ref.instance);
        }
      } else if (view === 'postar-foto') {
        if ((!this.clienteData || !this.pets || this.pets.length === 0) && this.profilePromise) {
          try {
            await Promise.race([
              this.profilePromise,
              new Promise(resolve => setTimeout(resolve, 2000))
            ]);
          } catch {}
        }

        const mod = await import('../../galeria-publica/galeria-post-foto-modal/galeria-post-foto-modal.component');
        const Cmp = (mod as any).GaleriaPostFotoModalComponent;
        const ref = this.internalHost.createComponent(Cmp);
        if (ref?.instance) {
          const initialPets = Array.isArray(this.pets) ? [...this.pets] : [];
          const initialClienteId = Number(this.clienteData?.id) || null;
          try { ref.setInput('initialPets', initialPets); } catch { try { (ref.instance as any).initialPets = initialPets; } catch {} }
          try { ref.setInput('initialClienteId', initialClienteId); } catch { try { (ref.instance as any).initialClienteId = initialClienteId; } catch {} }
          try { ref.setInput('embedded', true); } catch { (ref.instance as any).embedded = true; }
          try { ref.setInput('open', true); } catch { (ref.instance as any).open = true; }
          if ((ref.instance as any).closeModal) {
            (ref.instance as any).closeModal.subscribe(() => this.goBack());
          }
          if ((ref.instance as any).posted) {
            (ref.instance as any).posted.subscribe(() => {
              this.clienteAreaModal.notifyGaleriaFotosChanged();
            });
          }
        }
      } else if (view === 'perfil') {
        const mod = await import('../../../pages/perfil/perfil.component');
        const Cmp = (mod as any).PerfilComponent;
        const ref = this.internalHost.createComponent(Cmp);
          if (ref?.instance) {
          (ref.instance as any).modal = true;
          // do not force readOnly here; let the component decide its initial editable state
          if ((ref.instance as any).close) {
            (ref.instance as any).close.subscribe(() => this.goBack());
          }
          // If perfil emits navigation requests (like 'meus-enderecos'), handle them by
          // closing the perfil view and opening the requested internal view.
          if ((ref.instance as any).navigate) {
            (ref.instance as any).navigate.subscribe((viewName: string) => {
              try { this.internalHost?.clear(); } catch {}
              // remember that perfil requested navigation so child can return here if needed
              this.lastInternalOrigin = 'perfil';
              // open will route appropriately; since we're in modal, it will create the internal view
              this.open(viewName as any);
            });
          }
          if ((ref.instance as any).profileSaved) {
            (ref.instance as any).profileSaved.subscribe(() => {
              const t = this.auth.getToken();
              if (t) this.loadProfile(t);
            });
          }
        }
      }
    } catch (e) {
      console.error('Falha ao abrir view interna', e);
      this.toast.error('Não foi possível abrir agora');
    }
  }

  openPartnerChat(parceiroId: number): void {
    this.partnerChatLauncher.openForPartner(parceiroId);
  }

  async openConsultarPedidosOverlay() {
    if (!this.modal) return;
    if (!this.overlayHost) return;
    try {
      const mod = await import('./consultar-pedidos/consultar-pedidos.component');
      const Cmp = (mod as any).ConsultarPedidosComponent;
      this.overlayHost.clear();
      const ref = this.overlayHost.createComponent(Cmp);
      // Mark as embedded modal so it hides own overlay and emits close
      if (ref?.instance) {
        (ref.instance as any).modal = true;
        if ((ref.instance as any).close) {
          (ref.instance as any).close.subscribe(() => this.overlayHost?.clear());
        }
      }
    } catch (e) {
      console.error('Falha ao abrir status do pedido', e);
    }
  }

  async openConsultarPedidosOverlayWithCode(codigo: string) {
    await this.openConsultarPedidosOverlay();
    // Try to pass initial code by setting the input directly
    try {
      const view = this.overlayHost as ViewContainerRef;
      const compRef: any = (view && (view as any)._lView && (view as any)._viewRef) ? null : null; // placeholder: not reliable
    } catch {}
    // As a simpler approach, after component is created, search last created and set property
    try {
      // this.overlayHost?.get would require index; easiest: recreate and set immediately
      if (!this.overlayHost) return;
      this.overlayHost.clear();
      const mod = await import('./consultar-pedidos/consultar-pedidos.component');
      const Cmp = (mod as any).ConsultarPedidosComponent;
      const ref = this.overlayHost.createComponent(Cmp);
      if (ref?.instance) {
        (ref.instance as any).modal = true;
        (ref.instance as any).codigo = (codigo || '').toUpperCase();
        if (typeof (ref.instance as any).consultar === 'function') {
          setTimeout(() => (ref.instance as any).consultar());
        }
        if ((ref.instance as any).close) {
          (ref.instance as any).close.subscribe(() => this.overlayHost?.clear());
        }
      }
    } catch (e) {
      console.error('Falha ao prefilling código do status', e);
    }
  }

  goBack(){
    if (this.overlayHost) {
      try { this.overlayHost.clear(); } catch {}
    }
    if (this.internalHost) {
      try { this.internalHost.clear(); } catch {}
    }
    const wasTelemedicina = this.internalView === 'telemedicina';
    this.internalView = null;
    this.titulo = 'Bem-vindo!';
    if (wasTelemedicina && !this.modal && this.isBrowser) {
      void this.router.navigate(['/area-cliente'], { queryParams: { view: null }, queryParamsHandling: 'merge' });
    }
  }

  private tryMountTelemedicinaFromRoute(): void {
    if (this.modal || !this.hasAuth) return;
    if (this.route.snapshot.queryParamMap.get('view') !== 'telemedicina') return;
    if (this.internalView === 'telemedicina') return;
    setTimeout(() => void this.mountTelemedicinaEmbedded(false), 0);
  }

  private async mountTelemedicinaEmbedded(isModalShell: boolean): Promise<void> {
    if (!this.hasAuth) {
      this.toast.error('Faça login para usar a telemedicina.', 'Telemedicina');
      return;
    }
    this.internalView = 'telemedicina';
    this.titulo = 'Telemedicina';
    if (!this.internalHost) return;
    this.internalHost.clear();
    try {
      const mod = await import('./telemedicina/telemedicina.component');
      const Cmp = (mod as any).TelemedicinaComponent;
      const ref = this.internalHost.createComponent(Cmp);
      if (ref?.instance) {
        (ref.instance as any).modal = isModalShell;
        const pet = this.pets?.[0];
        const tipo = (pet?.tipo || '').toLowerCase();
        (ref.instance as any).tutorPerfil = {
          nome: this.clienteData?.nome || this.clienteData?.user?.nome || 'Tutor',
          petNome: pet?.nome || 'Pet',
          petEspecie: tipo.includes('gato') || tipo.includes('felino') ? 'Felino' : 'Canino',
          petRaca: 'SRD',
        };
        try {
          (ref.instance as any).petsCatalogo = (this.pets || []).map((p) => ({
            id: p.id,
            nome: p.nome,
            tipo: p.tipo,
          }));
        } catch {
          /* ignore */
        }
        if ((ref.instance as any).close) {
          (ref.instance as any).close.subscribe(() => this.goBack());
        }
      }
    } catch (e) {
      console.error('Falha ao abrir Telemedicina', e);
      this.toast.error('Não foi possível abrir Telemedicina agora');
    }
  }

  private async openPetEditorInModal(petId: string | number): Promise<void> {
    try {
      this.internalView = 'novo-pet';
      this.titulo = 'Editar pet';
      this.internalHost?.clear();
      const mod = await import('../../../pages/novo-pet/novo-pet.component');
      const Cmp = (mod as any).NovoPetComponent;
      const ref = this.internalHost?.createComponent(Cmp);
      if (ref?.instance) {
        (ref.instance as any).modal = true;
        try { (ref.instance as any).editId = petId; } catch {}
        try { (ref.instance as any).clienteDataInjected = this.clienteData; } catch {}
        this.wireNovoPetModalListeners(ref.instance);
      }
    } catch (e) {
      console.error('Falha ao abrir editor de pet', e);
      this.toast.error('Não foi possível abrir o editor do pet agora');
    }
  }

  /** close + petSaved / petDeleted do cadastro/edição de pet no modal */
  private wireNovoPetModalListeners(instance: any) {
    if (!instance) return;
    if (instance.close) {
      instance.close.subscribe(() => this.goBack());
    }
    if (instance.petSaved) {
      instance.petSaved.subscribe(() => {
        const t = this.auth.getToken();
        if (t) this.refreshPetsForCliente(t);
        this.clienteAreaModal.notifyPetsChanged();
        this.open('meus-pets');
      });
    }
    if (instance.petDeleted) {
      instance.petDeleted.subscribe(() => {
        const t = this.auth.getToken();
        if (t) this.refreshPetsForCliente(t);
        this.clienteAreaModal.notifyPetsChanged();
        this.open('meus-pets');
      });
    }
  }

  private queueInitialViewOpen(): void {
    if (!this.modal) return;
    const view = this.pendingInitialView ?? this.initialView;
    if (!view) return;
    if (!this.hasAuth) {
      this.pendingInitialView = view;
      return;
    }
    this.pendingInitialView = null;
    setTimeout(() => {
      if (!this.internalView) {
        this.open(view as any);
      }
    });
  }

  /**
   * Após login (mapa → Enviar mensagem), abre o modal de chat.
   * Usa query `chatParceiro` ou sessionStorage `fp_post_login_chat_parceiro_id`.
   */
  private tryNavigateToChatAfterLogin(chatParceiroFromQuery: string | null): void {
    if (!this.isBrowser) {
      return;
    }
    let raw = chatParceiroFromQuery;
    if (!raw) {
      try {
        raw = sessionStorage.getItem('fp_post_login_chat_parceiro_id');
      } catch {
        raw = null;
      }
    }
    if (!raw) {
      return;
    }
    const id = Number(raw);
    if (!Number.isFinite(id) || id < 1) {
      try {
        sessionStorage.removeItem('fp_post_login_chat_parceiro_id');
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      sessionStorage.removeItem('fp_post_login_chat_parceiro_id');
    } catch {
      /* ignore */
    }
    this.partnerChatLauncher.openForPartner(id);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { chatParceiro: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
