// Estado reproductivo de una cerda a partir de la vista v_cerdas
import { ESTADOS_CERDA } from './etiquetas';

export interface EstadoRepro {
    clave: 'baja' | 'servida' | 'lactando' | 'vacia';
    texto: string;
    clase: string;
}

export function estadoReproductivo(c: {
    estado: string;
    ultimo_resultado: string | null;
    partos: number;
    ultimo_parto_destetado: boolean | null;
}): EstadoRepro {
    if (c.estado !== 'activa') {
        const e = ESTADOS_CERDA[c.estado] ?? { texto: c.estado, clase: '' };
        return { clave: 'baja', texto: e.texto, clase: e.clase };
    }
    if (c.ultimo_resultado === 'pendiente') return { clave: 'servida', texto: 'Servida · a confirmar', clase: 'badge-alerta' };
    if (c.ultimo_resultado === 'prenada') return { clave: 'servida', texto: 'Preñada', clase: 'badge-info' };
    if (c.partos > 0 && c.ultimo_parto_destetado === false) return { clave: 'lactando', texto: 'En lactancia', clase: 'badge-marca' };
    return { clave: 'vacia', texto: 'Vacía', clase: '' };
}