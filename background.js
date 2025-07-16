// Background script for handling screen capture and message passing
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'takeScreenshot') {
        // Capture screenshot of current tab
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
            } else {
                console.log('Screenshot captured successfully');
                sendResponse({
                    success: true,
                    dataUrl: dataUrl
                });
            }
        });
        return true; // Keep the message channel open for async response
    } else if (request.action === 'imageCropped') {
        // Forward the message to popup if it's open
        chrome.runtime.sendMessage(request).catch(() => {
            // Popup might not be open, that's okay
            console.log('Popup not available to receive imageCropped message');
        });
    } else if (request.action === 'cropCancelled') {
        // Forward the message to popup if it's open
        chrome.runtime.sendMessage(request).catch(() => {
            // Popup might not be open, that's okay
            console.log('Popup not available to receive cropCancelled message');
        });
    }
});

// Handle extension installation
chrome.runtime.onInstalled.addListener(function(details) {
    console.log('AI Screen Crop Extension installed');
});

// Handle extension startup
chrome.runtime.onStartup.addListener(function() {
    console.log('AI Screen Crop Extension started');
});