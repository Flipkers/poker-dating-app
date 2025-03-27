const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    age: {
        type: Number,
        required: true,
        min: 18,
        max: 100
    },
    location: {
        type: String,
        required: true
    },
    bio: {
        type: String,
        required: true
    },
    telegramId: {
        type: String,
        unique: true,
        sparse: true
    },
    uniqueId: {
        type: String,
        unique: true,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('User', userSchema); 