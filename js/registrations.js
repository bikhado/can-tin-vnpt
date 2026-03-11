// ============================================
// CANTEEN REGISTRATION — REGISTRATIONS LIST
// ============================================

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

function formatDateVN(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function initDateDisplay(inputId, displayId) {
    const input = document.getElementById(inputId);
    const display = document.getElementById(displayId);
    function update() {
        if (input.value) {
            display.textContent = formatDateVN(input.value);
            display.classList.remove('placeholder');
        } else {
            display.textContent = 'dd/MM/yyyy';
            display.classList.add('placeholder');
        }
    }
    input.addEventListener('change', update);
    input.addEventListener('input', update);
    update();
}

function apiGet(action, params = {}) {
    const url = new URL(CONFIG.API_BASE_URL);
    url.searchParams.set('action', action);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return fetch(url).then(r => r.json());
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('regDate');
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;

    dateInput.addEventListener('change', loadRegistrations);

    // Init date display
    initDateDisplay('regDate', 'regDateDisplay');

    loadRegistrations();
});

async function loadRegistrations() {
    const dateStr = document.getElementById('regDate').value;
    if (!dateStr) return;

    const tableCard = document.getElementById('tableCard');
    const statGrid = document.getElementById('statGrid');
    const emptyState = document.getElementById('emptyState');
    const loadingScreen = document.getElementById('loadingScreen');
    const tbody = document.getElementById('regTableBody');

    // Show loading
    tableCard.style.display = 'none';
    statGrid.style.display = 'none';
    emptyState.style.display = 'none';
    loadingScreen.style.display = '';
    showLoading('📋', 'Chờ chút bạn iưuưu~\nĐang tải danh sách đăng ký...');

    try {
        const data = await apiGet('registrations', { date: dateStr });
        loadingScreen.style.display = 'none';
        hideLoading();

        if (data.status === 'ok' && data.data && data.data.length > 0) {
            const registrations = data.data;

            // Calculate totals
            let totalBreakfast = 0;
            let totalLunch = 0;

            tbody.innerHTML = '';
            registrations.forEach(reg => {
                const isBreakfast = reg.breakfast === 'yes';
                const isLunch = reg.lunch === 'yes';
                if (isBreakfast) totalBreakfast++;
                if (isLunch) totalLunch++;

                const tr = document.createElement('tr');
                tr.innerHTML = `
          <td><strong>${escapeHtml(reg.employee)}</strong></td>
          <td>${escapeHtml(reg.department)}</td>
          <td><span class="badge ${isBreakfast ? 'badge-yes' : 'badge-no'}">${isBreakfast ? 'Có' : 'Không'}</span></td>
          <td><span class="badge ${isLunch ? 'badge-yes' : 'badge-no'}">${isLunch ? 'Có' : 'Không'}</span></td>
        `;
                tbody.appendChild(tr);
            });

            document.getElementById('totalBreakfast').textContent = totalBreakfast;
            document.getElementById('totalLunch').textContent = totalLunch;

            tableCard.style.display = '';
            statGrid.style.display = '';
        } else {
            emptyState.style.display = '';
        }
    } catch (e) {
        loadingScreen.style.display = 'none';
        emptyState.style.display = '';
        hideLoading();
        console.error('Failed to load registrations:', e);
        showToast('Lỗi kết nối', 'error');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
