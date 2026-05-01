import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService, PacienteSummary, PagedPacientesResponse } from '../../../../services/api.service';
import { AuthService } from '../../../../services/auth.service';
import { ParceiroAuthService } from '../../../../services/parceiro-auth.service';
import { NavmenuComponent } from '../../../../navmenu/navmenu.component';
import { AdminPaginationComponent } from '../../admin/shared/admin-pagination/admin-pagination.component';

@Component({
  standalone: true,
  selector: 'app-pacientes',
  imports: [CommonModule, FormsModule, RouterModule, NavmenuComponent, AdminPaginationComponent],
  templateUrl: './pacientes.component.html',
  styleUrls: ['./pacientes.component.scss']
})
export class PacientesComponent {
  private api = inject(ApiService);
  private router = inject(Router);
  private auth = inject(AuthService);
  private parceiroAuth = inject(ParceiroAuthService);

  /** Rotas legadas (`/pacientes`) usam a navbar do site; em `/parceiros/...` o shell do prestador já cobre. */
  get showSiteNav(): boolean {
    const path = (this.router.url.split('?')[0] || '').split('#')[0] || '';
    return !path.startsWith('/parceiros/');
  }

  q = '';
  page = 1;
  pageSize = 20;
  total = 0;
  totalPages = 0;
  carregando = false;
  erro: string | null = null;

  pacientes: PacienteSummary[] = [];

  get token(): string | null {
    try {
      return this.auth.getToken() || this.parceiroAuth.getToken() || localStorage.getItem('token') || sessionStorage.getItem('token');
    } catch {
      return localStorage.getItem('token') || sessionStorage.getItem('token');
    }
  }

  ngOnInit() { this.load(); }

  async load() {
    if (!this.token) { this.erro = 'Não autenticado'; return; }
    this.carregando = true; this.erro = null;
    try {
      const raw = await this.api.getPacientes(this.token!, { page: this.page, pageSize: this.pageSize, q: this.q || undefined }).toPromise();
      if (!raw) throw new Error('Sem resposta do servidor');
      // Alguns backends podem retornar um array de detalhes em vez do contrato paginado.
      const maybeArray = (Array.isArray(raw) ? raw : null) as any[] | null;
      if (maybeArray) {
        this.pacientes = maybeArray.map((d: any) => this.mapDetailToSummary(d)).filter(Boolean) as PacienteSummary[];
        this.total = this.pacientes.length;
        this.totalPages = Math.max(1, Math.ceil(this.total / this.pageSize));
        this.page = 1;
      } else if ((raw as any).data && Array.isArray((raw as any).data)) {
        const resp = raw as PagedPacientesResponse;
        this.pacientes = resp.data || [];
        this.page = resp.page || 1;
        this.pageSize = resp.pageSize || this.pageSize;
        this.total = resp.total || 0;
        this.totalPages = resp.totalPages || 0;
      } else if ((raw as any).pet) {
        // PacienteDetail único
        this.pacientes = [this.mapDetailToSummary(raw as any)].filter(Boolean) as PacienteSummary[];
        this.total = this.pacientes.length;
        this.totalPages = 1;
        this.page = 1;
      } else {
        // desconhecido
        this.pacientes = [];
        this.total = 0;
        this.totalPages = 0;
      }
    } catch (e: any) {
      const status = e?.status;
      const friendly = status === 403
        ? '🚫 Somente veterinários podem acessar essa lista.'
        : '💥 Não foi possível carregar os pacientes. Tente novamente.';
      // Fallback: agrega a partir de /receitas se o endpoint ainda não existir no backend
      try {
        const aggregated = await this.fallbackAggregateFromReceitas();
        // paginação local
        const start = (this.page - 1) * this.pageSize;
        const end = start + this.pageSize;
        this.total = aggregated.length;
        this.totalPages = Math.max(1, Math.ceil(aggregated.length / this.pageSize));
        this.pacientes = aggregated.slice(start, end);
        this.erro = null;
      } catch {
        this.erro = friendly;
      }
    } finally { this.carregando = false; }
  }

  resetar() { this.q = ''; this.page = 1; this.load(); }

  abrir(p: PacienteSummary) {
    const path = (this.router.url.split('?')[0] || '').split('#')[0] || '';
    if (path.startsWith('/parceiros/')) {
      this.router.navigate(['/parceiros/pacientes', p.pet_id]);
    } else {
      this.router.navigate(['/pacientes', p.pet_id]);
    }
  }

  paginaAnterior() { if (this.page > 1) { this.page--; this.load(); } }
  proximaPagina() { if (this.page < this.totalPages) { this.page++; this.load(); } }

  private mapDetailToSummary(d: any): PacienteSummary | null {
    try {
      const pet = d.pet || {};
      const resumo = d.resumo || {};
      const top = Array.isArray(d.ativos_mais_usados) ? d.ativos_mais_usados : [];
      return {
        pet_id: Number(pet.id),
        pet_nome: pet.nome || '-',
        especie: pet.especie,
        raca: pet.raca,
        sexo: pet.sexo,
        cliente_id: Number(pet.cliente_id) || (d.cliente?.id ? Number(d.cliente.id) : NaN),
        cliente_nome: pet.cliente_nome || d.cliente?.nome || '-',
        cliente_cpf: pet.cliente_cpf || d.cliente?.cpf,
        total_atendimentos: Number(resumo.total_atendimentos) || (Array.isArray(d.ultimas_receitas) ? d.ultimas_receitas.length : 0),
        primeiro_atendimento: resumo.primeiro_atendimento,
        ultimo_atendimento: resumo.ultimo_atendimento,
        top_ativos: top.map((t: any) => ({ nome: t.nome, usos: Number(t.usos) || 0, ativo_id: t.ativo_id }))
      };
    } catch {
      return null;
    }
  }

  private async fallbackAggregateFromReceitas(): Promise<PacienteSummary[]> {
    const MAX_PAGES = 5;
    const RECEITAS_PAGE_SIZE = 100;
    const groups = new Map<number, (PacienteSummary & { _itens?: Record<string, number>; _first?: string; _last?: string })>();

    let page = 1;
    let totalPages = 1;
    do {
      const resp = await this.api.getReceitas(this.token!, { page, pageSize: RECEITAS_PAGE_SIZE, q: this.q || undefined }).toPromise();
      if (!resp) break;
      totalPages = resp.totalPages || 1;
      for (const r of resp.data || []) {
        const pid = Number(r.pet_id);
        if (!pid || isNaN(pid)) continue;
        let g = groups.get(pid);
        if (!g) {
          g = {
            pet_id: pid,
            pet_nome: r.pet_nome || (r as any).nome_pet || '-',
            especie: r.especie,
            raca: r.raca,
            sexo: r.sexo,
            cliente_id: Number(r.cliente_id),
            cliente_nome: r.cliente_nome || '-',
            cliente_cpf: (r as any)?.dados_raw?.tutor?.cpf,
            total_atendimentos: 0,
            primeiro_atendimento: undefined,
            ultimo_atendimento: undefined,
            top_ativos: [],
            _itens: {},
            _first: undefined,
            _last: undefined
          };
          groups.set(pid, g);
        }
        g.total_atendimentos += 1;
        const dt = r.created_at || '';
        if (!g._first || (dt && dt < g._first)) g._first = dt;
        if (!g._last || (dt && dt > g._last)) g._last = dt;
        for (const it of (r.itens || [])) {
          const nome = it.nome_ativo || String(it.ativo_id);
          g._itens![nome] = (g._itens![nome] || 0) + 1;
        }
      }
      page += 1;
    } while (page <= totalPages && page <= MAX_PAGES);

    const result: PacienteSummary[] = [];
    groups.forEach(g => {
      const entries = Object.entries(g._itens || {});
      entries.sort((a,b)=> b[1]-a[1]);
      const top_ativos = entries.slice(0,5).map(([nome, usos]) => ({ nome, usos }));
      result.push({
        pet_id: g.pet_id,
        pet_nome: g.pet_nome,
        especie: g.especie,
        raca: g.raca,
        sexo: g.sexo,
        cliente_id: g.cliente_id,
        cliente_nome: g.cliente_nome,
        cliente_cpf: g.cliente_cpf,
        total_atendimentos: g.total_atendimentos,
        primeiro_atendimento: g._first,
        ultimo_atendimento: g._last,
        top_ativos
      });
    });
    result.sort((a,b)=> (b.ultimo_atendimento||'').localeCompare(a.ultimo_atendimento||''));
    return result;
  }
}
