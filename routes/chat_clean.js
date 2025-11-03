const express = require('express');
const multer = require('multer');
const path = require('path');
const Chat = require('../models/Chat');
const Message = require('../models/Message');

const router = express.Router();

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|pdf|doc|docx|txt|mp3|wav|ogg|mp4|webm|mkv|mov/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype);
    if (ok) return cb(null, true);
    cb(new Error('Invalid file type'));
  }
});

function parsePageLimit(page, limit, defaultPage = 1, defaultLimit = 20) {
  const p = parseInt(page) || defaultPage;
  const l = parseInt(limit) || defaultLimit;
  return { page: p, limit: l, skip: (p - 1) * l };
}

// GET /api/chat - list user's chats
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { skip } = parsePageLimit(page, limit);

    const chats = await Chat.find({ participants: req.user._id, isActive: true })
      .populate('participants', 'name email avatar isOnline lastSeen status')
      .populate({ path: 'lastMessage', populate: { path: 'sender', select: 'name email avatar' } })
      .sort({ lastActivity: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const formatted = chats.map(chat => {
      const other = chat.participants.find(p => p._id.toString() !== req.user._id.toString());
      return {
        _id: chat._id,
        chatType: chat.chatType,
        chatName: chat.chatName || other?.name || 'Unknown',
        participants: chat.participants,
        otherParticipant: other,
        lastMessage: chat.lastMessage,
        lastActivity: chat.lastActivity,
        createdAt: chat.createdAt
      };
    });

    res.json({ success: true, chats: formatted, pagination: { page: parseInt(page), limit: parseInt(limit), hasMore: chats.length === parseInt(limit) } });
  } catch (err) {
    console.error('Get chats error:', err);
    res.status(500).json({ success: false, message: 'Server error getting chats' });
  }
});

// GET /api/chat/:id - get chat details
router.get('/:id', async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, participants: req.user._id })
      .populate('participants', 'name email avatar isOnline lastSeen status')
      .populate({ path: 'lastMessage', populate: { path: 'sender', select: 'name email avatar' } });

    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });

    const other = chat.participants.find(p => p._id.toString() !== req.user._id.toString());
    res.json({ success: true, chat: { _id: chat._id, chatType: chat.chatType, chatName: chat.chatName || other?.name || 'Unknown', participants: chat.participants, otherParticipant: other, lastMessage: chat.lastMessage, lastActivity: chat.lastActivity, createdAt: chat.createdAt } });
  } catch (err) {
    console.error('Get chat error:', err);
    res.status(500).json({ success: false, message: 'Server error getting chat' });
  }
});

// GET messages
router.get('/:id/messages', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const { skip } = parsePageLimit(page, limit, 1, 50);

    const chat = await Chat.findOne({ _id: req.params.id, participants: req.user._id });
    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });

    const messages = await Message.getChatMessages(req.params.id, parseInt(page), parseInt(limit));
    await Message.markAsRead(req.params.id, req.user._id);

    res.json({ success: true, messages: messages.reverse(), pagination: { page: parseInt(page), limit: parseInt(limit), hasMore: messages.length === parseInt(limit) } });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ success: false, message: 'Server error getting messages' });
  }
});

// POST message
router.post('/:id/messages', async (req, res) => {
  try {
    const { content, messageType = 'text' } = req.body;
    if (!content || content.trim().length === 0) return res.status(400).json({ success: false, message: 'Message content is required' });

    const chat = await Chat.findOne({ _id: req.params.id, participants: req.user._id });
    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });

    const message = new Message({ chat: req.params.id, sender: req.user._id, content: content.trim(), messageType });
    await message.save();
    await message.populate('sender', 'name email avatar');

    chat.lastMessage = message._id;
    await chat.updateLastActivity();

    // Emit with io if available
    try {
      const io = req.app.get('io');
      if (io) io.to(chat._id.toString()).emit('new_message', { message, chat: { _id: chat._id, participants: chat.participants, lastActivity: chat.lastActivity } });
    } catch (e) {
      console.error('Emit new_message error:', e);
    }

    res.json({ success: true, message, chat: { _id: chat._id, lastActivity: chat.lastActivity } });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ success: false, message: 'Server error sending message' });
  }
});

// Upload file and send
router.post('/:id/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const chat = await Chat.findOne({ _id: req.params.id, participants: req.user._id });
    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });

    let messageType = 'file';
    if (req.file.mimetype.startsWith('image/')) messageType = 'image';
    else if (req.file.mimetype.startsWith('audio/')) messageType = 'audio';
    else if (req.file.mimetype.startsWith('video/')) messageType = 'video';

    const message = new Message({ chat: req.params.id, sender: req.user._id, content: req.body.caption || req.file.originalname, messageType, fileUrl: `/uploads/${req.file.filename}`, fileName: req.file.originalname, fileSize: req.file.size });
    await message.save();
    await message.populate('sender', 'name email avatar');

    chat.lastMessage = message._id;
    await chat.updateLastActivity();

    try {
      const io = req.app.get('io');
      if (io) io.to(chat._id.toString()).emit('new_message', { message, chat: { _id: chat._id, participants: chat.participants, lastActivity: chat.lastActivity } });
    } catch (e) {
      console.error('Emit new_message after upload error:', e);
    }

    res.json({ success: true, message, file: { filename: req.file.filename, originalname: req.file.originalname, size: req.file.size, mimetype: req.file.mimetype } });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ success: false, message: 'Server error uploading file' });
  }
});

// Edit message
router.put('/:id/messages/:messageId', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || content.trim().length === 0) return res.status(400).json({ success: false, message: 'Message content is required' });

    const message = await Message.findOne({ _id: req.params.messageId, chat: req.params.id, sender: req.user._id, isDeleted: false });
    if (!message) return res.status(404).json({ success: false, message: 'Message not found or access denied' });

    message.content = content.trim();
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    res.json({ success: true, message, info: 'Message updated successfully' });
  } catch (err) {
    console.error('Edit message error:', err);
    res.status(500).json({ success: false, message: 'Server error editing message' });
  }
});

// Delete message
router.delete('/:id/messages/:messageId', async (req, res) => {
  try {
    const message = await Message.findOne({ _id: req.params.messageId, chat: req.params.id, sender: req.user._id });
    if (!message) return res.status(404).json({ success: false, message: 'Message not found or access denied' });
    await message.softDelete();
    res.json({ success: true, message: 'Message deleted successfully' });
  } catch (err) {
    console.error('Delete message error:', err);
    res.status(500).json({ success: false, message: 'Server error deleting message' });
  }
});

// Reactions
router.post('/:id/messages/:messageId/react', async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ success: false, message: 'Emoji is required' });
    const message = await Message.findOne({ _id: req.params.messageId, chat: req.params.id, isDeleted: false });
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
    await message.addReaction(req.user._id, emoji);
    res.json({ success: true, message: 'Reaction added successfully' });
  } catch (err) {
    console.error('Add reaction error:', err);
    res.status(500).json({ success: false, message: 'Server error adding reaction' });
  }
});

router.delete('/:id/messages/:messageId/react', async (req, res) => {
  try {
    const message = await Message.findOne({ _id: req.params.messageId, chat: req.params.id, isDeleted: false });
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
    await message.removeReaction(req.user._id);
    res.json({ success: true, message: 'Reaction removed successfully' });
  } catch (err) {
    console.error('Remove reaction error:', err);
    res.status(500).json({ success: false, message: 'Server error removing reaction' });
  }
});

// Leave/delete chat
router.delete('/:id', async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, participants: req.user._id });
    if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });
    chat.isActive = false;
    await chat.save();
    res.json({ success: true, message: 'Chat deleted successfully' });
  } catch (err) {
    console.error('Delete chat error:', err);
    res.status(500).json({ success: false, message: 'Server error deleting chat' });
  }
});

// Group rooms
router.post('/rooms', async (req, res) => {
  try {
    const { chatName, participantIds = [] } = req.body;
    const participants = Array.isArray(participantIds) ? participantIds.slice() : [];
    if (!participants.includes(req.user._id.toString())) participants.push(req.user._id);

    const group = new Chat({ participants, chatType: 'group', chatName: chatName || 'New Group', createdBy: req.user._id });
    await group.save();
    const populated = await Chat.findById(group._id).populate('participants', 'name email avatar isOnline lastSeen status');

    try {
      const io = req.app.get('io');
      if (io && populated && populated.participants) {
        populated.participants.forEach(p => { if (p && p._id) io.to(p._id.toString()).emit('group_created', { chat: populated }); });
      }
    } catch (e) {
      console.error('Emit group_created error:', e);
    }

    res.json({ success: true, chat: populated });
  } catch (err) {
    console.error('Create room error:', err);
    res.status(500).json({ success: false, message: 'Server error creating room' });
  }
});

router.get('/rooms', async (req, res) => {
  try {
    const rooms = await Chat.find({ chatType: 'group', participants: req.user._id }).populate('participants', 'name email avatar isOnline lastSeen status').sort({ lastActivity: -1 });
    res.json({ success: true, rooms });
  } catch (err) {
    console.error('List rooms error:', err);
    res.status(500).json({ success: false, message: 'Server error listing rooms' });
  }
});

router.get('/rooms/:id/messages', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const messages = await Message.getChatMessages(req.params.id, parseInt(page), parseInt(limit));
    await Message.markAsRead(req.params.id, req.user._id);
    res.json({ success: true, messages: messages.reverse(), pagination: { page: parseInt(page), limit: parseInt(limit), hasMore: messages.length === parseInt(limit) } });
  } catch (err) {
    console.error('Get room messages error:', err);
    res.status(500).json({ success: false, message: 'Server error getting room messages' });
  }
});

module.exports = router;
