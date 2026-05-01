import {
  AfterViewInit,
  Component,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../../../services/api.service';
import { ParceiroAuthService } from '../../../../services/parceiro-auth.service';
import {
  ADMIN_QUEUE_STATUSES,
  statusLabel,
} from '../../../../constants/order-status.constants';
import {
  OrderQueueKanbanBoardComponent,
  OrderQueueKanbanColumn,
} from '../../../../shared/order-queue-kanban-board/order-queue-kanban-board.component';

@Component({
  selector: 'app-parceiro-painel-operacao-vendas',
  standalone: true,
  imports: [CommonModule, OrderQueueKanbanBoardComponent],
  templateUrl: './parceiro-painel-operacao-vendas.component.html',
  styleUrls: ['./parceiro-painel-operacao-vendas.component.scss'],
})
export class ParceiroPainelOperacaoVendasComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('salesCanvas', { static: false }) salesCanvasRef?: ElementRef<HTMLCanvasElement>;

  loading = true;
  error: string | null = null;
  data: any = null;

  readonly queueStatuses: string[] = [...ADMIN_QUEUE_STATUSES];

  private chart: any = null;
  private readonly isBrowser: boolean;

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    private api: ApiService,
    private parceiroAuth: ParceiroAuthService,
    private router: Router,
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngOnInit(): void {
    this.load();
  }

  ngAfterViewInit(): void {
    if (this.data && this.isBrowser) {
      setTimeout(() => void this.drawSalesChart(), 0);
    }
  }

  ngOnDestroy(): void {
    try {
      this.chart?.destroy();
    } catch {
      /* noop */
    }
    this.chart = null;
  }

  load(): void {
    const token = this.parceiroAuth.getToken();
    if (!token) {
      this.loading = false;
      this.error = 'Sessão do parceiro não encontrada. Faça login novamente.';
      return;
    }
    this.loading = true;
    this.error = null;
    this.api.getParceiroHomeOverview(token).subscribe({
      next: (res) => {
        this.data = res || null;
        this.loading = false;
        setTimeout(() => void this.drawSalesChart(), 80);
      },
      error: () => {
        this.loading = false;
        this.error = 'Não foi possível carregar os pedidos da vitrine.';
        this.data = null;
      },
    });
  }

  ordersOf(status: string): any[] {
    return this.data?.queue?.orders?.[status] || [];
  }

  get queueKanbanColumns(): OrderQueueKanbanColumn[] {
    return this.queueStatuses.map((s) => ({
      title: statusLabel(s),
      orders: this.ordersOf(s),
    }));
  }

  get queueSubheading(): string {
    const n = this.data?.queue?.total ?? 0;
    return `${n} pedido(s) em andamento na vitrine.`;
  }

  get hasSalesByDay(): boolean {
    const rows = this.data?.sales_7d?.by_day;
    return Array.isArray(rows) && rows.length > 0;
  }

  onOrderClick(_p: any): void {
    void this.router.navigate(['/parceiros/petshop-online']);
  }

  private async drawSalesChart(): Promise<void> {
    if (!this.isBrowser) return;
    const canvas = this.salesCanvasRef?.nativeElement;
    if (!canvas) return;
    const byDay = this.data?.sales_7d?.by_day || [];
    if (!byDay.length) {
      try {
        this.chart?.destroy();
      } catch {
        /* noop */
      }
      this.chart = null;
      return;
    }

    const { default: Chart } = await import('chart.js/auto');
    const labels = byDay.map((r: any) => {
      const d = new Date(r.dia);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const receita = byDay.map((r: any) => Number(r.receita || 0));
    const pedidos = byDay.map((r: any) => Number(r.pedidos || 0));
    try {
      this.chart?.destroy();
    } catch {
      /* noop */
    }
    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Receita (R$)',
            data: receita,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,.15)',
            tension: 0.35,
            fill: true,
            yAxisID: 'y',
          },
          {
            label: 'Pedidos',
            data: pedidos,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16,185,129,.15)',
            tension: 0.35,
            fill: false,
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { color: '#94a3b8', boxWidth: 12 },
          },
          title: {
            display: true,
            text: 'Vendas da vitrine (últimos 7 dias)',
            color: '#e2e8f0',
            font: { size: 13, weight: 'bold' },
          },
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8' },
            grid: { color: 'rgba(255,255,255,0.06)' },
          },
          y: {
            beginAtZero: true,
            position: 'left',
            title: { display: true, text: 'R$', color: '#94a3b8' },
            ticks: { color: '#94a3b8' },
            grid: { color: 'rgba(255,255,255,0.06)' },
          },
          y1: {
            beginAtZero: true,
            position: 'right',
            grid: { drawOnChartArea: false },
            title: { display: true, text: 'Pedidos', color: '#94a3b8' },
            ticks: { color: '#94a3b8' },
          },
        },
      },
    });
  }
}
