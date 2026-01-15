const elements = {
    goldTypeRadios: document.querySelectorAll('input[name="purity"]'),
    rateInput: document.getElementById('rateInput'),
    weightInput: document.getElementById('weightInput'),
    wastageTypeToggle: document.getElementById('wastageTypeToggle'),
    wastageInput: document.getElementById('wastageInput'),
    wastagePercentLabel: document.getElementById('wastagePercentLabel'),
    wastageFixedLabel: document.getElementById('wastageFixedLabel'),
    gstToggle: document.getElementById('gstToggle'),
    gstInputWrapper: document.getElementById('gstInputWrapper'),
    gstPercentInput: document.getElementById('gstPercentInput'),
    resetBtn: document.getElementById('resetBtn'),
    // Outputs
    goldValueDisplay: document.getElementById('goldValueDisplay'),
    wastageDisplay: document.getElementById('wastageDisplay'),
    gstPercentDisplay: document.getElementById('gstPercentDisplay'),
    gstDisplay: document.getElementById('gstDisplay'),
    finalTotalDisplay: document.getElementById('finalTotalDisplay'),
    // New Elements
    metalBtns: document.querySelectorAll('.metal-btn'),
    goldOptions: document.getElementById('goldOptions'),
    silverOptions: document.getElementById('silverOptions'),
    fetchRateBtn: document.getElementById('fetchRateBtn')
};

// State
let currentMetal = 'gold';
let rates = {
    gold: { 24: '', 22: '', 18: '' },
    silver: { 999: '', 925: '' }
};

// Formatting
function formatCurrency(amount) {
    return '₹ ' + amount.toLocaleString('en-IN', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2
    });
}

function getFloat(value) {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
}

function getSelectedPurity() {
    const checked = document.querySelector('input[name="purity"]:checked');
    return checked ? checked.value : null;
}

// ---------------------------
// Calculations
// ---------------------------
function updateCalculations() {
    const rate = getFloat(elements.rateInput.value);
    const weight = getFloat(elements.weightInput.value);
    
    // 1. Base Value
    const baseValue = rate * weight;

    // 2. Wastage
    const wastageValueInput = getFloat(elements.wastageInput.value);
    let wastageAmount = 0;
    const isFixedWastage = elements.wastageTypeToggle.checked; // Checked = Fixed (₹)

    if (isFixedWastage) {
        wastageAmount = wastageValueInput;
    } else {
        wastageAmount = baseValue * (wastageValueInput / 100);
    }

    const subtotal = baseValue + wastageAmount;

    // 3. GST
    let gstAmount = 0;
    const isGstEnabled = elements.gstToggle.checked;
    const gstPercent = getFloat(elements.gstPercentInput.value);

    if (isGstEnabled) {
        gstAmount = subtotal * (gstPercent / 100);
        elements.gstPercentDisplay.textContent = `(${gstPercent}%)`;
        elements.gstInputWrapper.style.opacity = '1';
        elements.gstInputWrapper.style.pointerEvents = 'auto';
    } else {
        elements.gstPercentDisplay.textContent = '(0%)';
        elements.gstInputWrapper.style.opacity = '0.5';
        elements.gstInputWrapper.style.pointerEvents = 'none';
    }

    // 4. Totals
    const finalTotal = subtotal + gstAmount;

    // 5. Update UI
    elements.goldValueDisplay.textContent = formatCurrency(baseValue);
    elements.wastageDisplay.textContent = formatCurrency(wastageAmount);
    elements.gstDisplay.textContent = formatCurrency(gstAmount);
    elements.finalTotalDisplay.textContent = formatCurrency(finalTotal);
}

// ---------------------------
// Metal Switching
// ---------------------------
function switchMetal(metal) {
    currentMetal = metal;
    
    // 1. Update Buttons
    elements.metalBtns.forEach(btn => {
        if (btn.dataset.metal === metal) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    // 2. Update Theme
    if (metal === 'silver') {
        document.body.classList.add('silver-mode');
        elements.goldOptions.classList.add('hidden');
        elements.silverOptions.classList.remove('hidden');
        
        // Select first silver option by default
        const firstSilver = elements.silverOptions.querySelector('input');
        if (firstSilver) firstSilver.checked = true;
    } else {
        document.body.classList.remove('silver-mode');
        elements.silverOptions.classList.add('hidden');
        elements.goldOptions.classList.remove('hidden');
        
        const firstGold = elements.goldOptions.querySelector('input');
        if (firstGold) firstGold.checked = true;
    }

    // 3. Restore Rate for this metal/purity
    const purity = getSelectedPurity();
    elements.rateInput.value = rates[currentMetal][purity] || '';
    
    updateCalculations();
}

// ---------------------------
// Fetch Live Rates (Web Scraping)
// ---------------------------
async function fetchLiveRate() {
    const btn = elements.fetchRateBtn;
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span> Fetching...`;
    btn.disabled = true;

    try {
        if (currentMetal === 'gold') {
            await fetchGoldRates();
        } else {
            await fetchSilverRates();
        }

        // Temporary success indicator
        btn.innerHTML = `<span class="icon">✅</span> Update Success!`;
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }, 2000);

    } catch (error) {
        console.error(error);
        alert('Error fetching rates: ' + error.message);
        btn.innerHTML = `<span class="icon">❌</span> Error`;
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }, 2000);
    }
}

async function fetchGoldRates() {
    // 1. Fetch HTML via CORS Proxy
    const proxyUrl = 'https://api.allorigins.win/raw?url=';
    const targetUrl = 'https://www.goodreturns.in/gold-rates/chennai.html';
    
    // Add a cache buster to avoid stale data from proxy
    const uniqueUrl = targetUrl + '?t=' + new Date().getTime();

    const response = await fetch(proxyUrl + encodeURIComponent(uniqueUrl));
    if (!response.ok) throw new Error('Failed to fetch from GoodReturns');
    
    const htmlText = await response.text();
    
    // 2. Parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    // 3. Extract Rates
    // Strategy: Look for specific IDs first (selectors), then fallback to table search.
    const ratesFound = {};

    const getPriceFromSelector = (sel) => {
        try {
            const el = doc.querySelector(sel);
            return el ? parsePrice(el.innerText) : null;
        } catch (e) {
            console.warn('Selector error:', e);
            return null;
        }
    };
    
    // Try explicit ID selectors (IDs starting with numbers need attribute syntax in querySelector)
    let r24 = getPriceFromSelector('[id="el-24K-price"]') || getPriceFromSelector('[id="24K-price"]'); 
    let r22 = getPriceFromSelector('[id="el-22K-price"]') || getPriceFromSelector('[id="22K-price"]');

    // If ID selectors failed, do robust table search
    if (!r22 || !r24) {
        const rows = Array.from(doc.querySelectorAll('tr'));
        
        // Find 22K
        if (!r22) {
            // Find row containing "22 Carat" and "1 Gram" (sometimes separate rows)
            // Or look for a table under a header "22 Carat Gold Rate..."
            const row = rows.find(r => r.innerText.includes('22 Carat') && r.innerText.includes('1 Gram'));
            if (row) {
                 const cells = row.querySelectorAll('td');
                 if (cells.length > 1) r22 = parsePrice(cells[1].innerText);
            }
        }
        
        // Find 24K
        if (!r24) {
            const row = rows.find(r => r.innerText.includes('24 Carat') && r.innerText.includes('1 Gram'));
            if (row) {
                 const cells = row.querySelectorAll('td');
                 if (cells.length > 1) r24 = parsePrice(cells[1].innerText);
            }
        }
    }

    if (r22) rates.gold[22] = r22;
    if (r24) rates.gold[24] = r24;
    
    // 18K is often not listed clearly, so calculate 75% of 24K or look for it
    let r18 = null;
    const row18 = Array.from(doc.querySelectorAll('tr')).find(r => r.innerText.includes('18 Carat') && r.innerText.includes('1 Gram'));
    if (row18) {
         const cells = row18.querySelectorAll('td');
         if (cells.length > 1) r18 = parsePrice(cells[1].innerText);
    }
    
    if (r18) rates.gold[18] = r18;
    else if (r24) rates.gold[18] = (r24 * 0.75).toFixed(2);

    // Apply
    const purity = getSelectedPurity();
    if (rates.gold[purity]) {
        elements.rateInput.value = rates.gold[purity];
        updateCalculations();
    } else {
        throw new Error('Could not parse gold rates (Site structure might have changed).');
    }
}

async function fetchSilverRates() {
    const proxyUrl = 'https://api.allorigins.win/raw?url=';
    const targetUrl = 'https://www.goodreturns.in/silver-rates/chennai.html';
    const uniqueUrl = targetUrl + '?t=' + new Date().getTime();
    
    const response = await fetch(proxyUrl + encodeURIComponent(uniqueUrl));
    if (!response.ok) throw new Error('Failed to fetch from GoodReturns');
    
    const htmlText = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlText, 'text/html');

    let silverRate = 0;

    // 1. Try specific ID selector first (Most reliable)
    // Note: ID selectors starting with digits or special chars might need attribute syntax, but "silver" is fine.
    // However, being consistent with previous fix:
    const el = doc.querySelector('#silver-1g-price') || doc.querySelector('[id="silver-1g-price"]');
    if (el) {
        silverRate = parsePrice(el.innerText);
    }

    // 2. Fallback to Table Search
    if (!silverRate) {
        const rows = Array.from(doc.querySelectorAll('tr'));
        // Finding row that says "1 Gram"
        const row = rows.find(r => {
            const txt = r.innerText.trim();
            // Match "1 Gram" or "1 gm" but avoid "10 Gram" etc.
            return (txt.includes('1 Gram') || txt.includes('1 Gm')) && !txt.includes('10 Gram') && !txt.includes('8 Gram');
        });
        
        if (row) {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
                silverRate = parsePrice(cells[1].innerText);
            }
        }
    }

    if (silverRate) {
        rates.silver[999] = silverRate; // Assuming 1g price is standard (often Fine)
        rates.silver[925] = (silverRate * 0.925).toFixed(2);
        
        const purity = getSelectedPurity();
        elements.rateInput.value = rates.silver[purity];
        updateCalculations();
    } else {
        throw new Error('Could not parse silver rate.');
    }
}

function parsePrice(text) {
    // Remove ₹, commas, newlines, spaces
    if (!text) return 0;
    const clean = text.replace(/[₹,]/g, '').trim();
    return parseFloat(clean);
}

elements.fetchRateBtn.addEventListener('click', fetchLiveRate);

// ---------------------------
// Event Listeners
// ---------------------------

// Metal Switch
elements.metalBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        switchMetal(btn.dataset.metal);
    });
});

// Purity Change
document.querySelectorAll('input[name="purity"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const purity = e.target.value;
        // Check if we have a stored rate for this
        if (rates[currentMetal][purity]) {
            elements.rateInput.value = rates[currentMetal][purity];
        }
        updateCalculations();
    });
});

// Inputs
elements.rateInput.addEventListener('input', (e) => {
    const purity = getSelectedPurity();
    if (purity) rates[currentMetal][purity] = e.target.value;
    updateCalculations();
});

elements.weightInput.addEventListener('input', updateCalculations);
elements.wastageInput.addEventListener('input', updateCalculations);
elements.gstPercentInput.addEventListener('input', updateCalculations);

// Toggles
elements.wastageTypeToggle.addEventListener('change', (e) => {
    if (e.target.checked) { // Fixed
        elements.wastageFixedLabel.classList.add('active');
        elements.wastagePercentLabel.classList.remove('active');
        elements.wastageInput.placeholder = "Enter amount (e.g. 2000)";
    } else { // Percent
        elements.wastagePercentLabel.classList.add('active');
        elements.wastageFixedLabel.classList.remove('active');
        elements.wastageInput.placeholder = "Enter percentage (e.g. 12)";
    }
    updateCalculations();
});

elements.gstToggle.addEventListener('change', updateCalculations);

// Reset
elements.resetBtn.addEventListener('click', () => {
    elements.rateInput.value = '';
    elements.weightInput.value = '';
    elements.wastageInput.value = '';
    
    // Reset stored rates logic? Maybe keep them for convenience.
    // Let's clear current only.
    const purity = getSelectedPurity();
    if (purity) rates[currentMetal][purity] = '';

    updateCalculations();
});

// ---------------------------
// Bill / Invoice Logic
// ---------------------------
let billItems = [];

// DOM Elements for Bill
elements.addToBillBtn = document.getElementById('addToBillBtn');
elements.billSection = document.getElementById('billSection');
elements.billItemsList = document.getElementById('billItemsList');
elements.grandTotalDisplay = document.getElementById('grandTotalDisplay');
elements.shareBtn = document.getElementById('shareBtn');

elements.addToBillBtn.addEventListener('click', () => {
    // Validate inputs
    const weight = getFloat(elements.weightInput.value);
    if (weight <= 0) {
        alert("Please enter a valid weight!");
        return;
    }

    // Capture current calculation state
    // We assume updateCalculations() has run and DOM is correct, but safer to recalculate numbers
    const rate = getFloat(elements.rateInput.value);
    
    // Wastage
    let wastageAmount = 0;
    const wastageInputVal = getFloat(elements.wastageInput.value);
    if (elements.wastageTypeToggle.checked) { // Fixed
        wastageAmount = wastageInputVal;
    } else {
        wastageAmount = (rate * weight) * (wastageInputVal / 100);
    }
    
    // GST
    let gstAmount = 0;
    const baseTotal = (rate * weight) + wastageAmount;
    if (elements.gstToggle.checked) {
        const gstPercent = getFloat(elements.gstPercentInput.value);
        gstAmount = baseTotal * (gstPercent / 100);
    }
    
    const total = baseTotal + gstAmount;
    
    // Item Description
    const metalFormatted = currentMetal === 'gold' ? 'Gold' : 'Silver';
    const purity = getSelectedPurity();
    let purityLabel = purity;
    if (currentMetal === 'gold') purityLabel += 'K';
    
    const item = {
        id: Date.now(),
        metal: currentMetal, // Store raw value 'gold'/'silver'
        metalFormatted: metalFormatted,
        purity: purity, // raw value like 24, 22
        purityLabel: purityLabel,
        weight: weight,
        rate: rate,
        wastageVal: wastageInputVal,
        isFixedWastage: elements.wastageTypeToggle.checked,
        gstPercent: elements.gstToggle.checked ? getFloat(elements.gstPercentInput.value) : 0,
        isGstEnabled: elements.gstToggle.checked,
        wastage: wastageAmount,
        gst: gstAmount,
        total: total
    };

    billItems.push(item);
    renderBill();

    // Scroll to bill
    elements.billSection.scrollIntoView({ behavior: 'smooth' });
});

function renderBill() {
    if (billItems.length === 0) {
        elements.billSection.classList.add('hidden');
        return;
    }

    elements.billSection.classList.remove('hidden');
    elements.billItemsList.innerHTML = '';
    
    // Update Date Display
    const now = new Date();
    document.getElementById('billDate').textContent = now.toLocaleString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    
    let grandTotal = 0;

    billItems.forEach(item => {
        grandTotal += item.total;
        
        const itemEl = document.createElement('div');
        itemEl.className = 'bill-item';
        itemEl.innerHTML = `
            <div class="bill-details">
                <span class="bill-row-main">${item.metalFormatted} ${item.purityLabel} - ${item.weight}g</span>
                <span class="bill-row-sub">Rate: ${item.rate} | VA: ${item.wastage.toFixed(0)} | GST: ${item.gst.toFixed(0)}</span>
            </div>
            <div style="display:flex; align-items:center;">
                <span class="bill-price">${formatCurrency(item.total)}</span>
                <button class="icon-btn edit-btn" onclick="editBillItem(${item.id})" title="Edit">✏️</button>
                <button class="icon-btn delete-item-btn" onclick="removeBillItem(${item.id})" title="Delete">&times;</button>
            </div>
        `;
        elements.billItemsList.appendChild(itemEl);
    });

    elements.grandTotalDisplay.textContent = formatCurrency(grandTotal);
}

// Edit Item
window.editBillItem = (id) => {
    const item = billItems.find(i => i.id === id);
    if (!item) return;

    // 1. Switch Metal
    if (currentMetal !== item.metal) {
        switchMetal(item.metal);
    }

    // 2. Set Purity
    // Need to wait/ensure options are visible? switchMetal handles visibility.
    // We need to check the specific radio button.
    const radio = document.querySelector(`input[name="purity"][value="${item.purity}"]`);
    if (radio) radio.checked = true;

    // 3. Set Inputs
    elements.rateInput.value = item.rate;
    elements.weightInput.value = item.weight;
    
    // 4. Set Wastage
    elements.wastageTypeToggle.checked = item.isFixedWastage;
    // Trigger change event manually to update placeholder/UI
    const event = new Event('change');
    elements.wastageTypeToggle.dispatchEvent(event);
    elements.wastageInput.value = item.wastageVal;

    // 5. Set GST
    elements.gstToggle.checked = item.isGstEnabled;
    elements.gstPercentInput.value = item.gstPercent || 3;
    
    // 6. Update Calculations
    updateCalculations();

    // 7. Remove from bill (move to "staging")
    removeBillItem(id);

    // 8. Scroll back to top
    document.querySelector('.container').scrollIntoView({ behavior: 'smooth' });
};

// Expose globally for onclick
window.removeBillItem = (id) => {
    billItems = billItems.filter(i => i.id !== id);
    renderBill();
};

elements.shareBtn.addEventListener('click', () => {
    if (billItems.length === 0) return;

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-IN');
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    let text = `*Jewellery Estimate*\n📅 ${dateStr}  ⏰ ${timeStr}\n------------------\n`;
    billItems.forEach(item => {
        text += `${item.metal} ${item.purity} (${item.weight}g)\n`;
        text += `Price: ${formatCurrency(item.total)}\n\n`;
    });
    
    const grandTotal = billItems.reduce((sum, i) => sum + i.total, 0);
    text += `------------------\n*Grand Total: ${formatCurrency(grandTotal)}*\n`;
    text += `\nCalculated via Gold Rate App`;

    // Important: encodeURIComponent handles special chars like \n correctly
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
});

// Initial
updateCalculations();
