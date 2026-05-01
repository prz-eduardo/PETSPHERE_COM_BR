import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { ParceiroCreditosService } from '../../services/parceiro-creditos.service';
import { ParceiroAuthService } from '../../services/parceiro-auth.service';

/**
 * Chip de saldo de créditos no header do painel parceiro (sempre visível, inclusive no mobile).
 * Clique leva à página pública de planos & pacotes para recarga.
 */
@Component({
  selector: 'app-parceiro-credits-badge',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './parceiro-credits-badge.component.html',
  styleUrl: './parceiro-credits-badge.component.scss',
})
export class ParceiroCreditsBadgeComponent implements OnInit, OnDestroy {
  private readonly creditosApi = inject(ParceiroCreditosService);
  private readonly auth = inject(ParceiroAuthService);
  private readonly router = inject(Router);

  saldo = signal<number | null>(null);
  loading = signal(false);
  error = signal(false);

  private poll?: ReturnType<typeof setInterval>;
  private navSub?: Subscription;

  ngOnInit(): void {
    this.load();
    this.poll = setInterval(() => this.load(), 120_000);
    this.navSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.load());
  }

  ngOnDestroy(): void {
    if (this.poll) clearInterval(this.poll);
    this.navSub?.unsubscribe();
  }

  load(): void {
    const h = this.auth.getAuthHeaders() as { Authorization?: string };
    if (!h.Authorization) {
      this.saldo.set(null);
      return;
    }
    this.loading.set(true);
    this.error.set(false);
    this.creditosApi.getSaldo(h as { Authorization: string }).subscribe({
      next: (r) => {
        this.saldo.set(Number(r.saldo) || 0);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
        this.saldo.set(null);
      },
    });
  }

  fmt(n: number): string {
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(n);
  }
}
