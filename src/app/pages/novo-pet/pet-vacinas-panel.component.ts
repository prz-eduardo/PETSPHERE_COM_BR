import { Component, Input, OnChanges, SimpleChanges, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, PetVacinaRow } from '../../services/api.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-pet-vacinas-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pet-vacinas-panel.component.html',
  styleUrls: ['./pet-vacinas-panel.component.scss'],
})
export class PetVacinasPanelComponent implements OnChanges {
  @Input() clienteId: number | null = null;
  @Input() petId: string | null = null;
  @Input() authToken: string | null = null;
  /** Preferência global do perfil (lembretes de vacina). */
  @Input() lembretesGlobaisAtivos = false;

  lista: PetVacinaRow[] = [];
  carregando = false;
  salvando = false;

  /** Form nova dose / edição */
  editandoId: number | null = null;
  formNome = '';
  formDataAplicacao = '';
  formProxima = '';
  formLote = '';
  formAplicadoPor = '';
  formObs = '';
  formLembrete = true;
  formComprovante: File | null = null;

  constructor(
    private api: ApiService,
    private toast: ToastService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['petId'] || changes['clienteId'] || changes['authToken']) {
      this.reload();
    }
  }

  private canLoad(): boolean {
    return (
      !!this.authToken &&
      this.clienteId != null &&
      this.clienteId > 0 &&
      !!this.petId &&
      String(this.petId).length > 0
    );
  }

  reload() {
    if (!this.canLoad()) {
      this.lista = [];
      return;
    }
    this.carregando = true;
    this.api.listPetVacinas(this.clienteId!, this.petId!, this.authToken!).subscribe({
      next: (rows) => {
        this.lista = Array.isArray(rows) ? rows : [];
        this.carregando = false;
      },
      error: () => {
        this.toast.error('Não foi possível carregar a carteira de vacinas.', 'Erro');
        this.carregando = false;
      },
    });
  }

  iniciarNova() {
    this.editandoId = null;
    this.formNome = '';
    this.formDataAplicacao = '';
    this.formProxima = '';
    this.formLote = '';
    this.formAplicadoPor = '';
    this.formObs = '';
    this.formLembrete = true;
    this.formComprovante = null;
  }

  editar(row: PetVacinaRow) {
    this.editandoId = row.id;
    this.formNome = row.nome || '';
    this.formDataAplicacao = this.toYmd(row.data_aplicacao);
    this.formProxima = row.proxima_reforco ? this.toYmd(row.proxima_reforco) : '';
    this.formLote = row.lote || '';
    this.formAplicadoPor = row.aplicado_por || '';
    this.formObs = row.observacoes || '';
    this.formLembrete = row.lembrete_ativo === true || row.lembrete_ativo === 1 || String(row.lembrete_ativo) === '1';
    this.formComprovante = null;
  }

  cancelarForm() {
    this.editandoId = null;
    this.formComprovante = null;
    this.iniciarNova();
  }

  onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files && input.files[0] ? input.files[0] : null;
    if (!file) {
      this.formComprovante = null;
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.toast.info('Use uma imagem (PNG ou JPG) para o comprovante.', 'Atenção');
      input.value = '';
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      this.toast.info('A imagem deve ter no máximo 3MB.', 'Atenção');
      input.value = '';
      return;
    }
    this.formComprovante = file;
  }

  salvar() {
    if (!this.canLoad()) return;
    const nome = (this.formNome || '').trim();
    if (!nome) {
      this.toast.info('Informe o nome da vacina.', 'Atenção');
      return;
    }
    if (!(this.formDataAplicacao || '').trim()) {
      this.toast.info('Informe a data de aplicação.', 'Atenção');
      return;
    }
    const fd = new FormData();
    fd.append('nome', nome);
    fd.append('data_aplicacao', (this.formDataAplicacao || '').trim());
    if ((this.formProxima || '').trim()) fd.append('proxima_reforco', this.formProxima.trim());
    else fd.append('proxima_reforco', '');
    if ((this.formLote || '').trim()) fd.append('lote', this.formLote.trim());
    if ((this.formAplicadoPor || '').trim()) fd.append('aplicado_por', this.formAplicadoPor.trim());
    if ((this.formObs || '').trim()) fd.append('observacoes', this.formObs.trim());
    fd.append('lembrete_ativo', this.formLembrete ? '1' : '0');
    if (this.formComprovante) fd.append('comprovante', this.formComprovante, this.formComprovante.name);

    this.salvando = true;
    const cid = this.clienteId!;
    const pid = this.petId!;
    const tok = this.authToken!;
    const req =
      this.editandoId != null
        ? this.api.updatePetVacina(cid, pid, this.editandoId, fd, tok)
        : this.api.createPetVacina(cid, pid, fd, tok);
    req.subscribe({
      next: () => {
        this.toast.success(this.editandoId != null ? 'Vacina atualizada.' : 'Vacina registrada.');
        this.salvando = false;
        this.iniciarNova();
        this.reload();
      },
      error: (err: any) => {
        const msg = err?.error?.error || err?.error?.message || err?.message || 'Erro ao salvar';
        this.toast.error(msg, 'Erro');
        this.salvando = false;
      },
    });
  }

  excluir(row: PetVacinaRow) {
    if (!this.canLoad() || !row?.id) return;
    if (!isPlatformBrowser(this.platformId)) return;
    if (!confirm(`Remover o registro de ${row.nome}?`)) return;
    this.api.deletePetVacina(this.clienteId!, this.petId!, row.id, this.authToken!).subscribe({
      next: () => {
        this.toast.success('Registro removido.');
        if (this.editandoId === row.id) this.iniciarNova();
        this.reload();
      },
      error: (err: any) => {
        const msg = err?.error?.error || err?.message || 'Erro ao excluir';
        this.toast.error(msg, 'Erro');
      },
    });
  }

  formatarBrData(ymd: string | null | undefined): string {
    if (!ymd) return '—';
    const x = String(ymd).trim();
    const m = x.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return x;
    return `${m[3]}/${m[2]}/${m[1]}`;
  }

  private toYmd(raw: string | null | undefined): string {
    if (!raw) return '';
    const m = String(raw).match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  }

  hojeYmd(): string {
    const d = new Date();
    const mo = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${mo}-${day}`;
  }
}
