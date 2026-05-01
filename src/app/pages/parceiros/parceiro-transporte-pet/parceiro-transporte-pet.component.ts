import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../services/api.service';
import { ParceiroAuthService } from '../../../services/parceiro-auth.service';
import { ToastService } from '../../../services/toast.service';
import { RouterLink } from '@angular/router';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-parceiro-transporte-pet',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './parceiro-transporte-pet.component.html',
  styleUrls: ['./parceiro-transporte-pet.component.scss'],
})
export class ParceiroTransportePetComponent implements OnInit, OnDestroy {
  loading = true;
  abertas: any[] = [];
  minhas: any[] = [];
  motoristas: any[] = [];
  onlineLoading = false;
  souMotorista: any | null = null;
  isMaster = false;
  novoMotoristaContaId: number | null = null;
  novoMotoristaTier: 'free' | 'pro' | 'premium' = 'free';
  colaboradores: any[] = [];
  colaboradoresLoading = false;
  tarifasLoading = false;
  tarifasSaving = false;
  tarifasForm: {
    base_reais: number;
    tarifa_km_reais: number;
    taxa_pequeno_reais: number;
    taxa_medio_reais: number;
    taxa_grande_reais: number;
    peak_multiplier: number;
    peak_start_hour: number | null;
    peak_end_hour: number | null;
    urgency_now_reais: number;
    surge_max: number;
    pct_plataforma: number;
    matching_initial_km: number;
    matching_expand_km: number;
  } | null = null;
  private poll?: Subscription;

  constructor(
    private api: ApiService,
    private parceiroAuth: ParceiroAuthService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.isMaster = this.parceiroAuth.isMaster();
    this.refresh();
    this.poll = interval(15000).subscribe(() => {
      this.loadAbertas(false);
    });
  }

  ngOnDestroy(): void {
    this.poll?.unsubscribe();
  }

  private headers(): { Authorization: string } | null {
    const h = this.parceiroAuth.getAuthHeaders() as { Authorization?: string };
    return h.Authorization ? { Authorization: h.Authorization } : null;
  }

  refresh(): void {
    const h = this.headers();
    if (!h) {
      this.loading = false;
      return;
    }
    this.loading = true;
    this.api.listParceiroTransportePetMotoristas(h).subscribe({
      next: (r) => {
        this.motoristas = r.motoristas || [];
        const meId = this.parceiroAuth.getCurrentColaborador()?.id;
        this.souMotorista = this.motoristas.find((m) => Number(m.parceiro_account_id) === Number(meId)) || null;
      },
      error: () => this.toast.error('Erro ao carregar motoristas'),
    });
    this.api.listParceiroTransportePetCorridas(h).subscribe({
      next: (r) => {
        this.minhas = r.corridas || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.toast.error('Erro ao carregar corridas');
      },
    });
    this.loadAbertas(true);
    if (this.isMaster) {
      this.loadColaboradores();
      this.loadTarifas();
    }
  }

  loadAbertas(showErr: boolean): void {
    const h = this.headers();
    if (!h) return;
    this.api.listParceiroTransportePetCorridasAbertas(h).subscribe({
      next: (r) => (this.abertas = r.corridas || []),
      error: () => {
        if (showErr) this.toast.error('Erro ao carregar demanda');
      },
    });
  }

  toggleOnline(v: boolean): void {
    const h = this.headers();
    if (!h) return;
    this.onlineLoading = true;
    this.api.setParceiroTransportePetMotoristaOnline(h, v).subscribe({
      next: (r) => {
        this.souMotorista = r.motorista;
        this.onlineLoading = false;
        this.toast.success(v ? 'Você está online para corridas.' : 'Offline.');
      },
      error: (e) => {
        this.onlineLoading = false;
        this.toast.error(e?.error?.error || 'Falha ao atualizar status');
      },
    });
  }

  enviarLocalizacao(): void {
    const h = this.headers();
    if (!h || !navigator.geolocation) {
      this.toast.error('Geolocalização indisponível');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.api
          .setParceiroTransportePetMotoristaLocation(h, pos.coords.latitude, pos.coords.longitude)
          .subscribe({
            next: () => this.toast.success('Localização enviada'),
            error: () => this.toast.error('Falha ao enviar localização'),
          });
      },
      () => this.toast.error('Permissão de localização negada')
    );
  }

  aceitar(c: any): void {
    const h = this.headers();
    if (!h) return;
    this.api.acceptParceiroTransportePetCorrida(h, Number(c.id)).subscribe({
      next: () => {
        this.toast.success('Corrida aceita');
        this.refresh();
      },
      error: (e) => this.toast.error(e?.error?.error || 'Não foi possível aceitar'),
    });
  }

  avancar(c: any, action: 'start_pickup' | 'picked_up' | 'complete'): void {
    const h = this.headers();
    if (!h) return;
    this.api.advanceParceiroTransportePetStatus(h, Number(c.id), action).subscribe({
      next: () => {
        this.toast.success('Status atualizado');
        this.refresh();
      },
      error: (e) => this.toast.error(e?.error?.error || 'Falha'),
    });
  }

  cadastrarMotorista(): void {
    const h = this.headers();
    if (!h || !this.novoMotoristaContaId) {
      this.toast.error('Informe o ID da conta (colaborador)');
      return;
    }
    this.addMotoristaAccount(h, this.novoMotoristaContaId);
  }

  addMotoristaFromColaborador(accountId: number): void {
    const h = this.headers();
    if (!h) return;
    this.addMotoristaAccount(h, accountId);
  }

  private addMotoristaAccount(h: { Authorization: string }, accountId: number): void {
    this.api
      .createParceiroTransportePetMotorista(h, {
        parceiro_account_id: accountId,
        tier: this.novoMotoristaTier,
      })
      .subscribe({
        next: () => {
          this.toast.success('Motorista adicionado');
          this.novoMotoristaContaId = null;
          this.refresh();
        },
        error: (e) => this.toast.error(e?.error?.error || 'Falha ao cadastrar'),
      });
  }

  loadColaboradores(): void {
    const h = this.headers();
    if (!h || !this.isMaster) return;
    this.colaboradoresLoading = true;
    this.api.listParceiroColaboradores(h).subscribe({
      next: (r) => {
        this.colaboradores = r.colaboradores || [];
        this.colaboradoresLoading = false;
      },
      error: (e) => {
        this.colaboradoresLoading = false;
        this.toast.error(e?.error?.error || 'Erro ao listar colaboradores');
      },
    });
  }

  contaJaEhMotorista(accountId: number): boolean {
    const id = Number(accountId);
    return this.motoristas.some((m) => Number(m.parceiro_account_id) === id);
  }

  loadTarifas(): void {
    const h = this.headers();
    if (!h || !this.isMaster) return;
    this.tarifasLoading = true;
    this.api.getParceiroTransportePetTarifas(h).subscribe({
      next: (r) => {
        const t = r.tarifas || {};
        this.tarifasForm = {
          base_reais: Number(t['base_centavos'] ?? 0) / 100,
          tarifa_km_reais: Number(t['tarifa_km_centavos'] ?? 0) / 100,
          taxa_pequeno_reais: Number(t['taxa_pequeno_centavos'] ?? 0) / 100,
          taxa_medio_reais: Number(t['taxa_medio_centavos'] ?? 0) / 100,
          taxa_grande_reais: Number(t['taxa_grande_centavos'] ?? 0) / 100,
          peak_multiplier: Number(t['peak_multiplier'] ?? 1),
          peak_start_hour: t['peak_start_hour'] != null ? Number(t['peak_start_hour']) : null,
          peak_end_hour: t['peak_end_hour'] != null ? Number(t['peak_end_hour']) : null,
          urgency_now_reais: Number(t['urgency_now_centavos'] ?? 0) / 100,
          surge_max: Number(t['surge_max'] ?? 1),
          pct_plataforma: Number(t['pct_plataforma'] ?? 0),
          matching_initial_km: Number(t['matching_initial_km'] ?? 0),
          matching_expand_km: Number(t['matching_expand_km'] ?? 0),
        };
        this.tarifasLoading = false;
      },
      error: (e) => {
        this.tarifasLoading = false;
        this.toast.error(e?.error?.error || 'Erro ao carregar tarifas');
      },
    });
  }

  salvarTarifas(): void {
    const h = this.headers();
    if (!h || !this.isMaster || !this.tarifasForm) return;
    const f = this.tarifasForm;
    this.tarifasSaving = true;
    const body: Record<string, unknown> = {
      base_centavos: Math.round(f.base_reais * 100),
      tarifa_km_centavos: Math.round(f.tarifa_km_reais * 100),
      taxa_pequeno_centavos: Math.round(f.taxa_pequeno_reais * 100),
      taxa_medio_centavos: Math.round(f.taxa_medio_reais * 100),
      taxa_grande_centavos: Math.round(f.taxa_grande_reais * 100),
      peak_multiplier: f.peak_multiplier,
      peak_start_hour: f.peak_start_hour == null ? null : Number(f.peak_start_hour),
      peak_end_hour: f.peak_end_hour == null ? null : Number(f.peak_end_hour),
      urgency_now_centavos: Math.round(f.urgency_now_reais * 100),
      surge_max: f.surge_max,
      pct_plataforma: f.pct_plataforma,
      matching_initial_km: f.matching_initial_km,
      matching_expand_km: f.matching_expand_km,
    };
    this.api.putParceiroTransportePetTarifas(h, body).subscribe({
      next: () => {
        this.tarifasSaving = false;
        this.toast.success('Tarifas salvas');
        this.loadTarifas();
      },
      error: (e) => {
        this.tarifasSaving = false;
        this.toast.error(e?.error?.error || 'Falha ao salvar tarifas');
      },
    });
  }

  fmtMoney(centavos: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
      Number(centavos || 0) / 100
    );
  }

  toNum(v: unknown): number {
    return Number(v);
  }

  /** Rótulo amigável do status da corrida (API usa snake_case). */
  rotuloStatus(status: string | null | undefined): string {
    const s = String(status || '').toLowerCase();
    const map: Record<string, string> = {
      awaiting_payment: 'Aguardando pagamento',
      waiting_driver: 'Aguardando motorista',
      accepted: 'Aceita',
      on_the_way: 'A caminho da coleta',
      in_progress: 'Em viagem',
      completed: 'Concluída',
      cancelled: 'Cancelada',
    };
    return map[s] || (status ? String(status) : '—');
  }

  classeBadgeStatus(status: string | null | undefined): string {
    const s = String(status || '').toLowerCase();
    if (s === 'completed') return 'badge badge--ok';
    if (s === 'cancelled' || s === 'awaiting_payment') return 'badge badge--muted';
    if (s === 'waiting_driver') return 'badge badge--urgent';
    if (s === 'accepted' || s === 'on_the_way' || s === 'in_progress') return 'badge badge--progress';
    return 'badge';
  }

  rotuloPapel(role: string | null | undefined): string {
    const r = String(role || '').toLowerCase();
    if (r === 'master') return 'Master';
    if (r === 'colaborador') return 'Colaborador';
    return role ? String(role) : '—';
  }

  rotuloTier(t: string): string {
    const k = String(t || '').toLowerCase();
    if (k === 'premium') return 'Premium';
    if (k === 'pro') return 'Pro';
    return 'Free';
  }

  tierMotoristaDaConta(accountId: number): string | null {
    const id = Number(accountId);
    const m = this.motoristas.find((x) => Number(x.parceiro_account_id) === id);
    const t = m && m.tier != null ? String(m.tier) : '';
    return t || null;
  }
}
