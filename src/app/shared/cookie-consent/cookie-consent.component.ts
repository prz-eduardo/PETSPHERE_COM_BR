import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { CookiePreferencesService } from '../../services/cookie-preferences.service';

@Component({
  selector: 'app-cookie-consent',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './cookie-consent.component.html',
  styleUrls: ['./cookie-consent.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CookieConsentComponent implements OnInit, OnDestroy {
  protected visible = false;
  protected customMode = false;
  /** Rascunho no modo "Personalizar" — padrão “liberado”; o utilizador desmarca o que não quiser. */
  protected draftAnalytics = true;
  protected draftThirdParty = true;
  /** True quando o usuário já tinha preferências e abriu "gerir" (pode fechar sem alterar). */
  private manageSession = false;
  private sub = new Subscription();
  /**
   * Não exibir o aviso de cookies nestas rotas: leitura da política, área admin e cadastro de produto
   * (o mesmo critério de `AppComponent` para nav/rodapé).
   */
  protected hideCookieByRoute = false;

  constructor(
    private readonly cookie: CookiePreferencesService,
    private readonly cdr: ChangeDetectorRef,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.syncRouteCookieVisibility();
    this.sub.add(
      this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe(() => {
          this.syncRouteCookieVisibility();
          this.cdr.markForCheck();
        })
    );
    this.sub.add(
      this.cookie.manageOpen$.subscribe((open) => {
        this.manageSession = open;
        this.cdr.markForCheck();
      })
    );
    this.sub.add(
      this.cookie.bannerVisible$.subscribe((v) => {
        this.visible = v;
        if (v) {
          this.hydrateDraft();
        }
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  private syncRouteCookieVisibility(): void {
    const path = (this.router.url || '').split('?')[0].split('#')[0];
    const onPolitica =
      path === '/politica-de-privacidade' || path.endsWith('/politica-de-privacidade');
    const onTermos = path === '/termos-de-uso' || path.endsWith('/termos-de-uso');
    const onAdminArea = path.startsWith('/restrito/admin') || path.startsWith('/restrito/produto');
    this.hideCookieByRoute = onPolitica || onTermos || onAdminArea;
  }

  private hydrateDraft(): void {
    const s = this.cookie.getSnapshot();
    if (this.cookie.isValid(s)) {
      this.draftAnalytics = s!.analytics;
      this.draftThirdParty = s!.thirdParty;
    } else {
      this.draftAnalytics = true;
      this.draftThirdParty = true;
    }
    this.customMode = false;
  }

  showCustomize(): void {
    this.hydrateDraft();
    this.customMode = true;
    this.cdr.markForCheck();
  }

  backFromCustomize(): void {
    this.customMode = false;
    this.cdr.markForCheck();
  }

  setDraftAnalytics(v: boolean): void {
    this.draftAnalytics = v;
    this.cdr.markForCheck();
  }

  setDraftThirdParty(v: boolean): void {
    this.draftThirdParty = v;
    this.cdr.markForCheck();
  }

  acceptAll(): void {
    this.cookie.save({ analytics: true, thirdParty: true });
  }

  rejectNonEssential(): void {
    this.cookie.save({ analytics: false, thirdParty: false });
  }

  saveCustom(): void {
    /*
     * PROD-REMOVER: rastreio da loja está forçado em `true` em todo save por Personalizar
     * (o checkbox ainda reflete a intenção do usuário na UI, mas a persistência ignora
     * enquanto isso). Antes de ir a produção com opt-in de verdade, volte a:
     * `analytics: this.draftAnalytics`
     */
    this.cookie.save({ analytics: true, thirdParty: this.draftThirdParty });
  }

  closeWithoutChanges(): void {
    if (!this.cookie.hasValidPreferences()) {
      return;
    }
    this.customMode = false;
    this.cookie.closeManagePanel();
  }

  canCloseSheet(): boolean {
    return this.cookie.hasValidPreferences();
  }

  isManageText(): boolean {
    return this.manageSession && this.cookie.hasValidPreferences();
  }

  /** Clico na área do contentor (fora do cartão) = mesmo efeito do fundo, quando for permitido. */
  onPanelShellClick(e: Event): void {
    if (e.target === e.currentTarget && this.canCloseSheet()) {
      this.closeWithoutChanges();
    }
  }
}
