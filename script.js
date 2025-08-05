// Initialize camera feed
import OpenAI from 'https://esm.sh/openai?bundle';

// --- OpenAI Vision setup ---
let openaiClient = null;
function getOpenAIClient() {
  if (!openaiApiKey) return null;
  if (openaiClient) return openaiClient;
  openaiClient = new OpenAI({ apiKey: openaiApiKey, dangerouslyAllowBrowser: true });
  return openaiClient;
}

// Analyse an image with GPT-4o Vision style prompt. Accepts a question and a data-URL or remote image URL.
async function askImageQuestion(question, imageUrl) {
  const client = getOpenAIClient();
  if (!client) return null;
  try {
    const resp = await client.responses.create({
      model: 'gpt-4o',
      input: [
        { role: 'user', content: question },
        {
          role: 'user',
          content: [
            { type: 'input_image', image_url: imageUrl }
          ]
        }
      ]
    });
    return resp.output_text || '';
  } catch (err) {
    console.warn('OpenAI Vision request failed', err);
    return null;
  }
}

// Extract structured JSON directly from an image using GPT-4o Vision
async function extractInfoVision(imageUrl) {
  const client = getOpenAIClient();
  if (!client) return null;
  try {
    const resp = await client.responses.create({
      model: 'gpt-4o',
      input: [
        {
          role: 'user',
          content:
            'Extract JSON with keys: storeName, unitNumber, address, businessType. Use "Not Found" if unknown.'
        },
        {
          role: 'user',
          content: [{ type: 'input_image', image_url: imageUrl }]
        }
      ]
    });
    const txt = resp.output_text || '';
    const match = txt.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch (err) {
    console.warn('Vision JSON extraction failed', err);
    return null;
  }
}
const video = document.getElementById('camera');
const statusDiv = document.getElementById('status');
const tableBody = document.querySelector('#resultsTable tbody');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
// --- NEW: Image upload elements ---
const uploadBtn = document.getElementById('uploadBtn');
const imageInput = document.getElementById('imageInput');

// Persistent scans storage
let scans = [];
// Note: openaiApiKey is defined later, but we need it before using getOpenAIClient().
// We will forward-declare it here and assign when loaded below.
let openaiApiKey;
let oneMapApiKey; // OneMap API key for authenticated endpoints
openaiApiKey = localStorage.getItem('openaiApiKey') || '';
oneMapApiKey = localStorage.getItem('oneMapApiKey') || '';
try {
  scans = JSON.parse(localStorage.getItem('scans') || '[]');
} catch (_) { scans = []; }

renderTable();

function saveScans() {
  localStorage.setItem('scans', JSON.stringify(scans));
}

function renderTable() {
  if (!tableBody) return;
  tableBody.innerHTML = '';
  scans.forEach((scan, idx) => {
    // Create wrapper for each row to contain both the row and delete button
    const wrapper = document.createElement('div');
    wrapper.className = 'row-wrapper';
    wrapper.style.position = 'relative';
    wrapper.style.overflow = 'hidden';
    
    // Create the table row
    const tr = document.createElement('tr');
    tr.className = 'swipeable-row';
    tr.dataset.index = idx;
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${scan.storeName}</td>
      <td>${scan.unitNumber}</td>
      <td>${scan.address ?? 'Not Found'}</td>
      <td>${scan.lat ?? 'Not Found'}</td>
      <td>${scan.lng ?? 'Not Found'}</td>
      <td>${scan.businessType}</td>`;
    
    // Create delete button positioned behind the row
    const deleteButton = document.createElement('div');
    deleteButton.className = 'delete-button';
    deleteButton.innerHTML = '🗑️ Delete';
    deleteButton.dataset.index = idx; // Store index in data attribute as backup
    deleteButton.style.cssText = `
      position: absolute;
      top: 0;
      right: -120px;
      bottom: 0;
      width: 120px;
      background: #ff4444;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      cursor: pointer;
      font-size: 14px;
      z-index: 5;
      user-select: none;
      pointer-events: auto;
    `;
    
    // Add multiple event handlers to ensure it works
    const handleDelete = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const index = parseInt(e.target.dataset.index) || idx;
      console.log('Delete button clicked for index:', index);
      console.log('Current scans array:', scans);
      deleteRow(index);
    };
    
    deleteButton.addEventListener('click', handleDelete);
    deleteButton.addEventListener('touchend', handleDelete);
    
    // Create table row container
    const rowContainer = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 7;
    cell.style.padding = '0';
    cell.style.position = 'relative';
    
    // Assemble structure
    wrapper.appendChild(deleteButton);
    wrapper.appendChild(tr);
    cell.appendChild(wrapper);
    rowContainer.appendChild(cell);
    
    // Add swipe functionality
    addSwipeToRow(tr, wrapper, deleteButton, idx);
    
    tableBody.appendChild(rowContainer);
  });
}

// Delete individual row
function deleteRow(index) {
  if (confirm(`Delete scan #${index + 1}?`)) {
    scans.splice(index, 1);
    saveScans();
    renderTable();
  }
}

// Add swipe functionality to a table row
function addSwipeToRow(rowElement, wrapper, deleteButton, index) {
  let startX = 0;
  let currentX = 0;
  let isDragging = false;
  let threshold = 100; // Minimum swipe distance to reveal delete action
  
  // Touch events for mobile
  rowElement.addEventListener('touchstart', handleStart, { passive: false });
  rowElement.addEventListener('touchmove', handleMove, { passive: false });
  rowElement.addEventListener('touchend', handleEnd, { passive: false });
  
  // Mouse events for desktop
  rowElement.addEventListener('mousedown', handleStart);
  rowElement.addEventListener('mousemove', handleMove);
  rowElement.addEventListener('mouseup', handleEnd);
  rowElement.addEventListener('mouseleave', handleEnd);
  
  function handleStart(e) {
    console.log('Swipe start detected', e.type); // Debug log
    
    // Don't start swipe if clicking on delete button
    if (e.target.classList.contains('delete-button') || e.target.closest('.delete-button')) {
      return;
    }
    
    isDragging = true;
    startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    currentX = startX;
    rowElement.classList.add('swiping');
    
    // Prevent text selection on desktop
    if (e.type.includes('mouse')) {
      e.preventDefault();
    }
  }
  
  function handleMove(e) {
    if (!isDragging) return;
    
    currentX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const diffX = startX - currentX;
    
    console.log('Swipe move', diffX); // Debug log
    
    // Only allow left swipe (positive diffX)
    if (diffX > 0) {
      const moveDistance = Math.min(diffX, threshold);
      
      // Move the entire row left to reveal delete button
      rowElement.style.transform = `translateX(-${moveDistance}px)`;
      rowElement.style.position = 'relative';
      rowElement.style.zIndex = '10';
      
      // Move delete button proportionally into view
      if (deleteButton) {
        const buttonPosition = -120 + moveDistance;
        deleteButton.style.right = `${Math.min(buttonPosition, 0)}px`;
      }
      
    } else {
      // Right swipe or no movement - reset
      rowElement.style.transform = 'translateX(0px)';
      if (deleteButton) {
        deleteButton.style.right = '-120px';
      }
    }
    
    e.preventDefault();
  }
  
  function handleEnd(e) {
    if (!isDragging) return;
    isDragging = false;
    
    const diffX = startX - currentX;
    rowElement.classList.remove('swiping');
    
    console.log('Swipe end', diffX, 'threshold:', threshold); // Debug log
    
    if (diffX >= threshold) {
      // Swipe completed - keep delete action visible
      rowElement.style.transform = `translateX(-${threshold}px)`;
      
      // Explicitly move delete button into view
      if (deleteButton) {
        deleteButton.style.right = '0px';
      }
      
      console.log('Delete button revealed'); // Debug log
      
      // Add click listener to reset on tap outside
      const resetSwipe = (event) => {
        if (!wrapper.contains(event.target)) {
          rowElement.style.transform = 'translateX(0px)';
          rowElement.style.zIndex = '';
          // Hide delete button
          if (deleteButton) {
            deleteButton.style.right = '-120px';
          }
          document.removeEventListener('click', resetSwipe);
          document.removeEventListener('touchstart', resetSwipe);
        }
      };
      
      // Delay to avoid immediate reset
      setTimeout(() => {
        document.addEventListener('click', resetSwipe);
        document.addEventListener('touchstart', resetSwipe);
      }, 100);
      
    } else {
      // Swipe not far enough - reset
      rowElement.style.transform = 'translateX(0px)';
      rowElement.style.zIndex = '';
      // Hide delete button
      if (deleteButton) {
        deleteButton.style.right = '-120px';
      }
    }
  }
}

// After renderTable definition add event listeners
// --- Toolbar actions ---
document.getElementById('clearBtn').addEventListener('click', () => {
  if (confirm('Clear all saved scans?')) {
    scans = [];
    saveScans();
    renderTable();
    if (video && video.srcObject) {
      video.play().catch(()=>{});
    }
  }
});

document.getElementById('exportBtn').addEventListener('click', () => {
  if (!scans.length) {
    alert('No data to export');
    return;
  }
  const headers = ['Store Name','Unit','Address','Lat','Lng','Type'];
  const csvRows = [headers.join(',')];
  scans.forEach(s => {
    const row = [s.storeName, s.unitNumber, s.address, s.lat, s.lng, s.businessType]
      .map(v => '"' + (v || '').replace(/"/g,'""') + '"').join(',');
    csvRows.push(row);
  });
  const blob = new Blob([csvRows.join('\n')], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'storefront_scans.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
});

// --- Manual store location search ---
const storeSearchInput = document.getElementById('storeSearchInput');
const searchLocationBtn = document.getElementById('searchLocationBtn');

async function performManualStoreSearch() {
  const searchQuery = storeSearchInput.value.trim();
  if (!searchQuery) {
    alert('Please enter a store name to search');
    return;
  }

  statusDiv.textContent = 'Searching for store location...';
  
  // Get current location for proximity search
  let geo = currentLocation;
  if (!geo.lat) {
    geo = await getCurrentLocation();
  }

  // Search for the store
  const storeLocation = await searchStoreLocation(searchQuery, geo.lat, geo.lng);
  
  if (storeLocation) {
    console.log('Manual search found location:', storeLocation);
    
    // Add the found location to scans
    const info = {
      storeName: searchQuery,
      unitNumber: 'Not Found',
      address: storeLocation.address,
      lat: storeLocation.lat,
      lng: storeLocation.lng,
      businessType: 'Unknown'
    };
    
    scans.push(info);
    saveScans();
    renderTable();
    
    statusDiv.textContent = `Found: ${searchQuery} at ${storeLocation.address}`;
    storeSearchInput.value = '';
    
    setTimeout(() => {
      statusDiv.textContent = '';
    }, 3000);
  } else {
    console.log('Manual search found no results for:', searchQuery);
    statusDiv.textContent = `No location found for: ${searchQuery}`;
    setTimeout(() => {
      statusDiv.textContent = '';
    }, 3000);
  }
}

searchLocationBtn.addEventListener('click', performManualStoreSearch);

// Allow Enter key to trigger search
storeSearchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    performManualStoreSearch();
  }
});

// ---------- Geolocation ----------
let currentLocation = { lat: '', lng: '' };

async function initLocation() {
  statusDiv.textContent = 'Requesting location…';
  currentLocation = await getCurrentLocation(true);
  if (!currentLocation.lat) {
    statusDiv.textContent = 'Location unavailable – scans will show N/A';
  } else {
    statusDiv.textContent = '';
  }
}

// call immediately
initLocation();

function getCurrentLocation(initial = false) {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve({ lat: '', lng: '' });

    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        resolve({ lat: latitude.toFixed(6), lng: longitude.toFixed(6) });
      },
      err => {
        if (!initial) console.warn('Geolocation error', err.message);
        resolve({ lat: '', lng: '' });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  });
}

// --- OneMap (Singapore) reverse-geocoding helper ---
// Note: OneMap's JSON schema has changed over time. Newer responses
// use a `results` array with camel-/snake-case keys (e.g. `BLK_NO`,
// `ROAD_NAME`, `POSTAL`). The original version of this file only
// handled the older `GeocodeInfo` shape, which is why it silently
// returned "" and the UI showed "Not Found".
//
// This implementation now:
// 1. Accepts either `GeocodeInfo` or `results`.
// 2. Normalises the field names so we can build a readable address
//    without having to worry about the exact schema version.
// 3. Falls back to the `ADDRESS` field when it is already formatted.
async function reverseGeocode(lat, lng) {
  try {
    // Newer API version expects separate lat & lon query params (see https://docs.onemap.sg/#revgeocode)
    const url = `https://developers.onemap.sg/commonapi/revgeocode?lat=${lat}&lon=${lng}&returnGeom=N&getAddrDetails=Y`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Handle both possible response shapes
    const result = (data.GeocodeInfo || data.results || data.ReverseGeocodeInfo)?.[0];
    if (!result) return '';

    // Normalise keys so we can treat both schemas uniformly
    const blk   = result.BLOCK      || result.BLK_NO      || result.block      || result.blk_no;
    const road  = result.ROAD       || result.ROAD_NAME   || result.road       || result.road_name;
    const bldg  = result.BUILDING   || result.BUILDINGNAME|| result.building   || result.buildingname;
    const postal= result.POSTAL     || result.POSTALCODE  || result.postal     || result.postalcode;
    const addr  = result.ADDRESS    || result.address;

    // Prefer a pre-formatted ADDRESS string if provided
    if (addr) return addr.trim();

    // Otherwise stitch together what we have
    const parts = [blk, road, bldg, 'SINGAPORE', postal].filter(Boolean);
    return parts.join(' ').trim();
  } catch (err) {
    console.warn('Reverse geocode failed', err);
    return '';
  }
}

// --- OneMap Search API for finding store locations ---
// Search for places by name using OneMap's search API
// Returns the best matching location with coordinates and address
async function searchStoreLocation(storeName, currentLat = null, currentLng = null) {
  if (!storeName || storeName === 'Not Found' || storeName === 'Unknown') {
    return null;
  }

  try {
    // Clean up store name for search
    const cleanStoreName = storeName.replace(/[^\w\s]/g, ' ').trim();
    if (!cleanStoreName) return null;

    // Use OneMap search API (public endpoint - no key required)
    const url = `https://developers.onemap.sg/commonapi/search?searchVal=${encodeURIComponent(cleanStoreName)}&returnGeom=Y&getAddrDetails=Y`;
    const headers = {};
    
    // If OneMap API key is available, could use authenticated endpoints for better performance
    // (Currently using free public endpoints which work fine)
    if (oneMapApiKey) {
      console.log('OneMap API key available for future authenticated endpoints');
    }
    
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Check if we have results
    if (!data.results || !Array.isArray(data.results) || data.results.length === 0) {
      console.log(`No search results found for: ${storeName}`);
      return null;
    }

    let bestMatch = data.results[0]; // Default to first result

    // If we have current location, find the closest match
    if (currentLat && currentLng && data.results.length > 1) {
      let closestDistance = Infinity;
      
      for (const result of data.results) {
        if (result.LATITUDE && result.LONGITUDE) {
          const distance = calculateDistance(
            parseFloat(currentLat),
            parseFloat(currentLng),
            parseFloat(result.LATITUDE),
            parseFloat(result.LONGITUDE)
          );
          
          if (distance < closestDistance) {
            closestDistance = distance;
            bestMatch = result;
          }
        }
      }
    }

    // Debug: Log the raw response to understand the structure
    console.log('OneMap search response for', storeName, ':', bestMatch);

    // Extract coordinates and address from the best match
    const lat = bestMatch.LATITUDE || bestMatch.lat;
    const lng = bestMatch.LONGITUDE || bestMatch.lng;
    
    // Try multiple ways to extract address
    let address = '';
    
    // Method 1: Check for pre-formatted address
    if (bestMatch.ADDRESS) {
      address = bestMatch.ADDRESS.trim();
    } else if (bestMatch.address) {
      address = bestMatch.address.trim();
    }
    
    // Method 2: Build address from components (more reliable)
    if (!address) {
      const addressParts = [
        bestMatch.BLK_NO || bestMatch.BLOCK,
        bestMatch.ROAD_NAME || bestMatch.ROAD,
        bestMatch.BUILDING || bestMatch.BUILDINGNAME,
        bestMatch.POSTAL || bestMatch.POSTALCODE
      ].filter(Boolean);
      
      if (addressParts.length) {
        address = addressParts.join(' ') + ', SINGAPORE';
      }
    }
    
    // Method 3: Use the search value as fallback with "Singapore" appended
    if (!address && bestMatch.SEARCHVAL) {
      address = bestMatch.SEARCHVAL + ', SINGAPORE';
    }

    if (!lat || !lng) {
      console.warn('No coordinates found in search result for', storeName);
      return null;
    }

    // Method 4: If still no address, try reverse geocoding the found coordinates
    if (!address || address === 'Address not found') {
      console.log(`No address from search, trying reverse geocoding for coordinates: ${lat}, ${lng}`);
      const reverseGeocodedAddress = await reverseGeocode(lat, lng);
      if (reverseGeocodedAddress) {
        address = reverseGeocodedAddress;
        console.log(`Got address from reverse geocoding: "${address}"`);
      }
    }

    console.log(`Final extracted address for ${storeName}: "${address}"`);

    return {
      lat: parseFloat(lat).toFixed(6),
      lng: parseFloat(lng).toFixed(6),
      address: address || 'Address not found'
    };

  } catch (err) {
    console.warn(`OneMap search failed for "${storeName}":`, err);
    return null;
  }
}

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in kilometers
}
// ----------- Dictionary + spell-correction setup -----------
let englishWords = [];
async function loadDictionary() {
  try {
    const res = await fetch('https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt');
    const text = await res.text();
    englishWords = text.split('\n');
    console.log(`Dictionary loaded: ${englishWords.length} words`);
  } catch (err) {
    console.warn('Failed to load dictionary – spell correction disabled', err);
  }
}

loadDictionary();
// --- ChatGPT integration ---

function setOpenAIApiKey(key) {
  openaiApiKey = key;
  openaiClient = null; // reset so fresh client picks up new key
  if (key) {
    localStorage.setItem('openaiApiKey', key);
  } else {
    localStorage.removeItem('openaiApiKey');
  }
}

function setOneMapApiKey(key) {
  oneMapApiKey = key;
  if (key) {
    localStorage.setItem('oneMapApiKey', key);
  } else {
    localStorage.removeItem('oneMapApiKey');
  }
}

async function extractInfoGPT(rawText) {
  if (!openaiApiKey) return null;
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + openaiApiKey
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        temperature: 0,
        messages: [
          { role: 'system', content: 'You extract structured data from storefront OCR.' },
          { role: 'user', content: `Extract JSON with keys: storeName, unitNumber, address, businessType. Use "Not Found" if unknown. OCR: """${rawText}"""` }
        ]
      })
    });
    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content || '';
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch (err) {
    console.warn('ChatGPT parsing failed', err);
    return null;
  }
}

// Prompt user to set API key if not already stored
if (!openaiApiKey) {
  setTimeout(() => {
    if (confirm('Enter your OpenAI API key to enable ChatGPT parsing?')) {
      const key = prompt('OpenAI API key (sk-...)');
      if (key) setOpenAIApiKey(key.trim());
    }
  }, 500);
}

// OneMap API key is optional - the app works fine with public endpoints
// Uncomment below if you want to be prompted for OneMap API key
/*
if (!oneMapApiKey) {
  setTimeout(() => {
    if (confirm('Enter your OneMap API key for authenticated endpoints?\n(Optional - app works fine without it)')) {
      const key = prompt('OneMap API token');
      if (key) setOneMapApiKey(key.trim());
    }
  }, 1000);
}
*/

function correctStoreName(name) {
  if (!name || !englishWords.length || typeof didYouMean !== 'function') return name;

  // Break by whitespace / punctuation while preserving words
  const tokens = name.split(/(\s+)/); // keep spaces as tokens
  const corrected = tokens.map(tok => {
    if (/^\s+$/.test(tok)) return tok; // keep spaces
    const suggestion = didYouMean(tok.toLowerCase(), englishWords, { threshold: 0.4 });
    return suggestion ? capitalize(suggestion) : tok;
  });
  return corrected.join('');
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

async function initCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    });
    video.srcObject = stream;
  } catch (err) {
    console.error(err);
    statusDiv.textContent = 'Camera access denied: ' + err.message;
  }
}

initCamera();

// --- Helper: run OCR + processing on any canvas source (camera or uploaded) ---
async function performScanFromCanvas(canvas) {
  statusDiv.textContent = 'Scanning…';
  progressBar.style.display = 'block';
  progressFill.style.width = '0%';

  const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);

  // Try Vision JSON extraction first
  let parsed = null;
  if (openaiApiKey) {
    statusDiv.textContent = 'Analyzing with GPT-4o…';
    parsed = await extractInfoVision(imageDataUrl);
    if (parsed) {
      console.log('Vision JSON:', parsed);
    }
  }

  let geo = currentLocation;
  if (!geo.lat) {
    geo = await getCurrentLocation();
  }

  if (!parsed) {
    // Vision failed → run OCR fallback
    const result = await Tesseract.recognize(canvas, 'eng', {
      logger: m => {
        if (m.progress !== undefined) {
          const percent = Math.floor(m.progress * 100);
          statusDiv.textContent = `Scanning… ${percent}%`;
          progressFill.style.width = percent + '%';
        }
      },
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:#&-.',
      tessedit_pageseg_mode: 6
    });

    const { text, confidence, lines } = result.data;
    console.log('OCR confidence', confidence);

    statusDiv.textContent = 'Processing…';

    parsed = await extractInfoGPT(text);
    if (!parsed) parsed = extractInfo(text, lines);
  }

  // Map extracted business type to canonical category (applies to Vision or OCR)
  if (parsed && parsed.businessType) {
    parsed.businessType = await mapToCompanyCategory(parsed.businessType);
  }

  // Try to search for the store location using OneMap API
  let storeLocation = null;
  if (parsed && parsed.storeName && parsed.storeName !== 'Not Found') {
    statusDiv.textContent = 'Finding store location…';
    storeLocation = await searchStoreLocation(parsed.storeName, geo.lat, geo.lng);
  }

  // Use store location if found, otherwise fallback to current device location
  let finalLat, finalLng, address;
  if (storeLocation) {
    finalLat = storeLocation.lat;
    finalLng = storeLocation.lng;
    address = storeLocation.address;
    console.log(`Found store location: ${parsed.storeName} at ${finalLat}, ${finalLng}`);
  } else {
    // Fallback to device location and reverse geocode
    finalLat = geo.lat || 'Not Found';
    finalLng = geo.lng || 'Not Found';
    
    if (geo.lat && geo.lng) {
      address = await reverseGeocode(geo.lat, geo.lng);
    }
    
    if (!address) {
      address = parsed.address || 'Not Found';
    }
  }

  const info = Object.assign(
    { lat: finalLat, lng: finalLng, address: address },
    parsed
  );
  scans.push(info);
  saveScans();
  renderTable();
  statusDiv.textContent = '';
  progressBar.style.display = 'none';
}

// Scan button handler
document.getElementById('scanBtn').addEventListener('click', async () => {
  if (!video.videoWidth) {
    statusDiv.textContent = 'Camera not ready yet, please wait…';
    return;
  }

  statusDiv.textContent = 'Scanning…';
  progressBar.style.display = 'block';
  progressFill.style.width = '0%';

  // Capture current frame
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  await performScanFromCanvas(canvas);
});

// Upload image handler
if (uploadBtn && imageInput) {
  uploadBtn.addEventListener('click', () => imageInput.click());

  imageInput.addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      await performScanFromCanvas(canvas);
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
    imageInput.value = '';
  });
}

// Extract structured information from raw OCR text
function extractInfo(rawText, ocrLines = []) {
  // Normalise whitespace
  const text = rawText.replace(/\n+/g, '\n').trim();
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // ----- Patterns based on rules provided -----
  // Pick store name using multiple heuristics
  let storeName = '';
  if (ocrLines.length) {
    // Step 1: Filter lines with mostly letters (reduce gibberish)
    const letterLines = ocrLines.filter(l => {
      const txt = l.text.trim();
      const letters = txt.replace(/[^A-Za-z]/g, '');
      const ratio = letters.length / (txt.length || 1);
      return letters.length >= 3 && ratio > 0.6; // at least 60% letters
    });

    // Step 2: Choose line with highest confidence ( then longest length )
    letterLines.sort((a, b) => (b.confidence || b.conf || 0) - (a.confidence || a.conf || 0));
    if (letterLines.length) {
      storeName = letterLines[0].text.trim();
    }
  }

  // 2) Fallback: first line that is mostly uppercase (e.g., "SCAN ME")
  if (!storeName) {
    const upperCandidate = lines.find(l => {
      const letters = l.replace(/[^A-Za-z]/g, '');
      return letters.length >= 3 && letters === letters.toUpperCase();
    });
    if (upperCandidate) storeName = upperCandidate;
  }

  // 3) Ultimate fallback: first line
  if (!storeName) storeName = lines[0] || '';

  storeName = correctStoreName(storeName);

  // Unit number must be in the form #XX-XXX
  const unitMatch = text.match(/#\d{2}-\d{3}/);
  let unitNumber = unitMatch ? unitMatch[0] : '';

  // Singapore phone number: 65 XXXX XXXX, with optional '+' and optional spaces
  const phoneMatch = text.match(/\+?65\s?\d{4}\s?\d{4}/);
  let phone = phoneMatch ? phoneMatch[0] : '';
  if (phone) {
    phone = phone.replace(/\s+/g, ' '); // normalise spacing
  }

  // Website: detect domain like example.com (with or without protocol)
  const websiteMatch = text.match(/(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  let website = websiteMatch ? websiteMatch[0].replace(/^[^A-Za-z]+/, '') : '';

  // Opening hours: XX:XX - XX:XX (24-hour) with optional spaces
  const openingHoursMatch = text.match(/(?:[01]?\d|2[0-3]):[0-5]\d\s*[-–]\s*(?:[01]?\d|2[0-3]):[0-5]\d/);
  let openingHours = openingHoursMatch ? openingHoursMatch[0].replace(/\s+/g, ' ') : '';

  // Guess business category based on keywords
  const categories = {
    'restaurant|cafe|café|bakery|food': 'F&B',
    'salon|spa|hair|beauty|nail': 'Beauty',
    'clinic|medical|dental|pharmacy': 'Healthcare',
    'book|stationery|gift|toy': 'Retail',
    'gym|fitness|yoga': 'Fitness'
  };

  let businessType = 'Unknown';
  for (const pattern in categories) {
    if (new RegExp(pattern, 'i').test(text)) {
      businessType = categories[pattern];
      break;
    }
  }

  // Use "Not Found" when a field could not be extracted to match strict rules
  if (!storeName) storeName = 'Not Found';
  if (!unitNumber) unitNumber = 'Not Found';
  if (!openingHours) openingHours = 'Not Found'; // kept for future reference
  if (!phone) phone = 'Not Found';              // kept for future reference
  if (!website) website = 'Not Found';          // kept for future reference

  // Placeholder – address extraction will be implemented later or via geocoding
  let address = '';

  if (!address) address = 'Not Found';

  return {
    storeName,
    unitNumber,
    address,
    businessType,
    rawText: text
  };
}

// --- Company category mapping ---
let companyCategories = [];

async function loadCompanyCategories() {
  if (companyCategories.length) return companyCategories;
  try {
    // First try pre-generated JSON (faster)
    const jsonRes = await fetch('categories.json');
    if (jsonRes.ok) {
      companyCategories = (await jsonRes.json()).map(cat => ({
        key: cat.key,
        name: (cat.name || '').toLowerCase(),
        last: (cat.key.split('::').filter(Boolean).pop() || '').toLowerCase()
      }));
      console.log(`Loaded ${companyCategories.length} categories from JSON`);
      return companyCategories;
    }
  } catch (_) {
    /* fallthrough to CSV */
  }

  try {
    // Fallback to CSV shipped alongside the app if JSON unavailable
    const csvPath = encodeURI('Geo Places - Final POI Category Tree - Q2 2024 - 2. Category Tree.csv');
    const res = await fetch(csvPath);
    const csvText = await res.text();
    const lines = csvText.split(/\r?\n/);
    lines.shift(); // drop header
    const splitter = /,(?=(?:[^"]*\"[^"]*\")*[^\"]*$)/;
    for (const line of lines) {
      if (!line.trim()) continue;
      const cols = line.split(splitter);
      const name = (cols[3] || '').replace(/^"|"$/g, '').trim();
      const keyRaw = (cols[5] || '').replace(/^"|"$/g, '').trim();
      if (!keyRaw) continue;
      const key = keyRaw.replace(/:+$/, '');
      const lastSegment = key.split('::').filter(Boolean).pop() || '';
      companyCategories.push({ key, name: name.toLowerCase(), last: lastSegment.toLowerCase() });
    }
    console.log(`Parsed ${companyCategories.length} categories from CSV`);
  } catch (err) {
    console.warn('Failed to load categories from CSV', err);
  }
  return companyCategories;
}

async function mapToCompanyCategory(freeText = '') {
  if (!freeText || freeText === 'Unknown' || freeText === 'Not Found') return freeText;
  const txt = freeText.toLowerCase().trim();
  await loadCompanyCategories();
  if (!companyCategories.length) return freeText;

  // Exact match against name or last segment
  let match = companyCategories.find(cat => cat.name === txt || cat.last === txt);
  if (match) return match.key;

  // Sub-string containment
  match = companyCategories.find(cat => txt.includes(cat.name) || cat.name.includes(txt) || txt.includes(cat.last));
  return match ? match.key : freeText;
} 
