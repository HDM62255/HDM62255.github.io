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

    new Chart(col.querySelector('canvas').getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Objetivo',
                    data: dataTarget,
                    type: 'line',
                    borderColor: isDarkMode ? PALETTE.target_dark : PALETTE.target_light,
                    borderWidth: 2,
                    pointRadius: 2,
                    spanGaps: true,
                    order: 1
                },
                {
                    label: 'Real',
                    data: dataReal,
                    backgroundColor: PALETTE.bar,
                    borderRadius: 4,
                    order: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { display: false } },
                x: { grid: { display: false } }
            }
        }
    });
}

/**
 * Renderiza el gráfico de tendencia del usuario.
 */
export function renderUserTrendChart(data, sortedDates, values, targetData, isDarkMode) {
    const ctx = document.getElementById('userTrendChart').getContext('2d');
    if (charts['userTrend']) charts['userTrend'].destroy();

    const isSingleRecord = sortedDates.length === 1;
    const chartType = isSingleRecord ? 'bar' : 'line';

    charts['userTrend'] = new Chart(ctx, {
        type: chartType,
        data: {
            labels: sortedDates,
            datasets: [
                {
                    label: 'Eficiencia %',
                    data: values,
                    borderColor: isDarkMode ? '#E30613' : '#37474f',
                    backgroundColor: isSingleRecord ? PALETTE.bar : PALETTE.trend_fill,
                    borderWidth: 2,
                    tension: 0.3,
                    fill: !isSingleRecord,
                    pointRadius: isSingleRecord ? 0 : 2,
                    order: 2,
                    barPercentage: 0.2
                },
                {
                    type: 'line',
                    label: 'Objetivo (100%)',
                    data: targetData,
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
                x: { grid: { display: false } }
            }
        }
    });
}
