// Simple test script to verify API endpoints
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001';

async function testAPI() {
    console.log('🧪 Testing MPI Strategy API endpoints...\n');

    // Test 1: Check if server is running
    try {
        const response = await fetch(BASE_URL);
        console.log('✅ Server is running on port 3001');
    } catch (error) {
        console.log('❌ Server is not running:', error.message);
        return;
    }

    // Test 2: Test user registration
    try {
        const registerResponse = await fetch(`${BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                firstName: 'Test',
                lastName: 'User',
                email: 'test@example.com',
                password: 'testpassword123',
                confirmPassword: 'testpassword123',
                terms: true
            })
        });

        const registerData = await registerResponse.json();
        
        if (registerData.success) {
            console.log('✅ User registration working');
            
            // Test 3: Test deposit info endpoint
            const token = registerData.token;
            const depositResponse = await fetch(`${BASE_URL}/api/user/deposit-info`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const depositData = await depositResponse.json();
            
            if (depositData.success && depositData.data.bitcoinAddress) {
                console.log('✅ Bitcoin deposit info endpoint working');
                console.log('📍 Bitcoin Address:', depositData.data.bitcoinAddress);
                console.log('🔗 QR Code generated successfully');
            } else {
                console.log('❌ Bitcoin deposit info endpoint failed:', depositData.message);
            }

            // Test 4: Test dashboard endpoint
            const dashboardResponse = await fetch(`${BASE_URL}/api/user/dashboard`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const dashboardData = await dashboardResponse.json();
            
            if (dashboardData.success) {
                console.log('✅ Dashboard endpoint working');
            } else {
                console.log('❌ Dashboard endpoint failed:', dashboardData.message);
            }

        } else {
            console.log('❌ User registration failed:', registerData.message);
        }

    } catch (error) {
        console.log('❌ API test failed:', error.message);
    }

    console.log('\n🏁 API testing completed!');
}

// Run the test
testAPI();
