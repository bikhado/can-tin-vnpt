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

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
    // Check URL param for key
    const params = new URLSearchParams(window.location.search);
    const keyParam = params.get('key');

    // Set default date
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    document.getElementById('menuDate').value = dateStr;
    document.getElementById('loadMenuDate').value = dateStr;

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
    }
}
