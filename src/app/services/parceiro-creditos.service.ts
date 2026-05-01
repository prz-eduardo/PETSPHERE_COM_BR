import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ParceiroSaldoCreditos {
  parceiro_id: number;
  saldo: number;
  updated_at: string | null;
}

@Injectable({ providedIn: 'root' })
export class ParceiroCreditosService {
  private http = inject(HttpClient);
  private base = (environment as any).apiBaseUrl.replace(/\/$/, '');

  /** GET /parceiro/creditos/saldo — requer header Authorization do colaborador */
  getSaldo(authHeaders: { Authorization: string }): Observable<ParceiroSaldoCreditos> {
    return this.http.get<ParceiroSaldoCreditos>(`${this.base}/parceiro/creditos/saldo`, { headers: authHeaders });
  }
}
