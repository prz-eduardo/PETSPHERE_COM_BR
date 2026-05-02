import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../enviroments/environment';
import { BannerPosition } from '../shared/banner/banner-positions';
import { BannerDto } from './admin-api.service';
import { TenantLojaService } from './tenant-loja.service';

interface CacheEntry {
  expiresAt: number;
  banners: BannerDto[];
  stream$?: Observable<BannerDto[]>;
}

@Injectable({ providedIn: 'root' })
export class BannersPublicService {
  private readonly http = inject(HttpClient);
  private readonly tenantLoja = inject(TenantLojaService);
  private baseUrl = `${environment.apiBaseUrl}/banners`;
  private cache = new Map<string, CacheEntry>();
  private defaultTtlMs = 60_000;

  /**
   * Retorna banners ativos para uma posição, com cache em memória por 1 minuto
   * (evita múltiplas requisições quando vários componentes montam simultaneamente).
   * Com vitrine tenant (`loja_slug` resolvido), o backend mescla banners do parceiro com os globais.
   */
  list(posicao: BannerPosition): Observable<BannerDto[]> {
    const slug = this.tenantLoja.lojaSlug()?.trim() || '';
    const tenantKey = slug || 'global';
    const key = `${tenantKey}:${posicao}`;
    const now = Date.now();
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > now) return of(cached.banners);
    if (cached?.stream$) return cached.stream$;

    let params = new HttpParams().set('posicao', posicao);
    if (slug) params = params.set('loja_slug', slug);

    const stream$ = this.http.get<{ data: BannerDto[] }>(this.baseUrl, { params }).pipe(
      map((res) => (Array.isArray(res?.data) ? res.data : [])),
      tap((banners) => {
        this.cache.set(key, { banners, expiresAt: Date.now() + this.defaultTtlMs });
      }),
      catchError(() => {
        this.cache.delete(key);
        return of([] as BannerDto[]);
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
    this.cache.set(key, { banners: [], expiresAt: 0, stream$ });
    return stream$;
  }

  /** Limpa cache público (ex.: após gravar no painel do parceiro). */
  invalidate(posicao?: BannerPosition) {
    if (posicao) {
      for (const k of [...this.cache.keys()]) {
        if (k.endsWith(`:${posicao}`)) this.cache.delete(k);
      }
    } else {
      this.cache.clear();
    }
  }
}
