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