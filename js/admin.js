// ============================================
// CANTEEN REGISTRATION — ADMIN PAGE LOGIC
// ============================================

let adminKey = '';

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

function apiPost(action, data) {
    return fetch(CONFIG.API_BASE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action, ...data })
    }).then(r => r.json());
}

function initDateDisplay(inputId, displayId) {
    const input = document.getElementById(inputId);
    const display = document.getElementById(displayId);

    if (input.value) {
        display.textContent = formatDateVN(input.value);
        display.classList.remove('placeholder');
    }

    input.addEventListener('change', () => {
        if (input.value) {
            display.textContent = formatDateVN(input.value);
            display.classList.remove('placeholder');
        } else {
            display.textContent = 'dd/MM/yyyy';
            display.classList.add('placeholder');
        }
    });
}

function getCurrentWeek() {
    const now = new Date();
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getPrevWeek(weekStr) {
    const parts = weekStr.split('-W');
    let year = parseInt(parts[0]);
    let week = parseInt(parts[1]);

    if (week === 1) {
        year -= 1;
        const d = new Date(Date.UTC(year, 11, 28));
        const yearStart = new Date(Date.UTC(year, 0, 1));
        week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    } else {
        week -= 1;
    }
    return `${year}-W${String(week).padStart(2, '0')}`;
}

function addDays(dateStr, days) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
    // Check URL param for key
    const params = new URLSearchParams(window.location.search);
    const keyParam = params.get('key');

    // Set default date
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    document.getElementById('menuDate').value = dateStr;
    document.getElementById('loadMenuDate').value = dateStr;

    // Set default week for clone input
    const cloneWeekInput = document.getElementById('cloneWeekInput');
    if (cloneWeekInput) {
        cloneWeekInput.value = getCurrentWeek();
    }

    // Init date displays
    initDateDisplay('menuDate', 'menuDateDisplay');
    initDateDisplay('loadMenuDate', 'loadMenuDateDisplay');

    // Try to auto-login: URL param > localStorage
    if (keyParam) {
        document.getElementById('adminKeyInput').value = keyParam;
        verifyAdminKey();
    } else {
        const savedKey = localStorage.getItem('canteen_admin_key');
        if (savedKey) {
            document.getElementById('adminKeyInput').value = savedKey;
            verifyAdminKey();
        }
    }
});

async function verifyAdminKey() {
    const keyInput = document.getElementById('adminKeyInput');
    const key = keyInput.value.trim();

    if (!key) {
        showToast('Vui lòng nhập Admin Key', 'error');
        return;
    }

    const btn = document.getElementById('btnVerify');
    const btnText = document.getElementById('btnVerifyText');
    const spinner = document.getElementById('btnVerifySpinner');

    btn.disabled = true;
    btnText.classList.add('hidden');
    spinner.classList.remove('hidden');
    showLoading('🔐', 'Chờ chút bạn iưuưu~\nĐang xác thực Admin Key...');

    try {
        const data = await apiGet('verify_admin', { key });
        if (data.status === 'ok') {
            adminKey = key;
            localStorage.setItem('canteen_admin_key', key);
            document.getElementById('lockScreen').style.display = 'none';
            document.getElementById('adminPanel').classList.remove('hidden');
            showToast('Xác thực thành công!', 'success');
            loadOverrideStatus();
        } else {
            showToast('Admin Key không đúng', 'error');
            localStorage.removeItem('canteen_admin_key');
        }
    } catch (e) {
        console.error('Auth failed:', e);
        showToast('Lỗi kết nối', 'error');
    } finally {
        btn.disabled = false;
        btnText.classList.remove('hidden');
        spinner.classList.add('hidden');
        hideLoading();
    }
}

async function saveMenu() {
    const date = document.getElementById('menuDate').value;
    const breakfast = document.getElementById('menuBreakfastInput').value.trim();
    const lunch = document.getElementById('menuLunchInput').value.trim();

    if (!date) {
        showToast('Vui lòng chọn ngày', 'error');
        return;
    }

    const btnText = document.getElementById('btnMenuText');
    const spinner = document.getElementById('btnMenuSpinner');
    btnText.classList.add('hidden');
    spinner.classList.remove('hidden');

    try {
        const result = await apiPost('menu', {
            date,
            breakfast,
            lunch,
            admin_key: adminKey
        });

        if (result.status === 'ok') {
            showToast('Đã lưu thực đơn thành công!', 'success');
        } else {
            showToast(result.message || 'Lưu thất bại', 'error');
        }
    } catch (e) {
        console.error('Save menu failed:', e);
        showToast('Lỗi kết nối', 'error');
    } finally {
        btnText.classList.remove('hidden');
        spinner.classList.add('hidden');
    }
}

async function loadExistingMenu() {
    const date = document.getElementById('loadMenuDate').value;
    if (!date) {
        showToast('Vui lòng chọn ngày', 'error');
        return;
    }

    showLoading('🍽️', 'Chờ chút bạn iưuưu~\nĐang tải thực đơn...');

    try {
        const data = await apiGet('menu', { date });
        const info = document.getElementById('loadedMenuInfo');

        if (data.status === 'ok' && data.data) {
            info.classList.remove('hidden');
            document.getElementById('loadedBreakfast').textContent = data.data.breakfast || '—';
            document.getElementById('loadedLunch').textContent = data.data.lunch || '—';

            // Also fill in the edit fields
            document.getElementById('menuDate').value = date;
            document.getElementById('menuBreakfastInput').value = data.data.breakfast || '';
            document.getElementById('menuLunchInput').value = data.data.lunch || '';
        } else {
            info.classList.add('hidden');
            showToast('Chưa có thực đơn cho ngày này', 'error');
        }
    } catch (e) {
        console.error('Load menu failed:', e);
        showToast('Lỗi kết nối', 'error');
    } finally {
        hideLoading();
    }
}

async function loadOverrideStatus() {
    try {
        const data = await apiGet('settings', { key: 'override_cutoff' });
        if (data.status === 'ok') {
            const isOverride = data.data.value === 'true';
            document.getElementById('overrideToggle').checked = isOverride;
            document.getElementById('overrideStatus').textContent =
                isOverride ? '✅ Đang cho phép đăng ký muộn' : '🔒 Áp dụng hạn chót bình thường';
        }
    } catch (e) {
        console.error('Load override status failed:', e);
    }
}

async function toggleOverride() {
    const checkbox = document.getElementById('overrideToggle');
    const newValue = checkbox.checked ? 'true' : 'false';

    showLoading('⚙️', 'Chờ chút bạn iưuưu~\nĐang cập nhật cài đặt...');

    try {
        const result = await apiPost('override', {
            value: newValue,
            admin_key: adminKey
        });

        if (result.status === 'ok') {
            document.getElementById('overrideStatus').textContent =
                checkbox.checked ? '✅ Đang cho phép đăng ký muộn' : '🔒 Áp dụng hạn chót bình thường';
            showToast(checkbox.checked ? 'Đã bật cho phép đăng ký muộn' : 'Đã tắt cho phép đăng ký muộn', 'success');
        } else {
            // Revert
            checkbox.checked = !checkbox.checked;
            showToast(result.message || 'Thao tác thất bại', 'error');
        }
    } catch (e) {
        checkbox.checked = !checkbox.checked;
        console.error('Toggle override failed:', e);
        showToast('Lỗi kết nối', 'error');
    } finally {
        hideLoading();
    }
}

async function clonePreviousWeekMenu() {
    const weekInput = document.getElementById('cloneWeekInput').value;
    if (!weekInput) {
        showToast('Vui lòng chọn tuần áp dụng', 'error');
        return;
    }

    const prevWeek = getPrevWeek(weekInput);
    const btnText = document.getElementById('btnCloneText');
    const spinner = document.getElementById('btnCloneSpinner');

    btnText.classList.add('hidden');
    spinner.classList.remove('hidden');
    showLoading('🔄', 'Chờ chút bạn iưuưu~\nĐang sao chép thực đơn...');

    try {
        // Fetch previous week's menu
        const resp = await apiGet('menu', { week: prevWeek });
        if (!resp || resp.status !== 'ok' || !resp.data || resp.data.length === 0) {
            showToast('Không tìm thấy thực đơn tuần trước để copy', 'error');
            return;
        }

        const prevMenu = resp.data;
        // Check if prevMenu has any actual food
        const hasFood = prevMenu.some(d => d.breakfast || d.lunch);
        if (!hasFood) {
            showToast('Thực đơn tuần trước trống', 'error');
            return;
        }

        // Shift dates by +7 days
        const newMenus = prevMenu.map(d => ({
            date: addDays(d.date, 7),
            breakfast: d.breakfast,
            lunch: d.lunch
        }));

        // Send to save batch
        const saveResp = await apiPost('menu_batch', {
            admin_key: adminKey,
            menus: newMenus
        });

        if (saveResp.status === 'ok') {
            showToast('Đã copy thực đơn thành công!', 'success');
        } else {
            showToast(saveResp.message || 'Copy thất bại', 'error');
        }

    } catch (e) {
        console.error('Clone menu failed:', e);
        showToast('Lỗi kết nối', 'error');
    } finally {
        btnText.classList.remove('hidden');
        spinner.classList.add('hidden');
        hideLoading();
    }
}
