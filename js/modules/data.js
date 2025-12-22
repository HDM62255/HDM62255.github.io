import { MONTH_NAMES_SHORT, DEFAULT_CSV_NAME } from './config.js';
import { setLoader } from './utils.js';
import { runGlobalAnalysis } from './view-global.js';
import { populateUserSearch } from './view-user.js';

// Estado de los datos
export let appData = [];
export let latestDateInDB = new Date();

/**
 * Inicia la carga de datos (auto-carga o manual).
 */
export function initDataHandling() {
    tryAutoLoadCSV();
}

/**
 * Intenta cargar automáticamente el archivo CSV por defecto.
 */
function tryAutoLoadCSV() {
    const statusEl = document.getElementById('autoLoadStatus');
    statusEl.style.display = 'block';

    fetch(DEFAULT_CSV_NAME)
        .then(response => {
            if (!response.ok) throw new Error("Archivo no encontrado");
            return response.arrayBuffer();
        })
        .then(buffer => {
            const decoder = new TextDecoder('iso-8859-1');
            const csvText = decoder.decode(buffer);

            statusEl.innerHTML = '<span class="text-success fw-bold"><i class="bi bi-check-circle"></i> Auto-cargado</span>';
            setTimeout(() => statusEl.style.display = 'none', 3000);

            Papa.parse(csvText, {
                header: true, skipEmptyLines: true, delimiter: ";",
                complete: function (results) { processRawData(results.data); }
            });
        })
        .catch(err => {
            console.log("Autoload falló (Normal si no hay database.csv o por seguridad del navegador):", err);
            statusEl.innerHTML = '<span class="text-muted"><i class="bi bi-info-circle"></i> Usa carga manual</span>';
        });
}

/**
 * Procesa los datos crudos del CSV y actualiza el estado de la aplicación.
 * @param {Array} data - Datos crudos de PapaParse.
 */
function processRawData(data) {
    let maxTs = 0;
    appData = data.map(row => {
        const parseNum = (v) => {
            if (!v) return 0;
            if (typeof v === 'number') return v;
            return parseFloat(v.replace(/\./g, '').replace(',', '.'));
        };
        const dParts = row['Fecha'] ? row['Fecha'].split('/') : ['01', '01', '1970'];
        const jsDate = new Date(`${dParts[2]}-${dParts[1]}-${dParts[0]}`);
        if (jsDate.getTime() > maxTs) maxTs = jsDate.getTime();

        const oneJan = new Date(jsDate.getFullYear(), 0, 1);
        const numberOfDays = Math.floor((jsDate - oneJan) / (24 * 60 * 60 * 1000));
        const weekNum = Math.ceil((jsDate.getDay() + 1 + numberOfDays) / 7);

        const monthShort = MONTH_NAMES_SHORT[jsDate.getMonth()];
        const yearShort = jsDate.getFullYear().toString().slice(-2);
        const monthLabel = `${monthShort} ${yearShort}`;
        const monthSortId = jsDate.getFullYear() * 100 + jsDate.getMonth();

        // DEBUG: Mostrar Headers (Re-activado para diagnostico final)
        if (appData.length === 0) {
            const keys = Object.keys(row).join(" | ");
            const debugEl = document.getElementById('loader-subtext');
            if (debugEl) debugEl.innerText = "COLS: " + keys.substring(0, 50) + "...";
        }

        // Detección robusta de la columna PROD.OBJ (Incluso con punto final)
        const targetKey = Object.keys(row).find(k => {
            const cleanKey = k.trim().toUpperCase();
            return cleanKey === 'PROD.OBJ.' ||
                cleanKey === 'PROD. OBJ.' ||
                cleanKey === 'PROD.OBJ' ||
                cleanKey === 'OBJETIVO';
        });

        return {
            id: row['Usuario'], name: row['Nombre'],
            date: jsDate, ts: jsDate.getTime(), dateStr: row['Fecha'],
            year: jsDate.getFullYear(), month: jsDate.getMonth(),
            monthLabel: monthLabel, monthSortId: monthSortId,
            weekLabel: `Semana ${weekNum} - ${jsDate.getFullYear()}`,
            activity: (row['Actividad'] || "").toUpperCase().trim(),
            production: parseNum(row['Produccion']), productivity: parseNum(row['Productividad']),
            hours: parseNum(row['Tiempo_Final']), category: row['Categoria'],
            shift: row['Tipo_Turno'],       // Turno Real (Mañana, Tarde...)
            contractType: row['Turno'],     // Tipo Contrato (Empresa, ETT...)
            currentStatus: row['Estado actual'], // Estado del empleado
            targetObj: targetKey ? parseNum(row[targetKey]) : 0 // INGESTA: Objetivo detectado
        };
    }).filter(d => d.activity && d.id);

    latestDateInDB = new Date(maxTs);

    // Disparar actualizaciones de UI
    // Esto crea un acoplamiento circular si importamos view-global aquí.
    // Para simplificar manteniendo la estructura original, llamaremos a una función de "init" o trigger.
    // Usaremos las funciones importadas para notificar a las vistas.

    // Importamos dinámicamente o usamos callbacks si queremos desacoplar, 
    // pero por simplicidad y el tamaño del proyecto, importaciones directas están bien.
    if (typeof runGlobalAnalysis === 'function') runGlobalAnalysis();
    if (typeof populateUserSearch === 'function') populateUserSearch();

    // Actualizar filtros globales (esto estaba en populateFilters en el original)
    // Lo moveremos a view-global.js y lo llamaremos desde runGlobalAnalysis o aquí.
    // De momento runGlobalAnalysis llamará a populateFilters si es necesario o viceversa.
    // Para mantener el flujo original: processRawData -> populateFilters -> populateUserSearch -> runGlobalAnalysis

    // Vamos a disparar un evento custom para desacoplar si fuera necesario, 
    // pero aquí llamaremos a una función exportada de view-global para inicializar filtros.
    // Ver initGlobalFilters en view-global.js

    // NOTA: Para resolver dependencias circulares limpiamente, deberíamos tener un 'controller' o 'app.js' que coordine,
    // pero aquí data.js actúa como el conductor de datos.
    // Asumiremos que app.js inyecta dependencias o usamos eventos.
    // O mejor: simplemente exportamos los datos y las vistas se suscriben? No, JS vainilla simple.
    // Haremos que data.js dispare un Evento del DOM 'DataLoaded'

    document.dispatchEvent(new CustomEvent('DataLoaded'));
}
