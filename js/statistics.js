// ============================================
// CANTEEN REGISTRATION — WEEKLY STATISTICS
// ============================================

const DAY_NAMES = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu'];

// Format date YYYY-MM-DD → dd/MM/yyyy
function formatDateVN(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// ---- Helpers ----
function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast' + (type ? ' toast-' + type : '');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function showLoading(emoji, text) {
    document.getElementById('loEmoji').textContent = emoji;
    document.getElementById('loText').textContent = text;
    document.getElementById('loadingOverlay').classList.add('show');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('show');
}

function apiGet(action, params = {}) {
    const url = new URL(CONFIG.API_BASE_URL);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return fetch(url).then(r => r.json());
}

function getCurrentWeek() {
    const now = new Date();
    const year = now.getFullYear();
    // Get the ISO week number
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${year}-W${String(weekNo).padStart(2, '0')}`;
}

function getWeekDates(weekStr) {
    // Parse "2026-W11" format
    const [yearStr, weekPart] = weekStr.split('-W');
    const year = parseInt(yearStr);
    const week = parseInt(weekPart);

    // Jan 4 is always in week 1
    const jan4 = new Date(year, 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const mondayOfWeek1 = new Date(jan4);
    mondayOfWeek1.setDate(jan4.getDate() - dayOfWeek + 1);

    const monday = new Date(mondayOfWeek1);
    monday.setDate(mondayOfWeek1.getDate() + (week - 1) * 7);

    const dates = [];
    for (let i = 0; i < 5; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${day}`);
    }
    return dates;
}

// ---- Init ----
let weeklyChart = null;

function getPrevWeek(weekStr) {
    const dates = getWeekDates(weekStr);
    const monday = new Date(dates[0] + 'T00:00:00');
    monday.setDate(monday.getDate() - 7);

    // Get ISO week string for this previous monday
    const d = new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

document.addEventListener('DOMContentLoaded', () => {
    const weekInput = document.getElementById('weekInput');
    weekInput.value = getCurrentWeek();

    weekInput.addEventListener('change', loadWeeklyStats);
    loadWeeklyStats();
});

async function loadWeeklyStats() {
    const weekStr = document.getElementById('weekInput').value;
    if (!weekStr) return;

    const totalStats = document.getElementById('totalStats');
    const weeklyCard = document.getElementById('weeklyCard');
    const chartCard = document.getElementById('chartCard');
    const emptyState = document.getElementById('emptyState');
    const loadingScreen = document.getElementById('loadingScreen');
    const tbody = document.getElementById('weeklyBody');

    // Show loading
    totalStats.style.display = 'none';
    weeklyCard.style.display = 'none';
    chartCard.style.display = 'none';
    emptyState.style.display = 'none';
    loadingScreen.style.display = '';
    showLoading('📊', 'Chờ chút bạn iưuưu~\nĐang tổng hợp thống kê tuần...');

    try {
        const prevWeekStr = getPrevWeek(weekStr);
        // Fetch both current and previous week in parallel
        const [data, prevData] = await Promise.all([
            apiGet('summary', { week: weekStr }),
            apiGet('summary', { week: prevWeekStr })
        ]);

        loadingScreen.style.display = 'none';
        hideLoading();

        if (data.status === 'ok' && data.data) {
            const summary = data.data;
            const prevSummary = (prevData.status === 'ok' && prevData.data) ? prevData.data : {};

            let grandBreakfast = 0;
            let grandLunch = 0;
            let prevGrandBreakfast = 0;
            let prevGrandLunch = 0;
            let hasData = false;

            tbody.innerHTML = '';
            const weekDates = getWeekDates(weekStr);
            const prevWeekDates = getWeekDates(prevWeekStr);

            // For chart data
            const chartDataBreakfast = [];
            const chartDataLunch = [];

            weekDates.forEach((dateStr, i) => {
                // Current week total
                const dayData = summary[dateStr] || { breakfast: 0, lunch: 0 };
                grandBreakfast += dayData.breakfast;
                grandLunch += dayData.lunch;
                if (dayData.breakfast > 0 || dayData.lunch > 0) hasData = true;

                // Chart arrays
                chartDataBreakfast.push(dayData.breakfast);
                chartDataLunch.push(dayData.lunch);

                // Previous week total
                const prevDateStr = prevWeekDates[i];
                const prevDayData = prevSummary[prevDateStr] || { breakfast: 0, lunch: 0 };
                prevGrandBreakfast += prevDayData.breakfast;
                prevGrandLunch += prevDayData.lunch;

                const tr = document.createElement('tr');
                tr.innerHTML = `
          <td>
            <strong>${DAY_NAMES[i]}</strong>
            <div style="font-size:.72rem;color:var(--gray-400);">${formatDateVN(dateStr)}</div>
          </td>
          <td style="text-align:center;">
            <strong style="color: ${dayData.breakfast > 0 ? 'var(--primary-500)' : 'var(--gray-300)'};">${dayData.breakfast}</strong>
          </td>
          <td style="text-align:center;">
            <strong style="color: ${dayData.lunch > 0 ? 'var(--accent-500)' : 'var(--gray-300)'};">${dayData.lunch}</strong>
          </td>
        `;
                tbody.appendChild(tr);
            });

            if (hasData) {
                document.getElementById('weekBreakfast').textContent = grandBreakfast;
                document.getElementById('weekLunch').textContent = grandLunch;

                // Render Growth Indicators
                renderGrowth('breakfastGrowth', grandBreakfast, prevGrandBreakfast);
                renderGrowth('lunchGrowth', grandLunch, prevGrandLunch);

                totalStats.style.display = '';
                weeklyCard.style.display = '';
                chartCard.style.display = '';

                // Render Chart
                renderChart(chartDataBreakfast, chartDataLunch);
            } else {
                emptyState.style.display = '';
            }
        } else {
            emptyState.style.display = '';
        }
    } catch (e) {
        loadingScreen.style.display = 'none';
        emptyState.style.display = '';
        hideLoading();
        console.error('Failed to load stats:', e);
        showToast('Lỗi kết nối', 'error');
    }
}

function renderGrowth(elId, current, prev) {
    const el = document.getElementById(elId);
    if (!prev) {
        el.innerHTML = '<span style="color:var(--gray-400)">Tuần trước: 0 (Mới)</span>';
        return;
    }

    // Check missing current vs missing prev
    if (current === prev) {
        el.innerHTML = '<span style="color:var(--gray-500)">➖ Bằng tuần trước</span>';
        return;
    }

    const diff = current - prev;
    const percent = Math.round((Math.abs(diff) / prev) * 100);

    if (diff > 0) {
        el.innerHTML = `<span style="color:#10B981;">▲ Tăng ${percent}% (${diff} suất)</span>`;
    } else {
        el.innerHTML = `<span style="color:#EF4444;">▼ Giảm ${percent}% (${Math.abs(diff)} suất)</span>`;
    }
}

function renderChart(breakfastData, lunchData) {
    const ctx = document.getElementById('weeklyChart').getContext('2d');

    if (weeklyChart) {
        weeklyChart.destroy();
    }

    weeklyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: DAY_NAMES,
            datasets: [
                {
                    label: 'Bữa Sáng',
                    data: breakfastData,
                    backgroundColor: '#F59E0B',
                    borderRadius: 4
                },
                {
                    label: 'Bữa Trưa',
                    data: lunchData,
                    backgroundColor: '#10B981',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: { family: "'Inter', sans-serif" }
                    }
                }
            }
        }
    });
}
