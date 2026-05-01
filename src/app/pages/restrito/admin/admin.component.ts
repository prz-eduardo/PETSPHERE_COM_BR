import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { SessionService } from '../../../services/session.service';
import { ButtonDirective, ButtonComponent } from '../../../shared/button';

import { AdminNotificationComponent } from '../../../admin-notification/admin-notification.component';
import { AdminHeaderComponent } from '../../../shared/admin-header/admin-header.component';
import { AdminHomeOverviewComponent } from './home-overview/home-overview.component';
import { MARCA_NOME } from '../../../constants/loja-public';
import { AdminMonetizacaoService, CreditosResumo } from '../../../services/admin-monetizacao.service';
import { AdminCreditsSummaryComponent } from '../../../shared/admin-credits-summary/admin-credits-summary.component';

type SectionKey = 'inteligencia' | 'catalogo' | 'petshop' | 'pessoas' | 'operacao' | 'monetizacao';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterOutlet,
    ButtonDirective,
    ButtonComponent,
    AdminNotificationComponent,
    AdminHeaderComponent,
    AdminHomeOverviewComponent,
    AdminCreditsSummaryComponent,
  ],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss'],
})
export class AdminComponent implements OnInit, OnDestroy {
  readonly marcaNome = MARCA_NOME;
  headerTitle = 'ADMIN PANEL';
  hasProducts = true;
  isAdmin = false;
  isSuper = false;
  showUserMenu = false;
  isRootView = true;

  searchTerm = '';
  greeting = 'Olá novamente';

  private routerSub?: Subscription;
  private collapsed: Record<string, boolean> = {};
  private creditosPoll?: ReturnType<typeof setInterval>;

  /** Resumo agregado de créditos (widget header + banner hero) */
  creditosResumo: CreditosResumo | null = null;
  creditosResumoLoading = false;
  creditosResumoError: string | null = null;

  /** Map of section key -> list of searchable keyword groups (one per item). */
  private sectionItems: Record<SectionKey, string[]> = {
    inteligencia: ['dashboard'],
    catalogo: [
      'ativos ingredientes',
      'formulas receitas',
      'marketplace categorias vitrine',
      'marketplace tags vitrine',
      'temas vitrine loja cores',
    ],
    petshop: [
      'cadastrar produto novo',
      'lista produtos listagem',
      'cupons desconto',
      'promocoes ofertas',
    ],
    pessoas: [
      'gerenciar usuarios admins',
      'gerenciar clientes',
      'rastreio atividade loja tráfego visitas',
      'veterinarios vet',
      'parceiros gestao',
      'pets galeria moderação tutor fotos',
    ],
    operacao: [
      'banners',
      'pedidos compras',
      'atendimento chat suporte fila',
      'email resend teste ferramenta',
    ],
    monetizacao: [
      'planos saas tier mensal hibrido',
      'creditos saldos extrato consumo billing',
      'transporte pet corridas motorista split mercado',
    ],
  };

  constructor(
    private router: Router,
    private session: SessionService,
    private monetizacao: AdminMonetizacaoService,
  ) {}

  async ngOnInit() {
    if (!this.session.hasValidSession(true)) {
      this.router.navigate(['/restrito/login']);
      return;
    }
    this.isAdmin = this.session.isAdmin();
    this.isSuper = this.session.isSuper();

    this.greeting = this.computeGreeting();

    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('admin_collapsed') : null;
      if (raw) this.collapsed = JSON.parse(raw);
    } catch {}

    try {
      const u = this.router.url || '';
      this.isRootView = u === '/restrito/admin' || u === '/restrito/admin/';
      this.updateHeaderTitle();
      this.routerSub = this.router.events
        .pipe(filter((e) => e instanceof NavigationEnd))
        .subscribe((ev: any) => {
          const nu = ev.urlAfterRedirects || ev.url || '';
          this.isRootView = nu === '/restrito/admin' || nu === '/restrito/admin/';
          this.updateHeaderTitle();
        });
    } catch {}

    this.loadCreditosResumo();
    this.creditosPoll = setInterval(() => this.loadCreditosResumo(), 120_000);
  }

  ngOnDestroy() {
    try { this.routerSub?.unsubscribe(); } catch {}
    if (this.creditosPoll) clearInterval(this.creditosPoll);
  }

  loadCreditosResumo() {
    this.creditosResumoLoading = true;
    this.monetizacao.getCreditosResumo().subscribe({
      next: (r) => {
        this.creditosResumo = r;
        this.creditosResumoLoading = false;
        this.creditosResumoError = null;
      },
      error: () => {
        this.creditosResumoLoading = false;
        this.creditosResumoError = 'Falha ao carregar';
      },
    });
  }

  private computeGreeting(): string {
    const h = new Date().getHours();
    if (h < 5) return 'Boa madrugada';
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  private updateHeaderTitle() {
    try {
      let route: any = this.router.routerState.root;
      while (route.firstChild) route = route.firstChild;
      const title = route?.snapshot?.data?.['title'];
      this.headerTitle = title ? title : 'ADMIN PANEL';
    } catch {
      this.headerTitle = 'ADMIN PANEL';
    }
  }

  /** Keyboard shortcut: focus search on "/" */
  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent) {
    const target = ev.target as HTMLElement | null;
    const typing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
    if (!typing && ev.key === '/' && this.isRootView) {
      const input = document.querySelector<HTMLInputElement>('.hero-search input');
      if (input) { ev.preventDefault(); input.focus(); }
    }
  }

  // -------- Search helpers --------
  private normalize(v: string): string {
    return (v || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  /** Returns true when the given item keywords match the current search term. */
  matches(keywords: string): boolean {
    const q = this.normalize(this.searchTerm);
    if (!q) return true;
    return this.normalize(keywords).includes(q);
  }

  sectionHasMatches(key: SectionKey): boolean {
    if (!this.searchTerm) return true;
    return (this.sectionItems[key] || []).some((k) => this.matches(k));
  }

  sectionCount(key: SectionKey): number {
    if (!this.searchTerm) return (this.sectionItems[key] || []).length;
    return (this.sectionItems[key] || []).filter((k) => this.matches(k)).length;
  }

  hasAnyMatch(): boolean {
    return (Object.keys(this.sectionItems) as SectionKey[]).some((k) => this.sectionHasMatches(k));
  }

  // -------- Navigation --------
  logout() {
    this.session.saveBackendToken('');
    this.router.navigate(['/restrito/login']);
  }

  goToCadastro() { this.router.navigate(['/restrito/produto']); }
  goToLista() { this.router.navigate(['/restrito/lista-produtos']); }
  goToUsuarios() { this.router.navigate(['/restrito/admin/usuarios']); }

  goToHistoricoReceitas() { this.router.navigate(['/historico-receitas']); }
  goToPacientes() { this.router.navigate(['/pacientes']); }
  goToAreaVet() { this.router.navigate(['/area-vet']); }
  goToLoja() { this.router.navigate(['/loja']); }
  goToPerfil() { this.router.navigate(['/restrito/admin/meu-perfil-admin']); }

  goToDashboard() { this.router.navigate(['/restrito/admin/dashboard']); }
  goToEstoque() { this.router.navigate(['/restrito/admin/estoque']); }
  goToClientes() { this.router.navigate(['/restrito/admin/clientes']); }
  goToRastreioClientes() { this.router.navigate(['/restrito/admin/rastreio']); }
  goToVeterinarios() { this.router.navigate(['/restrito/admin/veterinarios']); }
  goToBanners() { this.router.navigate(['/restrito/admin/banners']); }
  goToPedidos() { this.router.navigate(['/restrito/admin/pedidos']); }
  goToCupons() { this.router.navigate(['/restrito/admin/cupons']); }
  goToPromocoes() { this.router.navigate(['/restrito/admin/promocoes']); }
  goToRelatorios() { this.router.navigate(['/restrito/admin/relatorios']); }
  goToConfiguracoes() { this.router.navigate(['/restrito/admin/configuracoes']); }
  goToFormulas() { this.router.navigate(['/restrito/admin/formulas']); }
  goToMarketplaceCategorias() { this.router.navigate(['/restrito/admin/marketplace/categorias']); }
  goToMarketplaceTags() { this.router.navigate(['/restrito/admin/marketplace/tags']); }
  goToLojaTemas() { this.router.navigate(['/restrito/admin/loja/temas']); }
  goToFornecedores() { this.router.navigate(['/restrito/admin/fornecedores']); }
  goToAtivos() { this.router.navigate(['/restrito/admin/ativos']); }
  goToInsumos() { this.router.navigate(['/restrito/admin/insumos']); }
  goToParceiros() { this.router.navigate(['/restrito/admin/parceiros']); }
  goToPetsGaleria() { this.router.navigate(['/restrito/admin/pets-galeria']); }
  goToAtendimento() { this.router.navigate(['/restrito/admin/atendimento']); }
  goToEmailTeste() { this.router.navigate(['/restrito/admin/ferramentas/email-teste']); }

  goToPlanos() { this.router.navigate(['/restrito/admin/planos']); }
  goToCreditos() { this.router.navigate(['/restrito/admin/creditos']); }
  goToTransportePet() { this.router.navigate(['/restrito/admin/transporte-pet']); }
  // -------- Header user menu --------
  toggleUserMenu(force?: boolean) {
    this.showUserMenu = typeof force === 'boolean' ? force : !this.showUserMenu;
  }

  // -------- Collapsible sections --------
  isCollapsed(key: string): boolean { return !!this.collapsed[key]; }

  toggleSection(key: string) {
    this.collapsed[key] = !this.collapsed[key];
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('admin_collapsed', JSON.stringify(this.collapsed));
      }
    } catch {}
  }
}
