let conversationHistory = [];
let currentImageBase64 = null;

document.addEventListener('DOMContentLoaded', function() {
    // Enhanced extension context check with recovery
    function checkAndRecoverContext() {
        try {
            if (!chrome?.runtime?.id) {
                console.error('Extension context invalid on popup load');
                showContextLostUI();
                return false;
            }
            return true;
        } catch (error) {
            console.error('Error checking extension context:', error);
            showContextLostUI();
            return false;
        }
    }
    
    function showContextLostUI() {
        document.body.innerHTML = `
            <div style="padding: 20px; color: white; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px; text-align: center;">
                <h3>🔧 Extension Context Lost</h3>
                <p>Extension context đã bị mất. Vui lòng:</p>
                <button onclick="location.reload()" style="margin: 5px; padding: 10px 15px; background: #ff6b6b; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    🔄 Reload Popup
                </button>
                <button onclick="window.open('chrome://extensions/', '_blank')" style="margin: 5px; padding: 10px 15px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    ⚙️ Mở Extensions
                </button>
                <br><br>
                <small>Hoặc thử reload extension tại chrome://extensions/</small>
            </div>
        `;
    }
    
    // Start context monitoring for popup
    let popupContextMonitor = null;
    
    function startPopupContextMonitoring() {
        if (popupContextMonitor) {
            clearInterval(popupContextMonitor);
        }
        
        popupContextMonitor = setInterval(() => {
            if (!checkAndRecoverContext()) {
                clearInterval(popupContextMonitor);
                return;
            }
        }, 5000); // Check every 5 seconds
    }
    
    // Initial context check
    if (!checkAndRecoverContext()) {
        return;
    }
    
    // Start monitoring
    startPopupContextMonitoring();

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
                        }, async (result) => {
                            if (chrome.runtime.lastError) {
                                console.error('Script injection failed:', chrome.runtime.lastError);
                                showStatus('Lỗi khởi tạo: ' + chrome.runtime.lastError.message + '. Thử refresh trang và thử lại.', 'error');
                                return;
                            } 
                            
                            console.log('Script injection successful');
                            
                            // Wait a moment for content script to initialize
                            setTimeout(async () => {
                                try {
                                    // Try to send a message to content script to verify it's working
                                    await safeSendMessageFromPopup(tabs[0].id, { action: 'ping' }, { timeout: 3000 });
                                    console.log('Content script is responsive');
                                } catch (error) {
                                    console.warn('Content script not responsive:', error.message);
                                    if (statusDiv.querySelector('.loading')) {
                                        showStatus('Crop tool không phản hồi. Vui lòng refresh trang và thử lại.', 'error');
                                    }
                                }
                            }, 1000);
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
            console.log('Popup received message:', request.action);
            
            try {
                if (request.action === 'imageCropped') {
                    handleCroppedImage(request.imageData);
                    sendResponse({ success: true, received: true });
                } else if (request.action === 'cropCancelled') {
                    showStatus('Crop đã bị hủy', 'error');
                    sendResponse({ success: true, received: true });
                } else if (request.action === 'overlayCreating') {
                    showStatus('Crop tool đã sẵn sàng! Chọn vùng cần crop trên màn hình.', 'success');
                    sendResponse({ success: true, received: true });
                } else {
                    console.warn('Unknown action in popup:', request.action);
                    sendResponse({ success: false, error: 'Unknown action' });
                }
            } catch (error) {
                console.error('Error handling message in popup:', error);
                sendResponse({ success: false, error: error.message });
            }
            
            return true; // Keep message channel open
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

    // Helper function to safely send messages from popup
    function safeSendMessageFromPopup(tabId, message, options = {}) {
        return new Promise((resolve, reject) => {
            if (!checkExtensionContext()) {
                reject(new Error('Extension context invalid'));
                return;
            }

            const timeout = setTimeout(() => {
                reject(new Error('Message timeout'));
            }, options.timeout || 10000);

            try {
                if (tabId) {
                    // Send to specific tab
                    chrome.tabs.sendMessage(tabId, message, (response) => {
                        clearTimeout(timeout);
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(response || { success: true });
                        }
                    });
                } else {
                    // Send to runtime
                    chrome.runtime.sendMessage(message, (response) => {
                        clearTimeout(timeout);
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else {
                            resolve(response || { success: true });
                        }
                    });
                }
            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
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
    
    // Cleanup when popup is closed
    window.addEventListener('beforeunload', function() {
        console.log('Popup closing, cleaning up...');
        if (popupContextMonitor) {
            clearInterval(popupContextMonitor);
        }
    });
    
    // Handle visibility change (popup hidden/shown)
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            console.log('Popup hidden');
        } else {
            console.log('Popup visible, checking context...');
            checkAndRecoverContext();
        }
    });
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