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
  loading = true;

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
      next: (s: unknown) => (this.stats = s),
      error: () => (this.stats = null),
    });
    const pid = this.filtroParceiro.trim() ? Number(this.filtroParceiro) : undefined;
    this.api.listAdminTransportePetCorridas(t, { parceiro_id: pid, limit: 80 }).subscribe({
      next: (r: { corridas?: any[] }) => {
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
}
