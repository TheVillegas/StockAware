import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
<<<<<<< Updated upstream
import { registerLocaleData } from '@angular/common';
import localeEsCl from '@angular/common/locales/es-CL';
import { LOCALE_ID } from '@angular/core';
import {
  PreloadAllModules, RouteReuseStrategy, provideRouter, withComponentInputBinding,
  withPreloading,
} from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authInterceptor } from './app/core/guards';

registerLocaleData(localeEsCl);

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    { provide: LOCALE_ID, useValue: 'es-CL' },
    provideIonicAngular(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes, withPreloading(PreloadAllModules), withComponentInputBinding()),
  ],
});
=======
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { AppComponent } from './app/app.component';
import { rutas } from './app/app.routes';
import { expiracionInterceptor, tokenInterceptor } from './app/core/auth.service';

bootstrapApplication(AppComponent, {
  providers: [
    provideIonicAngular({}),
    provideRouter(rutas),
    provideHttpClient(withInterceptors([tokenInterceptor, expiracionInterceptor])),
  ],
}).catch((e) => console.error(e));
>>>>>>> Stashed changes
