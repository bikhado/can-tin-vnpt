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
        dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
}

// ---- Init ----
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
    const emptyState = document.getElementById('emptyState');
    const loadingScreen = document.getElementById('loadingScreen');
    const tbody = document.getElementById('weeklyBody');

    // Show loading
    totalStats.style.display = 'none';
    weeklyCard.style.display = 'none';
    emptyState.style.display = 'none';
    loadingScreen.style.display = '';

    try {
        const data = await apiGet('summary', { week: weekStr });
        loadingScreen.style.display = 'none';

        if (data.status === 'ok' && data.data) {
            const summary = data.data;
            let grandBreakfast = 0;
            let grandLunch = 0;
            let hasData = false;

            tbody.innerHTML = '';
            const weekDates = getWeekDates(weekStr);

            weekDates.forEach((dateStr, i) => {
                const dayData = summary[dateStr] || { breakfast: 0, lunch: 0 };
                grandBreakfast += dayData.breakfast;
                grandLunch += dayData.lunch;
                if (dayData.breakfast > 0 || dayData.lunch > 0) hasData = true;

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
                totalStats.style.display = '';
                weeklyCard.style.display = '';
            } else {
                emptyState.style.display = '';
            }
        } else {
            emptyState.style.display = '';
        }
    } catch (e) {
        loadingScreen.style.display = 'none';
        emptyState.style.display = '';
        console.error('Failed to load stats:', e);
        showToast('Lỗi kết nối', 'error');
    }
}
