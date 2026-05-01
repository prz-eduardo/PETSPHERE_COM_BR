import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ParceiroAuthService } from '../../../services/parceiro-auth.service';
import { ToastService } from '../../../services/toast.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-parceiro-minha-loja',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './parceiro-minha-loja.component.html',
  styleUrls: ['./parceiro-minha-loja.component.scss'],
})
export class ParceiroMinhaLojaComponent implements OnInit {
  private readonly base = environment.apiBaseUrl;
  loading = signal(false);
  saving = signal(false);
  vitrine = signal<any | null>(null);
  readonly ofertaCatalog = signal<Array<{ slug: string; label_pt: string; scope: string }>>([]);
  readonly hotelGlobaisSelecionados = signal<string[]>([]);
  readonly catalogParceiroEntries = computed(() =>
    this.ofertaCatalog().filter((e) => e.scope === 'parceiro' || e.scope === 'both')
  );

  readonly form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    public auth: ParceiroAuthService,
    private toast: ToastService
  ) {
    this.form = this.fb.group({
      loja_slug: [''],
      texto_institucional: [''],
      mercadopago_access_token: [''],
    });
  }

  ngOnInit(): void {
    void Promise.all([this.loadHotelOfertaCatalog(), this.reload()]);
  }

  private async loadHotelOfertaCatalog(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ catalog: Array<{ slug: string; label_pt: string; scope: string }> }>(
          `${this.base}/parceiro/hospedagem/catalogo-ofertas`,
          { headers: this.auth.getAuthHeaders() }
        )
      );
      this.ofertaCatalog.set(Array.isArray(res?.catalog) ? res.catalog : []);
    } catch {
      this.ofertaCatalog.set([]);
    }
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const loja = await firstValueFrom(this.http.get<any>(`${this.base}/parceiro/vitrine/loja`, { headers: this.auth.getAuthHeaders() }));
      this.vitrine.set(loja);
      const hg = loja?.hotel_servicos_globais;
      this.hotelGlobaisSelecionados.set(Array.isArray(hg) ? hg.map(String) : []);
      this.form.patchValue({
        loja_slug: loja?.loja_slug || '',
        texto_institucional: loja?.texto_institucional || '',
        mercadopago_access_token: '',
      });
    } catch {
      this.toast.error('Não foi possível carregar os dados da vitrine.');
    } finally {
      this.loading.set(false);
    }
  }

  async salvarLoja(): Promise<void> {
    if (!this.auth.isMaster()) {
      this.toast.error('Apenas o usuário master pode alterar a vitrine.');
      return;
    }
    this.saving.set(true);
    try {
      const body: any = {
        loja_slug: (this.form.value.loja_slug || '').trim() || null,
        texto_institucional: this.form.value.texto_institucional ?? null,
        hotel_servicos_globais: [...this.hotelGlobaisSelecionados()],
      };
      const mpCtrl = this.form.get('mercadopago_access_token');
      if (mpCtrl?.dirty) {
        body.mercadopago_access_token = (this.form.value.mercadopago_access_token || '').trim();
      }
      const res = await firstValueFrom(
        this.http.patch<any>(`${this.base}/parceiro/vitrine/loja`, body, { headers: this.auth.getAuthHeaders() })
      );
      this.toast.success('Configurações salvas.');
      this.vitrine.set({ ...this.vitrine(), ...res });
      if (Array.isArray(res?.hotel_servicos_globais)) {
        this.hotelGlobaisSelecionados.set(res.hotel_servicos_globais.map(String));
      }
      this.form.patchValue({ mercadopago_access_token: '' });
    } catch (e: any) {
      const msg = e?.error?.error || 'Erro ao salvar.';
      this.toast.error(msg);
    } finally {
      this.saving.set(false);
    }
  }

  toggleHotelGlobal(slug: string): void {
    const cur = [...this.hotelGlobaisSelecionados()];
    const i = cur.indexOf(slug);
    if (i >= 0) cur.splice(i, 1);
    else cur.push(slug);
    this.hotelGlobaisSelecionados.set(cur);
  }

  hotelGlobalSelected(slug: string): boolean {
    return this.hotelGlobaisSelecionados().includes(slug);
  }
}
