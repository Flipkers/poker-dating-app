const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
    users: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    status: {
        type: String,
        enum: ['active', 'completed', 'cancelled'],
        default: 'active'
    },
    currentStage: {
        type: Number,
        default: 1
    },
    compatibility: {
        type: Number,
        default: 0
    },
    actions: [{
        userId: String,
        action: {
            type: String,
            enum: ['like', 'skip', 'compromise']
        },
        answer: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    completedAt: Date
});

module.exports = mongoose.model('Match', matchSchema); 