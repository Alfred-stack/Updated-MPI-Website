// Test environment variables loading
require('dotenv').config();

console.log('🔍 Testing Environment Variables:');
console.log('PORT:', process.env.PORT);
console.log('JWT_SECRET:', process.env.JWT_SECRET);
console.log('ADMIN_USERNAME:', process.env.ADMIN_USERNAME);
console.log('ADMIN_PASSWORD:', process.env.ADMIN_PASSWORD);
console.log('BITCOIN_WALLET_ADDRESS:', process.env.BITCOIN_WALLET_ADDRESS);

if (process.env.JWT_SECRET && process.env.ADMIN_USERNAME && process.env.BITCOIN_WALLET_ADDRESS) {
    console.log('✅ All environment variables loaded successfully!');
} else {
    console.log('❌ Some environment variables are missing!');
}
