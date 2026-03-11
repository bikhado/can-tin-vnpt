// ============================================
// CANTEEN REGISTRATION — EMPLOYEE PAGE LOGIC
// ============================================

let employees = [];
let currentMenu = null;
let isEditing = false;
let deadlinePassed = false;

// ---- Helpers ----
function formatDate(d) {
    return d.toISOString().split('T')[0];
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

function getNextWeekday(from) {
    const d = new Date(from);
    const day = d.getDay();
    if (day === 5) d.setDate(d.getDate() + 3); // Fri → Mon
    else if (day === 6) d.setDate(d.getDate() + 2); // Sat → Mon
    else d.setDate(d.getDate() + 1); // next day
    return d;
}

function getTodayOrNextWeekday() {
    const now = new Date();
    const day = now.getDay();
    // If weekend, return next Monday
    if (day === 0) { now.setDate(now.getDate() + 1); return now; }
    if (day === 6) { now.setDate(now.getDate() + 2); return now; }
    return now;
}

function isWeekend(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    return day === 0 || day === 6;
}

function checkDeadline(dateStr) {
    const now = new Date();
    const target = new Date(dateStr + 'T00:00:00');
    const day = target.getDay();

    // Previous working day at 15:00
    let deadline = new Date(target);
    if (day === 1) {
        // Monday → deadline is Friday 15:00
        deadline.setDate(deadline.getDate() - 3);
    } else {
        deadline.setDate(deadline.getDate() - 1);
    }
    deadline.setHours(CONFIG.CUTOFF_HOUR, CONFIG.CUTOFF_MINUTE, 0, 0);

    return now > deadline;
}

function showToast(message, type = '') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast' + (type ? ' toast-' + type : '');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

let loadingCount = 0;

function showLoading(emoji, text) {
    loadingCount++;
    document.getElementById('loEmoji').textContent = emoji;
    document.getElementById('loText').textContent = text;
    document.getElementById('loadingOverlay').classList.add('show');
}

function hideLoading() {
    loadingCount--;
    if (loadingCount <= 0) {
        loadingCount = 0;
        document.getElementById('loadingOverlay').classList.remove('show');
    }
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

// ---- Toggle Meal ----
function toggleMeal(el) {
    const cb = el.querySelector('input[type="checkbox"]');
    cb.checked = !cb.checked;
    if (cb.checked) {
        el.classList.add('checked');
    } else {
        el.classList.remove('checked');
    }
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('dateInput');

    // Set default date
    const defaultDate = getTodayOrNextWeekday();
    dateInput.value = formatDate(defaultDate);

    // Event listeners
    dateInput.addEventListener('change', onDateChange);

    // Init date display
    initDateDisplay('dateInput', 'dateInputDisplay');

    // Load employees from local JSON
    loadEmployees();
    // Trigger initial load
    onDateChange();
});

let depts = [];
let currentPickerDept = null;

async function loadEmployees() {
    showLoading('👨‍💼', 'Chờ chút bạn iưuưu~\nĐang tải danh sách nhân viên...');
    try {
        const resp = await fetch('data/employees.json');
        employees = await resp.json();

        // Cache departments
        depts = [...new Set(employees.map(e => e.department))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi'));

        renderPickerList();
    } catch (e) {
        console.error('Failed to load employees:', e);
        showToast('Không thể tải danh sách nhân viên', 'error');
    } finally {
        hideLoading();
    }
}

function getInitials(name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
}

function removeAccents(str) {
    if (!str) return '';
    return str.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
}
function renderPickerList() {
    const container = document.getElementById('empList');
    const query = document.getElementById('empSearchInput').value.toLowerCase().trim();

    container.innerHTML = '';

    if (query) {
        // Global search view
        document.getElementById('empModalTitle').textContent = '🔍 Kết quả tìm kiếm';
        document.getElementById('empModalBack').style.display = 'none';

        const queryClean = removeAccents(query);
        const filtered = employees.filter(emp => {
            const nameClean = removeAccents(emp.name.toLowerCase());
            const deptClean = removeAccents((emp.department || '').toLowerCase());
            return nameClean.includes(queryClean) || deptClean.includes(queryClean);
        });

        renderEmployees(filtered, container);
        document.getElementById('empCount').textContent = filtered.length + ' kết quả';

    } else if (currentPickerDept) {
        // Department Drill-down view
        document.getElementById('empModalTitle').textContent = currentPickerDept;
        document.getElementById('empModalBack').style.display = 'block';

        const filtered = employees.filter(emp => emp.department === currentPickerDept);
        renderEmployees(filtered, container);
        document.getElementById('empCount').textContent = filtered.length + ' nhân viên';

    } else {
        // Departments view
        document.getElementById('empModalTitle').textContent = '🏢 Chọn phòng ban';
        document.getElementById('empModalBack').style.display = 'none';

        depts.forEach(dept => {
            const count = employees.filter(e => e.department === dept).length;
            const row = document.createElement('div');
            row.className = 'emp-row';
            row.onclick = () => {
                currentPickerDept = dept;
                document.getElementById('empSearchInput').value = '';
                renderPickerList();
            };
            row.innerHTML = `
                <div class="emp-avatar" style="background: var(--primary-100); color: var(--primary-600)">🏢</div>
                <div class="emp-info">
                    <div class="emp-name" style="white-space: normal; line-height: 1.3;">${dept}</div>
                    <div class="emp-dept">${count} nhân viên</div>
                </div>
                <div style="color: var(--gray-400); font-size: 1.4rem; padding-left: 8px;">›</div>
            `;
            container.appendChild(row);
        });
        document.getElementById('empCount').textContent = depts.length + ' phòng ban';
    }
}

function renderEmployees(list, container) {
    list.forEach(emp => {
        const row = document.createElement('div');
        row.className = 'emp-row';
        row.onclick = () => selectEmployee(emp);
        row.innerHTML = `
            <div class="emp-avatar">${getInitials(emp.name)}</div>
            <div class="emp-info">
                <div class="emp-name">${emp.name}</div>
                <div class="emp-dept">${emp.department}</div>
            </div>
        `;
        container.appendChild(row);
    });
}

function showDeptListView() {
    currentPickerDept = null;
    document.getElementById('empSearchInput').value = '';
    renderPickerList();
}

function openEmpPicker() {
    // Also remove the disabled styling hack from index.html if it still exists
    const pickerBtn = document.getElementById('empPickerBtn');
    pickerBtn.disabled = false;
    pickerBtn.style.opacity = '1';
    pickerBtn.style.cursor = 'pointer';

    document.getElementById('empModal').classList.add('show');
    document.getElementById('empSearchInput').value = '';
    currentPickerDept = null;
    renderPickerList();
    setTimeout(() => document.getElementById('empSearchInput').focus(), 300);
}

function closeEmpPicker() {
    document.getElementById('empModal').classList.remove('show');
}

function filterEmployees() {
    renderPickerList();
}

function selectEmployee(emp) {
    document.getElementById('employeeSelect').value = emp.name;
    const pickerBtn = document.getElementById('empPickerBtn');
    const pickerText = document.getElementById('empPickerText');
    pickerText.textContent = emp.name + ' — ' + emp.department;
    pickerBtn.classList.add('selected');

    closeEmpPicker();

    // Find department for this employee
    const found = employees.find(e => e.name === emp.name);
    if (found) {
        pickerBtn.dataset.department = found.department;
    }

    onSelectionChange();
}

function onDateChange() {
    const dateInput = document.getElementById('dateInput');
    const dateStr = dateInput.value;
    const deadlineAlert = document.getElementById('deadlineAlert');
    const menuCard = document.getElementById('menuCard');
    const mealCard = document.getElementById('mealCard');
    const deadlineInfo = document.getElementById('deadlineInfo');
    const btnRegister = document.getElementById('btnRegister');
    const existingAlert = document.getElementById('existingAlert');

    // Reset
    existingAlert.classList.add('hidden');
    isEditing = false;

    if (!dateStr) {
        menuCard.style.display = 'none';
        mealCard.style.display = 'none';
        deadlineInfo.style.display = 'none';
        btnRegister.style.display = 'none';
        deadlineAlert.classList.add('hidden');
        return;
    }

    // Weekend check
    if (isWeekend(dateStr)) {
        showToast('Không thể đăng ký vào cuối tuần', 'error');
        deadlineAlert.classList.add('hidden');
        menuCard.style.display = 'none';
        mealCard.style.display = 'none';
        deadlineInfo.style.display = 'none';
        btnRegister.style.display = 'none';
        return;
    }

    // Deadline check
    deadlinePassed = checkDeadline(dateStr);
    if (deadlinePassed) {
        deadlineAlert.classList.remove('hidden');
        // We still show the menu and allow if override is on (backend will handle)
    } else {
        deadlineAlert.classList.add('hidden');
    }

    // Show UI
    menuCard.style.display = '';
    mealCard.style.display = '';
    deadlineInfo.style.display = '';
    btnRegister.style.display = '';

    // Load menu
    loadMenu(dateStr);

    // Check existing registration
    onSelectionChange();
}

async function loadMenu(dateStr) {
    showLoading('🍽️', 'Chờ chút bạn iưuưu~\nĐang load menu đồ á!');
    try {
        const data = await apiGet('menu', { date: dateStr });
        if (data.status === 'ok' && data.data) {
            currentMenu = data.data;
            document.getElementById('menuBreakfast').textContent = data.data.breakfast || '—';
            document.getElementById('menuLunch').textContent = data.data.lunch || '—';
            document.getElementById('mealBreakfastName').textContent = data.data.breakfast || '—';
            document.getElementById('mealLunchName').textContent = data.data.lunch || '—';
        } else {
            currentMenu = null;
            document.getElementById('menuBreakfast').textContent = 'Chưa có thực đơn';
            document.getElementById('menuLunch').textContent = 'Chưa có thực đơn';
            document.getElementById('mealBreakfastName').textContent = 'Chưa có thực đơn';
            document.getElementById('mealLunchName').textContent = 'Chưa có thực đơn';
        }
    } catch (e) {
        console.error('Failed to load menu:', e);
    } finally {
        hideLoading();
    }
}

async function onSelectionChange() {
    const employee = document.getElementById('employeeSelect').value;
    const dateStr = document.getElementById('dateInput').value;
    const existingAlert = document.getElementById('existingAlert');
    const btnText = document.getElementById('btnText');

    if (!employee || !dateStr) return;

    showLoading('⏳', 'Chờ chút bạn iưuưu~\nĐang kiểm tra dữ liệu đăng ký...');

    // Check existing registration
    try {
        const data = await apiGet('registrations', { date: dateStr });
        if (data.status === 'ok') {
            const existing = data.data.find(r => r.employee === employee);
            if (existing) {
                isEditing = true;
                existingAlert.classList.remove('hidden');
                btnText.textContent = '💾 CẬP NHẬT';
                document.getElementById('btnCancel').style.display = 'inline-block';

                // Set checkboxes
                const cbBreakfast = document.getElementById('cbBreakfast');
                const cbLunch = document.getElementById('cbLunch');
                const breakfastCheck = document.getElementById('breakfastCheck');
                const lunchCheck = document.getElementById('lunchCheck');

                cbBreakfast.checked = existing.breakfast === 'yes';
                cbLunch.checked = existing.lunch === 'yes';

                if (cbBreakfast.checked) breakfastCheck.classList.add('checked');
                else breakfastCheck.classList.remove('checked');

                if (cbLunch.checked) lunchCheck.classList.add('checked');
                else lunchCheck.classList.remove('checked');

            } else {
                isEditing = false;
                existingAlert.classList.add('hidden');
                btnText.textContent = '✅ ĐĂNG KÝ';
                document.getElementById('btnCancel').style.display = 'none';

                // Reset checkboxes
                document.getElementById('cbBreakfast').checked = false;
                document.getElementById('cbLunch').checked = false;
                document.getElementById('breakfastCheck').classList.remove('checked');
                document.getElementById('lunchCheck').classList.remove('checked');
            }
        }
    } catch (e) {
        console.error('Failed to check existing registration:', e);
    } finally {
        hideLoading();
    }
}

async function submitRegistration() {
    const employee = document.getElementById('employeeSelect').value;
    const dateStr = document.getElementById('dateInput').value;
    const breakfast = document.getElementById('cbBreakfast').checked;
    const lunch = document.getElementById('cbLunch').checked;

    if (!employee) {
        showToast('Vui lòng chọn nhân viên', 'error');
        return;
    }
    if (!dateStr) {
        showToast('Vui lòng chọn ngày', 'error');
        return;
    }
    if (!breakfast && !lunch) {
        showToast('Vui lòng chọn ít nhất một bữa ăn', 'error');
        return;
    }

    const btn = document.getElementById('btnRegister');
    const btnText = document.getElementById('btnText');
    const spinner = document.getElementById('btnSpinner');

    btn.disabled = true;
    btnText.classList.add('hidden');
    spinner.classList.remove('hidden');

    // Find department
    const emp = employees.find(e => e.name === employee);
    const department = emp ? emp.department : '';

    try {
        const result = await apiPost('register', {
            date: dateStr,
            employee: employee,
            department: department,
            breakfast: breakfast ? 'yes' : 'no',
            lunch: lunch ? 'yes' : 'no'
        });

        if (result.status === 'ok') {
            showToast(isEditing ? 'Đã cập nhật thành công!' : 'Đăng ký thành công!', 'success');
            isEditing = true;
            btnText.textContent = 'CẬP NHẬT';
            document.getElementById('existingAlert').classList.remove('hidden');
        } else {
            showToast(result.message || 'Đăng ký thất bại', 'error');
        }
    } catch (e) {
        console.error('Registration failed:', e);
        showToast('Lỗi kết nối. Vui lòng thử lại.', 'error');
    } finally {
        btn.disabled = false;
        btnText.classList.remove('hidden');
        spinner.classList.add('hidden');
    }
}

function showCancelConfirm() {
    const dateStr = document.getElementById('dateInput').value;
    if (!dateStr) return;

    document.getElementById('confirmMessage').innerHTML = `Bạn có chắc muốn hủy đăng ký suất ăn ngày <strong style="color:var(--danger-500)">${formatDateVN(dateStr)}</strong> không?`;
    document.getElementById('confirmModal').classList.add('show');

    // Bind the Yes button to cancelRegistration
    document.getElementById('confirmBtnYes').onclick = () => {
        closeConfirmModal();
        cancelRegistration();
    };
}

function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('show');
}

async function cancelRegistration() {
    const employee = document.getElementById('employeeSelect').value;
    const dateStr = document.getElementById('dateInput').value;

    if (!employee || !dateStr) return;

    const btn = document.getElementById('btnCancel');
    const btnText = document.getElementById('btnCancelText');
    const spinner = document.getElementById('btnCancelSpinner');

    btn.disabled = true;
    btnText.classList.add('hidden');
    spinner.classList.remove('hidden');
    showLoading('🗑️', 'Chờ chút bạn iưuưu~\nĐang hủy đăng ký...');

    try {
        const result = await apiPost('delete_registration', {
            date: dateStr,
            employee: employee
        });

        if (result.status === 'ok') {
            showToast('Đã hủy đăng ký thành công!', 'success');
            // Refresh state
            onSelectionChange();
        } else {
            showToast(result.message || 'Lỗi khi hủy đăng ký', 'error');
        }
    } catch (e) {
        console.error('Failed to cancel registration:', e);
        showToast('Lỗi kết nối', 'error');
    } finally {
        btn.disabled = false;
        btnText.classList.remove('hidden');
        spinner.classList.add('hidden');
        hideLoading();
    }
}
