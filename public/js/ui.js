// UI Manager Class
class UIManager {
    constructor(app) {
        this.app = app;
        this.activeModal = null;
        this.toasts = [];
        this.searchTimeout = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupModalHandlers();
        this.setupResponsiveHandlers();
    }

    setupEventListeners() {
        // Close modals when clicking outside
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal();
            }
        });

        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModal) {
                this.closeModal();
            }
        });

        // Search functionality
        const modalSearch = document.getElementById('modal-user-search');
        if (modalSearch) {
            modalSearch.addEventListener('input', (e) => {
                this.handleModalSearch(e.target.value);
            });
        }

        // Settings form
        const saveProfileBtn = document.getElementById('save-profile-btn');
        if (saveProfileBtn) {
            saveProfileBtn.addEventListener('click', () => {
                this.saveProfile();
            });
        }

        // Emoji button
        const emojiBtn = document.getElementById('emoji-btn');
        if (emojiBtn) {
            emojiBtn.addEventListener('click', () => {
                this.app.chat.toggleEmojiPicker();
            });
        }

        // Video/Voice call buttons (placeholder)
        const videoCallBtn = document.getElementById('video-call-btn');
        const voiceCallBtn = document.getElementById('voice-call-btn');
        
        if (videoCallBtn) {
            videoCallBtn.addEventListener('click', () => {
                this.showToast('Video calling feature coming soon!', 'info');
            });
        }
        
        if (voiceCallBtn) {
            voiceCallBtn.addEventListener('click', () => {
                this.showToast('Voice calling feature coming soon!', 'info');
            });
        }

        // Chat menu button
        const chatMenuBtn = document.getElementById('chat-menu-btn');
        if (chatMenuBtn) {
            chatMenuBtn.addEventListener('click', (e) => {
                this.showChatMenu(e);
            });
        }
    }

    setupModalHandlers() {
        // User search modal
        const closeSearchModal = document.getElementById('close-search-modal');
        if (closeSearchModal) {
            closeSearchModal.addEventListener('click', () => {
                this.closeModal();
            });
        }

        // Settings modal
        const closeSettingsModal = document.getElementById('close-settings-modal');
        if (closeSettingsModal) {
            closeSettingsModal.addEventListener('click', () => {
                this.closeModal();
            });
        }
    }

    setupResponsiveHandlers() {
        // Handle mobile responsiveness
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Touch events for mobile
        let touchStartX = 0;
        let touchStartY = 0;

        document.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        });

        document.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;

            // Swipe gestures for mobile navigation
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
                if (deltaX > 0) {
                    // Swipe right - show sidebar
                    this.showSidebar();
                } else {
                    // Swipe left - hide sidebar
                    this.hideSidebar();
                }
            }
        });
    }

    showUserSearchModal() {
        const modal = document.getElementById('user-search-modal');
        if (modal) {
            modal.classList.remove('hidden');
            this.activeModal = modal;
            
            // Focus search input
            const searchInput = document.getElementById('modal-user-search');
            if (searchInput) {
                searchInput.focus();
                searchInput.value = '';
            }
            
            // Clear previous results
            this.updateSearchResults([]);
        }
    }

    showSettingsModal() {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.classList.remove('hidden');
            this.activeModal = modal;
            
            // Populate current user data
            this.populateSettingsForm();
        }
    }

    closeModal() {
        if (this.activeModal) {
            this.activeModal.classList.add('hidden');
            this.activeModal = null;
        }
    }

    populateSettingsForm() {
        if (!this.app.currentUser) return;
        
        const nameInput = document.getElementById('profile-name');
        const statusInput = document.getElementById('profile-status');
        const phoneInput = document.getElementById('profile-phone');
        
        if (nameInput) nameInput.value = this.app.currentUser.name || '';
        if (statusInput) statusInput.value = this.app.currentUser.status || '';
        if (phoneInput) phoneInput.value = this.app.currentUser.phone || '';
    }

    async saveProfile() {
        try {
            const nameInput = document.getElementById('profile-name');
            const statusInput = document.getElementById('profile-status');
            const phoneInput = document.getElementById('profile-phone');
            
            const profileData = {
                name: nameInput?.value.trim(),
                status: statusInput?.value.trim(),
                phone: phoneInput?.value.trim()
            };

            // Validate input
            if (!profileData.name) {
                this.showToast('Name is required', 'error');
                return;
            }

            if (profileData.phone && !this.app.auth.validatePhone(profileData.phone)) {
                this.showToast('Please enter a valid phone number', 'error');
                return;
            }

            // Show loading state
            const saveBtn = document.getElementById('save-profile-btn');
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Saving...';
            saveBtn.disabled = true;

            // Update profile
            await this.app.auth.updateProfile(profileData);
            
            // Close modal
            this.closeModal();

        } catch (error) {
            console.error('Save profile error:', error);
            // Error is already handled in auth manager
        } finally {
            // Reset button state
            const saveBtn = document.getElementById('save-profile-btn');
            if (saveBtn) {
                saveBtn.textContent = 'Save Changes';
                saveBtn.disabled = false;
            }
        }
    }

    handleModalSearch(query) {
        // Clear previous timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        // Debounce search
        this.searchTimeout = setTimeout(async () => {
            if (query.length < 2) {
                this.updateSearchResults([]);
                return;
            }

            try {
                const token = localStorage.getItem('authToken');
                const response = await fetch(`/api/users/search/${encodeURIComponent(query)}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    this.updateSearchResults(data.users);
                } else {
                    throw new Error('Search failed');
                }
            } catch (error) {
                console.error('Search error:', error);
                this.showToast('Search failed', 'error');
            }
        }, 300);
    }

    updateSearchResults(users) {
        const container = document.getElementById('search-results');
        if (!container) return;

        container.innerHTML = '';

        if (users.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No users found</p>';
            return;
        }

        users.forEach(user => {
            const userElement = this.createSearchResultElement(user);
            container.appendChild(userElement);
        });
    }

    createSearchResultElement(user) {
        const div = document.createElement('div');
        div.className = 'search-result-item';
        div.onclick = () => this.selectUser(user);
        
        const isOnline = this.app.onlineUsers.has(user._id);
        const statusText = isOnline ? 'Online' : `Last seen ${this.app.auth.formatLastSeen(user.lastSeen)}`;
        
        div.innerHTML = `
            <img src="${user.avatar || '/images/default-avatar.png'}" alt="${user.name}" class="search-result-avatar">
            <div class="search-result-info">
                <h4>${user.name}</h4>
                <p style="color: ${isOnline ? '#25d366' : '#666'}">${statusText}</p>
            </div>
        `;
        
        return div;
    }

    async selectUser(user) {
        try {
            // Close modal
            this.closeModal();
            
            // Start chat with user
            await this.app.startChatWithUser(user._id);
            
        } catch (error) {
            console.error('Select user error:', error);
            this.showToast('Failed to start chat', 'error');
        }
    }

    showChatMenu(event) {
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.position = 'fixed';
        menu.style.right = '20px';
        menu.style.top = (event.target.getBoundingClientRect().bottom + 5) + 'px';
        menu.style.background = 'white';
        menu.style.border = '1px solid #ccc';
        menu.style.borderRadius = '8px';
        menu.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        menu.style.zIndex = '1000';
        menu.style.minWidth = '150px';
        
        const actions = [
            { text: 'View Profile', icon: 'fas fa-user', action: () => this.viewUserProfile() },
            { text: 'Search Messages', icon: 'fas fa-search', action: () => this.searchMessages() },
            { text: 'Export Chat', icon: 'fas fa-download', action: () => this.app.chat.exportChat() },
            { text: 'Clear Chat', icon: 'fas fa-trash', action: () => this.clearChat() }
        ];
        
        actions.forEach(action => {
            const item = document.createElement('div');
            item.innerHTML = `<i class="${action.icon}"></i> ${action.text}`;
            item.style.padding = '12px 16px';
            item.style.cursor = 'pointer';
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.gap = '8px';
            item.style.fontSize = '14px';
            
            item.addEventListener('click', () => {
                action.action();
                menu.remove();
            });
            
            item.addEventListener('mouseenter', () => {
                item.style.background = '#f0f2f5';
            });
            
            item.addEventListener('mouseleave', () => {
                item.style.background = 'white';
            });
            
            menu.appendChild(item);
        });
        
        document.body.appendChild(menu);
        
        // Remove menu when clicking elsewhere
        const removeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', removeMenu);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', removeMenu);
        }, 0);
    }

    viewUserProfile() {
        if (!this.app.currentChat || !this.app.currentChat.otherParticipant) {
            return;
        }
        
        const user = this.app.currentChat.otherParticipant;
        const isOnline = this.app.onlineUsers.has(user._id);
        
        this.showToast(`${user.name} - ${isOnline ? 'Online' : 'Offline'}`, 'info');
    }

    searchMessages() {
        const query = prompt('Search messages:');
        if (query) {
            const results = this.app.chat.searchMessages(query);
            this.showToast(`Found ${results.length} messages`, 'info');
        }
    }

    clearChat() {
        if (confirm('Are you sure you want to clear this chat? This action cannot be undone.')) {
            // Implementation for clearing chat
            this.showToast('Chat cleared', 'success');
        }
    }

    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        const container = document.getElementById('toast-container');
        if (container) {
            container.appendChild(toast);
            
            // Auto remove after duration
            setTimeout(() => {
                this.removeToast(toast);
            }, duration);
            
            // Click to dismiss
            toast.addEventListener('click', () => {
                this.removeToast(toast);
            });
        }
    }

    removeToast(toast) {
        if (toast && toast.parentNode) {
            toast.style.animation = 'slideOutRight 0.3s ease-out forwards';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }
    }

    showSidebar() {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.add('open');
        }
    }

    hideSidebar() {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.remove('open');
        }
    }

    handleResize() {
        // Handle responsive layout changes
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile) {
            // Mobile layout adjustments
            this.hideSidebar();
        } else {
            // Desktop layout
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.classList.remove('open');
            }
        }
    }

    // Loading states
    showLoadingState(element, text = 'Loading...') {
        if (element) {
            element.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; padding: 20px;">
                    <div class="spinner" style="width: 20px; height: 20px; margin-right: 10px;"></div>
                    <span>${text}</span>
                </div>
            `;
        }
    }

    hideLoadingState(element, originalContent) {
        if (element) {
            element.innerHTML = originalContent;
        }
    }

    // Utility functions
    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 86400000) { // Less than 24 hours
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diff < 604800000) { // Less than 7 days
            return date.toLocaleDateString([], { weekday: 'short' });
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength) + '...';
    }

    // Theme management (for future implementation)
    setTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }

    getTheme() {
        return localStorage.getItem('theme') || 'light';
    }

    // Notification management
    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    this.showToast('Notifications enabled', 'success');
                } else {
                    this.showToast('Notifications disabled', 'warning');
                }
            });
        }
    }

    // Keyboard shortcuts
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + K for search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.showUserSearchModal();
            }
            
            // Ctrl/Cmd + , for settings
            if ((e.ctrlKey || e.metaKey) && e.key === ',') {
                e.preventDefault();
                this.showSettingsModal();
            }
            
            // Escape to close current chat
            if (e.key === 'Escape' && this.app.currentChat) {
                document.getElementById('welcome-screen').classList.remove('hidden');
                document.getElementById('chat-interface').classList.add('hidden');
                this.app.currentChat = null;
            }
        });
    }

    // Accessibility improvements
    setupAccessibility() {
        // Add ARIA labels and roles
        const elements = document.querySelectorAll('button, input, [role="button"]');
        elements.forEach(element => {
            if (!element.getAttribute('aria-label') && !element.textContent.trim()) {
                // Add appropriate aria-label based on element's purpose
                const className = element.className;
                if (className.includes('send')) {
                    element.setAttribute('aria-label', 'Send message');
                } else if (className.includes('attach')) {
                    element.setAttribute('aria-label', 'Attach file');
                } else if (className.includes('emoji')) {
                    element.setAttribute('aria-label', 'Add emoji');
                }
            }
        });
        
        // Add focus management
        this.setupFocusManagement();
    }

    setupFocusManagement() {
        // Trap focus in modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab' && this.activeModal) {
                const focusableElements = this.activeModal.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                
                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];
                
                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        });
    }

    // Performance optimization
    debounce(func, wait) {
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

    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Missing methods required by app.js
    showMainApp() {
        console.log('showMainApp called');
        
        const loadingScreen = document.getElementById('loading-screen');
        const loginScreen = document.getElementById('login-screen');
        const chatApp = document.getElementById('chat-app');
        
        console.log('Elements found:', { loadingScreen, loginScreen, chatApp });
        
        if (loadingScreen) loadingScreen.classList.add('hidden');
        if (loginScreen) loginScreen.classList.add('hidden');
        if (chatApp) chatApp.classList.remove('hidden');
        
        console.log('Main app interface shown');
    }

    showLoginScreen() {
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('chat-app').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
    }

    updateConnectionStatus(isConnected) {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.textContent = isConnected ? 'Connected' : 'Disconnected';
            statusElement.className = isConnected ? 'status-connected' : 'status-disconnected';
        }
    }

    handleUserOnline(data) {
        // Update online users list
        this.updateOnlineUsers([data.user]);
    }

    handleUserOffline(data) {
        // Update user status to offline
        const userElement = document.querySelector(`[data-user-id="${data.userId}"]`);
        if (userElement) {
            userElement.classList.remove('online');
            userElement.classList.add('offline');
        }
    }

    showTypingIndicator(data) {
        const typingElement = document.getElementById('typing-indicator');
        if (typingElement) {
            typingElement.textContent = `${data.userName} is typing...`;
            typingElement.classList.remove('hidden');
        }
    }

    hideTypingIndicator(data) {
        const typingElement = document.getElementById('typing-indicator');
        if (typingElement) {
            typingElement.classList.add('hidden');
        }
    }

    // Additional methods required by ChatManager
    updateChatList(chats) {
        const chatList = document.getElementById('chat-list');
        if (!chatList) return;

        chatList.innerHTML = '';
        chats.forEach(chat => {
            const chatElement = this.createChatElement(chat);
            chatList.appendChild(chatElement);
        });
    }

    updateChatWithNewMessage(chatId, message) {
        const chatElement = document.querySelector(`[data-chat-id="${chatId}"]`);
        if (chatElement) {
            const lastMessageElement = chatElement.querySelector('.chat-last-message');
            if (lastMessageElement) {
                lastMessageElement.textContent = message.content;
            }
        }
    }

    createChatElement(chat) {
        const chatElement = document.createElement('div');
        chatElement.className = 'chat-item';
        chatElement.setAttribute('data-chat-id', chat._id);
        
        const otherUser = chat.otherParticipant;
        chatElement.innerHTML = `
            <img src="${otherUser?.avatar || '/images/default-avatar.png'}" alt="${otherUser?.name || 'User'}" class="chat-avatar">
            <div class="chat-info">
                <div class="chat-name">${otherUser?.name || 'Unknown User'}</div>
                <div class="chat-last-message">${chat.lastMessage?.content || 'No messages yet'}</div>
            </div>
            <div class="chat-time">${this.formatTime(chat.lastActivity)}</div>
        `;

        chatElement.addEventListener('click', () => {
            this.app.chat.openChat(chat);
        });

        return chatElement;
    }

    formatTime(date) {
        if (!date) return '';
        const now = new Date();
        const messageDate = new Date(date);
        const diffInHours = (now - messageDate) / (1000 * 60 * 60);
        
        if (diffInHours < 24) {
            return messageDate.toLocaleDateString();
        } else {
            return messageDate.toLocaleDateString();
        }
    }

    updateOnlineUsers(users) {
        const onlineUsersList = document.getElementById('online-users-list');
        if (!onlineUsersList) return;

        onlineUsersList.innerHTML = '';
        users.forEach(user => {
            const userElement = this.createOnlineUserElement(user);
            onlineUsersList.appendChild(userElement);
        });
    }

    createOnlineUserElement(user) {
        const userElement = document.createElement('div');
        userElement.className = 'online-user';
        userElement.setAttribute('data-user-id', user._id);
        
        userElement.innerHTML = `
            <img src="${user.avatar || '/images/default-avatar.png'}" alt="${user.name}" class="user-avatar">
            <div class="user-info">
                <div class="user-name">${user.name}</div>
                <div class="user-status">${user.status || 'Hey there! I am using Chat App.'}</div>
            </div>
            <div class="online-indicator"></div>
        `;

        userElement.addEventListener('click', () => {
            console.log('[UI] Online user clicked:', user);
            this.startChatWithUser(user);
        });

        return userElement;
    }

    startChatWithUser(user) {
        // This would start a chat with the selected user
        this.app.chat.startChatWithUser(user);
    }

    updateUserProfile() {
        // Update user profile display
        const userNameElement = document.getElementById('user-name');
        const userAvatarElement = document.getElementById('user-avatar');
        const userStatusElement = document.getElementById('user-status');
        
        if (this.app.currentUser) {
            if (userNameElement) userNameElement.textContent = this.app.currentUser.name;
            if (userAvatarElement) userAvatarElement.src = this.app.currentUser.avatar || '/images/default-avatar.png';
            if (userStatusElement) userStatusElement.textContent = this.app.currentUser.status || 'Hey there! I am using Chat App.';
        }
    }

    showToast(message, type = 'info') {
        console.log('showToast called:', { message, type });
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        console.log('Toast element added to DOM');
        
        // Show toast
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Hide and remove toast
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

