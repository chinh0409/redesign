// Background script for handling screen capture and message passing
try {
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        console.log('Background received message:', request.action);
        
        if (request.action === 'takeScreenshot') {
            // Capture screenshot of current tab
            try {
                // Set timeout to prevent hanging
                const timeoutId = setTimeout(() => {
                    console.error('Screenshot timeout in background');
                    sendResponse({
                        success: false,
                        error: 'Screenshot timeout'
                    });
                }, 10000);
                
                chrome.tabs.captureVisibleTab(null, {
                    format: 'png',
                    quality: 100
                }, function(dataUrl) {
                    clearTimeout(timeoutId);
                    
                    try {
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
                            console.log('Screenshot captured successfully, size:', dataUrl.length);
                            sendResponse({
                                success: true,
                                dataUrl: dataUrl
                            });
                        }
                    } catch (responseError) {
                        console.error('Error sending screenshot response:', responseError);
                        // Try to send error response
                        try {
                            sendResponse({
                                success: false,
                                error: 'Error processing screenshot response'
                            });
                        } catch (e) {
                            console.error('Failed to send error response:', e);
                        }
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
                chrome.runtime.sendMessage(request).catch((error) => {
                    // Popup might not be open, that's okay
                    console.log('Popup not available to receive imageCropped message:', error?.message);
                });
                sendResponse({ success: true, forwarded: true });
            } catch (error) {
                console.warn('Error forwarding imageCropped message:', error.message);
                sendResponse({ success: false, error: error.message });
            }
            return true;
            
        } else if (request.action === 'cropCancelled') {
            // Forward the message to popup if it's open
            try {
                chrome.runtime.sendMessage(request).catch((error) => {
                    // Popup might not be open, that's okay
                    console.log('Popup not available to receive cropCancelled message:', error?.message);
                });
                sendResponse({ success: true, forwarded: true });
            } catch (error) {
                console.warn('Error forwarding cropCancelled message:', error.message);
                sendResponse({ success: false, error: error.message });
            }
            return true;
            
        } else if (request.action === 'overlayCreating') {
            // Forward the message to popup if it's open
            try {
                chrome.runtime.sendMessage(request).catch((error) => {
                    console.log('Popup not available to receive overlayCreating message:', error?.message);
                });
                sendResponse({ success: true, forwarded: true });
            } catch (error) {
                console.warn('Error forwarding overlayCreating message:', error.message);
                sendResponse({ success: false, error: error.message });
            }
            return true;
            
        } else {
            // Unknown action
            console.warn('Unknown action received:', request.action);
            sendResponse({ success: false, error: 'Unknown action: ' + request.action });
        }
        
        return false; // Don't keep channel open for non-async responses
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