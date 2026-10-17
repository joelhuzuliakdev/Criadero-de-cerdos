// Utilidades SOLO para el servidor (rutas /api). No importar desde páginas ni scripts del navegador.
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { SUPABASE_SECRET_KEY } from 'astro:env/server';

export class ErrorHttp extends Error {
  constructor(public status: number, mensaje: string) {
    super(mensaje);
  }
}

/** Respuesta JSON sin caché */
export function json(datos: unknown, status = 200): Response {
  return new Response(JSON.stringify(datos), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

/** Convierte cualquier error en una respuesta clara para el usuario */
export function respuestaError(err: unknown): Response {
  if (err instanceof ErrorHttp) return json({ error: err.message }, err.status);
  console.error('[api] error inesperado:', err);
  return json({ error: 'Ocurrió un error inesperado. Intentá de nuevo en unos minutos.' }, 500);
}

/** Cliente de Supabase con permisos de administrador (usa la clave secreta) */
export function clienteAdmin(): SupabaseClient {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  if (!url || !SUPABASE_SECRET_KEY) {
    throw new ErrorHttp(
      503,
      'La gestión de usuarios no está configurada en el servidor. Falta la variable SUPABASE_SECRET_KEY.'
    );
  }
  return createClient(url, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** Verifica la sesión de quien hace el pedido y que sea Dueño */
export async function exigirDueno(request: Request, admin: SupabaseClient): Promise<User> {
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new ErrorHttp(401, 'Tu sesión expiró. Volvé a ingresar.');

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new ErrorHttp(401, 'Tu sesión expiró. Volvé a ingresar.');

  const { data: perfil, error: errPerfil } = await admin.from('perfiles').select('rol').eq('id', data.user.id).maybeSingle();
  if (errPerfil) throw errPerfil;
  if (perfil?.rol !== 'dueno') throw new ErrorHttp(403, 'Solo el dueño puede administrar usuarios.');
  return data.user;
}

/** Lee el cuerpo JSON del pedido de forma segura */
export async function leerCuerpo(request: Request): Promise<Record<string, unknown>> {
  try {
    const datos = await request.json();
    return datos && typeof datos === 'object' ? (datos as Record<string, unknown>) : {};
  } catch {
    throw new ErrorHttp(400, 'Datos inválidos.');
  }
}

/* ------------------------- Validaciones ------------------------- */
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validarEmail(v: unknown): string {
  const email = String(v ?? '').trim().toLowerCase();
  if (!RE_EMAIL.test(email) || email.length > 160) throw new ErrorHttp(400, 'El correo electrónico no es válido.');
  return email;
}

export function validarClave(v: unknown): string {
  const clave = String(v ?? '');
  if (clave.length < 8) throw new ErrorHttp(400, 'La contraseña debe tener al menos 8 caracteres.');
  if (clave.length > 72) throw new ErrorHttp(400, 'La contraseña es demasiado larga (máximo 72 caracteres).');
  return clave;
}

export function validarNombre(v: unknown): string {
  const nombre = String(v ?? '').trim().replace(/\s+/g, ' ');
  if (!nombre) throw new ErrorHttp(400, 'Ingresá el nombre de la persona.');
  if (nombre.length > 80) throw new ErrorHttp(400, 'El nombre es demasiado largo.');
  return nombre;
}

export function validarRol(v: unknown): 'dueno' | 'empleado' {
  if (v === 'dueno' || v === 'empleado') return v;
  throw new ErrorHttp(400, 'Rol inválido.');
}

export function validarId(v: unknown): string {
  const id = String(v ?? '');
  if (!RE_UUID.test(id)) throw new ErrorHttp(400, 'Usuario inválido.');
  return id;
}

/** Traduce los errores de Supabase Auth a mensajes claros */
export function errorAuth(error: { message?: string; code?: string; status?: number }): ErrorHttp {
  const m = (error.message ?? '').toLowerCase();
  if (error.code === 'email_exists' || m.includes('already been registered') || m.includes('already registered')) {
    return new ErrorHttp(409, 'Ya existe un usuario con ese correo electrónico.');
  }
  if (error.code === 'weak_password' || m.includes('password')) {
    return new ErrorHttp(400, 'La contraseña no es válida. Usá al menos 8 caracteres.');
  }
  if (error.code === 'user_not_found' || m.includes('not found')) {
    return new ErrorHttp(404, 'El usuario no existe.');
  }
  if (m.includes('dueño')) return new ErrorHttp(400, 'Debe existir al menos un usuario dueño.');
  console.error('[api] error de auth:', error);
  return new ErrorHttp(500, 'No se pudo completar la operación con el usuario. Intentá de nuevo.');
}

/** Crea una cuenta ya confirmada y le asigna nombre y rol */
export async function crearCuenta(
  admin: SupabaseClient,
  datos: { nombre: string; email: string; clave: string; rol: 'dueno' | 'empleado' }
) {
  const { data, error } = await admin.auth.admin.createUser({
    email: datos.email,
    password: datos.clave,
    email_confirm: true,
    user_metadata: { nombre: datos.nombre },
  });
  if (error || !data.user) throw errorAuth(error ?? {});

  const id = data.user.id;
  const { error: errPerfil } = await admin
    .from('perfiles')
    .upsert({ id, email: datos.email, nombre: datos.nombre, rol: datos.rol }, { onConflict: 'id' });

  if (errPerfil) {
    // Deshacer: no dejar una cuenta a medio crear
    await admin.auth.admin.deleteUser(id).catch(() => {});
    throw errPerfil;
  }
  return { id, email: datos.email, nombre: datos.nombre, rol: datos.rol };
}