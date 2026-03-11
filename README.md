# 🍽️ Hệ Thống Đăng Ký Suất Ăn Căn Tin

Ứng dụng web mobile-first giúp nhân viên đăng ký suất ăn tại căn tin công ty.

## Mục Lục

- [Cấu trúc dự án](#cấu-trúc-dự-án)
- [Hướng dẫn cài đặt](#hướng-dẫn-cài-đặt)
- [Cấu trúc Google Sheets](#cấu-trúc-google-sheets)
- [Triển khai Apps Script](#triển-khai-apps-script)
- [Kết nối Frontend](#kết-nối-frontend)

---

## Cấu Trúc Dự Án

```
├── index.html            # Trang đăng ký suất ăn (nhân viên)
├── admin.html            # Trang quản trị
├── registrations.html    # Trang danh sách đăng ký
├── statistics.html       # Trang thống kê tuần
├── css/
│   └── style.css         # CSS chung
├── js/
│   ├── config.js         # Cấu hình API URL
│   ├── app.js            # Logic trang đăng ký
│   ├── admin.js          # Logic trang admin
│   ├── registrations.js  # Logic danh sách
│   └── statistics.js     # Logic thống kê
├── backend/
│   └── Code.gs           # Google Apps Script backend
└── README.md
```

---

## Hướng Dẫn Cài Đặt

### Bước 1: Tạo Google Sheets

1. Truy cập [Google Sheets](https://sheets.google.com) và tạo bảng tính mới.
2. Đặt tên: **"Canteen Registration"**
3. Tạo **4 sheet** như hướng dẫn bên dưới.

### Bước 2: Thiết lập Google Sheets

Xem phần [Cấu trúc Google Sheets](#cấu-trúc-google-sheets).

### Bước 3: Triển khai Apps Script

Xem phần [Triển khai Apps Script](#triển-khai-apps-script).

### Bước 4: Kết nối Frontend

Xem phần [Kết nối Frontend](#kết-nối-frontend).

---

## Cấu Trúc Google Sheets

### Sheet 1: `employees`

| Cột | Mô tả |
|---|---|
| id | Mã nhân viên |
| name | Tên nhân viên |
| department | Phòng ban |

**Dữ liệu mẫu:**

| id | name | department |
|---|---|---|
| 1 | Nguyen Van A | IT |
| 2 | Tran Thi B | HR |
| 3 | Le Van C | Finance |

### Sheet 2: `menu`

| Cột | Mô tả |
|---|---|
| date | Ngày (YYYY-MM-DD) |
| breakfast | Thực đơn bữa sáng |
| lunch | Thực đơn bữa trưa |

**Dữ liệu mẫu:**

| date | breakfast | lunch |
|---|---|---|
| 2026-03-12 | Bún Bò | Cá Kho |
| 2026-03-13 | Phở Gà | Sườn Ram |

### Sheet 3: `registrations`

| Cột | Mô tả |
|---|---|
| date | Ngày đăng ký |
| employee | Tên nhân viên |
| department | Phòng ban |
| breakfast | yes / no |
| lunch | yes / no |
| created_at | Thời gian tạo |

### Sheet 4: `settings`

| Cột | Mô tả |
|---|---|
| key | Tên cài đặt |
| value | Giá trị |

**Dữ liệu bắt buộc:**

| key | value |
|---|---|
| admin_key | abc123 |
| override_cutoff | false |

> ⚠️ **Quan trọng:** Hãy thay đổi `admin_key` thành giá trị bí mật của bạn!

---

## Triển Khai Apps Script

### Bước 1: Mở Apps Script

1. Mở file Google Sheets vừa tạo
2. Vào **Tiện ích mở rộng → Apps Script**

### Bước 2: Thêm Code

1. Xóa nội dung mặc định trong file `Code.gs`
2. Copy toàn bộ nội dung file `backend/Code.gs` và paste vào

### Bước 3: Deploy

1. Click **Triển khai → Triển khai mới**
2. Loại: Chọn **Ứng dụng web (Web app)**
3. Cấu hình:
   - **Mô tả**: Canteen Registration API
   - **Thực thi với tư cách**: Tôi (Me)
   - **Ai có quyền truy cập**: Bất kỳ ai (Anyone)
4. Click **Triển khai**
5. **Sao chép URL** được tạo ra (dạng: `https://script.google.com/macros/s/.../exec`)

> 💡 Mỗi khi chỉnh sửa `Code.gs`, bạn cần tạo phiên bản triển khai mới để thay đổi có hiệu lực.

---

## Kết Nối Frontend

1. Mở file `js/config.js`
2. Thay thế `YOUR_DEPLOYMENT_ID` bằng URL bạn vừa sao chép:

```javascript
const CONFIG = {
  API_BASE_URL: 'https://script.google.com/macros/s/YOUR_ACTUAL_DEPLOYMENT_ID/exec',
  CUTOFF_HOUR: 15,
  CUTOFF_MINUTE: 0,
};
```

3. Mở `index.html` trong trình duyệt hoặc deploy lên hosting tĩnh (GitHub Pages, Netlify, v.v.)

---

## Truy Cập Admin

Truy cập trang Admin bằng 2 cách:

1. **Qua URL**: `admin.html?key=YOUR_ADMIN_KEY`
2. **Nhập key**: Mở `admin.html` và nhập Admin Key tại giao diện

---

## Quy Tắc Hệ Thống

| Quy tắc | Chi tiết |
|---|---|
| Hạn chót | 15:00 ngày hôm trước |
| Ngày đăng ký | Thứ 2 → Thứ 6 |
| Cập nhật | Có thể sửa trước hạn chót |
| Override | Admin có thể bật/tắt bỏ qua hạn chót |
