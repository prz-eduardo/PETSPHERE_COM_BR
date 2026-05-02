import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { MARCA_NOME } from '../../../constants/loja-public';
import { SessionService } from '../../../services/session.service';
import { ApiService } from '../../../services/api.service';

@Component({
  selector: 'app-motorista-global-painel',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './motorista-global-painel.component.html',
  styleUrls: ['./motorista-global-painel.component.scss'],
})
export class MotoristaGlobalPainelComponent implements OnInit, OnDestroy {
  readonly marca = MARCA_NOME;

  loading = false;
  busy = false;
  erro: string | null = null;
  onlineLocal = false;

  painel: {
    motorista_global: Record<string, unknown> | null;
    corridas_abertas: Record<string, unknown>[];
    corridas_ativas: Record<string, unknown>[];
  } | null = null;

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private locTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private title: Title, private session: SessionService, private api: ApiService) {}

  ngOnInit(): void {
    this.title.setTitle(`Motorista ${this.marca} — painel`);
    this.refresh(true);
  }

  ngOnDestroy(): void {
    this.clearPoll();
    this.stopLocationPush();
  }

  get token(): string | null {
    return this.session.getBackendToken();
  }

  private clearPoll(): void {
    if (this.pollTimer != null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private startPollIfApproved(): void {
    this.clearPoll();
    const mg = this.painel?.motorista_global;
    if (mg && String(mg['kyc_status']) === 'approved' && mg['ativo']) {
      this.pollTimer = setInterval(() => this.refresh(false), 16000);
    }
  }

  refresh(showLoading = false): void {
    const t = this.token;
    if (!t) return;
    if (showLoading) this.loading = true;
    this.erro = null;
    this.api.getClienteTransportePetGlobalMotoristaPainel(t).subscribe({
      next: (r) => {
        this.painel = r;
        const mg = r.motorista_global;
        this.onlineLocal = !!(mg && Number(mg['online']) === 1);
        if (showLoading) this.loading = false;
        this.startPollIfApproved();
      },
      error: (e) => {
        if (showLoading) this.loading = false;
        this.erro = e?.error?.error || 'Não foi possível carregar o painel.';
      },
    });
  }

  enroll(): void {
    const t = this.token;
    if (!t) return;
    this.busy = true;
    this.erro = null;
    this.api.enrollClienteTransportePetGlobalMotorista(t, { tier: 'free' }).subscribe({
      next: () => {
        this.busy = false;
        this.refresh(false);
      },
      error: (e) => {
        this.busy = false;
        this.erro = e?.error?.error || e?.message;
      },
    });
  }

  toggleOnline(checked: boolean): void {
    const t = this.token;
    if (!t) return;
    this.busy = true;
    this.api.setClienteTransportePetGlobalMotoristaOnline(t, checked).subscribe({
      next: (r) => {
        this.busy = false;
        this.onlineLocal = !!(r.motorista_global && Number(r.motorista_global['online']) === 1);
        if (this.painel && r.motorista_global) this.painel.motorista_global = r.motorista_global;
        if (checked) this.startLocationPush();
        else this.stopLocationPush();
        this.refresh(false);
      },
      error: (e) => {
        this.busy = false;
        this.onlineLocal = false;
        this.erro = e?.error?.error || e?.message;
      },
    });
  }

  private startLocationPush(): void {
    this.stopLocationPush();
    const push = () => {
      const t = this.token;
      if (!t || typeof navigator === 'undefined' || !navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.api
            .setClienteTransportePetGlobalMotoristaLocation(t, pos.coords.latitude, pos.coords.longitude)
            .subscribe({ error: () => {} });
        },
        () => {}
      );
    };
    push();
    this.locTimer = setInterval(push, 24000);
  }

  private stopLocationPush(): void {
    if (this.locTimer != null) {
      clearInterval(this.locTimer);
      this.locTimer = null;
    }
  }

  idCorrida(c: Record<string, unknown>): number {
    return Number(c['id']);
  }

  aceitar(corridaId: number): void {
    const t = this.token;
    if (!t) return;
    this.busy = true;
    this.api.acceptClienteTransportePetGlobalCorrida(t, corridaId).subscribe({
      next: () => {
        this.busy = false;
        this.refresh(false);
      },
      error: (e) => {
        this.busy = false;
        this.erro = e?.error?.error || 'Não foi possível aceitar.';
        this.refresh(false);
      },
    });
  }

  avancarCorrida(corridaId: number, action: 'start_pickup' | 'picked_up' | 'complete'): void {
    const t = this.token;
    if (!t) return;
    this.busy = true;
    this.api.advanceClienteTransportePetGlobalCorridaStatus(t, corridaId, action).subscribe({
      next: () => {
        this.busy = false;
        this.refresh(false);
      },
      error: (e) => {
        this.busy = false;
        this.erro = e?.error?.error || 'Transição inválida.';
        this.refresh(false);
      },
    });
  }

  fmtReais(centavos?: number | string | null | unknown): string {
    const c = Number(centavos);
    if (!Number.isFinite(c)) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c / 100);
  }

  statusTutorPt(status: unknown): string {
    const s = String(status || '');
    const m: Record<string, string> = {
      awaiting_payment: 'Aguardando pagamento',
      waiting_driver: 'Buscando motorista na rede',
      accepted: 'Motorista encontrado — aguardando deslocamento',
      on_the_way: 'Motorista a caminho da coleta',
      in_progress: 'Em viagem com o pet',
      completed: 'Concluída',
      cancelled: 'Cancelada',
    };
    return m[s] || s;
  }

  proximoPassoMotorista(status: unknown): { action: 'start_pickup' | 'picked_up' | 'complete'; label: string } | null {
    const s = String(status || '');
    if (s === 'accepted') return { action: 'start_pickup', label: 'A caminho da coleta' };
    if (s === 'on_the_way') return { action: 'picked_up', label: 'Pet a bordo / em viagem' };
    if (s === 'in_progress') return { action: 'complete', label: 'Concluir corrida' };
    return null;
  }
}
