// Register Chart.js zoom plugin when DOM is ready
function registerZoomPlugin() {
    if (window.Chart && window.Chart.register) {
        // Try different possible plugin names from CDN
        if (typeof window.zoomPlugin !== 'undefined') {
            window.Chart.register(window.zoomPlugin);
            console.log('Zoom plugin registered as zoomPlugin');
        } else if (typeof window.ChartZoom !== 'undefined') {
            window.Chart.register(window.ChartZoom);
            console.log('Zoom plugin registered as ChartZoom');
        } else if (typeof window['chartjs-plugin-zoom'] !== 'undefined') {
            window.Chart.register(window['chartjs-plugin-zoom']);
            console.log('Zoom plugin registered');
        } else {
            console.warn('Zoom plugin not found. Make sure chartjs-plugin-zoom is loaded.');
        }
    }
}

// Register on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', registerZoomPlugin);
} else {
    registerZoomPlugin();
}

// DOM elements
const searchInput = document.getElementById('searchInput');
const minPriceInput = document.getElementById('minPriceInput');
const maxPriceInput = document.getElementById('maxPriceInput');
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
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
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

// Handle clear history button
clearHistoryBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearHistory(e);
});

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === historyModal) {
        hideHistoryModal();
    }
});

// api.py search requester
async function searchAPI(query, minPrice, maxPrice) {
    const response = await fetch('/api/search', {
            method: 'POST',
            headers: {'Content-Type': 'application/json',},
            body: JSON.stringify({
                query : query,
                minPrice : minPrice,
                maxPrice : maxPrice
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.details || response.statusText);
        }

        return response.json() // returns data in list form
}

// Main search handler
async function handleSearch() {
    const query = searchInput.value.trim();
    let minPrice = minPriceInput.value.trim();
    let maxPrice = maxPriceInput.value.trim();
    
    if (minPrice === "") {
        minPrice = '0';
    }

    // empty search query
    if (!query) {
        showError('Please enter a product name');
        return;
    } else if (query.length > 80) {
        showError('Please keep searches under 80 characters');
        return;
    }

    if (maxPrice !== "" && Number(maxPrice) <= Number(minPrice)) {
        showError('Please enter a product name and a valid price range.');
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
        const data = await searchAPI(query, minPrice, maxPrice);
        const items = data.itemSummaries || [];

        if (items.length === 0) {
            showError('No results found. Try a different search term.');
            return;
        }

        displayResults(data, query);

    } catch (error) {
        showError(`Search failed. ${error.message}`);
        return;
        
    } finally {
        hideLoading();
        searchButton.disabled = false;
    }
}

let lastQuery = '';

// Display search results
function displayResults(data, query) {
    lastQuery = query;
    const items = data.itemSummaries || [];
    lastItems = items;

    dashboardTitle.innerHTML = `Overview: <span style="color: #0064D2;">${capitalizeWords(query)}</span>`;

    // Save to search history
    saveToHistory(query);

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
                priceCurrency = item.price.currency || '$';
            } else {
                priceValue = item.price;
                priceCurrency = item.currency || '$';
            }
            if (priceCurrency == 'USD') {
                priceCurrency = '$';
            }
        }
        priceCell.textContent = priceValue !== 'N/A' ? `${priceCurrency}${priceValue}` : 'N/A';
        
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
            link.textContent = 'eBay Link';
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

function itemsToCsv(items) {
    const headers = ['#','Title','Price','Condition','Link','Seller','Category'];
    const rows = items.map((item, idx) => [
        idx + 1,
        item.title || 'N/A',
        (item.price?.value ?? item.price ?? 'N/A'),
        item.condition || 'N/A',
        item.itemWebUrl || item['item link'] || 'N/A',
        item.seller?.username ? `${item.seller.username} (${item.seller.feedbackPercentage ?? 'N/A'}%)` : 'N/A',
        item.categories?.[0]?.categoryName || 'N/A',
    ]);

    const csv = [headers, ...rows]
    .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n');
    return csv;
}


function downloadCsv(filename, csvText) {
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

// Download button handler
const downloadButton = document.getElementById('downloadButton');
downloadButton.addEventListener('click', () => {
    if (!lastItems.length) return;
    const safe = lastQuery.trim().replace(/[^a-z0-9_-]+/gi, '-');
    const filename = safe ? `${safe}-results.csv` : 'ebay-results.csv';
    downloadCsv(filename, itemsToCsv(lastItems));
});

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

    const isLightMode = document.body.classList.contains('light-mode');
    const textColor = isLightMode ? '#333333' : '#bcbcbc';

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
                            family: 'Hedvig Letters Sans'
                        },
                        padding: 10
                    }
                } 
            },
            scales: {
                y: { display: false },
                x: { 
                    title: { 
                        display: true, 
                        text: "Price ($)",
                        font: {
                            family: 'Hedvig Letters Sans'
                        },
                        color: textColor
                    },
                    ticks: { 
                        color: textColor,
                        font: {
                            family: 'Hedvig Letters Sans'
                        }
                    },
                    grid: { color: isLightMode ? '#e5e5e5' : '#333333'}
                },
            },
            interaction: {
                mode: 'nearest',
                intersect: true
            },
            onHover: (event, activeElements) => {
                event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
            },
            plugins: {
                zoom: {
                    limits: {
                        x: {min: 'original', max: 'original'},
                        y: {min: 'original', max: 'original'}
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                            speed: 0.02
                        },
                        pinch: {
                            enabled: true,
                            speed: 0.02
                        },
                        mode: 'xy',
                    },
                    pan: {
                        enabled: true,
                        mode: 'xy',
                        modifierKey: false,
                        threshold: 5
                    }
                }
            }
        },
    });
}

function drawPriceVsSellerScore(items){
    const canvas = document.getElementById("price-vs-seller-score");
    if (!canvas) {
        console.error('Canvas price-vs-seller-score not found');
        return;
    }

    const isLightMode = document.body.classList.contains('light-mode');
    const textColor = isLightMode ? '#333333' : '#bcbcbc';
    const gridColor = isLightMode ? '#e5e5e5' : '#333333';

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
                            family: 'Hedvig Letters Sans'
                        },
                        padding: 10
                    }
                } 
            },
            scales: {
                x: {
                  type: "linear",
                  position: "bottom",
                  title: { 
                      display: true, 
                      text: "Seller feedback (%)",
                      font: {
                          family: 'Hedvig Letters Sans'
                      },
                      color: textColor
                  },
                  ticks: { 
                      color: textColor,
                      font: {
                          family: 'Hedvig Letters Sans'
                      }
                  },
                  grid: { color: gridColor }
                },
                y: {
                  title: { 
                      display: true, 
                      text: "Price ($)",
                      font: {
                          family: 'Hedvig Letters Sans'
                      },
                      color: textColor
                  },
                  ticks: { 
                      color: textColor,
                      font: {
                          family: 'Hedvig Letters Sans'
                      }
                  },
                  grid: { color: gridColor }
                },
            },
            interaction: {
                mode: 'nearest',
                intersect: true
            },
            onHover: (event, activeElements) => {
                event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
            },
            plugins: {
                zoom: {
                    limits: {
                        x: {min: 'original', max: 'original'},
                        y: {min: 'original', max: 'original'}
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                            speed: 0.02
                        },
                        pinch: {
                            enabled: true,
                            speed: 0.02
                        },
                        mode: 'xy',
                    },
                    pan: {
                        enabled: true,
                        mode: 'xy',
                        modifierKey: false,
                        threshold: 5
                    }
                }
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
  
    const isLightMode = document.body.classList.contains('light-mode');
    const textColor = isLightMode ? '#333333' : '#bcbcbc';
    const gridColor = isLightMode ? '#e5e5e5' : '#333333';

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
                            family: 'Hedvig Letters Sans'
                        },
                        padding: 10
                    }
                } 
            },
            scales: {
                x: {
                type: "time",
                time: { unit: "day" },
                title: { 
                    display: true, 
                    text: "Date listed",
                    font: {
                        family: 'Hedvig Letters Sans'
                    },
                    color: textColor
                },
                ticks: { 
                    color: textColor,
                    font: {
                        family: 'Hedvig Letters Sans'
                    }
                },
                grid: { color: gridColor }
                },
                y: {
                title: { 
                    display: true, 
                    text: "Price ($)",
                    font: {
                        family: 'Hedvig Letters Sans'
                    },
                    color: textColor
                },
                ticks: { 
                    color: textColor,
                    font: {
                        family: 'Hedvig Letters Sans'
                    }
                },
                grid: { color: gridColor }
                },
            },
            interaction: {
                mode: 'nearest',
                intersect: true
            },
            onHover: (event, activeElements) => {
                event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'default';
            },
            plugins: {
                zoom: {
                    limits: {
                        x: {min: 'original', max: 'original'},
                        y: {min: 'original', max: 'original'}
                    },
                    zoom: {
                        wheel: {
                            enabled: true,
                            speed: 0.02
                        },
                        pinch: {
                            enabled: true,
                            speed: 0.02
                        },
                        mode: 'xy',
                    },
                    pan: {
                        enabled: true,
                        mode: 'xy',
                        modifierKey: false,
                        threshold: 5
                    }
                }
            }
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

    const isLightMode = document.body.classList.contains('light-mode');
    const textColor = isLightMode ? '#333333' : '#bcbcbc';
    const gridColor = isLightMode ? '#e5e5e5' : '#333333';

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
                            family: 'Hedvig Letters Sans'
                        },
                        padding: 10
                    }
                },
                tooltip: {
                    backgroundColor: isLightMode ? '#ffffff' : '#2d2d2d',
                    titleColor: textColor,
                    bodyColor: textColor,
                    borderColor: gridColor,
                    borderWidth: 1,
                    titleFont: {
                        family: 'Hedvig Letters Sans'
                    },
                    bodyFont: {
                        family: 'Hedvig Letters Sans'
                    }
                }
            }
        }
    });
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

function clearHistory(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    localStorage.removeItem('ebaySearchHistory');
    historyList.innerHTML = '<p class="no-history">No search history yet.</p>';
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

function setThemeIcon(isLightMode) {
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;
    
    const svg = themeToggle.querySelector('.theme-icon');
    if (!svg) return;
    
    // Create new SVG element
    const newSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    newSvg.setAttribute('class', 'theme-icon');
    newSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    newSvg.setAttribute('width', '20');
    newSvg.setAttribute('height', '20');
    newSvg.setAttribute('viewBox', '-1 -1 26 26');
    newSvg.setAttribute('fill', 'none');
    // Stroke color should be visible in current theme: dark mode needs light stroke, light mode needs dark stroke
    newSvg.setAttribute('stroke', isLightMode ? '#000000' : '#ffffff');
    newSvg.setAttribute('stroke-width', '3');
    newSvg.setAttribute('stroke-linecap', 'round');
    newSvg.setAttribute('stroke-linejoin', 'round');
    
    if (isLightMode) {
        // Moon icon (to switch to dark mode - shown when in light mode)
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z');
        newSvg.appendChild(path);
    } else {
        // Sun icon (to switch to light mode - shown when in dark mode)
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '12');
        circle.setAttribute('cy', '12');
        circle.setAttribute('r', '5');
        newSvg.appendChild(circle);
        
        const paths = [
            'M12 1v2', 'M12 21v2', 'M4.2 4.2l1.4 1.4', 'M18.4 18.4l1.4 1.4',
            'M1 12h2', 'M21 12h2', 'M4.2 19.8l1.4-1.4', 'M18.4 5.6l1.4-1.4'
        ];
        paths.forEach(d => {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', d);
            newSvg.appendChild(path);
        });
    }
    
    // Replace the old SVG with the new one
    svg.parentNode.replaceChild(newSvg, svg);
}

// Load saved theme preference
function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        setThemeIcon(true);
    } else {
        document.body.classList.remove('light-mode');
        setThemeIcon(false);
    }
}

// Toggle theme
function toggleTheme(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    const isLightMode = document.body.classList.contains('light-mode');
    
    if (isLightMode) {
        document.body.classList.remove('light-mode');
        localStorage.setItem('theme', 'dark');
        setThemeIcon(false);
    } else {
        document.body.classList.add('light-mode');
        localStorage.setItem('theme', 'light');
        setThemeIcon(true);
    }
    
    // Update chart colors if charts exist (after toggle, so check new state)
    setTimeout(() => {
        const newIsLightMode = document.body.classList.contains('light-mode');
        const textColor = newIsLightMode ? '#333333' : '#e5e5e5';
        const gridColor = newIsLightMode ? '#e5e5e5' : '#404040';
        
        // Update donut chart
        if (window.newVsUsedChart) {
            window.newVsUsedChart.options.plugins.legend.labels.color = textColor;
            window.newVsUsedChart.options.plugins.tooltip.backgroundColor = newIsLightMode ? '#ffffff' : '#2d2d2d';
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
                        // Add this to update title color:
                        if (chart.options.scales[scaleKey].title) {
                            chart.options.scales[scaleKey].title.color = textColor;
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
let themeToggleInitialized = false;

function initThemeToggle() {
    if (themeToggleInitialized) {
        return; // Already initialized, don't do it again
    }
    
    const themeToggle = document.getElementById('themeToggle');
    
    if (!themeToggle) {
        console.error('Theme toggle button not found');
        // Try again after a short delay in case DOM isn't ready
        setTimeout(initThemeToggle, 100);
        return;
    }
    
    console.log('Theme toggle initialized');
    themeToggleInitialized = true;
    
    // Add event listener
    themeToggle.addEventListener('click', toggleTheme);
    
    // Load saved theme
    loadTheme();
}

function capitalizeWords(str) {
    // 1. Convert the entire string to lowercase to ensure consistency
    const lowercasedStr = str.toLowerCase(); 
    
    // 2. Split the string into an array of words based on spaces
    const words = lowercasedStr.split(' ');
    
    // 3. Use the map() method to iterate through the words array
    const capitalizedWords = words.map(word => {
      return word.charAt(0).toUpperCase() + word.slice(1);
    });
    
    return capitalizedWords.join(' ');
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemeToggle);
} else {
    initThemeToggle();
}
