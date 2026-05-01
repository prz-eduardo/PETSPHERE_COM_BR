import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { getNextStatus, STATUS_LABELS } from '../../constants/order-status.constants';

/** Coluna do quadro (título já traduzido; `orders` = itens da API ou mock). */
export interface OrderQueueKanbanColumn {
  title: string;
  orders: any[];
}

@Component({
  selector: 'app-order-queue-kanban-board',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-queue-kanban-board.component.html',
  styleUrls: ['./order-queue-kanban-board.component.scss'],
})
export class OrderQueueKanbanBoardComponent {
  @Input() heading = 'Fila de pedidos';
  @Input() subheading = '';
  @Input() columns: OrderQueueKanbanColumn[] = [];
  /** Exibe avançar / cancelar (fluxo admin). */
  @Input() showActions = false;

  @Output() orderCardClick = new EventEmitter<any>();
  @Output() orderAdvance = new EventEmitter<any>();
  @Output() orderCancel = new EventEmitter<any>();

  formatCurrency(v: number | string | null | undefined): string {
    const n = Number(v || 0);
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
    return `${day}d`;
  }

  nextStatus(pedido: any): string | null {
    return getNextStatus(pedido?.status);
  }

  nextStatusLabel(pedido: any): string {
    const n = this.nextStatus(pedido);
    return n ? (STATUS_LABELS[n] || n) : '';
  }

  onCardClick(p: any): void {
    this.orderCardClick.emit(p);
  }

  onAdvance(p: any, ev: MouseEvent): void {
    ev.stopPropagation();
    this.orderAdvance.emit(p);
  }

  onCancel(p: any, ev: MouseEvent): void {
    ev.stopPropagation();
    this.orderCancel.emit(p);
  }
}
