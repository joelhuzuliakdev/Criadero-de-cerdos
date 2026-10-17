// Administración de usuarios (solo el dueño). Corre en el servidor.
import type { APIRoute } from 'astro';
import {
  ErrorHttp,
  clienteAdmin,
  crearCuenta,
  errorAuth,
  exigirDueno,
  json,
  leerCuerpo,
  respuestaError,
  validarClave,
  validarEmail,
  validarId,
  validarNombre,
  validarRol,
} from '../../lib/servidor';

export const prerender = false;

/** Crear un usuario nuevo */
export const POST: APIRoute = async ({ request }) => {
  try {
    const admin = clienteAdmin();
    await exigirDueno(request, admin);
    const b = await leerCuerpo(request);
    const usuario = await crearCuenta(admin, {
      nombre: validarNombre(b.nombre),
      email: validarEmail(b.email),
      clave: validarClave(b.clave),
      rol: validarRol(b.rol),
    });
    return json({ usuario }, 201);
  } catch (e) {
    return respuestaError(e);
  }
};

/** Cambiar contraseña y/o nombre de un usuario */
export const PATCH: APIRoute = async ({ request }) => {
  try {
    const admin = clienteAdmin();
    await exigirDueno(request, admin);
    const b = await leerCuerpo(request);
    const id = validarId(b.id);

    const cambios: { password?: string; user_metadata?: { nombre: string } } = {};
    let nombre: string | undefined;
    if (b.clave !== undefined) cambios.password = validarClave(b.clave);
    if (b.nombre !== undefined) {
      nombre = validarNombre(b.nombre);
      cambios.user_metadata = { nombre };
    }
    if (!cambios.password && !nombre) throw new ErrorHttp(400, 'No hay cambios para guardar.');

    const { error } = await admin.auth.admin.updateUserById(id, cambios);
    if (error) throw errorAuth(error);

    if (nombre) {
      const { error: e2 } = await admin.from('perfiles').update({ nombre }).eq('id', id);
      if (e2) throw e2;
    }
    return json({ ok: true });
  } catch (e) {
    return respuestaError(e);
  }
};

/** Eliminar un usuario definitivamente */
export const DELETE: APIRoute = async ({ request }) => {
  try {
    const admin = clienteAdmin();
    const yo = await exigirDueno(request, admin);
    const b = await leerCuerpo(request);
    const id = validarId(b.id);
    if (id === yo.id) throw new ErrorHttp(400, 'No podés eliminar tu propio usuario.');

    const { data: perfil } = await admin.from('perfiles').select('rol').eq('id', id).maybeSingle();
    if (perfil?.rol === 'dueno') {
      const { count } = await admin.from('perfiles').select('id', { count: 'exact', head: true }).eq('rol', 'dueno');
      if ((count ?? 0) <= 1) throw new ErrorHttp(400, 'Debe existir al menos un usuario dueño.');
    }

    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw errorAuth(error);
    return json({ ok: true });
  } catch (e) {
    return respuestaError(e);
  }
};