import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../services/session.service';

/** Área exclusiva de cliente (JWT principal com tipo cliente). */
export const clienteSessionGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);
  const decoded = session.decodeToken();
  if (!decoded || !session.hasValidSession(false)) {
    return router.parseUrl('/restrito/login');
  }
  const tipo = String((decoded as { tipo?: string; role?: string }).tipo || (decoded as { role?: string }).role || '');
  if (tipo !== 'cliente') {
    return router.parseUrl('/');
  }
  return true;
};
