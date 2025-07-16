# Khắc phục lỗi "Runtime error sending message: The message port closed before a response was received."

## Nguyên nhân của lỗi:

1. **Message port bị đóng**: Chrome extension message port bị đóng trước khi nhận được response
2. **Extension context invalidated**: Extension bị reload hoặc context bị vô hiệu hóa
3. **Timeout**: Message gửi quá lâu không nhận được phản hồi
4. **Background script không gửi response**: Background script không luôn gửi response cho các message

## Các thay đổi đã thực hiện:

### 1. Cải thiện `safeSendMessage` trong `content.js`:

- **Thêm retry mechanism**: Tự động retry tối đa 3 lần khi gặp lỗi recoverable
- **Promise-based approach**: Sử dụng Promise thay vì callback để xử lý timeout tốt hơn
- **Timeout handling**: Tự động timeout sau 5 giây
- **Error categorization**: Phân loại lỗi recoverable và non-recoverable

```javascript
// Retry logic cho các lỗi có thể khắc phục
if (retryCount < maxRetries && 
    (error.message.includes('port closed') || 
     error.message.includes('timeout') || 
     error.message.includes('context invalidated'))) {
    
    setTimeout(() => {
        safeSendMessage(message, callback, retryCount + 1);
    }, retryDelay * (retryCount + 1));
}
```

### 2. Cải thiện `background.js`:

- **Luôn gửi response**: Đảm bảo mọi message đều nhận được response
- **Timeout protection**: Thêm timeout cho screenshot capture
- **Better error handling**: Xử lý lỗi chi tiết hơn và log đầy đủ
- **Response cho tất cả actions**: Thêm response cho các action như `imageCropped`, `cropCancelled`

```javascript
// Đảm bảo luôn có response
if (request.action === 'imageCropped') {
    try {
        chrome.runtime.sendMessage(request).catch((error) => {
            console.log('Popup not available:', error?.message);
        });
        sendResponse({ success: true, forwarded: true });
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
    return true;
}
```

### 3. Cải thiện `popup.js`:

- **Safe message sending**: Thêm helper function `safeSendMessageFromPopup`
- **Content script verification**: Ping content script để verify nó đang hoạt động
- **Better response handling**: Gửi response cho tất cả incoming messages
- **Extension context checking**: Kiểm tra context trước khi gửi message

```javascript
function safeSendMessageFromPopup(tabId, message, options = {}) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('Message timeout'));
        }, options.timeout || 10000);
        // ... implementation
    });
}
```

### 4. Thêm ping mechanism:

- **Content script ping**: Popup có thể ping content script để verify
- **Responsive checking**: Kiểm tra content script có phản hồi không
- **Early error detection**: Phát hiện lỗi sớm hơn

```javascript
// Trong content.js
if (request.action === 'ping') {
    console.log('Received ping from popup');
    sendResponse({success: true, status: 'alive'});
}
```

## Kết quả:

1. **Giảm message port errors**: Retry mechanism và timeout handling
2. **Better error messages**: Log chi tiết hơn để debug
3. **Improved reliability**: Extension ổn định hơn khi network lag hoặc context issues
4. **Graceful degradation**: Xử lý lỗi một cách mềm mại hơn

## Cách test:

1. Reload extension nhiều lần while đang crop
2. Thử crop trên các trang web khác nhau
3. Test với network chậm
4. Kiểm tra console logs để đảm bảo không còn "port closed" errors

## Debug tips:

- Kiểm tra Chrome Developer Tools console (F12)
- Xem Extension service worker logs tại `chrome://extensions/`
- Enable "Developer mode" trong extensions để xem chi tiết hơn