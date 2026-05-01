import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  NotificationItem,
  NotificationsService,
} from '../../services/notifications.service';
import { PsIconComponent } from '../icons/ps-icon.component';

@Component({
  selector: 'app-notifications-bell',
  standalone: true,
  imports: [CommonModule, PsIconComponent],
  templateUrl: './notifications-bell.component.html',
  styleUrls: ['./notifications-bell.component.scss'],
})
export class NotificationsBellComponent implements OnInit, OnDestroy {
  @Input() audience: 'admin' | 'cliente' = 'cliente';
  @Input() compact = false;
  /** Painel em tela inteira (ex.: pela navbar ou sheet), não limitado ao host estreito. */
  @Input() fullscreenPanel = false;
  /** Encaixa no dock mobile (mesma hierarquia visual: ícone + rótulo). */
  @Input() dockEmbed = false;

  /** Só usado no dock + fullscreen: o nav ajusta z-index do FAB vs painel. */
  @Output() openChange = new EventEmitter<boolean>();

  open = false;
  mobileLayout = false;
  filter: 'all' | 'unread' = 'all';

  notifications: NotificationItem[] = [];
  unread = 0;
  loading = false;

  private subs: Subscription[] = [];

  constructor(
    private svc: NotificationsService,
    private router: Router,
    private host: ElementRef<HTMLElement>,
  ) {}

  ngOnInit() {
    this.syncViewportMode();
    this.subs.push(this.svc.notifications$.subscribe(list => {
      this.notifications = (list || []).filter(n => n.audience === this.audience);
    }));
    this.subs.push(this.svc.unreadCount$.subscribe(c => (this.unread = c)));
    this.subs.push(this.svc.loading$.subscribe(l => (this.loading = l)));
    this.svc.init();
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    if (this.dockEmbed && this.fullscreenPanel && this.open) {
      this.openChange.emit(false);
    }
  }

  get overlayLayout(): boolean {
    return !!(this.fullscreenPanel && this.open) || this.mobileLayout;
  }

  get visible(): NotificationItem[] {
    if (this.filter === 'unread') return this.notifications.filter(n => !n.lida);
    return this.notifications;
  }

  private syncViewportMode() {
    this.mobileLayout = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(max-width: 560px)').matches;
  }

  toggle(ev?: MouseEvent) {
    if (ev) ev.stopPropagation();
    this.syncViewportMode();
    this.open = !this.open;
    if (this.open) this.svc.refreshUnread();
    this.emitDockOpenChange();
  }

  close(ev?: MouseEvent) {
    if (ev) ev.stopPropagation();
    this.open = false;
    this.emitDockOpenChange();
  }

  private emitDockOpenChange() {
    if (this.dockEmbed && this.fullscreenPanel) {
      this.openChange.emit(this.open);
    }
  }

  handleClick(n: NotificationItem, ev?: MouseEvent) {
    if (ev) ev.stopPropagation();
    if (!n.lida) this.svc.markRead(n.id);
    this.close();
    if (n.link) {
      try {
        const url = new URL(n.link, window.location.origin);
        const path = url.pathname + url.search;
        this.router.navigateByUrl(path);
      } catch {
        this.router.navigateByUrl(n.link);
      }
    }
  }

  remove(n: NotificationItem, ev: MouseEvent) {
    ev.stopPropagation();
    this.svc.remove(n.id);
  }

  markAll(ev?: MouseEvent) {
    if (ev) ev.stopPropagation();
    this.svc.markAllRead();
  }

  loadMore(ev?: MouseEvent) {
    if (ev) ev.stopPropagation();
    this.svc.loadMore();
  }

  svc_hasMore(): boolean { return !!this.svc.hasMore; }

  setFilter(f: 'all' | 'unread', ev?: MouseEvent) {
    if (ev) ev.stopPropagation();
    this.filter = f;
  }

  trackById(_: number, n: NotificationItem) { return n.id; }

  iconFor(tipo: string): string {
    const map: Record<string, string> = {
      'order.created': 'fa-solid fa-cart-plus',
      'order.status_changed': 'fa-solid fa-truck-fast',
      'order.payment_received': 'fa-solid fa-dollar-sign',
      'order.canceled': 'fa-solid fa-ban',
      'inventory.low': 'fa-solid fa-boxes-stacked',
      'vet.pending': 'fa-solid fa-user-doctor',
      'partner.pending': 'fa-solid fa-briefcase',
      'coupon.expiring': 'fa-solid fa-ticket',
      'review.new': 'fa-solid fa-star',
      'error.critical': 'fa-solid fa-triangle-exclamation',
    };
    return map[tipo] || 'fa-solid fa-bell';
  }

  relativeTime(iso?: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    const sec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h`;
    const day = Math.floor(h / 24);
    if (day < 30) return `${day}d`;
    const mo = Math.floor(day / 30);
    if (mo < 12) return `${mo}m`;
    const y = Math.floor(mo / 12);
    return `${y}a`;
  }

  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    if (!this.open) return;
    if (this.overlayLayout) return;
    const t = ev.target as HTMLElement | null;
    if (t && this.host.nativeElement.contains(t)) return;
    this.close();
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.syncViewportMode();
  }

  @HostListener('document:keydown.escape')
  onEsc() { this.close(); }
}
