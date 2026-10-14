// Utilidades de interfaz: avisos, confirmaciones, tablas, formularios y errores
import { supabase } from './supabase';
import { esc } from './formato';
import { icono } from './icons';

/* ---------------------------------------------------------------
    Errores
   --------------------------------------------------------------- */
export function mensajeError(err: unknown): string {
    const e = err as { code?: string; message?: string; details?: string } | null;
    const msg = e?.message ?? String(err ?? '');
    if (/failed to fetch|networkerror|load failed|network request failed/i.test(msg)) {
        return 'No hay conexión con el servidor. Revisá internet e intentá de nuevo.';
    }
    if (/jwt expired|invalid jwt|refresh token/i.test(msg)) {
        return 'Tu sesión expiró. Volvé a ingresar.';
    }
    switch (e?.code) {
        case 'P0001':
        return msg;
        case '23505':
        return 'Ya existe un registro con ese dato. Revisá que no esté repetido.';
        case '23503':
        return 'No se puede completar: el registro tiene datos asociados.';
        case '23514':
        case '22003':
        return 'Hay valores fuera de rango. Revisá los datos ingresados.';
        case '22P02':
        case '22007':
        case '22008':
        return 'Hay un dato con formato inválido. Revisá fechas y números.';
        case '23502':
        return 'Faltan datos obligatorios.';
        case '42501':
        return 'No tenés permiso para realizar esta acción.';
        case 'PGRST116':
        return 'No se encontró el registro o no tenés permiso para modificarlo.';
    }
    return msg || 'Ocurrió un error inesperado.';
}

/* ---------------------------------------------------------------
   Avisos (toasts)
   --------------------------------------------------------------- */
export function aviso(texto: string, tipo: 'ok' | 'error' = 'ok') {
    const cont = document.getElementById('toasts');
    if (!cont) return;
    const el = document.createElement('div');
    el.className = `toast ${tipo === 'error' ? 'error' : ''}`;
    el.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
    el.innerHTML = `${icono(tipo === 'error' ? 'alert-triangle' : 'circle-check')}<span>${esc(texto)}</span>`;
    cont.appendChild(el);
    setTimeout(() => el.remove(), tipo === 'error' ? 6000 : 3000);
}
export const avisoError = (err: unknown) => aviso(mensajeError(err), 'error');

/* ---------------------------------------------------------------
    Confirmación
   --------------------------------------------------------------- */
export function confirmar(texto: string, opts: { titulo?: string; boton?: string; peligro?: boolean } = {}): Promise<boolean> {
    const dlg = document.getElementById('dlg-confirmar') as HTMLDialogElement | null;
    if (!dlg) return Promise.resolve(window.confirm(texto));
    (dlg.querySelector('[data-titulo]') as HTMLElement).textContent = opts.titulo ?? 'Confirmar';
    (dlg.querySelector('[data-texto]') as HTMLElement).textContent = texto;
    const ok = dlg.querySelector('[data-ok]') as HTMLButtonElement;
    ok.textContent = opts.boton ?? 'Confirmar';
    ok.className = `btn ${opts.peligro === false ? 'btn-primario' : 'btn-peligro'}`;
    return new Promise((resolve) => {
        const cerrar = () => {
        dlg.removeEventListener('close', cerrar);
        resolve(dlg.returnValue === 'ok');
        };
        dlg.returnValue = '';
        dlg.addEventListener('close', cerrar);
        dlg.showModal();
    });
}

/* ---------------------------------------------------------------
    Modales
   --------------------------------------------------------------- */
export function modal(id: string) {
    const dlg = document.getElementById(id) as HTMLDialogElement;
    const form = dlg.querySelector('form') as HTMLFormElement;
    const titulo = dlg.querySelector('[data-modal-titulo]') as HTMLElement;
    return {
        dlg,
        form,
        abrir(tituloTexto?: string) {
        if (tituloTexto) titulo.textContent = tituloTexto;
        dlg.showModal();
        const primero = form.querySelector<HTMLElement>('input:not([type=hidden]):not([readonly]), select, textarea');
        if (primero && window.matchMedia('(min-width: 640px)').matches) primero.focus();
        },
        cerrar() {
        dlg.close();
        },
    };
}

/** Bloquea un botón mientras se ejecuta una acción asíncrona */
export async function conCarga<T>(boton: HTMLButtonElement | null, fn: () => Promise<T>): Promise<T | undefined> {
    if (boton?.dataset.cargando !== undefined) return;
    if (boton) {
        boton.dataset.cargando = '';
        boton.disabled = true;
    }
    try {
        return await fn();
    } finally {
        if (boton) {
        delete boton.dataset.cargando;
        boton.disabled = false;
        }
    }
}

/* ---------------------------------------------------------------
    Formularios
   --------------------------------------------------------------- */
export function leerForm(form: HTMLFormElement): Record<string, string> {
    const datos: Record<string, string> = {};
    new FormData(form).forEach((v, k) => {
        datos[k] = typeof v === 'string' ? v.trim() : '';
    });
    return datos;
}

export function llenarForm(form: HTMLFormElement, datos: Record<string, unknown>) {
    for (const [k, v] of Object.entries(datos)) {
        const el = form.elements.namedItem(k) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
        if (!el || !('value' in el)) continue;
        if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = Boolean(v);
        else el.value = v === null || v === undefined ? '' : String(v);
    }
}

/** Texto vacío → null; número válido → number */
export const numONull = (v: string | undefined) => (v === undefined || v === '' ? null : Number(v));
export const textoONull = (v: string | undefined) => (v ? v : null);

/* ---------------------------------------------------------------
    Base de datos: guardar y eliminar verificando permisos
   --------------------------------------------------------------- */
export async function guardarFila(tabla: string, datos: Record<string, unknown>, id?: number | string | null) {
    const q = id
        ? supabase.from(tabla).update(datos).eq('id', id).select('id').single()
        : supabase.from(tabla).insert(datos).select('id').single();
    const { data, error } = await q;
    if (error) throw error;
    return data as { id: number };
}

export async function eliminarFila(tabla: string, id: number | string) {
    const { data, error } = await supabase.from(tabla).delete().eq('id', id).select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
        throw { code: '42501', message: 'No tenés permiso para eliminar este registro.' };
    }
}

/* ---------------------------------------------------------------
    Tablas (en pantallas chicas se ven como tarjetas)
   --------------------------------------------------------------- */
export interface Columna<T> {
    titulo: string;
    valor: (fila: T) => string;
    clase?: string;
}

export function renderTabla<T>(
    tabla: HTMLTableElement,
    columnas: Columna<T>[],
    filas: T[],
    opts: { vacio?: string; pie?: (string | null)[] | null } = {}
    ) {
    const thead = `<thead><tr>${columnas.map((c) => `<th class="${c.clase ?? ''}">${esc(c.titulo)}</th>`).join('')}</tr></thead>`;
    let tbody: string;
    if (filas.length === 0) {
        tbody = `<tbody><tr class="vacio"><td colspan="${columnas.length}">${esc(opts.vacio ?? 'No hay registros para mostrar.')}</td></tr></tbody>`;
    } else {
        tbody = `<tbody>${filas
        .map(
            (f) =>
            `<tr>${columnas
                .map((c) => `<td class="${c.clase ?? ''}" data-label="${esc(c.titulo)}">${c.valor(f)}</td>`)
                .join('')}</tr>`
        )
        .join('')}</tbody>`;
    }
    let tfoot = '';
    if (opts.pie && filas.length > 0) {
        tfoot = `<tfoot><tr>${opts.pie
        .map((v, i) => `<td class="${columnas[i]?.clase ?? ''}" data-label="${i === 0 || v === null || v === '' ? '' : esc(columnas[i]?.titulo ?? '')}">${v ?? ''}</td>`)
        .join('')}</tr></tfoot>`;
    }
    tabla.innerHTML = thead + tbody + tfoot;
}

export function tablaCargando(tabla: HTMLTableElement, columnas = 4, filas = 4) {
    const celda = '<td><div class="esqueleto h-4 w-full max-w-32"></div></td>';
    tabla.innerHTML = `<tbody>${Array.from({ length: filas }, () => `<tr>${celda.repeat(columnas)}</tr>`).join('')}</tbody>`;
}

/** Botones de acción para filas */
export function botonAccion(accion: string, id: number | string, icon: 'pencil' | 'trash' | 'eye' | 'check' | 'x' | 'baby-carriage', titulo: string, extra = '') {
    const peligro = icon === 'trash' ? ' peligro' : '';
    const soloDueno = icon === 'trash' ? ' data-solo-dueno' : '';
    return `<button type="button" class="btn btn-icono${peligro}" data-accion="${accion}" data-id="${id}" title="${esc(titulo)}" aria-label="${esc(titulo)}"${soloDueno} ${extra}>${icono(icon)}</button>`;
}

/** Escucha clics en botones con data-accion dentro de un contenedor */
export function alAccion(contenedor: HTMLElement, manejadores: Record<string, (id: string, boton: HTMLButtonElement) => void>) {
    contenedor.addEventListener('click', (ev) => {
        const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>('button[data-accion]');
        if (!btn || !contenedor.contains(btn)) return;
        const fn = manejadores[btn.dataset.accion ?? ''];
        if (fn) fn(btn.dataset.id ?? '', btn);
    });
}

/** Pestañas simples: botones [role=tab] con data-panel */
export function pestanas(contenedor: HTMLElement, alCambiar?: (panel: string) => void) {
    const tabs = Array.from(contenedor.querySelectorAll<HTMLButtonElement>('[role=tab]'));
    tabs.forEach((t) =>
        t.addEventListener('click', () => {
        tabs.forEach((x) => {
            const activo = x === t;
            x.setAttribute('aria-selected', String(activo));
            const panel = document.getElementById(x.dataset.panel ?? '');
            if (panel) panel.hidden = !activo;
        });
        alCambiar?.(t.dataset.panel ?? '');
        })
    );
}

/** Opciones de años para un <select>: incluye siempre el año actual */
export function opcionesAnios(anios: number[], seleccionado: number): string {
    const actual = Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric' }).format(new Date()));
    const lista = [...new Set([...anios, actual, seleccionado])].filter((a) => Number.isFinite(a)).sort((a, b) => b - a);
    return lista.map((a) => `<option value="${a}"${a === seleccionado ? ' selected' : ''}>${a}</option>`).join('');
}