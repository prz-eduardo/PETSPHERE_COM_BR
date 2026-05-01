import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminMonetizacaoService, PlanoSaaS } from '../../../../services/admin-monetizacao.service';

@Component({
  selector: 'app-planos-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './planos.component.html',
  styleUrls: ['./planos.component.scss'],
})
export class PlanosAdminComponent implements OnInit {
  private api = inject(AdminMonetizacaoService);

  loading = signal(false);
  saving = signal(false);
  errorMsg = signal<string | null>(null);
  successMsg = signal<string | null>(null);
  planos = signal<PlanoSaaS[]>([]);

  editing: Partial<PlanoSaaS> | null = null;

  ngOnInit() { this.reload(); }

  reload() {
    this.loading.set(true);
    this.errorMsg.set(null);
    this.api.listPlanos().subscribe({
      next: (r) => { this.planos.set(r.data || []); this.loading.set(false); },
      error: (e) => { this.errorMsg.set(this.extractError(e)); this.loading.set(false); },
    });
  }

  novoPlano() {
    this.editing = {
      nome: '', slug: '', descricao: '', preco_mensal: 0,
      creditos_mensais_inclusos: 0, permite_automacoes: true, ativo: true,
    };
    this.successMsg.set(null);
    this.errorMsg.set(null);
  }

  editar(p: PlanoSaaS) {
    this.editing = { ...p };
    this.successMsg.set(null);
    this.errorMsg.set(null);
  }

  cancelar() { this.editing = null; }

  salvar() {
    if (!this.editing) return;
    this.saving.set(true);
    this.errorMsg.set(null);
    const op = this.editing.id
      ? this.api.updatePlano(this.editing.id, this.editing)
      : this.api.createPlano(this.editing);
    op.subscribe({
      next: () => {
        this.successMsg.set('Plano salvo com sucesso.');
        this.saving.set(false);
        this.editing = null;
        this.reload();
      },
      error: (e) => { this.errorMsg.set(this.extractError(e)); this.saving.set(false); },
    });
  }

  remover(p: PlanoSaaS) {
    if (!confirm(`Desativar plano "${p.nome}"?`)) return;
    this.api.removePlano(p.id).subscribe({
      next: () => this.reload(),
      error: (e) => this.errorMsg.set(this.extractError(e)),
    });
  }

  toggleAutomacoes(checked: boolean) {
    if (this.editing) this.editing.permite_automacoes = checked;
  }

  toggleAtivo(checked: boolean) {
    if (this.editing) this.editing.ativo = checked;
  }

  trackById(_i: number, p: PlanoSaaS) { return p.id; }

  formatBRL(v: number | null | undefined): string {
    const n = Number(v || 0);
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  private extractError(err: any): string {
    return err?.error?.error || err?.message || 'Erro inesperado.';
  }
}
