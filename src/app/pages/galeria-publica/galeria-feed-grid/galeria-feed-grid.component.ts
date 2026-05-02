import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  PLATFORM_ID,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ApiService } from '../../../services/api.service';
import { FeedAdItem, FeedPostItem, typeEmoji } from '../gallery-utils';

@Component({
  selector: 'app-galeria-feed-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './galeria-feed-grid.component.html',
  styleUrls: ['./galeria-feed-grid.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GaleriaFeedGridComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() items: FeedPostItem[] = [];
  @Input() ad: FeedAdItem | null = null;
  @Input() loading = false;
  @Input() loadingMore = false;
  @Input() hasMore = false;

  @Output() loadMore = new EventEmitter<void>();
  @Output() openPost = new EventEmitter<FeedPostItem>();
  @Output() openAd = new EventEmitter<FeedAdItem>();

  @ViewChild('sentinel', { static: false }) sentinel?: ElementRef<HTMLElement>;
  private observer?: IntersectionObserver;

  constructor(
    private api: ApiService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId) || typeof IntersectionObserver === 'undefined') return;
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && this.hasMore && !this.loadingMore && !this.loading) {
            this.loadMore.emit();
          }
        }
      },
      { rootMargin: '200px' }
    );
    setTimeout(() => {
      if (this.sentinel?.nativeElement && this.observer) {
        this.observer.observe(this.sentinel.nativeElement);
      }
    }, 100);
  }

  ngOnChanges(_: SimpleChanges): void {
    /* no-op */
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  // ---------------------------------------------------------------------------

  resolveImage(post: FeedPostItem): string {
    const raw = post.cover_url || post.galeria_urls[0] || '';
    return raw ? this.api.resolveMediaUrl(raw) : '/imagens/image.png';
  }

  resolveAdImage(ad: FeedAdItem): string {
    const raw = (ad?.foto || ad?.['photo'] || ad?.['photoURL'] || ad?.['url'] || '') as string;
    const s = typeof raw === 'string' ? raw.trim() : '';
    return s ? this.api.resolveMediaUrl(s) : '/imagens/image.png';
  }

  speciesEmoji(post: FeedPostItem): string {
    const especie = post.pet?.especie || (post.pets?.[0]?.especie ?? null);
    return typeEmoji(especie);
  }

  imgFallback(target: any): void {
    try {
      const el = target as HTMLImageElement | null;
      if (!el) return;
      if (!el.src || el.src.indexOf('/imagens/image.png') !== -1) return;
      el.src = '/imagens/image.png';
    } catch {
      /* noop */
    }
  }

  trackPostId = (_: number, post: FeedPostItem) => post.id;
}
