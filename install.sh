#!/bin/bash

echo "🚀 Installing MPI Strategy Web Application..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "Visit: https://nodejs.org/"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are installed"

# Install dependencies one by one to avoid issues
echo "📦 Installing dependencies..."

npm install express@4.18.2 --save
npm install express-session@1.17.3 --save
npm install express-rate-limit@6.7.0 --save
npm install helmet@6.1.5 --save
npm install cors@2.8.5 --save
npm install bcryptjs@2.4.3 --save
npm install jsonwebtoken@9.0.0 --save
npm install sqlite3@5.1.6 --save
npm install express-validator@6.15.0 --save
npm install nodemailer@6.9.1 --save
npm install compression@1.7.4 --save
npm install morgan@1.10.0 --save
npm install dotenv@16.0.3 --save
npm install qrcode@1.5.3 --save

echo "✅ Dependencies installed successfully"

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p database
mkdir -p uploads/receipts
mkdir -p logs

echo "✅ Directories created"

# Initialize database
echo "📊 Initializing database..."
node setup.js

echo "🎉 Installation completed successfully!"
echo ""
echo "🚀 To start the application:"
echo "   npm start"
echo ""
echo "🌐 Access points:"
echo "   Main Website: http://localhost:3000"
echo "   Admin Panel: http://localhost:3000/admin"
echo ""
echo "🔐 Admin Credentials:"
echo "   Username: mpi_admin"
echo "   Password: MPI@Admin2024!Secure"
echo ""
echo "👤 Demo User:"
echo "   Email: demo@mpi.com"
echo "   Password: demo123"
echo ""
echo "💰 Bitcoin Wallet: 1DhLUp1pkeitZremqKu8fA2BdB9zqZ21QC"
echo "📧 Contact Email: Mpisecuredcomparedinterest@gmail.com"
echo "📞 Contact Phone: +1 239 487 4213"
