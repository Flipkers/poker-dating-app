// Initialize Telegram WebApp
const webapp = window.Telegram.WebApp;
webapp.expand();

// Initialize Socket.IO
const socket = io('https://poker-dating-backend.onrender.com');

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
    matchId: null
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
        telegramId: webapp.initDataUnsafe.user?.id,
        uniqueId: uniqueId // Add unique ID to profile
    };

    if (!validateProfile(newProfile)) {
        webapp.showAlert('Please fill in all required fields correctly!');
        return;
    }

    currentState.profile = newProfile;
    // Save profile to localStorage with unique ID
    localStorage.setItem(`pokerDatingProfile_${uniqueId}`, JSON.stringify(currentState.profile));
    // Show profile actions
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
    // Pre-fill the form with current profile data
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
socket.on('waitingCount', (count) => {
    elements.onlinePlayers.textContent = count;
});

socket.on('matchFound', (data) => {
    currentState.matchFound = true;
    currentState.matchId = data.matchId;
    currentState.opponent = data.opponent;
    startGame();
});

socket.on('matchUpdate', (match) => {
    // Update game state based on match data
    currentState.stage = match.currentStage;
    currentState.compatibility = match.compatibility;
    updateProgress();
});

socket.on('error', (error) => {
    webapp.showAlert(error.message);
});

// Waiting System
function startWaiting() {
    currentState.isWaiting = true;
    showScreen('waiting');
    updateWaitingStats();
    socket.emit('joinWaiting', currentState.profile);
}

function updateWaitingStats() {
    // Stats will be updated via Socket.IO events
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
    updateCard();
    updateProgress();
    updatePlayerInfo();
}

function updatePlayerInfo() {
    elements.currentPlayer.textContent = currentState.profile.name;
    elements.opponentPlayer.textContent = currentState.opponent.name;
}

function updateCard() {
    const category = cardCategories[currentState.currentCategory];
    const question = category[currentState.currentQuestionIndex];
    elements.cardQuestion.textContent = question;
    elements.cardAnswer.classList.add('hidden');
    elements.answerInput.classList.remove('hidden');
    elements.submitAnswer.classList.remove('hidden');
    elements.answerInput.value = '';
    
    // Hide action buttons until answer is submitted
    elements.likeBtn.classList.add('hidden');
    elements.skipBtn.classList.add('hidden');
    elements.compromiseBtn.classList.add('hidden');
}

function updateProgress() {
    const progress = (currentState.compatibility / 100) * 100;
    elements.compatibilityProgress.style.width = `${progress}%`;
    elements.currentStage.textContent = currentState.stage;
}

// Update card actions to emit events
elements.submitAnswer.addEventListener('click', () => {
    const answer = elements.answerInput.value.trim();
    if (answer) {
        elements.cardAnswer.textContent = answer;
        elements.cardAnswer.classList.remove('hidden');
        elements.answerInput.classList.add('hidden');
        elements.submitAnswer.classList.add('hidden');
        
        elements.likeBtn.classList.remove('hidden');
        elements.skipBtn.classList.remove('hidden');
        elements.compromiseBtn.classList.remove('hidden');
    }
});

elements.likeBtn.addEventListener('click', () => {
    if (!elements.cardAnswer.textContent) {
        webapp.showAlert('Please submit your answer first!');
        return;
    }
    
    socket.emit('gameAction', {
        matchId: currentState.matchId,
        action: 'like',
        answer: elements.cardAnswer.textContent
    });
    
    currentState.compatibility += 25;
    if (currentState.compatibility >= 100) {
        currentState.stage++;
        currentState.compatibility = 0;
    }
    nextCard();
});

elements.skipBtn.addEventListener('click', () => {
    if (!elements.cardAnswer.textContent) {
        webapp.showAlert('Please submit your answer first!');
        return;
    }
    
    socket.emit('gameAction', {
        matchId: currentState.matchId,
        action: 'skip',
        answer: elements.cardAnswer.textContent
    });
    
    nextCard();
});

elements.compromiseBtn.addEventListener('click', () => {
    if (!elements.cardAnswer.textContent) {
        webapp.showAlert('Please submit your answer first!');
        return;
    }
    
    socket.emit('gameAction', {
        matchId: currentState.matchId,
        action: 'compromise',
        answer: elements.cardAnswer.textContent
    });
    
    currentState.compatibility += 10;
    nextCard();
});

function nextCard() {
    currentState.currentQuestionIndex++;
    if (currentState.currentQuestionIndex >= cardCategories[currentState.currentCategory].length) {
        currentState.currentQuestionIndex = 0;
        // Rotate through categories
        const categories = Object.keys(cardCategories);
        const currentIndex = categories.indexOf(currentState.currentCategory);
        currentState.currentCategory = categories[(currentIndex + 1) % categories.length];
    }
    updateCard();
    updateProgress();
}

// Start the app
init(); 