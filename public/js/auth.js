// Authentication Manager Class
class AuthManager {
    constructor(app) {
        this.app = app;
        this.API_URL = 'https://chatterbox-vly4.onrender.com'; // Render backend
        this.setupEventListeners();
    }

    setupEventListeners() {
        console.log('Setting up auth event listeners...');
        
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        const token = urlParams.get('token');
        
        console.log('URL params:', { error, token });
        
        if (error) {
            console.log('Handling auth error:', error);
            this.handleAuthError(error);
            window.history.replaceState({}, document.title, '/');
        }
        
        // Handle OAuth callback with token
        if (token) {
            console.log('Handling OAuth callback with token:', token);
            this.handleOAuthCallback(token);
            window.history.replaceState({}, document.title, '/');
        }

        // Setup Google login button
        const loginBtn = document.getElementById('google-login-btn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.loginWithGoogle());
        }

        // Setup logout button
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    }

    loginWithGoogle() {
        try {
            console.log("Attempting Google login...");
            const loginBtn = document.getElementById("google-login-btn");
            if (loginBtn) {
                loginBtn.disabled = true;
                loginBtn.innerHTML = `
                    <div class="spinner" style="width: 20px; height: 20px; margin-right: 8px;"></div>
                    <span>Connecting...</span>
                `;
            }
            window.location.href = `${this.API_URL}/api/auth/google`;
        } catch (error) {
            console.error('Google login error:', error);
            this.app.ui.showToast('Failed to initiate Google login', 'error');
            this.resetLoginButton();
        }
    }

    async logout() {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userData');
            window.location.href = '/';
        }
    }

    async verifyToken(token) {
        if (!token) {
            console.log('No token provided for verification');
            return null;
        }
        try {
            console.log('Making request to verify token...');
            const response = await fetch(`${this.API_URL}/api/auth/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            console.log('Token verification response status:', response.status);

            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Token verification response data:', data);
            
            if (data.success && data.user) {
                localStorage.setItem('userData', JSON.stringify(data.user));
                console.log('User data stored in localStorage');
                return data.user;
            } else {
                console.log('Token verification failed');
                return null;
            }
        } catch (error) {
            console.error('Token verification error:', error);
            localStorage.removeItem('authToken');
            localStorage.removeItem('userData');
            return null;
        }
    }

    async updateProfile(profileData) {
        try {
            const response = await this.app.makeAuthenticatedRequest(`${this.API_URL}/api/auth/profile`, {
                method: 'PUT',
                body: JSON.stringify(profileData),
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                this.app.currentUser = data.user;
                localStorage.setItem('userData', JSON.stringify(data.user));
                this.app.ui.updateUserProfile();
                this.app.ui.showToast('Profile updated successfully', 'success');
                return data.user;
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to update profile');
            }
        } catch (error) {
            console.error('Profile update error:', error);
            this.app.ui.showToast(error.message || 'Failed to update profile', 'error');
            throw error;
        }
    }

    handleAuthError(error) {
        let message = 'Authentication failed. Please try again.';
        if (error === 'access_denied') {
            message = 'Access denied. Please grant necessary permissions.';
        }
        this.app.ui.showToast(message, 'error');
        this.resetLoginButton();
    }

    async handleOAuthCallback(token) {
        try {
            console.log('Handling OAuth callback with token:', token);
            localStorage.setItem('authToken', token);
            console.log('Token stored in localStorage');
            const user = await this.verifyToken(token);
            if (user) {
                this.app.currentUser = user;
                this.app.ui.showToast('Successfully logged in!', 'success');
                await this.app.initializeApp();
            } else {
                localStorage.removeItem('authToken');
                localStorage.removeItem('userData');
                this.app.ui.showToast('Authentication failed. Please login again.', 'error');
                this.app.showLoginScreen();
            }
        } catch (error) {
            console.error('OAuth callback error:', error);
            this.app.ui.showToast('Authentication failed', 'error');
            this.resetLoginButton();
        }
    }

    resetLoginButton() {
        const loginBtn = document.getElementById('google-login-btn');
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.innerHTML = `
                <img src="https://developers.google.com/identity/images/g-logo.png" alt="Google">
                <span>Continue with Google</span>
            `;
        }
    }

    isAuthenticated() {
        return !!localStorage.getItem('authToken');
    }

    getAuthToken() {
        return localStorage.getItem('authToken');
    }

    getCurrentUser() {
        const userData = localStorage.getItem('userData');
        return userData ? JSON.parse(userData) : null;
    }
}
