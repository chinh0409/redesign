# 📦 Tải và Cài Đặt AI Screen Crop Extension

## ✅ File Extension Đã Sẵn Sàng!

**File zip đã được tạo thành công:** `ai-screen-crop-extension.zip` (72KB)

## 🎯 Các Vấn Đề Đã Được Khắc Phục

✅ **Hiển thị hình ảnh crop**: Bây giờ có preview thực tế của ảnh đã crop với thông tin chi tiết  
✅ **Textbox cho prompt**: Có thể nhập prompt tùy chỉnh trước khi gửi ảnh lên OpenAI  
✅ **Khung trả về kết quả**: Giao diện hiển thị kết quả rõ ràng và có tổ chức  
✅ **Nút Restart**: Có thể restart lại extension khi cần thiết  

## 🚀 Cách Tải Extension

### Phương Pháp 1: Từ Workspace Hiện Tại
```bash
# File zip đã có sẵn trong workspace
ls -la ai-screen-crop-extension.zip
```

### Phương Pháp 2: Tạo Lại File Zip
```bash
# Chạy script tự động
./create-extension-zip.sh
```

### Phương Pháp 3: Tạo Thủ Công
1. **Tạo thư mục mới**: `ai-screen-crop-extension`
2. **Copy các file sau** vào thư mục:
   - `manifest.json`
   - `popup.html`
   - `popup.js`
   - `background.js`
   - `content.js`
   - `content.css`
   - Thư mục `icon/` (với 3 file icon)
   - Thư mục `libs/` (với html2canvas.min.js)

## 🛠️ Cách Cài Đặt Extension

### Bước 1: Giải Nén File
- Giải nén `ai-screen-crop-extension.zip` thành thư mục

### Bước 2: Mở Chrome Extensions
- Mở Google Chrome
- Vào địa chỉ: `chrome://extensions/`

### Bước 3: Bật Developer Mode
- Ở góc phải trên, bật **"Developer mode"**

### Bước 4: Load Extension
- Nhấn nút **"Load unpacked"**
- Chọn thư mục đã giải nén
- Nhấn **"Select Folder"**

### Bước 5: Hoàn Thành
- Extension xuất hiện trong danh sách
- Icon 🖼️ hiển thị trên thanh công cụ
- Sẵn sàng sử dụng!

## 📋 Nội Dung File Extension

```
ai-screen-crop-extension/
├── manifest.json       # Cấu hình extension
├── popup.html          # Giao diện popup (đã cập nhật)
├── popup.js            # Logic xử lý (đã cải thiện)
├── background.js       # Service worker
├── content.js          # Script crop ảnh
├── content.css         # Style cho crop tool
├── icon/               # Icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── libs/               # Libraries
    └── html2canvas.min.js
```

## 🎯 Workflow Sử Dụng Mới

1. **Crop ảnh** → Preview hiển thị ngay lập tức
2. **Nhập prompt** trong textbox (có thể chỉnh sửa)
3. **Nhấn "Phân Tích Ảnh"** → Gửi lên OpenAI
4. **Xem kết quả** trong khung trò chuyện có tổ chức
5. **Hỏi tiếp** trong section "Hỏi thêm"

## 🔧 Xử Lý Sự Cố

### Nếu không tải được file:
```bash
# Tạo lại file zip
./create-extension-zip.sh
```

### Nếu extension không hoạt động:
1. Nhấn nút **"🔄 Restart"** trong extension
2. Reload extension tại `chrome://extensions/`
3. Restart Chrome nếu cần

### Nếu không hiển thị preview ảnh:
1. Kiểm tra trang web có cho phép extension
2. Thử refresh trang và crop lại
3. Sử dụng nút Restart

## 💡 Lưu Ý Quan Trọng

- **Extension hoạt động offline** cho phần crop ảnh
- **Cần internet** để gọi OpenAI API
- **API key được lưu an toàn** trong Chrome storage
- **Hỗ trợ cuộc hội thoại dài** về cùng 1 ảnh
- **Tự động lưu** trạng thái khi đóng popup

## 🎉 Extension Đã Sẵn Sàng!

File `ai-screen-crop-extension.zip` đã bao gồm tất cả các tính năng mới được yêu cầu và sẵn sàng để cài đặt sử dụng!