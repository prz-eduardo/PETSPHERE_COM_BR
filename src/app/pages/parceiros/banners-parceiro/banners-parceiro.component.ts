import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, computed, ViewChild } from '@angular/core';
import { RouterModule } from '@angular/router';
import { BannerDto, Paged } from '../../../services/admin-api.service';
import { AdminCrudComponent, ColumnDef } from '../../../shared/admin-crud/admin-crud.component';
import {
  BANNER_POSITIONS,
  BannerPosition,
  BannerPositionOption,
  bannerPositionLabel,
} from '../../../shared/banner/banner-positions';
import {
  BannerFormComponent,
  BannerFormSubmitPayload,
} from '../../restrito/admin/banners/banner-form/banner-form.component';
import { ParceiroBannersService } from '../../../services/parceiro-banners.service';
import { ParceiroAuthService } from '../../../services/parceiro-auth.service';
import { BannersPublicService } from '../../../services/banners-public.service';

const PARTNER_BANNER_VALUES: BannerPosition[] = [
  'loja_hero',
  'loja_inline',
  'categoria',
  'checkout',
  'carrinho',
  'produto',
];

@Component({
  selector: 'app-banners-parceiro',
  standalone: true,
  imports: [CommonModule, RouterModule, AdminCrudComponent, BannerFormComponent],
  templateUrl: './banners-parceiro.component.html',
  styleUrls: ['./banners-parceiro.component.scss'],
})
export class BannersParceiroComponent implements OnInit {
  readonly positions = BANNER_POSITIONS.filter((p) => PARTNER_BANNER_VALUES.includes(p.value));
  readonly partnerPositionOptions: BannerPositionOption[] = this.positions;

  @ViewChild(BannerFormComponent) bannerForm?: BannerFormComponent;

  q = signal('');
  active = signal<'all' | '1' | '0'>('all');
  positionFilter = signal<'all' | BannerPosition>('all');
  page = signal(1);
  pageSize = signal(10);
  total = signal(0);
  items = signal<BannerDto[]>([]);
  loading = signal(false);
  submitting = signal(false);
  toast = signal<{ kind: 'ok' | 'error'; message: string } | null>(null);

  selected = signal<BannerDto | null>(null);
  drawerMode = signal<'closed' | 'create' | 'edit'>('closed');
  drawerOpen = computed(() => this.drawerMode() !== 'closed');

  columns: ColumnDef[] = [
    { key: 'nome', label: 'Nome' },
    {
      key: 'posicao',
      label: 'Posição',
      formatter: (item: BannerDto) => bannerPositionLabel(item?.posicao),
    },
    { key: 'ordem', label: 'Ordem', width: '80px' },
    {
      key: 'janela',
      label: 'Janela',
      formatter: (item: BannerDto) => this.formatWindow(item?.inicio, item?.fim),
    },
    { key: 'ativo', label: 'Status', width: '90px' },
  ];

  constructor(
    private api: ParceiroBannersService,
    readonly parceiroAuth: ParceiroAuthService,
    private bannersPublic: BannersPublicService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load() {
    this.loading.set(true);
    const params: {
      q: string;
      page: number;
      pageSize: number;
      active?: 0 | 1;
      posicao?: string;
    } = { q: this.q(), page: this.page(), pageSize: this.pageSize() };
    if (this.active() !== 'all') params.active = this.active() === '1' ? 1 : 0;
    if (this.positionFilter() !== 'all') params.posicao = this.positionFilter();

    this.api.listBanners(params).subscribe({
      next: (res: Paged<BannerDto>) => {
        this.items.set(res.data || []);
        let totalValue = 0;
        if (res && typeof (res as Paged<BannerDto>).total === 'number') {
          totalValue = (res as Paged<BannerDto>).total || 0;
        } else if (res && typeof (res as Paged<BannerDto>).totalPages === 'number') {
          const ps = (res as Paged<BannerDto>).pageSize || this.pageSize();
          totalValue = ((res as Paged<BannerDto>).totalPages || 0) * Number(ps || 0);
        }
        this.total.set(totalValue || 0);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.showToast('error', 'Não foi possível carregar os banners.');
      },
    });
  }

  onQ(ev: Event) {
    const el = ev.target as HTMLInputElement | null;
    if (!el) return;
    this.q.set(el.value);
    this.page.set(1);
    this.load();
  }

  onActive(ev: Event) {
    const el = ev.target as HTMLSelectElement | null;
    if (!el) return;
    this.active.set(el.value as 'all' | '1' | '0');
    this.page.set(1);
    this.load();
  }

  onPosition(ev: Event) {
    const el = ev.target as HTMLSelectElement | null;
    if (!el) return;
    this.positionFilter.set(el.value as 'all' | BannerPosition);
    this.page.set(1);
    this.load();
  }

  openCreate() {
    if (!this.parceiroAuth.isMaster()) return;
    this.selected.set(null);
    this.drawerMode.set('create');
  }

  openEdit(item: BannerDto) {
    this.selected.set(item);
    this.drawerMode.set('edit');
  }

  closeDrawer() {
    if (this.submitting()) return;
    this.selected.set(null);
    this.drawerMode.set('closed');
  }

  onDrawerOpenChange(open: boolean) {
    if (!open) this.closeDrawer();
  }

  remove(item: BannerDto) {
    if (!this.parceiroAuth.isMaster()) {
      this.showToast('error', 'Apenas o usuário master pode remover banners.');
      return;
    }
    if (!item?.id) return;
    if (!confirm(`Remover o banner "${item.nome || ''}"?`)) return;
    this.api.deleteBanner(item.id).subscribe({
      next: () => {
        this.showToast('ok', 'Banner removido.');
        this.bannersPublic.invalidate();
        if (this.selected()?.id === item.id) this.closeDrawer();
        this.load();
      },
      error: () => this.showToast('error', 'Falha ao remover banner.'),
    });
  }

  async onFormSubmitted(evt: BannerFormSubmitPayload) {
    if (!this.parceiroAuth.isMaster()) return;
    const current = this.selected();
    const isEdit = !!current?.id;
    const { values, desktopBlob, mobileBlob } = evt;

    const body = this.buildPayload(values, desktopBlob, mobileBlob);
    this.submitting.set(true);

    const req$ = isEdit ? this.api.updateBanner(current!.id!, body) : this.api.createBanner(body);

    req$.subscribe({
      next: () => {
        this.submitting.set(false);
        this.showToast('ok', isEdit ? 'Banner atualizado.' : 'Banner criado.');
        this.bannersPublic.invalidate();
        this.closeDrawer();
        this.page.set(1);
        this.load();
      },
      error: (err: { error?: { message?: string; error?: string } }) => {
        this.submitting.set(false);
        const msg =
          err?.error?.message || err?.error?.error || 'Falha ao salvar banner.';
        this.showToast('error', msg);
      },
    });
  }

  private buildPayload(
    values: BannerFormSubmitPayload['values'],
    desktopBlob: Blob | null,
    mobileBlob: Blob | null,
  ): FormData | Partial<BannerDto> {
    const hasFiles = !!(desktopBlob || mobileBlob);
    if (hasFiles) {
      const form = new FormData();
      for (const [k, v] of Object.entries(values)) {
        if (v === undefined || v === null) continue;
        form.append(k, String(v));
      }
      if (desktopBlob)
        form.append(
          'bannerDesktop',
          new File([desktopBlob], 'desktop.jpg', { type: desktopBlob.type || 'image/jpeg' }),
        );
      if (mobileBlob)
        form.append(
          'bannerMobile',
          new File([mobileBlob], 'mobile.jpg', { type: mobileBlob.type || 'image/jpeg' }),
        );
      return form;
    }
    return values as Partial<BannerDto>;
  }

  private formatWindow(inicio?: string | null, fim?: string | null): string {
    const fmt = (v?: string | null) => {
      if (!v) return null;
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return null;
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    };
    const a = fmt(inicio);
    const b = fmt(fim);
    if (!a && !b) return '—';
    if (a && b) return `${a} → ${b}`;
    if (a) return `a partir de ${a}`;
    return `até ${b}`;
  }

  private showToast(kind: 'ok' | 'error', message: string, ttl = 3500) {
    this.toast.set({ kind, message });
    setTimeout(() => {
      if (this.toast()?.message === message) this.toast.set(null);
    }, ttl);
  }
}
