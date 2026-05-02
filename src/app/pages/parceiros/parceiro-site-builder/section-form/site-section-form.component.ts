import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  OnChanges,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuillModule } from 'ngx-quill';
import { SiteSection, SectionTipo, SectionImagem, ParceirSiteBuilderService } from '../../../../services/parceiro-site-builder.service';

@Component({
  selector: 'app-site-section-form',
  standalone: true,
  imports: [CommonModule, FormsModule, QuillModule],
  templateUrl: './site-section-form.component.html',
  styleUrls: ['./site-section-form.component.scss'],
})
export class SiteSectionFormComponent implements OnInit, OnChanges {
  @Input() tipo: SectionTipo = 'hero';
  @Input() initial: SiteSection | null = null;
  @Input() saving = false;
  @Output() saved = new EventEmitter<Partial<SiteSection>>();
  @Output() cancelled = new EventEmitter<void>();

  private svc = inject(ParceirSiteBuilderService);

  titulo = signal('');
  subtitulo = signal('');
  conteudo = signal('');
  ativo = signal(true);

  // hero / genérico
  ctaTexto = signal('');
  ctaUrl = signal('');

  // galeria
  imagens = signal<SectionImagem[]>([]);
  uploadingImage = signal(false);

  // whatsapp
  telefone = signal('');
  mensagem = signal('');

  quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline'],
      [{ header: [2, 3, false] }],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['link'],
      ['clean'],
    ],
  };

  ngOnInit(): void { this.populate(); }
  ngOnChanges(): void { this.populate(); }

  private populate(): void {
    const s = this.initial;
    this.titulo.set(s?.titulo ?? '');
    this.subtitulo.set(s?.subtitulo ?? '');
    this.conteudo.set(s?.conteudo ?? '');
    this.ativo.set(s?.ativo ?? true);
    this.imagens.set(s?.imagens ? [...s.imagens] : []);

    const cfg = s?.config ?? {};
    this.ctaTexto.set((cfg['cta_texto'] as string) ?? '');
    this.ctaUrl.set((cfg['cta_url'] as string) ?? '');
    this.telefone.set((cfg['telefone'] as string) ?? '');
    this.mensagem.set((cfg['mensagem'] as string) ?? '');
  }

  buildDto(): Partial<SiteSection> {
    const config: Record<string, unknown> = {};
    if (this.tipo === 'hero') {
      config['cta_texto'] = this.ctaTexto();
      config['cta_url'] = this.ctaUrl();
    }
    if (this.tipo === 'whatsapp') {
      config['telefone'] = this.telefone();
      config['mensagem'] = this.mensagem();
    }
    return {
      tipo: this.tipo,
      titulo: this.titulo() || null,
      subtitulo: this.subtitulo() || null,
      conteudo: this.conteudo() || null,
      imagens: this.imagens(),
      config,
      ativo: this.ativo(),
    };
  }

  submit(): void {
    this.saved.emit(this.buildDto());
  }

  cancel(): void { this.cancelled.emit(); }

  async pickImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    this.uploadingImage.set(true);
    try {
      const res = await this.svc.uploadImage(file).toPromise();
      if (res?.url) {
        this.imagens.update(list => [...list, { url: res.url, alt: '', legenda: '' }]);
      }
    } catch {
      alert('Erro ao fazer upload da imagem.');
    } finally {
      this.uploadingImage.set(false);
    }
  }

  removeImage(index: number): void {
    this.imagens.update(list => list.filter((_, i) => i !== index));
  }

  updateImageAlt(index: number, alt: string): void {
    this.imagens.update(list => list.map((img, i) => i === index ? { ...img, alt } : img));
  }

  updateImageLegenda(index: number, legenda: string): void {
    this.imagens.update(list => list.map((img, i) => i === index ? { ...img, legenda } : img));
  }
}
