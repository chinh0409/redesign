// Test script để verify Extension Context Recovery System
// Chạy trong Chrome DevTools console

const ContextRecoveryTester = {
    testResults: [],
    
    // Test 1: Basic context check
    async testBasicContextCheck() {
        console.log('🧪 Test 1: Basic Context Check');
        
        try {
            const hasContext = !!(chrome?.runtime?.id);
            const result = {
                test: 'Basic Context Check',
                passed: hasContext,
                details: hasContext ? 'Context available' : 'Context missing',
                timestamp: new Date().toISOString()
            };
            
            this.testResults.push(result);
            console.log(hasContext ? '✅ PASS' : '❌ FAIL', result.details);
            return result;
        } catch (error) {
            const result = {
                test: 'Basic Context Check',
                passed: false,
                details: `Error: ${error.message}`,
                timestamp: new Date().toISOString()
            };
            this.testResults.push(result);
            console.log('❌ FAIL', result.details);
            return result;
        }
    },
    
    // Test 2: Message sending capability
    async testMessageSending() {
        console.log('🧪 Test 2: Message Sending Capability');
        
        return new Promise((resolve) => {
            try {
                const timeout = setTimeout(() => {
                    const result = {
                        test: 'Message Sending',
                        passed: false,
                        details: 'Timeout after 5 seconds',
                        timestamp: new Date().toISOString()
                    };
                    this.testResults.push(result);
                    console.log('❌ FAIL', result.details);
                    resolve(result);
                }, 5000);
                
                chrome.runtime.sendMessage({action: 'test_ping'}, (response) => {
                    clearTimeout(timeout);
                    
                    const success = !chrome.runtime.lastError;
                    const result = {
                        test: 'Message Sending',
                        passed: success,
                        details: success ? 'Message sent successfully' : chrome.runtime.lastError.message,
                        timestamp: new Date().toISOString()
                    };
                    
                    this.testResults.push(result);
                    console.log(success ? '✅ PASS' : '❌ FAIL', result.details);
                    resolve(result);
                });
            } catch (error) {
                const result = {
                    test: 'Message Sending',
                    passed: false,
                    details: `Error: ${error.message}`,
                    timestamp: new Date().toISOString()
                };
                this.testResults.push(result);
                console.log('❌ FAIL', result.details);
                resolve(result);
            }
        });
    },
    
    // Test 3: Storage access
    async testStorageAccess() {
        console.log('🧪 Test 3: Storage Access');
        
        return new Promise((resolve) => {
            try {
                const testKey = 'context_test_' + Date.now();
                const testValue = 'test_value';
                
                chrome.storage.local.set({[testKey]: testValue}, () => {
                    if (chrome.runtime.lastError) {
                        const result = {
                            test: 'Storage Access',
                            passed: false,
                            details: chrome.runtime.lastError.message,
                            timestamp: new Date().toISOString()
                        };
                        this.testResults.push(result);
                        console.log('❌ FAIL', result.details);
                        resolve(result);
                        return;
                    }
                    
                    chrome.storage.local.get([testKey], (data) => {
                        const success = !chrome.runtime.lastError && data[testKey] === testValue;
                        const result = {
                            test: 'Storage Access',
                            passed: success,
                            details: success ? 'Storage read/write successful' : 'Storage access failed',
                            timestamp: new Date().toISOString()
                        };
                        
                        // Cleanup
                        chrome.storage.local.remove([testKey]);
                        
                        this.testResults.push(result);
                        console.log(success ? '✅ PASS' : '❌ FAIL', result.details);
                        resolve(result);
                    });
                });
            } catch (error) {
                const result = {
                    test: 'Storage Access',
                    passed: false,
                    details: `Error: ${error.message}`,
                    timestamp: new Date().toISOString()
                };
                this.testResults.push(result);
                console.log('❌ FAIL', result.details);
                resolve(result);
            }
        });
    },
    
    // Test 4: Tab access for content script injection
    async testTabAccess() {
        console.log('🧪 Test 4: Tab Access');
        
        return new Promise((resolve) => {
            try {
                chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                    const success = !chrome.runtime.lastError && tabs && tabs.length > 0;
                    const result = {
                        test: 'Tab Access',
                        passed: success,
                        details: success ? `Active tab found: ${tabs[0]?.url}` : 'No active tab found',
                        timestamp: new Date().toISOString()
                    };
                    
                    this.testResults.push(result);
                    console.log(success ? '✅ PASS' : '❌ FAIL', result.details);
                    resolve(result);
                });
            } catch (error) {
                const result = {
                    test: 'Tab Access',
                    passed: false,
                    details: `Error: ${error.message}`,
                    timestamp: new Date().toISOString()
                };
                this.testResults.push(result);
                console.log('❌ FAIL', result.details);
                resolve(result);
            }
        });
    },
    
    // Test 5: Extension management access
    async testExtensionManagement() {
        console.log('🧪 Test 5: Extension Management');
        
        return new Promise((resolve) => {
            try {
                chrome.management.getSelf((info) => {
                    const success = !chrome.runtime.lastError && info;
                    const result = {
                        test: 'Extension Management',
                        passed: success,
                        details: success ? `Extension info: ${info.name} v${info.version}` : 'Cannot access extension info',
                        timestamp: new Date().toISOString()
                    };
                    
                    this.testResults.push(result);
                    console.log(success ? '✅ PASS' : '❌ FAIL', result.details);
                    resolve(result);
                });
            } catch (error) {
                const result = {
                    test: 'Extension Management',
                    passed: false,
                    details: `Error: ${error.message}`,
                    timestamp: new Date().toISOString()
                };
                this.testResults.push(result);
                console.log('❌ FAIL', result.details);
                resolve(result);
            }
        });
    },
    
    // Run all tests
    async runAllTests() {
        console.log('🚀 Starting Extension Context Recovery Tests...\n');
        this.testResults = [];
        
        await this.testBasicContextCheck();
        await this.testMessageSending();
        await this.testStorageAccess();
        await this.testTabAccess();
        await this.testExtensionManagement();
        
        console.log('\n📊 Test Results Summary:');
        console.log('========================');
        
        const passedTests = this.testResults.filter(r => r.passed).length;
        const totalTests = this.testResults.length;
        
        this.testResults.forEach(result => {
            console.log(`${result.passed ? '✅' : '❌'} ${result.test}: ${result.details}`);
        });
        
        console.log(`\n📈 Overall: ${passedTests}/${totalTests} tests passed (${Math.round(passedTests/totalTests*100)}%)`);
        
        if (passedTests === totalTests) {
            console.log('🎉 All tests passed! Extension context is healthy.');
        } else {
            console.log('⚠️ Some tests failed. Extension may need troubleshooting.');
        }
        
        return {
            passed: passedTests,
            total: totalTests,
            success: passedTests === totalTests,
            results: this.testResults
        };
    },
    
    // Monitor context health over time
    startHealthMonitoring(durationMinutes = 5) {
        console.log(`🔍 Starting ${durationMinutes} minute health monitoring...`);
        
        let checks = 0;
        let failures = 0;
        
        const healthCheck = () => {
            checks++;
            try {
                const hasContext = !!(chrome?.runtime?.id);
                if (!hasContext) {
                    failures++;
                    console.log(`❌ Health check ${checks}: Context lost`);
                } else {
                    console.log(`✅ Health check ${checks}: Context healthy`);
                }
            } catch (error) {
                failures++;
                console.log(`❌ Health check ${checks}: Error - ${error.message}`);
            }
        };
        
        const interval = setInterval(healthCheck, 10000); // Every 10 seconds
        
        setTimeout(() => {
            clearInterval(interval);
            console.log(`\n📊 Health Monitoring Complete:`);
            console.log(`Total checks: ${checks}`);
            console.log(`Failures: ${failures}`);
            console.log(`Success rate: ${Math.round((checks-failures)/checks*100)}%`);
        }, durationMinutes * 60 * 1000);
        
        return interval;
    }
};

// Expose to global scope
window.ContextRecoveryTester = ContextRecoveryTester;

// Usage instructions
console.log(`
🔧 Extension Context Recovery Tester
====================================

Available commands:

1. Run all tests:
   ContextRecoveryTester.runAllTests()

2. Run individual tests:
   ContextRecoveryTester.testBasicContextCheck()
   ContextRecoveryTester.testMessageSending()
   ContextRecoveryTester.testStorageAccess()
   ContextRecoveryTester.testTabAccess()
   ContextRecoveryTester.testExtensionManagement()

3. Start health monitoring (5 minutes):
   ContextRecoveryTester.startHealthMonitoring()

4. Custom monitoring duration:
   ContextRecoveryTester.startHealthMonitoring(10) // 10 minutes

Quick test: ContextRecoveryTester.runAllTests()
`);

// Auto-run basic test
console.log('Running quick context check...');
ContextRecoveryTester.testBasicContextCheck();