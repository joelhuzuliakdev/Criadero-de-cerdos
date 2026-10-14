// Control de sesión y permisos de cada página
import { supabase } from './supabase';

export interface Perfil {
    id: string;
    email: string | null;
    nombre: string;
    rol: 'dueno' | 'empleado' | 'pendiente';
}

const CLAVE = 'criadero:perfil';

function leerCache(userId: string): Perfil | null {
    try {
        const p = JSON.parse(sessionStorage.getItem(CLAVE) ?? 'null') as Perfil | null;
        return p && p.id === userId ? p : null;
    } catch {
        return null;
    }
}
function guardarCache(p: Perfil) {
    try {
        sessionStorage.setItem(CLAVE, JSON.stringify(p));
    } catch {
        /* sin almacenamiento disponible */
    }
}
export function limpiarCache() {
    try {
        sessionStorage.removeItem(CLAVE);
    } catch {
        /* nada */
    }
}

async function traerPerfil(userId: string): Promise<Perfil | null> {
    const { data, error } = await supabase.from('perfiles').select('id, email, nombre, rol').eq('id', userId).maybeSingle();
    if (error) throw error;
    if (data) guardarCache(data as Perfil);
    return (data as Perfil) ?? null;
}

function mostrarErrorConexion() {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;padding:1.5rem;background:var(--color-fondo);z-index:100';
    div.innerHTML = `<div style="max-width:22rem;text-align:center;display:grid;gap:.75rem">
        <p style="font-weight:600;font-size:1rem">No se pudo conectar con el servidor</p>
        <p style="color:var(--color-texto-2)">Revisá tu conexión a internet e intentá de nuevo.</p>
        <button class="btn btn-primario" type="button">Reintentar</button></div>`;
    div.querySelector('button')!.addEventListener('click', () => location.reload());
    document.body.appendChild(div);
}

function mostrarApp(p: Perfil) {
    document.body.dataset.rol = p.rol;
    document.querySelectorAll<HTMLElement>('[data-usuario-nombre]').forEach((el) => (el.textContent = p.nombre || p.email || ''));
    document.querySelectorAll<HTMLElement>('[data-usuario-rol]').forEach((el) => (el.textContent = p.rol === 'dueno' ? 'Dueño' : 'Empleado'));
    document.body.classList.remove('cargando');
}

/**
 * Verifica la sesión al entrar a una página.
 * - Sin sesión: redirige al login.
 * - Usuario sin habilitar: cierra sesión y avisa.
 * - Página solo para el dueño: redirige al tablero.
 */
export async function iniciarPagina(opts: { soloDueno?: boolean } = {}): Promise<Perfil> {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) {
        location.replace('/login/');
        return new Promise(() => {});
    }

    let perfil = leerCache(user.id);
    if (perfil) {
        // Actualiza en segundo plano por si cambió el rol
        traerPerfil(user.id).then((p) => {
        if (!p || p.rol !== perfil!.rol) location.reload();
        }).catch(() => {});
    } else {
        try {
        perfil = await traerPerfil(user.id);
        } catch {
        mostrarErrorConexion();
        return new Promise(() => {});
        }
    }

    if (!perfil || perfil.rol === 'pendiente') {
        await cerrarSesion('?motivo=pendiente');
        return new Promise(() => {});
    }
    if (opts.soloDueno && perfil.rol !== 'dueno') {
        location.replace('/');
        return new Promise(() => {});
    }

    mostrarApp(perfil);
    return perfil;
}

export async function cerrarSesion(query = '') {
    limpiarCache();
    await supabase.auth.signOut().catch(() => {});
    location.replace('/login/' + query);
}

// Si la sesión se cierra en otra pestaña, volver al login
supabase.auth.onAuthStateChange((evento) => {
    if (evento === 'SIGNED_OUT' && !location.pathname.startsWith('/login')) {
        limpiarCache();
        location.replace('/login/');
    }
});