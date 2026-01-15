/**
 * Global State Management
 */
const state = {
    query: '',
    items: [],
    minPrice: '',
    maxPrice: ''
};

const CONSTANTS = {
    HISTORY_KEY: 'ebaySearchHistory',
    MAX_HISTORY: 20
};

/**
 * DOM Elements
 */
const DOM = {
    inputs: {
        search: document.getElementById('searchInput'),
        minPrice: document.getElementById('minPriceInput'),
        maxPrice: document.getElementById('maxPriceInput'),
        searchBtn: document.getElementById('searchButton'),
        downloadBtn: document.getElementById('downloadButton'),
    },
    sections: {
        home: document.getElementById('homePage'),
        dashboard: document.getElementById('dashboardSection'),
        results: document.getElementById('resultsSection'),
        loading: document.getElementById('loadingIndicator'),
        error: document.getElementById('errorMessage'),
    },
    resultsTableBody: document.getElementById('resultsTableBody'),
    dashboardTitle: document.getElementById("dashboardTitle"),
    modals: {
        history: document.getElementById('historyModal'),
        closeHistory: document.getElementById('closeHistoryModal'),
        openHistory: document.getElementById('historyButton'),
        clearHistory: document.getElementById('clearHistoryBtn'),
        historyList: document.getElementById('historyList'),
    },
    metrics: {
        total: document.getElementById('metricTotalListings'),
        avg: document.getElementById('metricAvgPrice'),
        median: document.getElementById('metricMedianPrice'),
        min: document.getElementById('metricMinPrice'),
        max: document.getElementById('metricMaxPrice'),
    },
    charts: {
        listingsByPrice: document.getElementById("listing-by-price"),
        priceVsSeller: document.getElementById("price-vs-seller-score"),
        priceVsDate: document.getElementById("price-vs-date"),
        newVsUsed: document.getElementById("new-vs-used-chart"),
    },
    mobileMenu: document.getElementById('mobileMenuBtn'),
    headerCollapsible: document.getElementById('headerCollapsible')
};

/**
 * Initialization & Event Listeners
 */
document.addEventListener('DOMContentLoaded', () => {
    registerZoomPlugin();
    setupEventListeners();
});

function setupEventListeners() {
    // Search Actions
    DOM.inputs.searchBtn.addEventListener('click', handleSearch);
    DOM.inputs.search.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    // History Modal
    DOM.modals.openHistory.addEventListener('click', showHistoryModal);
    DOM.modals.closeHistory.addEventListener('click', () => toggleModal(DOM.modals.history, false));
    DOM.modals.clearHistory.addEventListener('click', clearHistory);
    window.addEventListener('click', (e) => {
        if (e.target === DOM.modals.history) toggleModal(DOM.modals.history, false);
    });

    // Mobile Menu
    if (DOM.mobileMenu && DOM.headerCollapsible) {
        DOM.mobileMenu.addEventListener('click', () => {
            DOM.headerCollapsible.classList.toggle('expanded');
        });
    }

    // Download CSV
    DOM.inputs.downloadBtn.addEventListener('click', handleDownloadCsv);
}

/**
 * Core Logic - Search
 */
async function handleSearch() {
    const query = DOM.inputs.search.value.trim();
    const minPrice = DOM.inputs.minPrice.value.trim() || '0';
    const maxPrice = DOM.inputs.maxPrice.value.trim();

    // Validation
    if (!query) return showError('Please enter a product name');
    if (query.length > 80) return showError('Please keep searches under 80 characters');
    if (maxPrice !== "" && Number(maxPrice) <= Number(minPrice)) {
        return showError('Please enter a valid price range.');
    }

    // Update State
    state.query = query;
    state.minPrice = minPrice;
    state.maxPrice = maxPrice;

    // Reset UI
    hideAllSections();
    showSection(DOM.sections.loading);
    DOM.inputs.searchBtn.disabled = true;

    try {
        const data = await searchAPI(query, minPrice, maxPrice);
        state.items = data.itemSummaries || [];

        if (state.items.length === 0) {
            showError('No results found. Try a different search term.');
            return;
        }

        renderDashboard();
        renderResultsTable();
        saveToHistory(query, minPrice, maxPrice);

    } catch (error) {
        showError(`Search failed. ${error.message}`);
    } finally {
        showSection(DOM.sections.loading, false);
        DOM.inputs.searchBtn.disabled = false;
    }
}

async function searchAPI(query, minPrice, maxPrice) {
    const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, minPrice, maxPrice })
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.details || response.statusText);
    }
    return response.json();
}

/**
 * Rendering Logic
 */
function renderResultsTable() {
    const rows = state.items.map((item, index) => {
        const price = formatPrice(item.price);
        const image = item.thumbnailImages?.[0]?.imageUrl || 'https://img.icons8.com/office40/512/cancel-2.png';
        const seller = item.seller ? `${item.seller.username} (${item.seller.feedbackPercentage}%)` : 'N/A';
        const link = item.itemWebUrl || item['item link'];
        const category = item.categories?.[0]?.categoryName || 'N/A';

        return `
            <tr>
                <td>${index + 1}</td>
                <td><img style="max-width: 60px; max-height: 40px" src="${image}" loading="lazy"></td>
                <td>${item.title || 'N/A'}</td>
                <td>${price}</td>
                <td>${item.condition || 'N/A'}</td>
                <td>
                    ${link ? `<a href="${link}" target="_blank" rel="noopener noreferrer">eBay Link</a>` : 'N/A'}
                </td>
                <td>${seller}</td>
                <td>${category}</td>
            </tr>
        `;
    }).join('');

    DOM.resultsTableBody.innerHTML = rows;
    showSection(DOM.sections.results);
}

function renderDashboard() {
    DOM.dashboardTitle.innerHTML = `Overview: <span style="color: #0064D2;">${capitalizeWords(state.query)}</span>`;

    // Calculate Metrics
    const prices = state.items
        .map(i => parseFloat(i.price?.value || i.price))
        .filter(p => !isNaN(p));

    if (prices.length > 0) {
        DOM.metrics.total.textContent = state.items.length;
        DOM.metrics.max.textContent = `$${Math.max(...prices).toFixed(2)}`;
        DOM.metrics.min.textContent = `$${Math.min(...prices).toFixed(2)}`;
        DOM.metrics.avg.textContent = `$${(prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)}`;

        const sorted = [...prices].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
        DOM.metrics.median.textContent = `$${median.toFixed(2)}`;
    } else {
        Object.values(DOM.metrics).forEach(el => el.textContent = 'N/A');
    }

    // Render Charts
    updateCharts();
    showSection(DOM.sections.dashboard);
}

/**
 * Chart Logic
 */
let charts = {}; // Store chart instances

function updateCharts() {
    const colors = { text: '#bcbcbc', grid: '#333333' }; // Dark mode constants

    // 1. Listings by Price (Scatter)
    const priceData = processScatterData(state.items, item => {
        const p = parseFloat(item.price?.value || item.price);
        return isNaN(p) ? null : { x: p, y: 0 };
    });
    renderScatterChart('listingsByPrice', DOM.charts.listingsByPrice, priceData, 'Price ($)', '', colors);

    // 2. Price vs Seller (Scatter)
    const sellerData = processScatterData(state.items, item => {
        const p = parseFloat(item.price?.value || item.price);
        const score = parseFloat(item.seller?.feedbackPercentage);
        return (isNaN(p) || isNaN(score)) ? null : { x: score, y: p };
    });
    renderScatterChart('priceVsSeller', DOM.charts.priceVsSeller, sellerData, 'Seller Score (%)', 'Price ($)', colors);

    // 3. Price vs Date (Time Scale)
    const dateData = processScatterData(state.items, item => {
        const p = parseFloat(item.price?.value || item.price);
        const date = item.itemCreationDate ? new Date(item.itemCreationDate) : null;
        return (isNaN(p) || !date) ? null : { x: date, y: p };
    });
    renderScatterChart('priceVsDate', DOM.charts.priceVsDate, dateData, 'Date Listed', 'Price ($)', colors, true);

    // 4. New vs Used (Donut)
    renderDonutChart(colors);
}

function processScatterData(items, mapFn) {
    const categories = { New: [], Used: [], Other: [] };

    items.forEach(item => {
        const point = mapFn(item);
        if (!point) return;

        const cond = (item.condition || '').toUpperCase();
        if (cond.includes('NEW')) categories.New.push(point);
        else if (cond.includes('USED') || cond.includes('PRE-OWNED')) categories.Used.push(point);
        else categories.Other.push(point);
    });
    return categories;
}

function renderScatterChart(id, canvas, data, xLabel, yLabel, colors, isTime = false) {
    if (!canvas) return;
    if (charts[id]) charts[id].destroy();

    const datasets = [
        { label: 'New', data: data.New, backgroundColor: 'rgba(39, 145, 0, 0.5)', borderColor: '#279100' },
        { label: 'Used', data: data.Used, backgroundColor: 'rgba(0, 100, 210, 0.5)', borderColor: '#0064D2' },
        { label: 'Other', data: data.Other, backgroundColor: 'rgba(153, 153, 153, 0.5)', borderColor: '#999' }
    ].map(d => ({ ...d, pointRadius: 5, pointBorderWidth: 1 }));

    const config = {
        type: 'scatter',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: isTime ? 'time' : 'linear',
                    title: { display: !!xLabel, text: xLabel, color: colors.text },
                    ticks: { color: colors.text },
                    grid: { color: colors.grid },
                    ...(isTime && { time: { unit: 'day' } })
                },
                y: {
                    title: { display: !!yLabel, text: yLabel, color: colors.text },
                    ticks: { color: colors.text },
                    grid: { color: colors.grid },
                    display: !!yLabel
                }
            },
            plugins: {
                legend: { labels: { color: colors.text } },
                zoom: {
                    limits: {
                        x: { min: 'original', max: 'original' },
                        y: { min: 'original', max: 'original' }
                    },
                    zoom: {
                        wheel: { enabled: true, speed: 0.02 },
                        pinch: { enabled: true, speed: 0.02 },
                        mode: 'xy'
                    },
                    pan: { enabled: true, mode: 'xy' }
                }
            }
        }
    };
    charts[id] = new Chart(canvas, config);
}

function renderDonutChart(colors) {
    const canvas = DOM.charts.newVsUsed;
    if (!canvas) return;
    if (charts.newVsUsed) charts.newVsUsed.destroy();

    let counts = { New: 0, Used: 0, Other: 0 };
    state.items.forEach(item => {
        const cond = (item.condition || '').toUpperCase();
        if (cond.includes('NEW')) counts.New++;
        else if (cond.includes('USED') || cond.includes('PRE-OWNED')) counts.Used++;
        else counts.Other++;
    });

    charts.newVsUsed = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels: ['New', 'Used', 'Other'],
            datasets: [{
                data: [counts.New, counts.Used, counts.Other],
                backgroundColor: ['#279100', '#0064D2', '#999999'],
                borderColor: ['#279100', '#0064D2', '#999999'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: colors.text } }
            }
        }
    });
}

function getThemeColors(isLight) {
    return {
        text: isLight ? '#333333' : '#bcbcbc',
        grid: isLight ? '#e5e5e5' : '#333333'
    };
}

/**
 * Helper Functions
 */
function showSection(section, show = true) {
    if (section) section.style.display = show ? 'block' : 'none';
}

function hideAllSections() {
    showSection(DOM.sections.home, false);
    showSection(DOM.sections.dashboard, false);
    showSection(DOM.sections.results, false);
    showSection(DOM.sections.error, false);
}

function showError(msg) {
    hideAllSections();
    if (DOM.sections.error) {
        DOM.sections.error.textContent = msg;
        showSection(DOM.sections.error);
    }
}

function capitalizeWords(str) {
    return str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatPrice(priceObj) {
    if (!priceObj) return 'N/A';
    const val = typeof priceObj === 'object' ? priceObj.value : priceObj;
    const cur = (typeof priceObj === 'object' ? priceObj.currency : 'USD') === 'USD' ? '$' : '';
    return `${cur}${val}`;
}

function handleDownloadCsv() {
    if (!state.items.length) return;

    const headers = ['#', 'Title', 'Price', 'Condition', 'Link', 'Seller', 'Category'];
    const rows = state.items.map((item, idx) => [
        idx + 1,
        item.title || 'N/A',
        item.price?.value || item.price || 'N/A',
        item.condition || 'N/A',
        item.itemWebUrl || item['item link'] || 'N/A',
        item.seller?.username ? `${item.seller.username} (${item.seller.feedbackPercentage}%)` : 'N/A',
        item.categories?.[0]?.categoryName || 'N/A'
    ]);

    const csvContent = [headers, ...rows]
        .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${state.query.replace(/[^a-z0-9]/gi, '_')}_results.csv`;
    link.click();
}

/**
 * History & Theme (Simplified)
 */
function getHistory() {
    return JSON.parse(localStorage.getItem(CONSTANTS.HISTORY_KEY) || '[]');
}

function saveToHistory(query, minPrice, maxPrice) {
    const history = getHistory().filter(h => h.query.toLowerCase() !== query.toLowerCase());
    history.unshift({ query, minPrice, maxPrice, timestamp: new Date().toISOString() });
    localStorage.setItem(CONSTANTS.HISTORY_KEY, JSON.stringify(history.slice(0, CONSTANTS.MAX_HISTORY)));
}

function showHistoryModal() {
    const history = getHistory();
    DOM.modals.historyList.innerHTML = history.length ? '' : '<p class="no-history">No search history yet.</p>';

    history.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div class="history-item-text">${item.query}</div>
            <div class="history-item-range">Min ${item.minPrice || 'Any'} · Max ${item.maxPrice || 'Any'}</div>
            <div class="history-item-date">${new Date(item.timestamp).toLocaleString()}</div>
        `;
        div.onclick = () => {
            DOM.inputs.search.value = item.query;
            DOM.inputs.minPrice.value = item.minPrice;
            DOM.inputs.maxPrice.value = item.maxPrice;
            toggleModal(DOM.modals.history, false);
            handleSearch();
        };
        DOM.modals.historyList.appendChild(div);
    });
    toggleModal(DOM.modals.history, true);
}

function clearHistory(e) {
    e.stopPropagation();
    localStorage.removeItem(CONSTANTS.HISTORY_KEY);
    DOM.modals.historyList.innerHTML = '<p class="no-history">No search history yet.</p>';
}

function toggleModal(modal, show) {
    modal.style.display = show ? 'block' : 'none';
}

// Chart Plugin Registration
function registerZoomPlugin() {
    if (window.Chart && window.Chart.register) {
        if (typeof window.zoomPlugin !== 'undefined') {
            window.Chart.register(window.zoomPlugin);
        } else if (typeof window.ChartZoom !== 'undefined') {
            window.Chart.register(window.ChartZoom);
        } else if (typeof window['chartjs-plugin-zoom'] !== 'undefined') {
            window.Chart.register(window['chartjs-plugin-zoom']);
        }
    }
}