import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface PublicPlano {
  id: number; nome: string; slug: string; descricao?: string | null;
  preco_mensal: number; creditos_mensais_inclusos: number; permite_automacoes: boolean;
}
interface PublicPacote {
  id: number; nome: string; slug: string; preco_reais: number;
  creditos_incluidos: number; bonus_creditos: number; descricao?: string | null; destaque: boolean;
}

@Component({
  selector: 'app-parceiro-planos',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './parceiro-planos.component.html',
  styleUrls: ['./parceiro-planos.component.scss'],
})
export class ParceiroPlanosComponent implements OnInit {
  private http = inject(HttpClient);
  private base = (environment as any).apiBaseUrl.replace(/\/$/, '');

  loading = signal(true);
  errorMsg = signal<string | null>(null);
  planos = signal<PublicPlano[]>([]);
  pacotes = signal<PublicPacote[]>([]);

  ngOnInit() {
    this.loading.set(true);
    Promise.all([
      this.http.get<{ data: PublicPlano[] }>(`${this.base}/public/planos`).toPromise().catch(() => ({ data: [] })),
      this.http.get<{ data: PublicPacote[] }>(`${this.base}/public/creditos/pacotes`).toPromise().catch(() => ({ data: [] })),
    ]).then(([p, c]) => {
      this.planos.set(p?.data || []);
      this.pacotes.set(c?.data || []);
      this.loading.set(false);
    }).catch((e) => {
      this.errorMsg.set('Não foi possível carregar planos e pacotes agora.');
      this.loading.set(false);
    });
  }

  trackById(_i: number, x: { id: number }) { return x.id; }

  totalCreditos(p: PublicPacote): number { return p.creditos_incluidos + (p.bonus_creditos || 0); }

  formatBRL(v: number): string {
    return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
}
