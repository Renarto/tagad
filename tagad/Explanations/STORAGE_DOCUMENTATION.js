// 📚 CHROME STORAGE SYSTEM DOCUMENTATION
// Complete Guide to the Fake News Detector Extension Storage Implementation
//lll
/*
================================================================================
                        STORAGE ARCHITECTURE OVERVIEW
================================================================================

The extension uses THREE different storage mechanisms:

1. chrome.storage.local
   ├── Persistent storage on the local machine
   ├── Shared across all browser windows/tabs
   ├── NOT synced across devices
   └── Contains: clickbaitWords, trustedDomains, stopWords

2. chrome.storage.sync
   ├── Synced to user's Google account
   ├── Available on all devices where user is signed in
   ├── Limited quota (~100KB)
   └── Contains: userApprovedDomains

3. storage-manager.js (Content Script)
   ├── Provides async API for accessing storage from content scripts
   ├── Converts callbacks to Promises for easier use
   └── Automatically initializes storage on extension load

================================================================================
                            FILE STRUCTURE
================================================================================

┌─ manifest.json
│  └─ Defines all permissions and scripts
│
├─ storage-manager.js (CONTENT SCRIPT - MUST LOAD FIRST)
│  └─ Provides StorageManager.* functions for content scripts
│  └─ Initializes chrome.storage with default data
│
├─ background.js (SERVICE WORKER)
│  └─ Handles chrome.runtime.onMessage for popup and content scripts
│  └─ Bridges storage access for popups
│  └─ Initializes storage on extension install
│
├─ clickbait-words.js (CONTENT SCRIPT)
│  └─ Uses StorageManager.getClickbaitWords()
│  └─ Loads from chrome.storage.local on startup
│  └─ getClickbaitRegex() uses current in-memory CLICKBAIT_WORDS
│
├─ trusted-domains.js (CONTENT SCRIPT)
│  └─ Uses StorageManager.getTrustedDomains()
│  └─ Uses StorageManager.isUserApprovedDomain()
│  └─ Loads from both local and sync storage
│
├─ misleading-content.js (CONTENT SCRIPT)
│  └─ Uses StorageManager.getStopWords()
│  └─ Loads from chrome.storage.local on startup
│  └─ extractKeywords() uses stopWords from storage
│
└─ popup.js / popup.html
   └─ Uses chrome.runtime.sendMessage() to communicate with background.js
   └─ Background.js bridges to storage functions
   └─ Displays and manages storage data

================================================================================
                        USAGE PATTERNS
================================================================================

PATTERN 1: Content Script (clickbait-words.js, trusted-domains.js, etc.)
─────────────────────────────────────────────────────────────────────────

// Load data from storage once
async function initializeFromStorage() {
  try {
    const words = await window.StorageManager.getClickbaitWords();
    CLICKBAIT_WORDS = words;
  } catch (error) {
    console.warn('Failed to load, using defaults:', error);
  }
}

// Update storage
async function addWord(word) {
  await window.StorageManager.addClickbaitWord(word);
}

// Use in-memory cache for performance
function analyzeHeadline(headline) {
  const regex = getClickbaitRegex(); // Uses current CLICKBAIT_WORDS
  return regex.test(headline);
}


PATTERN 2: Popup Script
──────────────────────

// Send message to background.js to access storage
chrome.runtime.sendMessage(
  { action: 'getClickbaitWords' },
  (response) => {
    if (response.success) {
      console.log('Words:', response.words);
    }
  }
);

// Or use async/await style
async function getWords() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: 'getClickbaitWords' },
      (response) => resolve(response.success ? response.words : [])
    );
  });
}


PATTERN 3: Cross-Script Communication
──────────────────────────────────────

Content Script → Storage Manager → chrome.storage.local
                             ↓
Popup Script → Background.js → chrome.storage.*
                          ↓
              Message Handler → Returns data to popup


================================================================================
                        STORAGE KEYS & SCHEMA
================================================================================

chrome.storage.local:
{
  "clickbaitWords": [
    "SHOCKING",
    "BREAKING",
    ...
  ],
  "trustedDomains": [
    "bbc.com",
    "nytimes.com",
    ...
  ],
  "stopWords": [
    "the",
    "a",
    ...
  ]
}

chrome.storage.sync:
{
  "userApprovedDomains": [
    {
      "domain": "example.com",
      "approvedAt": "2024-01-15T10:30:00.000Z",
      "reason": "User manually approved",  // optional
      "updatedAt": "2024-01-15T10:30:00.000Z"  // if updated
    },
    ...
  ]
}

================================================================================
                        API REFERENCE
================================================================================

StorageManager (available in content scripts as window.StorageManager):
─────────────────────────────────────────────────────────────────────

CLICKBAIT WORDS:
  getClickbaitWords()          → Promise<Array>
  addClickbaitWord(word)       → Promise<Array>
  removeClickbaitWord(word)    → Promise<Array>

TRUSTED DOMAINS (LOCAL):
  getTrustedDomains()          → Promise<Array>
  addTrustedDomain(domain)     → Promise<Array>
  removeTrustedDomain(domain)  → Promise<Array>

STOPWORDS:
  getStopWords()               → Promise<Set>
  addStopWord(word)            → Promise<Set>

USER-APPROVED DOMAINS (SYNC):
  getUserApprovedDomains()     → Promise<Array>
  approveUserDomain(domain, metadata)  → Promise<Array>
  removeApprovedDomain(domain) → Promise<Array>
  isUserApprovedDomain(domain) → Promise<Boolean>

UTILITY:
  clearLocalStorage()          → Promise<void>
  clearSyncStorage()           → Promise<void>
  getAllStorageData()          → Promise<{local, sync}>
  initializeLocalStorage()     → void
  initializeSyncStorage()      → void


Background.js Message Actions (for popup communication):
──────────────────────────────────────────────────────

Send via: chrome.runtime.sendMessage({ action: 'ACTION_NAME', ... })

CLICKBAIT:
  'getClickbaitWords'          → { success, words }
  'addClickbaitWord'           → { success }
  'removeClickbaitWord'        → { success }

TRUSTED DOMAINS:
  'getTrustedDomains'          → { success, domains }
  'addTrustedDomain'           → { success }
  'removeTrustedDomain'        → { success }

STOPWORDS:
  'getStopWords'               → { success, words }
  'addStopWord'                → { success }

USER-APPROVED (SYNC):
  'getUserApprovedDomains'     → { success, domains }
  'approveUserDomain'          → { success }
  'removeApprovedDomain'       → { success }
  'isUserApprovedDomain'       → { success, isApproved }

COMBINED CHECKS:
  'isTrustedDomain'            → { success, isTrusted }

UTILITY:
  'getAllStorageData'          → { success, data }

================================================================================
                        EXAMPLES
================================================================================

EXAMPLE 1: Initialize clickbait detection from storage
─────────────────────────────────────────────────────

// In clickbait-words.js
let CLICKBAIT_WORDS = DEFAULT_CLICKBAIT_WORDS;

async function loadFromStorage() {
  try {
    CLICKBAIT_WORDS = await window.StorageManager.getClickbaitWords();
  } catch (e) {
    console.warn('Using defaults:', e);
  }
}

document.addEventListener('DOMContentLoaded', loadFromStorage);


EXAMPLE 2: Check if domain is trusted (local + user-approved)
────────────────────────────────────────────────────────────

async function checkTrustLevel(domain) {
  const isBuiltinTrusted = await window.StorageManager
    .getTrustedDomains()
    .then(d => d.some(t => domain.includes(t)));
  
  const isUserApproved = await window.StorageManager
    .isUserApprovedDomain(domain);
  
  return {
    isBuiltinTrusted,
    isUserApproved,
    isTrusted: isBuiltinTrusted || isUserApproved
  };
}


EXAMPLE 3: Popup - Display and manage trusted domains
────────────────────────────────────────────────────

// popup.js
async function displayDomains() {
  const result = await new Promise(resolve => {
    chrome.runtime.sendMessage(
      { action: 'getTrustedDomains' },
      resolve
    );
  });
  
  if (result.success) {
    document.getElementById('list').innerHTML = result.domains
      .map(d => `<li>${d}</li>`)
      .join('');
  }
}

async function addDomain() {
  const domain = document.getElementById('input').value;
  const result = await new Promise(resolve => {
    chrome.runtime.sendMessage(
      { action: 'addTrustedDomain', domain: domain },
      resolve
    );
  });
  
  if (result.success) {
    displayDomains(); // Refresh list
  }
}


EXAMPLE 4: User approves a domain (synced across devices)
─────────────────────────────────────────────────────────

// In content.js or popup.js
async function userApproveDomain(domain) {
  const result = await new Promise(resolve => {
    chrome.runtime.sendMessage({
      action: 'approveUserDomain',
      domain: domain,
      metadata: {
        reason: 'User trusted this source',
        firstVisit: new Date().toISOString()
      }
    }, resolve);
  });
  
  if (result.success) {
    console.log('✅ Domain approved and synced to all devices');
  }
}

================================================================================
                        MIGRATION GUIDE (OLD → NEW)
================================================================================

OLD CODE:
─────────
const CLICKBAIT_WORDS = [ "SHOCKING", "BREAKING", ... ];

NEW CODE:
────────
const DEFAULT_CLICKBAIT_WORDS = [ "SHOCKING", "BREAKING", ... ];
let CLICKBAIT_WORDS = DEFAULT_CLICKBAIT_WORDS;

async function loadFromStorage() {
  try {
    CLICKBAIT_WORDS = await window.StorageManager.getClickbaitWords();
  } catch (e) {
    console.warn('Using defaults:', e);
  }
}

// Call on initialization
document.addEventListener('DOMContentLoaded', loadFromStorage);


================================================================================
                        DEBUGGING TIPS
================================================================================

1. Check current storage state:
   chrome.runtime.sendMessage(
     { action: 'getAllStorageData' },
     (response) => console.log(response.data)
   );

2. Clear all data:
   chrome.runtime.sendMessage(
     { action: 'clearAll' },
     () => console.log('Storage cleared')
   );

3. Monitor storage changes:
   chrome.storage.local.onChanged.addListener((changes, areaName) => {
     console.log('Changes in', areaName, changes);
   });

4. View extension storage in DevTools:
   - Open DevTools (F12)
   - Application/Storage tab
   - Look for chrome-extension://[ID]/
   - View local and sync storage

================================================================================
                        PERFORMANCE CONSIDERATIONS
================================================================================

1. Cache data in memory for performance:
   - Load once on script initialization
   - Use in-memory copy for detection functions
   - Only update storage when user changes settings

2. Batch storage updates:
   - Don't update storage on every analysis
   - Store user changes, not analysis results

3. Async/await for better readability:
   - Use async functions for storage operations
   - Wrap callbacks in Promises when needed
   - Error handling is cleaner

4. Storage quotas:
   - chrome.storage.local: ~10MB per extension
   - chrome.storage.sync: ~100KB per extension
   - Our data fits easily within these limits

================================================================================
                        TROUBLESHOOTING
================================================================================

PROBLEM: "StorageManager is undefined"
SOLUTION: Ensure storage-manager.js loads FIRST in manifest.json

PROBLEM: Data not persisting
SOLUTION: Check manifest.json has "storage" permission

PROBLEM: Changes not syncing to other devices
SOLUTION: Use chrome.storage.sync (userApprovedDomains)
          Local storage won't sync automatically

PROBLEM: Functions timing out
SOLUTION: Use await syntax, ensure chrome.storage is available

================================================================================
*/
