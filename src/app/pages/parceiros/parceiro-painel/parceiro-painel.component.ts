import {
  Component,
  ElementRef,
  OnInit,
  OnDestroy,
  HostListener,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ParceiroAuthService } from '../../../services/parceiro-auth.service';
import { ParceiroCreditosService } from '../../../services/parceiro-creditos.service';
import { AdminHomeOverviewComponent } from '../../restrito/admin/home-overview/home-overview.component';
import { ParceiroPainelOperacaoVendasComponent } from './parceiro-painel-operacao-vendas/parceiro-painel-operacao-vendas.component';
import { ParceiroPainelOperacaoHotelariaComponent } from './parceiro-painel-operacao-hotelaria/parceiro-painel-operacao-hotelaria.component';

type SectionKey = 'operacao' | 'vet' | 'saas' | 'config';

export type ParceiroOperacaoTipo = 'vendas' | 'hotelaria';

const LS_HERO_FLIPPED = 'parceiro_painel_hero_flipped';
const LS_OPERACAO_TIPO = 'parceiro_painel_operacao_tipo';

@Component({
  selector: 'app-parceiro-painel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    AdminHomeOverviewComponent,
    ParceiroPainelOperacaoVendasComponent,
    ParceiroPainelOperacaoHotelariaComponent,
  ],
  templateUrl: './parceiro-painel.component.html',
  styleUrls: ['./parceiro-painel.component.scss'],
})
export class ParceiroPainelComponent implements OnInit, OnDestroy {
  @ViewChild('flipToggleBtn') private flipToggleBtn?: ElementRef<HTMLButtonElement>;
  @ViewChild('heroBackFocus') private heroBackFocus?: ElementRef<HTMLElement>;

  greeting = 'Olá';
  searchTerm = '';

  heroFlipped = false;
  operacaoTipo: ParceiroOperacaoTipo = 'vendas';

  /** Saldo de créditos PetSphere (hero + eco do header) */
  creditosSaldo: number | null = null;
  creditosLoading = false;

  private collapsed: Record<string, boolean> = {};

  private sectionItems: Record<SectionKey, string[]> = {
    operacao: [
      'agenda horários atendimento',
      'servicos cadastro preço duração banho tosa consulta loja vitrine produtos cupons promocoes',
      'meus clientes loja permissao dados lgpd tutores',
      'telemedicina video atendimento',
      'reservas hotel creche hospedagem pet baias acomodacoes espacos canil',
      'atendimento chat mensagens clientes conversas suporte omnichannel',
    ],
    vet: [
      'ativos formulas compostos ingredientes',
      'prontuario atendimento gerar receita prescricao veterinaria',
      'historico receitas',
      'pacientes pets clientes tutores',
    ],
    saas: [
      'petshop online loja ecommerce produtos catalogo inventario pagamento marketplace',
      'hotel creche hospedagem pets baias pet daycare',
      'adestramento treinamento comportamento',
      'planos assinatura financeiro cobranca creditos saldo consumo',
      'relatorios analytics dados',
    ],
    config: [
      'colaboradores equipe funcionarios',
      'configuracoes vitrine slug url subdominio site institucional pagamento mp mercado token',
      'perfil conta',
    ],
  };

  constructor(
    private router: Router,
    private parceiroAuth: ParceiroAuthService,
    private parceiroCreditos: ParceiroCreditosService,
  ) {}

  ngOnInit(): void {
    this.greeting = this.computeGreeting();
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem('parceiro_painel_collapsed') : null;
      if (raw) this.collapsed = JSON.parse(raw);
    } catch {
      /* noop */
    }
    if (this.collapsed['welcome']) {
      delete this.collapsed['welcome'];
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('parceiro_painel_collapsed', JSON.stringify(this.collapsed));
        }
      } catch {
        /* noop */
      }
    }

    try {
      if (typeof window !== 'undefined') {
        const f = localStorage.getItem(LS_HERO_FLIPPED);
        if (f !== null) this.heroFlipped = f === 'true';
        const t = localStorage.getItem(LS_OPERACAO_TIPO);
        if (t === 'vendas' || t === 'hotelaria') this.operacaoTipo = t;
      }
    } catch {
      /* noop */
    }

    this.loadCreditosSaldo();
  }

  ngOnDestroy(): void {}

  loadCreditosSaldo(): void {
    const h = this.parceiroAuth.getAuthHeaders() as { Authorization?: string };
    if (!h.Authorization) return;
    this.creditosLoading = true;
    this.parceiroCreditos.getSaldo(h as { Authorization: string }).subscribe({
      next: (r) => {
        this.creditosSaldo = Number(r.saldo) || 0;
        this.creditosLoading = false;
      },
      error: () => {
        this.creditosSaldo = null;
        this.creditosLoading = false;
      },
    });
  }

  fmtCreditos(n: number): string {
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(n);
  }

  private computeGreeting(): string {
    const h = new Date().getHours();
    if (h < 5) return 'Boa madrugada';
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    const target = ev.target as HTMLElement | null;
    const typing = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
    if (!typing && ev.key === '/') {
      const input = document.querySelector<HTMLInputElement>('.hero-search input');
      if (input) {
        ev.preventDefault();
        input.focus();
      }
    }
  }

  toggleHeroFlip(): void {
    this.heroFlipped = !this.heroFlipped;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(LS_HERO_FLIPPED, JSON.stringify(this.heroFlipped));
      }
    } catch {
      /* noop */
    }

    const delayMs = 360;
    if (this.heroFlipped) {
      setTimeout(() => this.heroBackFocus?.nativeElement?.focus(), delayMs);
    } else {
      setTimeout(() => this.flipToggleBtn?.nativeElement?.focus(), delayMs);
    }
  }

  onOperacaoTipoChange(): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(LS_OPERACAO_TIPO, this.operacaoTipo);
      }
    } catch {
      /* noop */
    }
  }

  private normalize(v: string): string {
    return (v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

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

  isCollapsed(key: string): boolean {
    return !!this.collapsed[key];
  }

  toggleSection(key: string): void {
    this.collapsed[key] = !this.collapsed[key];
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('parceiro_painel_collapsed', JSON.stringify(this.collapsed));
      }
    } catch {
      /* noop */
    }
  }

  // ── Navigation ──────────────────────────────────────────────────────────────
  goToAgenda(): void {
    this.router.navigate(['/parceiros/agenda']);
  }
  goToAreaVet(): void {
    this.router.navigate(['/parceiros/area-vet']);
  }
  goToGerarReceita(): void {
    this.router.navigate(['/parceiros/gerar-receita']);
  }
  goToHistorico(): void {
    this.router.navigate(['/parceiros/historico-receitas']);
  }
  goToPacientes(): void {
    this.router.navigate(['/parceiros/pacientes']);
  }
  goToColaboradores(): void {
    this.router.navigate(['/parceiros/colaboradores']);
  }
  goToServicos(): void {
    this.router.navigate(['/parceiros/servicos']);
  }
  goToMeusClientes(): void {
    this.router.navigate(['/parceiros/meus-clientes']);
  }
  goToReservasHotel(): void {
    this.router.navigate(['/parceiros/hospedagem']);
  }
  goToConfiguracoes(): void {
    this.router.navigate(['/parceiros/configuracoes']);
  }
  goToPetshopOnline(): void {
    this.router.navigate(['/parceiros/petshop-online']);
  }
  goToComercial(): void {
    this.router.navigate(['/parceiros/petshop-online']);
  }
  goToTelemedicina(): void {
    this.router.navigate(['/parceiros/telemedicina-emergencial']);
  }

  goToMensagens(): void {
    this.router.navigate(['/parceiros/mensagens']);
  }

  goToPlanosCreditos(): void {
    this.router.navigate(['/parceiros/planos-assinatura']);
  }
}
