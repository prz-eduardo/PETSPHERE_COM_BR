import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

/**
 * Mantém compatibilidade com URLs antigas `/parceiros/chat/:clienteId` → `/parceiros/mensagens/:clienteId`.
 */
@Component({
  selector: 'app-parceiro-chat-cliente',
  standalone: true,
  template: '',
})
export class ParceiroChatClienteComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  ngOnInit(): void {
    const raw = this.route.snapshot.paramMap.get('clienteId');
    if (raw != null && /^\d+$/.test(raw)) {
      void this.router.navigate(['/parceiros/mensagens', raw], { replaceUrl: true });
    } else {
      void this.router.navigate(['/parceiros/mensagens'], { replaceUrl: true });
    }
  }
}
