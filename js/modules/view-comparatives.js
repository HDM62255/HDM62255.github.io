/**
 * Comparativas - JavaScript para graficos de comparativas (Migrado a Modulo)
 */

import { initDataHandling } from './data.js';

import { CalendarWidget } from './calendar.js';

// Zonas SUELO
const ZONAS_SUELO = ['0', '1', '2', '3'];

// Colores
const COLORS = {
    suelo: { solid: '#10b981', transparent: 'rgba(16, 185, 129, 0.4)' },
    agv: { solid: '#6366f1', transparent: 'rgba(99, 102, 241, 0.4)' },
    picking: { solid: '#f59e0b', transparent: 'rgba(245, 158, 11, 0.4)' },
    rbsPicking: { solid: '#ef4444', transparent: 'rgba(239, 68, 68, 0.4)' },
    pickingAuto: { solid: '#8b5cf6', transparent: 'rgba(139, 92, 246, 0.4)' },
    pickingTransfer: { solid: '#06b6d4', transparent: 'rgba(6, 182, 212, 0.4)' },
    manana: { solid: '#f59e0b', transparent: 'rgba(245, 158, 11, 0.4)' },
    tarde: { solid: '#6366f1', transparent: 'rgba(99, 102, 241, 0.4)' },
    noche: { solid: '#8b5cf6', transparent: 'rgba(139, 92, 246, 0.4)' }
};

const OPERATIVA_COLORS = {
    'PICKING': { solid: '#10b981', transparent: 'rgba(16, 185, 129, 0.4)' },
    'RBS PICKING': { solid: '#10b981', transparent: 'rgba(16, 185, 129, 0.4)' },
    'PICKING AUTOMATIZADO': { solid: '#6366f1', transparent: 'rgba(99, 102, 241, 0.4)' },
    'PICKING TRANSFER': { solid: '#06b6d4', transparent: 'rgba(6, 182, 212, 0.4)' }
};

// Abreviaciones para labels responsive en eje X
const LABEL_ABBREV = {
    'PICKING AUTOMATIZADO': 'PICK. AUTO',
    'PICKING': 'PICKING',
    'RBS PICKING': 'RBS PICK.'
};

// Estado Local
let rawData = [];
let data = [];
let charts = {};
let comparativeCalendar = null;

// Constantes de Reglas de Negocio
const ZONAS_VALIDAS_PICKING = ['0', '1', '2', '3'];
const OPERATIVAS_PERMITIDAS = ['PICKING', 'RBS PICKING', 'PICKING AUTOMATIZADO'];

/**
 * Inicializa la vista de Comparativas
 */
export function initComparativesView() {
    console.log("Inicializando Vista Comparativas...");
    loadData();
}

/**
 * Actualiza los graficos cuando cambia el tema (llamado desde app.js)
 */
export function updateComparativesCharts() {
    if (data.length > 0) {
        renderAllCharts();
    }
}

// Funcion para obtener label corto
function getShortLabel(label) {
    return LABEL_ABBREV[label] || label;
}

// Cargar datos
async function loadData() {
    try {
        // Cargar datos diarios desde la carpeta data del proyecto WEB
        const response = await fetch('data/aggregated_day.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        rawData = await response.json();

        console.log('Datos Comparativas cargados:', rawData.length);

        // Establecer fechas por defecto
        setDefaultDates();

        // Aplicar filtros iniciales
        applyFilters();

        // Inicializar listeners de fecha
        initDateListeners();

        // Hide loading, show content
        const loadingMsg = document.getElementById('loadingMessage');
        const content = document.getElementById('comparativasContent');
        if (loadingMsg) loadingMsg.classList.add('d-none');
        if (content) content.classList.remove('d-none');

    } catch (error) {
        console.error('Error cargando datos comparativas:', error);
        const loadingMsg = document.getElementById('loadingMessage');
        if (loadingMsg) {
            loadingMsg.innerHTML = `<div class="alert alert-danger">Error cargando datos: ${error.message}</div>`;
        }
    }
}

function setDefaultDates() {
    if (rawData.length === 0) return;

    // Obtener todas las fechas y ordenarlas
    const fechas = [...new Set(rawData.map(d => d.Fecha))].sort();

    if (fechas.length > 0) {
        const lastDate = fechas[fechas.length - 1];

        // Intentar establecer el ultimo mes completo o ultimos 30 dias
        const end = new Date(lastDate);
        const start = new Date(lastDate);
        start.setDate(1); // Inicio del mes actual de los datos

        const startInput = document.getElementById('dateStart');
        const endInput = document.getElementById('dateEnd');

        const formatDateEU = (date) => {
            const d = String(date.getDate()).padStart(2, '0');
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const y = date.getFullYear();
            return `${d}/${m}/${y}`;
        };

        const formatDateISO = (date) => {
            return date.toISOString().split('T')[0];
        };

        if (startInput) {
            startInput.value = formatDateEU(start);
            startInput.dataset.date = formatDateISO(start);
        }
        if (endInput) {
            endInput.value = formatDateEU(end);
            endInput.dataset.date = lastDate; // Assuming lastDate is already YYYY-MM-DD from JSON
        }
    }
}

function initDateListeners() {
    const btnApply = document.getElementById('applyDates');
    if (btnApply) {
        btnApply.addEventListener('click', () => {
            applyFilters();
        });
    }

    // Calendar Widget Listeners
    const startInput = document.getElementById('dateStart');
    const endInput = document.getElementById('dateEnd');

    if (startInput) {
        startInput.addEventListener('click', () => openCalendar(startInput));
    }
    if (endInput) {
        endInput.addEventListener('click', () => openCalendar(endInput));
    }

    // Listener PDF
    const btnPdf = document.getElementById('exportPdf');
    if (btnPdf) {
        // Remove existing listeners to avoid duplicates if init is called multiple times
        const newBtn = btnPdf.cloneNode(true);
        btnPdf.parentNode.replaceChild(newBtn, btnPdf);
        newBtn.addEventListener('click', handleExportPdf);
    }
}

function openCalendar(targetInput) {
    // Close existing if any
    if (comparativeCalendar) {
        comparativeCalendar.destroy();
        comparativeCalendar = null;
    }

    // Get initial date from dataset
    const initialDateISO = targetInput.dataset.date; // YYYY-MM-DD
    let initialDates = [];
    if (initialDateISO) {
        const [y, m, d] = initialDateISO.split('-');
        initialDates.push(`${d}/${m}/${y}`);
    }

    comparativeCalendar = new CalendarWidget({
        isStatic: false,
        overlayTarget: targetInput,
        initialDates: initialDates,
        singleMode: true, // Enforce single selection
        onSelect: (dates) => {
            // Expecting 'DD/MM/YYYY'
            if (dates.length > 0) {
                const dateStr = dates[0];
                const [d, m, y] = dateStr.split('/');
                targetInput.value = dateStr;
                targetInput.dataset.date = `${y}-${m}-${d}`;
            }
            // Auto-close? The widget might not auto close on single select depending on implementation.
            // Looking at calendar.js, it has an "Aplicar" button which calls onSelect and destroy.
            // So we just handle the update here.
        }
    });

    // Mount to a suitable parent, e.g., the input group's parent or body? 
    // Overlay usually mounts to body or closest relative parent. 
    // CalendarWidget mounts to passed element.
    // Let's mount to the input-group parent to ensure relative positioning works if CSS relies on it,
    // OR just mount to document.body if it uses absolute positioning calculated from target.
    // Reading calendar.js: it just appends to parentElement. Class is 'calendar-overlay'.
    // It does NOT calculate position automatically in JS (it seems). 
    // AND it has a click outside listener.
    // Let's mount it to the input's parent wrapper (div.input-group).
    comparativeCalendar.mount(targetInput.parentNode);
}

function applyFilters() {
    const startInput = document.getElementById('dateStart');
    const endInput = document.getElementById('dateEnd');

    if (!startInput || !endInput) return;

    // Use dataset.date (ISO) if available, otherwise fallback (e.g. if user managed to type? restricted by readonly though)
    const startStr = startInput.dataset.date;
    const endStr = endInput.dataset.date;

    if (!startStr || !endStr) {
        data = [];
        renderAllCharts();
        return;
    }

    // Filtros de Reglas de Negocio Estrictas + Fecha
    data = rawData.filter(d => {
        // 1. Filtro de Fecha
        if (d.Fecha < startStr || d.Fecha > endStr) return false;

        // 2. Filtro de Operativa Permitida
        if (!OPERATIVAS_PERMITIDAS.includes(d.Operativa)) return false;

        // 3. Reglas de Zona por Operativa
        const zona = String(d.Zona);

        if (d.Operativa === 'PICKING' || d.Operativa === 'RBS PICKING') {
            // Solo zonas suelo
            return ZONAS_VALIDAS_PICKING.includes(zona);
        }

        if (d.Operativa === 'PICKING AUTOMATIZADO') {
            // Resto de zonas, EXCLUYENDO suelo Y excluyendo zona 200 (Error)
            return !ZONAS_VALIDAS_PICKING.includes(zona) && zona !== '200';
        }

        return false;
    });

    console.log(`Datos filtrados (${startStr} al ${endStr}):`, data.length);
    renderAllCharts();
}

// Calcular productividad
function calcProductivity(records) {
    const totals = records.reduce((acc, r) => {
        acc.unidades += r.Unidades || 0;
        acc.horas += r.Horas_Prorrateadas || 0;
        return acc;
    }, { unidades: 0, horas: 0 });

    return totals.horas > 0 ? totals.unidades / totals.horas : 0;
}

// Formatear numero
function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toFixed(1);
}

// Renderizar todos los graficos
function renderAllCharts() {
    renderSueloVsAgv();
    renderZonas();
    renderPrendas();
    renderTurnos();
}

function renderSueloVsAgv() {
    // Separar datos
    const dataSuelo = data.filter(d => ZONAS_SUELO.includes(String(d.Zona)));
    const dataAgv = data.filter(d => !ZONAS_SUELO.includes(String(d.Zona)));

    // Calcular totales
    const sueloTotals = dataSuelo.reduce((acc, d) => {
        acc.unidades += d.Unidades || 0;
        acc.horas += d.Horas_Prorrateadas || 0;
        return acc;
    }, { unidades: 0, horas: 0 });

    const agvTotals = dataAgv.reduce((acc, d) => {
        acc.unidades += d.Unidades || 0;
        acc.horas += d.Horas_Prorrateadas || 0;
        return acc;
    }, { unidades: 0, horas: 0 });

    const sueloProd = sueloTotals.horas > 0 ? sueloTotals.unidades / sueloTotals.horas : 0;
    const agvProd = agvTotals.horas > 0 ? agvTotals.unidades / agvTotals.horas : 0;

    // Resumen cards (Bootstrap Columns)
    const summaryContainer = document.getElementById('summaryCards');
    if (summaryContainer) {
        summaryContainer.innerHTML = `
            <div class="col-12 col-md-6 col-xl-3">
                <div class="card p-3 h-100 shadow-sm border-start border-4 border-success text-adaptive-title">
                    <div class="h2 fw-bold mb-1">${formatNumber(sueloTotals.unidades)}</div>
                    <div class="text-xs text-adaptive-subtitle fw-bold text-uppercase">Volumen SUELO</div>
                    <div class="small text-adaptive-subtitle mt-1">${formatNumber(sueloTotals.horas)} horas</div>
                </div>
            </div>
            <div class="col-12 col-md-6 col-xl-3">
                <div class="card p-3 h-100 shadow-sm border-start border-4 border-success text-adaptive-title">
                    <div class="h2 fw-bold mb-1">${sueloProd.toFixed(1)}</div>
                    <div class="text-xs text-adaptive-subtitle fw-bold text-uppercase">Productividad SUELO</div>
                    <div class="small text-adaptive-subtitle mt-1">uds/hora</div>
                </div>
            </div>
            <div class="col-12 col-md-6 col-xl-3">
                <div class="card p-3 h-100 shadow-sm border-start border-4 border-primary text-adaptive-title">
                    <div class="h2 fw-bold mb-1">${formatNumber(agvTotals.unidades)}</div>
                    <div class="text-xs text-adaptive-subtitle fw-bold text-uppercase">Volumen AGV</div>
                    <div class="small text-adaptive-subtitle mt-1">${formatNumber(agvTotals.horas)} horas</div>
                </div>
            </div>
            <div class="col-12 col-md-6 col-xl-3">
                <div class="card p-3 h-100 shadow-sm border-start border-4 border-primary text-adaptive-title">
                    <div class="h2 fw-bold mb-1">${agvProd.toFixed(1)}</div>
                    <div class="text-xs text-adaptive-subtitle fw-bold text-uppercase">Productividad AGV</div>
                    <div class="small text-adaptive-subtitle mt-1">uds/hora</div>
                </div>
            </div>
        `;
    }

    const operativasOrdenadas = ['PICKING AUTOMATIZADO', 'PICKING', 'RBS PICKING'];
    const volumenData = [];
    const prodData = [];
    const barColors = [];
    const barBorderColors = [];

    operativasOrdenadas.forEach(op => {
        let opData;
        let color;

        if (op === 'PICKING AUTOMATIZADO') {
            opData = dataAgv.filter(d => d.Operativa === op);
            color = COLORS.agv;
        } else {
            opData = dataSuelo.filter(d => d.Operativa === op);
            color = COLORS.suelo;
        }

        const vol = opData.reduce((acc, d) => acc + (d.Unidades || 0), 0);
        volumenData.push(vol);
        prodData.push(calcProductivity(opData));
        barColors.push(color.transparent);
        barBorderColors.push(color.solid);
    });

    if (charts.volumenTipo) charts.volumenTipo.destroy();
    const ctxVol = document.getElementById('chartVolumenTipo');
    if (ctxVol) {
        charts.volumenTipo = new Chart(ctxVol, {
            type: 'bar',
            data: {
                labels: operativasOrdenadas.map(getShortLabel),
                datasets: [{
                    label: 'Volumen',
                    data: volumenData,
                    backgroundColor: barColors,
                    borderColor: barBorderColors,
                    borderWidth: 2,
                    borderRadius: 6
                }]
            },
            options: getChartOptions('Volumen por Operativa', true, false),
            plugins: [ChartDataLabels]
        });
    }

    if (charts.prodTipo) charts.prodTipo.destroy();
    const ctxProd = document.getElementById('chartProdTipo');
    if (ctxProd) {
        charts.prodTipo = new Chart(ctxProd, {
            type: 'bar',
            data: {
                labels: operativasOrdenadas.map(getShortLabel),
                datasets: [{
                    label: 'Productividad',
                    data: prodData,
                    backgroundColor: barColors,
                    borderColor: barBorderColors,
                    borderWidth: 2,
                    borderRadius: 6
                }]
            },
            options: getChartOptions('Productividad (uds/hora)', true, false),
            plugins: [ChartDataLabels]
        });
    }
}

function renderZonas() {
    const dataSueloOps = data.filter(d =>
        ['PICKING', 'RBS PICKING'].includes(d.Operativa) &&
        ZONAS_SUELO.includes(String(d.Zona))
    );

    const zonasSuelo = [...new Set(dataSueloOps.map(d => d.Zona))].sort();
    const pickingData = [];
    const rbsData = [];

    zonasSuelo.forEach(zona => {
        const picking = dataSueloOps.filter(d => d.Zona === zona && d.Operativa === 'PICKING');
        const rbs = dataSueloOps.filter(d => d.Zona === zona && d.Operativa === 'RBS PICKING');

        pickingData.push(calcProductivity(picking));
        rbsData.push(calcProductivity(rbs));
    });

    if (charts.zonaSuelo) charts.zonaSuelo.destroy();
    const ctxZonaSuelo = document.getElementById('chartZonaSuelo');
    if (ctxZonaSuelo) {
        charts.zonaSuelo = new Chart(ctxZonaSuelo, {
            type: 'bar',
            data: {
                labels: zonasSuelo.map(z => `Planta ${z}`),
                datasets: [
                    {
                        label: getShortLabel('PICKING'),
                        data: pickingData,
                        backgroundColor: COLORS.picking.transparent,
                        borderColor: COLORS.picking.solid,
                        borderWidth: 2,
                        borderRadius: 6
                    },
                    {
                        label: getShortLabel('RBS PICKING'),
                        data: rbsData,
                        backgroundColor: COLORS.rbsPicking.transparent,
                        borderColor: COLORS.rbsPicking.solid,
                        borderWidth: 2,
                        borderRadius: 6
                    }
                ]
            },
            options: getChartOptions('Productividad (uds/hora)'),
            plugins: [ChartDataLabels]
        });
    }

    const dataAgvOps = data.filter(d =>
        d.Operativa === 'PICKING AUTOMATIZADO' &&
        !ZONAS_SUELO.includes(String(d.Zona))
    );

    const zonasAgv = [...new Set(dataAgvOps.map(d => d.Zona))].sort((a, b) => parseInt(a) - parseInt(b));
    const agvProdData = zonasAgv.map(zona => {
        const records = dataAgvOps.filter(d => d.Zona === zona);
        return calcProductivity(records);
    });

    if (charts.zonaAgv) charts.zonaAgv.destroy();
    const ctxZonaAgv = document.getElementById('chartZonaAgv');
    if (ctxZonaAgv) {
        charts.zonaAgv = new Chart(ctxZonaAgv, {
            type: 'bar',
            data: {
                labels: zonasAgv.map(z => `Zona ${z}`),
                datasets: [{
                    label: getShortLabel('PICKING AUTOMATIZADO'),
                    data: agvProdData,
                    backgroundColor: COLORS.pickingAuto.transparent,
                    borderColor: COLORS.pickingAuto.solid,
                    borderWidth: 2,
                    borderRadius: 6
                }]
            },
            options: getChartOptions('Productividad (uds/hora)'),
            plugins: [ChartDataLabels]
        });
    }
}

function renderPrendas() {
    const prendas = [...new Set(data.map(d => d.Prenda))].filter(p => p.toUpperCase() !== 'COLECCION ESPECIAL').sort();
    const operativas = ['PICKING', 'RBS PICKING', 'PICKING AUTOMATIZADO'];

    const datasets = operativas.map(op => {
        const prodData = prendas.map(prenda => {
            const records = data.filter(d => d.Operativa === op && d.Prenda === prenda);
            return calcProductivity(records);
        });

        const color = OPERATIVA_COLORS[op];
        return {
            label: getShortLabel(op),
            data: prodData,
            backgroundColor: color.transparent,
            borderColor: color.solid,
            borderWidth: 2,
            borderRadius: 6
        };
    });

    if (charts.prenda) charts.prenda.destroy();
    const ctxPrenda = document.getElementById('chartPrenda');
    if (ctxPrenda) {
        charts.prenda = new Chart(ctxPrenda, {
            type: 'bar',
            data: { labels: prendas, datasets: datasets },
            options: getChartOptions('Productividad (uds/hora)'),
            plugins: [ChartDataLabels]
        });
    }

    const volumenPrenda = prendas.map(prenda => {
        return data.filter(d => d.Prenda === prenda)
            .reduce((acc, d) => acc + (d.Unidades || 0), 0);
    });

    if (charts.volumenPrenda) charts.volumenPrenda.destroy();
    const ctxVolPrenda = document.getElementById('chartVolumenPrenda');

    if (ctxVolPrenda) {
        charts.volumenPrenda = new Chart(ctxVolPrenda, {
            type: 'doughnut',
            data: {
                labels: prendas,
                datasets: [{
                    data: volumenPrenda,
                    backgroundColor: ['rgba(99, 102, 241, 0.6)', 'rgba(16, 185, 129, 0.6)', 'rgba(239, 68, 68, 0.6)'],
                    borderColor: ['#6366f1', '#10b981', '#ef4444'],
                    borderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 10, bottom: 10 } },
                plugins: {
                    legend: {
                        position: 'bottom',
                        align: 'center',
                        labels: {
                            color: document.body.classList.contains('dark-mode') ? '#ffffff' : '#000000',
                            padding: 12,
                            boxWidth: 15,
                            font: { weight: 'bold', size: 11 },
                            generateLabels: function (chart) {
                                const data = chart.data;
                                const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                                const isDark = document.body.classList.contains('dark-mode');
                                const labelColor = isDark ? '#ffffff' : '#000000';
                                return data.labels.map((label, i) => {
                                    const value = data.datasets[0].data[i];
                                    const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                    return {
                                        text: `${label} (${pct}%)`,
                                        fillStyle: data.datasets[0].borderColor[i],
                                        strokeStyle: data.datasets[0].borderColor[i],
                                        fontColor: labelColor,
                                        hidden: false,
                                        index: i
                                    };
                                });
                            }
                        }
                    },
                    datalabels: {
                        color: document.body.classList.contains('dark-mode') ? '#ffffff' : '#000000',
                        font: { weight: 'bold', size: 12 },
                        formatter: function (value) {
                            if (value >= 1000000) return Math.round(value / 1000000) + 'M';
                            if (value >= 1000) return Math.round(value / 1000) + 'K';
                            return Math.round(value);
                        }
                    }
                }
            }
        });
    }
}

function renderTurnos() {
    const turnos = ['MAÑANA', 'TARDE', 'NOCHE'];
    const operativas = ['PICKING', 'RBS PICKING', 'PICKING AUTOMATIZADO'];

    const datasets = operativas.map(op => {
        const prodData = turnos.map(turno => {
            const records = data.filter(d => d.Operativa === op && d.Turno === turno);
            return calcProductivity(records);
        });
        const color = OPERATIVA_COLORS[op];
        return {
            label: op,
            data: prodData,
            backgroundColor: color.transparent,
            borderColor: color.solid,
            borderWidth: 2,
            borderRadius: 6
        };
    });

    if (charts.turno) charts.turno.destroy();
    const ctxTurno = document.getElementById('chartTurno');
    if (ctxTurno) {
        charts.turno = new Chart(ctxTurno, {
            type: 'bar',
            data: { labels: turnos, datasets: datasets },
            options: getChartOptions('Productividad (uds/hora)'),
            plugins: [ChartDataLabels]
        });
    }

    const horasData = operativas.map(op => {
        const horas = turnos.map(turno => {
            return data.filter(d => d.Operativa === op && d.Turno === turno)
                .reduce((acc, d) => acc + (d.Horas_Prorrateadas || 0), 0);
        });
        const color = OPERATIVA_COLORS[op];
        return {
            label: op,
            data: horas,
            backgroundColor: color.transparent,
            borderColor: color.solid,
            borderWidth: 2,
            borderRadius: 6
        };
    });

    if (charts.horasTurno) charts.horasTurno.destroy();
    const ctxHorasTurno = document.getElementById('chartHorasTurno');
    if (ctxHorasTurno) {
        charts.horasTurno = new Chart(ctxHorasTurno, {
            type: 'bar',
            data: { labels: turnos, datasets: horasData },
            options: getChartOptions('Horas Trabajadas'),
            plugins: [ChartDataLabels]
        });
    }
}

function getChartOptions(title, showLabels = true, showLegend = true) {
    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#f8f9fa' : '#000000';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.05)';

    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: showLegend,
                position: 'top',
                labels: { color: textColor, padding: 15, font: { size: 11 } }
            },
            datalabels: {
                display: showLabels,
                color: textColor,
                anchor: 'end',
                align: 'top',
                offset: -2,
                font: { weight: 'bold', size: 10 },
                formatter: function (value) {
                    if (value === 0) return '';
                    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
                    if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
                    return value.toFixed(1);
                }
            }
        },
        scales: {
            x: { grid: { color: gridColor }, ticks: { color: textColor } },
            y: { grid: { color: gridColor }, ticks: { color: textColor } }
        }
    };
}

function handleExportPdf() {
    const startInput = document.getElementById('dateStart');
    const endInput = document.getElementById('dateEnd');
    const startStr = startInput.dataset.date;
    const endStr = endInput.dataset.date;
    const btn = document.getElementById('exportPdf');
    const originalText = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Generando...';

    // ... (Implementation specific to PDF generation, reuse existing logic, 
    // but I'll create a dedicated function or include it here if short enough)

    // For brevity and correctness, I should copy the full handleExportPdf logic.
    // I will include the full PDF generation logic here as it was in the original file.
    // ...
    // (Inserting the rest of handleExportPdf and renderPdfCharts here)
    // To save context, I will just call the same logic logic as in comparativas.js
    // Re-implementing the PDF logic deeply inside the module.

    // [Use same logic as in original file, ensuring data variable is accessible]
    // ...
    // Due to length, I'll paste the logic in the file content directly.
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    };

    const dateText = (startStr && endStr)
        ? `del ${formatDate(startStr)} al ${formatDate(endStr)}`
        : new Date().toLocaleDateString('es-ES');

    // Crear un contenedor temporal con estilos para PDF
    const pdfContainer = document.createElement('div');
    pdfContainer.id = 'pdfExportContainer';
    // ... (Styles from original)
    // I will inline the styles here to avoid issues with external CSS not loading in html2pdf sometimes
    // ... (rest of PDF logic)
    // To ensure I don't break the PDF tool, I will just copy the logic exactly.
    // But for this tool call, I will put a placeholder comment and fill it in the next tool call if needed?
    // No, I must write the full file content now.

    // START PDF GENERATION LOGIC

    pdfContainer.innerHTML = `
        <style>
            #pdfExportContainer { background: #1a1a2e; padding: 20px; width: 100%; box-sizing: border-box; font-family: 'Inter', sans-serif; }
            #pdfExportContainer .pdf-header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #333; }
            #pdfExportContainer .pdf-header h1 { color: #ffffff; font-size: 28px; font-weight: bold; margin-bottom: 5px; }
            #pdfExportContainer .pdf-header p { color: #888; font-size: 14px; margin: 0; }
            #pdfExportContainer .pdf-section { page-break-inside: avoid; page-break-after: always; margin-bottom: 20px; background: #1e1e2f; border-radius: 12px; padding: 25px; }
            #pdfExportContainer .section-title { color: #ffffff; font-size: 22px; font-weight: bold; margin-bottom: 5px; }
            #pdfExportContainer .section-subtitle { color: #888; font-size: 12px; margin-bottom: 20px; }
            #pdfExportContainer .charts-row { display: flex; justify-content: center; gap: 20px; flex-wrap: wrap; width: 100%; }
            #pdfExportContainer .chart-box-flex { background: #252538; border-radius: 8px; padding: 15px; flex: 1; min-width: 300px; max-width: 400px; box-sizing: border-box; }
            #pdfExportContainer .centered-chart-page { display: flex; flex-direction: column; align-items: center; justify-content: center; height: auto; min-height: 500px; }
            #pdfExportContainer .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px; width: 100%; }
            #pdfExportContainer .summary-card { background: #252538; border-radius: 8px; padding: 15px 20px; text-align: center; }
            #pdfExportContainer .summary-card.suelo { border-left: 4px solid #10b981; }
            #pdfExportContainer .summary-card.agv { border-left: 4px solid #6366f1; }
            #pdfExportContainer .summary-card .value { color: #ffffff; font-size: 24px; font-weight: bold; }
            #pdfExportContainer .summary-card .label { color: #888; font-size: 11px; text-transform: uppercase; font-weight: bold; }
            #pdfExportContainer .summary-card .sub { color: #666; font-size: 11px; }
            #pdfExportContainer .chart-box { background: #252538; border-radius: 8px; padding: 15px; width: 100%; box-sizing: border-box; }
            #pdfExportContainer .chart-box.large-centered { width: 95%; max-width: 900px; padding: 20px; }
            #pdfExportContainer .chart-title { color: #888; font-size: 11px; text-transform: uppercase; font-weight: bold; text-align: center; margin-bottom: 10px; }
            #pdfExportContainer .chart-canvas-wrapper { height: 250px; position: relative; width: 100%; }
            #pdfExportContainer .chart-canvas-wrapper.tall { height: 450px; }
            #pdfExportContainer .chart-canvas-wrapper.doughnut { height: 300px; width: 100%; margin: 0 auto; display: flex; justify-content: center; }
        </style>
        <div class="pdf-header">
            <h1>Comparativas de Productividad</h1>
            <p>Analisis detallado por tipo de zona, operativa, prenda y turno - ${dateText}</p>
        </div>
    `;

    // Obtener datos para las KPI cards
    const dataSuelo = data.filter(d => ZONAS_SUELO.includes(String(d.Zona)));
    const dataAgv = data.filter(d => !ZONAS_SUELO.includes(String(d.Zona)));

    const sueloTotals = dataSuelo.reduce((acc, d) => {
        acc.unidades += d.Unidades || 0;
        acc.horas += d.Horas_Prorrateadas || 0;
        return acc;
    }, { unidades: 0, horas: 0 });

    const agvTotals = dataAgv.reduce((acc, d) => {
        acc.unidades += d.Unidades || 0;
        acc.horas += d.Horas_Prorrateadas || 0;
        return acc;
    }, { unidades: 0, horas: 0 });

    const sueloProd = sueloTotals.horas > 0 ? sueloTotals.unidades / sueloTotals.horas : 0;
    const agvProd = agvTotals.horas > 0 ? agvTotals.unidades / agvTotals.horas : 0;

    const sectionsHTML = `
        <div class="pdf-section">
            <div class="section-title">Comparativa SUELO vs AGV</div>
            <div class="section-subtitle">Volumen y productividad por tipo de zona y operativa</div>
            <div class="summary-cards">
                <div class="summary-card suelo"><div class="value">${formatNumber(sueloTotals.unidades)}</div><div class="label">Volumen SUELO</div><div class="sub">${formatNumber(sueloTotals.horas)} horas</div></div>
                <div class="summary-card suelo"><div class="value">${sueloProd.toFixed(1)}</div><div class="label">Productividad SUELO</div><div class="sub">uds/hora</div></div>
                <div class="summary-card agv"><div class="value">${formatNumber(agvTotals.unidades)}</div><div class="label">Volumen AGV</div><div class="sub">${formatNumber(agvTotals.horas)} horas</div></div>
                <div class="summary-card agv"><div class="value">${agvProd.toFixed(1)}</div><div class="label">Productividad AGV</div><div class="sub">uds/hora</div></div>
            </div>
            <div class="charts-row">
                <div class="chart-box-flex"><div class="chart-title">Volumen por Tipo de Zona</div><div class="chart-canvas-wrapper"><canvas id="pdfChartVolumenTipo"></canvas></div></div>
                <div class="chart-box-flex"><div class="chart-title">Productividad por Tipo de Zona</div><div class="chart-canvas-wrapper"><canvas id="pdfChartProdTipo"></canvas></div></div>
            </div>
        </div>
        <div class="pdf-section centered-chart-page">
            <div style="width: 100%; text-align: left;"><div class="section-title">Productividad por Zona - SUELO</div><div class="section-subtitle">Zonas de picking manual (PICKING / RBS)</div></div>
            <div class="chart-box large-centered"><div class="chart-title">Zonas SUELO (PICKING / RBS)</div><div class="chart-canvas-wrapper tall"><canvas id="pdfChartZonaSuelo"></canvas></div></div>
        </div>
         <div class="pdf-section centered-chart-page">
            <div style="width: 100%; text-align: left;"><div class="section-title">Productividad por Zona - AGV</div><div class="section-subtitle">Zonas automatizadas (PICKING AUTO)</div></div>
            <div class="chart-box large-centered"><div class="chart-title">Zonas AGV (PICKING AUTO)</div><div class="chart-canvas-wrapper tall"><canvas id="pdfChartZonaAgv"></canvas></div></div>
        </div>
        <div class="pdf-section centered-chart-page">
            <div style="width: 100%; text-align: left;"><div class="section-title">Productividad por Prenda</div><div class="section-subtitle">Rendimiento segun tipo de prenda por operativa</div></div>
            <div class="chart-box large-centered"><div class="chart-title">Productividad por Prenda y Operativa</div><div class="chart-canvas-wrapper tall"><canvas id="pdfChartPrenda"></canvas></div></div>
        </div>
         <div class="pdf-section centered-chart-page">
            <div style="width: 100%; text-align: left;"><div class="section-title">Volumen por Prenda</div><div class="section-subtitle">Distribucion del volumen total por tipo de prenda</div></div>
            <div class="chart-box large-centered" style="display: flex; justify-content: center; align-items: center;">
                <div class="chart-canvas-wrapper doughnut" style="height: 400px; width: 400px;"><canvas id="pdfChartVolumenPrenda"></canvas></div>
            </div>
        </div>
         <div class="pdf-section">
             <div class="section-title">Productividad por Turno</div>
            <div class="section-subtitle">Rendimiento por turno (Manana, Tarde, Noche)</div>
            <div class="charts-row">
                <div class="chart-box-flex"><div class="chart-title">Productividad por Turno y Operativa</div><div class="chart-canvas-wrapper"><canvas id="pdfChartTurno"></canvas></div></div>
                 <div class="chart-box-flex"><div class="chart-title">Horas por Turno</div><div class="chart-canvas-wrapper"><canvas id="pdfChartHorasTurno"></canvas></div></div>
            </div>
        </div>
    `;

    pdfContainer.insertAdjacentHTML('beforeend', sectionsHTML);
    document.body.appendChild(pdfContainer);
    renderPdfCharts();

    setTimeout(() => {
        const opt = {
            margin: [5, 5],
            filename: `Comparativa_Productividad_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#1a1a2e', scrollY: 0 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
            pagebreak: { mode: ['css', 'legacy'] }
        };

        html2pdf().from(pdfContainer).set(opt).save().then(() => {
            document.body.removeChild(pdfContainer);
            btn.disabled = false;
            btn.innerHTML = originalText;
        }).catch(err => {
            console.error('Error generating PDF:', err);
            document.body.removeChild(pdfContainer);
            btn.disabled = false;
            btn.innerHTML = originalText;
        });
    }, 800);
}

function renderPdfCharts() {
    // Reuse specific chart rendering logic for PDF...
    // To save space and implementation time, I'm abbreviating the PDF chart rendering 
    // effectively duplication of renderAllCharts but targeting 'pdfChart...' IDs with specific options.
    // Ideally this should be shared code, but for now exact copy is safest.

    // ... [Logic is identical to comparativas.js renderPdfCharts function] ...
    // Because I cannot leave this empty, I will implement a simplified version or the full one.
    // I shall include the full implementation to ensure it works.

    // VARIABLES LOCALES
    const operativasOrdenadas = ['PICKING AUTOMATIZADO', 'PICKING', 'RBS PICKING'];
    const dataSuelo = data.filter(d => ZONAS_SUELO.includes(String(d.Zona)));
    const dataAgv = data.filter(d => !ZONAS_SUELO.includes(String(d.Zona)));

    // ... (rest of logic from comparativas.js lines 502-783)
    // I will write the full implementation in the file.

    // CONSTANTS & HELPERS
    const pdfChartOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, datalabels: { display: true, color: '#ffffff', anchor: 'end', align: 'top', offset: -2, font: { weight: 'bold', size: 10 }, formatter: function (value) { if (value === 0) return ''; if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M'; if (value >= 1000) return (value / 1000).toFixed(1) + 'K'; return value.toFixed(1); } } },
        scales: { x: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#888' } }, y: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#888' } } }
    };

    // 1. DATA PREP (VOLUMEN & PROD)
    const volumenData = []; const prodData = []; const barColors = []; const barBorderColors = [];
    operativasOrdenadas.forEach(op => {
        let opData; let color;
        if (op === 'PICKING AUTOMATIZADO') { opData = dataAgv.filter(d => d.Operativa === op); color = COLORS.agv; }
        else { opData = dataSuelo.filter(d => d.Operativa === op); color = COLORS.suelo; }
        volumenData.push(opData.reduce((acc, d) => acc + (d.Unidades || 0), 0));
        prodData.push(calcProductivity(opData));
        barColors.push(color.transparent); barBorderColors.push(color.solid);
    });

    new Chart(document.getElementById('pdfChartVolumenTipo'), { type: 'bar', data: { labels: operativasOrdenadas.map(getShortLabel), datasets: [{ data: volumenData, backgroundColor: barColors, borderColor: barBorderColors, borderWidth: 2, borderRadius: 6 }] }, options: pdfChartOptions });
    new Chart(document.getElementById('pdfChartProdTipo'), { type: 'bar', data: { labels: operativasOrdenadas.map(getShortLabel), datasets: [{ data: prodData, backgroundColor: barColors, borderColor: barBorderColors, borderWidth: 2, borderRadius: 6 }] }, options: pdfChartOptions });

    // 2. DATA PREP (ZONA SUELO)
    const dataSueloOps = data.filter(d => ['PICKING', 'RBS PICKING'].includes(d.Operativa) && ZONAS_SUELO.includes(String(d.Zona)));
    const zonasSuelo = [...new Set(dataSueloOps.map(d => d.Zona))].sort();
    const pickingData = []; const rbsData = [];
    zonasSuelo.forEach(zona => {
        pickingData.push(calcProductivity(dataSueloOps.filter(d => d.Zona === zona && d.Operativa === 'PICKING')));
        rbsData.push(calcProductivity(dataSueloOps.filter(d => d.Zona === zona && d.Operativa === 'RBS PICKING')));
    });

    new Chart(document.getElementById('pdfChartZonaSuelo'), { type: 'bar', data: { labels: zonasSuelo.map(z => `Planta ${z}`), datasets: [{ label: 'PICKING', data: pickingData, backgroundColor: COLORS.picking.transparent, borderColor: COLORS.picking.solid, borderWidth: 2, borderRadius: 6 }, { label: 'RBS PICK.', data: rbsData, backgroundColor: COLORS.rbsPicking.transparent, borderColor: COLORS.rbsPicking.solid, borderWidth: 2, borderRadius: 6 }] }, options: { ...pdfChartOptions, plugins: { ...pdfChartOptions.plugins, legend: { display: true, labels: { color: '#888' } } } } });

    // 3. DATA PREP (ZONA AGV)
    const dataAgvOps = data.filter(d => d.Operativa === 'PICKING AUTOMATIZADO' && !ZONAS_SUELO.includes(String(d.Zona)));
    const zonasAgv = [...new Set(dataAgvOps.map(d => d.Zona))].sort((a, b) => parseInt(a) - parseInt(b));
    const agvProdData = zonasAgv.map(zona => calcProductivity(dataAgvOps.filter(d => d.Zona === zona)));

    new Chart(document.getElementById('pdfChartZonaAgv'), { type: 'bar', data: { labels: zonasAgv.map(z => `Zona ${z}`), datasets: [{ label: 'PICK. AUTO', data: agvProdData, backgroundColor: COLORS.pickingAuto.transparent, borderColor: COLORS.pickingAuto.solid, borderWidth: 2, borderRadius: 6 }] }, options: { ...pdfChartOptions, plugins: { ...pdfChartOptions.plugins, legend: { display: true, labels: { color: '#888' } } } } });

    // 4. DATA PREP (PRENDA)
    const prendas = [...new Set(data.map(d => d.Prenda))].filter(p => p.toUpperCase() !== 'COLECCION ESPECIAL').sort();
    const prendaDatasets = operativasOrdenadas.map(op => {
        const color = OPERATIVA_COLORS[op];
        return { label: getShortLabel(op), data: prendas.map(prenda => calcProductivity(data.filter(d => d.Operativa === op && d.Prenda === prenda))), backgroundColor: color.transparent, borderColor: color.solid, borderWidth: 2, borderRadius: 6 };
    });
    new Chart(document.getElementById('pdfChartPrenda'), { type: 'bar', data: { labels: prendas, datasets: prendaDatasets }, options: { ...pdfChartOptions, plugins: { ...pdfChartOptions.plugins, legend: { display: true, labels: { color: '#888' } } } } });

    // 5. DATA PREP (VOLUMEN PRENDA)
    const volumenPrenda = prendas.map(prenda => data.filter(d => d.Prenda === prenda).reduce((acc, d) => acc + (d.Unidades || 0), 0));
    new Chart(document.getElementById('pdfChartVolumenPrenda'), { type: 'doughnut', data: { labels: prendas, datasets: [{ data: volumenPrenda, backgroundColor: ['rgba(99, 102, 241, 0.6)', 'rgba(16, 185, 129, 0.6)', 'rgba(239, 68, 68, 0.6)'], borderColor: ['#6366f1', '#10b981', '#ef4444'], borderWidth: 3 }] }, options: { responsive: true, maintainAspectRatio: false, layout: { padding: 20 }, plugins: { legend: { position: 'bottom', labels: { color: '#888', padding: 15, font: { size: 10 } } }, datalabels: { color: '#ffffff', font: { weight: 'bold', size: 11 }, formatter: function (value) { if (value >= 1000000) return Math.round(value / 1000000) + 'M'; if (value >= 1000) return Math.round(value / 1000) + 'K'; return Math.round(value); } } } } });

    // 6. DATA PREP (TURNO)
    const turnos = ['MAÑANA', 'TARDE', 'NOCHE'];
    const turnoDatasets = operativasOrdenadas.map(op => { const color = OPERATIVA_COLORS[op]; return { label: getShortLabel(op), data: turnos.map(turno => calcProductivity(data.filter(d => d.Operativa === op && d.Turno === turno))), backgroundColor: color.transparent, borderColor: color.solid, borderWidth: 2, borderRadius: 6 }; });
    new Chart(document.getElementById('pdfChartTurno'), { type: 'bar', data: { labels: turnos, datasets: turnoDatasets }, options: { ...pdfChartOptions, plugins: { ...pdfChartOptions.plugins, legend: { display: true, labels: { color: '#888' } } } } });

    const horasDatasets = operativasOrdenadas.map(op => { const color = OPERATIVA_COLORS[op]; return { label: getShortLabel(op), data: turnos.map(turno => data.filter(d => d.Operativa === op && d.Turno === turno).reduce((acc, d) => acc + (d.Horas_Prorrateadas || 0), 0)), backgroundColor: color.transparent, borderColor: color.solid, borderWidth: 2, borderRadius: 6 }; });
    new Chart(document.getElementById('pdfChartHorasTurno'), { type: 'bar', data: { labels: turnos, datasets: horasDatasets }, options: { ...pdfChartOptions, plugins: { ...pdfChartOptions.plugins, legend: { display: true, labels: { color: '#888' } } } } });
}
