// Llamadas desde el navegador a las rutas de servidor (/api/*)
import { supabase } from './supabase';

export async function llamarApi<T = unknown>(
  metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  ruta: string,
  cuerpo?: Record<string, unknown>,
  opts: { conSesion?: boolean } = { conSesion: true }
): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.conSesion !== false) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw { message: 'Tu sesión expiró. Volvé a ingresar.' };
    headers.authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(ruta, { method: metodo, headers, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  } catch {
    throw { message: 'No hay conexión con el servidor. Revisá internet e intentá de nuevo.' };
  }

  let datos: any = null;
  try {
    datos = await res.json();
  } catch {
    /* respuesta sin JSON */
  }

  if (!res.ok) {
    if (res.status === 404 && !datos) {
      throw { message: 'La gestión de usuarios no está disponible en esta instalación. Revisá la publicación del sistema.' };
    }
    throw { message: datos?.error ?? 'Ocurrió un error inesperado.' };
  }
  return datos as T;
}

/** Genera una contraseña fácil de dictar (sin letras confusas como O/0 o l/1) */
export function generarClave(largo = 10): string {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  const numeros = '23456789';
  const todos = letras + numeros;
  const azar = new Uint32Array(largo);
  crypto.getRandomValues(azar);
  const chars = Array.from(azar, (n) => todos[n % todos.length]);
  // Garantiza al menos un número
  if (!chars.some((c) => numeros.includes(c))) chars[chars.length - 1] = numeros[azar[0] % numeros.length];
  return chars.join('');
}