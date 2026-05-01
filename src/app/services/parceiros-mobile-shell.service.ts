import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Abre remotamente o menu sanduíche de `ParceiroShellComponent` quando a barra global Petsphere
 * aparece por cima em mobile.
 *
 * Os pedidos de FAB (`requestOpenPartnerFab*`) destinam-se a viewport abaixo de 768px com
 * `NavmenuComponent` em modo parceiro (`/parceiros/*`); o navmenu filtra antes de abrir sheet/radial.
 */
@Injectable({ providedIn: 'root' })
export class ParceirosMobileShellService {
  readonly openPartnerDrawer$ = new Subject<void>();
  /** Abre o menu radial de atalhos (equivalente à pressão longa no FAB). */
  readonly openPartnerFabRadial$ = new Subject<void>();
  /** Abre o bottom sheet de ações rápidas (equivalente ao toque no FAB). */
  readonly openPartnerFabSheet$ = new Subject<void>();

  requestOpenPartnerDrawer(): void {
    this.openPartnerDrawer$.next();
  }

  requestOpenPartnerFabRadial(): void {
    this.openPartnerFabRadial$.next();
  }

  requestOpenPartnerFabSheet(): void {
    this.openPartnerFabSheet$.next();
  }
}
