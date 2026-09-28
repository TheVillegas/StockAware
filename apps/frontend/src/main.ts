import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
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
