// Initialize Telegram WebApp
const webapp = window.Telegram.WebApp;
webapp.expand();

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
    profile: null
};

// DOM Elements
const screens = {
    onboarding: document.getElementById('onboarding-screen'),
    profile: document.getElementById('profile-screen'),
    game: document.getElementById('game-screen'),
    chat: document.getElementById('chat-screen')
};

const elements = {
    startProfileBtn: document.getElementById('start-profile'),
    profileForm: document.getElementById('profile-form'),
    currentCard: document.getElementById('current-card'),
    cardQuestion: document.getElementById('card-question'),
    cardAnswer: document.getElementById('card-answer'),
    answerInput: document.getElementById('answer-input'),
    submitAnswer: document.getElementById('submit-answer'),
    compatibilityProgress: document.getElementById('compatibility-progress'),
    currentStage: document.getElementById('current-stage'),
    likeBtn: document.getElementById('like-btn'),
    skipBtn: document.getElementById('skip-btn'),
    compromiseBtn: document.getElementById('compromise-btn')
};

// Screen Management
function showScreen(screenId) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenId].classList.add('active');
}

// Profile Management
elements.startProfileBtn.addEventListener('click', () => {
    showScreen('profile');
});

elements.profileForm.addEventListener('submit', (e) => {
    e.preventDefault();
    currentState.profile = {
        name: document.getElementById('name').value,
        age: document.getElementById('age').value,
        location: document.getElementById('location').value,
        bio: document.getElementById('bio').value
    };
    startGame();
});

// Game Logic
function startGame() {
    showScreen('game');
    updateCard();
    updateProgress();
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

// Add answer submission handler
elements.submitAnswer.addEventListener('click', () => {
    const answer = elements.answerInput.value.trim();
    if (answer) {
        elements.cardAnswer.textContent = answer;
        elements.cardAnswer.classList.remove('hidden');
        elements.answerInput.classList.add('hidden');
        elements.submitAnswer.classList.add('hidden');
        
        // Show action buttons after answer is submitted
        elements.likeBtn.classList.remove('hidden');
        elements.skipBtn.classList.remove('hidden');
        elements.compromiseBtn.classList.remove('hidden');
    }
});

// Update card actions to check for answer
elements.likeBtn.addEventListener('click', () => {
    if (!elements.cardAnswer.textContent) {
        webapp.showAlert('Please submit your answer first!');
        return;
    }
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
    nextCard();
});

elements.compromiseBtn.addEventListener('click', () => {
    if (!elements.cardAnswer.textContent) {
        webapp.showAlert('Please submit your answer first!');
        return;
    }
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

// Initialize the app
function init() {
    // Set theme colors from Telegram
    document.documentElement.style.setProperty('--background-color', webapp.backgroundColor);
    document.documentElement.style.setProperty('--text-color', webapp.textColor);
    
    // Show onboarding screen
    showScreen('onboarding');
}

// Start the app
init(); 