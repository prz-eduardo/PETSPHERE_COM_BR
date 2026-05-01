import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { MOCK_PASSEIOS, MOCK_WALKERS, ShowcasePasseio, ShowcaseWalker } from './passeadores-showcase.mock';

function cloneWalkers(rows: ShowcaseWalker[]): ShowcaseWalker[] {
  return rows.map((w) => ({ ...w }));
}

function clonePasseios(rows: ShowcasePasseio[]): ShowcasePasseio[] {
  return rows.map((p) => ({
    ...p,
    waypoints: p.waypoints.map((pt) => ({ ...pt })),
  }));
}

@Injectable({ providedIn: 'root' })
export class PasseadoresShowcaseService {
  private walkers = cloneWalkers(MOCK_WALKERS);
  private passeios = clonePasseios(MOCK_PASSEIOS);

  getWalkers(): Observable<ShowcaseWalker[]> {
    return of([...this.walkers]).pipe(delay(180));
  }

  getPasseios(): Observable<ShowcasePasseio[]> {
    return of(
      this.passeios.map((p) => ({
        ...p,
        waypoints: p.waypoints.map((pt) => ({ ...pt })),
      }))
    ).pipe(delay(220));
  }
}
