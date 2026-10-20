import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { PreloadAllModules, provideRouter, withPreloading } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { AppComponent } from './app/app.component';
import { rutas } from './app/app.routes';
import { expiracionInterceptor, tokenInterceptor } from './app/core/auth.service';

bootstrapApplication(AppComponent, {
  providers: [
    provideIonicAngular({}),
    // Las paginas se cargan bajo demanda y luego se precargan en segundo plano:
    // el primer render no espera por ellas y navegar despues es instantaneo.
    provideRouter(rutas, withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors([tokenInterceptor, expiracionInterceptor])),
  ],
}).catch((e) => console.error(e));
