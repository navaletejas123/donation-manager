// dashboard.js — Premium Analytics Dashboard

// ─── Chart instances ───────────────────────────────────────────────────────
let mainChart, pieChart, monthlyCompareChart, dailyTrendChart,
    paymentMethodChart, topDonorsChart, yearlyChart, expenseBreakdownChart;

// ─── Helpers ──────────────────────────────────────────────────────────────
const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

const shortINR = (v) => {
    if (v >= 1e7) return '₹' + (v / 1e7).toFixed(1) + 'Cr';
    if (v >= 1e5) return '₹' + (v / 1e5).toFixed(1) + 'L';
    if (v >= 1e3) return '₹' + (v / 1e3).toFixed(1) + 'K';
    return '₹' + v.toLocaleString('en-IN');
};

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function monthLabel(ym) {          // "2025-03" → "Mar '25"
    const [y, m] = ym.split('-');
    return MONTH_NAMES[parseInt(m, 10) - 1] + " '" + y.slice(2);
}

function destroyChart(ref) { if (ref) { try { ref.destroy(); } catch(_) {} } }

// ─── Colour palette ───────────────────────────────────────────────────────
const PALETTE = [
    '#4F6CFF','#10b981','#f59e0b','#ef4444','#8b5cf6',
    '#06b6d4','#f97316','#84cc16','#ec4899','#6366f1',
    '#14b8a6','#e11d48','#d97706','#7c3aed','#0284c7'
];

// Shared Chart.js defaults
const GRID_COLOR  = 'rgba(0,0,0,0.04)';
const TICK_COLOR  = '#94a3b8';
const FONT_FAMILY = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";

Chart.defaults.font.family = FONT_FAMILY;
Chart.defaults.color       = TICK_COLOR;

// Shared tooltip config
const TOOLTIP_CONFIG = {
    backgroundColor: 'rgba(15,23,42,0.92)',
    titleColor: '#f8fafc',
    bodyColor: '#e2e8f0',
    borderColor: 'rgba(79,108,255,0.25)',
    borderWidth: 1,
    padding: 12,
    cornerRadius: 10,
    boxPadding: 4,
    titleFont: { weight: '700', size: 12 },
    bodyFont: { size: 12 },
    displayColors: true,
    usePointStyle: true
};

// Shared animation config
const ANIMATION_CONFIG = {
    duration: 800,
    easing: 'easeOutQuart'
};

// ─── Gradient helper ──────────────────────────────────────────────────────
function createGradient(ctx, color1, color2, vertical = true) {
    const area = ctx.chart.chartArea;
    if (!area) return color1;
    const grad = vertical
        ? ctx.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom)
        : ctx.chart.ctx.createLinearGradient(area.left, 0, area.right, 0);
    grad.addColorStop(0, color1);
    grad.addColorStop(1, color2);
    return grad;
}

// ─── State ────────────────────────────────────────────────────────────────
let currentClarkBalance = 0;
let clarkHistoryPage = 1;
const clarkHistoryLimit = 10;

// ══════════════════════════════════════════════════════════════════════════
//  MAIN REFRESH
// ══════════════════════════════════════════════════════════════════════════
window.refreshDashboard = async () => {
    try {
        const [dashData, analyticsData] = await Promise.all([
            window.api.getDashboardData(),
            window.api.getAnalyticsData()
        ]);

        if (dashData.success) {
            currentClarkBalance = dashData.availableClarkCash || 0;

            // ── KPI cards ──────────────────────────────────────────────
            setText('total-cash-in',           formatCurrency(dashData.totalCashIn   || 0));
            setText('dashboard-total-pending', formatCurrency(dashData.totalPending  || 0));
            setText('total-expense',           formatCurrency(dashData.totalExpense  || 0));
            setText('total-cash',              formatCurrency(dashData.totalCash     || 0));
            setText('total-online',            formatCurrency(dashData.totalOnline   || 0));
            setText('clark-cash',              formatCurrency(currentClarkBalance));

            // ── Net balance quick stat ──────────────────────────────
            const netBalance = (dashData.totalCashIn || 0) - (dashData.totalExpense || 0);
            setText('qs-net-balance', shortINR(netBalance));

            // ── All-time date-wise bar ─────────────────────────────────
            updateMainBarChart(dashData.dateWiseDonations || []);

            // ── Category donut ─────────────────────────────────────────
            updatePieChart(dashData.categoryWiseDonations || []);
        }

        if (analyticsData && analyticsData.success) {
            // ── Meta badges ────────────────────────────────────────────
            const dc = document.getElementById('dash-donor-count');
            const dn = document.getElementById('dash-donation-count');
            if (dc) dc.innerHTML = `<i class="bi bi-people-fill"></i> ${analyticsData.donorCount} Donors`;
            if (dn) dn.innerHTML = `<i class="bi bi-receipt"></i> ${analyticsData.donationCount} Donations`;

            const lu = document.getElementById('dash-last-updated');
            if (lu) {
                const now = new Date();
                lu.innerHTML = `<i class="bi bi-clock"></i> ${now.toLocaleTimeString('en-IN', {hour:'2-digit', minute:'2-digit'})}`;
            }

            // ── Quick stats ────────────────────────────────────────────
            const avgDonation = analyticsData.donationCount > 0
                ? (dashData.totalCashIn || 0) / analyticsData.donationCount : 0;
            setText('qs-avg-donation', shortINR(avgDonation));
            setText('qs-total-donors', analyticsData.donorCount || 0);

            // This month total
            const thisMonthKey = new Date().toISOString().slice(0, 7); // "2026-03"
            const thisMonthData = (analyticsData.monthlyDonations || []).find(m => m.month === thisMonthKey);
            setText('qs-this-month', shortINR(thisMonthData ? thisMonthData.total : 0));

            // ── Charts ─────────────────────────────────────────────────
            updateMonthlyCompareChart(analyticsData.monthlyDonations || [], analyticsData.monthlyExpenses || []);
            updateDailyTrendChart(analyticsData.dailyTrend || []);
            updatePaymentMethodChart(analyticsData.paymentMethodDonations || [], analyticsData.paymentMethodPending || []);
            updateTopDonorsChart(analyticsData.topDonors || []);
            updateYearlyChart(analyticsData.yearlySummary || [], analyticsData.yearlyExpenses || []);
            updateExpenseBreakdownChart(analyticsData.expenseByMethod || []);
        }

        // ── Clark Cash History ──────────────────────────────────────────
        await loadClarkCashHistory(clarkHistoryPage);

    } catch (e) {
        console.error('Dashboard refresh error:', e);
    }
};

function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
}

// ══════════════════════════════════════════════════════════════════════════
//  CHART 1 — All-Time Date-Wise Bar (mainChart)
// ══════════════════════════════════════════════════════════════════════════
function updateMainBarChart(donations) {
    const ctx = document.getElementById('mainChart');
    if (!ctx) return;

    const labels = donations.map(d => d.date).sort();
    const data   = labels.map(l => (donations.find(d => d.date === l) || {}).total || 0);

    destroyChart(mainChart);
    mainChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Donations',
                data,
                backgroundColor(context) {
                    return createGradient(context, 'rgba(79,108,255,0.85)', 'rgba(56,189,248,0.55)');
                },
                borderColor: 'rgba(79,108,255,0.9)',
                borderWidth: 1,
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: ANIMATION_CONFIG,
            plugins: {
                legend: { display: false },
                tooltip: {
                    ...TOOLTIP_CONFIG,
                    callbacks: { label: c => ' ' + formatCurrency(c.raw) }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: GRID_COLOR },
                    ticks: { callback: v => shortINR(v) }
                },
                x: {
                    grid: { display: false },
                    ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 20 }
                }
            }
        }
    });
}

// ══════════════════════════════════════════════════════════════════════════
//  CHART 2 — Category Donut (pieChart)
// ══════════════════════════════════════════════════════════════════════════
function updatePieChart(categories) {
    const ctx = document.getElementById('pieChart');
    if (!ctx) return;

    if (!categories.length) categories = [{ category: 'No Data', total: 1 }];

    const labels = categories.map(c => c.category);
    const data   = categories.map(c => c.total);
    const total  = data.reduce((a, b) => a + b, 0);

    destroyChart(pieChart);
    pieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: PALETTE.slice(0, labels.length),
                borderColor: '#fff',
                borderWidth: 3,
                hoverOffset: 12,
                hoverBorderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '64%',
            animation: { ...ANIMATION_CONFIG, animateRotate: true },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { padding: 12, font: { size: 11, weight: '600' }, boxWidth: 12, usePointStyle: true, pointStyleWidth: 10 }
                },
                tooltip: {
                    ...TOOLTIP_CONFIG,
                    callbacks: {
                        label: c => {
                            const pct = total > 0 ? ((c.raw / total) * 100).toFixed(1) : 0;
                            return ` ${c.label}: ${formatCurrency(c.raw)} (${pct}%)`;
                        }
                    }
                }
            }
        },
        plugins: [{
            id: 'centerText',
            beforeDraw(chart) {
                const { width, height, ctx: c } = chart;
                c.save();
                const cx = width / 2, cy = height / 2 - 18;
                c.font = `bold 11px ${FONT_FAMILY}`;
                c.fillStyle = '#94a3b8';
                c.textAlign = 'center';
                c.fillText('TOTAL', cx, cy);
                c.font = `bold 16px ${FONT_FAMILY}`;
                c.fillStyle = '#1e293b';
                c.fillText(shortINR(total), cx, cy + 20);
                c.restore();
            }
        }]
    });
}

// ══════════════════════════════════════════════════════════════════════════
//  CHART 3 — Monthly Donations vs Expenses (grouped bar)
// ══════════════════════════════════════════════════════════════════════════
function updateMonthlyCompareChart(monthlyDonations, monthlyExpenses) {
    const ctx = document.getElementById('monthlyCompareChart');
    if (!ctx) return;

    const allMonths = [...new Set([
        ...monthlyDonations.map(d => d.month),
        ...monthlyExpenses.map(e => e.month)
    ])].sort();

    const donData = allMonths.map(m => (monthlyDonations.find(d => d.month === m) || {}).total || 0);
    const expData = allMonths.map(m => (monthlyExpenses.find(e => e.month === m) || {}).total || 0);
    const labels  = allMonths.map(monthLabel);

    destroyChart(monthlyCompareChart);
    monthlyCompareChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Donations',
                    data: donData,
                    backgroundColor(context) {
                        return createGradient(context, 'rgba(79,108,255,0.85)', 'rgba(79,108,255,0.45)');
                    },
                    borderColor: 'rgba(79,108,255,1)',
                    borderWidth: 1,
                    borderRadius: 6,
                    borderSkipped: false
                },
                {
                    label: 'Expenses',
                    data: expData,
                    backgroundColor(context) {
                        return createGradient(context, 'rgba(239,68,68,0.80)', 'rgba(239,68,68,0.40)');
                    },
                    borderColor: 'rgba(239,68,68,1)',
                    borderWidth: 1,
                    borderRadius: 6,
                    borderSkipped: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: ANIMATION_CONFIG,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: { usePointStyle: true, pointStyleWidth: 10, font: { size: 12, weight: '600' } }
                },
                tooltip: {
                    ...TOOLTIP_CONFIG,
                    callbacks: { label: c => ` ${c.dataset.label}: ${formatCurrency(c.raw)}` }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: GRID_COLOR },
                    ticks: { callback: v => shortINR(v) }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 11 } }
                }
            }
        }
    });
}

// ══════════════════════════════════════════════════════════════════════════
//  CHART 4 — Daily Trend Line (last 30 days)
// ══════════════════════════════════════════════════════════════════════════
function updateDailyTrendChart(dailyTrend) {
    const ctx = document.getElementById('dailyTrendChart');
    if (!ctx) return;

    const labels = dailyTrend.map(d => d.date);
    const data   = dailyTrend.map(d => d.total);

    destroyChart(dailyTrendChart);
    dailyTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Daily Donations',
                data,
                borderColor: '#4F6CFF',
                backgroundColor(context) {
                    return createGradient(context, 'rgba(79,108,255,0.18)', 'rgba(79,108,255,0.01)');
                },
                borderWidth: 2.5,
                pointRadius: data.length <= 15 ? 5 : 3,
                pointHoverRadius: 7,
                pointBackgroundColor: '#4F6CFF',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: ANIMATION_CONFIG,
            plugins: {
                legend: { display: false },
                tooltip: {
                    ...TOOLTIP_CONFIG,
                    callbacks: {
                        title: t => t[0].label,
                        label: c => ` ${formatCurrency(c.raw)}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: GRID_COLOR },
                    ticks: { callback: v => shortINR(v) }
                },
                x: {
                    grid: { display: false },
                    ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 12, font: { size: 11 } }
                }
            }
        }
    });
}

// ══════════════════════════════════════════════════════════════════════════
//  CHART 5 — Payment Method Polar Area
// ══════════════════════════════════════════════════════════════════════════
function updatePaymentMethodChart(donationMethods, pendingMethods) {
    const ctx = document.getElementById('paymentMethodChart');
    if (!ctx) return;

    const merged = {};
    donationMethods.forEach(d => {
        merged[d.payment_method] = (merged[d.payment_method] || 0) + d.total;
    });
    pendingMethods.forEach(p => {
        merged[p.payment_method] = (merged[p.payment_method] || 0) + p.total;
    });

    const labels = Object.keys(merged);
    const data   = Object.values(merged);

    if (!labels.length) { labels.push('No Data'); data.push(1); }

    destroyChart(paymentMethodChart);
    paymentMethodChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: PALETTE.slice(0, labels.length),
                borderColor: '#fff',
                borderWidth: 3,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { ...ANIMATION_CONFIG, animateRotate: true },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { usePointStyle: true, pointStyleWidth: 10, font: { size: 11, weight: '600' }, padding: 12 }
                },
                tooltip: {
                    ...TOOLTIP_CONFIG,
                    callbacks: { label: c => ` ${c.label}: ${formatCurrency(c.raw)}` }
                }
            }
        },
        plugins: [{
            id: 'centerTextPayment',
            beforeDraw(chart) {
                const { width, height, ctx: c } = chart;
                const total = chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                c.save();
                const cx = width / 2, cy = height / 2 - 18;
                c.font = `bold 11px ${FONT_FAMILY}`;
                c.fillStyle = '#94a3b8';
                c.textAlign = 'center';
                c.fillText('REVENUE', cx, cy);
                c.font = `bold 15px ${FONT_FAMILY}`;
                c.fillStyle = '#1e293b';
                c.fillText(shortINR(total), cx, cy + 20);
                c.restore();
            }
        }]
    });
}

// ══════════════════════════════════════════════════════════════════════════
//  CHART 6 — Top 10 Donors Horizontal Bar
// ══════════════════════════════════════════════════════════════════════════
function updateTopDonorsChart(topDonors) {
    const ctx = document.getElementById('topDonorsChart');
    if (!ctx) return;

    if (!topDonors.length) {
        topDonors = [{ name: 'No Data', total: 0 }];
    }

    const labels = topDonors.map(d => d.name.length > 18 ? d.name.slice(0, 16) + '…' : d.name);
    const data   = topDonors.map(d => d.total);

    // Gradient colours from blue → teal
    const bgColors = data.map((_, i) => {
        const ratio = i / Math.max(data.length - 1, 1);
        const r = Math.round(79  + ratio * (16  - 79));
        const g = Math.round(108 + ratio * (185 - 108));
        const b = Math.round(255 + ratio * (129 - 255));
        return `rgba(${r},${g},${b},0.80)`;
    });

    destroyChart(topDonorsChart);
    topDonorsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Total Donated',
                data,
                backgroundColor: bgColors,
                borderColor: bgColors.map(c => c.replace('0.80', '1')),
                borderWidth: 1,
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            animation: ANIMATION_CONFIG,
            plugins: {
                legend: { display: false },
                tooltip: {
                    ...TOOLTIP_CONFIG,
                    callbacks: { label: c => ` ${formatCurrency(c.raw)}` }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: GRID_COLOR },
                    ticks: { callback: v => shortINR(v) }
                },
                y: {
                    grid: { display: false },
                    ticks: { font: { size: 12, weight: '600' } }
                }
            }
        }
    });
}

// ══════════════════════════════════════════════════════════════════════════
//  CHART 7 — Yearly Overview Grouped Bar
// ══════════════════════════════════════════════════════════════════════════
function updateYearlyChart(yearlySummary, yearlyExpenses) {
    const ctx = document.getElementById('yearlyChart');
    if (!ctx) return;

    const allYears = [...new Set([
        ...yearlySummary.map(y => y.year),
        ...yearlyExpenses.map(e => e.year)
    ])].sort();

    const donData = allYears.map(y => (yearlySummary.find(s => s.year === y) || {}).donations || 0);
    const expData = allYears.map(y => (yearlyExpenses.find(e => e.year === y) || {}).expenses  || 0);
    const netData = allYears.map((_, i) => donData[i] - expData[i]);

    destroyChart(yearlyChart);
    yearlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: allYears,
            datasets: [
                {
                    label: 'Donations',
                    data: donData,
                    backgroundColor(context) {
                        return createGradient(context, 'rgba(79,108,255,0.85)', 'rgba(79,108,255,0.45)');
                    },
                    borderColor: 'rgba(79,108,255,1)',
                    borderWidth: 1,
                    borderRadius: 6,
                    borderSkipped: false,
                    order: 2
                },
                {
                    label: 'Expenses',
                    data: expData,
                    backgroundColor(context) {
                        return createGradient(context, 'rgba(239,68,68,0.80)', 'rgba(239,68,68,0.40)');
                    },
                    borderColor: 'rgba(239,68,68,1)',
                    borderWidth: 1,
                    borderRadius: 6,
                    borderSkipped: false,
                    order: 2
                },
                {
                    label: 'Net',
                    data: netData,
                    type: 'line',
                    borderColor:     '#10b981',
                    backgroundColor: 'rgba(16,185,129,0.08)',
                    borderWidth: 2.5,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    fill: false,
                    tension: 0.3,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: ANIMATION_CONFIG,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: { usePointStyle: true, pointStyleWidth: 10, font: { size: 12, weight: '600' } }
                },
                tooltip: {
                    ...TOOLTIP_CONFIG,
                    callbacks: { label: c => ` ${c.dataset.label}: ${formatCurrency(c.raw)}` }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: GRID_COLOR },
                    ticks: { callback: v => shortINR(v) }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

// ══════════════════════════════════════════════════════════════════════════
//  CHART 8 — Expense Breakdown Donut (NEW)
// ══════════════════════════════════════════════════════════════════════════
function updateExpenseBreakdownChart(expenseByMethod) {
    const ctx = document.getElementById('expenseBreakdownChart');
    if (!ctx) return;

    if (!expenseByMethod.length) expenseByMethod = [{ payment_method: 'No Data', total: 1 }];

    const labels = expenseByMethod.map(e => e.payment_method);
    const data   = expenseByMethod.map(e => e.total);
    const total  = data.reduce((a, b) => a + b, 0);

    const expensePalette = ['#8b5cf6','#06b6d4','#f97316','#ec4899','#84cc16','#ef4444','#6366f1'];

    destroyChart(expenseBreakdownChart);
    expenseBreakdownChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: expensePalette.slice(0, labels.length),
                borderColor: '#fff',
                borderWidth: 3,
                hoverOffset: 12,
                hoverBorderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '64%',
            animation: { ...ANIMATION_CONFIG, animateRotate: true },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { usePointStyle: true, pointStyleWidth: 10, font: { size: 11, weight: '600' }, padding: 12 }
                },
                tooltip: {
                    ...TOOLTIP_CONFIG,
                    callbacks: {
                        label: c => {
                            const pct = total > 0 ? ((c.raw / total) * 100).toFixed(1) : 0;
                            return ` ${c.label}: ${formatCurrency(c.raw)} (${pct}%)`;
                        }
                    }
                }
            }
        },
        plugins: [{
            id: 'centerTextExpense',
            beforeDraw(chart) {
                const { width, height, ctx: c } = chart;
                c.save();
                const cx = width / 2, cy = height / 2 - 18;
                c.font = `bold 11px ${FONT_FAMILY}`;
                c.fillStyle = '#94a3b8';
                c.textAlign = 'center';
                c.fillText('EXPENSES', cx, cy);
                c.font = `bold 15px ${FONT_FAMILY}`;
                c.fillStyle = '#1e293b';
                c.fillText(shortINR(total), cx, cy + 20);
                c.restore();
            }
        }]
    });
}

// ══════════════════════════════════════════════════════════════════════════
//  CLARK CASH HISTORY TABLE
// ══════════════════════════════════════════════════════════════════════════
async function loadClarkCashHistory(page) {
    const tableBody = document.querySelector('#clark-history-table tbody');
    const prevBtn   = document.getElementById('clark-history-prev');
    const nextBtn   = document.getElementById('clark-history-next');
    const infoText  = document.getElementById('clark-history-info');

    if (!tableBody) return;

    try {
        const res = await window.api.getPaginatedBankSubmissions({ page, limit: clarkHistoryLimit });
        if (res.success) {
            tableBody.innerHTML = '';
            
            if (res.history.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="4" class="text-center">No history found.</td></tr>';
            } else {
                res.history.forEach((item, index) => {
                    const row = document.createElement('tr');
                    // Calculate global index (latest at top is 1, next is 2, etc.)
                    const displayIndex = ((page - 1) * clarkHistoryLimit) + index + 1;
                    
                    row.innerHTML = `
                        <td>${displayIndex}</td>
                        <td class="table-date-cell">${window.formatDateDDMMYYYY ? window.formatDateDDMMYYYY(item.date) : item.date}</td>
                        <td>${item.time || '-'}</td>
                        <td style="font-weight:700; color:#d97706">${formatCurrency(item.amount)}</td>
                    `;
                    tableBody.appendChild(row);
                });
            }

            // Update pagination UI
            const totalPages = Math.ceil(res.total / clarkHistoryLimit) || 1;
            infoText.innerText = `Page ${page} of ${totalPages}`;
            prevBtn.disabled = (page === 1);
            nextBtn.disabled = (page === totalPages);
            clarkHistoryPage = page;
        }
    } catch (err) {
        console.error('Error loading Clark Cash history:', err);
    }
}

// ══════════════════════════════════════════════════════════════════════════
//  DOM READY
// ══════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    window.refreshDashboard();

    // ── Bank Submission Modal ──────────────────────────────────────────
    const clarkCard   = document.getElementById('clark-cash-card');
    const bankModal   = document.getElementById('bank-submission-modal');
    const bankAmt     = document.getElementById('bank-modal-amount');
    const closeBtn    = document.getElementById('close-bank-modal');
    const cancelBtn   = document.getElementById('cancel-bank-btn');
    const confirmBtn  = document.getElementById('confirm-bank-btn');

    const hideBankModal = () => { bankModal.style.display = 'none'; };

    if (clarkCard) {
        clarkCard.addEventListener('click', () => {
            if (currentClarkBalance <= 0) {
                window.showToast('Clark Cash balance is zero.', 'info');
                return;
            }
            const pwdInput = document.getElementById('bank-password-input');
            const pwdError = document.getElementById('bank-password-error');
            if (pwdInput) pwdInput.value = '';
            if (pwdError) pwdError.style.display = 'none';
            bankAmt.innerText = formatCurrency(currentClarkBalance);
            bankModal.style.display = 'block';
            setTimeout(() => pwdInput && pwdInput.focus(), 100);
        });
    }

    if (closeBtn)  closeBtn.onclick  = hideBankModal;
    if (cancelBtn) cancelBtn.onclick = hideBankModal;
    window.addEventListener('click', e => { if (e.target === bankModal) hideBankModal(); });

    if (confirmBtn) {
        confirmBtn.onclick = async () => {
            const pwdInput = document.getElementById('bank-password-input');
            const pwdError = document.getElementById('bank-password-error');

            if (pwdInput.value !== '9097') {
                pwdError.style.display = 'block';
                pwdInput.value = '';
                pwdInput.focus();
                return;
            }
            pwdError.style.display = 'none';

            try {
                confirmBtn.disabled   = true;
                confirmBtn.innerText  = 'Processing…';
                const res = await window.api.addBankSubmission(currentClarkBalance);
                if (res.success) {
                    window.showToast('Cash submitted to bank successfully!', 'success');
                    pwdInput.value = '';
                    hideBankModal();
                    await window.refreshDashboard();
                    // History is refreshed inside refreshDashboard()
                } else {
                    window.showToast('Error: ' + res.error, 'error');
                }
            } catch (err) {
                console.error('Bank submission failed', err);
                window.showToast('System Error: Could not connect to backend.', 'error');
            } finally {
                confirmBtn.disabled  = false;
                confirmBtn.innerText = 'Confirm Deposit';
            }
        };
    }

    // ── Clark Cash History Pagination ──────────────────────────────────
    const prevHistory = document.getElementById('clark-history-prev');
    const nextHistory = document.getElementById('clark-history-next');

    if (prevHistory) {
        prevHistory.addEventListener('click', () => {
            if (clarkHistoryPage > 1) loadClarkCashHistory(clarkHistoryPage - 1);
        });
    }

    if (nextHistory) {
        nextHistory.addEventListener('click', () => {
            loadClarkCashHistory(clarkHistoryPage + 1);
        });
    }
});
