import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { MARCA_NOME } from '../../../constants/loja-public';
import { SessionService } from '../../../services/session.service';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-transporte-pet-corridas-tutor',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './transporte-pet-corridas-tutor.component.html',
  styleUrls: ['./transporte-pet-corridas-tutor.component.scss'],
})
export class TransportePetCorridasTutorComponent implements OnInit {
  readonly marca = MARCA_NOME;
  loading = false;
  erro: string | null = null;
  corridas: Record<string, unknown>[] = [];

  constructor(private title: Title, private session: SessionService, private api: ApiService) {}

  ngOnInit(): void {
    this.title.setTitle(`Meus transportes — ${this.marca}`);
    this.carregar();
  }

  get token(): string | null {
    return this.session.getBackendToken();
  }

  carregar(): void {
    const t = this.token;
    if (!t) return;
    this.loading = true;
    this.erro = null;
    this.api.listClienteTransportePetCorridas(t).subscribe({
      next: (r) => {
        this.corridas = (r.corridas as Record<string, unknown>[]) || [];
        this.loading = false;
      },
      error: (e) => {
        this.loading = false;
        this.erro = e?.error?.error || 'Não foi possível listar corridas.';
      },
    });
  }

  statusPt(status: unknown): string {
    const s = String(status || '');
    const m: Record<string, string> = {
      awaiting_payment: 'Aguardando pagamento',
      waiting_driver: 'Buscando motorista na rede',
      accepted: 'Motorista atribuído',
      on_the_way: 'Motorista a caminho',
      in_progress: 'Em viagem',
      completed: 'Concluída',
      cancelled: 'Cancelada',
    };
    return m[s] || s;
  }

  fmtReais(centavos?: unknown): string {
    const c = Number(centavos);
    if (!Number.isFinite(c)) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c / 100);
  }

  isGlobal(c: Record<string, unknown>): boolean {
    return String(c['matching_pool'] || '') === 'global';
  }
}
