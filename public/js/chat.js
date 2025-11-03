// Chat Manager Class
class ChatManager {
    constructor(app) {
        this.app = app;
        this.currentChat = null;
        this.currentMessages = new Map();
        this.messageContainer = null;
        this.messageInput = null;
        this.typingTimeout = null;
        this.isLoadingMessages = false;
        this.hasMoreMessages = true;
        this.currentPage = 1;
        
        this.init();
    }

    init() {
        this.messageContainer = document.getElementById('messages-list');
        this.messageInput = document.getElementById('message-input');
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Auto-resize textarea
        if (this.messageInput) {
            this.messageInput.addEventListener('input', () => {
                this.autoResizeTextarea();
            });
            // Send message on Enter (without Shift)
            this.messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        // Send button click
        const sendBtn = document.getElementById('send-btn');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }

        // Scroll to load more messages
        if (this.messageContainer) {
            this.messageContainer.addEventListener('scroll', () => {
                if (this.messageContainer.scrollTop === 0 && this.hasMoreMessages && !this.isLoadingMessages) {
                    this.loadMoreMessages();
                }
            });
        }
    }

    async openChat(chat) {
        try {
            // Set current chat
            this.currentChat = chat;
            
            // Show chat interface
            document.getElementById('welcome-screen').classList.add('hidden');
            document.getElementById('chat-interface').classList.remove('hidden');
            
            // Update chat header
            this.updateChatHeader(chat);
            
            // Clear current messages
            this.currentMessages.clear();
            this.messageContainer.innerHTML = '';
            this.currentPage = 1;
            this.hasMoreMessages = true;
            
            // Load messages
            await this.loadMessages(chat._id);
            
            // Join chat room
            if (this.app.socket) {
                this.app.socket.emit('join_chat', { chatId: chat._id });
            }
            
            // Focus message input
            if (this.messageInput) {
                this.messageInput.focus();
            }
            
        } catch (error) {
            console.error('Error opening chat:', error);
            this.app.ui.showToast('Failed to open chat', 'error');
        }
    }

    updateChatHeader(chat) {
        const otherUser = chat.otherParticipant;
        if (!otherUser) return;
        
        document.getElementById('chat-user-name').textContent = otherUser.name;
        document.getElementById('chat-user-avatar').src = otherUser.avatar || '/images/default-avatar.png';
        
        this.updateChatUserStatus(otherUser.isOnline, otherUser.lastSeen);
    }

    updateChatUserStatus(isOnline, lastSeen) {
        const statusElement = document.getElementById('chat-user-status');
        if (!statusElement) return;
        
        if (isOnline) {
            statusElement.textContent = 'Online';
            statusElement.style.color = '#25d366';
        } else {
            const lastSeenText = this.formatLastSeen(lastSeen);
            statusElement.textContent = `Last seen ${lastSeenText}`;
            statusElement.style.color = '#666';
        }
    }

    async loadMessages(chatId, page = 1) {
        try {
            this.isLoadingMessages = true;
            
            const token = localStorage.getItem('authToken');
            const response = await fetch(`/api/chat/${chatId}/messages?page=${page}&limit=50`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                
                if (page === 1) {
                    // First load - clear and add all messages
                    this.currentMessages.clear();
                    this.messageContainer.innerHTML = '';
                    
                    data.messages.forEach(message => {
                        this.currentMessages.set(message._id, message);
                        this.addMessageToUI(message, false);
                    });
                    
                    // Scroll to bottom
                    this.scrollToBottom();
                } else {
                    // Loading more messages - prepend to top
                    const oldScrollHeight = this.messageContainer.scrollHeight;
                    
                    data.messages.reverse().forEach(message => {
                        if (!this.currentMessages.has(message._id)) {
                            this.currentMessages.set(message._id, message);
                            this.prependMessageToUI(message);
                        }
                    });
                    
                    // Maintain scroll position
                    const newScrollHeight = this.messageContainer.scrollHeight;
                    this.messageContainer.scrollTop = newScrollHeight - oldScrollHeight;
                }
                
                this.hasMoreMessages = data.pagination.hasMore;
                this.currentPage = page;
            } else {
                throw new Error('Failed to load messages');
            }
        } catch (error) {
            console.error('Error loading messages:', error);
            this.app.showError('Failed to load messages');
        } finally {
            this.isLoadingMessages = false;
        }
    }

    async loadMoreMessages() {
        if (!this.app.currentChat || this.isLoadingMessages || !this.hasMoreMessages) {
            return;
        }
        
        await this.loadMessages(this.app.currentChat._id, this.currentPage + 1);
    }

    addMessageToUI(message, animate = true) {
        const messageElement = this.createMessageElement(message);
        
        if (animate) {
            messageElement.style.opacity = '0';
            messageElement.style.transform = 'translateY(20px)';
        }
        
        this.messageContainer.appendChild(messageElement);
        
        if (animate) {
            // Trigger animation
            requestAnimationFrame(() => {
                messageElement.style.transition = 'all 0.3s ease-out';
                messageElement.style.opacity = '1';
                messageElement.style.transform = 'translateY(0)';
            });
            
            // Scroll to bottom for new messages
            this.scrollToBottom();
        }
    }

    prependMessageToUI(message) {
        const messageElement = this.createMessageElement(message);
        this.messageContainer.insertBefore(messageElement, this.messageContainer.firstChild);
    }

    createMessageElement(message) {
        const div = document.createElement('div');
        const isOwn = message.sender._id === this.app.currentUser._id;
        
        div.className = `message ${isOwn ? 'sent' : 'received'}`;
        div.dataset.messageId = message._id;
        
        let content = '';
        
        // Handle different message types
        if (message.messageType === 'image') {
            content = `
                <div class="message-image-container">
                    <img src="${message.fileUrl}" alt="Image" class="message-image" onclick="this.requestFullscreen()">
                </div>
            `;
        } else if (message.messageType === 'file') {
            content = `
                <div class="message-file">
                    <div class="file-icon">
                        <i class="fas fa-file"></i>
                    </div>
                    <div class="file-info">
                        <div class="file-name">${message.fileName}</div>
                        <div class="file-size">${this.formatFileSize(message.fileSize)}</div>
                    </div>
                    <a href="${message.fileUrl}" download="${message.fileName}" class="file-download">
                        <i class="fas fa-download"></i>
                    </a>
                </div>
            `;
        } else if (message.messageType === 'audio') {
            content = `
                <div class="message-audio">
                    <audio controls>
                        <source src="${message.fileUrl}" type="audio/mpeg">
                        Your browser does not support the audio element.
                    </audio>
                </div>
            `;
        }
        
        // Add text content if exists
        if (message.content && message.messageType !== 'file') {
            content += `<div class="message-content">${this.formatMessageContent(message.content)}</div>`;
        }
        
        // Add message metadata
        const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const statusIcon = isOwn ? this.getMessageStatusIcon(message) : '';
        
        content += `
            <div class="message-meta">
                <span class="message-time">${time}</span>
                ${statusIcon}
            </div>
        `;
        
        div.innerHTML = content;
        
        // Add context menu for own messages
        if (isOwn) {
            div.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.showMessageContextMenu(e, message);
            });
        }
        
        return div;
    }

    formatMessageContent(content) {
        // Basic text formatting
        return content
            .replace(/\n/g, '<br>')
            .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    getMessageStatusIcon(message) {
        // For now, just show delivered icon
        // In a real app, you'd track read status
        return '<i class="fas fa-check message-status"></i>';
    }

    async sendMessage() {
        const content = this.messageInput.value.trim();
        // Support both chat object and chat id for currentChat
        let chatId = this.currentChat && this.currentChat._id ? this.currentChat._id : this.currentChat;
        if (!content || !chatId) {
            console.log('[sendMessage] No content or no current chat:', { content, currentChat: this.app.currentChat });
            return;
        }

        try {
            // Clear input immediately
            this.messageInput.value = '';
            this.autoResizeTextarea();

            // Debug log before sending
            console.log('[sendMessage] Sending message:', {
                chatId: chatId,
                content: content,
                messageType: 'text',
                socket: this.app.socket
            });

            // Send via socket for real-time delivery
            if (this.app.socket) {
                this.app.socket.emit('send_message', {
                    chatId: chatId,
                    content: content,
                    messageType: 'text'
                });
            } else {
                // Fallback to HTTP request
                await this.sendMessageHTTP(content);
            }

        } catch (error) {
            console.error('Error sending message:', error);
            this.app.ui.showToast('Failed to send message', 'error');

            // Restore message content
            this.messageInput.value = content;
        }
    }

    async sendMessageHTTP(content, messageType = 'text', fileUrl = '', fileName = '') {
        const token = localStorage.getItem('authToken');
        
        const response = await fetch(`/api/chat/${this.app.currentChat._id}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                content,
                messageType,
                fileUrl,
                fileName
            })
        });

        if (!response.ok) {
            throw new Error('Failed to send message');
        }

        const data = await response.json();
        return data.message;
    }

    async handleFileUpload(file) {
        if (!file || !this.app.currentChat) {
            return;
        }

        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            this.app.showError('File size must be less than 10MB');
            return;
        }

        try {
            // Show upload progress
            this.showUploadProgress();
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('caption', file.name);

            const token = localStorage.getItem('authToken');
            const response = await fetch(`/api/chat/${this.app.currentChat._id}/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                // Message will be added via socket event
                this.app.ui.showToast('File uploaded successfully', 'success');
            } else {
                throw new Error('Failed to upload file');
            }
        } catch (error) {
            console.error('File upload error:', error);
            this.app.showError('Failed to upload file');
        } finally {
            this.hideUploadProgress();
            // Clear file input
            document.getElementById('file-input').value = '';
        }
    }

    showUploadProgress() {
        // Show upload indicator in UI
        const sendBtn = document.getElementById('send-btn');
        if (sendBtn) {
            sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            sendBtn.disabled = true;
        }
    }

    hideUploadProgress() {
        // Hide upload indicator
        const sendBtn = document.getElementById('send-btn');
        if (sendBtn) {
            sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
            sendBtn.disabled = false;
        }
    }

    showTypingIndicator(userName) {
        const indicator = document.getElementById('typing-indicator');
        const userSpan = document.getElementById('typing-user');
        
        if (indicator && userSpan) {
            userSpan.textContent = `${userName} is typing...`;
            indicator.classList.remove('hidden');
            this.scrollToBottom();
        }
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.classList.add('hidden');
        }
    }

    removeMessageFromUI(messageId) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            messageElement.style.transition = 'all 0.3s ease-out';
            messageElement.style.opacity = '0';
            messageElement.style.transform = 'translateX(-100%)';
            
            setTimeout(() => {
                messageElement.remove();
            }, 300);
        }
        
        this.currentMessages.delete(messageId);
    }

    updateMessageReaction(data) {
        // Implementation for message reactions
        const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
        if (messageElement) {
            // Update reaction display
            // This would be implemented based on your reaction UI design
        }
    }

    markMessagesAsRead(userId) {
        // Update read status indicators
        document.querySelectorAll('.message.sent .message-status').forEach(status => {
            status.className = 'fas fa-check-double message-status read';
        });
    }

    showMessageContextMenu(event, message) {
        // Create context menu for message actions
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.position = 'fixed';
        menu.style.left = event.clientX + 'px';
        menu.style.top = event.clientY + 'px';
        menu.style.background = 'white';
        menu.style.border = '1px solid #ccc';
        menu.style.borderRadius = '4px';
        menu.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
        menu.style.zIndex = '1000';
        
        const actions = [
            { text: 'Copy', action: () => this.copyMessage(message) },
            { text: 'Delete', action: () => this.deleteMessage(message._id) }
        ];
        
        actions.forEach(action => {
            const item = document.createElement('div');
            item.textContent = action.text;
            item.style.padding = '8px 12px';
            item.style.cursor = 'pointer';
            item.addEventListener('click', () => {
                action.action();
                menu.remove();
            });
            item.addEventListener('mouseenter', () => {
                item.style.background = '#f0f0f0';
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

    copyMessage(message) {
        navigator.clipboard.writeText(message.content).then(() => {
            this.app.ui.showToast('Message copied to clipboard', 'success');
        }).catch(() => {
            this.app.showError('Failed to copy message');
        });
    }

    async deleteMessage(messageId) {
        if (!confirm('Are you sure you want to delete this message?')) {
            return;
        }

        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch(`/api/chat/${this.app.currentChat._id}/messages/${messageId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                // Message will be removed via socket event
                this.app.ui.showToast('Message deleted', 'success');
            } else {
                throw new Error('Failed to delete message');
            }
        } catch (error) {
            console.error('Delete message error:', error);
            this.app.showError('Failed to delete message');
        }
    }

    autoResizeTextarea() {
        if (!this.messageInput) return;
        
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = Math.min(this.messageInput.scrollHeight, 120) + 'px';
    }

    scrollToBottom() {
        if (this.messageContainer) {
            this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
        }
    }

    // Emoji functionality (basic implementation)
    toggleEmojiPicker() {
        // This would show/hide an emoji picker
        // For now, just insert a simple emoji
        const emojis = ['😀', '😂', '😍', '👍', '❤️', '😢', '😮', '😡'];
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        
        if (this.messageInput) {
            this.messageInput.value += randomEmoji;
            this.messageInput.focus();
        }
    }

    // Search messages (for future implementation)
    searchMessages(query) {
        // Implementation for searching messages in current chat
        const messages = Array.from(this.currentMessages.values());
        return messages.filter(message => 
            message.content.toLowerCase().includes(query.toLowerCase())
        );
    }

    // Export chat (for future implementation)
    async exportChat() {
        try {
            const messages = Array.from(this.currentMessages.values());
            const chatData = {
                chat: this.app.currentChat,
                messages: messages,
                exportDate: new Date().toISOString()
            };
            
            const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `chat-${this.app.currentChat.chatName}-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            
            URL.revokeObjectURL(url);
            this.app.ui.showToast('Chat exported successfully', 'success');
        } catch (error) {
            console.error('Export chat error:', error);
            this.app.showError('Failed to export chat');
        }
    }

    // Missing methods required by app.js
    async loadChats() {
        try {
            const response = await this.app.makeAuthenticatedRequest('/api/chat');
            if (response.ok) {
                const data = await response.json();
                this.app.ui.updateChatList(data.chats);
            }
        } catch (error) {
            console.error('Error loading chats:', error);
        }
    }

    handleNewMessage(data) {
        // Debug log to compare chat ids
        console.log('[handleNewMessage] data.chat._id:', data.chat._id, 'this.app.currentChat?._id:', this.app.currentChat?._id);
        // Add new message to current chat if it's open
        if (this.app.currentChat && data.chat._id === this.app.currentChat._id) {
            this.addMessageToChat(data.message);
        }

        // --- Auto-sync recent chats ---
        // Find and update the chat in the app's chat list
        if (!this.app.chats) this.app.chats = [];
        let chatIndex = this.app.chats.findIndex(c => c._id === data.chat._id);
        if (chatIndex !== -1) {
            // Update lastMessage and lastActivity
            this.app.chats[chatIndex].lastMessage = data.message;
            this.app.chats[chatIndex].lastActivity = data.message.createdAt;
            // Move chat to top
            const [updatedChat] = this.app.chats.splice(chatIndex, 1);
            this.app.chats.unshift(updatedChat);
        } else {
            // If chat not found, add it to the top
            let newChat = data.chat;
            newChat.lastMessage = data.message;
            newChat.lastActivity = data.message.createdAt;
            this.app.chats = [newChat, ...this.app.chats];
        }
        // Re-render chat list
        this.app.ui.updateChatList(this.app.chats);
        // Optionally, update the preview text as well
        this.app.ui.updateChatWithNewMessage(data.chat._id, data.message);
    }

    handleMessageDeleted(data) {
        // Remove message from current chat if it's open
        if (this.app.currentChat) {
            const messageElement = document.querySelector(`[data-message-id="${data.messageId}"]`);
            if (messageElement) {
                messageElement.remove();
            }
        }
    }

    addMessageToChat(message) {
        if (!this.messageContainer) return;
        
        const messageElement = this.createMessageElement(message);
        this.messageContainer.appendChild(messageElement);
        this.scrollToBottom();
        
        // Store message in current messages
        this.currentMessages.set(message._id, message);
    }

    createMessageElement(message) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${message.sender._id === this.app.currentUser._id ? 'sent' : 'received'}`;
        messageElement.setAttribute('data-message-id', message._id);
        
        messageElement.innerHTML = `
            <div class="message-content">
                <div class="message-text">${message.content}</div>
                <div class="message-time">${this.formatMessageTime(message.createdAt)}</div>
            </div>
        `;
        
        return messageElement;
    }

    formatMessageTime(date) {
        if (!date) return '';
        const messageDate = new Date(date);
        return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    async startChatWithUser(user) {
        try {
            const response = await this.app.makeAuthenticatedRequest('/api/users/start-chat', {
                method: 'POST',
                body: { userId: user._id }
            });
            if (response.ok) {
                const data = await response.json();
                console.log('[ChatManager] /api/users/start-chat response:', data);
                if (data && data.chat) {
                    this.currentChat = data.chat._id;
                    console.log('[ChatManager] currentChat set to:', this.currentChat);
                    this.currentMessages.set(data.chat._id, data.chat.messages || []);
                    await this.openChat(data.chat);
                }
            }
        } catch (error) {
            console.error('Error starting chat:', error);
            this.app.ui.showToast('Failed to start chat', 'error');
        }
    }

    showError(message) {
        this.app.ui.showToast(message, 'error');
    }

    formatLastSeen(date) {
        if (!date) return 'Unknown';
        const now = new Date();
        const lastSeen = new Date(date);
        const diffInMinutes = Math.floor((now - lastSeen) / (1000 * 60));
        
        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
        if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
        return lastSeen.toLocaleDateString();
    }

    async loadMessages(chatId, page = 1) {
        try {
            this.isLoadingMessages = true;
            
            const response = await this.app.makeAuthenticatedRequest(`/api/chat/${chatId}/messages?page=${page}`);
            if (response.ok) {
                const data = await response.json();
                const messages = data.messages;
                
                if (page === 1) {
                    this.currentMessages.clear();
                    this.messageContainer.innerHTML = '';
                }
                
                messages.forEach(message => {
                    this.currentMessages.set(message._id, message);
                    const messageElement = this.createMessageElement(message);
                    this.messageContainer.appendChild(messageElement);
                });
                
                this.hasMoreMessages = data.pagination.hasMore;
                this.currentPage = page;
                
                if (page === 1) {
                    this.scrollToBottom();
                }
            }
        } catch (error) {
            console.error('Error loading messages:', error);
            this.app.ui.showToast('Failed to load messages', 'error');
        } finally {
            this.isLoadingMessages = false;
        }
    }

    async loadMoreMessages() {
        if (this.isLoadingMessages || !this.hasMoreMessages || !this.currentChat) return;
        
        await this.loadMessages(this.currentChat._id, this.currentPage + 1);
    }
}

