/**
 * Acceso al backend.
 *
 * El interceptor pone el Bearer; aquí solo se arman las URL y se traduce el
 * error a un mensaje que se pueda mostrar. El backend ya devuelve mensajes en
 * castellano y con detalle (el 409 dice qué valor colisionó), así que se
 * aprovechan en vez de inventar textos genéricos.
 */
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import type { Documento, FilaStock, Pagina } from './modelos';

export interface ConsultaListado {
  pagina?: number;
  limite?: number;
  buscar?: string;
  [k: string]: string | number | undefined;
}

export const mensajeDeError = (e: unknown): string => {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) {
      return 'No hay conexión con el servidor. ¿Está corriendo el backend en el puerto 3000?';
    }
    const cuerpo = e.error as { message?: string | string[]; detalle?: string } | null;
    const m = cuerpo?.message;
    const texto = Array.isArray(m) ? m.join('. ') : m;
    return [texto, cuerpo?.detalle].filter(Boolean).join(' — ') || `Error ${e.status}`;
  }
  return e instanceof Error ? e.message : 'Error inesperado';
};

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  private params(q: ConsultaListado = {}): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(q)) {
      if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    }
    return p;
  }

  listar<T>(recurso: string, q: ConsultaListado = {}): Promise<Pagina<T>> {
    return firstValueFrom(
      this.http.get<Pagina<T>>(`${environment.api}/${recurso}`, { params: this.params(q) }),
    );
  }

  obtener<T>(recurso: string, id: number): Promise<T> {
    return firstValueFrom(this.http.get<T>(`${environment.api}/${recurso}/${id}`));
  }

  crear<T>(recurso: string, cuerpo: unknown): Promise<T> {
    return firstValueFrom(this.http.post<T>(`${environment.api}/${recurso}`, cuerpo));
  }

  actualizar<T>(recurso: string, id: number, cuerpo: unknown): Promise<T> {
    return firstValueFrom(this.http.put<T>(`${environment.api}/${recurso}/${id}`, cuerpo));
  }

  accion<T>(ruta: string, cuerpo: unknown = {}): Promise<T> {
    return firstValueFrom(this.http.post<T>(`${environment.api}/${ruta}`, cuerpo));
  }

  eliminar<T>(ruta: string): Promise<T> {
    return firstValueFrom(this.http.delete<T>(`${environment.api}/${ruta}`));
  }

  // --- atajos con tipo ------------------------------------------------------

  stock(q: ConsultaListado = {}): Promise<FilaStock[]> {
    return firstValueFrom(
      this.http.get<FilaStock[]>(`${environment.api}/inventario/stock`, {
        params: this.params(q),
      }),
    );
  }

  ordenes(q: ConsultaListado = {}): Promise<Pagina<Documento>> {
    return this.listar<Documento>('compras/ordenes', q);
  }

  orden(id: number): Promise<Documento> {
    return this.obtener<Documento>('compras/ordenes', id);
  }

  hesDeOrden(id: number): Promise<Documento[]> {
    return firstValueFrom(
      this.http.get<Documento[]>(`${environment.api}/compras/ordenes/${id}/hes`),
    );
  }
}
