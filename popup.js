let conversationHistory = [];
let currentImageBase64 = null;

document.addEventListener('DOMContentLoaded', function() {
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

    // Load saved data
    chrome.storage.sync.get(['openai_api_key'], function(result) {
        if (result.openai_api_key) {
            apiKeyInput.value = result.openai_api_key;
        }
    });

    // Load saved conversation and image
    chrome.storage.local.get(['currentImageBase64', 'conversationHistory'], function(result) {
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

    // Save API key when changed
    apiKeyInput.addEventListener('change', function() {
        chrome.storage.sync.set({
            openai_api_key: apiKeyInput.value
        });
    });

    // Crop button click
    cropBtn.addEventListener('click', function() {
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
            
            showStatus('Thành công! Bạn có thể tiếp tục hội thoại.', 'success');
            
            // Show chat interface
            chatContainer.style.display = 'block';
            followUpDiv.style.display = 'block';
            clearBtn.style.display = 'block';
            
        } catch (error) {
            console.error('Error calling OpenAI API:', error);
            showStatus(`Lỗi: ${error.message}`, 'error');
        }
    }

    function sendFollowUpMessage(message) {
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

    function clearConversation() {
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
});

// Function to be injected into the content script
function initializeCropTool() {
    console.log('Initializing crop tool...');
    window.postMessage({type: 'INIT_CROP_TOOL'}, '*');
}