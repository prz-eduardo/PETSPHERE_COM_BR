import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { QuillModule } from 'ngx-quill';
import { ParceiroBlogService } from '../../../services/parceiro-blog.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-parceiro-blog-edit',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, QuillModule],
  templateUrl: './parceiro-blog-edit.component.html',
  styleUrl: './parceiro-blog-edit.component.scss',
})
export class ParceiroBlogEditComponent implements OnInit {
  isNew = signal(true);
  postId = signal<number | null>(null);
  loading = signal(false);
  saving = signal(false);
  uploadingCover = signal(false);

  titulo = signal('');
  slug = signal('');
  conteudo = signal('');
  imagemCapa = signal<string | null>(null);
  publicado = signal(false);

  quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      [{ header: [2, 3, 4, false] }],
      [{ list: 'ordered' }, { list: 'bullet' }],
      ['blockquote', 'code-block'],
      ['link', 'image'],
      [{ align: [] }],
      ['clean'],
    ],
  };

  constructor(
    private svc: ParceiroBlogService,
    private route: ActivatedRoute,
    private router: Router,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam && idParam !== 'novo') {
      this.isNew.set(false);
      this.postId.set(Number(idParam));
      void this.loadPost(Number(idParam));
    }
  }

  private async loadPost(id: number): Promise<void> {
    this.loading.set(true);
    try {
      const post = await this.svc.getPost(id).toPromise();
      if (!post) return;
      this.titulo.set(post.titulo);
      this.slug.set(post.slug);
      this.conteudo.set(post.conteudo ?? '');
      this.imagemCapa.set(post.imagem_capa);
      this.publicado.set(post.publicado);
    } catch {
      this.toast.error('Erro ao carregar post.');
    } finally {
      this.loading.set(false);
    }
  }

  autoSlug(): void {
    if (this.isNew()) {
      this.slug.set(
        this.titulo()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 200)
      );
    }
  }

  async pickCover(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    this.uploadingCover.set(true);
    try {
      const res = await this.svc.uploadCover(file).toPromise();
      if (res?.url) this.imagemCapa.set(res.url);
    } catch {
      this.toast.error('Erro ao fazer upload da capa.');
    } finally {
      this.uploadingCover.set(false);
    }
  }

  removeCover(): void { this.imagemCapa.set(null); }

  async save(andPublish?: boolean): Promise<void> {
    if (!this.titulo()) { this.toast.error('Informe o título do post.'); return; }
    this.saving.set(true);
    try {
      const dto = {
        titulo: this.titulo(),
        slug: this.slug() || undefined,
        conteudo: this.conteudo() || null,
        imagem_capa: this.imagemCapa(),
        publicado: andPublish != null ? andPublish : this.publicado(),
      };
      if (this.isNew()) {
        const created = await this.svc.createPost(dto).toPromise();
        this.toast.success('Post criado!');
        void this.router.navigate(['../', created!.id], { relativeTo: this.route });
      } else {
        await this.svc.updatePost(this.postId()!, dto).toPromise();
        this.publicado.set(dto.publicado);
        this.toast.success('Post salvo!');
      }
    } catch (e: any) {
      this.toast.error(e?.error?.error || 'Erro ao salvar post.');
    } finally {
      this.saving.set(false);
    }
  }
}
