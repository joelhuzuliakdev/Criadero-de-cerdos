// Gráfico de barras agrupadas en SVG (liviano, sin librerías)
import { esc } from './formato';

export interface Serie {
    nombre: string;
    color: string;
    valores: number[];
}

interface Opciones {
    categorias: string[];
    series: Serie[];
    formato: (v: number) => string;
    formatoEje?: (v: number) => string;
    alto?: number;
}

function pasoRedondo(v: number): number {
    if (v <= 0) return 1;
    const exp = Math.pow(10, Math.floor(Math.log10(v)));
    const f = v / exp;
    const paso = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return paso * exp;
}

export function pesosCortos(v: number): string {
    const a = Math.abs(v);
    if (a >= 1e9) return `$${(v / 1e9).toLocaleString('es-AR', { maximumFractionDigits: 1 })} mil M`;
    if (a >= 1e6) return `$${(v / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`;
    if (a >= 1e3) return `$${(v / 1e3).toLocaleString('es-AR', { maximumFractionDigits: 0 })} k`;
    return `$${Math.round(v)}`;
}

export function graficoBarras(cont: HTMLElement, op: Opciones) {
    const dibujar = () => {
        const ancho = Math.max(cont.clientWidth, 280);
        const alto = op.alto ?? 240;
        const m = { arriba: 10, der: 14, abajo: 24, izq: 58 };
        const pw = ancho - m.izq - m.der;
        const ph = alto - m.arriba - m.abajo;
        const n = op.categorias.length;
        const maxDato = Math.max(0, ...op.series.flatMap((s) => s.valores));
        const paso = pasoRedondo(maxDato / 4);
        const lineas = Math.max(1, Math.ceil((maxDato * 1.02) / paso));
        const max = paso * lineas;
        const y = (v: number) => m.arriba + ph - (Math.max(v, 0) / max) * ph;
        const grupo = pw / n;
        const ns = op.series.length;
        const anchoBarra = Math.max(3, Math.min(16, (grupo * 0.72 - (ns - 1) * 2) / ns));
        const anchoGrupo = ns * anchoBarra + (ns - 1) * 2;
        const fmtEje = op.formatoEje ?? op.formato;

        let svg = `<svg width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Gráfico de barras" style="display:block;overflow:visible">`;
        for (let i = 0; i <= lineas; i++) {
        const v = paso * i;
        const yy = Math.round(y(v)) + 0.5;
        svg += `<line x1="${m.izq}" x2="${ancho - m.der}" y1="${yy}" y2="${yy}" stroke="${i === 0 ? '#c9c8c2' : '#ecebe7'}" />`;
        svg += `<text x="${m.izq - 8}" y="${yy + 4}" text-anchor="end" font-size="11" fill="#8a8981">${esc(fmtEje(v))}</text>`;
        }
        const mostrarCada = grupo < 26 ? 2 : 1;
        op.categorias.forEach((cat, i) => {
        const x0 = m.izq + grupo * i + (grupo - anchoGrupo) / 2;
        op.series.forEach((s, j) => {
            const v = s.valores[i] ?? 0;
            if (v <= 0) return;
            const x = x0 + j * (anchoBarra + 2);
            const yTop = y(v);
            const h = m.arriba + ph - yTop;
            const r = Math.min(4, anchoBarra / 2, h);
            svg += `<path d="M${x},${m.arriba + ph} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + anchoBarra - r} Q${x + anchoBarra},${yTop} ${x + anchoBarra},${yTop + r} V${m.arriba + ph} Z" fill="${s.color}" />`;
        });
        if (i % mostrarCada === 0) {
            svg += `<text x="${m.izq + grupo * i + grupo / 2}" y="${alto - 6}" text-anchor="middle" font-size="11" fill="#8a8981">${esc(cat)}</text>`;
        }
        svg += `<rect x="${m.izq + grupo * i}" y="${m.arriba}" width="${grupo}" height="${ph}" fill="transparent" data-i="${i}" />`;
        });
        svg += '</svg>';

        const leyenda = `<div class="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-texto-2">${op.series
        .map((s) => `<span class="inline-flex items-center gap-1.5"><span style="width:10px;height:10px;border-radius:3px;background:${s.color}"></span>${esc(s.nombre)}</span>`)
        .join('')}</div>`;

        cont.style.minWidth = '0';
        cont.style.overflow = 'hidden';
        cont.innerHTML = `${leyenda}<div class="relative" data-area>${svg}<div data-tip hidden class="pointer-events-none absolute z-10 min-w-36 rounded-lg border border-borde bg-superficie px-3 py-2 text-xs shadow-lg"></div></div>`;

        const area = cont.querySelector('[data-area]') as HTMLElement;
        const tip = cont.querySelector('[data-tip]') as HTMLElement;
        const resaltar = cont.querySelector('svg')!;
        let marca: SVGRectElement | null = null;

        const mostrar = (i: number, cx: number) => {
        tip.innerHTML =
            `<p class="mb-1 font-semibold">${esc(op.categorias[i])}</p>` +
            op.series
            .map(
                (s) =>
                `<p class="flex items-center justify-between gap-4"><span class="inline-flex items-center gap-1.5 text-texto-2"><span style="width:8px;height:8px;border-radius:2px;background:${s.color}"></span>${esc(s.nombre)}</span><span class="num font-medium">${esc(op.formato(s.valores[i] ?? 0))}</span></p>`
            )
            .join('');
        tip.hidden = false;
        const w = tip.offsetWidth;
        let left = cx + 12;
        if (left + w > area.clientWidth) left = cx - w - 12;
        tip.style.left = `${Math.max(0, left)}px`;
        tip.style.top = `${m.arriba}px`;
        if (!marca) {
            marca = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            marca.setAttribute('fill', 'rgba(0,0,0,0.04)');
            marca.setAttribute('pointer-events', 'none');
            resaltar.insertBefore(marca, resaltar.firstChild);
        }
        marca.setAttribute('x', String(m.izq + grupo * i));
        marca.setAttribute('y', String(m.arriba));
        marca.setAttribute('width', String(grupo));
        marca.setAttribute('height', String(ph));
        };
        const ocultar = () => {
        tip.hidden = true;
        marca?.remove();
        marca = null;
        };

        area.addEventListener('pointermove', (ev) => {
        const t = (ev.target as Element).closest('rect[data-i]');
        if (!t) return ocultar();
        const box = area.getBoundingClientRect();
        mostrar(Number(t.getAttribute('data-i')), ev.clientX - box.left);
        });
        area.addEventListener('pointerleave', ocultar);
    };

    cont.style.minWidth = '0';
    cont.style.overflow = 'hidden';
    dibujar();
    let ultimoAncho = cont.clientWidth;
    const ro = new ResizeObserver(() => {
        if (Math.abs(cont.clientWidth - ultimoAncho) > 4) {
        ultimoAncho = cont.clientWidth;
        dibujar();
        }
    });
    ro.observe(cont);
    return () => ro.disconnect();
}