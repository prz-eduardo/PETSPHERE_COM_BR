import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ParceiroAuthService } from '../../../services/parceiro-auth.service';
import { ParceiroNavPrefsService, ParceiroNavCatalogGroup } from '../../../services/parceiro-nav-prefs.service';
import { ToastService } from '../../../services/toast.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-parceiro-minha-loja',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterModule],
  templateUrl: './parceiro-minha-loja.component.html',
  styleUrls: ['./parceiro-minha-loja.component.scss'],
})
export class ParceiroMinhaLojaComponent implements OnInit {
  private readonly base = environment.apiBaseUrl;
  loading = signal(false);
  saving = signal(false);
  vitrine = signal<any | null>(null);

  readonly form: FormGroup;

  /** Personalização do dock / FAB no celular (painel parceiro logado). */
  readonly dockSlot1 = signal<string>('painel');
  readonly dockSlot2 = signal<string>('agenda');
  readonly dockSlot3 = signal<string>('colaboradores');
  readonly fabIds = signal<string[]>([]);
  readonly navSaving = signal(false);

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    public auth: ParceiroAuthService,
    private toast: ToastService,
    readonly navPrefs: ParceiroNavPrefsService,
  ) {
    this.form = this.fb.group({
      loja_slug: [''],
      texto_institucional: [''],
    });
  }

  ngOnInit(): void {
    void this.reload();
    this.loadNavPrefsFromService();
  }

  get groupOrder(): ParceiroNavCatalogGroup[] {
    return this.navPrefs.GROUP_ORDER;
  }

  groupLabel(g: ParceiroNavCatalogGroup): string {
    return this.navPrefs.GROUP_LABELS[g];
  }

  itemsInGroup(g: ParceiroNavCatalogGroup) {
    return this.navPrefs.itemsInGroup(g);
  }

  private loadNavPrefsFromService(): void {
    const dock = this.navPrefs.getCurrentDockSlots();
    this.dockSlot1.set(dock[0] || 'painel');
    this.dockSlot2.set(dock[1] || 'agenda');
    this.dockSlot3.set(dock[2] || 'colaboradores');
    this.fabIds.set([...this.navPrefs.getCurrentFabActions()]);
  }

  saveNavPrefs(): void {
    this.navSaving.set(true);
    try {
      this.navPrefs.setDockSlots([this.dockSlot1(), this.dockSlot2(), this.dockSlot3()]);
      this.navPrefs.setFabActions([...this.fabIds()]);
      this.toast.success('Atalhos da barra inferior atualizados.');
    } finally {
      this.navSaving.set(false);
    }
  }

  resetNavPrefs(): void {
    this.navPrefs.resetToDefaults();
    this.loadNavPrefsFromService();
    this.toast.success('Atalhos restaurados ao padrão.');
  }

  fabSelected(id: string): boolean {
    return this.fabIds().includes(id);
  }

  toggleFab(id: string): void {
    const cur = [...this.fabIds()];
    const i = cur.indexOf(id);
    if (i >= 0) cur.splice(i, 1);
    else cur.push(id);
    this.fabIds.set(cur);
  }

  moveFabUp(id: string): void {
    const cur = [...this.fabIds()];
    const i = cur.indexOf(id);
    if (i <= 0) return;
    [cur[i - 1], cur[i]] = [cur[i], cur[i - 1]];
    this.fabIds.set(cur);
  }

  moveFabDown(id: string): void {
    const cur = [...this.fabIds()];
    const i = cur.indexOf(id);
    if (i < 0 || i >= cur.length - 1) return;
    [cur[i], cur[i + 1]] = [cur[i + 1], cur[i]];
    this.fabIds.set(cur);
  }

  labelForId(id: string): string {
    return this.navPrefs.getById(id)?.label ?? id;
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      const loja = await firstValueFrom(this.http.get<any>(`${this.base}/parceiro/vitrine/loja`, { headers: this.auth.getAuthHeaders() }));
      this.vitrine.set(loja);
      this.form.patchValue({
        loja_slug: loja?.loja_slug || '',
        texto_institucional: loja?.texto_institucional || '',
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
      };
      const res = await firstValueFrom(
        this.http.patch<any>(`${this.base}/parceiro/vitrine/loja`, body, { headers: this.auth.getAuthHeaders() })
      );
      this.toast.success('Configurações salvas.');
      this.vitrine.set({ ...this.vitrine(), ...res });
    } catch (e: any) {
      const msg = e?.error?.error || 'Erro ao salvar.';
      this.toast.error(msg);
    } finally {
      this.saving.set(false);
    }
  }
}
