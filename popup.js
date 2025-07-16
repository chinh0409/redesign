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
    const imageIndicator = document.getElementById('imageIndicator');
    const statusDiv = document.getElementById('status');
    const chatContainer = document.getElementById('chatContainer');
    const messagesDiv = document.getElementById('messages');
    const followUpDiv = document.getElementById('followUp');
    const followUpText = document.getElementById('followUpText');
    const sendBtn = document.getElementById('sendBtn');

    // Initialize extension
    initializeExtension();

    function initializeExtension() {
        loadSavedData();
        setupEventListeners();
        setupMessageListener();
    }

    function loadSavedData() {
        // Load saved API key with context check
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
        try {
            chrome.storage.local.get(['currentImageBase64', 'conversationHistory'], function(result) {
                if (chrome.runtime.lastError) {
                    console.warn('Error loading conversation data:', chrome.runtime.lastError.message);
                    return;
                }

                if (result.currentImageBase64) {
                    currentImageBase64 = result.currentImageBase64;
                    imageIndicator.style.display = 'block';
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
        } catch (error) {
            console.error('Error loading conversation data:', error);
        }
    }

    function setupEventListeners() {
        // Save API key when changed
        apiKeyInput.addEventListener('change', function() {
            try {
                chrome.storage.sync.set({
                    openai_api_key: apiKeyInput.value
                });
            } catch (error) {
                console.warn('Could not save API key:', error.message);
            }
        });

        // Crop button click
        cropBtn.addEventListener('click', function() {
            if (!checkExtensionContext()) return;
            
            if (!apiKeyInput.value.trim()) {
                showStatus('Vui lòng nhập OpenAI API key!', 'error');
                return;
            }

            startCropProcess();
        });

        // Send follow-up message
        sendBtn.addEventListener('click', function() {
            const message = followUpText.value.trim();
            if (!message) return;

            sendFollowUpMessage(message);
            followUpText.value = '';
        });

        // Enter key to send message
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
    }

    function setupMessageListener() {
        // Listen for messages from content script
        try {
            chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
                console.log('Received message:', request.action);
                
                switch (request.action) {
                    case 'imageCropped':
                        handleCroppedImage(request.imageData);
                        break;
                    case 'cropCancelled':
                        showStatus('Crop đã bị hủy', 'error');
                        break;
                    case 'overlayCreating':
                        showStatus('Crop tool đã sẵn sàng! Chọn vùng cần crop trên màn hình.', 'success');
                        break;
                    default:
                        console.warn('Unknown message action:', request.action);
                }
            });
        } catch (error) {
            console.warn('Could not add message listener:', error.message);
        }
    }

    function startCropProcess() {
        showStatus('Đang khởi tạo crop tool...', 'loading');
        
        // Get current tab and inject crop functionality
        try {
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (chrome.runtime.lastError) {
                    showStatus('Lỗi truy cập tab: ' + chrome.runtime.lastError.message, 'error');
                    return;
                }
                
                if (!tabs || !tabs[0]) {
                    showStatus('Không tìm thấy tab hiện tại', 'error');
                    return;
                }

                const currentTab = tabs[0];
                
                // Check if tab URL is accessible
                if (currentTab.url.startsWith('chrome://') || 
                    currentTab.url.startsWith('chrome-extension://') ||
                    currentTab.url.startsWith('edge://') ||
                    currentTab.url.startsWith('about:')) {
                    showStatus('Không thể crop trên trang này. Vui lòng thử trên trang web khác.', 'error');
                    return;
                }

                // Inject crop tool
                injectCropTool(currentTab.id);
            });
        } catch (error) {
            showStatus('Lỗi truy cập Chrome API: ' + error.message, 'error');
        }
    }

    function injectCropTool(tabId) {
        try {
            chrome.scripting.executeScript({
                target: {tabId: tabId},
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
    }

    function handleCroppedImage(imageData) {
        if (!imageData) {
            showStatus('Không nhận được dữ liệu ảnh', 'error');
            return;
        }
        
        console.log('Received cropped image, size:', imageData.length);
        currentImageBase64 = imageData;
        imageIndicator.style.display = 'block';
        
        // Save image to storage immediately
        saveStateToStorage();
        
        showStatus('Đang gửi ảnh lên OpenAI...', 'loading');
        
        sendToOpenAI(imageData, "Hãy mô tả chi tiết những gì bạn nhìn thấy trong ảnh này.");
    }

    async function sendToOpenAI(imageData, userMessage) {
        const apiKey = apiKeyInput.value.trim();
        
        if (!apiKey) {
            showStatus('Vui lòng nhập OpenAI API key!', 'error');
            return;
        }
        
        try {
            const messages = [...conversationHistory];
            
            // Create user message
            const userMsg = {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: userMessage
                    }
                ]
            };

            // Add image to the message if it's the first message or if we have a new image
            if (conversationHistory.length === 0 || imageData) {
                userMsg.content.push({
                    type: "image_url",
                    image_url: {
                        url: `data:image/png;base64,${imageData || currentImageBase64}`,
                        detail: "high"
                    }
                });
            }

            messages.push(userMsg);

            const requestBody = {
                model: "gpt-4o",
                messages: messages,
                max_tokens: 1500,
                temperature: 0.7
            };

            console.log('Sending request to OpenAI...');
            
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json();
                const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
                throw new Error(`API Error: ${errorMessage}`);
            }

            const data = await response.json();
            
            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error('Invalid response format from OpenAI');
            }

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
            
            showStatus('Thành công! Bạn có thể tiếp tục hội thoại.', 'success');
            
            // Show chat interface
            showChatInterface();
            
        } catch (error) {
            console.error('Error calling OpenAI API:', error);
            
            let errorMessage = error.message;
            if (errorMessage.includes('401')) {
                errorMessage = 'API key không hợp lệ. Vui lòng kiểm tra lại.';
            } else if (errorMessage.includes('429')) {
                errorMessage = 'Đã vượt quá giới hạn API. Vui lòng thử lại sau.';
            } else if (errorMessage.includes('quota')) {
                errorMessage = 'Hết quota API. Vui lòng kiểm tra tài khoản OpenAI.';
            }
            
            showStatus(`Lỗi: ${errorMessage}`, 'error');
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
        
        // Format message with line breaks and basic HTML
        const formattedMessage = message
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
            
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
        showChatInterface();
    }

    function showChatInterface() {
        chatContainer.style.display = 'block';
        followUpDiv.style.display = 'block';
        clearBtn.style.display = 'block';
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
            apiKeyInput.disabled = true;
            
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
        clearBtn.style.display = 'none';
        imageIndicator.style.display = 'none';
        
        // Clear storage
        try {
            chrome.storage.local.remove(['currentImageBase64', 'conversationHistory']);
        } catch (error) {
            console.warn('Could not clear storage:', error.message);
        }
        
        // Reset status
        showStatus('Đã xóa cuộc hội thoại. Sẵn sàng crop ảnh mới.', 'success');
    }

    function showStatus(message, type = 'info') {
        const statusClasses = {
            'info': 'info',
            'success': 'success',
            'error': 'error',
            'loading': 'loading'
        };
        
        const className = statusClasses[type] || 'info';
        statusDiv.innerHTML = `<div class="${className}">${message}</div>`;
        
        if (type === 'loading') {
            statusDiv.innerHTML += '<div class="loading">⏳ Đang xử lý...</div>';
        }

        // Auto-clear status after 5 seconds for non-error messages
        if (type !== 'error' && type !== 'loading') {
            setTimeout(() => {
                if (statusDiv.innerHTML.includes(message)) {
                    statusDiv.innerHTML = '';
                }
            }, 5000);
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
        
        // Send message to content script to start crop process
        window.postMessage({
            type: 'INIT_CROP_TOOL',
            timestamp: Date.now()
        }, '*');
        
    } catch (error) {
        console.error('Error in initializeCropTool:', error);
    }
}