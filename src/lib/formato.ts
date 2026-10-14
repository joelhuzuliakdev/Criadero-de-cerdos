// Formatos de números, dinero y fechas (Argentina)

const ZONA = 'America/Argentina/Buenos_Aires';

const fmtPesos0 = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0, minimumFractionDigits: 0 });
const fmtPesos2 = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2, minimumFractionDigits: 2 });
const fmtNum = (dec: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: dec, minimumFractionDigits: 0 });

const n = (v: unknown): number => {
    const x = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(x) ? x : 0;
};

/** $ 1.234.567 (sin decimales) */
export const pesos = (v: unknown) => fmtPesos0.format(Math.round(n(v)));
/** $ 1.234,56 (con decimales, para precios) */
export const precio = (v: unknown) => fmtPesos2.format(n(v));
/** 1.234,5 */
export const numero = (v: unknown, dec = 2) => fmtNum(dec).format(n(v));
/** 1.234,5 kg */
export const kg = (v: unknown, dec = 2) => `${numero(v, dec)} kg`;
/** 12,5 % */
export const porcentaje = (v: unknown, dec = 1) => `${numero(v, dec)} %`;

/** Fecha de hoy en Argentina, formato AAAA-MM-DD */
export function hoyISO(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** Mes actual en Argentina, formato AAAA-MM */
export const mesActual = () => hoyISO().slice(0, 7);
export const anioActual = () => Number(hoyISO().slice(0, 4));

/** AAAA-MM-DD → DD/MM/AAAA */
export function fecha(iso: string | null | undefined): string {
    if (!iso) return '—';
    const [a, m, d] = iso.slice(0, 10).split('-');
    return `${d}/${m}/${a}`;
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** AAAA-MM o AAAA-MM-DD → "Octubre 2026" */
export function nombreMes(iso: string): string {
    const [a, m] = iso.split('-');
    return `${MESES[Number(m) - 1]} ${a}`;
}
export const nombreMesSolo = (m: number) => MESES[m - 1];

/** Suma días a una fecha ISO */
export function sumarDias(iso: string, dias: number): string {
    const [a, m, d] = iso.split('-').map(Number);
    const f = new Date(Date.UTC(a, m - 1, d + dias));
    return f.toISOString().slice(0, 10);
}

/** Días entre dos fechas ISO (b - a) */
export function diasEntre(a: string, b: string): number {
    const [a1, m1, d1] = a.split('-').map(Number);
    const [a2, m2, d2] = b.split('-').map(Number);
    return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
}

/** Primer y último día de un mes AAAA-MM */
export function rangoMes(mes: string): { desde: string; hasta: string } {
    const [a, m] = mes.split('-').map(Number);
    const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
    return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, '0')}` };
}

/** Mes anterior a AAAA-MM */
export function mesAnterior(mes: string): string {
    const [a, m] = mes.split('-').map(Number);
    return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}

/** Escapa texto para insertarlo en HTML de forma segura */
export function esc(v: unknown): string {
    return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Redondeo a 2 decimales seguro */
export const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

/** Variación porcentual entre dos valores (null si no se puede calcular) */
export function variacion(actual: number, anterior: number): number | null {
    if (!anterior) return null;
  return ((actual - anterior) / Math.abs(anterior)) * 100;
}