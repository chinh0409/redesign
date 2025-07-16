# Extension Context Recovery System

## Mô tả vấn đề
Lỗi "Extension context lost during monitoring, cleaning up..." xảy ra khi:

1. **Extension bị reload** bởi Chrome
2. **Service worker bị restart** 
3. **Browser bị update** hoặc restart
4. **Extension bị disable/enable**
5. **Chrome context invalidation** do memory pressure

## Giải pháp đã triển khai

### 1. Enhanced Context Monitoring (content.js)

#### Context Recovery với Exponential Backoff:
```javascript
function attemptContextRecovery() {
    contextRecoveryAttempts++;
    
    if (contextRecoveryAttempts <= MAX_RECOVERY_ATTEMPTS) {
        setTimeout(() => {
            if (isExtensionContextValid()) {
                console.log('✅ Extension context recovered');
                setupMessageListener();
                contextRecoveryAttempts = 0;
            } else {
                attemptContextRecovery(); // Retry
            }
        }, 2000 * contextRecoveryAttempts); // Exponential backoff
    }
}
```

#### Visual User Notification:
- Hiển thị thông báo context lost cho user
- Clickable notification để reload extension
- Auto-remove sau 30 giây

### 2. Service Worker Lifecycle Management (background.js)

#### Health Monitoring:
```javascript
function monitorServiceWorkerHealth() {
    const uptime = Date.now() - serviceWorkerStartTime;
    console.log(`Service worker uptime: ${Math.round(uptime / 1000)}s`);
    
    if (uptime > 300000) { // 5 minutes
        console.warn('Service worker running extended time');
    }
}
```

#### Connection Tracking:
- Track active connections
- Monitor disconnect events
- Cleanup stale connections

### 3. Popup Context Management (popup.js)

#### Proactive Context Checking:
```javascript
function checkAndRecoverContext() {
    try {
        if (!chrome?.runtime?.id) {
            showContextLostUI();
            return false;
        }
        return true;
    } catch (error) {
        showContextLostUI();
        return false;
    }
}
```

#### User-Friendly Recovery UI:
- Clear error message
- Action buttons for recovery
- Automatic context re-checking

### 4. Enhanced Cleanup System

#### Comprehensive Resource Cleanup:
```javascript
function cleanupExtensionResources() {
    // Stop monitoring
    if (contextCheckInterval) {
        clearInterval(contextCheckInterval);
    }
    
    // Remove listeners
    window.removeEventListener('message', handleWindowMessage);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('error', handleWindowError);
    
    // Reset state
    contextRecoveryAttempts = 0;
    isProcessing = false;
}
```

## Tính năng mới

### 1. Auto Recovery
- **Automatic retry** với exponential backoff
- **Maximum retry limit** (5 attempts)
- **Success detection** và state reset

### 2. User Notification
- **Visual feedback** khi context lost
- **Action buttons** cho recovery
- **Non-intrusive display** (auto-remove)

### 3. Health Monitoring
- **Service worker uptime** tracking
- **Connection monitoring**
- **Periodic health checks**

### 4. Graceful Degradation
- **Cleanup on failure**
- **State preservation** where possible
- **Error reporting** cho debugging

## Benefits

### ✅ Improved Reliability
- Extension tự recover sau context loss
- Giảm cần reload manual
- Better error handling

### ✅ Better User Experience  
- Clear feedback về issues
- Easy recovery actions
- Reduced interruption

### ✅ Enhanced Debugging
- Detailed logging
- Health monitoring
- Connection tracking

### ✅ Resource Management
- Proper cleanup
- Memory leak prevention
- Performance optimization

## Usage Instructions

### For Users:
1. Nếu thấy notification context lost → **click để reload**
2. Hoặc manually reload extension tại **chrome://extensions/**
3. Extension sẽ tự recovery trong background

### For Developers:
1. Monitor console logs để tracking health
2. Check service worker logs tại extensions page
3. Enable developer mode để debug details

## Monitoring Commands

```javascript
// Check extension health
chrome.runtime.getManifest()

// Monitor service worker
chrome.runtime.getBackgroundPage()

// Check connections
// (logged automatically every minute)
```

## Recovery Scenarios

### Scenario 1: Service Worker Restart
- **Detection**: Context validation fails
- **Action**: Auto retry với backoff
- **Fallback**: User notification

### Scenario 2: Extension Reload
- **Detection**: Runtime ID changes
- **Action**: Cleanup resources
- **Recovery**: Re-initialize on next load

### Scenario 3: Browser Update
- **Detection**: All contexts invalidated
- **Action**: Full cleanup
- **Recovery**: Fresh start sau restart

## Testing

### Manual Tests:
1. **Reload extension** nhiều lần
2. **Disable/enable** extension
3. **Update Chrome** browser
4. **Long running sessions** (>5 minutes)

### Automated Monitoring:
- Health checks every 30 seconds
- Context validation every 10 seconds
- Connection monitoring every minute

## Error Codes

- `CONTEXT_LOST_001`: Initial context validation failed
- `CONTEXT_LOST_002`: Context lost during monitoring
- `CONTEXT_LOST_003`: Recovery attempts exceeded
- `CONTEXT_LOST_004`: Service worker health issues

## Best Practices

1. **Always check context** trước operations
2. **Implement retry logic** cho critical operations
3. **Provide user feedback** cho context issues
4. **Monitor health metrics** for proactive detection
5. **Clean up resources** properly on failures