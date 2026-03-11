// ============================================================
// CANTEEN MEAL REGISTRATION — GOOGLE APPS SCRIPT BACKEND
// ============================================================
// Deploy as Web App:
//   Execute as: Me
//   Who has access: Anyone (within organization) or Anyone
// ============================================================

// ---- Sheet Names ----
const SHEET_EMPLOYEES     = 'employees';
const SHEET_MENU          = 'menu';
const SHEET_REGISTRATIONS = 'registrations';
const SHEET_SETTINGS      = 'settings';

// ---- Cutoff Config ----
const CUTOFF_HOUR   = 15;
const CUTOFF_MINUTE = 0;

// ---- Utilities ----

function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSetting(key) {
  const sheet = getSheet(SHEET_SETTINGS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1];
  }
  return null;
}

function setSetting(key, value) {
  const sheet = getSheet(SHEET_SETTINGS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  // Add new setting
  sheet.appendRow([key, value]);
}

function verifyAdmin(key) {
  const adminKey = getSetting('admin_key');
  return key === String(adminKey);
}

function formatDateStr(date) {
  // Google Apps Script quirk: instanceof Date returns false for sheet Date objects
  // Use duck-typing check instead
  if (date && typeof date === 'object' && typeof date.getFullYear === 'function') {
    var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
    return Utilities.formatDate(date, tz, 'yyyy-MM-dd');
  }
  // If it's a string, try to normalize it
  var str = String(date).trim();
  // Handle dd/MM/yyyy format
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    var parts = str.split('/');
    return parts[2] + '-' + parts[1] + '-' + parts[0];
  }
  return str;
}

function isWeekend(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  return day === 0 || day === 6;
}

function isBeforeCutoff(dateStr) {
  const now = new Date();
  const target = new Date(dateStr + 'T00:00:00');
  const day = target.getDay();

  // Calculate deadline: previous working day at CUTOFF_HOUR:CUTOFF_MINUTE
  const deadline = new Date(target);
  if (day === 1) {
    // Monday → deadline is Friday
    deadline.setDate(deadline.getDate() - 3);
  } else {
    deadline.setDate(deadline.getDate() - 1);
  }
  deadline.setHours(CUTOFF_HOUR, CUTOFF_MINUTE, 0, 0);

  return now <= deadline;
}

function getWeekDates(weekStr) {
  // Parse "2026-W11"
  const parts = weekStr.split('-W');
  const year = parseInt(parts[0]);
  const week = parseInt(parts[1]);

  // Jan 4 is always in ISO week 1
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

// ============================================================
// GET HANDLER
// ============================================================

function doGet(e) {
  const action = e.parameter.action;

  try {
    switch (action) {
      case 'employees':
        return handleGetEmployees();
      case 'menu':
        return handleGetMenu(e.parameter.date, e.parameter.week);
      case 'registrations':
        return handleGetRegistrations(e.parameter.date, e.parameter.week);
      case 'summary':
        return handleGetSummary(e.parameter.week);
      case 'verify_admin':
        return handleVerifyAdmin(e.parameter.key);
      case 'settings':
        return handleGetSetting(e.parameter.key);
      case 'debug_menu':
        return handleDebugMenu();
      default:
        return jsonResponse({ status: 'error', message: 'Unknown action: ' + action });
    }
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

// ============================================================
// POST HANDLER
// ============================================================

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    switch (action) {
      case 'menu':
        return handleSaveMenu(body);
      case 'menu_batch':
        return handleSaveMenuBatch(body);
      case 'register':
        return handleRegister(body);
      case 'register_batch':
        return handleRegisterBatch(body);
      case 'override':
        return handleOverride(body);
      case 'delete_registration':
        return handleDeleteRegistration(body);
      default:
        return jsonResponse({ status: 'error', message: 'Unknown action: ' + action });
    }
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

// ============================================================
// HANDLERS
// ============================================================

// GET /employees
function handleGetEmployees() {
  const sheet = getSheet(SHEET_EMPLOYEES);
  const data = sheet.getDataRange().getValues();
  const employees = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      employees.push({
        id: data[i][0],
        name: data[i][1],
        department: data[i][2]
      });
    }
  }

  return jsonResponse({ status: 'ok', data: employees });
}

// GET /menu?date= OR /menu?week=
function handleGetMenu(date, week) {
  if (!date && !week) {
    return jsonResponse({ status: 'error', message: 'Date or week is required' });
  }

  const sheet = getSheet(SHEET_MENU);
  const data = sheet.getDataRange().getValues();

  if (week) {
    const weekDates = getWeekDates(week);
    const weeklyMenu = [];

    weekDates.forEach(d => {
      let found = false;
      for (let i = 1; i < data.length; i++) {
        if (formatDateStr(data[i][0]) === d) {
          weeklyMenu.push({
            date: d,
            breakfast: data[i][1] || '',
            lunch: data[i][2] || ''
          });
          found = true;
          break;
        }
      }
      if (!found) {
        weeklyMenu.push({ date: d, breakfast: '', lunch: '' });
      }
    });

    return jsonResponse({ status: 'ok', data: weeklyMenu });
  }

  // Single date fallback
  for (let i = 1; i < data.length; i++) {
    const rowDate = formatDateStr(data[i][0]);
    if (rowDate === date) {
      return jsonResponse({
        status: 'ok',
        data: {
          date: rowDate,
          breakfast: data[i][1],
          lunch: data[i][2]
        }
      });
    }
  }

  return jsonResponse({ status: 'ok', data: null });
}

// POST /menu (admin)
function handleSaveMenu(body) {
  if (!verifyAdmin(body.admin_key)) {
    return jsonResponse({ status: 'error', message: 'Invalid admin key' });
  }

  const date = body.date;
  const breakfast = body.breakfast || '';
  const lunch = body.lunch || '';

  if (!date) {
    return jsonResponse({ status: 'error', message: 'Date is required' });
  }

  const sheet = getSheet(SHEET_MENU);
  const data = sheet.getDataRange().getValues();

  // Check if menu exists for this date
  for (let i = 1; i < data.length; i++) {
    const rowDate = formatDateStr(data[i][0]);
    if (rowDate === date) {
      // Update existing
      sheet.getRange(i + 1, 2).setValue(breakfast);
      sheet.getRange(i + 1, 3).setValue(lunch);
      return jsonResponse({ status: 'ok', message: 'Menu updated' });
    }
  }

  // Add new menu
  sheet.appendRow([date, breakfast, lunch]);
  return jsonResponse({ status: 'ok', message: 'Menu created' });
}

// POST /menu_batch (admin)
function handleSaveMenuBatch(body) {
  if (!verifyAdmin(body.admin_key)) {
    return jsonResponse({ status: 'error', message: 'Invalid admin key' });
  }

  const menus = body.menus; // Array of {date, breakfast, lunch}
  if (!menus || !Array.isArray(menus)) {
    return jsonResponse({ status: 'error', message: 'Menus array is required' });
  }

  const sheet = getSheet(SHEET_MENU);
  const data = sheet.getDataRange().getValues();

  menus.forEach(menuItem => {
    const date = menuItem.date;
    const breakfast = menuItem.breakfast || '';
    const lunch = menuItem.lunch || '';

    if (!date) return;

    let found = false;
    // Keep it simple: loop over to find
    for (let i = 1; i < data.length; i++) {
      if (formatDateStr(data[i][0]) === date) {
        sheet.getRange(i + 1, 2).setValue(breakfast);
        sheet.getRange(i + 1, 3).setValue(lunch);
        found = true;
        break;
      }
    }

    if (!found) {
      sheet.appendRow([date, breakfast, lunch]);
      // Update our local data array length reference safely by pushing a dummy row
      data.push([date, breakfast, lunch]);
    }
  });

  return jsonResponse({ status: 'ok', message: 'Weekly menu saved successfully' });
}

// POST /register
function handleRegister(body) {
  const { date, employee, department, breakfast, lunch } = body;

  // Validate required fields
  if (!date || !employee) {
    return jsonResponse({ status: 'error', message: 'Date and employee are required' });
  }

  // Validate weekend
  if (isWeekend(date)) {
    return jsonResponse({ status: 'error', message: 'Cannot register on weekends' });
  }

  // Validate cutoff
  const overrideCutoff = getSetting('override_cutoff');
  if (overrideCutoff !== 'true' && !isBeforeCutoff(date)) {
    return jsonResponse({
      status: 'error',
      message: 'Đã quá hạn đăng ký. Hạn chót là 15:00 ngày hôm trước.'
    });
  }

  const sheet = getSheet(SHEET_REGISTRATIONS);
  const data = sheet.getDataRange().getValues();

  // Check existing registration
  for (let i = 1; i < data.length; i++) {
    const rowDate = formatDateStr(data[i][0]);
    if (rowDate === date && data[i][1] === employee) {
      // Update existing registration
      sheet.getRange(i + 1, 3).setValue(department);
      sheet.getRange(i + 1, 4).setValue(breakfast || 'no');
      sheet.getRange(i + 1, 5).setValue(lunch || 'no');
      sheet.getRange(i + 1, 6).setValue(new Date());
      return jsonResponse({ status: 'ok', message: 'Registration updated' });
    }
  }

  // New registration
  sheet.appendRow([
    date,
    employee,
    department,
    breakfast || 'no',
    lunch || 'no',
    new Date()
  ]);

  return jsonResponse({ status: 'ok', message: 'Registration created' });
}

// POST /register_batch
function handleRegisterBatch(body) {
  const { employee, department, registrations } = body;

  // Validate required fields
  if (!employee || !department || !Array.isArray(registrations)) {
    return jsonResponse({ status: 'error', message: 'Employee, department and registrations array are required' });
  }

  const sheet = getSheet(SHEET_REGISTRATIONS);
  const data = sheet.getDataRange().getValues();
  const overrideCutoff = getSetting('override_cutoff');

  let successCount = 0;
  let skipCount = 0;

  registrations.forEach(reg => {
    const date = reg.date;
    const breakfast = reg.breakfast || 'no';
    const lunch = reg.lunch || 'no';

    if (!date) return;
    if (isWeekend(date)) return;

    // Cutoff validation per day
    if (overrideCutoff !== 'true' && !isBeforeCutoff(date)) {
      skipCount++;
      return; // Skip this day
    }

    let found = false;
    for (let i = 1; i < data.length; i++) {
      if (formatDateStr(data[i][0]) === date && data[i][1] === employee) {
        // Update
        sheet.getRange(i + 1, 3).setValue(department);
        sheet.getRange(i + 1, 4).setValue(breakfast);
        sheet.getRange(i + 1, 5).setValue(lunch);
        sheet.getRange(i + 1, 6).setValue(new Date());
        found = true;
        successCount++;
        break;
      }
    }

    if (!found) {
      sheet.appendRow([date, employee, department, breakfast, lunch, new Date()]);
      // Update local data array so we don't accidentally add duplicates in same batch if duplicate submitted (unlikely but safe)
      data.push([date, employee, department, breakfast, lunch, new Date()]);
      successCount++;
    }
  });

  return jsonResponse({
    status: 'ok',
    message: `Thành công ${successCount} ngày. Bỏ qua ${skipCount} ngày.`,
    successCount,
    skipCount
  });
}

// GET /registrations?date= OR ?week=
function handleGetRegistrations(date, week) {
  if (!date && !week) {
    return jsonResponse({ status: 'error', message: 'Date or week is required' });
  }

  const sheet = getSheet(SHEET_REGISTRATIONS);
  const data = sheet.getDataRange().getValues();
  const registrations = [];
  
  let targetDates = [];
  if (week) {
    targetDates = getWeekDates(week);
  } else {
    targetDates = [date];
  }

  for (let i = 1; i < data.length; i++) {
    const rowDate = formatDateStr(data[i][0]);
    if (targetDates.includes(rowDate)) {
      registrations.push({
        date: rowDate,
        employee: data[i][1],
        department: data[i][2],
        breakfast: data[i][3],
        lunch: data[i][4],
        created_at: data[i][5]
      });
    }
  }

  return jsonResponse({ status: 'ok', data: registrations });
}

// GET /summary?week=
function handleGetSummary(week) {
  if (!week) {
    return jsonResponse({ status: 'error', message: 'Week is required (e.g. 2026-W11)' });
  }

  const weekDates = getWeekDates(week);
  const sheet = getSheet(SHEET_REGISTRATIONS);
  const data = sheet.getDataRange().getValues();

  const summary = {};
  weekDates.forEach(d => {
    summary[d] = { breakfast: 0, lunch: 0 };
  });

  for (let i = 1; i < data.length; i++) {
    const rowDate = formatDateStr(data[i][0]);
    if (summary[rowDate] !== undefined) {
      if (data[i][3] === 'yes') summary[rowDate].breakfast++;
      if (data[i][4] === 'yes') summary[rowDate].lunch++;
    }
  }

  return jsonResponse({ status: 'ok', data: summary });
}

// GET /verify_admin?key=
function handleVerifyAdmin(key) {
  if (verifyAdmin(key)) {
    return jsonResponse({ status: 'ok' });
  }
  return jsonResponse({ status: 'error', message: 'Invalid admin key' });
}

// GET /settings?key=
function handleGetSetting(key) {
  const value = getSetting(key);
  return jsonResponse({ status: 'ok', data: { key, value: String(value) } });
}

// POST /override (admin)
function handleOverride(body) {
  if (!verifyAdmin(body.admin_key)) {
    return jsonResponse({ status: 'error', message: 'Invalid admin key' });
  }

  const value = body.value === 'true' ? 'true' : 'false';
  setSetting('override_cutoff', value);
  return jsonResponse({ status: 'ok', message: 'Override cutoff set to ' + value });
}

// POST /delete_registration
function handleDeleteRegistration(body) {
  var date = body.date;
  var employee = body.employee;

  if (!date || !employee) {
    return jsonResponse({ status: 'error', message: 'Date and employee are required' });
  }

  var sheet = getSheet(SHEET_REGISTRATIONS);
  var data = sheet.getDataRange().getValues();

  for (var i = data.length - 1; i >= 1; i--) {
    var rowDate = formatDateStr(data[i][0]);
    if (rowDate === date && data[i][1] === employee) {
      sheet.deleteRow(i + 1);
      return jsonResponse({ status: 'ok', message: 'Registration deleted' });
    }
  }

  return jsonResponse({ status: 'error', message: 'Registration not found' });
}

// DEBUG: inspect raw menu data
function handleDebugMenu() {
  var sheet = getSheet(SHEET_MENU);
  var data = sheet.getDataRange().getValues();
  var tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  var rows = [];

  for (var i = 0; i < data.length; i++) {
    var raw = data[i][0];
    var isDateObj = raw && typeof raw === 'object' && typeof raw.getFullYear === 'function';
    rows.push({
      row: i,
      raw_value: String(raw),
      type: typeof raw,
      is_date: isDateObj,
      formatted: isDateObj ? Utilities.formatDate(raw, tz, 'yyyy-MM-dd') : String(raw),
      breakfast: data[i][1],
      lunch: data[i][2]
    });
  }

  return jsonResponse({ status: 'ok', timezone: tz, data: rows });
}
