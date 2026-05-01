import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { forkJoin } from 'rxjs';
import { MARCA_NOME } from '../../constants/loja-public';
import { PasseadoresShowcaseService } from './passeadores-showcase.service';
import type { ShowcasePasseio, ShowcaseWalker, ShowcaseWaypoint } from './passeadores-showcase.mock';

/** Página pública de propaganda / demonstração do serviço de passeio com mapa interativo. */
@Component({
  selector: 'app-passeadores-showcase',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './passeadores-showcase.component.html',
  styleUrls: ['./passeadores-showcase.component.scss'],
})
export class PasseadoresShowcaseComponent implements OnInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly svc = inject(PasseadoresShowcaseService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly title = inject(Title);

  @ViewChild('mapHost') mapHost?: ElementRef<HTMLElement>;

  walkers: ShowcaseWalker[] = [];
  passeios: ShowcasePasseio[] = [];
  selected: ShowcasePasseio | null = null;
  draftWaypoints: ShowcaseWaypoint[] = [];
  desenharModo = false;

  loading = true;

  private map: import('leaflet').Map | null = null;
  private leaflet: typeof import('leaflet') | null = null;
  private layerRota: import('leaflet').Layer | null = null;
  private mkInicio: import('leaflet').Marker | null = null;
  private mkFim: import('leaflet').Marker | null = null;

  ngOnInit(): void {
    this.title.setTitle(`Passeio com seu pet · ${MARCA_NOME}`);
    forkJoin({
      walkers: this.svc.getWalkers(),
      passeios: this.svc.getPasseios(),
    }).subscribe({
      next: ({ walkers, passeios }) => {
        this.walkers = walkers;
        this.passeios = passeios;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  ngOnDestroy(): void {
    this.teardownMap();
  }

  walkerNome(id: string): string {
    return this.walkers.find((w) => w.id === id)?.nome ?? id;
  }

  fmtData(iso: string): string {
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch {
      return iso;
    }
  }

  statusLabel(s: ShowcasePasseio['status']): string {
    const m: Record<ShowcasePasseio['status'], string> = {
      agendado: 'Agendado',
      em_andamento: 'Em andamento',
      concluido: 'Concluído',
    };
    return m[s] ?? s;
  }

  distanciaAproxKm(): string {
    const pts = this.draftWaypoints;
    if (pts.length < 2) return '—';
    let m = 0;
    for (let i = 1; i < pts.length; i++) {
      m += this.haversineM(pts[i - 1], pts[i]);
    }
    return (m / 1000).toFixed(2).replace('.', ',') + ' km';
  }

  private haversineM(a: ShowcaseWaypoint, b: ShowcaseWaypoint): number {
    const R = 6371000;
    const φ1 = (a.lat * Math.PI) / 180;
    const φ2 = (b.lat * Math.PI) / 180;
    const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
    const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
    const x =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  selectPasseio(p: ShowcasePasseio): void {
    this.selected = p;
    this.draftWaypoints = p.waypoints.map((w) => ({ lat: w.lat, lng: w.lng }));
    this.desenharModo = false;
    this.teardownMap();
    this.cdr.detectChanges();
    queueMicrotask(() => void this.bootstrapMap());
  }

  toggleDesenhar(): void {
    this.desenharModo = !this.desenharModo;
  }

  undoPonto(): void {
    if (this.draftWaypoints.length === 0) return;
    this.draftWaypoints = this.draftWaypoints.slice(0, -1);
    this.redesenharRotaNoMapa();
    this.cdr.markForCheck();
  }

  limparRota(): void {
    this.draftWaypoints = [];
    this.redesenharRotaNoMapa();
    this.cdr.markForCheck();
  }

  centralizarRota(): void {
    if (!this.map || !this.leaflet) return;
    const pts = this.draftWaypoints;
    if (pts.length >= 2) {
      const L = this.leaflet;
      const b = L.latLngBounds(pts.map((p) => L.latLng(p.lat, p.lng)));
      this.map.fitBounds(b, { padding: [40, 40], maxZoom: 15 });
    } else if (pts.length === 1) {
      this.map.setView([pts[0].lat, pts[0].lng], 15);
    }
  }

  private async bootstrapMap(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const el = this.mapHost?.nativeElement;
    if (!el || !this.selected) return;
    await this.initMapa(el);
  }

  private async initMapa(el: HTMLElement): Promise<void> {
    this.teardownMap();
    const L = (await import('leaflet')).default;
    this.leaflet = L;
    const pts = this.draftWaypoints;
    const center: [number, number] =
      pts.length > 0 ? [pts[0].lat, pts[0].lng] : [-23.55, -46.633];
    const zoom = pts.length >= 2 ? 14 : 13;
    this.map = L.map(el, { zoomControl: true }).setView(center, zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(this.map);

    this.map.on('click', (ev: import('leaflet').LeafletMouseEvent) => {
      if (!this.desenharModo) return;
      const { lat, lng } = ev.latlng;
      this.draftWaypoints = [...this.draftWaypoints, { lat, lng }];
      this.redesenharRotaNoMapa();
      this.cdr.markForCheck();
    });

    this.redesenharRotaNoMapa();
    if (pts.length >= 2) {
      queueMicrotask(() => this.centralizarRota());
    }
  }

  private redesenharRotaNoMapa(): void {
    if (!this.map || !this.leaflet) return;
    const L = this.leaflet;
    if (this.layerRota) {
      this.map.removeLayer(this.layerRota);
      this.layerRota = null;
    }
    if (this.mkInicio) {
      this.map.removeLayer(this.mkInicio);
      this.mkInicio = null;
    }
    if (this.mkFim) {
      this.map.removeLayer(this.mkFim);
      this.mkFim = null;
    }

    const pts = this.draftWaypoints;
    const path = pts.map((p) => [p.lat, p.lng] as [number, number]);
    if (path.length >= 2) {
      this.layerRota = L.polyline(path, { color: '#0ea5e9', weight: 4, opacity: 0.92 }).addTo(this.map);
    }

    const iconHtml = (label: string, bg: string) =>
      `<div style="width:22px;height:22px;border-radius:50%;background:${bg};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;color:#0f172a;">${label}</div>`;

    if (path.length >= 1) {
      const a = path[0];
      this.mkInicio = L.marker(a, {
        title: 'Início',
        icon: L.divIcon({
          className: 'ps-passeio-marker',
          html: iconHtml('A', '#38bdf8'),
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
      }).addTo(this.map);
    }
    if (path.length >= 2) {
      const b = path[path.length - 1];
      const same = path.length === 2 && path[0][0] === b[0] && path[0][1] === b[1];
      if (!same) {
        this.mkFim = L.marker(b, {
          title: 'Fim',
          icon: L.divIcon({
            className: 'ps-passeio-marker',
            html: iconHtml('B', '#f472b6'),
            iconSize: [22, 22],
            iconAnchor: [11, 11],
          }),
        }).addTo(this.map);
      }
    }
  }

  private teardownMap(): void {
    try {
      this.map?.remove();
    } catch {
      /* */
    }
    this.map = null;
    this.leaflet = null;
    this.layerRota = null;
    this.mkInicio = null;
    this.mkFim = null;
  }
}
