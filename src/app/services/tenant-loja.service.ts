import { Injectable, signal, computed, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface TenantLojaPublicProfile {
  id: number;
  nome: string;
  loja_slug: string | null;
  descricao?: string | null;
  logo_url?: string | null;
  texto_institucional?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  [k: string]: unknown;
}

export interface TenantLojaHospedagemOfertaItem {
  slug: string;
  label_pt: string;
}

/** Contrato estável GET /anunciantes/por-slug/:slug/hospedagem — campos extras para filtros e vitrine no mapa. */
export interface TenantLojaHospedagemLeitoPublic {
  id: number;
  nome: string;
  tipo: string;
  capacidade: number;
  foto_url: string | null;
  /** Primeira foto da galeria usada pela UI quando há ordem preservada pela API */
  galeria_urls?: string[];
  video_url?: string | null;
  preco_diaria: number | null;
  servicos_oferta: TenantLojaHospedagemOfertaItem[];
  /** Slugs infra com labels já resolvidas */
  infra?: TenantLojaHospedagemOfertaItem[];
  acomodacao_tipos?: TenantLojaHospedagemOfertaItem[];
  capacidade_pequeno?: number | null;
  capacidade_medio?: number | null;
  capacidade_grande?: number | null;
  nivel_conforto?: string | null;
  ambiente?: string | null;
  convivencia?: Record<string, unknown> | null;
  saude_perfil?: Record<string, unknown> | null;
  regras_operacionais?: Record<string, unknown> | null;
  vitrine_nivel?: string | null;
  midia_por_ambiente?: unknown[] | null;
}

export interface TenantLojaHospedagemPublic {
  leitos: TenantLojaHospedagemLeitoPublic[];
  hotel_servicos_globais: TenantLojaHospedagemOfertaItem[];
}

@Injectable({ providedIn: 'root' })
export class TenantLojaService {
  private readonly baseUrl = environment.apiBaseUrl;

  /** Slug normalizado da vitrine (subdomínio ou query ?loja= em dev). */
  readonly lojaSlug = signal<string | null>(null);
  readonly profile = signal<TenantLojaPublicProfile | null>(null);
  /** Acomodações na vitrine + ofertas globais do hotel (só preenchido em contexto de loja tenant). */
  readonly hospedagemPublic = signal<TenantLojaHospedagemPublic | null>(null);
  readonly resolvedFromCustomDomain = signal(false);
  /**
   * Host é vitrine dedicada (ex.: `loja.petsphere.com.br`, `loja.localhost`) — só tutor + loja,
   * antes do perfil carregar ou se o slug for inválido. Usado para esconder o toggle Tutores|Profissionais
   * e ignorar sessionStorage da lente prestador neste host.
   */
  readonly isTenantDedicatedHost = signal(false);
  /** Uma única Promise compartilhada: listagens da loja devem aguardar antes de chamar a API com `parceiro_slug`. */
  private hostInitPromise: Promise<void> | null = null;

  readonly isTenantLoja = computed(() => !!this.lojaSlug() && !!this.profile());

  readonly displayBrandName = computed(() => {
    const p = this.profile();
    return (p?.nome as string) || null;
  });

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      try {
        const host = (window.location.hostname || '').toLowerCase();
        this.isTenantDedicatedHost.set(this.computeDedicatedTenantHostFromHostname(host));
      } catch {
        /* ignore */
      }
    }
  }

  /**
   * Aguarda a resolução do host (subdomínio / ?loja=) e do perfil público.
   * Chamado por `StoreService` antes de listar produtos/categorias para não perder o `parceiro_slug`.
   */
  ensureHostResolved(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      return Promise.resolve();
    }
    if (!this.hostInitPromise) {
      this.hostInitPromise = this.runHostInit();
    }
    return this.hostInitPromise;
  }

  /**
   * Resolve host/subdomínio e carrega perfil público (aprovado).
   * Chamado no bootstrap (AppComponent); equivalente a `ensureHostResolved()`.
   */
  async initFromLocation(): Promise<void> {
    return this.ensureHostResolved();
  }

  /** Subdomínio de vitrine Petsphere / dev `.localhost` (exclui `www`). */
  private computeDedicatedTenantHostFromHostname(host: string): boolean {
    const h = (host || '').toLowerCase();
    if (h.endsWith('.petsphere.com.br')) {
      const sub = h.replace(/\.petsphere\.com\.br$/i, '');
      return !!(sub && sub !== 'www');
    }
    if (h.endsWith('.localhost')) {
      const sub = h.replace(/\.localhost$/i, '');
      return !!(sub && sub !== 'www');
    }
    return false;
  }

  private async runHostInit(): Promise<void> {
    let host = '';
    try {
      host = (window.location.hostname || '').toLowerCase();
    } catch {
      return;
    }

    this.isTenantDedicatedHost.set(this.computeDedicatedTenantHostFromHostname(host));

    let prof: TenantLojaPublicProfile | null = null;
    let slug: string | null = null;
    let fromCustom = false;

    try {
      const res = await firstValueFrom(
        this.http
          .get<{ source?: string; parceiro?: TenantLojaPublicProfile }>(
            `${this.baseUrl}/anunciantes/resolve-host`,
            { params: { host } }
          )
          .pipe(catchError(() => of(null)))
      );
      if (res?.parceiro?.loja_slug) {
        prof = res.parceiro as TenantLojaPublicProfile;
        slug = String(res.parceiro.loja_slug);
        fromCustom = true;
      }
    } catch {
      /* ignore */
    }

    if (!slug) {
      if (host.endsWith('.petsphere.com.br')) {
        const sub = host.replace(/\.petsphere\.com\.br$/i, '');
        if (sub && sub !== 'www') slug = sub.toLowerCase();
      }
    }

    if (!slug && host.endsWith('.localhost')) {
      const sub = host.replace(/\.localhost$/i, '');
      if (sub && sub !== 'www') slug = this.normalizeClientSlug(sub);
    }

    if (!slug && (host === 'localhost' || host === '127.0.0.1')) {
      try {
        const q = new URLSearchParams(window.location.search).get('loja');
        if (q) slug = this.normalizeClientSlug(q);
      } catch {
        /* ignore */
      }
    }

    if (slug) {
      try {
        prof = await firstValueFrom(
          this.http.get<TenantLojaPublicProfile>(`${this.baseUrl}/anunciantes/por-slug/${encodeURIComponent(slug)}`)
        );
      } catch {
        prof = null;
        slug = null;
      }
    }

    this.resolvedFromCustomDomain.set(fromCustom);
    this.lojaSlug.set(slug);
    this.profile.set(prof);
    if (prof && slug) {
      await this.loadHospedagemVitrine(slug);
    } else {
      this.hospedagemPublic.set(null);
    }
  }

  private async loadHospedagemVitrine(slug: string): Promise<void> {
    try {
      const data = await firstValueFrom(
        this.http
          .get<TenantLojaHospedagemPublic>(
            `${this.baseUrl}/anunciantes/por-slug/${encodeURIComponent(slug)}/hospedagem`
          )
          .pipe(catchError(() => of(null)))
      );
      this.hospedagemPublic.set(
        data && typeof data === 'object'
          ? {
              leitos: Array.isArray(data.leitos) ? data.leitos : [],
              hotel_servicos_globais: Array.isArray(data.hotel_servicos_globais) ? data.hotel_servicos_globais : [],
            }
          : null
      );
    } catch {
      this.hospedagemPublic.set(null);
    }
  }

  parceiroId(): number | null {
    const id = this.profile()?.id;
    return id != null ? Number(id) : null;
  }

  private normalizeClientSlug(raw: string): string {
    let s = String(raw || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    s = s.replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-');
    return s.replace(/^-|-$/g, '');
  }
}
