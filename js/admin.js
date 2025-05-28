// Admin Panel JavaScript

let currentSection = 'dashboard';
let adminToken = null;

document.addEventListener('DOMContentLoaded', function() {
    checkAdminAuth();
    initializeAdminPanel();
});

// Check admin authentication
function checkAdminAuth() {
    adminToken = localStorage.getItem('adminToken');

    if (!adminToken) {
        showAdminLogin();
        return;
    }

    // Verify token with server
    fetch('/api/auth/verify', {
        headers: {
            'Authorization': `Bearer ${adminToken}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success || !data.user || !data.user.adminId) {
            showAdminLogin();
        } else {
            document.getElementById('adminName').textContent = data.user.username;
            loadDashboardData();
        }
    })
    .catch(error => {
        console.error('Auth verification error:', error);
        showAdminLogin();
    });
}

// Show admin login form
function showAdminLogin() {
    const loginHtml = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 80vh;">
            <div style="background: white; padding: 40px; border-radius: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); max-width: 400px; width: 100%;">
                <h2 style="text-align: center; margin-bottom: 30px; color: #333;">Admin Login</h2>
                <div id="loginError" class="error-message" style="display: none;"></div>
                <form id="adminLoginForm">
                    <div class="form-group">
                        <label class="form-label">Username</label>
                        <input type="text" id="adminUsername" class="form-input" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Password</label>
                        <input type="password" id="adminPassword" class="form-input" required>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%;">Login</button>
                </form>
            </div>
        </div>
    `;

    document.querySelector('.admin-container').innerHTML = loginHtml;

    document.getElementById('adminLoginForm').addEventListener('submit', handleAdminLogin);
}

// Handle admin login
async function handleAdminLogin(e) {
    e.preventDefault();

    const username = document.getElementById('adminUsername').value;
    const password = document.getElementById('adminPassword').value;
    const errorDiv = document.getElementById('loginError');

    try {
        const response = await fetch('/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            adminToken = data.token;
            localStorage.setItem('adminToken', adminToken);
            location.reload();
        } else {
            errorDiv.textContent = data.message;
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        console.error('Login error:', error);
        errorDiv.textContent = 'Login failed. Please try again.';
        errorDiv.style.display = 'block';
    }
}

// Initialize admin panel
function initializeAdminPanel() {
    // User search functionality
    const userSearch = document.getElementById('userSearch');
    if (userSearch) {
        userSearch.addEventListener('input', debounce(searchUsers, 500));
    }

    // Edit investment form
    const editForm = document.getElementById('editInvestmentForm');
    if (editForm) {
        editForm.addEventListener('submit', handleEditInvestment);
    }
}

// Load dashboard data
async function loadDashboardData() {
    try {
        const response = await fetch('/api/admin/dashboard', {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        const data = await response.json();

        if (data.success) {
            updateDashboardStats(data.data.stats);
            updateRecentTransactions(data.data.recentTransactions);
            updatePendingWithdrawals(data.data.pendingWithdrawals);
        }
    } catch (error) {
        console.error('Dashboard load error:', error);
    }
}

// Update dashboard statistics
function updateDashboardStats(stats) {
    document.getElementById('totalUsers').textContent = stats.totalUsers || 0;
    document.getElementById('totalDeposited').textContent = formatCurrency(stats.totalDeposited || 0);
    document.getElementById('totalBalance').textContent = formatCurrency(stats.totalBalance || 0);
    document.getElementById('totalProfit').textContent = formatCurrency(stats.totalProfit || 0);
    document.getElementById('pendingWithdrawals').textContent = stats.pendingWithdrawalsCount || 0;
}

// Update recent transactions
function updateRecentTransactions(transactions) {
    const container = document.getElementById('recentTransactions');

    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<p>No recent transactions</p>';
        return;
    }

    const html = transactions.map(tx => `
        <div style="padding: 10px; border-bottom: 1px solid #e4e4e4; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <strong>${tx.first_name} ${tx.last_name}</strong><br>
                <small>${tx.transaction_type.toUpperCase()}</small>
            </div>
            <div style="text-align: right;">
                <strong>${formatCurrency(tx.amount)}</strong><br>
                <small>${formatDate(tx.created_at)}</small>
            </div>
        </div>
    `).join('');

    container.innerHTML = html;
}

// Update pending withdrawals
function updatePendingWithdrawals(withdrawals) {
    const container = document.getElementById('pendingWithdrawalsList');

    if (!withdrawals || withdrawals.length === 0) {
        container.innerHTML = '<p>No pending withdrawals</p>';
        return;
    }

    const html = withdrawals.map(wd => `
        <div style="padding: 10px; border-bottom: 1px solid #e4e4e4; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <strong>${wd.first_name} ${wd.last_name}</strong><br>
                <small>${formatCurrency(wd.amount)}</small>
            </div>
            <div style="text-align: right;">
                <button class="btn btn-small btn-success" onclick="processWithdrawal(${wd.id}, 'approve')">Approve</button>
                <button class="btn btn-small btn-danger" onclick="processWithdrawal(${wd.id}, 'reject')">Reject</button>
            </div>
        </div>
    `).join('');

    container.innerHTML = html;
}

// Show section
function showSection(section) {
    // Update navigation
    document.querySelectorAll('.admin-nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(sec => {
        sec.classList.remove('active');
    });

    // Show selected section
    document.getElementById(`${section}-section`).classList.add('active');
    currentSection = section;

    // Load section data
    switch(section) {
        case 'users':
            loadUsers();
            break;
        case 'withdrawals':
            loadWithdrawals();
            break;
        case 'transactions':
            loadTransactions();
            break;
        case 'dashboard':
            loadDashboardData();
            break;
    }
}

// Load users
async function loadUsers(search = '') {
    try {
        const url = `/api/admin/users?search=${encodeURIComponent(search)}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        const data = await response.json();

        if (data.success) {
            displayUsersTable(data.data.users);
        }
    } catch (error) {
        console.error('Load users error:', error);
    }
}

// Display users table
function displayUsersTable(users) {
    const container = document.getElementById('usersTable');

    if (!users || users.length === 0) {
        container.innerHTML = '<p>No users found</p>';
        return;
    }

    const html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Balance</th>
                    <th>Profit</th>
                    <th>Progress</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${users.map(user => `
                    <tr>
                        <td>${user.first_name} ${user.last_name}</td>
                        <td>${user.email}</td>
                        <td>${formatCurrency(user.current_balance || 0)}</td>
                        <td>${formatCurrency(user.current_profit || 0)}</td>
                        <td>${Math.round(user.progress_percentage || 0)}%</td>
                        <td>
                            <button class="btn btn-small btn-info" onclick="editUserInvestment(${user.id})">Edit Investment</button>
                            <button class="btn btn-small btn-primary" onclick="addTransaction(${user.id})">Add Transaction</button>
                            <button class="btn btn-small btn-success" onclick="sendDepositSlip(${user.id})">Send Deposit Slip</button>
                            <button class="btn btn-small" style="background: #17a2b8; color: white;" onclick="sendSummary(${user.id})">Send Summary</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    container.innerHTML = html;
}

// Search users
function searchUsers() {
    const search = document.getElementById('userSearch').value;
    loadUsers(search);
}

// Edit user investment
async function editUserInvestment(userId) {
    try {
        // Get user data first
        const response = await fetch(`/api/admin/users?search=`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        const data = await response.json();
        const user = data.data.users.find(u => u.id === userId);

        if (user) {
            document.getElementById('editUserId').value = userId;
            document.getElementById('editInitialDeposit').value = user.initial_deposit || 0;
            document.getElementById('editMonthlyTopup').value = user.monthly_topup || 0;
            document.getElementById('editCurrentProfit').value = user.current_profit || 0;
            document.getElementById('editTargetCash').value = user.target_cash || 500000;
            document.getElementById('editCurrentBalance').value = user.current_balance || 0;
            document.getElementById('editTotalDeposited').value = user.total_deposited || 0;

            document.getElementById('editInvestmentModal').style.display = 'block';
        }
    } catch (error) {
        console.error('Edit investment error:', error);
    }
}

// Handle edit investment form
async function handleEditInvestment(e) {
    e.preventDefault();

    const userId = document.getElementById('editUserId').value;
    const formData = {
        initialDeposit: parseFloat(document.getElementById('editInitialDeposit').value),
        monthlyTopup: parseFloat(document.getElementById('editMonthlyTopup').value),
        currentProfit: parseFloat(document.getElementById('editCurrentProfit').value),
        targetCash: parseFloat(document.getElementById('editTargetCash').value),
        currentBalance: parseFloat(document.getElementById('editCurrentBalance').value),
        totalDeposited: parseFloat(document.getElementById('editTotalDeposited').value)
    };

    try {
        const response = await fetch(`/api/admin/users/${userId}/investment`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (data.success) {
            closeModal('editInvestmentModal');
            showNotification('Investment updated successfully', 'success');
            loadUsers();
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        console.error('Update investment error:', error);
        showNotification('Failed to update investment', 'error');
    }
}

// Utility functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Admin logout
function adminLogout() {
    localStorage.removeItem('adminToken');
    window.location.href = '/admin';
}

// Send deposit slip to user
async function sendDepositSlip(userId) {
    const amount = prompt('Enter deposit amount:');
    const transactionType = prompt('Enter transaction type (deposit/topup):') || 'deposit';

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        showNotification('Please enter a valid amount', 'error');
        return;
    }

    if (!['deposit', 'topup'].includes(transactionType.toLowerCase())) {
        showNotification('Transaction type must be deposit or topup', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/admin/users/${userId}/send-deposit-slip`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                amount: parseFloat(amount),
                transactionType: transactionType.toLowerCase()
            })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Deposit slip sent successfully to user email', 'success');
        } else {
            showNotification(data.message || 'Failed to send deposit slip', 'error');
        }
    } catch (error) {
        console.error('Send deposit slip error:', error);
        showNotification('Failed to send deposit slip', 'error');
    }
}

// Send investment summary to user
async function sendSummary(userId) {
    if (!confirm('Send investment summary to user email?')) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/users/${userId}/send-summary`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Investment summary sent successfully to user email', 'success');
        } else {
            showNotification(data.message || 'Failed to send summary', 'error');
        }
    } catch (error) {
        console.error('Send summary error:', error);
        showNotification('Failed to send investment summary', 'error');
    }
}

// Load withdrawals
async function loadWithdrawals() {
    try {
        const response = await fetch('/api/admin/withdrawals', {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        const data = await response.json();

        if (data.success) {
            displayWithdrawalsTable(data.data.withdrawals);
        }
    } catch (error) {
        console.error('Load withdrawals error:', error);
    }
}

// Display withdrawals table
function displayWithdrawalsTable(withdrawals) {
    const container = document.getElementById('withdrawalsTable');

    if (!withdrawals || withdrawals.length === 0) {
        container.innerHTML = '<p>No withdrawal requests found</p>';
        return;
    }

    const html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>User</th>
                    <th>Amount</th>
                    <th>Address</th>
                    <th>Status</th>
                    <th>Requested</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${withdrawals.map(wd => `
                    <tr>
                        <td>${wd.first_name} ${wd.last_name}</td>
                        <td>${formatCurrency(wd.amount)}</td>
                        <td style="word-break: break-all; max-width: 200px;">${wd.withdrawal_address}</td>
                        <td><span class="status-badge status-${wd.status}">${wd.status}</span></td>
                        <td>${formatDate(wd.requested_at)}</td>
                        <td>
                            ${wd.status === 'pending' ? `
                                <button class="btn btn-small btn-success" onclick="processWithdrawal(${wd.id}, 'approve')">Approve</button>
                                <button class="btn btn-small btn-danger" onclick="processWithdrawal(${wd.id}, 'reject')">Reject</button>
                            ` : wd.receipt_url ? `
                                <a href="${wd.receipt_url}?print=true" target="_blank" class="btn btn-small btn-info">View Receipt</a>
                            ` : 'N/A'}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    container.innerHTML = html;
}

// Process withdrawal
async function processWithdrawal(requestId, action) {
    const reason = action === 'reject' ? prompt('Enter rejection reason:') : null;
    const transactionHash = action === 'approve' ? prompt('Enter transaction hash (optional):') : null;

    if (action === 'reject' && !reason) {
        showNotification('Rejection reason is required', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/admin/withdrawals/${requestId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                action,
                reason,
                transactionHash
            })
        });

        const data = await response.json();

        if (data.success) {
            showNotification(`Withdrawal ${action}d successfully`, 'success');
            loadWithdrawals();
            loadDashboardData(); // Refresh dashboard stats

            if (action === 'approve' && data.receiptUrl) {
                // Open receipt in new tab
                window.open(data.receiptUrl + '?print=true', '_blank');
            }
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        console.error('Process withdrawal error:', error);
        showNotification('Failed to process withdrawal', 'error');
    }
}

// Load transactions
async function loadTransactions() {
    try {
        const response = await fetch('/api/admin/transactions', {
            headers: {
                'Authorization': `Bearer ${adminToken}`
            }
        });

        const data = await response.json();

        if (data.success) {
            displayTransactionsTable(data.data.transactions);
        }
    } catch (error) {
        console.error('Load transactions error:', error);
    }
}

// Display transactions table
function displayTransactionsTable(transactions) {
    const container = document.getElementById('transactionsTable');

    if (!transactions || transactions.length === 0) {
        container.innerHTML = '<p>No transactions found</p>';
        return;
    }

    const html = `
        <table class="data-table">
            <thead>
                <tr>
                    <th>User</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${transactions.map(tx => `
                    <tr>
                        <td>${tx.first_name} ${tx.last_name}</td>
                        <td>${tx.transaction_type.toUpperCase()}</td>
                        <td>${formatCurrency(tx.amount)}</td>
                        <td><span class="status-badge status-${tx.status}">${tx.status}</span></td>
                        <td>${formatDate(tx.created_at)}</td>
                        <td>
                            ${tx.receipt_url ? `
                                <a href="${tx.receipt_url}?print=true" target="_blank" class="btn btn-small btn-info">View Receipt</a>
                            ` : 'N/A'}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    container.innerHTML = html;
}

// Add transaction for user
async function addTransaction(userId) {
    const type = prompt('Transaction type (deposit/withdrawal/profit/topup):');
    const amount = prompt('Enter amount:');
    const description = prompt('Enter description (optional):');

    if (!type || !['deposit', 'withdrawal', 'profit', 'topup'].includes(type.toLowerCase())) {
        showNotification('Invalid transaction type', 'error');
        return;
    }

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        showNotification('Please enter a valid amount', 'error');
        return;
    }

    try {
        const response = await fetch(`/api/admin/users/${userId}/transactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                type: type.toLowerCase(),
                amount: parseFloat(amount),
                description
            })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Transaction added successfully', 'success');
            loadUsers();
            loadDashboardData();
        } else {
            showNotification(data.message, 'error');
        }
    } catch (error) {
        console.error('Add transaction error:', error);
        showNotification('Failed to add transaction', 'error');
    }
}

// Global functions
window.showSection = showSection;
window.editUserInvestment = editUserInvestment;
window.sendDepositSlip = sendDepositSlip;
window.sendSummary = sendSummary;
window.adminLogout = adminLogout;
window.closeModal = closeModal;
window.processWithdrawal = processWithdrawal;
window.addTransaction = addTransaction;
