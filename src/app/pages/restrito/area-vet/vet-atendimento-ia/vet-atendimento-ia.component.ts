import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService, PetVacinaCronogramaItem, PetVacinaRow } from '../../../../services/api.service';
import { AuthService } from '../../../../services/auth.service';
import { ParceiroAuthService } from '../../../../services/parceiro-auth.service';

@Component({
  selector: 'app-vet-atendimento-ia',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './vet-atendimento-ia.component.html',
  styleUrls: ['./vet-atendimento-ia.component.scss'],
})
export class VetAtendimentoIaComponent implements OnInit {
  atendimentoId: number | null = null;
  loading = false;
  erro: string | null = null;
  detalhe: any = null;

  vacinasCronograma: PetVacinaCronogramaItem[] = [];
  vacinasList: PetVacinaRow[] = [];
  carregandoVacinas = false;
  vacinaErro: string | null = null;

  readonly steps = [
    'Áudio ou notas livres',
    'Processamento IA',
    'Prontuário estruturado',
    'Sugestão de retorno',
    'Salvar no caso clínico',
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private auth: AuthService,
    private parceiroAuth: ParceiroAuthService,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {}

  getEffectiveToken(): string | null {
    try {
      const t = this.auth.getToken();
      if (t) return t;
    } catch {}
    try {
      const pt = this.parceiroAuth.getToken();
      if (pt) return pt;
    } catch {}
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('token') || sessionStorage.getItem('token');
    }
    return null;
  }

  get embedParceiro(): boolean {
    return (this.router.url || '').includes('/parceiros/');
  }

  get voltarLink(): string {
    const q = this.atendimentoId != null ? `?atendimentoId=${this.atendimentoId}` : '';
    return this.embedParceiro ? `/parceiros/gerar-receita${q}` : `/gerar-receita${q}`;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('atendimentoId');
    const n = id ? Number(id) : NaN;
    this.atendimentoId = Number.isFinite(n) && n > 0 ? n : null;
    if (!this.atendimentoId || !isPlatformBrowser(this.platformId)) return;
    const token = this.getEffectiveToken();
    if (!token) return;
    this.loading = true;
    this.api.getAtendimentoDetalhe(this.atendimentoId, token).subscribe({
      next: (r) => {
        this.detalhe = r;
        this.loading = false;
        this.loadVacinas(r, token);
      },
      error: (e) => {
        this.erro = e?.error?.error || 'Não foi possível carregar o atendimento.';
        this.loading = false;
      },
    });
  }

  loadVacinas(detalhe: any, token: string): void {
    const clienteId = detalhe?.cliente_id ?? detalhe?.tutor_id;
    const petId = detalhe?.pet_id;
    if (!clienteId || !petId) return;
    this.carregandoVacinas = true;
    this.api.getPetVacinasCronograma(Number(clienteId), petId, token).subscribe({
      next: (r) => {
        this.vacinasCronograma = r?.itens ?? [];
        this.carregandoVacinas = false;
      },
      error: () => { this.carregandoVacinas = false; },
    });
    this.api.listPetVacinas(Number(clienteId), petId, token).subscribe({
      next: (rows) => { this.vacinasList = rows ?? []; },
      error: () => {},
    });
  }

  validarVacina(vacinaId: number, status: 'validada' | 'rejeitada', motivo?: string): void {
    const clienteId = this.detalhe?.cliente_id ?? this.detalhe?.tutor_id;
    const petId = this.detalhe?.pet_id;
    const token = this.getEffectiveToken();
    if (!clienteId || !petId || !token) return;
    this.api.validarPetVacina(
      Number(clienteId),
      petId,
      vacinaId,
      { status, motivo_rejeicao: motivo },
      token
    ).subscribe({
      next: (updated) => {
        this.vacinasList = this.vacinasList.map(v =>
          v.id === updated.id ? { ...v, status_validacao: updated.status_validacao } : v
        );
      },
      error: () => { this.vacinaErro = 'Erro ao validar vacina.'; },
    });
  }
}
