import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { CreditosResumo } from '../../services/admin-monetizacao.service';

/** Widget de créditos PetSphere para o painel admin (chip no header + banner no hero). */
@Component({
  selector: 'app-admin-credits-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-credits-summary.component.html',
  styleUrl: './admin-credits-summary.component.scss',
})
export class AdminCreditsSummaryComponent {
  @Input() variant: 'chip' | 'banner' = 'chip';
  @Input() loading = false;
  @Input() error: string | null = null;
  @Input() data: CreditosResumo | null = null;
  @Output() refresh = new EventEmitter<void>();
  @Output() openPainel = new EventEmitter<void>();

  fmtInt(n: number | undefined | null): string {
    return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(Number(n) || 0);
  }
}
