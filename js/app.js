// ============================================
// CANTEEN REGISTRATION — EMPLOYEE PAGE LOGIC
// ============================================

let employees = [];
let currentMenu = null;
let isEditing = false;
let deadlinePassed = false;

// ---- Helpers ----
function formatDate(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

function getCurrentWeek() {
    const now = new Date();
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
    const weekInput = document.getElementById('weekInput');

    // Set default week
    weekInput.value = getCurrentWeek();

    // Event listeners
    weekInput.addEventListener('change', onWeekChange);

    // Load employees from local JSON
    loadEmployees();

    // Trigger initial load
    onWeekChange();
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

    onWeekChange();
}

function onWeekChange() {
    const weekInput = document.getElementById('weekInput');
    const weekStr = weekInput.value;
    const employee = document.getElementById('employeeSelect').value;
    const calendarCard = document.getElementById('calendarCard');
    const deadlineInfo = document.getElementById('deadlineInfo');
    const btnRegister = document.getElementById('btnRegister');

    if (!weekStr) {
        if (calendarCard) calendarCard.style.display = 'none';
        if (deadlineInfo) deadlineInfo.style.display = 'none';
        if (btnRegister) btnRegister.style.display = 'none';
        return;
    }

    if (employee) {
        loadWeeklyMenuAndReg(weekStr, employee);
    }
}

const DAY_NAMES = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu'];

async function loadWeeklyMenuAndReg(weekStr, employee) {
    const calendarCard = document.getElementById('calendarCard');
    const deadlineInfo = document.getElementById('deadlineInfo');
    const btnRegister = document.getElementById('btnRegister');

    // Show UI containers
    calendarCard.style.display = '';
    deadlineInfo.style.display = '';
    btnRegister.style.display = '';

    showLoading('⏳', 'Chờ chút bạn iưuưu~\nĐang tải lịch tuần...');

    try {
        const [menuData, regData, overrideData] = await Promise.all([
            apiGet('menu', { week: weekStr }),
            apiGet('registrations', { week: weekStr }),
            apiGet('settings', { key: 'override_cutoff' })
        ]);

        const overrideCutoff = overrideData?.data?.value === 'true';

        if (menuData.status === 'ok' && menuData.data) {
            const weeklyMenu = menuData.data; // array of 5 days
            const allRegs = regData.status === 'ok' ? regData.data : [];
            const empRegs = allRegs.filter(r => r.employee === employee);

            renderWeeklyCalendar(weeklyMenu, empRegs, overrideCutoff);

            // Check if any existing regs
            const btnText = document.getElementById('btnText');
            if (empRegs.length > 0) {
                isEditing = true;
                btnText.textContent = '💾 CẬP NHẬT';
                document.getElementById('existingAlert').classList.remove('hidden');
            } else {
                isEditing = false;
                btnText.textContent = '✅ ĐĂNG KÝ';
                document.getElementById('existingAlert').classList.add('hidden');
            }
        }
    } catch (e) {
        console.error('Failed to load weekly data:', e);
        showToast('Lỗi kết nối', 'error');
    } finally {
        hideLoading();
    }
}

function renderWeeklyCalendar(weeklyMenu, empRegs, overrideCutoff) {
    const container = document.getElementById('weeklyCalendar');
    container.innerHTML = '';

    weeklyMenu.forEach((dayMenu, i) => {
        const dateStr = dayMenu.date;
        const reg = empRegs.find(r => r.date === dateStr);
        let isLocked = false;

        if (!overrideCutoff && checkDeadline(dateStr)) {
            isLocked = true;
        }

        const bChecked = (reg && reg.breakfast === 'yes') ? 'checked' : '';
        const lChecked = (reg && reg.lunch === 'yes') ? 'checked' : '';

        const block = document.createElement('div');
        block.className = 'day-block';

        const header = document.createElement('div');
        header.className = 'day-header ' + (isLocked ? 'disabled' : '');
        header.innerHTML = `
            <div class="day-header-left">
                <span>${DAY_NAMES[i]}</span>
            </div>
            <div class="day-header-right">
                <span>${formatDateVN(dateStr)}</span>
                ${isLocked ? '<span style="color:var(--danger-500)">🔒 Hết hạn</span>' : ''}
            </div>
        `;

        const meals = document.createElement('div');
        meals.className = 'day-meals';

        meals.innerHTML = `
            <label class="meal-check meal-breakfast ${bChecked} ${isLocked ? 'meal-disabled' : ''}" onclick="if(!${isLocked}) toggleMeal(this)">
              <input type="checkbox" class="cb-breakfast" value="${dateStr}" ${bChecked ? 'checked' : ''} ${isLocked ? 'disabled' : ''}>
              <div class="check-box"><svg viewBox="0 0 16 16"><polyline points="3.5 8.5 6.5 11.5 12.5 5.5"/></svg></div>
              <div class="meal-info">
                <div class="meal-type">🌅 Bữa sáng</div>
                <div class="meal-menu">${dayMenu.breakfast || '—'}</div>
              </div>
            </label>
            <label class="meal-check meal-lunch ${lChecked} ${isLocked ? 'meal-disabled' : ''}" onclick="if(!${isLocked}) toggleMeal(this)">
              <input type="checkbox" class="cb-lunch" value="${dateStr}" ${lChecked ? 'checked' : ''} ${isLocked ? 'disabled' : ''}>
              <div class="check-box"><svg viewBox="0 0 16 16"><polyline points="3.5 8.5 6.5 11.5 12.5 5.5"/></svg></div>
              <div class="meal-info">
                <div class="meal-type">☀️ Bữa trưa</div>
                <div class="meal-menu">${dayMenu.lunch || '—'}</div>
              </div>
            </label>
        `;

        block.appendChild(header);
        block.appendChild(meals);
        container.appendChild(block);
    });
}

function checkAll(type) {
    const checkboxes = document.querySelectorAll(type === 'breakfast' ? '.cb-breakfast:not(:disabled)' : '.cb-lunch:not(:disabled)');
    if (checkboxes.length === 0) return;

    let allChecked = true;
    checkboxes.forEach(cb => {
        if (!cb.checked) allChecked = false;
    });

    const newState = !allChecked;

    checkboxes.forEach(cb => {
        cb.checked = newState;
        if (newState) {
            cb.closest('.meal-check').classList.add('checked');
        } else {
            cb.closest('.meal-check').classList.remove('checked');
        }
    });
}

async function submitRegistration() {
    const employee = document.getElementById('employeeSelect').value;
    const pickerBtn = document.getElementById('empPickerBtn');
    const department = pickerBtn.dataset.department || '';

    if (!employee) {
        showToast('Vui lòng chọn nhân viên', 'error');
        return;
    }

    const regs = [];
    const blocks = document.querySelectorAll('.day-block');

    blocks.forEach(block => {
        const bCb = block.querySelector('.cb-breakfast');
        const lCb = block.querySelector('.cb-lunch');

        if (bCb && lCb) {
            // Only send changes if BOTH checkboxes are not disabled
            if (!bCb.disabled && !lCb.disabled) {
                regs.push({
                    date: bCb.value,
                    breakfast: bCb.checked ? 'yes' : 'no',
                    lunch: lCb.checked ? 'yes' : 'no'
                });
            }
        }
    });

    if (regs.length === 0) {
        showToast('Không có ngày nào hợp lệ để đăng ký', 'error');
        return;
    }

    const btn = document.getElementById('btnRegister');
    const btnText = document.getElementById('btnText');
    const spinner = document.getElementById('btnSpinner');

    btn.disabled = true;
    btnText.classList.add('hidden');
    spinner.classList.remove('hidden');
    showLoading('�', 'Chờ chút bạn iưuưu~\nĐang lưu đăng ký tuần...');

    try {
        const result = await apiPost('register_batch', {
            employee: employee,
            department: department,
            registrations: regs
        });

        if (result.status === 'ok') {
            showToast(result.message || 'Lưu thành công!', 'success');
            isEditing = true;
            btnText.textContent = '💾 CẬP NHẬT';
            document.getElementById('existingAlert').classList.remove('hidden');
        } else {
            showToast(result.message || 'Lưu thất bại', 'error');
        }
    } catch (e) {
        console.error('Registration failed:', e);
        showToast('Lỗi kết nối. Vui lòng thử lại.', 'error');
    } finally {
        btn.disabled = false;
        btnText.classList.remove('hidden');
        spinner.classList.add('hidden');
        hideLoading();
    }
}
