// Main Chat Application
class ChatApp {
    constructor() {
        this.currentUser = null;
        this.auth = null;
        this.chat = null;
        this.ui = null;
        this.socket = null;
        
        this.init();
    }

    async init() {
        try {
            // Initialize UI first
            this.ui = new UIManager(this);
            
            // Initialize authentication
            this.auth = new AuthManager(this);
            
            // Check if user is already authenticated
            const token = this.auth.getAuthToken();
            if (token) {
                const user = await this.auth.verifyToken(token);
                if (user) {
                    this.currentUser = user;
                    await this.initializeApp();
                } else {
                    this.showLoginScreen();
                }
            } else {
                this.showLoginScreen();
            }
        } catch (error) {
            console.error('App initialization error:', error);
            this.ui.showToast('Failed to initialize app', 'error');
        }
    }

    async initializeApp() {
        try {
            console.log('Starting app initialization...');
            
            // Initialize chat functionality
            console.log('Initializing ChatManager...');
            this.chat = new ChatManager(this);
            console.log('ChatManager initialized');
            
            // Initialize Socket.io connection
            console.log('Initializing Socket.io...');
            await this.initializeSocket();
            console.log('Socket.io initialized');
            
            // Show main app interface
            console.log('Showing main app interface...');
            this.ui.showMainApp();
            console.log('Main app interface shown');
            
            // Load initial data
            console.log('Loading initial data...');
            await this.loadInitialData();
            console.log('Initial data loaded');
            
        } catch (error) {
            console.error('App initialization error:', error);
            this.ui.showToast('Failed to initialize app', 'error');
        }
    }

    async initializeSocket() {
        try {
            const token = this.auth.getAuthToken();
            this.socket = io({
                auth: { token }
            });

            this.socket.on('connect', () => {
                console.log('Connected to server');
                this.ui.updateConnectionStatus(true);
            });

            this.socket.on('disconnect', () => {
                console.log('Disconnected from server');
                this.ui.updateConnectionStatus(false);
            });

            this.socket.on('connect_error', (error) => {
                this.ui.showToast('Socket connection failed: ' + (error && error.message ? error.message : error), 'error');
                console.error('Socket connection error:', error);
            });

            // Handle socket events
            this.setupSocketEventHandlers();

        } catch (error) {
            this.ui.showToast('Failed to initialize socket', 'error');
            console.error('Socket initialization error:', error);
        }
    }

    setupSocketEventHandlers() {
        if (!this.socket) return;

        // Online users updates
        this.socket.on('online_users', (users) => {
            this.ui.updateOnlineUsers(users);
        });

        this.socket.on('user_online', (data) => {
            this.ui.handleUserOnline(data);
        });

        this.socket.on('user_offline', (data) => {
            this.ui.handleUserOffline(data);
        });

        // Chat updates
        this.socket.on('new_message', (data) => {
            this.chat.handleNewMessage(data);
        });

        this.socket.on('message_deleted', (data) => {
            this.chat.handleMessageDeleted(data);
        });

        this.socket.on('user_typing', (data) => {
            this.ui.showTypingIndicator(data);
        });

        this.socket.on('user_stop_typing', (data) => {
            this.ui.hideTypingIndicator(data);
        });
    }

    async loadInitialData() {
        try {
            // Load user's chats
            await this.chat.loadChats();
            
            // Load online users
            await this.loadOnlineUsers();
            
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }

    async loadOnlineUsers() {
        try {
            const response = await this.makeAuthenticatedRequest('/api/users/online');
            if (response.ok) {
                const data = await response.json();
                this.ui.updateOnlineUsers(data.users);
            }
        } catch (error) {
            console.error('Error loading online users:', error);
        }
    }

    async makeAuthenticatedRequest(url, options = {}) {
        const token = this.auth.getAuthToken();
        if (!token) {
            throw new Error('No authentication token');
        }

        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };

        const finalOptions = { ...defaultOptions, ...options };
        
        if (options.body && typeof options.body === 'object') {
            finalOptions.body = JSON.stringify(options.body);
        }

        return fetch(url, finalOptions);
    }

    showLoginScreen() {
        this.ui.showLoginScreen();
    }

    // Global error handler
    handleError(error, context = '') {
        console.error(`Error in ${context}:`, error);
        this.ui.showToast(error.message || 'An error occurred', 'error');
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chatApp = new ChatApp();
});