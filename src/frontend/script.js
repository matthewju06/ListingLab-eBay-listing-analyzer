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
const dashboardTitle = document.getElementById("dashboardTitle")


// Metric card elements
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
// 1. Resets UI
// 2. tries a search with the query
// 3. if query doesnt exist, throw
// 4. if query valid but not in ebay system, throw
// 5.
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
        console.log('Backend not connected');
        return;
        
        // Uncomment this when backend is ready:
        // showError(`Error: ${error.message}`);
    } finally {
        hideLoading();
        searchButton.disabled = false;
    }
}

// Display search results
function displayResults(data, query) {
    const items = data.itemSummaries || [];
    
    if (items.length === 0) {
        showError('No results found. Try a different search term.');
        return;
    }

    dashboardTitle.innerHTML = `Overview: <span style="color: #0064D2;">${query}</span>`;

    // Save to search history
    saveToHistory(query);

    // Populate dashboard
    

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
        const category = item.categories?.[0]?.categoryName || 'N/A';
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
    populateDashboard(items, query);
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

       drawListingsByPrice(items);
       drawPriceVsSellerScore(items);
       drawPriceVsDateListed(items);
       drawNewVsUsed(items);
    } else {
        if (metricAvgPrice) metricAvgPrice.textContent = 'N/A';
        if (metricMedianPrice) metricMedianPrice.textContent = 'N/A';
        if (metricMinPrice) metricMinPrice.textContent = 'N/A';
        if (metricMaxPrice) metricMaxPrice.textContent = 'N/A';
    }
}

// Helper function to get condition category and color
function getConditionCategory(condition) {
    const cond = condition?.toUpperCase() || '';
    if (cond.includes('NEW')) {
        return { category: 'New', color: '#279100' };
    } else if (cond.includes('USED') || cond.includes('PRE-OWNED')) {
        return { category: 'Used', color: '#0064D2' };
    } else {
        return { category: 'Other', color: '#999999' };
    }
}

function drawListingsByPrice(items){
    const canvas = document.getElementById("listing-by-price");
    if (!canvas) {
        console.error('Canvas listing-by-price not found');
        return;
    }

    const isDarkMode = document.body.classList.contains('dark-mode');
    const textColor = isDarkMode ? '#e5e5e5' : '#333';

    // Separate data by condition
    const newData = [];
    const usedData = [];
    const otherData = [];

    for (const item of items){
        let priceVal = item.price;
        if (typeof priceVal === "object" && priceVal?.value != null) priceVal = priceVal.value;
        const price = parseFloat(priceVal);

        if (!Number.isFinite(price)) continue;

        const conditionInfo = getConditionCategory(item.condition);
        const point = { x: price, y: 0 };
        
        if (conditionInfo.category === 'New') {
            newData.push(point);
        } else if (conditionInfo.category === 'Used') {
            usedData.push(point);
        } else {
            otherData.push(point);
        }
    }

    if (newData.length === 0 && usedData.length === 0 && otherData.length === 0) {
        console.error("No valid points to plot.");
        return;
    }
    
    const data = {
        datasets: [
            {
                label: "New",
                data: newData,
                pointRadius: 5,
                pointBackgroundColor: 'rgba(123, 191, 98, 0.5)', // Lighter green with transparency
                pointBorderColor: 'rgba(39, 145, 0, 0.75)', // Darker green border with transparency
                pointBorderWidth: 2,
            },
            {
                label: "Used",
                data: usedData,
                pointRadius: 5,
                pointBackgroundColor: 'rgba(96, 165, 250, 0.5)', // Lighter blue with transparency
                pointBorderColor: 'rgba(0, 100, 210, 0.75)', // Darker blue border with transparency
                pointBorderWidth: 2,
            },
            {
                label: "Other",
                data: otherData,
                pointRadius: 5,
                pointBackgroundColor: 'rgba(209, 213, 219, 0.5)', // Lighter grey with transparency
                pointBorderColor: 'rgba(153, 153, 153, 0.75)', // Darker grey border with transparency
                pointBorderWidth: 2,
            },
        ],
    };
    
    if (window.priceDotChart) window.priceDotChart.destroy();
    window.priceDotChart = new window.Chart(canvas, {
        type: "scatter",
        data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            elements: {
                point: {
                    radius: 5,
                    hoverRadius: 8
                }
            },
            plugins: { 
                legend: { 
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: textColor,
                        font: {
                            size: 12,
                            family: 'Inter'
                        },
                        padding: 10
                    }
                } 
            },
            scales: {
                y: { display: false },
                x: { 
                    title: { display: true, text: "Price ($)" },
                    ticks: { color: textColor },
                    grid: { color: isDarkMode ? '#404040' : '#e5e5e5' }
                },
            },
        },
    });
}

function drawPriceVsSellerScore(items){
    const canvas = document.getElementById("price-vs-seller-score");
    if (!canvas) {
        console.error('Canvas price-vs-seller-score not found');
        return;
    }

    const isDarkMode = document.body.classList.contains('dark-mode');
    const textColor = isDarkMode ? '#e5e5e5' : '#333';
    const gridColor = isDarkMode ? '#404040' : '#e5e5e5';

    // Separate data by condition
    const newData = [];
    const usedData = [];
    const otherData = [];

    for (const item of items){
        let priceVal = item.price;
        if (typeof priceVal === "object" && priceVal?.value != null) priceVal = priceVal.value;
        const price = parseFloat(priceVal);

        const feedbackRaw = item.seller?.feedbackPercentage;
        if (feedbackRaw == null) continue;
        
        const feedbackPercentage = parseFloat(feedbackRaw)
        if (!Number.isFinite(price) || !Number.isFinite(feedbackPercentage)) continue;

        const conditionInfo = getConditionCategory(item.condition);
        const point = { x: feedbackPercentage, y: price };
        
        if (conditionInfo.category === 'New') {
            newData.push(point);
        } else if (conditionInfo.category === 'Used') {
            usedData.push(point);
        } else {
            otherData.push(point);
        }
    }

    if (newData.length === 0 && usedData.length === 0 && otherData.length === 0) {
        console.error("No valid points to plot.");
        return;
    }
    
    const data = {
        datasets: [
            {
                label: "New",
                data: newData,
                pointRadius: 5,
                pointBackgroundColor: 'rgba(123, 191, 98, 0.5)', // Lighter green with transparency
                pointBorderColor: 'rgba(39, 145, 0, 0.75)', // Darker green border with transparency
                pointBorderWidth: 2,
            },
            {
                label: "Used",
                data: usedData,
                pointRadius: 5,
                pointBackgroundColor: 'rgba(96, 165, 250, 0.5)', // Lighter blue with transparency
                pointBorderColor: 'rgba(0, 100, 210, 0.75)', // Darker blue border with transparency
                pointBorderWidth: 2,
            },
            {
                label: "Other",
                data: otherData,
                pointRadius: 5,
                pointBackgroundColor: 'rgba(209, 213, 219, 0.5)', // Lighter grey with transparency
                pointBorderColor: 'rgba(153, 153, 153, 0.75)', // Darker grey border with transparency
                pointBorderWidth: 2,
            },
        ],
    };
    
    if (window.priceVsSellerChart) window.priceVsSellerChart.destroy();
    window.priceVsSellerChart = new window.Chart(canvas, {
        type: "scatter",
        data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            elements: {
                point: {
                    radius: 5,
                    hoverRadius: 8
                }
            },
            plugins: { 
                legend: { 
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: textColor,
                        font: {
                            size: 12,
                            family: 'Inter'
                        },
                        padding: 10
                    }
                } 
            },
            scales: {
                x: {
                  type: "linear",
                  position: "bottom",
                  title: { display: true, text: "Seller feedback (%)" },
                  ticks: { color: textColor },
                  grid: { color: gridColor }
                },
                y: {
                  title: { display: true, text: "Price ($)" },
                  ticks: { color: textColor },
                  grid: { color: gridColor }
                },
            }
        },
    });
}

function drawPriceVsDateListed(items) {
    const canvas = document.getElementById("price-vs-date");
    if (!canvas) {
        console.error("Canvas price-vs-date not found");
        return;
    }
  
    const isDarkMode = document.body.classList.contains('dark-mode');
    const textColor = isDarkMode ? '#e5e5e5' : '#333';
    const gridColor = isDarkMode ? '#404040' : '#e5e5e5';

    // Separate data by condition
    const newData = [];
    const usedData = [];
    const otherData = [];
  
    for (const item of items) {
        // x = date
        const dateRaw = item.itemCreationDate;
        if (!dateRaw) continue;
        const t = new Date(dateRaw);
        if (Number.isNaN(t.getTime())) continue;

        // y = price
        let priceVal = item.price;
        if (typeof priceVal === "object" && priceVal?.value != null) priceVal = priceVal.value;
        const price = parseFloat(priceVal);
        if (!Number.isFinite(price)) continue;

        const conditionInfo = getConditionCategory(item.condition);
        const point = { x: t, y: price }; // x can be Date or ISO string
        
        if (conditionInfo.category === 'New') {
            newData.push(point);
        } else if (conditionInfo.category === 'Used') {
            usedData.push(point);
        } else {
            otherData.push(point);
        }
    }
  
    if (newData.length === 0 && usedData.length === 0 && otherData.length === 0) {
        console.error("No valid (date, price) points to plot.");
        return;
    }
  
    const data = {
        datasets: [
            {
                label: "New",
                data: newData,
                pointRadius: 5,
                pointBackgroundColor: 'rgba(123, 191, 98, 0.5)', // Lighter green with transparency
                pointBorderColor: 'rgba(39, 145, 0, 0.75)', // Darker green border with transparency
                pointBorderWidth: 2,
            },
            {
                label: "Used",
                data: usedData,
                pointRadius: 5,
                pointBackgroundColor: 'rgba(96, 165, 250, 0.5)', // Lighter blue with transparency
                pointBorderColor: 'rgba(0, 100, 210, 0.75)', // Darker blue border with transparency
                pointBorderWidth: 2,
            },
            {
                label: "Other",
                data: otherData,
                pointRadius: 5,
                pointBackgroundColor: 'rgba(209, 213, 219, 0.5)', // Lighter grey with transparency
                pointBorderColor: 'rgba(153, 153, 153, 0.75)', // Darker grey border with transparency
                pointBorderWidth: 2,
            },
        ],
    };
  
    if (window.priceVsDateChart) window.priceVsDateChart.destroy();
    window.priceVsDateChart = new window.Chart(canvas, {
        type: "scatter",
        data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            elements: {
                point: {
                    radius: 5,
                    hoverRadius: 8
                }
            },
            plugins: { 
                legend: { 
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: textColor,
                        font: {
                            size: 12,
                            family: 'Inter'
                        },
                        padding: 10
                    }
                } 
            },
            scales: {
                x: {
                type: "time",
                time: { unit: "day" },
                title: { display: true, text: "Date listed" },
                ticks: { color: textColor },
                grid: { color: gridColor }
                },
                y: {
                title: { display: true, text: "Price ($)" },
                ticks: { color: textColor },
                grid: { color: gridColor }
                },
            },
        },
    });
}

function drawNewVsUsed(items) {
    const canvas = document.getElementById("new-vs-used-chart");
    if (!canvas) {
        console.error('Canvas new-vs-used-chart not found');
        return;
    }

    // Count New vs Used items
    let newCount = 0;
    let usedCount = 0;
    let otherCount = 0;

    for (const item of items) {
        const condition = item.condition?.toUpperCase() || '';
        if (condition.includes('NEW')) {
            newCount++;
        } else if (condition.includes('USED') || condition.includes('PRE-OWNED')) {
            usedCount++;
        } else {
            otherCount++;
        }
    }

    const isDarkMode = document.body.classList.contains('dark-mode');
    const textColor = isDarkMode ? '#e5e5e5' : '#333';
    const gridColor = isDarkMode ? '#404040' : '#e5e5e5';

    const data = {
        labels: ['New', 'Used', 'Other'],
        datasets: [{
            data: [newCount, usedCount, otherCount],
            backgroundColor: [
                '#279100', // Lighter green fill
                '#0064D2', // Lighter blue fill
                '#999999'  // Lighter grey fill
            ],
            borderColor: [
                '#279100', // Darker green border
                '#0064D2', // Darker blue border
                '#999999'  // Darker grey border
            ],
            borderWidth: 2
        }]
    };

    if (window.newVsUsedChart) window.newVsUsedChart.destroy();
    window.newVsUsedChart = new window.Chart(canvas, {
        type: 'doughnut',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: textColor,
                        font: {
                            size: 12,
                            family: 'Inter'
                        },
                        padding: 10
                    }
                },
                tooltip: {
                    backgroundColor: isDarkMode ? '#2d2d2d' : '#ffffff',
                    titleColor: textColor,
                    bodyColor: textColor,
                    borderColor: gridColor,
                    borderWidth: 1
                }
            }
        }
    });
}

// Show mock results for testing (remove when backend is connected)
// function showMockResults(query) {
//     const mockData = {
//         itemSummaries: [
//             {
//                 title: "Sample Product 1 - Brand New Item",
//                 price: { value: "29.99", currency: "USD" },
//                 condition: "NEW",
//                 itemWebUrl: "https://www.ebay.com"
//             },
//             {
//                 title: "Sample Product 2 - Used Condition",
//                 price: { value: "19.99", currency: "USD" },
//                 condition: "USED",
//                 itemWebUrl: "https://www.ebay.com"
//             },
//             {
//                 title: "Sample Product 3 - Excellent Condition",
//                 price: { value: "49.99", currency: "USD" },
//                 condition: "EXCELLENT",
//                 itemWebUrl: "https://www.ebay.com"
//             }
//         ]
//     };
    
//     displayResults(mockData, query || 'Mock Search');
// }

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

// Theme Toggle Functionality
function getThemeIcon() {
    const themeToggle = document.getElementById('themeToggle');
    return themeToggle?.querySelector('.theme-icon');
}

// Load saved theme preference
function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    const themeIcon = getThemeIcon();
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        if (themeIcon) themeIcon.textContent = '☀️';
    } else {
        document.body.classList.remove('dark-mode');
        if (themeIcon) themeIcon.textContent = '🌙';
    }
}

// Toggle theme
function toggleTheme(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    const isDarkMode = document.body.classList.contains('dark-mode');
    const themeIcon = getThemeIcon();
    
    if (isDarkMode) {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light');
        if (themeIcon) themeIcon.textContent = '🌙';
    } else {
        document.body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
        if (themeIcon) themeIcon.textContent = '☀️';
    }
    
    // Update chart colors if charts exist (after toggle, so check new state)
    setTimeout(() => {
        const newIsDarkMode = document.body.classList.contains('dark-mode');
        const textColor = newIsDarkMode ? '#e5e5e5' : '#333';
        const gridColor = newIsDarkMode ? '#404040' : '#e5e5e5';
        
        // Update donut chart
        if (window.newVsUsedChart) {
            window.newVsUsedChart.options.plugins.legend.labels.color = textColor;
            window.newVsUsedChart.options.plugins.tooltip.backgroundColor = newIsDarkMode ? '#2d2d2d' : '#ffffff';
            window.newVsUsedChart.options.plugins.tooltip.titleColor = textColor;
            window.newVsUsedChart.options.plugins.tooltip.bodyColor = textColor;
            window.newVsUsedChart.options.plugins.tooltip.borderColor = gridColor;
            window.newVsUsedChart.update();
        }
        
        // Update scatter charts
        const scatterCharts = [
            window.priceDotChart,
            window.priceVsSellerChart,
            window.priceVsDateChart
        ];
        
        scatterCharts.forEach(chart => {
            if (chart && chart.options) {
                if (chart.options.plugins?.legend) {
                    chart.options.plugins.legend.labels.color = textColor;
                }
                if (chart.options.scales) {
                    Object.keys(chart.options.scales).forEach(scaleKey => {
                        if (chart.options.scales[scaleKey].ticks) {
                            chart.options.scales[scaleKey].ticks.color = textColor;
                        }
                        if (chart.options.scales[scaleKey].grid) {
                            chart.options.scales[scaleKey].grid.color = gridColor;
                        }
                    });
                }
                chart.update();
            }
        });
    }, 0);
}

// Initialize theme toggle when DOM is ready
function initThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    
    if (!themeToggle) {
        console.error('Theme toggle button not found');
        // Try again after a short delay in case DOM isn't ready
        setTimeout(initThemeToggle, 100);
        return;
    }
    
    console.log('Theme toggle initialized');
    
    // Handle click on button - use multiple methods to ensure it works
    themeToggle.onclick = toggleTheme;
    themeToggle.addEventListener('click', toggleTheme);
    themeToggle.addEventListener('mousedown', function(e) {
        e.preventDefault();
        toggleTheme(e);
    });
    
    // Load saved theme
    loadTheme();
}

// Initialize immediately (script is at end of body, so DOM should be ready)
initThemeToggle();

// Also try on DOMContentLoaded as backup
document.addEventListener('DOMContentLoaded', initThemeToggle);