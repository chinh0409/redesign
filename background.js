// Background script for handling screen capture and message passing
try {
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        console.log('Background received message:', request.action);
        
        if (request.action === 'takeScreenshot') {
            console.log('Processing takeScreenshot request...');
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
        } else {
            console.log('Background script ignoring action:', request.action);
            return; // Don't handle other actions in background
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