import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService, PacienteDetail } from '../../../../services/api.service';
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
export class PacienteDetalheComponent {
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
  data: PacienteDetail | null = null;

  get token(): string | null { try { return this.auth.getToken() || this.parceiroAuth.getToken() || localStorage.getItem('token') || sessionStorage.getItem('token'); } catch { return localStorage.getItem('token') || sessionStorage.getItem('token'); } }

  ngOnInit() { this.load(); }

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
      this.erro = e?.error?.message || msg;
    } finally { this.carregando = false; }
  }
}
