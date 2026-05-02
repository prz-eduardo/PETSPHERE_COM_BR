import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService, PacienteDetail, PacienteTimelineEvento, PacienteTrait, PetVacinaRow } from '../../../../services/api.service';
import { AuthService } from '../../../../services/auth.service';
import { ParceiroAuthService } from '../../../../services/parceiro-auth.service';
import { NavmenuComponent } from '../../../../navmenu/navmenu.component';

@Component({
  standalone: true,
  selector: 'app-paciente-detalhe',
  imports: [CommonModule, RouterModule, NavmenuComponent],
  templateUrl: './paciente-detalhe.component.html',
  styleUrls: ['./paciente-detalhe.component.scss']
})
export class PacienteDetalheComponent implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  private parceiroAuth = inject(ParceiroAuthService);

  /** Rotas legadas precisam da navbar; em `/parceiros/...` o shell do prestador já cobre. */
  get showSiteNav(): boolean {
    const path = (this.router.url.split('?')[0] || '').split('#')[0] || '';
    return !path.startsWith('/parceiros/');
  }

  carregando = true;
  erro: string | null = null;
  acaoErro: string | null = null;
  acaoOk: string | null = null;
  data: PacienteDetail | null = null;
  validandoVacinaId: number | null = null;

  readonly categoriasTraits: Array<{ key: string; label: string }> = [
    { key: 'comportamento', label: 'Comportamento' },
    { key: 'social', label: 'Social' },
    { key: 'rotina', label: 'Rotina' },
    { key: 'preferencias', label: 'Preferências' },
    { key: 'bem_estar', label: 'Bem-estar' },
  ];

  get token(): string | null { try { return this.auth.getToken() || this.parceiroAuth.getToken() || localStorage.getItem('token') || sessionStorage.getItem('token'); } catch { return localStorage.getItem('token') || sessionStorage.getItem('token'); } }

  get clienteId(): number | null {
    const id = this.data?.cliente?.id ?? this.data?.pet?.cliente_id;
    return Number.isFinite(Number(id)) ? Number(id) : null;
  }

  get temAlergias(): boolean {
    const d = this.data;
    if (!d) return false;
    return !!((d.pet.alergias && d.pet.alergias.length) || (d.pet.alergias_predefinidas && d.pet.alergias_predefinidas.length));
  }

  get vacinasAtrasadas(): number {
    return (this.data?.vacinas_cronograma || []).filter(v => v.status === 'atrasada').length;
  }

  get vacinasProximas(): number {
    return (this.data?.vacinas_cronograma || []).filter(v => v.status === 'proxima').length;
  }

  get timelineEventos(): PacienteTimelineEvento[] {
    return this.data?.timeline_eventos || [];
  }

  /** Lista de pacientes: rota parceiro vs área vet legada. */
  get listaPacientesLink(): string[] {
    const path = (this.router.url.split('?')[0] || '').split('#')[0] || '';
    return path.startsWith('/parceiros/') ? ['/parceiros', 'pacientes'] : ['/pacientes'];
  }

  petFotoUrl(): string {
    const raw = this.data?.pet?.photoURL;
    return this.api.resolveMediaUrl(typeof raw === 'string' ? raw : null);
  }

  traitsOutros(): PacienteTrait[] {
    const known = new Set(this.categoriasTraits.map(c => c.key.toLowerCase()));
    const traits = this.data?.pet_traits || [];
    return traits.filter(t => !known.has(String(t.categoria || '').toLowerCase()));
  }

  ngOnInit(): void {
    this.load();
  }

  async load() {
    const id = this.route.snapshot.paramMap.get('petId');
    if (!id) { this.erro = '❗ Pet inválido.'; this.carregando = false; return; }
    if (!this.token) { this.erro = 'Não autenticado'; this.carregando = false; return; }
    try {
      const resp = await this.api.getPacienteById(this.token!, id).toPromise();
      this.data = resp || null;
      if (!this.data) this.erro = 'Paciente não encontrado.';
    } catch (e: any) {
      const msg = e?.status === 403 ? '🚫 Somente veterinários podem realizar esta ação.' : '💥 Não foi possível carregar o paciente. Tente novamente.';
      const body = e?.error;
      const apiErr = body && typeof body === 'object' && 'error' in body ? String((body as { error?: string }).error || '') : '';
      this.erro = apiErr || e?.error?.message || msg;
    } finally { this.carregando = false; }
  }

  traitsPorCategoria(categoria: string): Array<{ nome: string; categoria?: string; catalogo_id: number }> {
    const traits = this.data?.pet_traits || [];
    return traits.filter(t => (t.categoria || '').toLowerCase() === categoria.toLowerCase());
  }

  trackByVacina(_i: number, v: PetVacinaRow): number {
    return Number(v.id);
  }

  classeStatusVacina(status?: string | null): string {
    const s = String(status || 'pendente').toLowerCase();
    if (s === 'validada') return 'badge badge--ok';
    if (s === 'rejeitada') return 'badge badge--danger';
    return 'badge badge--warn';
  }

  classeStatusCronograma(status?: string | null): string {
    const s = String(status || '').toLowerCase();
    if (s === 'atrasada') return 'pill pill--danger';
    if (s === 'proxima') return 'pill pill--warn';
    if (s === 'em_dia') return 'pill pill--ok';
    return 'pill';
  }

  classeTipoEvento(tipo?: string | null): string {
    const t = String(tipo || '').toLowerCase();
    if (t === 'vacina') return 'event event--vacina';
    if (t === 'receita') return 'event event--receita';
    return 'event event--obs';
  }

  async validarVacina(vacina: PetVacinaRow, status: 'validada' | 'rejeitada') {
    if (!this.token || !this.data || !this.clienteId || !vacina?.id) return;
    const petId = Number(this.data.pet.id);
    if (!Number.isFinite(petId)) return;

    const motivo = status === 'rejeitada'
      ? (typeof window !== 'undefined' ? window.prompt('Motivo da rejeicao (opcional):') || undefined : undefined)
      : undefined;

    this.acaoErro = null;
    this.acaoOk = null;
    this.validandoVacinaId = Number(vacina.id);
    try {
      const updated = await this.api
        .validarPetVacina(this.clienteId, petId, vacina.id, { status, motivo_rejeicao: motivo }, this.token)
        .toPromise();

      const registros = this.data.vacinas_registros || [];
      this.data.vacinas_registros = registros.map(v => v.id === updated?.id
        ? { ...v, status_validacao: updated.status_validacao, motivo_rejeicao: updated.motivo_rejeicao, validado_em: updated.validado_em }
        : v);

      const evs = this.data.timeline_eventos;
      if (evs?.length && updated?.id != null) {
        this.data.timeline_eventos = evs.map(ev =>
          ev.tipo === 'vacina' && Number(ev.ref_id) === Number(updated.id)
            ? { ...ev, badge: updated.status_validacao || ev.badge }
            : ev
        );
      }

      const cron = this.data.vacinas_cronograma;
      const catId = updated?.catalogo_id;
      if (cron?.length && catId != null && updated) {
        this.data.vacinas_cronograma = cron.map(c =>
          Number(c.catalogo_id) === Number(catId)
            ? { ...c, status_validacao_ultima: updated.status_validacao ?? c.status_validacao_ultima }
            : c
        );
      }

      this.acaoOk = status === 'validada' ? 'Vacina validada com sucesso.' : 'Vacina rejeitada.';
    } catch (e: any) {
      this.acaoErro = e?.error?.error || 'Nao foi possivel atualizar o status da vacina.';
    } finally {
      this.validandoVacinaId = null;
    }
  }
}
