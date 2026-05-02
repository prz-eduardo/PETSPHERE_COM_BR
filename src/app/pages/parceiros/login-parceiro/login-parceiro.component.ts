import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ParceiroAuthService } from '../../../services/parceiro-auth.service';

const PAINEL_URL = '/parceiros/painel';

@Component({
  selector: 'app-login-parceiro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-parceiro.component.html',
  styleUrls: ['./login-parceiro.component.scss'],
})
export class LoginParceiroComponent implements OnInit {
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');

  constructor(
    private auth: ParceiroAuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      void this.router.navigateByUrl(this.resolvePostLoginUrl(this.route.snapshot.queryParamMap.get('returnUrl')));
    }
  }

  /** Evita loop (returnUrl = login) e URLs fora do painel parceiro. */
  private resolvePostLoginUrl(returnUrl: string | null): string {
    const raw = (returnUrl ?? '').trim();
    if (!raw) {
      return PAINEL_URL;
    }

    let navigateTo: string;
    let pathForChecks: string;

    if (raw.includes('://')) {
      try {
        const u = new URL(raw);
        if (typeof window !== 'undefined' && u.origin !== window.location.origin) {
          return PAINEL_URL;
        }
        navigateTo = u.pathname + u.search + u.hash;
        pathForChecks = u.pathname;
      } catch {
        return PAINEL_URL;
      }
    } else {
      navigateTo = raw;
      pathForChecks = (raw.split('?')[0] || '').split('#')[0] || '';
    }

    if (!pathForChecks.startsWith('/parceiros/')) {
      return PAINEL_URL;
    }
    if (
      pathForChecks.startsWith('/parceiros/login') ||
      pathForChecks.startsWith('/parceiros/recuperar-senha') ||
      pathForChecks.startsWith('/parceiros/convite/')
    ) {
      return PAINEL_URL;
    }

    return navigateTo;
  }

  onSubmit(): void {
    this.error.set('');
    if (!this.email || !this.password) {
      this.error.set('Preencha e-mail e senha.');
      return;
    }
    this.loading.set(true);
    
    // Call real login endpoint
    this.auth.login(this.email, this.password)
      .then(() => {
        this.loading.set(false);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        void this.router.navigateByUrl(this.resolvePostLoginUrl(returnUrl));
      })
      .catch((err) => {
        this.loading.set(false);
        console.error('Login error:', err);
        this.error.set(err?.error?.error || 'Credenciais inválidas.');
      });
  }
}
