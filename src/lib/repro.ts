// Lógica compartida de los formularios de servicio, parto y destete
import { supabase } from './supabase';
import { esc, fecha, hoyISO, sumarDias } from './formato';
import { DIAS_GESTACION, RESULTADOS_SERVICIO } from './etiquetas';
import { aviso, avisoError, conCarga, confirmar, guardarFila, leerForm, llenarForm, modal, numONull, textoONull } from './ui';

type Listo = () => void;
let alGuardar: Listo = () => {};

async function cerdasActivas(incluirId?: number | null) {
    const { data, error } = await supabase.from('cerdas').select('id, caravana, estado').order('caravana');
    if (error) throw error;
    return (data ?? []).filter((c) => c.estado === 'activa' || c.id === incluirId);
}

function opcionesCerdas(cerdas: { id: number; caravana: string }[], sel?: number | null) {
    return (
        '<option value="">Elegí una cerda…</option>' +
        cerdas.map((c) => `<option value="${c.id}"${c.id === sel ? ' selected' : ''}>${esc(c.caravana)}</option>`).join('')
    );
}

/* ------------------------------------------------------------------
    Servicio
   ------------------------------------------------------------------ */
const mServicio = () => modal('m-servicio');

export async function abrirServicio(opts: { cerdaId?: number; servicio?: Record<string, any>; fijarCerda?: boolean } = {}) {
    const m = mServicio();
    const s = opts.servicio;
    try {
        const cerdas = await cerdasActivas(s?.cerda_id ?? opts.cerdaId);
        m.form.reset();
        (m.form.elements.namedItem('cerda_id') as HTMLSelectElement).innerHTML = opcionesCerdas(cerdas, s?.cerda_id ?? opts.cerdaId);
    } catch (e) {
        avisoError(e);
        return;
    }
    (m.form.querySelector('[data-campo-cerda]') as HTMLElement).hidden = Boolean(opts.fijarCerda);
    const campoRes = m.form.querySelector('[data-campo-resultado]') as HTMLElement;
    campoRes.hidden = s?.resultado === 'parida';
    llenarForm(m.form, s ?? { fecha: hoyISO(), dosis: 2, resultado: 'pendiente' });
    actualizarFpp();
    m.abrir(s ? 'Editar servicio' : 'Registrar servicio');
}

function actualizarFpp() {
    const m = mServicio();
    const f = (m.form.elements.namedItem('fecha') as HTMLInputElement).value;
    (m.form.querySelector('[data-fpp]') as HTMLElement).textContent = f ? fecha(sumarDias(f, DIAS_GESTACION)) : '—';
}

/* ------------------------------------------------------------------
    Parto
   ------------------------------------------------------------------ */
const mParto = () => modal('m-parto');

async function cargarServiciosDeCerda(cerdaId: number | null, seleccionado?: number | null) {
    const sel = mParto().form.elements.namedItem('servicio_id') as HTMLSelectElement;
    if (!cerdaId) {
        sel.innerHTML = '<option value="">Sin servicio registrado</option>';
        return;
    }
    const { data, error } = await supabase
        .from('servicios')
        .select('id, fecha, fecha_probable_parto, resultado')
        .eq('cerda_id', cerdaId)
        .order('fecha', { ascending: false })
        .limit(12);
    if (error) throw error;
    const lista = (data ?? []).filter((s) => s.resultado !== 'parida' || s.id === seleccionado);
    sel.innerHTML =
        '<option value="">Sin servicio registrado</option>' +
        lista
        .map(
            (s) =>
            `<option value="${s.id}">Servicio del ${fecha(s.fecha)} · parto probable ${fecha(s.fecha_probable_parto)} · ${RESULTADOS_SERVICIO[s.resultado]?.texto ?? ''}</option>`
        )
        .join('');
    if (seleccionado) sel.value = String(seleccionado);
    else {
        const abierto = lista.find((s) => s.resultado === 'prenada' || s.resultado === 'pendiente');
        sel.value = abierto ? String(abierto.id) : '';
    }
}

export async function abrirParto(opts: { cerdaId?: number; parto?: Record<string, any>; fijarCerda?: boolean } = {}) {
    const m = mParto();
    const p = opts.parto;
    const cerdaId = p?.cerda_id ?? opts.cerdaId ?? null;
    try {
        const cerdas = await cerdasActivas(cerdaId);
        m.form.reset();
        (m.form.elements.namedItem('cerda_id') as HTMLSelectElement).innerHTML = opcionesCerdas(cerdas, cerdaId);
        await cargarServiciosDeCerda(cerdaId, p?.servicio_id);
    } catch (e) {
        avisoError(e);
        return;
    }
    (m.form.querySelector('[data-campo-cerda]') as HTMLElement).hidden = Boolean(opts.fijarCerda);
    llenarForm(m.form, p ? { ...p, servicio_id: p.servicio_id ?? '' } : { fecha: hoyISO(), nacidos_muertos: 0 });
    actualizarVivos();
    m.abrir(p ? 'Editar parto' : 'Registrar parto');
}

function actualizarVivos() {
    const f = mParto().form;
    const t = Number((f.elements.namedItem('nacidos_totales') as HTMLInputElement).value || 0);
    const mu = Number((f.elements.namedItem('nacidos_muertos') as HTMLInputElement).value || 0);
    (f.querySelector('[data-vivos]') as HTMLElement).textContent = String(Math.max(t - mu, 0));
}

/* ------------------------------------------------------------------
    Destete
   ------------------------------------------------------------------ */
const mDestete = () => modal('m-destete');
let desteteActual: { parto: Record<string, any>; bajas: { fecha: string; cantidad: number }[] } | null = null;

export async function abrirDestete(parto: Record<string, any>, caravana: string) {
    const m = mDestete();
    const { data, error } = await supabase.from('bajas').select('fecha, cantidad').eq('parto_id', parto.id).eq('es_destete', false);
    if (error) return avisoError(error);
    desteteActual = { parto, bajas: data ?? [] };
    m.form.reset();
    const q = (s: string) => m.form.querySelector(s) as HTMLElement;
    q('[data-d-cerda]').textContent = caravana;
    q('[data-d-parto]').textContent = fecha(parto.fecha);
    q('[data-d-nacidos]').textContent = String(parto.nacidos_vivos);
    q('[data-anular-destete]').hidden = parto.destetados === null || parto.destetados === undefined;
    const inpFecha = m.form.elements.namedItem('fecha_destete') as HTMLInputElement;
    inpFecha.min = parto.fecha;
    llenarForm(m.form, {
        parto_id: parto.id,
        fecha_destete: parto.fecha_destete ?? hoyISO(),
        destetados: parto.destetados ?? '',
    });
    actualizarDestete();
    m.abrir(parto.destetados !== null && parto.destetados !== undefined ? 'Corregir destete' : 'Registrar destete');
}

function actualizarDestete() {
    if (!desteteActual) return;
    const f = mDestete().form;
    const fd = (f.elements.namedItem('fecha_destete') as HTMLInputElement).value;
    const bajas = desteteActual.bajas.filter((b) => !fd || b.fecha <= fd).reduce((a, b) => a + b.cantidad, 0);
    const vivos = desteteActual.parto.nacidos_vivos - bajas;
    const inp = f.elements.namedItem('destetados') as HTMLInputElement;
    inp.max = String(Math.max(vivos, 0));
    const dest = inp.value === '' ? vivos : Number(inp.value);
    (f.querySelector('[data-d-bajas]') as HTMLElement).textContent = String(bajas);
    (f.querySelector('[data-d-muertes]') as HTMLElement).textContent = String(Math.max(vivos - dest, 0));
}

/* ------------------------------------------------------------------
    Inicialización (llamar una vez por página)
   ------------------------------------------------------------------ */
export function iniciarRepro(onGuardado: Listo) {
    alGuardar = onGuardado;

    // Servicio
    const ms = mServicio();
    (ms.form.elements.namedItem('fecha') as HTMLInputElement).addEventListener('input', actualizarFpp);
    ms.form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const btn = ms.form.querySelector<HTMLButtonElement>('[data-guardar]');
        conCarga(btn, async () => {
        const d = leerForm(ms.form);
        try {
            const datos: Record<string, unknown> = {
            cerda_id: Number(d.cerda_id),
            fecha: d.fecha,
            dosis: Number(d.dosis),
            notas: textoONull(d.notas),
            };
            if (!(ms.form.querySelector('[data-campo-resultado]') as HTMLElement).hidden) datos.resultado = d.resultado;
            await guardarFila('servicios', datos, d.id || null);
            ms.cerrar();
            aviso(d.id ? 'Servicio actualizado' : 'Servicio registrado');
            alGuardar();
        } catch (e) {
            avisoError(e);
        }
        });
    });

    // Parto
    const mp = mParto();
    const selCerda = mp.form.elements.namedItem('cerda_id') as HTMLSelectElement;
    selCerda.addEventListener('change', () => {
        cargarServiciosDeCerda(selCerda.value ? Number(selCerda.value) : null).catch(avisoError);
    });
    ['nacidos_totales', 'nacidos_muertos'].forEach((n) => (mp.form.elements.namedItem(n) as HTMLInputElement).addEventListener('input', actualizarVivos));
    mp.form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const btn = mp.form.querySelector<HTMLButtonElement>('[data-guardar]');
        conCarga(btn, async () => {
        const d = leerForm(mp.form);
        const tot = Number(d.nacidos_totales);
        const mu = Number(d.nacidos_muertos);
        if (mu > tot) {
            aviso('Los muertos no pueden superar a los nacidos totales.', 'error');
            return;
        }
        try {
            await guardarFila(
            'partos',
            {
                cerda_id: Number(d.cerda_id),
                servicio_id: numONull(d.servicio_id),
                fecha: d.fecha,
                nacidos_totales: tot,
                nacidos_muertos: mu,
                notas: textoONull(d.notas),
            },
            d.id || null
            );
            mp.cerrar();
            aviso(d.id ? 'Parto actualizado' : 'Parto registrado. Los lechones vivos ya figuran en el stock.');
            alGuardar();
        } catch (e) {
            avisoError(e);
        }
        });
    });

    // Destete
    const md = mDestete();
    ['fecha_destete', 'destetados'].forEach((n) => (md.form.elements.namedItem(n) as HTMLInputElement).addEventListener('input', actualizarDestete));
    md.form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        const btn = md.form.querySelector<HTMLButtonElement>('[data-guardar]');
        conCarga(btn, async () => {
        const d = leerForm(md.form);
        const { error } = await supabase.rpc('registrar_destete', {
            p_parto: Number(d.parto_id),
            p_fecha: d.fecha_destete,
            p_destetados: Number(d.destetados),
        });
        if (error) return avisoError(error);
        md.cerrar();
        aviso('Destete registrado');
        alGuardar();
        });
    });
    md.form.querySelector('[data-anular-destete]')!.addEventListener('click', async (ev) => {
        const d = leerForm(md.form);
        md.cerrar();
        const ok = await confirmar('Se eliminará el destete y las muertes en lactancia calculadas. ¿Continuar?', { titulo: 'Anular destete', boton: 'Anular' });
        if (!ok) return;
        conCarga(ev.target as HTMLButtonElement, async () => {
        const { error } = await supabase.rpc('registrar_destete', { p_parto: Number(d.parto_id), p_fecha: null, p_destetados: null });
        if (error) return avisoError(error);
        aviso('Destete anulado');
        alGuardar();
        });
    });
}