import { Component, Input, OnChanges, SimpleChanges, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ApiService,
  PetVacinaCatalogoItem,
  PetVacinaCronogramaItem,
  PetVacinaRow,
} from '../../services/api.service';
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
  @Input() especiePet: string | null = null;
  /** Preferência global do perfil (lembretes de vacina). */
  @Input() lembretesGlobaisAtivos = false;

  lista: PetVacinaRow[] = [];
  catalogo: PetVacinaCatalogoItem[] = [];
  cronograma: PetVacinaCronogramaItem[] = [];
  carregando = false;
  carregandoCatalogo = false;
  carregandoCronograma = false;
  salvando = false;

  /** Form nova dose / edição */
  editandoId: number | null = null;
  formCatalogoId = '';
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
    if (changes['petId'] || changes['clienteId'] || changes['authToken'] || changes['especiePet']) {
      this.reload();
    }
  }

  get podeValidarClinicamente(): boolean {
    const tipo = this.currentUserTipo();
    return tipo === 'vet' || tipo === 'admin';
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
      this.catalogo = [];
      this.cronograma = [];
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
    this.loadCatalogo();
    this.loadCronograma();
  }

  private loadCatalogo() {
    if (!this.canLoad()) return;
    this.carregandoCatalogo = true;
    this.api
      .listPetVacinasCatalogo(this.clienteId!, this.petId!, this.authToken!, this.especiePet)
      .subscribe({
        next: (rows) => {
          this.catalogo = Array.isArray(rows) ? rows : [];
          this.carregandoCatalogo = false;
        },
        error: () => {
          this.catalogo = [];
          this.carregandoCatalogo = false;
        },
      });
  }

  private loadCronograma() {
    if (!this.canLoad()) return;
    this.carregandoCronograma = true;
    this.api
      .getPetVacinasCronograma(this.clienteId!, this.petId!, this.authToken!, this.especiePet)
      .subscribe({
        next: (res) => {
          this.cronograma = Array.isArray(res?.itens) ? res.itens : [];
          this.carregandoCronograma = false;
        },
        error: () => {
          this.cronograma = [];
          this.carregandoCronograma = false;
        },
      });
  }

  iniciarNova() {
    this.editandoId = null;
    this.formCatalogoId = '';
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
    this.formCatalogoId = row.catalogo_id != null ? String(row.catalogo_id) : '';
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
    const nome = (this.formNome || '').trim() || (this.catalogo.find((c) => String(c.id) === this.formCatalogoId)?.nome || '').trim();
    if (!nome) {
      this.toast.info('Selecione uma vacina do catálogo ou informe manualmente.', 'Atenção');
      return;
    }
    if (!(this.formDataAplicacao || '').trim()) {
      this.toast.info('Informe a data de aplicação.', 'Atenção');
      return;
    }
    const fd = new FormData();
    fd.append('nome', nome);
    if (this.formCatalogoId) fd.append('catalogo_id', this.formCatalogoId);
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

  validar(row: PetVacinaRow, status: 'validada' | 'rejeitada' | 'pendente') {
    if (!this.canLoad() || !row?.id || !this.podeValidarClinicamente) return;
    let motivo = '';
    if (status === 'rejeitada') {
      if (!isPlatformBrowser(this.platformId)) return;
      motivo = (prompt('Motivo da rejeição da dose (obrigatório):', '') || '').trim();
      if (!motivo) {
        this.toast.info('Informe um motivo para rejeitar o registro.', 'Validação');
        return;
      }
    }
    this.api
      .validarPetVacina(this.clienteId!, this.petId!, row.id, { status, motivo_rejeicao: motivo || undefined }, this.authToken!)
      .subscribe({
        next: () => {
          this.toast.success('Status de validação atualizado.');
          this.reload();
        },
        error: (err: any) => {
          const msg = err?.error?.error || err?.error?.message || err?.message || 'Erro ao validar dose';
          this.toast.error(msg, 'Erro');
        },
      });
  }

  onCatalogoChange() {
    const sel = this.catalogo.find((c) => String(c.id) === this.formCatalogoId);
    if (sel && !this.formNome.trim()) {
      this.formNome = sel.nome;
    }
  }

  statusValidacaoLabel(status?: string | null): string {
    const s = String(status || '').toLowerCase();
    if (s === 'validada') return 'Validada';
    if (s === 'rejeitada') return 'Rejeitada';
    return 'Pendente';
  }

  statusValidacaoMod(status?: string | null): 'ok' | 'warn' | 'danger' {
    const s = String(status || '').toLowerCase();
    if (s === 'validada') return 'ok';
    if (s === 'rejeitada') return 'danger';
    return 'warn';
  }

  private currentUserTipo(): string | null {
    if (!this.authToken) return null;
    const parts = String(this.authToken).split('.');
    if (parts.length < 2 || !isPlatformBrowser(this.platformId)) return null;
    try {
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(
        atob(b64)
          .split('')
          .map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
          .join('')
      );
      const payload = JSON.parse(json);
      return payload?.tipo ? String(payload.tipo).toLowerCase() : null;
    } catch {
      return null;
    }
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
