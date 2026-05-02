import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { ApiService, PostListResponse } from './api.service';
import {
  FeedAdItem,
  FeedPostItem,
  normalizeAd,
  normalizePost,
} from '../pages/galeria-publica/gallery-utils';

export interface GaleriaFeedState {
  items: FeedPostItem[];
  ad: FeedAdItem | null;
  page: number;
  pageSize: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  isEmpty: boolean;
}

const INITIAL_STATE: GaleriaFeedState = {
  items: [],
  ad: null,
  page: 0,
  pageSize: 20,
  hasMore: true,
  loading: false,
  loadingMore: false,
  error: null,
  isEmpty: false,
};

/**
 * Serviço dedicado para o feed público da galeria. Responsável por:
 *  - paginação (page/pageSize) e flag `hasMore`
 *  - dedupe de posts entre páginas
 *  - estado de loading/erro
 *  - resetar e atualizar (`reload`) quando um post novo é criado
 *
 * Não compartilha estado entre páginas (uma instância por componente).
 */
@Injectable()
export class GaleriaFeedService {
  private api = inject(ApiService);

  private readonly stateSubject = new BehaviorSubject<GaleriaFeedState>({ ...INITIAL_STATE });
  readonly state$: Observable<GaleriaFeedState> = this.stateSubject.asObservable();

  get state(): GaleriaFeedState {
    return this.stateSubject.value;
  }

  setPageSize(size: number): void {
    if (size > 0 && size <= 100) {
      this.patch({ pageSize: size });
    }
  }

  /** Reseta e carrega a primeira página. */
  async reload(token?: string): Promise<void> {
    this.patch({
      items: [],
      ad: null,
      page: 0,
      hasMore: true,
      loading: true,
      loadingMore: false,
      error: null,
      isEmpty: false,
    });
    await this.loadNext(token);
  }

  /** Carrega a próxima página (se ainda existir). */
  async loadNext(token?: string): Promise<void> {
    const s = this.state;
    if (!s.hasMore || s.loadingMore) return;
    const isFirst = s.page === 0;
    this.patch(isFirst ? { loading: true, error: null } : { loadingMore: true, error: null });

    try {
      const nextPage = s.page + 1;
      const res: PostListResponse = await firstValueFrom(
        this.api.getGaleriaPublica({ page: nextPage, pageSize: s.pageSize }, token)
      );

      const newItems = (res?.items || []).map((it) => normalizePost(it));
      const merged = isFirst ? newItems : this.dedupe([...s.items, ...newItems]);
      const ad = res?.ad ? normalizeAd(res.ad) : s.ad;

      this.patch({
        items: merged,
        ad,
        page: res?.page ?? nextPage,
        pageSize: res?.pageSize ?? s.pageSize,
        hasMore: !!res?.hasMore && newItems.length > 0,
        loading: false,
        loadingMore: false,
        isEmpty: isFirst && merged.length === 0,
      });
    } catch (err) {
      console.error('GaleriaFeedService.loadNext', err);
      this.patch({
        loading: false,
        loadingMore: false,
        error: 'Não foi possível carregar a galeria.',
      });
    }
  }

  /** Atualiza um post no feed (após reagir/comentar). */
  upsertPost(post: FeedPostItem): void {
    const items = this.state.items.slice();
    const idx = items.findIndex((p) => p.id === post.id);
    if (idx >= 0) items[idx] = post;
    else items.unshift(post);
    this.patch({ items });
  }

  /** Remove um post do feed (após exclusão pelo dono). */
  removePost(postId: number): void {
    const items = this.state.items.filter((p) => p.id !== postId);
    this.patch({ items });
  }

  reset(): void {
    this.stateSubject.next({ ...INITIAL_STATE });
  }

  // ---------------------------------------------------------------------------
  // helpers
  // ---------------------------------------------------------------------------

  private dedupe(items: FeedPostItem[]): FeedPostItem[] {
    const seen = new Set<number>();
    const out: FeedPostItem[] = [];
    for (const it of items) {
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      out.push(it);
    }
    return out;
  }

  private patch(partial: Partial<GaleriaFeedState>): void {
    this.stateSubject.next({ ...this.stateSubject.value, ...partial });
  }
}
