import { PALETTE } from './config.js';

// Almacén de instancias de gráficos para poder destruirlos y redibujarlos
const charts = {};

/**
 * Renderiza el gráfico de donut para las categorías de KPI.
 */
export function renderDonut(cats, isDarkMode) {
    const ctx = document.getElementById('kpi-donut-cat').getContext('2d');
    if (charts['donut']) charts['donut'].destroy();

    const total = cats.TOP + cats.NORMAL + cats.BOTTOM;

    charts['donut'] = new Chart(ctx, {
        type: 'doughnut',
        plugins: [ChartDataLabels],
        data: {
            labels: ['Top', 'Normal', 'Bottom'],
            datasets: [{
                data: [cats.TOP, cats.NORMAL, cats.BOTTOM],
                backgroundColor: [
                    'rgba(0, 255, 127, 0.2)',
                    'rgba(255, 193, 7, 0.2)',
                    'rgba(220, 53, 69, 0.2)'
                ],
                borderColor: [
                    'rgba(0, 255, 127, 1)',
                    'rgba(255, 193, 7, 1)',
                    'rgba(220, 53, 69, 1)'
                ],
                borderWidth: 2
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    display: true,
                    position: 'right',
                    align: 'center',
                    labels: {
                        color: isDarkMode ? '#e0e0e0' : '#333',
                        boxWidth: 12,
                        padding: 15,
                        font: { size: 14, weight: 'bold' }
                    }
                },
                datalabels: {
                    color: isDarkMode ? '#ffffff' : '#1a1a1a',
                    font: { weight: 'bold', size: 12 },
                    formatter: (value) => value > 0 ? ((value / total) * 100).toFixed(0) + "%" : ""
                }
            }
        }
    });
}

/**
 * Renderiza los gráficos de barras/líneas para las actividades globales.
 */
export function renderGlobalChartItem(container, act, labels, dataReal, dataTarget, isDarkMode) {
    const col = document.createElement('div');
    col.className = 'col-12 col-lg-6 mb-3';
    col.innerHTML = `<div class="card p-3 h-100"><h6 class="text-center fw-bold mb-3 small text-uppercase text-gxo">${act}</h6><div style="height: 220px;"><canvas></canvas></div></div>`;
    container.appendChild(col);

    // Use the generic renderTrendChart logic but we need to track the instance to destroy it later if needed.
    // For global charts, we might want to store them in the 'charts' object using keys derived from 'act'.
    const chartKey = `global_${act}`;
    if (charts[chartKey]) charts[chartKey].destroy();

    const ctx = col.querySelector('canvas').getContext('2d');
    charts[chartKey] = renderTrendChart(ctx, labels, dataReal, dataTarget, isDarkMode);
}

/**
 * Renderiza el gráfico de tendencia del usuario.
 */
/**
 * Renderiza el gráfico de tendencia del usuario.
 * Ahora utiliza la nueva funcion generica 'renderTrendChart'.
 */
export function renderUserTrendChart(data, sortedDates, values, targetData, isDarkMode) {
    const ctx = document.getElementById('userTrendChart').getContext('2d');
    if (charts['userTrend']) charts['userTrend'].destroy();

    charts['userTrend'] = renderTrendChart(ctx, sortedDates, values, targetData, isDarkMode);
}

/**
 * Función genérica para renderizar gráficos de tendencia estilizados.
 * Reemplaza la lógica anterior de barras en la vista global.
 */
export function renderTrendChart(ctx, labels, dataValues, targetData, isDarkMode) {
    const isSingleRecord = labels.length === 1;

    // Expandir targetData a un array si es un número único
    let finalTargets = Array.isArray(targetData) ? targetData : new Array(labels.length).fill(targetData);

    // Obtener valor de objetivo para referencia de color
    const targetValue = finalTargets[0];

    // Calculate Dynamic Scales
    const { min, max } = calculateSymmetricScales(dataValues, targetValue, isSingleRecord);

    const plugins = [];
    if (isSingleRecord) {
        plugins.push({
            id: 'singleTargetLine',
            afterDatasetsDraw: (chart) => {
                const { ctx, chartArea: { left, right }, scales: { y } } = chart;
                if (!y) return;
                const yPixel = y.getPixelForValue(targetValue);

                ctx.save();
                ctx.beginPath();
                ctx.setLineDash([5, 5]);
                ctx.lineWidth = 2;
                ctx.strokeStyle = isDarkMode ? '#ffffff' : PALETTE.target_light;
                ctx.moveTo(left, yPixel);
                ctx.lineTo(right, yPixel);
                ctx.stroke();
                ctx.restore();
            }
        });
    }

    return new Chart(ctx, {
        type: 'line', // Controlador principal sigue siendo Line
        plugins: plugins,
        data: {
            labels: labels,
            datasets: [
                {
                    // Dataset de Valores (Real)
                    type: isSingleRecord ? 'bar' : 'line',
                    label: 'Eficiencia %',
                    data: dataValues, // Datos directos; beginAtZero se encarga del origen

                    // Estética de Barra (Single Record)
                    maxBarThickness: isSingleRecord ? 60 : undefined,
                    backgroundColor: function (context) {
                        if (isSingleRecord) {
                            const val = context.raw;
                            // Usar opacidad 0.2 para el fondo, igual que el relleno de las gráficas de línea
                            return val >= targetValue ? 'rgba(46, 125, 50, 0.2)' : 'rgba(227, 6, 19, 0.2)';
                        }
                        return 'rgba(0,0,0,0)'; // Transparente para línea (relleno via fill)
                    },
                    borderColor: function (context) {
                        if (isSingleRecord) {
                            const val = context.raw;
                            return val >= targetValue ? 'rgba(46, 125, 50, 1)' : 'rgba(227, 6, 19, 1)';
                        }
                        // Gradiente para línea (Multi Record)
                        const chart = context.chart;
                        const { ctx, chartArea, scales } = chart;
                        if (!chartArea) return null;
                        return createThresholdGradient(ctx, chartArea, scales.y, targetValue, PALETTE.success_line, PALETTE.failure_line);
                    },
                    borderWidth: 2,

                    // Estética de Línea (Multi Record)
                    tension: 0.3,
                    fill: isSingleRecord ? false : {
                        target: { value: targetValue },
                        above: 'rgba(46, 125, 50, 0.2)',
                        below: 'rgba(227, 6, 19, 0.2)'
                    },
                    pointRadius: isSingleRecord ? 0 : 3,
                    pointBackgroundColor: function (context) {
                        const val = context.raw;
                        return val >= targetValue ? PALETTE.success_line : PALETTE.failure_line;
                    },
                    pointBorderColor: function (context) {
                        const val = context.raw;
                        return val >= targetValue ? PALETTE.success_line : PALETTE.failure_line;
                    },
                    order: 2
                },
                // Dataset de Objetivo: Solo agregar si NO es single record (si es single, lo dibuja el plugin)
                !isSingleRecord ? {
                    // Dataset de Objetivo (Target) -> SIEMPRE LINE
                    type: 'line',
                    label: 'Objetivo',
                    data: finalTargets,
                    borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.8)' : PALETTE.target_light,
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false,
                    spanGaps: true,
                    order: 1
                } : null
            ].filter(Boolean) // Filtrar nulos
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            layout: {
                padding: {
                    right: 35,
                    left: 0
                }
            },
            scales: {
                y: {
                    min: min,
                    max: max,
                    // beginAtZero removido para permitir centrado dinámico, salvo excepción en min logic
                    ticks: {
                        color: (context) => {
                            if (!isDarkMode) return '#666666';
                            // "Gris clarito" (o semitransparente) para los límites (primero y último)
                            // El contexto provee el índice, pero necesitamos saber el total para identificar el último.
                            // Accedemos a la escala 'y' desde el chart.
                            const scale = context.chart.scales['y'];
                            if (scale && scale.ticks && (context.index === 0 || context.index === scale.ticks.length - 1)) {
                                return 'rgba(255, 255, 255, 0.5)';
                            }
                            return '#ffffff';
                        },
                        callback: function (value) {
                            if (value % 1 === 0) {
                                return value;
                            }
                        }
                    },
                    grid: {
                        display: true,
                        color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                        drawBorder: true
                    }
                },
                x: {
                    offset: isSingleRecord,
                    ticks: {
                        color: isDarkMode ? '#ffffff' : '#666666'
                    },
                    grid: {
                        display: true,
                        color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                        drawBorder: true
                    }
                }
            }
        }
    });
}

/**
 * Calcula límites simétricos para el eje Y para centrar el Target.
 * @param {Array} dataValues 
 * @param {Number} target 
 * @param {Boolean} isSingleRecord 
 * @returns {Object} { min, max }
 */
function calculateSymmetricScales(dataValues, target, isSingleRecord) {
    // 1. Obtener Min y Max de los datos
    const numericData = dataValues.map(v => Number(v));
    let dataMax = Math.max(...numericData);
    let dataMin = Math.min(...numericData);

    // Si dataValues está vacío o todos son target, prevenir errores
    if (numericData.length === 0) {
        return { min: target - 10, max: target + 10 };
    }

    // 2. Calcular Desviación Máxima absoluta
    // Asegurarse de que comparamos el target también con el propio max/min si estuvieran muy cerca
    // El algoritmo pidio: abs(DataMax - Target) y abs(DataMin - Target)
    const maxDeviation = Math.max(Math.abs(dataMax - target), Math.abs(dataMin - target));

    // 3. Añadir Margen (Padding) del 20% (1.2)
    // Si la desviación es 0 (datos planos en target), forzar un pequeño rango por defecto
    const range = maxDeviation === 0 ? (target * 0.1 || 10) : (maxDeviation * 1.2);

    let min = Math.floor(target - range);
    let max = Math.ceil(target + range);

    // Evitar negativos
    if (min < 0) min = 0;

    // 4. Excepción para Gráficas de Barras (Single Day)
    if (isSingleRecord) {
        min = 0;
    }

    return { min, max };
}

export function createThresholdGradient(ctx, chartArea, yScale, targetValue, colorAbove, colorBelow) {
    // If targetValue is not defined or scales not ready
    if (targetValue == null || !yScale || !chartArea) return colorAbove;

    const yPos = yScale.getPixelForValue(targetValue);

    // Ensure yPos is within chart area to avoid glitches
    // gradient goes from top (0) to bottom (height)
    // but canvas coordinates: 0 is top.

    // Create gradient
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);

    // Calculate stop position (0 to 1)
    let offset = (yPos - chartArea.top) / (chartArea.bottom - chartArea.top);

    // Clamp offset to valid range [0, 1]
    if (offset < 0) offset = 0;
    if (offset > 1) offset = 1;

    gradient.addColorStop(0, colorAbove);
    gradient.addColorStop(offset, colorAbove);
    gradient.addColorStop(offset, colorBelow);
    gradient.addColorStop(1, colorBelow);

    return gradient;
}
