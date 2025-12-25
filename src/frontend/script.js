// DOM elements
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const loadingIndicator = document.getElementById('loadingIndicator');
const errorMessage = document.getElementById('errorMessage');
const resultsSection = document.getElementById('resultsSection');
const resultsTableBody = document.getElementById('resultsTableBody');
const dashboardSection = document.getElementById('dashboardSection');
const homePage = document.getElementById('homePage');
const historyButton = document.getElementById('historyButton');
const historyModal = document.getElementById('historyModal');
const closeHistoryModal = document.getElementById('closeHistoryModal');
const historyList = document.getElementById('historyList');


// Metric card elements
const dashboardTitle = document.getElementById("dashboardTitle")
const metricTotalListings = document.getElementById('metricTotalListings');
const metricAvgPrice = document.getElementById('metricAvgPrice');
const metricMedianPrice = document.getElementById('metricMedianPrice');
const metricMinPrice = document.getElementById('metricMinPrice');
const metricMaxPrice = document.getElementById('metricMaxPrice');

// Handle search button click
searchButton.addEventListener('click', handleSearch);

// Handle Enter key in search input
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSearch();
    }
});

// Handle history button click
historyButton.addEventListener('click', showHistoryModal);

// Handle close history modal
closeHistoryModal.addEventListener('click', hideHistoryModal);

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === historyModal) {
        hideHistoryModal();
    }
});

// Download button handler
const downloadButton = document.getElementById('downloadButton');
if (downloadButton) {
    downloadButton.addEventListener('click', () => {
        // Placeholder for download functionality
        console.log('Download all data clicked');
    });
}

// Main search handler
async function handleSearch() {
    const query = searchInput.value.trim();
    
    // empty search query
    if (!query) {
        showError('Please enter a product name to search.');
        return;
    }

    // Hide previous results and errors
    hideError();
    hideResults();
    hideDashboard();
    hideHomePage();
    
    // Show loading state
    showLoading();
    searchButton.disabled = true;

    try {
        // TODO: Replace with actual API endpoint when backend is ready
        // For now, this is a placeholder that simulates the API call
        const response = await fetch('http://localhost:6767/api/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query: query
            })
        });

        if (!response.ok) {
            throw new Error(`Search failed: ${response.statusText}`);
        }

        const data = await response.json();
        displayResults(data, query);

    } catch (error) {
        // For now, show mock data since backend isn't connected
        // Remove this when backend is ready
        console.log('Backend not connected yet, showing mock data');
        showMockResults(query);
        
        // Uncomment this when backend is ready:
        // showError(`Error: ${error.message}`);
    } finally {
        hideLoading();
        searchButton.disabled = false;
    }
}

// Display search results
function displayResults(data, query) {
    // Expected data structure:
    // {
    //   itemSummaries: [
    //     {
    //       title: "Product Title",
    //       price: "99.99",
    //       currency: "USD",
    //       condition: "NEW",
    //       itemWebUrl: "https://...",
    //       seller: "sellerName",
    //       sellerFeedback: "98.5",
    //       mainCategory: "Electronics"
    //     }
    //   ]
    // }
    
    const items = data.itemSummaries || [];
    
    if (items.length === 0) {
        showError('No results found. Try a different search term.');
        return;
    }

    dashboardTitle.innerHTML = `Overview: <span style="color: #0064D2;">${query}</span>`;

    // Save to search history
    saveToHistory(query);

    // Populate dashboard
    populateDashboard(items, query);

    // Clear previous results
    resultsTableBody.innerHTML = '';

    // Populate table with results (existing logic)
    items.forEach((item, index) => {
        const row = document.createElement('tr');
        
        // item number (row num)
        const numberCell = document.createElement('td');
        numberCell.textContent = index + 1;
        
        // item title
        const titleCell = document.createElement('td');
        titleCell.textContent = item.title || 'N/A';
        
        // item price and currency
        const priceCell = document.createElement('td');
        // Handle both object and direct value formats
        let priceValue = 'N/A';
        let priceCurrency = 'USD';
        if (item.price) {
            if (typeof item.price === 'object' && item.price.value) {
                priceValue = item.price.value;
                priceCurrency = item.price.currency || 'USD';
            } else {
                priceValue = item.price;
                priceCurrency = item.currency || 'USD';
            }
        }
        priceCell.textContent = priceValue !== 'N/A' ? `${priceCurrency} ${priceValue}` : 'N/A';
        
        // item condition
        const conditionCell = document.createElement('td');
        conditionCell.textContent = item.condition || 'N/A';
        
        // url cell
        const linkCell = document.createElement('td');
        const itemUrl = item.itemWebUrl || item['item link'];
        if (itemUrl) {
            const link = document.createElement('a');
            link.href = itemUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = 'View on eBay';
            linkCell.appendChild(link);
        } else {
            linkCell.textContent = 'N/A';
        }

        // item seller
        const sellerCell = document.createElement('td');
        const sellerName = item.seller?.username || 'N/A';
        const sellerFeedback = item.seller?.feedbackPercentage || item['seller feedback'] || 'N/A';
        sellerCell.textContent = sellerName !== 'N/A' ? `${sellerName} (${sellerFeedback}%)` : 'N/A';

        // item category
        const categoryCell = document.createElement('td');
        const category = item.mainCategory || item['main category'] || 'N/A';
        categoryCell.textContent = category;

        row.appendChild(numberCell);
        row.appendChild(titleCell);
        row.appendChild(priceCell);
        row.appendChild(conditionCell);
        row.appendChild(linkCell);
        row.appendChild(sellerCell);
        row.appendChild(categoryCell);
        resultsTableBody.appendChild(row);
    });

    showDashboard();
    showResults();
}

// Populate dashboard with metrics and data
function populateDashboard(items) {
    // Extract and parse prices
    const prices = items
        .map(item => {
            let priceValue = item.price;
            // Handle both object and direct value formats
            if (typeof priceValue === 'object' && priceValue.value) {
                priceValue = priceValue.value;
            }
            const price = parseFloat(priceValue);
            return isNaN(price) ? null : price;
        })
        .filter(price => price !== null);
    
    // Populate metric cards
    if (metricTotalListings) {
        metricTotalListings.textContent = items.length;
    }
    
    if (prices.length > 0) {
        // Average price
        const avgPrice = (prices.reduce((sum, p) => sum + p, 0) / prices.length).toFixed(2);
        if (metricAvgPrice) {
            metricAvgPrice.textContent = `$${avgPrice}`;
        }
        
        // Median price
        const sortedPrices = [...prices].sort((a, b) => a - b);
        const medianIndex = Math.floor(sortedPrices.length / 2);
        const medianPrice = sortedPrices.length % 2 === 0
            ? ((sortedPrices[medianIndex - 1] + sortedPrices[medianIndex]) / 2).toFixed(2)
            : sortedPrices[medianIndex].toFixed(2);
        if (metricMedianPrice) {
            metricMedianPrice.textContent = `$${medianPrice}`;
        }
        
        // Min price
        const minPrice = Math.min(...prices).toFixed(2);
        if (metricMinPrice) {
            metricMinPrice.textContent = `$${minPrice}`;
        }
        
        // Max price
        const maxPrice = Math.max(...prices).toFixed(2);
        if (metricMaxPrice) {
            metricMaxPrice.textContent = `$${maxPrice}`;
        }
    } else {
        if (metricAvgPrice) metricAvgPrice.textContent = 'N/A';
        if (metricMedianPrice) metricMedianPrice.textContent = 'N/A';
        if (metricMinPrice) metricMinPrice.textContent = 'N/A';
        if (metricMaxPrice) metricMaxPrice.textContent = 'N/A';
    }
}

// Show mock results for testing (remove when backend is connected)
function showMockResults(query) {
    const mockData = {
        itemSummaries: [
            {
                title: "Sample Product 1 - Brand New Item",
                price: { value: "29.99", currency: "USD" },
                condition: "NEW",
                itemWebUrl: "https://www.ebay.com"
            },
            {
                title: "Sample Product 2 - Used Condition",
                price: { value: "19.99", currency: "USD" },
                condition: "USED",
                itemWebUrl: "https://www.ebay.com"
            },
            {
                title: "Sample Product 3 - Excellent Condition",
                price: { value: "49.99", currency: "USD" },
                condition: "EXCELLENT",
                itemWebUrl: "https://www.ebay.com"
            }
        ]
    };
    
    displayResults(mockData, query || 'Mock Search');
}

// UI helper functions
function showLoading() {
    loadingIndicator.style.display = 'block';
}

function hideLoading() {
    loadingIndicator.style.display = 'none';
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
}

function hideError() {
    errorMessage.style.display = 'none';
}

function showResults() {
    resultsSection.style.display = 'block';
}

function hideResults() {
    resultsSection.style.display = 'none';
}

function showDashboard() {
    dashboardSection.style.display = 'block';
}

function hideDashboard() {
    dashboardSection.style.display = 'none';
}

function showHomePage() {
    if (homePage) {
        homePage.style.display = 'flex';
    }
}

function hideHomePage() {
    if (homePage) {
        homePage.style.display = 'none';
    }
}

// Search History Functions
function saveToHistory(query) {
    // Safety check: don't save undefined/null queries
    if (!query || typeof query !== 'string' || query.trim() === '') {
        return;
    }
    
    const history = getHistory();
    const timestamp = new Date().toISOString();
    
    // Remove duplicate if exists
    const filteredHistory = history.filter(item => item.query.toLowerCase() !== query.toLowerCase());
    
    // Add new entry at the beginning
    filteredHistory.unshift({ query, timestamp });
    
    // Keep only last 20 searches
    const limitedHistory = filteredHistory.slice(0, 20);
    
    localStorage.setItem('ebaySearchHistory', JSON.stringify(limitedHistory));
}

function getHistory() {
    const historyJson = localStorage.getItem('ebaySearchHistory');
    return historyJson ? JSON.parse(historyJson) : [];
}

function showHistoryModal() {
    const history = getHistory();
    historyList.innerHTML = '';
    
    if (history.length === 0) {
        historyList.innerHTML = '<p class="no-history">No search history yet.</p>';
    } else {
        history.forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.addEventListener('click', () => {
                searchInput.value = item.query;
                hideHistoryModal();
                handleSearch();
            });
            
            const queryText = document.createElement('div');
            queryText.className = 'history-item-text';
            queryText.textContent = item.query;
            
            const dateText = document.createElement('div');
            dateText.className = 'history-item-date';
            const date = new Date(item.timestamp);
            dateText.textContent = date.toLocaleString();
            
            historyItem.appendChild(queryText);
            historyItem.appendChild(dateText);
            historyList.appendChild(historyItem);
        });
    }
    
    historyModal.style.display = 'block';
}

function hideHistoryModal() {
    historyModal.style.display = 'none';
}

