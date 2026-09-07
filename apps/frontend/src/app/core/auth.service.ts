/**
 * Sesion del usuario.
 *
 * El token y la sesion se guardan en localStorage para sobrevivir al F5. El
 * menu no se arma aca: lo entrega el backend desde acceso_funciones, que es
 * la unica fuente de verdad de que puede ver cada perfil.
 */
import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, throwError } from 'rxjs';

export const API = 'http://localhost:3000/api';

export interface Sesion {
  id_usuario: number;
  login: string;
  nombre: string;
  mail: string;
  id_perfil: number;
  perfil: string;
  url_inicio: string;
  permisos: string[];
}

export interface OpcionMenu { id: number; codigo: string; titulo: string; implementada: boolean; }
export interface GrupoMenu { id: number; codigo: string; titulo: string; opciones: OpcionMenu[]; }

const LLAVE_TOKEN = 'erp_token';
const LLAVE_SESION = 'erp_sesion';

const leer = <T>(k: string): T | null => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; }
  catch { return null; }
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly sesion = signal<Sesion | null>(leer<Sesion>(LLAVE_SESION));
  readonly menu = signal<GrupoMenu[]>([]);
  readonly autenticado = computed(() => this.sesion() !== null);

  get token(): string | null {
    try { return localStorage.getItem(LLAVE_TOKEN); } catch { return null; }
  }

  async entrar(user: string, clave: string): Promise<void> {
    const r = await firstValueFrom(
      this.http.post<{ access_token: string; usuario: Sesion }>(
        `${API}/auth/login`, { user, clave },
      ),
    );
    try {
      localStorage.setItem(LLAVE_TOKEN, r.access_token);
      localStorage.setItem(LLAVE_SESION, JSON.stringify(r.usuario));
    } catch { /* modo privado: la sesion vive solo en memoria */ }
    this.sesion.set(r.usuario);
    await this.cargarMenu();
    this.router.navigateByUrl('/inicio');
  }

  async cargarMenu(): Promise<void> {
    try {
      this.menu.set(await firstValueFrom(this.http.get<GrupoMenu[]>(`${API}/menu`)));
    } catch {
      this.menu.set([]);   // el menu es accesorio: si falla, la pantalla sigue viva
    }
  }

  salir(motivo = ''): void {
    try { localStorage.removeItem(LLAVE_TOKEN); localStorage.removeItem(LLAVE_SESION); } catch {}
    this.sesion.set(null);
    this.menu.set([]);
    this.motivoSalida.set(motivo);
    this.router.navigateByUrl('/login');
  }

  /** Se muestra en el login cuando la salida no fue voluntaria. */
  readonly motivoSalida = signal('');
}

/** Agrega el Bearer a cada peticion. */
export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
  let t: string | null = null;
  try { t = localStorage.getItem(LLAVE_TOKEN); } catch {}
  return next(t ? req.clone({ setHeaders: { Authorization: `Bearer ${t}` } }) : req);
};

/**
 * El token vive 3600 segundos, igual que el MAX_IDLE_TIME del ERP. Cuando
 * vence, la sesion sigue guardada en localStorage y la aplicacion PARECE
 * conectada, pero cada peticion vuelve 401 y las pantallas quedan vacias.
 * Aca se cierra la sesion y se vuelve al login diciendo por que.
 */
export const expiracionInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  return next(req).pipe(
    catchError((e: unknown) => {
      const es401 = e instanceof HttpErrorResponse && e.status === 401;
      // El propio login devuelve 401 con credenciales malas: ese no se toca.
      if (es401 && !req.url.endsWith('/auth/login')) {
        auth.salir('Tu sesión expiró. Ingresá de nuevo.');
      }
      return throwError(() => e);
    }),
  );
};
