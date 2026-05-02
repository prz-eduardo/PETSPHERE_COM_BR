import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../services/api.service';
import { SessionService } from '../../../../services/session.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-transporte-pet',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-transporte-pet.component.html',
  styleUrls: ['./admin-transporte-pet.component.scss'],
})
export class AdminTransportePetComponent implements OnInit {
  stats: any = null;
  corridas: any[] = [];
  filtroParceiro = '';
  filtroStatus = '';
  filtroDataDe = '';
  filtroDataAte = '';
  loading = true;

  readonly statusOpcoes = [
    { value: '', label: 'Todos' },
    { value: 'awaiting_payment', label: 'Aguardando pagamento' },
    { value: 'waiting_driver', label: 'Buscando motorista' },
    { value: 'accepted', label: 'Aceita' },
    { value: 'on_the_way', label: 'A caminho' },
    { value: 'in_progress', label: 'Em progresso' },
    { value: 'completed', label: 'Concluída' },
    { value: 'cancelled', label: 'Cancelada' },
  ];

  constructor(private api: ApiService, private session: SessionService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const t = this.session.getBackendToken();
    if (!t) {
      this.loading = false;
      return;
    }
    this.loading = true;
    this.api.getAdminTransportePetStats(t).subscribe({
      next: (s) => (this.stats = s),
      error: () => (this.stats = null),
    });
    const pid = this.filtroParceiro.trim() ? Number(this.filtroParceiro) : undefined;
    this.api
      .listAdminTransportePetCorridas(t, {
        parceiro_id: pid,
        limit: 100,
        status: this.filtroStatus || undefined,
        date_from: this.filtroDataDe || undefined,
        date_to: this.filtroDataAte || undefined,
      })
      .subscribe({
        next: (r) => {
          this.corridas = r.corridas || [];
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.corridas = [];
        },
      });
  }

  fmtBrl(c: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(c || 0) / 100);
  }

  fmtPct(n: number | null | undefined): string {
    return n != null ? `${n}%` : '—';
  }

  funnelEntries(): { status: string; n: number }[] {
    if (!this.stats?.funnel) return [];
    return Object.entries(this.stats.funnel as Record<string, number>)
      .map(([status, n]) => ({ status, n }))
      .sort((a, b) => b.n - a.n);
  }
}

