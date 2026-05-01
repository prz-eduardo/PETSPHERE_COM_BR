import { ApplicationConfig, LOCALE_ID, provideZoneChangeDetection, APP_INITIALIZER, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { accountBannedInterceptor } from './interceptors/account-banned.interceptor';
import { CookiePreferencesService } from './services/cookie-preferences.service';
import { TenantLojaService } from './services/tenant-loja.service';

function rehydrateCookiePreferencesFactory(cookie: CookiePreferencesService, platformId: object) {
  return () => {
    if (isPlatformBrowser(platformId)) {
      cookie.rehydrateFromStorage();
    }
  };
}

function tenantHostResolverFactory(tenant: TenantLojaService) {
  return () => tenant.initFromLocation();
}

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    /**
     * Resolve host/subdomínio antes da primeira navegação para que `canMatch` na raiz
     * escolha corretamente entre hub marca e vitrine tenant.
     */
    {
      provide: APP_INITIALIZER,
      useFactory: tenantHostResolverFactory,
      deps: [TenantLojaService],
      multi: true,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: rehydrateCookiePreferencesFactory,
      deps: [CookiePreferencesService, PLATFORM_ID],
      multi: true
    },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'enabled', // scrolla pro topo em novas navegações
        anchorScrolling: 'enabled'
      })
    ),
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch(), withInterceptors([accountBannedInterceptor]))
  ]
};

