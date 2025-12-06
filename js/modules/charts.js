import { PALETTE } from './config.js';

// Almacén de instancias de gráficos para poder destruirlos y redibujarlos
const charts = {};

/**
 * Renderiza el gráfico de donut para las categorías de KPI.
 */
export function renderDonut(cats, isDarkMode) {
    const ctx = document.getElementById('kpi-donut-cat').getContext('2d');
    if (charts['donut']) charts['donut'].destroy();

    const total = cats.BEST + cats.NORMAL + cats.WORST;

    charts['donut'] = new Chart(ctx, {
        type: 'doughnut',
        plugins: [ChartDataLabels],
        data: {
            labels: ['Best', 'Normal', 'Worst'],
            datasets: [{
                data: [cats.BEST, cats.NORMAL, cats.WORST],
                backgroundColor: [PALETTE.best, PALETTE.normal, PALETTE.worst],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    display: true,
                    position: 'right',
                    labels: {
                        color: isDarkMode ? '#e0e0e0' : '#333',
                        boxWidth: 10,
                        font: { size: 10 }
                    }
                },
                datalabels: {
                    color: '#333',
                    font: { weight: 'bold', size: 10 },
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
    const chartType = isSingleRecord ? 'bar' : 'line';

    // Si targetData es un numero unico, expandirlo
    let finalTargets = Array.isArray(targetData) ? targetData : new Array(labels.length).fill(targetData);
    // Asumimos que target es constante para el gradiente si es array, tomamos el primero o el promedio?
    // Para el gradiente visual, necesitamos un valor de corte. Usaremos el primer valor del target array
    // como referencia principal, o idealmente deberiamos pasar el target VALUE explicitamente.
    // En este caso, usaremos el valor de targetData[0] para el gradiente.
    const targetValue = finalTargets[0];

    return new Chart(ctx, {
        type: chartType,
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Eficiencia %',
                    data: isSingleRecord ? dataValues.map(v => [targetValue, v]) : dataValues,
                    borderWidth: 2,
                    tension: 0.3,
                    fill: {
                        target: { value: targetValue },
                        above: 'rgba(46, 125, 50, 0.2)',   // Green 0.2
                        below: 'rgba(227, 6, 19, 0.2)'    // Red 0.2
                    },
                    pointRadius: isSingleRecord ? 0 : 3,
                    pointHoverRadius: 5,
                    order: 2,
                    barPercentage: isSingleRecord ? 0.15 : 0.2, // Thinner bars for "Poste" look
                    // Dynamic styling
                    borderColor: function (context) {
                        const chart = context.chart;
                        const { ctx, chartArea, scales } = chart;
                        if (!chartArea) return null;
                        return createThresholdGradient(ctx, chartArea, scales.y, targetValue, PALETTE.success_line, PALETTE.failure_line);
                    },
                    backgroundColor: function (context) {
                        // For single record (bar), we need solid color based on relation to target
                        if (isSingleRecord) {
                            const val = context.raw;
                            // Handle floating bar array [min, max] or simple value
                            const v = Array.isArray(val) ? val[1] : val;
                            return v >= targetValue ? 'rgba(46, 125, 50, 0.6)' : 'rgba(227, 6, 19, 0.6)'; // Slightly more opaque for the bar itself
                        }
                        return null; // Handled by fill property for lines
                    },
                    pointBackgroundColor: function (context) {
                        const val = context.raw;
                        return val >= targetValue ? PALETTE.success_line : PALETTE.failure_line;
                    },
                    pointBorderColor: function (context) {
                        const val = context.raw;
                        return val >= targetValue ? PALETTE.success_line : PALETTE.failure_line;
                    }
                },
                {
                    type: 'line',
                    label: 'Objetivo',
                    data: finalTargets,
                    borderColor: isDarkMode ? PALETTE.target_dark : PALETTE.target_light,
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    spanGaps: true,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true },
                x: {
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
