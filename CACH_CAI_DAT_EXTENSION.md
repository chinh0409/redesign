# 📦 Cách Cài Đặt AI Screen Crop Extension

## 🎯 File Cần Thiết
- **`ai-screen-crop-extension.zip`** (đã được tạo sẵn)

## 🚀 Các Bước Cài Đặt

### Bước 1: Giải Nén File Zip
1. **Tải xuống** file `ai-screen-crop-extension.zip`
2. **Giải nén** file zip ra một thư mục (ví dụ: `ai-screen-crop-extension/`)
3. **Ghi nhớ** đường dẫn thư mục vừa giải nén

### Bước 2: Mở Chrome Extensions
1. Mở **Google Chrome**
2. Vào địa chỉ: `chrome://extensions/`
3. Hoặc **Menu** → **More tools** → **Extensions**

### Bước 3: Bật Developer Mode
1. Ở góc **phải trên**, bật **"Developer mode"**
2. Sẽ xuất hiện các nút mới: "Load unpacked", "Pack extension", "Update"

### Bước 4: Load Extension
1. Nhấn nút **"Load unpacked"**
2. **Chọn thư mục** đã giải nén ở Bước 1
3. Nhấn **"Select Folder"** hoặc **"Open"**

### Bước 5: Kiểm Tra
1. Extension sẽ xuất hiện trong danh sách
2. Đảm bảo **toggle switch** đang bật (màu xanh)
3. Kiểm tra **icon extension** trên thanh toolbar

## ✅ Hoàn Thành!

- Extension đã sẵn sàng sử dụng
- Icon 🖼️ sẽ xuất hiện trên thanh công cụ Chrome
- Nhấn vào icon để mở popup interface

## 🔧 Troubleshooting

### **Nếu không load được:**
- Kiểm tra thư mục có đầy đủ files không
- Đảm bảo file `manifest.json` có trong thư mục
- Thử tắt/bật lại extension

### **Nếu thiếu icon:**
- Kiểm tra thư mục `icon/` có đầy đủ files không
- Reload lại extension

### **Nếu không hoạt động:**
- Kiểm tra Console trong Developer Tools
- Thử restart Chrome
- Đảm bảo có kết nối internet (để gọi OpenAI API)

## 📋 Files Trong Extension

```
ai-screen-crop-extension/
├── manifest.json       # Cấu hình extension
├── popup.html         # Giao diện popup
├── popup.js           # Logic popup
├── background.js      # Service worker
├── content.js         # Script inject vào trang
├── content.css        # Style cho crop tool
├── icon/              # Icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── libs/              # Libraries
    └── html2canvas.min.js
```

## 🎉 Sẵn Sàng Sử Dụng!

Tham khảo file **`HUONG_DAN_SU_DUNG.md`** để biết cách sử dụng chi tiết.