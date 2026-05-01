import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TenantLojaService } from '../services/tenant-loja.service';

/** Páginas de marketing institucional da marca Petsphere — indisponíveis na vitrine (subdomínio / tenant). */
export const tenantBlockPetsphereMarketingGuard: CanActivateFn = async () => {
  const tenant = inject(TenantLojaService);
  const router = inject(Router);
  await tenant.ensureHostResolved();
  if (!tenant.isTenantLoja()) return true;
  return router.parseUrl('/');
};
