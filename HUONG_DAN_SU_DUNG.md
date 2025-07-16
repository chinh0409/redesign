# 🖼️ AI Screen Crop - Hướng Dẫn Sử Dụng

## 🎯 Tính Năng Mới Đã Cập Nhật

### ✅ **Đã khắc phục các vấn đề:**
1. **Hiển thị hình ảnh crop**: Bây giờ có preview thực tế của ảnh đã crop với thông tin chi tiết
2. **Textbox cho prompt**: Có thể nhập prompt tùy chỉnh trước khi gửi ảnh lên OpenAI
3. **Khung trả về kết quả**: Giao diện hiển thị kết quả rõ ràng và có tổ chức
4. **Nút Restart**: Có thể restart lại extension khi cần thiết

## 🚀 Cách Sử Dụng

### Bước 1: Chuẩn Bị
1. Nhập **OpenAI API Key** vào ô "OpenAI API Key"
2. API key sẽ được lưu tự động cho lần sử dụng sau

### Bước 2: Crop Ảnh
1. Nhấn nút **"📸 Crop Ảnh Từ Màn Hình"**
2. Trang web sẽ được chụp ảnh và hiển thị overlay
3. **Kéo chuột** để chọn vùng cần crop
4. **Nhấn ESC** để hủy nếu cần

### Bước 3: Xem Preview và Nhập Prompt
1. Sau khi crop thành công, **ảnh preview** sẽ hiển thị ngay lập tức
2. Thông tin ảnh (kích thước, dung lượng) được hiển thị dưới ảnh
3. Trong **textbox "Prompt cho AI"**, nhập câu hỏi hoặc yêu cầu:
   - Mặc định: "Hãy mô tả chi tiết những gì bạn nhìn thấy trong ảnh này."
   - Có thể sửa thành bất kỳ câu hỏi nào bạn muốn

### Bước 4: Phân Tích Ảnh
1. Nhấn nút **"🚀 Phân Tích Ảnh"**
2. Extension sẽ gửi ảnh + prompt lên OpenAI
3. Kết quả phân tích sẽ hiển thị trong **"💬 Kết quả phân tích"**

### Bước 5: Trò Chuyện Tiếp Tục
1. Sau khi có kết quả đầu tiên, phần **"✨ Hỏi thêm"** sẽ xuất hiện
2. Có thể đặt thêm câu hỏi về cùng ảnh đó
3. Nhấn **Enter** hoặc nút **"💬 Gửi Tin Nhắn"**

## 🛠️ Các Nút Chức Năng

### 🗑️ **Nút "Xóa"**
- Xóa cuộc hội thoại hiện tại
- Xóa ảnh đã crop
- Reset về trạng thái ban đầu
- **Lưu ý**: Sẽ hỏi xác nhận trước khi xóa

### 🔄 **Nút "Restart"** 
- Restart toàn bộ extension
- Xóa tất cả dữ liệu đã lưu
- Reload lại extension
- **Sử dụng khi**: Extension bị lỗi hoặc không hoạt động

## 📱 Giao Diện Các Phần

### 1. **📷 Ảnh đã crop**
- Hiển thị preview ảnh vừa crop
- Thông tin: Kích thước (pixel) và dung lượng (KB)

### 2. **💬 Prompt cho AI**
- Textbox để nhập câu hỏi ban đầu
- Có thể chỉnh sửa prompt mặc định
- Nút "🚀 Phân Tích Ảnh" để gửi

### 3. **💬 Kết quả phân tích**
- Hiển thị cuộc hội thoại với AI
- Phân biệt tin nhắn người dùng và AI
- Cuộn tự động xuống tin nhắn mới

### 4. **✨ Hỏi thêm**
- Textbox để đặt câu hỏi tiếp theo
- Nhấn Enter hoặc nút gửi để hỏi thêm

## 🔧 Xử Lý Lỗi

### **Nếu không hiển thị được ảnh crop:**
1. Thử refresh trang web và crop lại
2. Kiểm tra trang web có cho phép extension không
3. Nhấn nút **"🔄 Restart"** để reset extension

### **Nếu OpenAI không phản hồi:**
1. Kiểm tra API key có đúng không
2. Kiểm tra kết nối internet
3. Thử lại sau vài phút

### **Nếu extension bị lỗi:**
1. Nhấn nút **"🔄 Restart"**
2. Nếu vẫn lỗi, vào `chrome://extensions/` và reload extension
3. Khởi động lại trình duyệt nếu cần

## 💡 Mẹo Sử Dụng

### **Crop Ảnh Hiệu Quả:**
- Chọn vùng có nội dung rõ ràng
- Tránh crop quá nhỏ (khó đọc)
- Tránh crop quá lớn (tốn dung lượng)

### **Viết Prompt Tốt:**
- Càng cụ thể càng tốt
- Ví dụ: "Hãy đọc và giải thích code trong ảnh này"
- Ví dụ: "Phân tích UI/UX của giao diện này"
- Ví dụ: "Tìm và sửa lỗi trong đoạn code"

### **Hỏi Tiếp Hiệu Quả:**
- "Giải thích chi tiết hơn phần [X]"
- "Có thể cải thiện gì không?"
- "Hãy viết code tương tự"

## 📝 Lưu Ý Quan Trọng

1. **Dữ liệu được lưu tự động** - không lo mất dữ liệu khi đóng popup
2. **API key được mã hóa** - lưu trữ an toàn trong Chrome
3. **Chỉ crop được trên các trang web thường** - không hoạt động trên trang chrome:// 
4. **Hỗ trợ nhiều định dạng ảnh** - PNG với chất lượng cao
5. **Hỗ trợ cuộc hội thoại dài** - có thể hỏi nhiều câu về cùng 1 ảnh

## 🆘 Hỗ Trợ

Nếu gặp vấn đề không thể giải quyết:
1. Nhấn **"🔄 Restart"** 
2. Vào `chrome://extensions/`
3. Tìm "AI Screen Crop" 
4. Nhấn nút reload (🔄)
5. Khởi động lại Chrome nếu cần

---

🎉 **Chúc bạn sử dụng extension hiệu quả!**