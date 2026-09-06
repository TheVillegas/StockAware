/**
 * Sesión: login, token y permisos.
 *
 * Los permisos son las glosas de las funciones del perfil, las mismas que usa
 * el guard del backend. El menú y los botones se dibujan a partir de ellas —
 * igual que el ERP, que consulta Permiso_Funcion() antes de mostrar cada
 * opción. Ocultar el botón es comodidad; quien autoriza de verdad es el
 * backend.
 */
import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import type { LoginRespuesta, UsuarioAutenticado } from './modelos';

const LLAVE_TOKEN = 'stockaware.token';
const LLAVE_USUARIO = 'stockaware.usuario';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly usuario = signal<UsuarioAutenticado | null>(this.leerUsuario());
  readonly autenticado = computed(() => this.usuario() !== null);

  private leerUsuario(): UsuarioAutenticado | null {
    try {
      const crudo = localStorage.getItem(LLAVE_USUARIO);
      return crudo ? (JSON.parse(crudo) as UsuarioAutenticado) : null;
    } catch {
      return null;
    }
  }

  get token(): string | null {
    try {
      return localStorage.getItem(LLAVE_TOKEN);
    } catch {
      return null;
    }
  }

  async login(username: string, password: string): Promise<void> {
    const r = await firstValueFrom(
      this.http.post<LoginRespuesta>(`${environment.api}/auth/login`, {
        username,
        password,
      }),
    );

    try {
      localStorage.setItem(LLAVE_TOKEN, r.access_token);
      localStorage.setItem(LLAVE_USUARIO, JSON.stringify(r.usuario));
    } catch {
      // Navegación privada o almacenamiento bloqueado: la sesión vive solo en
      // memoria y se pierde al recargar, pero la app sigue usable.
    }
    this.usuario.set(r.usuario);
  }

  salir(): void {
    try {
      localStorage.removeItem(LLAVE_TOKEN);
      localStorage.removeItem(LLAVE_USUARIO);
    } catch {
      /* nada que limpiar */
    }
    this.usuario.set(null);
    void this.router.navigate(['/login']);
  }

  puede(permiso: string): boolean {
    return this.usuario()?.permisos.includes(permiso) ?? false;
  }
}
