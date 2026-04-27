// Exchange Rate: 1 EUR = X RUB
const EXCHANGE_RATE = 90.00; // Fixed rate as requested

// State
let expenses = [];
let selectedCategory = 'food';
let selectedSource = 'boda';

// Sync State
let syncRoomId = localStorage.getItem('viaje-rusia-room-id') || null;
let supabaseClient = null;
const SUPABASE_URL = localStorage.getItem('viaje-rusia-supabase-url');
const SUPABASE_KEY = localStorage.getItem('viaje-rusia-supabase-key');

// GitHub State
let ghToken = localStorage.getItem('viaje-rusia-gh-token');
let ghRepo = localStorage.getItem('viaje-rusia-gh-repo');
let ghFileSha = null;

// DOM Elements
const syncButton = document.getElementById('sync-button');
const syncModal = document.getElementById('sync-modal');
const closeSyncModal = document.getElementById('close-sync-modal');
const btnCreateRoom = document.getElementById('btn-create-room');
const btnJoinRoom = document.getElementById('btn-join-room');
const btnLeaveRoom = document.getElementById('btn-leave-room');
const joinCodeInput = document.getElementById('join-code');
const displayRoomCode = document.getElementById('display-room-code');
const syncStatus = document.getElementById('sync-status');
const syncSetup = document.getElementById('sync-setup');
const syncInfo = document.getElementById('sync-info');
const btnCopyCode = document.getElementById('btn-copy-code');
const qrcodeEl = document.getElementById('qrcode');

const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const ghTokenInput = document.getElementById('gh-token');
const ghRepoInput = document.getElementById('gh-repo');
const btnSaveGithub = document.getElementById('btn-save-github');

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
    setupSyncListeners();
    registerServiceWorker();
    checkStandalone();
    
    if (syncRoomId && SUPABASE_URL && SUPABASE_KEY) {
        initSupabase();
    }
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
    if (syncRoomId && supabaseClient) {
        pushToCloud();
    }
    if (ghToken && ghRepo) {
        pushToGitHub();
    }
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

    // Sync Button
    syncButton.addEventListener('click', () => {
        syncModal.classList.add('active');
        updateSyncUI();
    });

    closeSyncModal.addEventListener('click', () => {
        syncModal.classList.remove('active');
    });

    // Tab Switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.add('hidden'));
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
        });
    });

    // GitHub Save
    btnSaveGithub.addEventListener('click', () => {
        ghToken = ghTokenInput.value.trim();
        ghRepo = ghRepoInput.value.trim();
        if (ghToken && ghRepo) {
            localStorage.setItem('viaje-rusia-gh-token', ghToken);
            localStorage.setItem('viaje-rusia-gh-repo', ghRepo);
            alert("¡GitHub conectado! Los datos se sincronizarán con tu repositorio.");
            pushToGitHub();
        }
    });

    if (ghToken) ghTokenInput.value = ghToken;
    if (ghRepo) ghRepoInput.value = ghRepo;
}

// Sync Functions
function setupSyncListeners() {
    btnCreateRoom.addEventListener('click', createRoom);
    btnJoinRoom.addEventListener('click', () => joinRoom(joinCodeInput.value.trim().toUpperCase()));
    btnLeaveRoom.addEventListener('click', leaveRoom);
    btnCopyCode.addEventListener('click', () => {
        navigator.clipboard.writeText(syncRoomId);
        btnCopyCode.innerHTML = '<i class="fa-solid fa-check"></i>';
        setTimeout(() => btnCopyCode.innerHTML = '<i class="fa-solid fa-copy"></i>', 2000);
    });
}

function initSupabase() {
    if (!SUPABASE_URL || !SUPABASE_KEY) return;
    
    try {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        startRealtimeSync();
        updateSyncUI();
    } catch (e) {
        console.error("Error al conectar con Supabase:", e);
    }
}

async function createRoom() {
    // For a real app, you'd prompt for Supabase credentials if not set
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        promptForCredentials();
        return;
    }

    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    syncRoomId = roomId;
    localStorage.setItem('viaje-rusia-room-id', roomId);
    
    initSupabase();
    await pushToCloud();
    updateSyncUI();
}

async function joinRoom(code) {
    if (!code) return;
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        promptForCredentials();
        return;
    }

    syncRoomId = code;
    localStorage.setItem('viaje-rusia-room-id', code);
    
    initSupabase();
    await pullFromCloud();
    updateSyncUI();
}

function leaveRoom() {
    if (confirm("¿Estás seguro de que quieres dejar la sala? Los datos se mantendrán solo en tu dispositivo.")) {
        syncRoomId = null;
        localStorage.removeItem('viaje-rusia-room-id');
        updateSyncUI();
    }
}

function promptForCredentials() {
    const url = prompt("Introduce tu Supabase URL:");
    const key = prompt("Introduce tu Supabase Anon Key:");
    if (url && key) {
        localStorage.setItem('viaje-rusia-supabase-url', url);
        localStorage.setItem('viaje-rusia-supabase-key', key);
        location.reload();
    }
}

function updateSyncUI() {
    if (syncRoomId) {
        syncSetup.classList.add('hidden');
        syncInfo.classList.remove('hidden');
        displayRoomCode.textContent = syncRoomId;
        syncStatus.className = 'sync-status connected';
        syncStatus.querySelector('span').textContent = 'Sincronizado';
        syncButton.classList.add('active');
        
        // Update QR
        qrcodeEl.innerHTML = '';
        new QRCode(qrcodeEl, {
            text: syncRoomId,
            width: 128,
            height: 128,
            colorDark : "#0284c7",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });
    } else {
        syncSetup.classList.remove('hidden');
        syncInfo.classList.add('hidden');
        syncStatus.className = 'sync-status disconnected';
        syncStatus.querySelector('span').textContent = 'Sin sincronizar';
        syncButton.classList.remove('active');
    }
}

async function pushToCloud() {
    if (!supabaseClient || !syncRoomId) return;
    
    const { error } = await supabaseClient
        .from('budget_rooms')
        .upsert({ id: syncRoomId, expenses: expenses, updated_at: new Date().toISOString() });
        
    if (error) console.error("Error al subir a la nube:", error);
}

async function pullFromCloud() {
    if (!supabaseClient || !syncRoomId) return;
    
    const { data, error } = await supabaseClient
        .from('budget_rooms')
        .select('expenses')
        .eq('id', syncRoomId)
        .single();
        
    if (error) {
        console.error("Error al bajar de la nube:", error);
    } else if (data) {
        expenses = data.expenses;
        saveExpenses();
        updateDashboard();
        renderExpenses();
    }
}

function startRealtimeSync() {
    if (!supabaseClient || !syncRoomId) return;
    
    supabaseClient
        .channel('schema-db-changes')
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'budget_rooms', 
            filter: `id=eq.${syncRoomId}` 
        }, payload => {
            if (payload.new && payload.new.expenses) {
                // Merging logic could be complex, for now we just take the latest
                expenses = payload.new.expenses;
                updateDashboard();
                renderExpenses();
            }
        })
        .subscribe();
}

async function pushToGitHub() {
    if (!ghToken || !ghRepo) return;
    
    const url = `https://api.github.com/repos/${ghRepo}/contents/expenses.json`;
    const content = btoa(JSON.stringify(expenses, null, 2));
    
    try {
        // First get the SHA if file exists
        const getRes = await fetch(url, {
            headers: { 'Authorization': `token ${ghToken}` }
        });
        
        let sha = null;
        if (getRes.status === 200) {
            const data = await getRes.json();
            sha = data.sha;
        }
        
        const res = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${ghToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Update budget expenses',
                content: content,
                sha: sha
            })
        });
        
        if (res.ok) console.log("Sincronizado con GitHub ✅");
        else console.error("Error al sincronizar con GitHub", await res.json());
    } catch (e) {
        console.error("Error GitHub API:", e);
    }
}

async function pullFromGitHub() {
    if (!ghToken || !ghRepo) return;
    const url = `https://api.github.com/repos/${ghRepo}/contents/expenses.json`;
    
    try {
        const res = await fetch(url, {
            headers: { 'Authorization': `token ${ghToken}` }
        });
        if (res.ok) {
            const data = await res.json();
            expenses = JSON.parse(atob(data.content));
            saveExpenses();
            updateDashboard();
            renderExpenses();
        }
    } catch (e) {
        console.error("Error al bajar de GitHub:", e);
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
