// Script để reload extension khi gặp lỗi context
// Chạy script này trong Chrome DevTools console tại trang chrome://extensions/

function reloadAIScreenCropExtension() {
    // Tìm extension AI Screen Crop
    const extensions = document.querySelectorAll('extensions-item');
    let targetExtension = null;
    
    extensions.forEach(ext => {
        const nameElement = ext.shadowRoot?.querySelector('#name');
        if (nameElement && nameElement.textContent.includes('AI Screen Crop')) {
            targetExtension = ext;
        }
    });
    
    if (targetExtension) {
        // Click vào reload button
        const reloadButton = targetExtension.shadowRoot?.querySelector('#reloadButton');
        if (reloadButton) {
            reloadButton.click();
            console.log('✅ AI Screen Crop extension đã được reload!');
            return true;
        } else {
            console.log('❌ Không tìm thấy reload button');
        }
    } else {
        console.log('❌ Không tìm thấy AI Screen Crop extension');
    }
    
    return false;
}

// Auto reload function với monitoring
function monitorAndReloadExtension() {
    console.log('🔍 Bắt đầu monitor AI Screen Crop extension...');
    
    // Check extension context periodically
    const checkInterval = setInterval(() => {
        try {
            // Kiểm tra xem extension có đang hoạt động không
            chrome.management.getAll((extensions) => {
                const aiScreenCrop = extensions.find(ext => 
                    ext.name.includes('AI Screen Crop')
                );
                
                if (aiScreenCrop && !aiScreenCrop.enabled) {
                    console.log('⚠️ Extension bị disable, đang bật lại...');
                    chrome.management.setEnabled(aiScreenCrop.id, true);
                }
            });
        } catch (error) {
            console.log('❌ Extension context error detected:', error.message);
            console.log('🔄 Attempting auto reload...');
            
            if (reloadAIScreenCropExtension()) {
                clearInterval(checkInterval);
                console.log('✅ Extension đã được reload thành công!');
            }
        }
    }, 10000); // Check every 10 seconds
    
    // Auto stop monitoring after 5 minutes
    setTimeout(() => {
        clearInterval(checkInterval);
        console.log('⏹️ Dừng monitoring extension');
    }, 300000);
    
    return checkInterval;
}

// Usage instructions
console.log(`
🔧 AI Screen Crop Extension Reload Script
==========================================

Cách sử dụng:

1. Manual reload:
   reloadAIScreenCropExtension()

2. Auto monitoring (chạy 5 phút):
   monitorAndReloadExtension()

3. Để dừng monitoring:
   clearInterval(intervalId)

Note: Script này chỉ hoạt động trên trang chrome://extensions/
`);

// Export functions to global scope
window.reloadAIScreenCropExtension = reloadAIScreenCropExtension;
window.monitorAndReloadExtension = monitorAndReloadExtension;