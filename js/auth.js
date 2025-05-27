// Authentication JavaScript

document.addEventListener('DOMContentLoaded', function() {
    initAuthForms();
    initPasswordToggle();
    initFormValidation();
});

// Initialize Authentication Forms
function initAuthForms() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
}

// Handle Login Form Submission
async function handleLogin(e) {
    e.preventDefault();

    const form = e.target;
    const email = form.querySelector('#email').value;
    const password = form.querySelector('#password').value;
    const rememberMe = form.querySelector('#rememberMe')?.checked || false;
    const submitBtn = form.querySelector('.auth-btn');

    // Clear previous errors
    clearFormErrors(form);

    // Validate form
    if (!validateLoginForm(email, password)) {
        return;
    }

    // Show loading state
    setLoadingState(submitBtn, true);

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (data.success) {
            // Store user data and token
            const storage = rememberMe ? localStorage : sessionStorage;
            storage.setItem('currentUser', JSON.stringify(data.user));
            storage.setItem('authToken', data.token);

            showSuccessMessage('Login successful! Redirecting...');

            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } else {
            showFormError(form, data.message || 'Invalid email or password');
        }
    } catch (error) {
        console.error('Login error:', error);
        showFormError(form, 'Login failed. Please try again.');
    } finally {
        setLoadingState(submitBtn, false);
    }
}

// Handle Register Form Submission
async function handleRegister(e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    const submitBtn = form.querySelector('.auth-btn');

    // Clear previous errors
    clearFormErrors(form);

    // Validate form
    if (!validateRegisterForm(data)) {
        return;
    }

    // Show loading state
    setLoadingState(submitBtn, true);

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
            // Store user data and token
            localStorage.setItem('currentUser', JSON.stringify(result.user));
            localStorage.setItem('authToken', result.token);

            showSuccessMessage('Registration successful! Redirecting...');

            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);
        } else {
            showFormError(form, result.message || 'Registration failed');
        }

    } catch (error) {
        console.error('Registration error:', error);
        showFormError(form, 'Registration failed. Please try again.');
    } finally {
        setLoadingState(submitBtn, false);
    }
}

// Form Validation
function validateLoginForm(email, password) {
    let isValid = true;

    if (!email || !isValidEmail(email)) {
        showFieldError('email', 'Please enter a valid email address');
        isValid = false;
    }

    if (!password || password.length < 6) {
        showFieldError('password', 'Password must be at least 6 characters');
        isValid = false;
    }

    return isValid;
}

function validateRegisterForm(data) {
    let isValid = true;

    if (!data.firstName || data.firstName.trim().length < 2) {
        showFieldError('firstName', 'First name must be at least 2 characters');
        isValid = false;
    }

    if (!data.lastName || data.lastName.trim().length < 2) {
        showFieldError('lastName', 'Last name must be at least 2 characters');
        isValid = false;
    }

    if (!data.email || !isValidEmail(data.email)) {
        showFieldError('email', 'Please enter a valid email address');
        isValid = false;
    }

    if (!data.password || data.password.length < 8) {
        showFieldError('password', 'Password must be at least 8 characters');
        isValid = false;
    }

    if (data.password !== data.confirmPassword) {
        showFieldError('confirmPassword', 'Passwords do not match');
        isValid = false;
    }

    if (!data.terms) {
        showFieldError('terms', 'You must agree to the terms and conditions');
        isValid = false;
    }

    return isValid;
}

// Password Toggle Functionality
function initPasswordToggle() {
    const passwordToggles = document.querySelectorAll('.password-toggle-btn');

    passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', function() {
            const passwordInput = this.parentElement.querySelector('input');
            const icon = this.querySelector('i');

            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });
}

// Form Validation on Input
function initFormValidation() {
    const formInputs = document.querySelectorAll('.form-input');

    formInputs.forEach(input => {
        input.addEventListener('blur', function() {
            validateField(this);
        });

        input.addEventListener('input', function() {
            clearFieldError(this.id);
        });
    });
}

function validateField(field) {
    const value = field.value.trim();
    const fieldName = field.id;

    switch (fieldName) {
        case 'email':
            if (!value || !isValidEmail(value)) {
                showFieldError(fieldName, 'Please enter a valid email address');
                return false;
            }
            break;
        case 'password':
            if (!value || value.length < 8) {
                showFieldError(fieldName, 'Password must be at least 8 characters');
                return false;
            }
            break;
        case 'confirmPassword':
            const password = document.getElementById('password')?.value;
            if (value !== password) {
                showFieldError(fieldName, 'Passwords do not match');
                return false;
            }
            break;
        case 'firstName':
        case 'lastName':
            if (!value || value.length < 2) {
                showFieldError(fieldName, 'This field must be at least 2 characters');
                return false;
            }
            break;
    }

    clearFieldError(fieldName);
    return true;
}

// Utility Functions
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorElement = field.parentElement.querySelector('.error-message');

    field.classList.add('error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.add('show');
    }
}

function clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    const errorElement = field.parentElement.querySelector('.error-message');

    field.classList.remove('error');
    if (errorElement) {
        errorElement.classList.remove('show');
    }
}

function clearFormErrors(form) {
    const errorInputs = form.querySelectorAll('.form-input.error');
    const errorMessages = form.querySelectorAll('.error-message.show');

    errorInputs.forEach(input => input.classList.remove('error'));
    errorMessages.forEach(message => message.classList.remove('show'));
}

function showFormError(form, message) {
    let errorDiv = form.querySelector('.form-error');

    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'form-error';
        errorDiv.style.cssText = `
            background: #f8d7da;
            color: #721c24;
            padding: 12px 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            border: 1px solid #f5c6cb;
        `;
        form.insertBefore(errorDiv, form.firstChild);
    }

    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

function showSuccessMessage(message) {
    const successDiv = document.querySelector('.success-message');
    if (successDiv) {
        successDiv.textContent = message;
        successDiv.classList.add('show');
    }
}

function setLoadingState(button, isLoading) {
    if (isLoading) {
        button.classList.add('loading');
        button.disabled = true;
        button.innerHTML = '<span class="loading-spinner"></span>Processing...';
    } else {
        button.classList.remove('loading');
        button.disabled = false;
        button.innerHTML = button.dataset.originalText || 'Submit';
    }
}

function simulateApiCall(delay) {
    return new Promise(resolve => setTimeout(resolve, delay));
}

// Mock Authentication Functions (replace with real API calls)
function authenticateUser(email, password) {
    // Mock user database
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        return {
            id: user.id,
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName
        };
    }

    // Default demo user
    if (email === 'demo@mpi.com' && password === 'demo123') {
        return {
            id: 'demo',
            name: 'Demo User',
            email: 'demo@mpi.com',
            firstName: 'Demo',
            lastName: 'User'
        };
    }

    return null;
}

function userExists(email) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    return users.some(u => u.email === email);
}

function createUser(data) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');

    const newUser = {
        id: Date.now().toString(),
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password, // In real app, this would be hashed
        createdAt: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));

    return {
        id: newUser.id,
        name: `${newUser.firstName} ${newUser.lastName}`,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName
    };
}
