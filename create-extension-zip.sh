#!/bin/bash

# Script để tạo file zip cho AI Screen Crop Extension
echo "🔧 Đang tạo file zip cho AI Screen Crop Extension..."

# Xóa file zip cũ nếu có
if [ -f "ai-screen-crop-extension.zip" ]; then
    rm "ai-screen-crop-extension.zip"
    echo "✅ Đã xóa file zip cũ"
fi

# Tạo file zip mới với các file cần thiết
zip -r ai-screen-crop-extension.zip manifest.json popup.html popup.js background.js content.js content.css icon/ libs/ -x "*.md" "*.git*"

# Kiểm tra kết quả
if [ -f "ai-screen-crop-extension.zip" ]; then
    echo "✅ Tạo file zip thành công!"
    echo "📦 File: ai-screen-crop-extension.zip"
    echo "📏 Kích thước: $(du -h ai-screen-crop-extension.zip | cut -f1)"
    echo ""
    echo "🚀 Cách sử dụng:"
    echo "1. Giải nén file ai-screen-crop-extension.zip"
    echo "2. Mở Chrome → chrome://extensions/"
    echo "3. Bật Developer mode"
    echo "4. Nhấn 'Load unpacked' → Chọn thư mục đã giải nén"
    echo "5. Extension sẵn sàng sử dụng!"
    echo ""
    echo "📋 Tính năng đã cập nhật:"
    echo "   ✅ Hiển thị preview ảnh crop"
    echo "   ✅ Textbox nhập prompt tùy chỉnh"
    echo "   ✅ Khung kết quả có tổ chức"
    echo "   ✅ Nút Restart extension"
else
    echo "❌ Lỗi: Không thể tạo file zip"
    exit 1
fi