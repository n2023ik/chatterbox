const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Chat = require('../models/Chat');
const Message = require('../models/Message');

// Store active connections
const activeUsers = new Map();

module.exports = (io) => {
  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

<<<<<<< HEAD
    const env = require('./env');
    const decoded = jwt.verify(token, env.JWT_SECRET);
=======
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
>>>>>>> 9e8132601426e7f7949a64bfe5f2e014603f1259
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`User ${socket.user.name} connected with socket ID: ${socket.id}`);

    try {
      // Update user online status
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: true,
        socketId: socket.id,
        lastSeen: new Date()
      });

      // Store active user
      activeUsers.set(socket.userId, {
        socketId: socket.id,
        user: socket.user
      });

      // Join user to their personal room
      socket.join(socket.userId);

      // Get user's chats and join chat rooms
      const userChats = await Chat.getUserChats(socket.userId);
      userChats.forEach(chat => {
        socket.join(chat._id.toString());
      });

      // Broadcast user online status to all users
      socket.broadcast.emit('user_online', {
        userId: socket.userId,
        user: socket.user.getPublicProfile()
      });

      // Send online users list to the connected user
      const onlineUsers = await User.findOnlineUsers();
      socket.emit('online_users', onlineUsers);

      // Handle joining a chat
      socket.on('join_chat', async (data) => {
        try {
          const { chatId } = data;
          socket.join(chatId);
          
          // Mark messages as read
          await Message.markAsRead(chatId, socket.userId);
          
          // Notify other participants that messages are read
          socket.to(chatId).emit('messages_read', {
            chatId,
            userId: socket.userId
          });
        } catch (error) {
          console.error('Error joining chat:', error);
          socket.emit('error', { message: 'Failed to join chat' });
        }
      });

      // Handle leaving a chat
      socket.on('leave_chat', (data) => {
        const { chatId } = data;
        socket.leave(chatId);
      });

      // Handle sending a message
      socket.on('send_message', async (data) => {
        try {
          const { chatId, content, messageType = 'text', fileUrl = '', fileName = '' } = data;

          // Verify user is participant in the chat
          const chat = await Chat.findOne({
            _id: chatId,
            participants: socket.userId
          });

          if (!chat) {
            socket.emit('error', { message: 'Chat not found or access denied' });
            return;
          }

          // Create new message
          const message = new Message({
            chat: chatId,
            sender: socket.userId,
            content,
            messageType,
            fileUrl,
            fileName
          });

          await message.save();

          // Populate sender info
          await message.populate('sender', 'name email avatar');

          // Update chat's last message and activity
          chat.lastMessage = message._id;
          await chat.updateLastActivity();

          // Send message to all participants in the chat
          io.to(chatId).emit('new_message', {
            message,
            chat // send the full chat object, not just _id and participants
          });

          // Send push notification to offline users (if needed)
          // This can be implemented with services like Firebase Cloud Messaging

        } catch (error) {
          console.error('Error sending message:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      // Handle typing indicators
      socket.on('typing_start', (data) => {
        const { chatId } = data;
        socket.to(chatId).emit('user_typing', {
          userId: socket.userId,
          userName: socket.user.name,
          chatId
        });
      });

      socket.on('typing_stop', (data) => {
        const { chatId } = data;
        socket.to(chatId).emit('user_stop_typing', {
          userId: socket.userId,
          chatId
        });
      });

      // Handle message reactions
      socket.on('add_reaction', async (data) => {
        try {
          const { messageId, emoji } = data;
          const message = await Message.findById(messageId);
          
          if (message) {
            await message.addReaction(socket.userId, emoji);
            io.to(message.chat.toString()).emit('message_reaction', {
              messageId,
              userId: socket.userId,
              emoji,
              action: 'add'
            });
          }
        } catch (error) {
          console.error('Error adding reaction:', error);
        }
      });

      socket.on('remove_reaction', async (data) => {
        try {
          const { messageId } = data;
          const message = await Message.findById(messageId);
          
          if (message) {
            await message.removeReaction(socket.userId);
            io.to(message.chat.toString()).emit('message_reaction', {
              messageId,
              userId: socket.userId,
              action: 'remove'
            });
          }
        } catch (error) {
          console.error('Error removing reaction:', error);
        }
      });

      // Handle message deletion
      socket.on('delete_message', async (data) => {
        try {
          const { messageId } = data;
          const message = await Message.findOne({
            _id: messageId,
            sender: socket.userId
          });
          
          if (message) {
            await message.softDelete();
            io.to(message.chat.toString()).emit('message_deleted', {
              messageId
            });
          }
        } catch (error) {
          console.error('Error deleting message:', error);
        }
      });

      // Handle disconnect
      socket.on('disconnect', async () => {
        console.log(`User ${socket.user.name} disconnected`);

        try {
          // Update user offline status
          await User.findByIdAndUpdate(socket.userId, {
            isOnline: false,
            socketId: '',
            lastSeen: new Date()
          });

          // Remove from active users
          activeUsers.delete(socket.userId);

          // Broadcast user offline status
          socket.broadcast.emit('user_offline', {
            userId: socket.userId,
            lastSeen: new Date()
          });

        } catch (error) {
          console.error('Error handling disconnect:', error);
        }
      });

    } catch (error) {
      console.error('Error in socket connection:', error);
      socket.disconnect();
    }
  });

  // Helper function to get online users count
  const getOnlineUsersCount = () => {
    return activeUsers.size;
  };

  // Periodic cleanup of stale connections
  setInterval(async () => {
    try {
      const onlineUserIds = Array.from(activeUsers.keys());
      await User.updateMany(
        { _id: { $nin: onlineUserIds } },
        { isOnline: false, socketId: '' }
      );
    } catch (error) {
      console.error('Error in periodic cleanup:', error);
    }
  }, 60000); // Run every minute

  return { getOnlineUsersCount };
};

