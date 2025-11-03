const express = require('express');
const multer = require('multer');
const path = require('path');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');

const router = express.Router();

<<<<<<< HEAD
// Multer for avatar uploads and room images if needed
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + req.user._id.toString() + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) return cb(null, true);
    cb(new Error('Invalid avatar file type'));
  }
});

=======
>>>>>>> 9e8132601426e7f7949a64bfe5f2e014603f1259
// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
<<<<<<< HEAD
    fileSize: 50 * 1024 * 1024 // 50MB limit to allow short videos
  },
  fileFilter: (req, file, cb) => {
    // Allow images, documents, audio and video files
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|mp3|wav|ogg|mp4|webm|mkv|mov/;
=======
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images, documents, and audio files
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|mp3|wav|ogg/;
>>>>>>> 9e8132601426e7f7949a64bfe5f2e014603f1259
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// @route   GET /api/chat
// @desc    Get user's chats
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const chats = await Chat.find({
      participants: req.user._id,
      isActive: true
    })
    .populate('participants', 'name email avatar isOnline lastSeen status')
    .populate({
      path: 'lastMessage',
      populate: {
        path: 'sender',
        select: 'name email avatar'
      }
    })
    .sort({ lastActivity: -1 })
    .skip(skip)
    .limit(parseInt(limit));

    // Format chats for frontend
    const formattedChats = chats.map(chat => {
      const otherParticipant = chat.participants.find(
        p => p._id.toString() !== req.user._id.toString()
      );

      return {
        _id: chat._id,
        chatType: chat.chatType,
        chatName: chat.chatName || otherParticipant?.name || 'Unknown User',
        participants: chat.participants,
        otherParticipant,
        lastMessage: chat.lastMessage,
        lastActivity: chat.lastActivity,
        createdAt: chat.createdAt
      };
    });

    res.json({
      success: true,
      chats: formattedChats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: chats.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get chats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting chats'
    });
  }
});

// @route   GET /api/chat/:id
// @desc    Get specific chat details
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      participants: req.user._id
    })
    .populate('participants', 'name email avatar isOnline lastSeen status')
    .populate('lastMessage');

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    const otherParticipant = chat.participants.find(
      p => p._id.toString() !== req.user._id.toString()
    );

    res.json({
      success: true,
      chat: {
        _id: chat._id,
        chatType: chat.chatType,
        chatName: chat.chatName || otherParticipant?.name || 'Unknown User',
        participants: chat.participants,
        otherParticipant,
        lastMessage: chat.lastMessage,
        lastActivity: chat.lastActivity,
        createdAt: chat.createdAt
      }
    });
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting chat'
    });
  }
});

// @route   GET /api/chat/:id/messages
// @desc    Get chat messages
// @access  Private
router.get('/:id/messages', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    
    // Verify user is participant in the chat
    const chat = await Chat.findOne({
      _id: req.params.id,
      participants: req.user._id
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    const messages = await Message.getChatMessages(
      req.params.id,
      parseInt(page),
      parseInt(limit)
    );

    // Mark messages as read
    await Message.markAsRead(req.params.id, req.user._id);

    res.json({
      success: true,
      messages: messages.reverse(), // Reverse to show oldest first
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: messages.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error getting messages'
    });
  }
});

// @route   POST /api/chat/:id/messages
// @desc    Send a message
// @access  Private
router.post('/:id/messages', async (req, res) => {
  try {
    const { content, messageType = 'text' } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    // Verify user is participant in the chat
    const chat = await Chat.findOne({
      _id: req.params.id,
      participants: req.user._id
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Create new message
    const message = new Message({
      chat: req.params.id,
      sender: req.user._id,
      content: content.trim(),
      messageType
    });

    await message.save();
    await message.populate('sender', 'name email avatar');

    // Update chat's last message and activity
    chat.lastMessage = message._id;
    await chat.updateLastActivity();

<<<<<<< HEAD
    // Emit via Socket.IO so participants see the message in real-time
      try {
        const io = req.app.get('io');
        if (io) {
          // send the populated message and minimal chat info
          io.to(chat._id.toString()).emit('new_message', {
            message,
            chat: { _id: chat._id, participants: chat.participants, lastActivity: chat.lastActivity }
          });
          console.log(`Emitted new_message to chat ${chat._id}`);
        }
      } catch (e) {
        console.error('Failed to emit new_message via io:', e);
      }

=======
>>>>>>> 9e8132601426e7f7949a64bfe5f2e014603f1259
    res.json({
      success: true,
      message,
      chat: {
        _id: chat._id,
        lastActivity: chat.lastActivity
      }
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error sending message'
    });
  }
});

// @route   POST /api/chat/:id/upload
// @desc    Upload file and send as message
// @access  Private
router.post('/:id/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Verify user is participant in the chat
    const chat = await Chat.findOne({
      _id: req.params.id,
      participants: req.user._id
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Determine message type based on file
    let messageType = 'file';
    if (req.file.mimetype.startsWith('image/')) {
      messageType = 'image';
    } else if (req.file.mimetype.startsWith('audio/')) {
      messageType = 'audio';
<<<<<<< HEAD
    } else if (req.file.mimetype.startsWith('video/')) {
      messageType = 'video';
=======
>>>>>>> 9e8132601426e7f7949a64bfe5f2e014603f1259
    }

    // Create new message with file
    const message = new Message({
      chat: req.params.id,
      sender: req.user._id,
      content: req.body.caption || req.file.originalname,
      messageType,
      fileUrl: `/uploads/${req.file.filename}`,
      fileName: req.file.originalname,
      fileSize: req.file.size
    });

    await message.save();
    await message.populate('sender', 'name email avatar');

    // Update chat's last message and activity
    chat.lastMessage = message._id;
    await chat.updateLastActivity();

<<<<<<< HEAD
    // Emit via Socket.IO so participants see the uploaded message in real-time
    try {
      const io = req.app.get('io');
      if (io) {
        io.to(chat._id.toString()).emit('new_message', {
          message,
          chat: { _id: chat._id, participants: chat.participants, lastActivity: chat.lastActivity }
        });
        console.log(`Emitted new_message (upload) to chat ${chat._id}`);
      }
    } catch (e) {
      console.error('Failed to emit new_message after upload:', e);
    }

=======
>>>>>>> 9e8132601426e7f7949a64bfe5f2e014603f1259
    res.json({
      success: true,
      message,
      file: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error uploading file'
    });
  }
});

// @route   PUT /api/chat/:id/messages/:messageId
// @desc    Edit a message
// @access  Private
router.put('/:id/messages/:messageId', async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    const message = await Message.findOne({
      _id: req.params.messageId,
      chat: req.params.id,
      sender: req.user._id,
      isDeleted: false
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or access denied'
      });
    }

    message.content = content.trim();
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    res.json({
      success: true,
      message,
<<<<<<< HEAD
      info: 'Message updated successfully'
=======
      message: 'Message updated successfully'
>>>>>>> 9e8132601426e7f7949a64bfe5f2e014603f1259
    });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error editing message'
    });
  }
});

// @route   DELETE /api/chat/:id/messages/:messageId
// @desc    Delete a message
// @access  Private
router.delete('/:id/messages/:messageId', async (req, res) => {
  try {
    const message = await Message.findOne({
      _id: req.params.messageId,
      chat: req.params.id,
      sender: req.user._id
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found or access denied'
      });
    }

    await message.softDelete();

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting message'
    });
  }
});

// @route   POST /api/chat/:id/messages/:messageId/react
// @desc    Add reaction to message
// @access  Private
router.post('/:id/messages/:messageId/react', async (req, res) => {
  try {
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({
        success: false,
        message: 'Emoji is required'
      });
    }

    const message = await Message.findOne({
      _id: req.params.messageId,
      chat: req.params.id,
      isDeleted: false
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    await message.addReaction(req.user._id, emoji);

    res.json({
      success: true,
      message: 'Reaction added successfully'
    });
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error adding reaction'
    });
  }
});

// @route   DELETE /api/chat/:id/messages/:messageId/react
// @desc    Remove reaction from message
// @access  Private
router.delete('/:id/messages/:messageId/react', async (req, res) => {
  try {
    const message = await Message.findOne({
      _id: req.params.messageId,
      chat: req.params.id,
      isDeleted: false
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    await message.removeReaction(req.user._id);

    res.json({
      success: true,
      message: 'Reaction removed successfully'
    });
  } catch (error) {
    console.error('Remove reaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error removing reaction'
    });
  }
});

// @route   DELETE /api/chat/:id
// @desc    Delete/Leave chat
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      participants: req.user._id
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // For private chats, just mark as inactive for this user
    // In a more complex implementation, you might want to handle this differently
    chat.isActive = false;
    await chat.save();

    res.json({
      success: true,
      message: 'Chat deleted successfully'
    });
  } catch (error) {
    console.error('Delete chat error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting chat'
    });
  }
});

module.exports = router;

<<<<<<< HEAD
// --- Group Rooms endpoints ---
// Create a group room
router.post('/rooms', async (req, res) => {
  try {
    const { chatName, participantIds = [] } = req.body;

    const participants = Array.isArray(participantIds) ? participantIds : [];
    // Ensure creator is included
    if (!participants.includes(req.user._id.toString())) {
      participants.push(req.user._id);
    }

    const group = new Chat({
      participants,
      chatType: 'group',
      chatName: chatName || 'New Group',
      createdBy: req.user._id
    });

    await group.save();

    const populated = await Chat.findById(group._id).populate('participants', 'name email avatar isOnline lastSeen status');

    // Notify participants (by user personal room) about the new group
    try {
      const io = req.app.get('io');
      if (io && populated && populated.participants) {
        populated.participants.forEach(p => {
          if (p && p._id) io.to(p._id.toString()).emit('group_created', { chat: populated });
        });
      }
    } catch (e) {
      console.error('Failed to emit group_created:', e);
    }

    res.json({ success: true, chat: populated });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ success: false, message: 'Server error creating room' });
  }
});

// List group rooms the user participates in
router.get('/rooms', async (req, res) => {
  try {
    const rooms = await Chat.find({ chatType: 'group', participants: req.user._id })
      .populate('participants', 'name email avatar isOnline lastSeen status')
      .sort({ lastActivity: -1 });

    res.json({ success: true, rooms });
  } catch (error) {
    console.error('List rooms error:', error);
    res.status(500).json({ success: false, message: 'Server error listing rooms' });
  }
});

// Alias to get messages for a room (rooms are chats)
router.get('/rooms/:id/messages', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const messages = await Message.getChatMessages(req.params.id, parseInt(page), parseInt(limit));

    // Mark messages as read for the requester
    await Message.markAsRead(req.params.id, req.user._id);

    res.json({
      success: true,
      messages: messages.reverse(),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: messages.length === parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get room messages error:', error);
    res.status(500).json({ success: false, message: 'Server error getting room messages' });
  }
});

=======
>>>>>>> 9e8132601426e7f7949a64bfe5f2e014603f1259
