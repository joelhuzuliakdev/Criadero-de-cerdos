// Nombres visibles de los valores guardados en la base de datos

export const PREPARACIONES: Record<string, string> = {
    fase_1: 'Fase 1',
    fase_2: 'Fase 2',
    fase_3: 'Fase 3',
    fase_4: 'Fase 4',
    desarrollo: 'Desarrollo',
    terminacion: 'Terminación',
    gestacion: 'Gestación',
    lactancia: 'Lactancia',
};

export const CATEGORIAS: Record<string, string> = {
    lechon: 'Lechón',
    cachorro: 'Cachorro',
    capon: 'Capón',
    descarte: 'Cerda de descarte',
};

export const CATEGORIAS_PLURAL: Record<string, string> = {
    lechon: 'Lechones',
    cachorro: 'Cachorros',
    capon: 'Capones',
};

export const RANGOS_CATEGORIA: Record<string, string> = {
    lechon: '0 a 69 días',
    cachorro: '70 a 119 días',
    capon: '120 días o más',
};

export const TIPOS_INSUMO: Record<string, string> = {
    nucleo: 'Núcleo',
    cereal: 'Cereal',
    medicamento: 'Remedio / aditivo',
    otro: 'Otro',
};

export const UNIDADES: Record<string, string> = {
    kg: 'kg',
    l: 'litros',
    unidad: 'unidades',
    dosis: 'dosis',
};

export const CATEGORIAS_GASTO: Record<string, string> = {
    mano_obra: 'Mano de obra',
    combustible: 'Combustible',
    veterinaria: 'Veterinaria / medicamentos',
    semen: 'Dosis de semen',
    extras: 'Extras (secuestrantes, leche materna, etc.)',
    otros: 'Otros',
};

export const CATEGORIAS_GASTO_CORTO: Record<string, string> = {
    mano_obra: 'Mano de obra',
    combustible: 'Combustible',
    veterinaria: 'Veterinaria',
    semen: 'Semen',
    extras: 'Extras',
    otros: 'Otros',
};

export const MOTIVOS_BAJA: Record<string, string> = {
    muerte: 'Muerte',
    venta: 'Venta',
    consumo: 'Consumo propio',
    otro: 'Otro',
};

export const RESULTADOS_SERVICIO: Record<string, { texto: string; clase: string }> = {
    pendiente: { texto: 'A confirmar', clase: 'badge-alerta' },
    prenada: { texto: 'Preñada', clase: 'badge-info' },
    vacia: { texto: 'Vacía (repite)', clase: 'badge-error' },
    parida: { texto: 'Parida', clase: 'badge-ok' },
};

export const ESTADOS_CERDA: Record<string, { texto: string; clase: string }> = {
    activa: { texto: 'Activa', clase: 'badge-ok' },
    descartada: { texto: 'Descartada', clase: '' },
    muerta: { texto: 'Muerta', clase: 'badge-error' },
};

export const ROLES: Record<string, string> = {
    dueno: 'Dueño',
    empleado: 'Empleado',
    pendiente: 'Sin acceso',
};

/** Días de gestación usados para la fecha probable de parto */
export const DIAS_GESTACION = 114;
/** Días de lactancia a partir de los cuales se avisa que falta el destete */
export const DIAS_AVISO_DESTETE = 21;
/** Días desde el servicio a partir de los cuales se pide confirmar preñez */
export const DIAS_CONFIRMAR_PRENEZ = 21;

/** Arma las opciones <option> de un diccionario */
export function opciones(dic: Record<string, string>, seleccionado = ''): string {
    return Object.entries(dic)
    .map(([v, t]) => `<option value="${v}"${v === seleccionado ? ' selected' : ''}>${t}</option>`)
    .join('');
}