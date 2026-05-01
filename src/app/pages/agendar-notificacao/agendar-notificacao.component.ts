import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-agendar-notificacao',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <main class="shell">
      <div class="card">
        <div class="icon" [attr.data-kind]="feedback.kind">{{ feedback.icon }}</div>
        <h1>{{ feedback.titulo }}</h1>
        <p>{{ feedback.texto }}</p>
        <a routerLink="/" class="cta">Ir ao site</a>
      </div>
    </main>
  `,
  styles: [
    `
      .shell {
        min-height: 60vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 32px 20px;
        background: radial-gradient(circle at 20% 20%, rgba(13, 184, 222, 0.12), transparent 45%),
          #0f172a;
        color: #e2e8f0;
        font-family: system-ui, sans-serif;
      }
      .card {
        max-width: 460px;
        width: 100%;
        padding: 32px;
        border-radius: 18px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(15, 23, 42, 0.75);
      }
      .icon {
        font-size: 42px;
        margin-bottom: 12px;
        line-height: 1;
      }
      .icon[data-kind='ok'] {
        letter-spacing: 0;
      }
      h1 {
        font-size: 1.35rem;
        margin: 0 0 10px;
        color: #f8fafc;
      }
      p {
        margin: 0 0 22px;
        line-height: 1.55;
        color: #94a3b8;
      }
      .cta {
        display: inline-flex;
        padding: 10px 18px;
        border-radius: 999px;
        background: #0db8de;
        color: #0f172a;
        font-weight: 600;
        text-decoration: none;
      }
    `,
  ],
})
export class AgendarNotificacaoComponent {
  readonly feedback: { kind: string; icon: string; titulo: string; texto: string };

  constructor(route: ActivatedRoute) {
    const q = route.snapshot.queryParamMap;
    const ok = q.get('ok');
    const err = q.get('erro');
    if (err === 'token_invalido' || ok === 'token_invalido') {
      this.feedback = this.mk('Este link parece incompleto ou expirado.', false);
    } else if (err === 'nao_encontrado') {
      this.feedback = this.mk('Encontramos o link, mas o agendamento não existe mais neste sistema.', false);
    } else if (ok === 'confirmado') {
      this.feedback = this.mk('Resposta gravada — seu horário ficou registrado.', true);
    } else if (ok === 'recusado') {
      this.feedback = this.mk('Registramos a recusa. O estabelecimento poderá propor outra data.', true);
    } else if (ok === 'ja_cancelado') {
      this.feedback = this.mk('Este agendamento já tinha sido encerrado ou recusado.', false);
    } else if (ok === 'ja_processado_cancelado') {
      this.feedback = this.mk(
        'Este agendamento já estava marcado antes — só precisávamos atualizar algo em segundo plano.',
        false
      );
    } else {
      this.feedback = this.mk('Abra pela mensagem mais recente do estabelecimento ou peça novo link.', false);
    }
  }

  private mk(sub: string, good: boolean) {
    if (good) {
      return {
        kind: 'ok',
        icon: '',
        titulo: 'Tudo certo',
        texto: sub,
      };
    }
    return {
      kind: 'warn',
      icon: '',
      titulo: 'Não conseguimos concluir por aqui',
      texto: sub,
    };
  }
}
