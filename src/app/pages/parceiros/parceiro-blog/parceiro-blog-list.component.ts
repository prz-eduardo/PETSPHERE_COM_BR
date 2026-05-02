import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ParceiroBlogService, BlogPostSummary } from '../../../services/parceiro-blog.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-parceiro-blog-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './parceiro-blog-list.component.html',
  styleUrls: ['./parceiro-blog-list.component.scss'],
})
export class ParceiroBlogListComponent implements OnInit {
  posts = signal<BlogPostSummary[]>([]);
  total = signal(0);
  page = signal(1);
  pageSize = 10;
  loading = signal(false);
  q = signal('');
  filterPublicado = signal<'all' | '1' | '0'>('all');

  constructor(
    private svc: ParceiroBlogService,
    private router: Router,
    private toast: ToastService,
  ) {}

  ngOnInit(): void { void this.load(); }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const publicado = this.filterPublicado() === 'all' ? undefined
        : this.filterPublicado() === '1' ? true : false;
      const res = await this.svc.listPosts({
        q: this.q() || undefined,
        page: this.page(),
        pageSize: this.pageSize,
        publicado,
      }).toPromise();
      this.posts.set(res?.data ?? []);
      this.total.set(res?.total ?? 0);
    } catch {
      this.toast.error('Erro ao carregar posts.');
    } finally {
      this.loading.set(false);
    }
  }

  search(): void { this.page.set(1); void this.load(); }

  totalPages(): number { return Math.ceil(this.total() / this.pageSize) || 1; }

  goPage(p: number): void { this.page.set(p); void this.load(); }

  async deletePost(post: BlogPostSummary): Promise<void> {
    if (!confirm(`Excluir o post "${post.titulo}"?`)) return;
    try {
      await this.svc.deletePost(post.id).toPromise();
      void this.load();
      this.toast.success('Post removido.');
    } catch {
      this.toast.error('Erro ao remover post.');
    }
  }
}
