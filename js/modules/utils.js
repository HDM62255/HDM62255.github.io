// MÓDULO DE UTILIDADES

// Importar referencia global a estado (si fuera necesario, pero intentaremos mantenerlo puro)

/**
 * Determina el estado de color y etiquetas basado en la eficiencia o categoría del CSV.
 * @param {number} efficiency - Valor de eficiencia (porcentaje).
 * @param {string} csvCategory - Categoría opcional leída directamente del CSV.
 * @returns {object} Objeto con clases CSS y etiqueta de estado.
 */
export function getColorStatus(efficiency, csvCategory) {
    let label = "NORMAL";
    if (csvCategory && csvCategory.trim() !== "") {
        const catUpper = csvCategory.toUpperCase().trim();
        if (catUpper.includes("TOP")) label = "TOP";
        else if (catUpper.includes("BOTTOM")) label = "BOTTOM";
        else label = "NORMAL";
    } else {
        if (efficiency > 115) label = "TOP";
        else if (efficiency < 85) label = "BOTTOM";
        else label = "NORMAL";
    }
    let style = { badgeClass: '', textClass: '', label: label };
    if (label === "TOP") { style.badgeClass = "bg-top"; style.textClass = "text-top"; }
    else if (label === "BOTTOM") { style.badgeClass = "bg-bottom"; style.textClass = "text-bottom"; }
    else { style.badgeClass = "bg-normal"; style.textClass = "text-normal"; }
    return style;
}

/**
 * Muestra u oculta el spinner de carga.
 * @param {boolean} show - true para mostrar, false para ocultar.
 * @param {string} msg - Texto opcional a mostrar debajo del spinner.
 */
export function setLoader(show, msg = "Procesando...") {
    const loader = document.getElementById('loader');
    const subtext = document.getElementById('loader-subtext');
    if (show) {
        loader.style.display = 'flex';
        if (subtext) subtext.innerText = msg;
    } else {
        loader.style.display = 'none';
    }
}

/**
 * Formatea un número KPI con sufijos K (miles) o M (millones).
 * - < 100k: Sin cambios (locale string)
 * - 100k - 999.999: K
 * - >= 1M: M con 1 decimal
 * @param {number} num - Número a formatear.
 * @returns {string} Texto formateado.
 */
export function formatKPIValue(num) {
    if (!num) return "0";
    if (num < 100000) return num.toLocaleString('es-ES', { maximumFractionDigits: 1 });
    if (num < 1000000) return (num / 1000).toFixed(0) + "K";
    return (num / 1000000).toFixed(1) + "M";
}

/**
 * Calcula el valor más repetido (moda) de un array.
 * @param {Array} array - Array de valores.
 * @returns {any} El valor más frecuente.
 */
export function getMode(array) {
    if (!array || array.length === 0) return "-";
    const counts = {};
    let maxEl = array[0], maxCount = 1;
    for (let i = 0; i < array.length; i++) {
        let el = array[i];
        if (el == null || el === "") continue;
        if (counts[el] == null) counts[el] = 1; else counts[el]++;
        if (counts[el] > maxCount) { maxEl = el; maxCount = counts[el]; }
    }
    return maxEl;
}
