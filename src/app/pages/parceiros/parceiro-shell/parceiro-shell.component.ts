import { Component, OnInit, HostListener, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ParceiroAuthService } from '../../../services/parceiro-auth.service';
import { Colaborador } from '../../../types/agenda.types';

@Component({
  selector: 'app-parceiro-shell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './parceiro-shell.component.html',
  styleUrls: ['./parceiro-shell.component.scss'],
})
export class ParceiroShellComponent implements OnInit {
  colaborador = signal<Colaborador | null>(null);
  showUserMenu = signal(false);
  showVetMenu = signal(false);
  showClinicaMenu = signal(false);
  showMobileNav = signal(false);
  private currentUrl = '';

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
    const clinicaNavGroup = this.el.nativeElement.querySelector('.nav-group--clinica');
    if (clinicaNavGroup && !clinicaNavGroup.contains(target) && this.showClinicaMenu()) {
      this.showClinicaMenu.set(false);
    }

    const mobileNavNode = this.el.nativeElement.querySelector('.mobile-nav');
    const burgerNode = this.el.nativeElement.querySelector('.burger-btn');
    const clickedInMobile = (mobileNavNode && mobileNavNode.contains(target)) || (burgerNode && burgerNode.contains(target));
    if (!clickedInMobile && this.showMobileNav()) {
      this.showMobileNav.set(false);
    }
  }

  ngOnInit(): void {
    this.colaborador.set(this.auth.getCurrentColaborador());
    this.currentUrl = this.router.url;
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.currentUrl = e.urlAfterRedirects || e.url;
        this.showVetMenu.set(false);
        this.showClinicaMenu.set(false);
        this.showUserMenu.set(false);
        this.showMobileNav.set(false);
      });
  }

  isVetActive(): boolean {
    return this.currentUrl.includes('/parceiros/area-vet') ||
           this.currentUrl.includes('/parceiros/gerar-receita') ||
           this.currentUrl.includes('/parceiros/historico-receitas') ||
           this.currentUrl.includes('/parceiros/pacientes');
  }

  isClinicaFinanceiroActive(): boolean {
    return (
      this.currentUrl.includes('/parceiros/gestao-clinica') ||
      this.currentUrl.includes('/parceiros/financeiro-parceiro')
    );
  }

  isHospedagemActive(): boolean {
    return this.currentUrl.includes('/parceiros/reservas-hotel') ||
           this.currentUrl.includes('/parceiros/hospedagem');
  }

  toggleUserMenu(val?: boolean): void {
    this.showUserMenu.set(val ?? !this.showUserMenu());
    if (this.showUserMenu()) {
      this.showVetMenu.set(false);
      this.showClinicaMenu.set(false);
    }
  }

  toggleVetMenu(val?: boolean): void {
    this.showVetMenu.set(val ?? !this.showVetMenu());
    if (this.showVetMenu()) {
      this.showUserMenu.set(false);
      this.showClinicaMenu.set(false);
    }
  }

  toggleClinicaMenu(val?: boolean): void {
    this.showClinicaMenu.set(val ?? !this.showClinicaMenu());
    if (this.showClinicaMenu()) {
      this.showUserMenu.set(false);
      this.showVetMenu.set(false);
    }
  }

  toggleMobileNav(val?: boolean): void {
    this.showMobileNav.set(val ?? !this.showMobileNav());
    if (this.showMobileNav()) {
      this.showUserMenu.set(false);
      this.showVetMenu.set(false);
      this.showClinicaMenu.set(false);
    }
  }

  goToPainel(): void {
    this.router.navigate(['/parceiros/painel']);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/parceiros/login']);
  }
}
