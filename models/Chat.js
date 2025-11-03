const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  chatType: {
    type: String,
    enum: ['private', 'group'],
    default: 'private'
  },
  chatName: {
    type: String,
    default: ''
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create compound index for efficient queries
chatSchema.index({ participants: 1, chatType: 1 });
chatSchema.index({ lastActivity: -1 });

// Update the updatedAt field before saving
chatSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Static method to find or create a private chat between two users
chatSchema.statics.findOrCreatePrivateChat = async function(user1Id, user2Id) {
  try {
    // Check if chat already exists
    let chat = await this.findOne({
      chatType: 'private',
      participants: { $all: [user1Id, user2Id], $size: 2 }
    }).populate('participants', 'name email avatar isOnline lastSeen status')
      .populate('lastMessage');

    if (!chat) {
      // Create new chat
      chat = new this({
        participants: [user1Id, user2Id],
        chatType: 'private',
        createdBy: user1Id
      });
      await chat.save();
      
      // Populate the newly created chat
      chat = await this.findById(chat._id)
        .populate('participants', 'name email avatar isOnline lastSeen status')
        .populate('lastMessage');
    }

    return chat;
  } catch (error) {
    throw error;
  }
};

// Static method to get user's chats
chatSchema.statics.getUserChats = function(userId) {
  return this.find({
    participants: userId,
    isActive: true
  })
  .populate('participants', 'name email avatar isOnline lastSeen status')
  .populate('lastMessage')
  .sort({ lastActivity: -1 });
};

// Instance method to update last activity
chatSchema.methods.updateLastActivity = function() {
  this.lastActivity = new Date();
  return this.save();
};

module.exports = mongoose.model('Chat', chatSchema);

