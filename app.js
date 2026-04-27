// Exchange Rate: 1 EUR = X RUB
const EXCHANGE_RATE = 90.00; // Fixed rate as requested

// State
let expenses = [];
let selectedCategory = 'food';
let selectedSource = 'boda';

// DOM Elements
const totalRubEl = document.getElementById('total-rub');
const totalEurEl = document.getElementById('total-eur');
const totalBodaEl = document.getElementById('total-boda');
const totalPolinaEl = document.getElementById('total-polina');
const totalXeviEl = document.getElementById('total-xevi');
const rateDisplayEl = document.getElementById('rate-display');
const expensesListEl = document.getElementById('expenses-list');
const fabButton = document.getElementById('fab-button');
const modalOverlay = document.getElementById('add-modal');
const closeModal = document.getElementById('close-modal');
const btnManual = document.getElementById('btn-manual');
const cameraInput = document.getElementById('camera-input');
const expenseForm = document.getElementById('expense-form');
const catOptions = document.querySelectorAll('.cat-option');
const sourceOptions = document.querySelectorAll('.source-option');
const scannerOverlay = document.getElementById('scanner');

// Initialize
function init() {
    rateDisplayEl.textContent = EXCHANGE_RATE.toFixed(2);
    loadExpenses();
    updateDashboard();
    renderExpenses();
    setupEventListeners();
    registerServiceWorker();
    checkStandalone();
}

// Service Worker Registration
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => console.log('Service Worker registrado ✨'))
                .catch(err => console.log('Error registering SW', err));
        });
    }
}

// Standalone Mode Detection (for Safari Hint)
function checkStandalone() {
    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    const safariHint = document.getElementById('safari-hint');
    const hintDismissed = localStorage.getItem('safari-hint-dismissed');

    if (!isStandalone && !hintDismissed) {
        safariHint.classList.remove('hidden');
    }
}

// Load from LocalStorage
function loadExpenses() {
    const saved = localStorage.getItem('viaje-rusia-expenses');
    if (saved) {
        expenses = JSON.parse(saved);
    }
}

// Save to LocalStorage
function saveExpenses() {
    localStorage.setItem('viaje-rusia-expenses', JSON.stringify(expenses));
}

// Update Dashboard Totals
function updateDashboard() {
    const totalRub = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    const totalEur = totalRub / EXCHANGE_RATE;

    const totalBoda = expenses
        .filter(exp => exp.source === 'boda')
        .reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    const totalPolina = expenses
        .filter(exp => exp.source === 'polina')
        .reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    const totalXevi = expenses
        .filter(exp => exp.source === 'xevi')
        .reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

    totalRubEl.textContent = formatCurrency(totalRub, '₽');
    totalEurEl.textContent = `(${formatCurrency(totalEur, '€')})`;
    
    totalBodaEl.textContent = formatCurrency(totalBoda, '₽');
    totalPolinaEl.textContent = formatCurrency(totalPolina, '₽');
    totalXeviEl.textContent = formatCurrency(totalXevi, '₽');
}

// Format Currency
function formatCurrency(amount, symbol) {
    return new Intl.NumberFormat('es-ES', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    }).format(amount) + ' ' + symbol;
}

// Render Expenses List
function renderExpenses() {
    if (expenses.length === 0) {
        expensesListEl.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-receipt"></i>
                <p>No hay gastos todavía.<br>¡Añade uno para empezar!</p>
            </div>
        `;
        return;
    }

    expensesListEl.innerHTML = '';
    
    // Sort by newest first
    const sortedExpenses = [...expenses].reverse();

    sortedExpenses.forEach(exp => {
        const eurAmount = exp.amount / EXCHANGE_RATE;
        const iconInfo = getCategoryIcon(exp.category);
        
        const el = document.createElement('div');
        el.className = 'expense-item';
        el.innerHTML = `
            <div class="expense-info">
                <div class="expense-icon ${exp.category}">
                    <i class="fa-solid ${iconInfo}"></i>
                </div>
                <div class="expense-details">
                    <h3>${exp.description}</h3>
                    <p>${formatDate(exp.date)} • <span style="text-transform: capitalize; color: var(--ocean-deep); font-weight: 600;">${exp.source}</span></p>
                </div>
            </div>
            <div class="expense-amounts">
                <div class="expense-rub">${formatCurrency(exp.amount, '₽')}</div>
                <div class="expense-eur">${formatCurrency(eurAmount, '€')}</div>
            </div>
        `;
        expensesListEl.appendChild(el);
    });
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-ES', { 
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
    }).format(date);
}

function getCategoryIcon(cat) {
    const icons = {
        'food': 'fa-utensils',
        'transport': 'fa-train',
        'hotel': 'fa-bed',
        'shopping': 'fa-bag-shopping',
        'other': 'fa-star'
    };
    return icons[cat] || icons['other'];
}

// Event Listeners
function setupEventListeners() {
    // FAB -> Open Modal
    fabButton.addEventListener('click', () => {
        modalOverlay.classList.add('active');
        expenseForm.classList.add('hidden');
        document.querySelector('.action-buttons').classList.remove('hidden');
    });

    // Close Modal
    closeModal.addEventListener('click', () => {
        modalOverlay.classList.remove('active');
        expenseForm.reset();
    });

    // Manual Button
    btnManual.addEventListener('click', () => {
        document.querySelector('.action-buttons').classList.add('hidden');
        expenseForm.classList.remove('hidden');
        document.getElementById('expense-desc').focus();
    });

    // Camera Input (Simulate OCR)
    cameraInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            simulateScanner();
            e.target.value = ''; // Reset input
        }
    });

    // Category Selection
    catOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            catOptions.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedCategory = opt.dataset.cat;
        });
    });

    // Source Selection
    sourceOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            sourceOptions.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedSource = opt.dataset.source;
        });
    });

    // Submit Form
    expenseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const desc = document.getElementById('expense-desc').value;
        const amount = parseFloat(document.getElementById('expense-amount').value);
        
        if (!desc || isNaN(amount)) return;

        addExpense(desc, amount, selectedCategory, selectedSource);
        
        modalOverlay.classList.remove('active');
        expenseForm.reset();
        
        // Reset category to food
        catOptions.forEach(o => o.classList.remove('selected'));
        document.querySelector('[data-cat="food"]').classList.add('selected');
        selectedCategory = 'food';

        // Reset source to boda
        sourceOptions.forEach(o => o.classList.remove('selected'));
        document.querySelector('[data-source="boda"]').classList.add('selected');
        selectedSource = 'boda';
    });

    // Close Safari Hint
    const safariHint = document.getElementById('safari-hint');
    const closeHintBtn = document.getElementById('close-hint');
    if (closeHintBtn) {
        closeHintBtn.addEventListener('click', () => {
            safariHint.classList.add('hidden');
            localStorage.setItem('safari-hint-dismissed', 'true');
        });
    }
}

function addExpense(description, amount, category, source) {
    const newExpense = {
        id: Date.now().toString(),
        description,
        amount,
        category,
        source,
        date: new Date().toISOString()
    };
    
    expenses.push(newExpense);
    saveExpenses();
    updateDashboard();
    renderExpenses();
}

// Simulate AI Scanner
function simulateScanner() {
    // Hide modal temporarily
    modalOverlay.classList.remove('active');
    
    // Show scanner
    scannerOverlay.classList.remove('hidden');
    
    setTimeout(() => {
        // Hide scanner
        scannerOverlay.classList.add('hidden');
        
        // Open modal with form pre-filled
        modalOverlay.classList.add('active');
        document.querySelector('.action-buttons').classList.add('hidden');
        expenseForm.classList.remove('hidden');
        
        // Mock data
        const mockData = [
            { desc: 'Restaurante Teremok', amount: 1250.00, cat: 'food', source: 'boda' },
            { desc: 'Billete de Metro', amount: 65.00, cat: 'transport', source: 'polina' },
            { desc: 'Cafetería Pushkin', amount: 850.50, cat: 'food', source: 'xevi' },
            { desc: 'Matrioshka Souvenir', amount: 3500.00, cat: 'shopping', source: 'boda' }
        ];
        
        const randomItem = mockData[Math.floor(Math.random() * mockData.length)];
        
        document.getElementById('expense-desc').value = randomItem.desc;
        document.getElementById('expense-amount').value = randomItem.amount;
        
        // Select category
        catOptions.forEach(o => o.classList.remove('selected'));
        document.querySelector(`[data-cat="${randomItem.cat}"]`).classList.add('selected');
        selectedCategory = randomItem.cat;

        // Select source
        sourceOptions.forEach(o => o.classList.remove('selected'));
        document.querySelector(`[data-source="${randomItem.source}"]`).classList.add('selected');
        selectedSource = randomItem.source;
        
    }, 2500);
}

// Start App
init();
