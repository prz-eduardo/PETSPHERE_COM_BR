import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** Bump quando a política de cookies/privacidade mudar, para reexibir o aviso. */
export const COOKIE_CONSENT_POLICY_VERSION = 2;

export const LS_COOKIE_CONSENT_KEY = 'fp_cookie_consent_v1';

export interface CookiePreferences {
  policyVersion: number;
  /** Sempre true; o armazenamento da preferência e cookies necessários. */
  essential: true;
  analytics: boolean;
  thirdParty: boolean;
  savedAt: string;
}

function safeGetStorageItem(storage: Storage | undefined, key: string): string | null {
  if (!storage) {
    return null;
  }
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetStorageItem(storage: Storage | undefined, key: string, value: string): boolean {
  if (!storage) {
    return false;
  }
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

@Injectable({ providedIn: 'root' })
export class CookiePreferencesService {
  private readonly preferencesSubject = new BehaviorSubject<CookiePreferences | null>(this.readFromStorage());
  /**
   * True quando o usuário reabriu o painel pelo rodapé (já existia decisão).
   * Na primeira visita, o painel aparece com manageOpen falso.
   */
  private readonly manageOpenSubject = new BehaviorSubject(false);

  constructor(@Inject(PLATFORM_ID) private platformId: object) {}

  get preferences$(): Observable<CookiePreferences | null> {
    return this.preferencesSubject.asObservable();
  }

  get manageOpen$(): Observable<boolean> {
    return this.manageOpenSubject.asObservable();
  }

  /** Visível: sem decisão válida, ou o usuário abriu "gerir" pelo rodapé. */
  get bannerVisible$(): Observable<boolean> {
    return combineLatest([this.preferencesSubject, this.manageOpenSubject]).pipe(
      map(([p, manage]) => !this.isValid(p) || manage)
    );
  }

  isBannerVisible(): boolean {
    const p = this.preferencesSubject.getValue();
    return !this.isValid(p) || this.manageOpenSubject.getValue();
  }

  getSnapshot(): CookiePreferences | null {
    return this.preferencesSubject.getValue();
  }

  hasValidPreferences(): boolean {
    return this.isValid(this.preferencesSubject.getValue());
  }

  isValid(p: CookiePreferences | null | undefined): p is CookiePreferences {
    if (!p || typeof p !== 'object') {
      return false;
    }
    if (p.policyVersion !== COOKIE_CONSENT_POLICY_VERSION) {
      return false;
    }
    if (p.essential !== true) {
      return false;
    }
    if (typeof p.analytics !== 'boolean' || typeof p.thirdParty !== 'boolean') {
      return false;
    }
    return true;
  }

  /** Reabre o painel (ex.: link no rodapé "Preferências de cookies"). */
  openPreferencesPanel(): void {
    this.manageOpenSubject.next(true);
  }

  closeManagePanel(): void {
    this.manageOpenSubject.next(false);
  }

  /**
   * Concluindo o cadastro de cliente, gravamos no navegador as preferências padrão
   * (análise da loja e conteúdo de terceiros ativos), conforme descrito na política.
   * O utilizador pode alterar a qualquer momento em “Preferências de cookies”.
   */
  applyDefaultsOnNewClienteAccount(): void {
    this.save({ analytics: true, thirdParty: true });
  }

  /**
   * Após login (cliente ou vet), se o navegador ainda não tem decisão de cookies,
   * aplica os mesmos padrões do cadastro. Não altera preferências já salvas.
   */
  applyDefaultsIfNoConsentYet(): void {
    if (!this.hasValidPreferences()) {
      this.save({ analytics: true, thirdParty: true });
    }
  }

  save(prefs: Pick<CookiePreferences, 'analytics' | 'thirdParty'>): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    const next: CookiePreferences = {
      policyVersion: COOKIE_CONSENT_POLICY_VERSION,
      essential: true,
      analytics: prefs.analytics,
      thirdParty: prefs.thirdParty,
      savedAt: new Date().toISOString()
    };
    const payload = JSON.stringify(next);
    let anyPersisted = false;
    if (typeof localStorage !== 'undefined') {
      anyPersisted = safeSetStorageItem(localStorage, LS_COOKIE_CONSENT_KEY, payload) || anyPersisted;
    }
    if (typeof sessionStorage !== 'undefined') {
      anyPersisted = safeSetStorageItem(sessionStorage, LS_COOKIE_CONSENT_KEY, payload) || anyPersisted;
    }
    if (!anyPersisted) {
      /* ambos rejeitaram (ex. modo privado restrito); a memória ainda aplica na sessão atual */
    }
    this.manageOpenSubject.next(false);
    this.preferencesSubject.next(next);
  }

  /**
   * Releitura do storage (útil após hidratação no browser se a primeira leitura ocorrer cedo).
   * Idempotente: só emite se o snapshot válido do storage for diferente do valor atual.
   */
  rehydrateFromStorage(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    const p = this.parseStoredRaw();
    if (!p) {
      return;
    }
    const cur = this.preferencesSubject.getValue();
    if (
      !cur ||
      cur.policyVersion !== p.policyVersion ||
      cur.analytics !== p.analytics ||
      cur.thirdParty !== p.thirdParty
    ) {
      this.preferencesSubject.next(p);
    }
  }

  private readFromStorage(): CookiePreferences | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }
    if (typeof localStorage === 'undefined' && typeof sessionStorage === 'undefined') {
      return null;
    }
    return this.parseStoredRaw();
  }

  private parseStoredRaw(): CookiePreferences | null {
    const raw =
      safeGetStorageItem(typeof localStorage !== 'undefined' ? localStorage : undefined, LS_COOKIE_CONSENT_KEY) ??
      (typeof sessionStorage !== 'undefined'
        ? safeGetStorageItem(sessionStorage, LS_COOKIE_CONSENT_KEY)
        : null);
    if (!raw) {
      return null;
    }
    try {
      const p = JSON.parse(raw) as CookiePreferences;
      return this.isValid(p) ? p : null;
    } catch {
      return null;
    }
  }
}
