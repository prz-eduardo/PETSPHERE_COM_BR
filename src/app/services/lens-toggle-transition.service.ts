import { Injectable } from '@angular/core';

/** Usado apenas ao alternar Tutores ⇄ Profissionais na navbar para animar o `router-outlet`. */
export type LensToggleSlideArm = 'to-cliente' | 'to-parceiro';

@Injectable({ providedIn: 'root' })
export class LensToggleTransitionService {
  private pending: LensToggleSlideArm | null = null;

  armToCliente(): void {
    this.pending = 'to-cliente';
  }

  armToParceiro(): void {
    this.pending = 'to-parceiro';
  }

  consume(): LensToggleSlideArm | null {
    const v = this.pending;
    this.pending = null;
    return v;
  }
}
