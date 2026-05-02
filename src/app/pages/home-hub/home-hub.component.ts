import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { MARCA_NOME } from '../../constants/loja-public';
import { DockContextService } from '../../services/dock-context.service';
import { ParceiroAuthService } from '../../services/parceiro-auth.service';

/**
 * Raiz do hub Petsphere (domínio principal, sem tenant).
 * Não exibe mais a página de escolha: redireciona conforme a lente Tutores | Profissionais
 * e sessão do prestador.
 */
@Component({
  selector: 'app-home-hub',
  standalone: true,
  imports: [],
  templateUrl: './home-hub.component.html',
  styleUrls: ['./home-hub.component.scss'],
})
export class HomeHubComponent implements OnInit {
  readonly marca = MARCA_NOME;

  constructor(
    private router: Router,
    private title: Title,
    private dock: DockContextService,
    private parceiroAuth: ParceiroAuthService,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  ngOnInit(): void {
    this.title.setTitle(this.marca);
    const url = this.resolveEntryUrl();
    void this.router.navigateByUrl(url, { replaceUrl: true });
  }

  /** SSR: sem sessionStorage da lente — destino seguro alinhado ao modo tutor. */
  private resolveEntryUrl(): string {
    if (!isPlatformBrowser(this.platformId)) {
      return '/galeria';
    }
    if (this.dock.prefersParceiroNavLens()) {
      return this.parceiroAuth.isLoggedIn() ? '/parceiros/painel' : '/parceiro/planos';
    }
    return '/galeria';
  }
}
