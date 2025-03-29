// Initialize Telegram WebApp
const webapp = window.Telegram.WebApp;
webapp.expand();

// Initialize Socket.IO
const socket = io('http://localhost:3000');

// Generate a unique ID if not in Telegram
function generateUniqueId() {
    return 'local_' + Math.random().toString(36).substr(2, 9);
}

// Get or create unique ID
const uniqueId = webapp.initDataUnsafe.user?.id || generateUniqueId();

// Card categories and questions
const cardCategories = {
    values: [
        "What do you value most in a relationship?",
        "How do you handle conflicts?",
        "What's your ideal way of spending quality time together?",
        "How important is family to you?",
        "What are your deal-breakers in a relationship?"
    ],
    hobbies: [
        "What's your favorite weekend activity?",
        "Do you enjoy traveling? Where would you like to go?",
        "What kind of music do you listen to?",
        "Are you into sports or fitness?",
        "What's your favorite way to relax?"
    ],
    goals: [
        "Where do you see yourself in 5 years?",
        "What are your career aspirations?",
        "Do you want to have children?",
        "What's your ideal living situation?",
        "What are your financial goals?"
    ],
    fun: [
        "What's the weirdest food you've ever tried?",
        "If you could have any superpower, what would it be?",
        "What's your guilty pleasure?",
        "What's the most embarrassing thing that's happened to you?",
        "What's your favorite dad joke?"
    ]
};

// Game state
let currentState = {
    stage: 1,
    compatibility: 0,
    currentCategory: 'values',
    currentQuestionIndex: 0,
    profile: null,
    isWaiting: false,
    matchFound: false,
    opponent: null,
    sessionId: null,
    turn: null,
    history: []
};

// DOM Elements
const screens = {
    onboarding: document.getElementById('onboarding-screen'),
    profile: document.getElementById('profile-screen'),
    waiting: document.getElementById('waiting-screen'),
    game: document.getElementById('game-screen'),
    chat: document.getElementById('chat-screen')
};

const elements = {
    startProfileBtn: document.getElementById('start-profile'),
    profileForm: document.getElementById('profile-form'),
    profileActions: document.getElementById('profile-actions'),
    joinGameBtn: document.getElementById('join-game'),
    editProfileBtn: document.getElementById('edit-profile'),
    deleteProfileBtn: document.getElementById('delete-profile'),
    currentCard: document.getElementById('current-card'),
    cardQuestion: document.getElementById('card-question'),
    cardAnswer: document.getElementById('card-answer'),
    answerInput: document.getElementById('answer-input'),
    submitAnswer: document.getElementById('submit-answer'),
    compatibilityProgress: document.getElementById('compatibility-progress'),
    currentStage: document.getElementById('current-stage'),
    likeBtn: document.getElementById('like-btn'),
    skipBtn: document.getElementById('skip-btn'),
    compromiseBtn: document.getElementById('compromise-btn'),
    cancelWaitingBtn: document.getElementById('cancel-waiting'),
    currentPlayer: document.getElementById('current-player'),
    opponentPlayer: document.getElementById('opponent-player'),
    onlinePlayers: document.getElementById('online-players'),
    waitTime: document.getElementById('wait-time')
};

// Screen Management
function showScreen(screenId) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenId].classList.add('active');
}

// Initialize the app
function init() {
    // Set theme colors from Telegram
    document.documentElement.style.setProperty('--background-color', webapp.backgroundColor);
    document.documentElement.style.setProperty('--text-color', webapp.textColor);
    
    // Check for existing profile with unique ID
    const savedProfile = localStorage.getItem(`pokerDatingProfile_${uniqueId}`);
    if (savedProfile) {
        currentState.profile = JSON.parse(savedProfile);
        showScreen('profile');
        elements.profileForm.classList.add('hidden');
        elements.profileActions.classList.remove('hidden');
    } else {
        showScreen('onboarding');
    }
}

// Profile Management
elements.startProfileBtn.addEventListener('click', () => {
    showScreen('profile');
});

function validateProfile(profile) {
    if (!profile.name || !profile.age || !profile.location || !profile.bio) {
        return false;
    }
    if (profile.age < 18 || profile.age > 100) {
        return false;
    }
    return true;
}

elements.profileForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newProfile = {
        name: document.getElementById('name').value.trim(),
        age: parseInt(document.getElementById('age').value),
        location: document.getElementById('location').value.trim(),
        bio: document.getElementById('bio').value.trim(),
        uniqueId: uniqueId
    };

    if (!validateProfile(newProfile)) {
        webapp.showAlert('Please fill in all required fields correctly!');
        return;
    }

    currentState.profile = newProfile;
    localStorage.setItem(`pokerDatingProfile_${uniqueId}`, JSON.stringify(currentState.profile));
    elements.profileForm.classList.add('hidden');
    elements.profileActions.classList.remove('hidden');
});

elements.joinGameBtn.addEventListener('click', () => {
    if (!currentState.profile || !validateProfile(currentState.profile)) {
        webapp.showAlert('Please complete your profile before joining a game!');
        elements.profileForm.classList.remove('hidden');
        elements.profileActions.classList.add('hidden');
        return;
    }
    startWaiting();
});

elements.editProfileBtn.addEventListener('click', () => {
    elements.profileForm.classList.remove('hidden');
    elements.profileActions.classList.add('hidden');
    document.getElementById('name').value = currentState.profile.name;
    document.getElementById('age').value = currentState.profile.age;
    document.getElementById('location').value = currentState.profile.location;
    document.getElementById('bio').value = currentState.profile.bio;
});

elements.deleteProfileBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to delete your profile? This action cannot be undone.')) {
        localStorage.removeItem(`pokerDatingProfile_${uniqueId}`);
        currentState.profile = null;
        showScreen('onboarding');
    }
});

// Socket.IO event handlers
socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('waitingCount', (count) => {
    elements.onlinePlayers.textContent = count;
});

socket.on('queueStatus', (status) => {
    elements.waitTime.textContent = status.message;
});

socket.on('matchFound', (data) => {
    currentState.matchFound = true;
    currentState.sessionId = data.sessionId;
    currentState.opponent = data.opponent;
    currentState.turn = data.session.turn;
    currentState.stage = data.session.stage;
    currentState.compatibility = data.session.compatibility;
    currentState.history = data.session.history;
    startGame();
});

socket.on('gameUpdate', (data) => {
    if (data.sessionId === currentState.sessionId) {
        currentState.turn = data.session.turn;
        currentState.history = data.session.history;
        currentState.compatibility = data.session.compatibility;
        updateGameUI();
    }
});

socket.on('stageComplete', (data) => {
    if (data.sessionId === currentState.sessionId) {
        currentState.stage = data.stage;
        currentState.compatibility = 0;
        webapp.showAlert(`Congratulations! You've progressed to stage ${data.stage}!`);
        updateGameUI();
    }
});

socket.on('playerDisconnected', (data) => {
    if (data.sessionId === currentState.sessionId) {
        webapp.showAlert('Other player disconnected');
        showScreen('profile');
    }
});

socket.on('error', (error) => {
    webapp.showAlert(error.message);
});

// Waiting System
function startWaiting() {
    currentState.isWaiting = true;
    showScreen('waiting');
    socket.emit('joinWaiting', currentState.profile);
}

elements.cancelWaitingBtn.addEventListener('click', () => {
    currentState.isWaiting = false;
    socket.emit('leaveWaiting');
    showScreen('profile');
});

// Game Logic
function startGame() {
    currentState.isWaiting = false;
    showScreen('game');
    updateGameUI();
}

function updateGameUI() {
    elements.currentPlayer.textContent = currentState.profile.name;
    elements.opponentPlayer.textContent = currentState.opponent.name;
    elements.currentStage.textContent = `Stage ${currentState.stage}`;
    updateCompatibilityProgress();
    updateCardUI();
}

function updateCompatibilityProgress() {
    const progress = (currentState.compatibility / 100) * 100;
    elements.compatibilityProgress.style.width = `${progress}%`;
}

function updateCardUI() {
    const isMyTurn = currentState.turn === socket.id;
    const lastCard = currentState.history[currentState.history.length - 1];
    
    // Clear previous state
    elements.cardQuestion.textContent = '';
    elements.cardAnswer.textContent = '';
    elements.cardAnswer.classList.add('hidden');
    elements.answerInput.value = '';
    elements.answerInput.classList.add('hidden');
    elements.submitAnswer.classList.add('hidden');
    elements.likeBtn.classList.add('hidden');
    elements.skipBtn.classList.add('hidden');
    elements.compromiseBtn.classList.add('hidden');

    if (isMyTurn) {
        if (!lastCard || lastCard.response) {
            // My turn to ask a question
            const category = cardCategories[currentState.currentCategory];
            const question = category[currentState.currentQuestionIndex];
            elements.cardQuestion.textContent = question;
            elements.answerInput.classList.remove('hidden');
            elements.submitAnswer.classList.remove('hidden');
        } else {
            // Waiting for opponent's response
            elements.cardQuestion.textContent = lastCard.card.question;
            elements.cardAnswer.textContent = lastCard.card.answer;
            elements.cardAnswer.classList.remove('hidden');
            elements.waitTime.textContent = "Waiting for opponent's response...";
        }
    } else {
        if (lastCard && !lastCard.response) {
            // My turn to respond
            elements.cardQuestion.textContent = lastCard.card.question;
            elements.cardAnswer.textContent = lastCard.card.answer;
            elements.cardAnswer.classList.remove('hidden');
            elements.likeBtn.classList.remove('hidden');
            elements.skipBtn.classList.remove('hidden');
            elements.compromiseBtn.classList.remove('hidden');
        } else {
            // Waiting for opponent's question
            elements.waitTime.textContent = "Waiting for opponent's question...";
        }
    }
}

elements.submitAnswer.addEventListener('click', () => {
    const answer = elements.answerInput.value.trim();
    if (!answer) {
        webapp.showAlert('Please write your answer first!');
        return;
    }

    const category = cardCategories[currentState.currentCategory];
    const question = category[currentState.currentQuestionIndex];
    
    socket.emit('submitCard', {
        sessionId: currentState.sessionId,
        card: {
            question,
            answer
        }
    });
});

elements.likeBtn.addEventListener('click', () => {
    socket.emit('respondCard', {
        sessionId: currentState.sessionId,
        response: 'like'
    });
});

elements.skipBtn.addEventListener('click', () => {
    socket.emit('respondCard', {
        sessionId: currentState.sessionId,
        response: 'dislike'
    });
});

elements.compromiseBtn.addEventListener('click', () => {
    socket.emit('respondCard', {
        sessionId: currentState.sessionId,
        response: 'compromise'
    });
});

// Start the app
init(); 