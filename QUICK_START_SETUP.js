// 🚀 CHROME STORAGE INTEGRATION - QUICK START GUIDE

/*
================================================================================
                          WHAT WAS CREATED
================================================================================

✅ storage-manager.js
   - Provides StorageManager object for content scripts
   - Manages all chrome.storage operations
   - Auto-initializes with default data
   - All functions return Promises for async/await support

✅ background.js
   - Service worker for Chrome extension (Manifest V3)
   - Handles chrome.runtime.onMessage for popup communication
   - Initializes storage on extension install
   - Provides all storage functions

✅ storage-integration.js
   - Example integration code for popup.js
   - Shows how to communicate with background.js
   - Includes helper functions for common operations

✅ Updated Files:
   - manifest.json         → Added background service worker, storage-manager.js first
   - clickbait-words.js    → Now loads from chrome.storage.local
   - trusted-domains.js    → Now loads from chrome.storage.local + sync
   - misleading-content.js → Now loads stopwords from chrome.storage.local

✅ STORAGE_DOCUMENTATION.js
   - Complete reference guide (this file)
   - API documentation
   - Usage patterns and examples

================================================================================
                      INTEGRATION STEPS
================================================================================

STEP 1: Verify manifest.json has all required pieces
────────────────────────────────────────────────────

✓ "permissions": ["activeTab", "scripting", "tabs", "storage"]
✓ "background": { "service_worker": "background.js" }
✓ "content_scripts": first script is "storage-manager.js"
✓ All other scripts listed in correct order

STEP 2: Add files to your extension folder
───────────────────────────────────────────

Required files:
  - storage-manager.js ✓
  - background.js ✓
  - manifest.json (updated) ✓

Updated files:
  - clickbait-words.js ✓
  - trusted-domains.js ✓
  - misleading-content.js ✓

Optional (for popup):
  - storage-integration.js (helper functions)

STEP 3: Update popup.html (if you have a settings page)
─────────────────────────────────────────────────────

Example popup.html structure:

<html>
<head>
  <title>Settings</title>
  <style>
    body { font-family: Arial; padding: 20px; }
    button { padding: 8px 15px; background: #007bff; color: white; border: none; cursor: pointer; }
    .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
    ul { list-style: none; padding: 0; }
    li { padding: 8px; background: #f5f5f5; margin: 5px 0; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <h1>🛡️ Fake News Detector Settings</h1>
  
  <div class="section">
    <h2>Trusted Domains</h2>
    <ul id="trustedDomainsList"></ul>
    <input type="text" id="newDomain" placeholder="Enter domain">
    <button onclick="addNewDomain()">Add</button>
  </div>
  
  <div class="section">
    <h2>User-Approved Domains (Synced)</h2>
    <ul id="approvedDomainsList"></ul>
  </div>
  
  <script src="popup.js"></script>
</body>
</html>


STEP 4: Create/Update popup.js
──────────────────────────────

// popup.js - Simple example

async function displayTrustedDomains() {
  const domains = await sendMessage({
    action: 'getTrustedDomains'
  });
  
  const list = document.getElementById('trustedDomainsList');
  list.innerHTML = domains.map(d => `
    <li>
      <span>${d}</span>
      <button onclick="removeDomain('${d}')">Remove</button>
    </li>
  `).join('');
}

async function addNewDomain() {
  const domain = document.getElementById('newDomain').value;
  if (!domain) return;
  
  await sendMessage({
    action: 'addTrustedDomain',
    domain: domain
  });
  
  document.getElementById('newDomain').value = '';
  displayTrustedDomains();
}

async function removeDomain(domain) {
  await sendMessage({
    action: 'removeTrustedDomain',
    domain: domain
  });
  displayTrustedDomains();
}

// Helper function to send messages to background.js
function sendMessage(data) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(data, (response) => {
      resolve(response.success ? response.words || response.domains : []);
    });
  });
}

// Load on popup open
document.addEventListener('DOMContentLoaded', () => {
  displayTrustedDomains();
});


STEP 5: Test the implementation
───────────────────────────────

1. Go to chrome://extensions
2. Enable "Developer mode"
3. Click "Load unpacked" and select your extension folder
4. Check console for initialization messages:
   - "✅ Chrome local storage initialized with default data"
   - "✅ Chrome sync storage initialized for user-approved domains"
5. Click extension icon to open popup
6. Test adding/removing domains
7. Verify data persists after reload

================================================================================
                      WHAT HAPPENS AUTOMATICALLY
================================================================================

On Extension Load:
  1. storage-manager.js initializes first
  2. Loads clickbaitWords, trustedDomains, stopWords from local storage
  3. Falls back to defaults if not found
  4. Other content scripts load with access to StorageManager

On Extension Install:
  1. background.js runs onInstalled listener
  2. Initializes chrome.storage.local with defaults
  3. Initializes chrome.storage.sync with empty userApprovedDomains

When User Changes Settings:
  1. Popup sends message via chrome.runtime.sendMessage()
  2. background.js receives and updates storage
  3. Message sent back with success status
  4. Content scripts can load new data on next page

================================================================================
                      QUICK REFERENCE: COMMON TASKS
================================================================================

Get Clickbait Words (in content script):
──────────────────────────────────────
  const words = await window.StorageManager.getClickbaitWords();
  console.log(words); // Array of strings

Add Clickbait Word (in popup):
──────────────────
  chrome.runtime.sendMessage({
    action: 'addClickbaitWord',
    word: 'VIRAL'
  }, response => console.log(response.success));

Get Trusted Domains (in content script):
────────────────────────────────────────
  const domains = await window.StorageManager.getTrustedDomains();
  const isTrusted = domains.includes('bbc.com');

Check User-Approved (in content script):
────────────────────────────────────────
  const isApproved = await window.StorageManager.isUserApprovedDomain('mysite.com');

Approve a Domain (in popup):
────────────────────────────
  chrome.runtime.sendMessage({
    action: 'approveUserDomain',
    domain: 'example.com',
    metadata: { reason: 'User trusted this source' }
  }, response => console.log('Synced to all devices'));

Get Stopwords (in content script):
──────────────────────────────────
  const stopWords = await window.StorageManager.getStopWords();
  const isMeaningful = !stopWords.has('the');

Debug - View all storage:
─────────────────────────
  chrome.runtime.sendMessage(
    { action: 'getAllStorageData' },
    response => console.log(response.data)
  );

================================================================================
                      STORAGE QUOTAS & LIMITS
================================================================================

chrome.storage.local:
  - ~10MB per extension (plenty for our use case)
  - Not synced across devices
  - Persists when browser closes

chrome.storage.sync:
  - ~100KB per extension
  - Synced to all devices user is signed into
  - Great for user preferences

Our Current Usage (estimate):
  - clickbaitWords: ~2KB (50 phrases)
  - trustedDomains: ~500 bytes (25 domains)
  - stopWords: ~500 bytes
  - userApprovedDomains: ~1KB (100 domains × ~10 bytes each)
  
Total: Well under limits ✓

================================================================================
                      NEXT STEPS
================================================================================

1. Test the extension with the provided code
2. Create a settings popup to manage storage
3. Add UI to show domain trust status
4. Implement "Trust This Source" button in popup
5. Create analytics to track what users approve/reject
6. Add export/import functionality for domain lists

================================================================================
                      TROUBLESHOOTING CHECKLIST
================================================================================

□ Does manifest.json list "storage" in permissions?
□ Is "storage-manager.js" the FIRST content script?
□ Is "background.js" referenced as service_worker?
□ Can you see messages in DevTools console on page load?
□ Are functions returning Promises when called?
□ Did you test with chrome://extensions?
□ Check Application > Storage in DevTools?
□ Are you using chrome.runtime.sendMessage from popup?
□ Are you using window.StorageManager from content scripts?

================================================================================
                      FILE DEPENDENCIES
================================================================================

manifest.json
  ↓
storage-manager.js (Content Script - FIRST)
  ↓
clickbait-words.js, trusted-domains.js, misleading-content.js
  (These load data from StorageManager)
  ↓
background.js (Service Worker)
  (Handles messages from popup)
  ↓
popup.js/popup.html
  (Sends messages to background.js)

================================================================================
*/
