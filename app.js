// Supabase Config
const SUPABASE_URL = "https://wzqyemxubilzmibifzav.supabase.co";
const SUPABASE_KEY = "sb_publishable_9zrAz8Yu85zKhPr01Pjwhw_E3iJGt0a";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Exchange Rate: 1 EUR = X RUB
const EXCHANGE_RATE = 90.00;

// State
let expenses = [];
let selectedCategory = 'food';
let selectedSource = 'boda';
let supabaseChannel = null;

// Room State
const DEFAULT_ROOM = 'viaje-rusia-polina-xevi-2026';
let syncRoomId = localStorage.getItem('viaje-rusia-room-id') || DEFAULT_ROOM;

// GitHub State
let ghToken = localStorage.getItem('viaje-rusia-gh-token');
let ghRepo = localStorage.getItem('viaje-rusia-gh-repo');

// DOM Elements
const syncButton = document.getElementById('sync-button');
const syncModal = document.getElementById('sync-modal');
const closeSyncModal = document.getElementById('close-sync-modal');
const btnJoinRoom = document.getElementById('btn-join-room');
const joinCodeInput = document.getElementById('join-code');
const displayRoomCode = document.getElementById('display-room-code');
const btnCopyCode = document.getElementById('btn-copy-code');
const connectionDot = document.getElementById('connection-dot');

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
    initSupabaseSync();
}

// Service Worker Registration
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(() => console.log('Service Worker registrado'))
                .catch(err => console.log('Error registering SW', err));
        });
    }
}

// Standalone Mode Detection
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
    try {
        const saved = localStorage.getItem('viaje-rusia-expenses');
        if (saved) expenses = JSON.parse(saved);
    } catch {
        expenses = [];
        localStorage.removeItem('viaje-rusia-expenses');
    }
}

// Save to LocalStorage + Supabase
async function saveExpenses() {
    const now = Date.now();
    localStorage.setItem('viaje-rusia-expenses', JSON.stringify(expenses));
    localStorage.setItem('viaje-rusia-last-update', now.toString());

    const { error } = await supabase.from('budget_rooms').upsert({
        id: syncRoomId,
        expenses: expenses,
        updated_at: new Date(now).toISOString()
    });

    if (error) console.error('Error sincronizando con Supabase:', error);

    if (ghToken && ghRepo) {
        pushToGitHub();
    }
}

// Supabase Realtime Sync
function initSupabaseSync() {
    loadFromSupabase();
    subscribeToRoom(syncRoomId);
}

async function loadFromSupabase() {
    const { data, error } = await supabase
        .from('budget_rooms')
        .select('*')
        .eq('id', syncRoomId)
        .single();

    if (error || !data) return;

    applyRemoteData(data.expenses, new Date(data.updated_at).getTime());
}

function subscribeToRoom(roomId) {
    if (supabaseChannel) {
        supabase.removeChannel(supabaseChannel);
    }

    supabaseChannel = supabase
        .channel(`room-${roomId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'budget_rooms',
            filter: `id=eq.${roomId}`
        }, (payload) => {
            if (payload.new && payload.new.expenses) {
                applyRemoteData(
                    payload.new.expenses,
                    new Date(payload.new.updated_at).getTime()
                );
            }
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                connectionDot.classList.add('online');
            } else {
                connectionDot.classList.remove('online');
            }
        });
}

function applyRemoteData(remoteExpenses, remoteUpdate) {
    const lastLocalUpdate = parseInt(localStorage.getItem('viaje-rusia-last-update') || '0');
    if (remoteUpdate <= lastLocalUpdate) return;

    const localIds = new Set(expenses.map(e => e.id));
    let merged = [...expenses];

    remoteExpenses.forEach(re => {
        if (!localIds.has(re.id)) merged.push(re);
    });

    // Remote deletion: if remote is newer and has fewer items, trust remote
    if (remoteExpenses.length < merged.length) {
        expenses = remoteExpenses;
    } else {
        expenses = merged;
    }

    expenses.sort((a, b) => new Date(a.date) - new Date(b.date));
    localStorage.setItem('viaje-rusia-last-update', remoteUpdate.toString());
    localStorage.setItem('viaje-rusia-expenses', JSON.stringify(expenses));
    updateDashboard();
    renderExpenses();
    console.log('Sincronización Supabase completada');
}

// Update Dashboard Totals
function updateDashboard() {
    const totalRub = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    const totalEur = totalRub / EXCHANGE_RATE;

    const totalBoda = expenses.filter(exp => exp.source === 'boda').reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    const totalPolina = expenses.filter(exp => exp.source === 'polina').reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    const totalXevi = expenses.filter(exp => exp.source === 'xevi').reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

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
            <div class="expense-right">
                <div class="expense-amounts">
                    <div class="expense-rub">${formatCurrency(exp.amount, '₽')}</div>
                    <div class="expense-eur">${formatCurrency(eurAmount, '€')}</div>
                </div>
                <button class="delete-btn" onclick="removeExpense('${exp.id}')">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
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
    fabButton.addEventListener('click', () => {
        modalOverlay.classList.add('active');
        expenseForm.classList.add('hidden');
        document.querySelector('.action-buttons').classList.remove('hidden');
    });

    closeModal.addEventListener('click', () => {
        modalOverlay.classList.remove('active');
        expenseForm.reset();
    });

    btnManual.addEventListener('click', () => {
        document.querySelector('.action-buttons').classList.add('hidden');
        expenseForm.classList.remove('hidden');
        document.getElementById('expense-desc').focus();
    });

    cameraInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            processReceiptImage(e.target.files[0]);
            e.target.value = '';
        }
    });

    catOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            catOptions.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedCategory = opt.dataset.cat;
        });
    });

    sourceOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            sourceOptions.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedSource = opt.dataset.source;
        });
    });

    expenseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const desc = document.getElementById('expense-desc').value;
        const amount = parseFloat(document.getElementById('expense-amount').value);
        if (!desc || isNaN(amount)) return;

        addExpense(desc, amount, selectedCategory, selectedSource);
        modalOverlay.classList.remove('active');
        expenseForm.reset();

        catOptions.forEach(o => o.classList.remove('selected'));
        document.querySelector('[data-cat="food"]').classList.add('selected');
        selectedCategory = 'food';

        sourceOptions.forEach(o => o.classList.remove('selected'));
        document.querySelector('[data-source="boda"]').classList.add('selected');
        selectedSource = 'boda';
    });

    const safariHint = document.getElementById('safari-hint');
    const closeHintBtn = document.getElementById('close-hint');
    if (closeHintBtn) {
        closeHintBtn.addEventListener('click', () => {
            safariHint.classList.add('hidden');
            localStorage.setItem('safari-hint-dismissed', 'true');
        });
    }

    syncButton.addEventListener('click', () => {
        syncModal.classList.add('active');
        updateSyncUI();
    });

    closeSyncModal.addEventListener('click', () => {
        syncModal.classList.remove('active');
    });

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.add('hidden'));
            btn.classList.add('active');
            document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
        });
    });

    btnSaveGithub.addEventListener('click', () => {
        ghToken = ghTokenInput.value.trim();
        ghRepo = ghRepoInput.value.trim();
        if (ghToken && ghRepo) {
            localStorage.setItem('viaje-rusia-gh-token', ghToken);
            localStorage.setItem('viaje-rusia-gh-repo', ghRepo);
            alert('¡GitHub conectado! Los datos se sincronizarán con tu repositorio.');
            pushToGitHub();
        }
    });

    if (ghToken) ghTokenInput.value = ghToken;
    if (ghRepo) ghRepoInput.value = ghRepo;

    // Export / Import
    document.getElementById('btn-export').addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(expenses, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'gastos-rusia.json';
        a.click();
        URL.revokeObjectURL(url);
    });

    document.getElementById('import-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const imported = JSON.parse(ev.target.result);
                if (Array.isArray(imported)) {
                    expenses = imported;
                    saveExpenses();
                    updateDashboard();
                    renderExpenses();
                    alert('Importación completada.');
                }
            } catch {
                alert('Archivo no válido.');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });
}

// Sync Functions
function setupSyncListeners() {
    btnJoinRoom.addEventListener('click', () => joinRoom(joinCodeInput.value.trim().toUpperCase()));
    btnCopyCode.addEventListener('click', () => {
        navigator.clipboard.writeText(syncRoomId);
        btnCopyCode.innerHTML = '<i class="fa-solid fa-check"></i>';
        setTimeout(() => btnCopyCode.innerHTML = '<i class="fa-solid fa-copy"></i>', 2000);
    });
}

async function joinRoom(code) {
    if (!code) return;
    syncRoomId = code;
    localStorage.setItem('viaje-rusia-room-id', code);
    subscribeToRoom(code);
    await loadFromSupabase();
    updateSyncUI();
    syncModal.classList.remove('active');
}

function updateSyncUI() {
    displayRoomCode.textContent = syncRoomId;
}

// Add / Remove Expenses
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

function removeExpense(id) {
    if (confirm('¿Seguro que quieres borrar este gasto?')) {
        expenses = expenses.filter(exp => exp.id !== id);
        saveExpenses();
        updateDashboard();
        renderExpenses();
    }
}

// OCR Receipt Scanner
async function processReceiptImage(file) {
    modalOverlay.classList.remove('active');
    scannerOverlay.classList.remove('hidden');
    setScanText('Cargando motor OCR...');

    try {
        const worker = await Tesseract.createWorker('rus+eng', 1, {
            logger: m => {
                if (m.status === 'recognizing text') {
                    setScanText(`Leyendo texto... ${Math.round(m.progress * 100)}%`);
                } else if (m.status === 'loading language traineddata') {
                    setScanText('Cargando idioma ruso...');
                }
            }
        });

        setScanText('Analizando ticket... ✨');
        const { data: { text } } = await worker.recognize(file);
        await worker.terminate();

        const { description, amount } = parseReceipt(text);

        scannerOverlay.classList.add('hidden');
        modalOverlay.classList.add('active');
        document.querySelector('.action-buttons').classList.add('hidden');
        expenseForm.classList.remove('hidden');

        if (description) document.getElementById('expense-desc').value = description;
        if (amount) document.getElementById('expense-amount').value = amount;

    } catch (err) {
        console.error('Error OCR:', err);
        scannerOverlay.classList.add('hidden');
        modalOverlay.classList.add('active');
        document.querySelector('.action-buttons').classList.add('hidden');
        expenseForm.classList.remove('hidden');
        setScanText('Analizando ticket... ✨');
    }
}

function setScanText(text) {
    const el = document.querySelector('.scan-text');
    if (el) el.textContent = text;
}

function parseReceipt(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 1);

    let amount = null;

    // Search for total with Russian/English keywords
    const totalRegex = /(?:итого|сумма|к\s*оплате|total|sum)[^\d]*(\d[\d\s]*[,\.]\d{2})/gi;
    const match = totalRegex.exec(text);
    if (match) {
        amount = parseFloat(match[1].replace(/\s/g, '').replace(',', '.'));
    }

    // Fallback: take the largest price-like number in the text
    if (!amount) {
        const prices = [];
        const priceRegex = /(\d{1,6}[,\.]\d{2})/g;
        let m;
        while ((m = priceRegex.exec(text)) !== null) {
            prices.push(parseFloat(m[1].replace(',', '.')));
        }
        if (prices.length > 0) amount = Math.max(...prices);
    }

    // Description: first meaningful non-numeric line
    let description = '';
    for (const line of lines) {
        if (line.length >= 3 && !/^[\d\s,\.\-:]+$/.test(line)) {
            description = line.substring(0, 50);
            break;
        }
    }
    if (!description) description = 'Gasto de recibo';

    return { description, amount };
}

// GitHub Backup
async function pushToGitHub() {
    if (!ghToken || !ghRepo) return;
    const url = `https://api.github.com/repos/${ghRepo}/contents/expenses.json`;
    const content = btoa(JSON.stringify(expenses, null, 2));

    try {
        const getRes = await fetch(url, { headers: { 'Authorization': `token ${ghToken}` } });
        let sha = null;
        if (getRes.status === 200) {
            const data = await getRes.json();
            sha = data.sha;
        }
        const res = await fetch(url, {
            method: 'PUT',
            headers: { 'Authorization': `token ${ghToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Update budget expenses', content, sha })
        });
        if (res.ok) console.log('Sincronizado con GitHub');
        else console.error('Error GitHub', await res.json());
    } catch (e) {
        console.error('Error GitHub API:', e);
    }
}

// Start App
init();
