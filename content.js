// Prevent multiple injections
if (window.AI_SCREEN_CROP_INJECTED) {
    console.log('AI Screen Crop script already injected, skipping...');
} else {
    window.AI_SCREEN_CROP_INJECTED = true;
    console.log('AI Screen Crop content script initializing...');

    // Global variables
    let isSelecting = false;
    let startX, startY, endX, endY;
    let overlay = null;
    let selectionBox = null;
    let isProcessing = false;
    let screenshotDataUrl = null;
    let messageListener = null;
    let loadingMessage = null;

    // Initialize content script
    initializeContentScript();

    function initializeContentScript() {
        setupWindowMessageListener();
        setupExtensionMessageListener();
        setupPageEventHandlers();
        startContextMonitoring();
    }

    // Helper function to safely send messages to extension
    function safeSendMessage(message, callback) {
        try {
            // Check if chrome runtime exists and is connected
            if (!chrome?.runtime?.id) {
                console.warn('Extension context invalidated - cannot send message:', message);
                return false;
            }
            
            console.log('Content script sending message:', message.action);
            
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn('Runtime error sending message:', message.action, chrome.runtime.lastError.message);
                    // Don't call callback on error to prevent further issues
                    return;
                }
                
                console.log('Content script got response for:', message.action, response);
                
                if (callback) {
                    // Always call callback, even if response is null/undefined
                    callback(response);
                }
            });
            return true;
        } catch (error) {
            console.warn('Error sending message:', message.action, error.message);
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

    function setupWindowMessageListener() {
        // Listen for messages from popup
        window.addEventListener('message', function(event) {
            // Validate message origin and type
            if (!event.data || event.data.type !== 'INIT_CROP_TOOL') {
                return;
            }

            console.log('Received INIT_CROP_TOOL message');
            
            if (isExtensionContextValid()) {
                startScreenCapture();
            } else {
                console.warn('Extension context invalid, cannot start screen capture');
            }
        });
    }

    function setupExtensionMessageListener() {
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
            console.log('Received extension message:', request.action);
            
            switch (request.action) {
                case 'startCrop':
                    handleStartCropMessage(sendResponse);
                    break;
                default:
                    console.warn('Unknown message action:', request.action);
                    sendResponse({success: false, error: 'Unknown action'});
            }
            
            return true; // Keep channel open for async response
        };
        
        try {
            chrome.runtime.onMessage.addListener(messageListener);
            console.log('Extension message listener setup successfully');
        } catch (error) {
            console.error('Error setting up message listener:', error);
            messageListener = null;
        }
    }

    function handleStartCropMessage(sendResponse) {
        console.log('Received startCrop message from extension');
        
        if (isExtensionContextValid()) {
            startScreenCapture();
            sendResponse({success: true});
        } else {
            console.warn('Extension context invalid during startCrop');
            sendResponse({success: false, error: 'Extension context invalid'});
        }
    }

    function setupPageEventHandlers() {
        // Handle page visibility changes
        document.addEventListener('visibilitychange', function() {
            if (document.hidden && overlay) {
                console.log('Page hidden, cleaning up crop overlay...');
                cleanup();
            }
        });

        // Handle page unload
        window.addEventListener('beforeunload', function() {
            console.log('Page unloading, cleaning up extension resources...');
            cleanupExtensionResources();
        });

        // Handle extension context invalidation errors
        window.addEventListener('error', function(event) {
            if (event.error && event.error.message && 
                event.error.message.includes('Extension context invalidated')) {
                console.warn('Extension context invalidated detected, cleaning up...');
                cleanupExtensionResources();
            }
        });
    }

    function startContextMonitoring() {
        // Listen for extension disconnect/reconnect
        if (chrome.runtime && chrome.runtime.onConnect) {
            chrome.runtime.onConnect.addListener(() => {
                console.log('Extension reconnected, re-setting up message listener');
                setupExtensionMessageListener();
            });
        }

        // Periodic context check (every 30 seconds)
        setInterval(() => {
            if (!isExtensionContextValid() && messageListener) {
                console.warn('Extension context lost during monitoring, cleaning up...');
                cleanupExtensionResources();
            }
        }, 30000);
    }

    function startScreenCapture() {
        if (isProcessing) {
            console.log('Already processing screenshot request, ignoring...');
            return;
        }
        
        console.log('Starting screen capture process...');
        isProcessing = true;
        showLoadingMessage('Đang chụp màn hình...');
        
        // Request screenshot with timeout
        requestScreenshotWithTimeout();
    }

    function requestScreenshotWithTimeout() {
        const timeoutId = setTimeout(() => {
            console.error('Screenshot request timeout');
            hideLoadingMessage();
            isProcessing = false;
            safeSendMessage({action: 'cropCancelled'});
        }, 10000); // 10 second timeout

        console.log('Content script sending takeScreenshot message...');
        const messageSent = safeSendMessage({action: 'takeScreenshot'}, (response) => {
            clearTimeout(timeoutId);
            console.log('Content script received screenshot response:', response);
            handleScreenshotResponse(response);
        });
        
        if (!messageSent) {
            console.error('Failed to send takeScreenshot message');
            clearTimeout(timeoutId);
            hideLoadingMessage();
            isProcessing = false;
            safeSendMessage({action: 'cropCancelled'});
        }
    }

    function handleScreenshotResponse(response) {
        if (!response || !response.success || !response.dataUrl) {
            console.error('Failed to get screenshot:', response);
            hideLoadingMessage();
            isProcessing = false;
            safeSendMessage({action: 'cropCancelled'});
            return;
        }
        
        console.log('Screenshot received successfully, size:', response.dataUrl.length);
        screenshotDataUrl = response.dataUrl;
        hideLoadingMessage();
        initializeSelectionOverlay();
    }

    function showLoadingMessage(text) {
        if (loadingMessage) {
            hideLoadingMessage();
        }
        
        loadingMessage = document.createElement('div');
        loadingMessage.style.cssText = `
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
            background: rgba(0, 0, 0, 0.9) !important;
            color: white !important;
            padding: 20px 30px !important;
            border-radius: 8px !important;
            z-index: 2147483647 !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            font-size: 16px !important;
            font-weight: 500 !important;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
            pointer-events: none !important;
            user-select: none !important;
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
            console.log('Cropper overlay already exists, cleaning up first...');
            cleanup();
        }
        
        console.log('Creating selection overlay...');
        
        // Notify popup that overlay is being created
        safeSendMessage({action: 'overlayCreating'});
        
        createOverlayStructure();
        setupOverlayEventListeners();
        
        console.log('Selection overlay created successfully');
        isProcessing = false;
    }

    function createOverlayStructure() {
        // Create main overlay
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
        createScreenshotImage();
        
        // Create instructions
        createInstructions();
        
        // Create cancel button
        createCancelButton();
        
        // Append to body
        document.body.appendChild(overlay);
        
        // Prevent page interaction
        document.body.style.overflow = 'hidden';
        document.body.style.userSelect = 'none';
    }

    function createScreenshotImage() {
        const img = new Image();
        
        img.onload = function() {
            console.log('Screenshot image loaded successfully');
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
            console.error('Failed to load screenshot image');
            cancelSelection();
        };
        
        img.src = screenshotDataUrl;
    }

    function createInstructions() {
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
        overlay.appendChild(instructions);
    }

    function createCancelButton() {
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
        
        // Hover effects
        cancelBtn.addEventListener('mouseenter', function() {
            this.style.background = '#cc3333 !important';
        });
        
        cancelBtn.addEventListener('mouseleave', function() {
            this.style.background = '#ff4444 !important';
        });
        
        cancelBtn.addEventListener('click', cancelSelection);
        overlay.appendChild(cancelBtn);
    }

    function setupOverlayEventListeners() {
        // Mouse events for selection
        overlay.addEventListener('mousedown', startSelection);
        overlay.addEventListener('mousemove', updateSelection);
        overlay.addEventListener('mouseup', endSelection);
        
        // Keyboard events
        document.addEventListener('keydown', handleKeyDown);
        
        // Prevent context menu
        overlay.addEventListener('contextmenu', function(e) {
            e.preventDefault();
        });
    }

    function startSelection(e) {
        // Don't start selection on button clicks
        if (e.target.tagName === 'BUTTON') {
            return;
        }
        
        console.log('Starting area selection...');
        isSelecting = true;
        
        // Get coordinates relative to viewport
        const rect = overlay.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;
        
        // Create selection box
        createSelectionBox();
        
        e.preventDefault();
        e.stopPropagation();
    }

    function createSelectionBox() {
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
    }

    function updateSelection(e) {
        if (!isSelecting || !selectionBox) {
            return;
        }

        const rect = overlay.getBoundingClientRect();
        endX = e.clientX - rect.left;
        endY = e.clientY - rect.top;

        // Calculate selection rectangle
        const left = Math.min(startX, endX);
        const top = Math.min(startY, endY);
        const width = Math.abs(endX - startX);
        const height = Math.abs(endY - startY);

        // Update selection box
        selectionBox.style.left = left + 'px';
        selectionBox.style.top = top + 'px';
        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';
        
        e.preventDefault();
        e.stopPropagation();
    }

    function endSelection(e) {
        if (!isSelecting || !selectionBox) {
            return;
        }
        
        console.log('Ending area selection...');
        isSelecting = false;
        
        const selectionData = getSelectionData();
        
        console.log('Selection coordinates:', selectionData);

        // Validate selection size
        if (selectionData.width > 10 && selectionData.height > 10) {
            captureSelectedArea(selectionData);
        } else {
            console.log('Selection too small, cancelling crop');
            cancelSelection();
        }
        
        e.preventDefault();
        e.stopPropagation();
    }

    function getSelectionData() {
        const rect = selectionBox.getBoundingClientRect();
        const overlayRect = overlay.getBoundingClientRect();
        
        return {
            left: rect.left - overlayRect.left,
            top: rect.top - overlayRect.top,
            width: rect.width,
            height: rect.height
        };
    }

    function handleKeyDown(e) {
        if (e.key === 'Escape') {
            console.log('ESC key pressed, cancelling selection');
            cancelSelection();
            e.preventDefault();
            e.stopPropagation();
        }
    }

    function cancelSelection() {
        console.log('Cancelling crop selection...');
        cleanup();
        safeSendMessage({action: 'cropCancelled'});
    }

    function cleanup() {
        console.log('Cleaning up crop overlay...');
        
        hideLoadingMessage();
        
        // Remove overlay
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
        
        // Reset variables
        overlay = null;
        selectionBox = null;
        
        // Restore page state
        document.body.style.overflow = '';
        document.body.style.userSelect = '';
        
        // Remove event listeners
        document.removeEventListener('keydown', handleKeyDown);
        
        // Reset flags
        isSelecting = false;
        isProcessing = false;
    }

    function captureSelectedArea(selection) {
        console.log('Starting image capture process...');
        
        showLoadingMessage('Đang xử lý ảnh...');
        
        // Create canvas for image processing
        const canvas = document.createElement('canvas');
        canvas.width = selection.width;
        canvas.height = selection.height;
        const ctx = canvas.getContext('2d');
        
        // Process the cropped image
        processImage(canvas, ctx, selection);
    }

    function processImage(canvas, ctx, selection) {
        const tempImg = new Image();
        tempImg.src = screenshotDataUrl;
        
        tempImg.onload = () => {
            try {
                // Calculate scaling factors to match actual screenshot dimensions
                const scaleX = tempImg.naturalWidth / window.innerWidth;
                const scaleY = tempImg.naturalHeight / window.innerHeight;
                
                // Apply scaling to selection coordinates
                const scaledX = selection.left * scaleX;
                const scaledY = selection.top * scaleY;
                const scaledWidth = selection.width * scaleX;
                const scaledHeight = selection.height * scaleY;
                
                console.log('Processing image with scaling:', {
                    original: selection,
                    scaled: {x: scaledX, y: scaledY, w: scaledWidth, h: scaledHeight},
                    factors: {x: scaleX, y: scaleY}
                });
                
                // Draw cropped area to canvas
                ctx.drawImage(
                    tempImg,
                    scaledX, scaledY, scaledWidth, scaledHeight,
                    0, 0, selection.width, selection.height
                );
                
                // Convert to base64 and send result
                finalizeCroppedImage(canvas);
                
            } catch (error) {
                console.error('Error processing cropped image:', error);
                handleImageProcessingError();
            }
        };
        
        tempImg.onerror = () => {
            console.error('Failed to load screenshot image for processing');
            handleImageProcessingError();
        };
    }

    function finalizeCroppedImage(canvas) {
        try {
            // Convert canvas to base64
            const base64 = canvas.toDataURL('image/png').split(',')[1];
            
            console.log('Image processed successfully, size:', base64.length);
            
            // Send cropped image to popup
            safeSendMessage({
                action: 'imageCropped',
                imageData: base64
            });
            
            hideLoadingMessage();
            cleanup();
            
        } catch (error) {
            console.error('Error finalizing cropped image:', error);
            handleImageProcessingError();
        }
    }

    function handleImageProcessingError() {
        hideLoadingMessage();
        cleanup();
        safeSendMessage({action: 'cropCancelled'});
    }

    // Log successful initialization
    console.log('AI Screen Crop content script loaded successfully');

} // End of injection guard