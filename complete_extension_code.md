# AI Screen Crop Extension - Code hoàn chỉnh

## Mô tả
Extension trình duyệt Chrome cho phép crop ảnh từ màn hình và phân tích bằng OpenAI GPT-4 Vision API.

## Cấu trúc thư mục
```
├── manifest.json           # Manifest của extension
├── background.js           # Background service worker
├── content.js             # Content script để crop ảnh
├── content.css            # Styles cho content script
├── popup.html             # Giao diện popup
├── popup.js               # Logic cho popup
├── icon/                  # Thư mục icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── libs/                  # Thư mục thư viện
    └── html2canvas.min.js
```

## Code chi tiết từng file

### 1. manifest.json
```json
{
    "manifest_version": 3,
    "name": "AI Screen Crop",
    "version": "1.0",
    "description": "Crop images from screen and process with OpenAI",
    "permissions": [
      "activeTab",
      "storage",
      "scripting",
      "tabs",
      "desktopCapture"
    ],
    "action": {
      "default_popup": "popup.html",
      "default_title": "AI Screen Crop"
    },
    "background": {
      "service_worker": "background.js"
    },
    "content_scripts": [
      {
        "matches": ["<all_urls>"],
        "js": ["content.js"],
        "css": ["content.css"]
      }
    ],
    "host_permissions": [
      "https://api.openai.com/*"
    ]
  }
```

### 2. background.js
```javascript
// Background script for handling screen capture and message passing
try {
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'takeScreenshot') {
            // Capture screenshot of current tab
            try {
                chrome.tabs.captureVisibleTab(null, {
                    format: 'png',
                    quality: 100
                }, function(dataUrl) {
                    if (chrome.runtime.lastError) {
                        console.error('Screenshot failed:', chrome.runtime.lastError);
                        sendResponse({
                            success: false,
                            error: chrome.runtime.lastError.message
                        });
                    } else if (!dataUrl) {
                        console.error('Screenshot failed: No data returned');
                        sendResponse({
                            success: false,
                            error: 'No screenshot data received'
                        });
                    } else {
                        console.log('Screenshot captured successfully');
                        sendResponse({
                            success: true,
                            dataUrl: dataUrl
                        });
                    }
                });
            } catch (error) {
                console.error('Error capturing screenshot:', error);
                sendResponse({
                    success: false,
                    error: error.message
                });
            }
            return true; // Keep the message channel open for async response
        } else if (request.action === 'imageCropped') {
            // Forward the message to popup if it's open
            try {
                chrome.runtime.sendMessage(request).catch(() => {
                    // Popup might not be open, that's okay
                    console.log('Popup not available to receive imageCropped message');
                });
            } catch (error) {
                console.warn('Error forwarding imageCropped message:', error.message);
            }
        } else if (request.action === 'cropCancelled') {
            // Forward the message to popup if it's open
            try {
                chrome.runtime.sendMessage(request).catch(() => {
                    // Popup might not be open, that's okay
                    console.log('Popup not available to receive cropCancelled message');
                });
            } catch (error) {
                console.warn('Error forwarding cropCancelled message:', error.message);
            }
        }
    });
} catch (error) {
    console.error('Error setting up background message listener:', error);
}

// Handle extension installation
chrome.runtime.onInstalled.addListener(function(details) {
    console.log('AI Screen Crop Extension installed');
});

// Handle extension startup
chrome.runtime.onStartup.addListener(function() {
    console.log('AI Screen Crop Extension started');
});
```

### 3. content.js
```javascript
// Prevent multiple injections
if (window.AI_SCREEN_CROP_INJECTED) {
    console.log('AI Screen Crop script already injected, skipping...');
} else {
    window.AI_SCREEN_CROP_INJECTED = true;
    console.log('AI Screen Crop content script initializing...');

let isSelecting = false;
let startX, startY, endX, endY;
let overlay = null;
let selectionBox = null;
let isProcessing = false;
let screenshotDataUrl = null;
let messageListener = null;

// Helper function to safely send messages to extension
function safeSendMessage(message, callback) {
    try {
        // Check if chrome runtime exists and is connected
        if (!chrome?.runtime?.id) {
            console.warn('Extension context invalidated - cannot send message:', message);
            return false;
        }
        
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                console.warn('Runtime error sending message:', chrome.runtime.lastError.message);
                // Don't call callback on error to prevent further issues
                return;
            }
            if (callback && response) {
                callback(response);
            }
        });
        return true;
    } catch (error) {
        console.warn('Error sending message:', error.message);
        return false;
    }
}

// Check if extension context is still valid
function isExtensionContextValid() {
    try {
        return !!(chrome?.runtime?.id);
    } catch (error) {
        return false;
    }
}

// Cleanup function to remove listeners and overlays
function cleanupExtensionResources() {
    console.log('Cleaning up extension resources...');
    
    // Remove message listener
    if (messageListener && chrome.runtime && chrome.runtime.onMessage) {
        try {
            chrome.runtime.onMessage.removeListener(messageListener);
            messageListener = null;
        } catch (error) {
            console.warn('Error removing message listener:', error);
        }
    }
    
    // Cleanup UI
    cleanup();
    
    // Reset variables
    isProcessing = false;
    screenshotDataUrl = null;
}

// Listen for messages from popup
window.addEventListener('message', function(event) {
    if (event.data.type === 'INIT_CROP_TOOL') {
        console.log('Received INIT_CROP_TOOL message');
        if (isExtensionContextValid()) {
            startScreenCapture();
        } else {
            console.warn('Extension context invalid, cannot start screen capture');
        }
    }
});

// Setup message listener from extension
function setupMessageListener() {
    if (!isExtensionContextValid()) {
        console.warn('Extension context invalid, cannot setup message listener');
        return;
    }
    
    // Remove existing listener if any
    if (messageListener) {
        try {
            chrome.runtime.onMessage.removeListener(messageListener);
        } catch (error) {
            console.warn('Error removing old message listener:', error);
        }
    }
    
    // Create new listener
    messageListener = (request, sender, sendResponse) => {
        console.log('Received message:', request.action);
        
        if (request.action === 'startCrop') {
            console.log('Received startCrop message from extension');
            if (isExtensionContextValid()) {
                startScreenCapture();
                sendResponse({success: true});
            } else {
                console.warn('Extension context invalid during startCrop');
                sendResponse({success: false, error: 'Extension context invalid'});
            }
        }
        return true; // Keep channel open for async response
    };
    
    try {
        chrome.runtime.onMessage.addListener(messageListener);
        console.log('Message listener setup successfully');
    } catch (error) {
        console.error('Error setting up message listener:', error);
        messageListener = null;
    }
}

// Initialize message listener
setupMessageListener();

// Listen for extension disconnect/reconnect
if (chrome.runtime && chrome.runtime.onConnect) {
    chrome.runtime.onConnect.addListener(() => {
        console.log('Extension reconnected, re-setting up message listener');
        setupMessageListener();
    });
}

function startScreenCapture() {
    if (isProcessing) {
        console.log('Already processing, ignoring request');
        return;
    }
    
    console.log('Starting screen capture...');
    isProcessing = true;
    showLoadingMessage('Đang chụp màn hình...');
    
    // Request screenshot from background script with timeout
    const timeoutId = setTimeout(() => {
        console.error('Screenshot timeout');
        hideLoadingMessage();
        isProcessing = false;
        safeSendMessage({action: 'cropCancelled'});
    }, 10000); // 10 second timeout

    safeSendMessage({action: 'takeScreenshot'}, (response) => {
        clearTimeout(timeoutId);
        
        if (!response || !response.success || !response.dataUrl) {
            console.error('Failed to get screenshot:', response);
            hideLoadingMessage();
            isProcessing = false;
            safeSendMessage({action: 'cropCancelled'});
            return;
        }
        
        console.log('Screenshot received, size:', response.dataUrl.length);
        screenshotDataUrl = response.dataUrl;
        hideLoadingMessage();
        initializeSelectionOverlay();
    });
}

let loadingMessage = null;

function showLoadingMessage(text) {
    if (loadingMessage) return;
    
    loadingMessage = document.createElement('div');
    loadingMessage.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 20px 30px;
        border-radius: 8px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 16px;
        font-weight: 500;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    `;
    loadingMessage.textContent = text;
    document.body.appendChild(loadingMessage);
}

function hideLoadingMessage() {
    if (loadingMessage && loadingMessage.parentNode) {
        loadingMessage.parentNode.removeChild(loadingMessage);
        loadingMessage = null;
    }
}

function initializeSelectionOverlay() {
    // Check if overlay already exists
    if (document.getElementById("cropperOverlay")) {
        console.log('Overlay already exists');
        return;
    }
    
    // Clean up any existing overlay
    cleanup();
    
    console.log('Creating selection overlay...');
    
    // Send message to popup that overlay is being created
    safeSendMessage({action: 'overlayCreating'});
    
    // Create overlay
    overlay = document.createElement('div');
    overlay.id = 'cropperOverlay';
    overlay.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        background: rgba(0, 0, 0, 0.4) !important;
        z-index: 2147483647 !important;
        cursor: crosshair !important;
        user-select: none !important;
        box-sizing: border-box !important;
    `;

    // Add screenshot image as background
    const img = new Image();
    img.onload = function() {
        console.log('Screenshot loaded successfully');
        img.style.cssText = `
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            pointer-events: none !important;
            object-fit: cover !important;
            opacity: 0.8 !important;
        `;
        overlay.appendChild(img);
    };
    img.onerror = function() {
        console.error('Failed to load screenshot');
        cancelSelection();
    };
    img.src = screenshotDataUrl;

    // Create instructions
    const instructions = document.createElement('div');
    instructions.style.cssText = `
        position: absolute !important;
        top: 20px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        background: rgba(0, 0, 0, 0.8) !important;
        color: white !important;
        padding: 12px 24px !important;
        border-radius: 6px !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        font-size: 14px !important;
        z-index: 2147483647 !important;
        pointer-events: none !important;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3) !important;
    `;
    instructions.textContent = 'Kéo để chọn vùng cần crop. Nhấn ESC để hủy.';

    // Create cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Hủy (ESC)';
    cancelBtn.style.cssText = `
        position: absolute !important;
        top: 20px !important;
        right: 20px !important;
        background: #ff4444 !important;
        color: white !important;
        border: none !important;
        padding: 10px 20px !important;
        border-radius: 5px !important;
        cursor: pointer !important;
        font-size: 14px !important;
        font-weight: 500 !important;
        z-index: 2147483647 !important;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3) !important;
        transition: background 0.2s !important;
    `;
    cancelBtn.onmouseover = function() { this.style.background = '#cc3333 !important'; };
    cancelBtn.onmouseout = function() { this.style.background = '#ff4444 !important'; };

    // Append elements
    overlay.appendChild(instructions);
    overlay.appendChild(cancelBtn);
    
    document.body.appendChild(overlay);
    
    // Add event listeners
    overlay.addEventListener('mousedown', startSelection);
    overlay.addEventListener('mousemove', updateSelection);
    overlay.addEventListener('mouseup', endSelection);
    document.addEventListener('keydown', handleKeyDown);
    cancelBtn.addEventListener('click', cancelSelection);

    // Prevent page scrolling and selection
    document.body.style.overflow = 'hidden';
    document.body.style.userSelect = 'none';
    
    console.log('Selection overlay created successfully');
    isProcessing = false;
}

function startSelection(e) {
    if (e.target.tagName === 'BUTTON') return;
    
    console.log('Starting selection...');
    isSelecting = true;
    
    // Get coordinates relative to viewport
    const rect = overlay.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
    
    // Create selection box
    selectionBox = document.createElement('div');
    selectionBox.style.cssText = `
        position: absolute !important;
        border: 2px dashed #00ff00 !important;
        background: rgba(0, 255, 0, 0.1) !important;
        z-index: 2147483647 !important;
        pointer-events: none !important;
        box-sizing: border-box !important;
    `;
    overlay.appendChild(selectionBox);
    
    e.preventDefault();
    e.stopPropagation();
}

function updateSelection(e) {
    if (!isSelecting || !selectionBox) return;

    const rect = overlay.getBoundingClientRect();
    endX = e.clientX - rect.left;
    endY = e.clientY - rect.top;

    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    selectionBox.style.left = left + 'px';
    selectionBox.style.top = top + 'px';
    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';
    
    e.preventDefault();
    e.stopPropagation();
}

function endSelection(e) {
    if (!isSelecting || !selectionBox) return;
    
    console.log('Ending selection...');
    isSelecting = false;
    
    const rect = selectionBox.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    
    // Calculate selection relative to overlay
    const selectionData = {
        left: rect.left - overlayRect.left,
        top: rect.top - overlayRect.top,
        width: rect.width,
        height: rect.height
    };
    
    console.log('Selection area:', selectionData);

    if (selectionData.width > 10 && selectionData.height > 10) {
        captureSelectedArea(selectionData);
    } else {
        console.log('Selection too small, cancelling');
        cancelSelection();
    }
    
    e.preventDefault();
    e.stopPropagation();
}

function handleKeyDown(e) {
    if (e.key === 'Escape') {
        console.log('ESC pressed, cancelling selection');
        cancelSelection();
        e.preventDefault();
        e.stopPropagation();
    }
}

function cancelSelection() {
    console.log('Cancelling selection...');
    cleanup();
    safeSendMessage({action: 'cropCancelled'});
}

function cleanup() {
    console.log('Cleaning up...');
    hideLoadingMessage();
    
    if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
    }
    overlay = null;
    selectionBox = null;
    document.body.style.overflow = '';
    document.body.style.userSelect = '';
    document.removeEventListener('keydown', handleKeyDown);
    isSelecting = false;
    isProcessing = false;
}

function captureSelectedArea(selection) {
    console.log('Starting capture process...');
    
    showLoadingMessage('Đang xử lý ảnh...');
    
    // Create canvas for cropping
    const canvas = document.createElement('canvas');
    canvas.width = selection.width;
    canvas.height = selection.height;
    const ctx = canvas.getContext('2d');
    
    // Create temporary image
    const tempImg = new Image();
    tempImg.src = screenshotDataUrl;
    
    tempImg.onload = () => {
        try {
            // Calculate scaling factors
            const scaleX = tempImg.naturalWidth / window.innerWidth;
            const scaleY = tempImg.naturalHeight / window.innerHeight;
            
            // Scale the selection coordinates
            const scaledX = selection.left * scaleX;
            const scaledY = selection.top * scaleY;
            const scaledWidth = selection.width * scaleX;
            const scaledHeight = selection.height * scaleY;
            
            // Draw cropped area to canvas
            ctx.drawImage(
                tempImg,
                scaledX, scaledY, scaledWidth, scaledHeight,
                0, 0, selection.width, selection.height
            );
            
            // Convert to base64
            const base64 = canvas.toDataURL('image/png').split(',')[1];
            
            // Send to popup
            safeSendMessage({
                action: 'imageCropped',
                imageData: base64
            });
            
            hideLoadingMessage();
            cleanup();
            
        } catch (error) {
            console.error('Error processing image:', error);
            hideLoadingMessage();
            cleanup();
            safeSendMessage({action: 'cropCancelled'});
        }
    };
    
    tempImg.onerror = () => {
        console.error('Failed to load screenshot image');
        hideLoadingMessage();
        cleanup();
        safeSendMessage({action: 'cropCancelled'});
    };
}

// Handle page events
document.addEventListener('visibilitychange', function() {
    if (document.hidden && overlay) {
        console.log('Page hidden, cleaning up...');
        cleanup();
    }
});

window.addEventListener('beforeunload', function() {
    console.log('Page unloading, cleaning up extension resources...');
    cleanupExtensionResources();
});

// Handle extension context invalidation
window.addEventListener('error', function(event) {
    if (event.error && event.error.message && event.error.message.includes('Extension context invalidated')) {
        console.warn('Extension context invalidated detected, cleaning up...');
        cleanupExtensionResources();
    }
});

// Periodic context check (every 30 seconds)
setInterval(() => {
    if (!isExtensionContextValid() && messageListener) {
        console.warn('Extension context lost, cleaning up...');
        cleanupExtensionResources();
    }
}, 30000);

// Log ready state
console.log('AI Screen Crop content script loaded successfully');

} // End of injection check
```

### 4. content.css
```css
/* AI Screen Crop - Content Styles */

#cropperOverlay {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    background: rgba(0, 0, 0, 0.4) !important;
    z-index: 2147483646 !important;
    cursor: crosshair !important;
    user-select: none !important;
    box-sizing: border-box !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    outline: none !important;
}

#cropperOverlay * {
    box-sizing: border-box !important;
}

#cropperOverlay img {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    pointer-events: none !important;
    object-fit: cover !important;
    opacity: 0.8 !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
}

#cropperOverlay div[style*="position: absolute"][style*="border: 2px dashed"] {
    position: absolute !important;
    border: 2px dashed #00ff00 !important;
    background: rgba(0, 255, 0, 0.1) !important;
    z-index: 2147483647 !important;
    pointer-events: none !important;
    box-sizing: border-box !important;
    margin: 0 !important;
    padding: 0 !important;
}

/* Ensure overlay is always on top */
#cropperOverlay {
    z-index: 2147483646 !important;
}

/* Instructions and buttons */
#cropperOverlay div[style*="background: rgba(0, 0, 0, 0.8)"] {
    z-index: 2147483647 !important;
}

#cropperOverlay button {
    z-index: 2147483647 !important;
}
```

### 5. popup.html
```html
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Screen Crop</title>
    <style>
        body {
            width: 450px;
            min-height: 600px;
            margin: 0;
            padding: 20px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        .container {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 15px;
            padding: 20px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        
        h1 {
            text-align: center;
            margin-bottom: 20px;
            font-size: 24px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        
        .api-key-section {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
        }
        
        input[type="password"], input[type="text"] {
            width: 100%;
            padding: 10px;
            border: none;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            font-size: 14px;
            box-sizing: border-box;
        }
        
        input[type="password"]::placeholder, input[type="text"]::placeholder {
            color: rgba(255, 255, 255, 0.7);
        }
        
        button {
            width: 100%;
            padding: 12px;
            border: none;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            margin-bottom: 10px;
        }
        
        button:hover {
            background: rgba(255, 255, 255, 0.3);
            transform: translateY(-2px);
        }
        
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        
        .crop-btn {
            background: linear-gradient(45deg, #ff6b6b, #ee5a52);
        }
        
        .crop-btn:hover {
            background: linear-gradient(45deg, #ee5a52, #ff6b6b);
        }
        
        .clear-btn {
            background: linear-gradient(45deg, #ff9500, #ff7700);
        }
        
        .clear-btn:hover {
            background: linear-gradient(45deg, #ff7700, #ff9500);
        }
        
        .restart-btn {
            background: linear-gradient(45deg, #9b59b6, #8e44ad);
        }
        
        .restart-btn:hover {
            background: linear-gradient(45deg, #8e44ad, #9b59b6);
        }
        
        .chat-container {
            max-height: 300px;
            overflow-y: auto;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 8px;
            padding: 10px;
            margin: 15px 0;
        }
        
        .message {
            margin-bottom: 10px;
            padding: 8px;
            border-radius: 8px;
            line-height: 1.4;
        }
        
        .user-message {
            background: rgba(100, 149, 237, 0.3);
            text-align: right;
        }
        
        .ai-message {
            background: rgba(144, 238, 144, 0.3);
        }
        
        .loading {
            text-align: center;
            padding: 20px;
            font-style: italic;
        }
        
        .error {
            background: rgba(255, 0, 0, 0.2);
            color: #ffcccc;
            padding: 10px;
            border-radius: 8px;
            margin: 10px 0;
        }
        
        .success {
            background: rgba(0, 255, 0, 0.2);
            color: #ccffcc;
            padding: 10px;
            border-radius: 8px;
            margin: 10px 0;
        }
        
        .follow-up {
            margin-top: 15px;
        }
        
        .follow-up textarea {
            width: 100%;
            min-height: 60px;
            padding: 10px;
            border: none;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            font-family: inherit;
            font-size: 14px;
            resize: vertical;
            box-sizing: border-box;
        }
        
        .follow-up textarea::placeholder {
            color: rgba(255, 255, 255, 0.7);
        }
        
        .send-btn {
            background: linear-gradient(45deg, #4CAF50, #45a049);
            margin-top: 10px;
        }
        
        .send-btn:hover {
            background: linear-gradient(45deg, #45a049, #4CAF50);
        }
        
        .image-preview-section {
            margin: 15px 0;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 8px;
            padding: 15px;
            border: 2px dashed rgba(255, 255, 255, 0.3);
        }
        
        .image-preview {
            max-width: 100%;
            max-height: 200px;
            border-radius: 8px;
            display: block;
            margin: 0 auto;
            object-fit: contain;
        }
        
        .image-info {
            text-align: center;
            margin-top: 10px;
            font-size: 12px;
            color: rgba(255, 255, 255, 0.8);
        }
        
        .prompt-section {
            margin: 15px 0;
        }
        
        .prompt-section textarea {
            width: 100%;
            min-height: 80px;
            padding: 12px;
            border: none;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.2);
            color: white;
            font-family: inherit;
            font-size: 14px;
            resize: vertical;
            box-sizing: border-box;
        }
        
        .prompt-section textarea::placeholder {
            color: rgba(255, 255, 255, 0.7);
        }
        
        .analyze-btn {
            background: linear-gradient(45deg, #3498db, #2980b9);
            margin-top: 10px;
        }
        
        .analyze-btn:hover {
            background: linear-gradient(45deg, #2980b9, #3498db);
        }
        
        .button-group {
            display: flex;
            gap: 10px;
            margin-bottom: 10px;
        }
        
        .button-group button {
            flex: 1;
            margin-bottom: 0;
        }
        
        .section-title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #ffffff;
            text-shadow: 1px 1px 2px rgba(0,0,0,0.3);
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🖼️ AI Screen Crop</h1>
        
        <div class="api-key-section">
            <label for="apiKey">OpenAI API Key:</label>
            <input type="password" id="apiKey" placeholder="Nhập API key của bạn...">
        </div>
        
        <button id="cropBtn" class="crop-btn">📸 Crop Ảnh Từ Màn Hình</button>
        
        <div class="button-group" id="actionButtons" style="display: none;">
            <button id="clearBtn" class="clear-btn">🗑️ Xóa</button>
            <button id="restartBtn" class="restart-btn">🔄 Restart</button>
        </div>
        
        <div id="imagePreviewSection" class="image-preview-section" style="display: none;">
            <div class="section-title">📷 Ảnh đã crop:</div>
            <img id="imagePreview" class="image-preview" alt="Cropped image preview">
            <div id="imageInfo" class="image-info"></div>
        </div>
        
        <div id="promptSection" class="prompt-section" style="display: none;">
            <div class="section-title">💬 Prompt cho AI:</div>
            <textarea id="promptText" placeholder="Nhập câu hỏi hoặc yêu cầu về ảnh này...">Hãy mô tả chi tiết những gì bạn nhìn thấy trong ảnh này.</textarea>
            <button id="analyzeBtn" class="analyze-btn">🚀 Phân Tích Ảnh</button>
        </div>
        
        <div id="status"></div>
        
        <div id="chatContainer" class="chat-container" style="display: none;">
            <div class="section-title">💬 Kết quả phân tích:</div>
            <div id="messages"></div>
        </div>
        
        <div id="followUp" class="follow-up" style="display: none;">
            <div class="section-title">✨ Hỏi thêm:</div>
            <textarea id="followUpText" placeholder="Đặt câu hỏi hoặc yêu cầu thêm về ảnh..."></textarea>
            <button id="sendBtn" class="send-btn">💬 Gửi Tin Nhắn</button>
        </div>
    </div>

    <script src="popup.js"></script>
</body>
</html>
```

### 6. popup.js
```javascript
let conversationHistory = [];
let currentImageBase64 = null;

document.addEventListener('DOMContentLoaded', function() {
    // Check extension context validity on load
    try {
        if (!chrome?.runtime?.id) {
            console.error('Extension context invalid on popup load');
            document.body.innerHTML = '<div style="padding: 20px; color: red;">Extension context invalidated. Please reload the extension.</div>';
            return;
        }
    } catch (error) {
        console.error('Error checking extension context:', error);
        document.body.innerHTML = '<div style="padding: 20px; color: red;">Extension error. Please reload the extension.</div>';
        return;
    }

    const apiKeyInput = document.getElementById('apiKey');
    const cropBtn = document.getElementById('cropBtn');
    const clearBtn = document.getElementById('clearBtn');
    const restartBtn = document.getElementById('restartBtn');
    const actionButtons = document.getElementById('actionButtons');
    const imagePreviewSection = document.getElementById('imagePreviewSection');
    const imagePreview = document.getElementById('imagePreview');
    const imageInfo = document.getElementById('imageInfo');
    const promptSection = document.getElementById('promptSection');
    const promptText = document.getElementById('promptText');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const statusDiv = document.getElementById('status');
    const chatContainer = document.getElementById('chatContainer');
    const messagesDiv = document.getElementById('messages');
    const followUpDiv = document.getElementById('followUp');
    const followUpText = document.getElementById('followUpText');
    const sendBtn = document.getElementById('sendBtn');

    // Load saved data with context check
    try {
        chrome.storage.sync.get(['openai_api_key'], function(result) {
            if (chrome.runtime.lastError) {
                console.warn('Error loading API key:', chrome.runtime.lastError.message);
                return;
            }
            if (result.openai_api_key) {
                apiKeyInput.value = result.openai_api_key;
            }
        });
    } catch (error) {
        console.error('Error accessing storage:', error);
        showStatus('Extension context error. Please reload extension.', 'error');
    }

    // Load saved conversation and image
    chrome.storage.local.get(['currentImageBase64', 'conversationHistory'], function(result) {
        if (result.currentImageBase64) {
            currentImageBase64 = result.currentImageBase64;
            displayImagePreview(currentImageBase64);
            console.log('Restored image from storage');
        }
        if (result.conversationHistory && result.conversationHistory.length > 0) {
            conversationHistory = result.conversationHistory;
            console.log('Restored conversation history:', conversationHistory.length, 'messages');
            
            // Restore UI
            restoreConversationUI();
            showStatus('Đã khôi phục cuộc hội thoại trước đó', 'success');
        }
    });

    // Save API key when changed
    apiKeyInput.addEventListener('change', function() {
        chrome.storage.sync.set({
            openai_api_key: apiKeyInput.value
        });
    });

    // Crop button click
    cropBtn.addEventListener('click', function() {
        if (!checkExtensionContext()) return;
        
        if (!apiKeyInput.value.trim()) {
            showStatus('Vui lòng nhập OpenAI API key!', 'error');
            return;
        }

        showStatus('Đang khởi tạo crop tool...', 'loading');
        
        // Get current tab and inject crop functionality
        try {
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (chrome.runtime.lastError) {
                    showStatus('Lỗi truy cập tab: ' + chrome.runtime.lastError.message, 'error');
                    return;
                }
                
                if (tabs[0]) {
                    // Check if tab URL is accessible
                    if (tabs[0].url.startsWith('chrome://') || tabs[0].url.startsWith('chrome-extension://')) {
                        showStatus('Không thể crop trên trang này. Vui lòng thử trên trang web khác.', 'error');
                        return;
                    }

                    try {
                        chrome.scripting.executeScript({
                            target: {tabId: tabs[0].id},
                            function: initializeCropTool
                        }, (result) => {
                            if (chrome.runtime.lastError) {
                                console.error('Script injection failed:', chrome.runtime.lastError);
                                showStatus('Lỗi khởi tạo: ' + chrome.runtime.lastError.message + '. Thử refresh trang và thử lại.', 'error');
                            } else {
                                console.log('Script injection successful');
                                // Set timeout to check if crop tool responds
                                setTimeout(() => {
                                    if (statusDiv.querySelector('.loading')) {
                                        showStatus('Crop tool không phản hồi. Vui lòng thử lại.', 'error');
                                    }
                                }, 5000);
                            }
                        });
                    } catch (error) {
                        showStatus('Lỗi inject script: ' + error.message, 'error');
                    }
                } else {
                    showStatus('Không tìm thấy tab hiện tại', 'error');
                }
            });
        } catch (error) {
            showStatus('Lỗi truy cập Chrome API: ' + error.message, 'error');
        }
    });

    // Analyze button click
    analyzeBtn.addEventListener('click', function() {
        if (!checkExtensionContext()) return;
        
        if (!currentImageBase64) {
            showStatus('Không có ảnh để phân tích', 'error');
            return;
        }
        
        const prompt = promptText.value.trim();
        if (!prompt) {
            showStatus('Vui lòng nhập prompt!', 'error');
            return;
        }
        
        showStatus('Đang gửi ảnh lên OpenAI...', 'loading');
        sendToOpenAI(currentImageBase64, prompt);
    });

    // Send follow-up message
    sendBtn.addEventListener('click', function() {
        const message = followUpText.value.trim();
        if (!message) return;

        sendFollowUpMessage(message);
        followUpText.value = '';
    });

    followUpText.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendBtn.click();
        }
    });

    // Clear conversation button
    clearBtn.addEventListener('click', function() {
        if (confirm('Bạn có chắc chắn muốn xóa cuộc hội thoại và bắt đầu lại?')) {
            clearConversation();
        }
    });

    // Restart extension button
    restartBtn.addEventListener('click', function() {
        if (confirm('Restart extension sẽ tải lại toàn bộ extension. Bạn có chắc chắn?')) {
            restartExtension();
        }
    });

    // Listen for messages from content script
    try {
        chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
            if (request.action === 'imageCropped') {
                handleCroppedImage(request.imageData);
            } else if (request.action === 'cropCancelled') {
                showStatus('Crop đã bị hủy', 'error');
            } else if (request.action === 'overlayCreating') {
                showStatus('Crop tool đã sẵn sàng! Chọn vùng cần crop trên màn hình.', 'success');
            }
        });
    } catch (error) {
        console.warn('Could not add message listener:', error.message);
    }

    function showStatus(message, type = 'info') {
        statusDiv.innerHTML = `<div class="${type}">${message}</div>`;
        
        if (type === 'loading') {
            statusDiv.innerHTML += '<div class="loading">⏳ Đang xử lý...</div>';
        }
    }

    function handleCroppedImage(imageData) {
        if (!imageData) {
            showStatus('Không nhận được dữ liệu ảnh', 'error');
            return;
        }
        
        currentImageBase64 = imageData;
        displayImagePreview(imageData);
        
        // Save image to storage immediately
        saveStateToStorage();
        
        showStatus('✅ Đã crop ảnh thành công! Nhập prompt và nhấn "Phân Tích Ảnh".', 'success');
    }

    function displayImagePreview(imageData) {
        imagePreview.src = `data:image/png;base64,${imageData}`;
        imagePreviewSection.style.display = 'block';
        promptSection.style.display = 'block';
        actionButtons.style.display = 'block';
        
        // Calculate and display image info
        const img = new Image();
        img.onload = function() {
            const sizeKB = Math.round((imageData.length * 3/4) / 1024);
            imageInfo.textContent = `Kích thước: ${img.width}x${img.height}px • Dung lượng: ${sizeKB}KB`;
        };
        img.src = `data:image/png;base64,${imageData}`;
    }

    async function sendToOpenAI(imageData, userMessage) {
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            showStatus('Vui lòng nhập OpenAI API key!', 'error');
            return;
        }
        
        try {
            const messages = [
                ...conversationHistory,
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: userMessage
                        }
                    ]
                }
            ];

            // Add image to the message if it's the first message or if we have a new image
            if (conversationHistory.length === 0 || imageData) {
                messages[messages.length - 1].content.push({
                    type: "image_url",
                    image_url: {
                        url: `data:image/png;base64,${imageData || currentImageBase64}`
                    }
                });
            }

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    messages: messages,
                    max_tokens: 1500,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
            }

            const data = await response.json();
            const aiResponse = data.choices[0].message.content;

            // Add messages to conversation history
            conversationHistory.push({
                role: "user",
                content: [{ type: "text", text: userMessage }]
            });

            conversationHistory.push({
                role: "assistant",
                content: aiResponse
            });

            // Display the conversation
            displayMessage(userMessage, 'user');
            displayMessage(aiResponse, 'ai');
            
            // Save updated conversation to storage
            saveStateToStorage();
            
            showStatus('✅ Phân tích thành công! Bạn có thể tiếp tục hỏi thêm.', 'success');
            
            // Show chat interface
            chatContainer.style.display = 'block';
            followUpDiv.style.display = 'block';
            
        } catch (error) {
            console.error('Error calling OpenAI API:', error);
            showStatus(`❌ Lỗi: ${error.message}`, 'error');
        }
    }

    function sendFollowUpMessage(message) {
        if (!checkExtensionContext()) return;
        
        if (!currentImageBase64) {
            showStatus('Không có ảnh để tiếp tục hội thoại', 'error');
            return;
        }
        
        showStatus('Đang gửi tin nhắn...', 'loading');
        sendToOpenAI(null, message);
    }

    function displayMessage(message, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        // Format message with line breaks
        const formattedMessage = message.replace(/\n/g, '<br>');
        messageDiv.innerHTML = formattedMessage;
        
        messagesDiv.appendChild(messageDiv);
        
        // Scroll to bottom
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function restoreConversationUI() {
        // Clear messages container first
        messagesDiv.innerHTML = '';
        
        // Display all messages from history
        conversationHistory.forEach(message => {
            if (message.role === 'user') {
                const userContent = message.content.find(c => c.type === 'text');
                if (userContent) {
                    displayMessage(userContent.text, 'user');
                }
            } else if (message.role === 'assistant') {
                displayMessage(message.content, 'ai');
            }
        });
        
        // Show chat interface
        chatContainer.style.display = 'block';
        followUpDiv.style.display = 'block';
        actionButtons.style.display = 'block';
    }

    function saveStateToStorage() {
        try {
            chrome.storage.local.set({
                currentImageBase64: currentImageBase64,
                conversationHistory: conversationHistory
            });
        } catch (error) {
            console.warn('Could not save state to storage:', error.message);
        }
    }

    function checkExtensionContext() {
        try {
            if (!chrome?.runtime?.id) {
                throw new Error('Extension context invalidated');
            }
            return true;
        } catch (error) {
            console.error('Extension context check failed:', error);
            showStatus('Extension bị lỗi. Vui lòng reload extension tại chrome://extensions/', 'error');
            // Disable all buttons
            cropBtn.disabled = true;
            clearBtn.disabled = true;
            sendBtn.disabled = true;
            analyzeBtn.disabled = true;
            restartBtn.disabled = true;
            return false;
        }
    }

    function clearConversation() {
        if (!checkExtensionContext()) return;
        
        // Reset variables
        conversationHistory = [];
        currentImageBase64 = null;
        
        // Clear UI
        messagesDiv.innerHTML = '';
        chatContainer.style.display = 'none';
        followUpDiv.style.display = 'none';
        actionButtons.style.display = 'none';
        imagePreviewSection.style.display = 'none';
        promptSection.style.display = 'none';
        
        // Reset prompt text to default
        promptText.value = 'Hãy mô tả chi tiết những gì bạn nhìn thấy trong ảnh này.';
        
        // Clear storage
        try {
            chrome.storage.local.remove(['currentImageBase64', 'conversationHistory']);
        } catch (error) {
            console.warn('Could not clear storage:', error.message);
        }
        
        // Reset status
        showStatus('✅ Đã xóa cuộc hội thoại. Sẵn sàng crop ảnh mới.', 'success');
    }

    function restartExtension() {
        if (!checkExtensionContext()) return;
        
        try {
            // Clear all storage
            chrome.storage.local.clear();
            
            // Reload the extension
            chrome.runtime.reload();
        } catch (error) {
            console.error('Error restarting extension:', error);
            showStatus('❌ Không thể restart extension. Vui lòng thử reload thủ công tại chrome://extensions/', 'error');
        }
    }
});

// Function to be injected into the content script
function initializeCropTool() {
    console.log('Initializing crop tool...');
    
    // Check if extension context is still valid
    try {
        if (!chrome?.runtime?.id) {
            console.error('Extension context invalidated in injected script');
            return;
        }
        window.postMessage({type: 'INIT_CROP_TOOL'}, '*');
    } catch (error) {
        console.error('Error in initializeCropTool:', error);
    }
}
```

## Tính năng chính

1. **Screenshot & Crop**: Chụp màn hình và crop vùng được chọn
2. **AI Analysis**: Sử dụng OpenAI GPT-4 Vision để phân tích ảnh  
3. **Conversation**: Tiếp tục hội thoại về ảnh đã crop
4. **State Management**: Lưu trữ ảnh và hội thoại
5. **Error Handling**: Xử lý lỗi extension context và network

## Cách cài đặt

1. Tạo thư mục extension mới
2. Copy tất cả các file trên vào thư mục
3. Mở Chrome, vào `chrome://extensions/`
4. Bật "Developer mode"
5. Click "Load unpacked" và chọn thư mục extension
6. Nhập OpenAI API key vào extension

## Cách sử dụng

1. Click icon extension trên thanh công cụ
2. Nhập OpenAI API key
3. Click "Crop Ảnh Từ Màn Hình"
4. Kéo chuột để chọn vùng cần crop
5. Nhập prompt và click "Phân Tích Ảnh"
6. Tiếp tục hội thoại bằng cách gửi tin nhắn follow-up