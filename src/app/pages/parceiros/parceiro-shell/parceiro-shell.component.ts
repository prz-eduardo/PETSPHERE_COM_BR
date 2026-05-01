import { Component, OnInit, HostListener, ElementRef, signal, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { ParceiroCreditsBadgeComponent } from '../../../shared/parceiro-credits-badge/parceiro-credits-badge.component';
import { filter } from 'rxjs/operators';
import { ParceiroAuthService } from '../../../services/parceiro-auth.service';
import { ParceirosMobileShellService } from '../../../services/parceiros-mobile-shell.service';
import { Colaborador } from '../../../types/agenda.types';
import { VetWizardSessionService, WizardSession } from '../../../services/vet-wizard-session.service';

@Component({
  selector: 'app-parceiro-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, ParceiroCreditsBadgeComponent],
  templateUrl: './parceiro-shell.component.html',
  styleUrls: ['./parceiro-shell.component.scss'],
})
export class ParceiroShellComponent implements OnInit {
  colaborador = signal<Colaborador | null>(null);
  showUserMenu = signal(false);
  showVetMenu = signal(false);
  showAtendimentoMenu = signal(false);
  showComercialMenu = signal(false);
  showGestaoMenu = signal(false);
  showMobileNav = signal(false);
  activeWizardSession = signal<WizardSession | null>(null);
  private currentUrl = '';

  private readonly destroyRef = inject(DestroyRef);
  private readonly partnerDrawerBridge = inject(ParceirosMobileShellService);
  private readonly wizardSvc = inject(VetWizardSessionService);

  constructor(
    private auth: ParceiroAuthService,
    private router: Router,
    private el: ElementRef,
  ) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as Node;

    const tipoNode = this.el.nativeElement.querySelector('.tipo-switcher');
    if (tipoNode && !tipoNode.contains(target) && this.showUserMenu()) {
      this.showUserMenu.set(false);
    }

    const vetNavGroup = this.el.nativeElement.querySelector('.nav-group--vet');
    if (vetNavGroup && !vetNavGroup.contains(target) && this.showVetMenu()) {
      this.showVetMenu.set(false);
    }
    const atendimentoNavGroup = this.el.nativeElement.querySelector('.nav-group--atendimento');
    const atendimentoMobile = this.el.nativeElement.querySelector('.mobile-group--atendimento');
    const insideAtendimento =
      (atendimentoNavGroup && atendimentoNavGroup.contains(target)) ||
      (atendimentoMobile && atendimentoMobile.contains(target));
    if (!insideAtendimento && this.showAtendimentoMenu()) {
      this.showAtendimentoMenu.set(false);
    }

    const comercialNavGroup = this.el.nativeElement.querySelector('.nav-group--comercial');
    const comercialMobile = this.el.nativeElement.querySelector('.mobile-group--comercial');
    const insideComercial =
      (comercialNavGroup && comercialNavGroup.contains(target)) ||
      (comercialMobile && comercialMobile.contains(target));
    if (!insideComercial && this.showComercialMenu()) {
      this.showComercialMenu.set(false);
    }

    const gestaoNavGroup = this.el.nativeElement.querySelector('.nav-group--gestao');
    const gestaoMobile = this.el.nativeElement.querySelector('.mobile-group--gestao');
    const insideGestao =
      (gestaoNavGroup && gestaoNavGroup.contains(target)) ||
      (gestaoMobile && gestaoMobile.contains(target));
    if (!insideGestao && this.showGestaoMenu()) {
      this.showGestaoMenu.set(false);
    }

    const mobileNavNode = this.el.nativeElement.querySelector('.mobile-nav');
    const burgerNode = this.el.nativeElement.querySelector('.burger-btn');
    const clickedInMobile =
      (mobileNavNode && mobileNavNode.contains(target)) || (burgerNode && burgerNode.contains(target));
    const globalNav =
      typeof document !== 'undefined' ? document.querySelector('nav.app-navbar') : null;
    const clickedInPetsphereNav =
      !!(target instanceof Node && globalNav && globalNav.contains(target));
    if (!clickedInMobile && !clickedInPetsphereNav && this.showMobileNav()) {
      this.showMobileNav.set(false);
    }
  }

  ngOnInit(): void {
    this.colaborador.set(this.auth.getCurrentColaborador());
    this.currentUrl = this.router.url;
    this.wizardSvc.session$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(s => this.activeWizardSession.set(s));
    this.partnerDrawerBridge.openPartnerDrawer$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() =>
        queueMicrotask(() => {
          if (typeof window === 'undefined') return;
          try {
            if (!window.matchMedia('(max-width: 767px)').matches) return;
          } catch {
            return;
          }
          this.toggleMobileNav(true);
        }),
      );

    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.currentUrl = e.urlAfterRedirects || e.url;
        this.showVetMenu.set(false);
        this.showAtendimentoMenu.set(false);
        this.showComercialMenu.set(false);
        this.showGestaoMenu.set(false);
        this.showUserMenu.set(false);
        this.showMobileNav.set(false);
      });
  }

  isVetActive(): boolean {
    return this.currentUrl.includes('/parceiros/area-vet') ||
           this.currentUrl.includes('/parceiros/gerar-receita') ||
           this.currentUrl.includes('/parceiros/historico-receitas') ||
           this.currentUrl.includes('/parceiros/pacientes') ||
           this.currentUrl.includes('/parceiros/panorama-atendimento') ||
           this.currentUrl.includes('/parceiros/vet-cockpit') ||
           this.currentUrl.includes('/parceiros/atendimento-wizard') ||
           this.currentUrl.includes('/parceiros/vet-atendimento-ia');
  }

  isAtendimentoActive(): boolean {
    return (
      this.currentUrl.includes('/parceiros/servicos') ||
      this.currentUrl.includes('/parceiros/meus-clientes') ||
      this.currentUrl.includes('/parceiros/gestao-tutores-aulas') ||
      this.currentUrl.includes('/parceiros/telemedicina-emergencial') ||
      this.currentUrl.includes('/parceiros/reservas-hotel') ||
      this.currentUrl.includes('/parceiros/hospedagem') ||
      this.currentUrl.includes('/parceiros/transporte-pet')
    );
  }

  isGestaoActive(): boolean {
    return (
      this.currentUrl.includes('/parceiros/colaboradores') ||
      this.currentUrl.includes('/parceiros/configuracoes') ||
      this.currentUrl.includes('/parceiros/minha-loja') ||
      this.currentUrl.includes('/parceiros/gestao-clinica') ||
      this.currentUrl.includes('/parceiros/financeiro-parceiro') ||
      this.currentUrl.includes('/parceiros/planos-assinatura')
    );
  }

  isHospedagemActive(): boolean {
    return this.currentUrl.includes('/parceiros/reservas-hotel') ||
           this.currentUrl.includes('/parceiros/hospedagem');
  }

  isComercialActive(): boolean {
    return (
      this.currentUrl.includes('/parceiros/petshop-online') ||
      this.currentUrl.includes('/parceiros/catalogo-produto') ||
      this.currentUrl.includes('/parceiros/inventario-pos') ||
      this.currentUrl.includes('/parceiros/caixa')
    );
  }

  toggleUserMenu(val?: boolean): void {
    this.showUserMenu.set(val ?? !this.showUserMenu());
    if (this.showUserMenu()) {
      this.showVetMenu.set(false);
      this.showAtendimentoMenu.set(false);
      this.showComercialMenu.set(false);
      this.showGestaoMenu.set(false);
    }
  }

  toggleAtendimentoMenu(val?: boolean): void {
    this.showAtendimentoMenu.set(val ?? !this.showAtendimentoMenu());
    if (this.showAtendimentoMenu()) {
      this.showUserMenu.set(false);
      this.showComercialMenu.set(false);
      this.showGestaoMenu.set(false);
      this.showVetMenu.set(false);
    }
  }

  toggleComercialMenu(val?: boolean): void {
    this.showComercialMenu.set(val ?? !this.showComercialMenu());
    if (this.showComercialMenu()) {
      this.showUserMenu.set(false);
      this.showAtendimentoMenu.set(false);
      this.showGestaoMenu.set(false);
      this.showVetMenu.set(false);
    }
  }

  toggleGestaoMenu(val?: boolean): void {
    this.showGestaoMenu.set(val ?? !this.showGestaoMenu());
    if (this.showGestaoMenu()) {
      this.showUserMenu.set(false);
      this.showAtendimentoMenu.set(false);
      this.showComercialMenu.set(false);
      this.showVetMenu.set(false);
    }
  }

  toggleVetMenu(val?: boolean): void {
    this.showVetMenu.set(val ?? !this.showVetMenu());
    if (this.showVetMenu()) {
      this.showUserMenu.set(false);
      this.showAtendimentoMenu.set(false);
      this.showComercialMenu.set(false);
      this.showGestaoMenu.set(false);
    }
  }

  toggleMobileNav(val?: boolean): void {
    this.showMobileNav.set(val ?? !this.showMobileNav());
    if (this.showMobileNav()) {
      this.showUserMenu.set(false);
      this.showVetMenu.set(false);
      this.showAtendimentoMenu.set(false);
      this.showComercialMenu.set(false);
      this.showGestaoMenu.set(false);
    }
  }

  goToPainel(): void {
    this.router.navigate(['/parceiros/painel']);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/parceiros/login']);
  }

  /** Fecha o drawer e pede ao navmenu global que abra o radial de atalhos (mobile parceiro). */
  openPartnerFabRadialFromMenu(): void {
    this.toggleMobileNav(false);
    queueMicrotask(() => this.partnerDrawerBridge.requestOpenPartnerFabRadial());
  }

  /** Fecha o drawer e pede ao navmenu global que abra o sheet de ações rápidas. */
  openPartnerFabSheetFromMenu(): void {
    this.toggleMobileNav(false);
    queueMicrotask(() => this.partnerDrawerBridge.requestOpenPartnerFabSheet());
  }
}
