import { CommonModule } from '@angular/common';
import { Component, OnInit, signal, computed } from '@angular/core';
import { RouterModule } from '@angular/router';
import {
  CdkDragDrop,
  CdkDropList,
  CdkDrag,
  CdkDragHandle,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import {
  ParceirSiteBuilderService,
  SiteSection,
  SectionTipo,
} from '../../../services/parceiro-site-builder.service';
import { ToastService } from '../../../services/toast.service';
import { SiteSectionFormComponent } from './section-form/site-section-form.component';

@Component({
  selector: 'app-parceiro-site-builder',
  standalone: true,
  imports: [CommonModule, RouterModule, CdkDropList, CdkDrag, CdkDragHandle, SiteSectionFormComponent],
  templateUrl: './parceiro-site-builder.component.html',
  styleUrls: ['./parceiro-site-builder.component.scss'],
})
export class ParceirSiteBuilderComponent implements OnInit {
  sections = signal<SiteSection[]>([]);
  loading = signal(false);
  saving = signal(false);

  drawerOpen = signal(false);
  drawerMode = signal<'create' | 'edit'>('create');
  editingSection = signal<SiteSection | null>(null);
  newTipo = signal<SectionTipo>('hero');

  readonly TIPOS: { value: SectionTipo; label: string; icon: string }[] = [
    { value: 'hero', label: 'Banner Hero', icon: '🖼️' },
    { value: 'texto', label: 'Bloco de Texto', icon: '📝' },
    { value: 'galeria', label: 'Galeria de Imagens', icon: '🗂️' },
    { value: 'servicos', label: 'Serviços', icon: '🐾' },
    { value: 'whatsapp', label: 'WhatsApp / Contato', icon: '💬' },
  ];

  constructor(
    private svc: ParceirSiteBuilderService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await this.svc.getSections().toPromise();
      this.sections.set(res?.data ?? []);
    } catch {
      this.toast.error('Erro ao carregar seções.');
    } finally {
      this.loading.set(false);
    }
  }

  tipoLabel(tipo: SectionTipo): string {
    return this.TIPOS.find(t => t.value === tipo)?.label ?? tipo;
  }

  tipoIcon(tipo: SectionTipo): string {
    return this.TIPOS.find(t => t.value === tipo)?.icon ?? '';
  }

  openCreate(tipo: SectionTipo): void {
    this.newTipo.set(tipo);
    this.editingSection.set(null);
    this.drawerMode.set('create');
    this.drawerOpen.set(true);
  }

  openEdit(section: SiteSection): void {
    this.editingSection.set({ ...section });
    this.drawerMode.set('edit');
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.editingSection.set(null);
  }

  async onFormSave(dto: Partial<SiteSection>): Promise<void> {
    this.saving.set(true);
    try {
      if (this.drawerMode() === 'create') {
        const created = await this.svc.createSection(dto).toPromise();
        this.sections.update(list => [...list, created!]);
        this.toast.success('Seção criada com sucesso!');
      } else {
        const id = this.editingSection()!.id;
        const updated = await this.svc.updateSection(id, dto).toPromise();
        this.sections.update(list => list.map(s => s.id === id ? updated! : s));
        this.toast.success('Seção atualizada!');
      }
      this.closeDrawer();
    } catch {
      this.toast.error('Erro ao salvar seção.');
    } finally {
      this.saving.set(false);
    }
  }

  async toggleActive(section: SiteSection): Promise<void> {
    try {
      const updated = await this.svc.updateSection(section.id, { ativo: !section.ativo }).toPromise();
      this.sections.update(list => list.map(s => s.id === section.id ? updated! : s));
    } catch {
      this.toast.error('Erro ao alterar visibilidade da seção.');
    }
  }

  async deleteSection(section: SiteSection): Promise<void> {
    if (!confirm(`Excluir a seção "${section.titulo || this.tipoLabel(section.tipo)}"?`)) return;
    try {
      await this.svc.deleteSection(section.id).toPromise();
      this.sections.update(list => list.filter(s => s.id !== section.id));
      this.toast.success('Seção removida.');
    } catch {
      this.toast.error('Erro ao remover seção.');
    }
  }

  async onDrop(event: CdkDragDrop<SiteSection[]>): Promise<void> {
    if (event.previousIndex === event.currentIndex) return;
    const list = [...this.sections()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.sections.set(list);
    try {
      await this.svc.reorderSections(list.map(s => s.id)).toPromise();
    } catch {
      this.toast.error('Erro ao reordenar seções.');
      void this.load();
    }
  }
}
