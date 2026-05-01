import { inject } from '@angular/core';
import { CanMatchFn } from '@angular/router';
import { TenantLojaService } from '../services/tenant-loja.service';

/** Rota raiz com vitrine do parceiro (subdomínio / domínio customizado). */
export const tenantLojaRootCanMatch: CanMatchFn = () => inject(TenantLojaService).isTenantLoja();

/** Hub Petsphere no domínio principal (sem tenant). */
export const petsphereHubRootCanMatch: CanMatchFn = () => !inject(TenantLojaService).isTenantLoja();
