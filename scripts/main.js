
document.addEventListener('DOMContentLoaded', async () => {
  
  ensurePagesInBody();
  
  initTitlebar();
  initNavigation();
  initFooterLinks();
  initThemeSettings();
  
  const isLoggedIn = await checkLoginState();
  
  if (isLoggedIn) {
    navigateTo('myroblox');
  } else {
    loadHomePage();
  }
});

const THEME_STORAGE_KEY = 'rovloo_theme';
const CONDITIONAL_THEMES_KEY = 'rovloo_conditional_themes';
const CONDITIONAL_THEMES_PREFERENCE_KEY = 'rovloo_conditional_themes_preference'; 
const RANDOMIZE_BC_KEY = 'rovloo_randomize_bc';

function initThemeSettings() {
  
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'roblox-2.0';
  applyTheme(savedTheme);

  const themeRadio = document.querySelector(`input[name="theme"][value="${savedTheme}"]`);
  if (themeRadio) {
    themeRadio.checked = true;
  }

  document.querySelectorAll('input[name="theme"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const newTheme = e.target.value;
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      applyTheme(newTheme);

      updateConditionalThemesToggle();
    });
  });

  initConditionalThemesToggle();

  initRandomizeBCToggle();

  initGpuAccelerationToggle();
}

function initConditionalThemesToggle() {
  const toggle = document.getElementById('conditional-themes-toggle');
  if (!toggle) return;

  const enabled = localStorage.getItem(CONDITIONAL_THEMES_KEY) !== 'false';
  toggle.checked = enabled;

  toggle.addEventListener('change', () => {
    const newValue = toggle.checked;
    localStorage.setItem(CONDITIONAL_THEMES_KEY, newValue ? 'true' : 'false');

    if (!toggle.disabled) {
      localStorage.setItem(CONDITIONAL_THEMES_PREFERENCE_KEY, newValue ? 'true' : 'false');
    }

    if (!newValue && !isOutrageousThemeSelected()) {
      document.body.classList.remove('obc-theme');
    }
  });

  updateConditionalThemesToggle();
}

function updateConditionalThemesToggle() {
  const toggle = document.getElementById('conditional-themes-toggle');
  const label = toggle?.closest('label');
  
  if (!toggle || !label) return;

  const isAlternateTheme = isAlternateThemeSelected();
  
  if (isAlternateTheme) {
    
    toggle.disabled = true;
    toggle.checked = false; 
    label.style.opacity = '0.5';
    label.style.cursor = 'not-allowed';
    label.title = 'Conditional theme overrides are not available when using Outrageous or Rovloo themes';

    localStorage.setItem(CONDITIONAL_THEMES_KEY, 'false');
  } else {
    
    toggle.disabled = false;
    label.style.opacity = '1';
    label.style.cursor = 'pointer';
    label.title = '';

    const userPreference = localStorage.getItem(CONDITIONAL_THEMES_PREFERENCE_KEY);
    const shouldEnable = userPreference !== null ? userPreference === 'true' : true;
    
    toggle.checked = shouldEnable;
    localStorage.setItem(CONDITIONAL_THEMES_KEY, shouldEnable ? 'true' : 'false');
  }
}

function areConditionalThemesEnabled() {
  return localStorage.getItem(CONDITIONAL_THEMES_KEY) !== 'false';
}

window.areConditionalThemesEnabled = areConditionalThemesEnabled;

function initRandomizeBCToggle() {
  const toggle = document.getElementById('randomize-bc-toggle');
  if (!toggle) return;

  const enabled = localStorage.getItem(RANDOMIZE_BC_KEY) === 'true';
  toggle.checked = enabled;

  toggle.addEventListener('change', () => {
    localStorage.setItem(RANDOMIZE_BC_KEY, toggle.checked ? 'true' : 'false');
  });
}

function isRandomizeBCEnabled() {
  return localStorage.getItem(RANDOMIZE_BC_KEY) === 'true';
}

window.isRandomizeBCEnabled = isRandomizeBCEnabled;

function getBCTypeForUser(userId) {
  const id = parseInt(userId, 10);
  if (isNaN(id)) return 'OBC'; 

  let hash = id;
  hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
  hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
  hash = (hash >> 16) ^ hash;

  const bucket = Math.abs(hash) % 3;
  
  switch (bucket) {
    case 0: return 'BC';
    case 1: return 'TBC';
    case 2: return 'OBC';
    default: return 'OBC';
  }
}

window.getBCTypeForUser = getBCTypeForUser;

function getBCOverlayImage(bcType) {
  switch (bcType) {
    case 'BC': return 'images/icons/overlay_bcOnly.png';
    case 'TBC': return 'images/icons/overlay_tbcOnly.png';
    case 'OBC': 
    default: return 'images/icons/overlay_obcOnly.png';
  }
}

window.getBCOverlayImage = getBCOverlayImage;

function applyConditionalRovlooTheme() {
  if (areConditionalThemesEnabled() && !isAlternateThemeSelected()) {
    document.body.classList.remove('halloween-theme', 'thanksgiving-theme', 'christmas-theme', 'obc-theme');
    document.body.classList.add('rovloo-theme');
  }
}

function removeConditionalRovlooTheme() {
  if (!isRovlooThemeSelected()) {
    document.body.classList.remove('rovloo-theme');
    
    const currentTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'roblox-2.0';
    if (currentTheme === 'roblox-2.0' && areConditionalThemesEnabled()) {
      const seasonalTheme = getCurrentSeasonalTheme();
      if (seasonalTheme) {
        document.body.classList.add(seasonalTheme);
      }
    }
  }
}

window.applyConditionalRovlooTheme = applyConditionalRovlooTheme;
window.removeConditionalRovlooTheme = removeConditionalRovlooTheme;

async function initGpuAccelerationToggle() {
  const toggle = document.getElementById('gpu-acceleration-toggle');
  const restartNotice = document.getElementById('gpu-restart-notice');
  if (!toggle) return;

  try {
    if (window.RobloxClient?.settings?.getGpuAcceleration) {
      const enabled = await window.RobloxClient.settings.getGpuAcceleration();
      toggle.checked = enabled;
    } else {
      
      toggle.checked = true;
    }
  } catch (e) {
    console.warn('Failed to load GPU acceleration setting:', e);
    toggle.checked = true;
  }

  toggle.addEventListener('change', async () => {
    try {
      if (window.RobloxClient?.settings?.setGpuAcceleration) {
        const result = await window.RobloxClient.settings.setGpuAcceleration(toggle.checked);
        if (result?.requiresRestart && restartNotice) {
          restartNotice.style.display = 'block';
        }
      }
    } catch (e) {
      console.error('Failed to save GPU acceleration setting:', e);
    }
  });
}

function applyTheme(themeName) {
  
  document.body.classList.remove('obc-theme', 'rovloo-theme', 'halloween-theme', 'thanksgiving-theme', 'christmas-theme');

  if (themeName === 'outrageous-2.0') {
    document.body.classList.add('obc-theme');
  } else if (themeName === 'rovloo') {
    document.body.classList.add('rovloo-theme');
  } else if (themeName === 'halloween') {
    document.body.classList.add('halloween-theme');
  } else if (themeName === 'thanksgiving') {
    document.body.classList.add('thanksgiving-theme');
  } else if (themeName === 'christmas') {
    document.body.classList.add('christmas-theme');
  } else if (themeName === 'roblox-2.0') {
    
    if (areConditionalThemesEnabled()) {
      const seasonalTheme = getCurrentSeasonalTheme();
      if (seasonalTheme) {
        document.body.classList.add(seasonalTheme);
      }
    }
  }
}

function getCurrentSeasonalTheme() {
  const now = new Date();
  const month = now.getMonth(); 
  const day = now.getDate();

  if (month === 9 && day >= 22 && day <= 31) {
    return 'halloween-theme';
  }

  if ((month === 10 && day >= 22) || (month === 11 && day === 1)) {
    return 'thanksgiving-theme';
  }

  if ((month === 11 && day >= 14) || (month === 0 && day === 1)) {
    return 'christmas-theme';
  }

  return null;
}

window.getCurrentSeasonalTheme = getCurrentSeasonalTheme;

function isOutrageousThemeSelected() {
  return localStorage.getItem(THEME_STORAGE_KEY) === 'outrageous-2.0';
}

function isRovlooThemeSelected() {
  return localStorage.getItem(THEME_STORAGE_KEY) === 'rovloo';
}

function isHalloweenThemeSelected() {
  return localStorage.getItem(THEME_STORAGE_KEY) === 'halloween';
}

function isThanksgivingThemeSelected() {
  return localStorage.getItem(THEME_STORAGE_KEY) === 'thanksgiving';
}

function isChristmasThemeSelected() {
  return localStorage.getItem(THEME_STORAGE_KEY) === 'christmas';
}

function isAlternateThemeSelected() {
  const theme = localStorage.getItem(THEME_STORAGE_KEY);
  return theme === 'outrageous-2.0' || theme === 'rovloo' || theme === 'halloween' || theme === 'thanksgiving' || theme === 'christmas';
}

const PREMIUM_CACHE_TTL = 24 * 60 * 60 * 1000; 
const PREMIUM_CACHE_MAX_SIZE = 100; 
const PREMIUM_STORAGE_KEY = 'rovloo_premium_cache';
const PREMIUM_RATELIMIT_KEY = 'rovloo_premium_ratelimit';

function loadPremiumCache() {
  try {
    const stored = localStorage.getItem(PREMIUM_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const entries = [];
      const now = Date.now();
      
      Object.entries(parsed).forEach(([userId, data]) => {
        if (now - data.timestamp < PREMIUM_CACHE_TTL && data.value !== null) {
          entries.push([userId, data]);
        }
      });
      
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      const cache = new Map();
      entries.slice(0, PREMIUM_CACHE_MAX_SIZE).forEach(([k, v]) => cache.set(k, v));
      return cache;
    }
  } catch (e) {
    console.warn('Failed to load premium cache:', e);
  }
  return new Map();
}

function savePremiumCache() {
  try {
    
    const entries = Array.from(premiumStatusCache.entries());
    entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
    const obj = {};
    entries.slice(0, PREMIUM_CACHE_MAX_SIZE).forEach(([k, v]) => {
      obj[k] = v;
    });
    localStorage.setItem(PREMIUM_STORAGE_KEY, JSON.stringify(obj));
  } catch (e) {
    console.warn('Failed to save premium cache:', e);
  }
}

function loadRateLimitState() {
  try {
    const stored = localStorage.getItem(PREMIUM_RATELIMIT_KEY);
    if (stored) {
      const state = JSON.parse(stored);
      if (state.resetTime > Date.now()) {
        return state;
      }
    }
  } catch (e) {}
  return { isLimited: false, resetTime: 0, backoffMultiplier: 1 };
}

function saveRateLimitState() {
  try {
    localStorage.setItem(PREMIUM_RATELIMIT_KEY, JSON.stringify({
      isLimited: premiumRateLimited,
      resetTime: premiumRateLimitResetTime,
      backoffMultiplier: rateLimitBackoffMultiplier
    }));
  } catch (e) {}
}

const premiumStatusCache = loadPremiumCache();
window.premiumStatusCache = premiumStatusCache; 

let premiumRequestQueue = [];
let isProcessingQueue = false;
const PREMIUM_REQUEST_DELAY = 1000; 
const BASE_RATELIMIT_WAIT = 30000; 
const MAX_BACKOFF_MULTIPLIER = 8; 

const rateLimitState = loadRateLimitState();
let premiumRateLimited = rateLimitState.isLimited && rateLimitState.resetTime > Date.now();
let premiumRateLimitResetTime = rateLimitState.resetTime;
let rateLimitBackoffMultiplier = rateLimitState.backoffMultiplier;

function clearPremiumRateLimit() {
  premiumRateLimited = false;
  premiumRateLimitResetTime = 0;
  rateLimitBackoffMultiplier = 1;
  localStorage.removeItem(PREMIUM_RATELIMIT_KEY);
  console.log('Premium rate limit cleared');
}
window.clearPremiumRateLimit = clearPremiumRateLimit;

function isPremiumRateLimited() {
  if (premiumRateLimited && Date.now() < premiumRateLimitResetTime) {
    return true;
  }
  if (premiumRateLimited) {
    premiumRateLimited = false;
    
    rateLimitBackoffMultiplier = Math.max(1, rateLimitBackoffMultiplier / 2);
    saveRateLimitState();
  }
  return false;
}

function getRateLimitResetIn() {
  if (!isPremiumRateLimited()) return 0;
  return Math.max(0, premiumRateLimitResetTime - Date.now());
}
window.getPremiumRateLimitResetIn = getRateLimitResetIn; 

async function processPremiumQueue() {
  console.log(`processPremiumQueue called - isProcessing: ${isProcessingQueue}, queueLength: ${premiumRequestQueue.length}`);
  if (isProcessingQueue) return;
  if (premiumRequestQueue.length === 0) return;

  if (isPremiumRateLimited()) {
    const waitTime = getRateLimitResetIn();
    console.log(`Premium API rate limited, waiting ${Math.ceil(waitTime/1000)}s...`);
    setTimeout(processPremiumQueue, waitTime + 100);
    return;
  }
  
  isProcessingQueue = true;
  const { userId, resolve } = premiumRequestQueue.shift();
  console.log(`Processing premium request for userId: ${userId}`);

  const cached = premiumStatusCache.get(String(userId));
  if (cached && (Date.now() - cached.timestamp < PREMIUM_CACHE_TTL)) {
    isProcessingQueue = false;
    resolve(cached.value);
    if (premiumRequestQueue.length > 0) {
      setTimeout(processPremiumQueue, 10); 
    }
    return;
  }
  
  try {
    console.log(`Making premium API call for userId: ${userId}`);
    const result = await window.roblox.validatePremiumMembership(userId);
    console.log(`Premium API result for ${userId}:`, result);
    premiumStatusCache.set(String(userId), { value: result, timestamp: Date.now() });
    savePremiumCache(); 
    resolve(result);

    if (rateLimitBackoffMultiplier > 1) {
      rateLimitBackoffMultiplier = Math.max(1, rateLimitBackoffMultiplier - 0.5);
      saveRateLimitState();
    }
  } catch (e) {
    
    if (e?.message?.includes('429') || e?.status === 429 || e?.response?.status === 429) {
      premiumRateLimited = true;
      
      const waitTime = BASE_RATELIMIT_WAIT * rateLimitBackoffMultiplier;
      premiumRateLimitResetTime = Date.now() + waitTime;
      rateLimitBackoffMultiplier = Math.min(MAX_BACKOFF_MULTIPLIER, rateLimitBackoffMultiplier * 2);
      saveRateLimitState();

      premiumRequestQueue.unshift({ userId, resolve });
      console.warn(`Premium validation rate limited, waiting ${Math.ceil(waitTime/1000)}s (backoff: ${rateLimitBackoffMultiplier}x)`);
    } else {
      
      premiumStatusCache.set(String(userId), { value: false, timestamp: Date.now() - PREMIUM_CACHE_TTL + 60 * 60 * 1000 });
      savePremiumCache();
      resolve(false);
    }
  }
  
  isProcessingQueue = false;

  if (premiumRequestQueue.length > 0) {
    setTimeout(processPremiumQueue, PREMIUM_REQUEST_DELAY);
  }
}

async function getPremiumStatus(userId) {
  const userIdStr = String(userId);

  const cached = premiumStatusCache.get(userIdStr);
  if (cached && cached.value !== null && (Date.now() - cached.timestamp < PREMIUM_CACHE_TTL)) {
    console.log(`Premium cache hit for ${userId}:`, cached.value);
    return cached.value;
  }

  if (cached && cached.value === null) {
    console.log(`Clearing invalid null cache entry for ${userId}`);
    premiumStatusCache.delete(userIdStr);
    savePremiumCache();
  }

  const resetIn = getRateLimitResetIn();
  if (resetIn > 120000) { 
    console.log(`Skipping premium check for ${userId} - rate limited for ${Math.ceil(resetIn/1000)}s`);
    return null; 
  }
  
  console.log(`Queuing premium check for ${userId}, rate limit reset in: ${resetIn}ms, queue length: ${premiumRequestQueue.length}`);

  const existingRequest = premiumRequestQueue.find(r => String(r.userId) === userIdStr);
  if (existingRequest) {
    
    return new Promise(resolve => {
      const originalResolve = existingRequest.resolve;
      existingRequest.resolve = (value) => {
        originalResolve(value);
        resolve(value);
      };
    });
  }

  return new Promise(resolve => {
    premiumRequestQueue.push({ userId, resolve });
    processPremiumQueue();
  });
}
window.getPremiumStatus = getPremiumStatus; 

async function addObcOverlayIfPremium(container, userId, overlayStyle = {}) {
  if (!container || !userId) return false;

  const existingOverlay = container.querySelector('.obc-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }
  
  try {
    const hasPremium = await getPremiumStatus(userId);
    
    if (hasPremium === true) {
      
      const bcType = isRandomizeBCEnabled() ? getBCTypeForUser(userId) : 'OBC';
      const overlayImage = getBCOverlayImage(bcType);
      
      const overlay = document.createElement('img');
      overlay.src = overlayImage;
      overlay.alt = bcType;
      overlay.className = 'obc-overlay';

      const bottomPos = overlayStyle.bottom || '0';
      const leftPos = overlayStyle.left || '0';
      const defaultStyle = `position: absolute; bottom: ${bottomPos}; left: ${leftPos}; height: auto; pointer-events: none;`;

      if (overlayStyle.width) {
        overlay.style.cssText = defaultStyle + ` width: ${overlayStyle.width};`;
      } else {
        overlay.style.cssText = defaultStyle;
      }
      
      container.appendChild(overlay);
      return true;
    }
  } catch (e) {
    
  }
  return false;
}
window.addObcOverlayIfPremium = addObcOverlayIfPremium; 

function ensurePagesInBody() {
  const body = document.getElementById('Body');
  const container = document.getElementById('Container');
  const pageHome = document.getElementById('page-home');

  if (body) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => {
      if (page.parentElement !== body) {
        body.appendChild(page);
      }
    });
  }

  if (pageHome) {
    
    let column1c = pageHome.querySelector(':scope > .Column1c') || document.querySelector('.Column1c');
    let column2c = pageHome.querySelector(':scope > .Column2c') || document.querySelector('.Column2c');

    if (column1c) {
      const firstChild = pageHome.firstElementChild;
      if (firstChild !== column1c) {
        pageHome.insertBefore(column1c, pageHome.firstChild);
      }
    }

    if (column2c && column1c) {
      if (column2c.previousElementSibling !== column1c) {
        column1c.after(column2c);
      }
    } else if (column2c) {
      pageHome.appendChild(column2c);
    }
  }

  if (container) {
    const footer = document.getElementById('Footer');
    if (footer && footer.parentElement !== container) {
      container.appendChild(footer);
    }
  }
}

function initFooterLinks() {
  
  document.querySelectorAll('a[data-page]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(link.dataset.page);
    });
  });

  document.querySelectorAll('.SEOGenreLinks a[data-genre]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('games', { genre: link.dataset.genre });
    });
  });

  document.querySelectorAll('a[data-page="games"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo('games');
    });
  });
}

function cleanupBeforeClose() {
  console.log('[Cleanup] Starting app cleanup before close...');
  console.log('[Cleanup] Current page:', window.currentPageName);

  // Clear all timeouts and intervals by getting their IDs
  // Note: This is a brute force approach to clear any lingering timers
  const highestTimeoutId = setTimeout(() => {}, 0);
  for (let i = 0; i < highestTimeoutId; i++) {
    clearTimeout(i);
  }
  console.log('[Cleanup] Cleared all timeouts up to ID:', highestTimeoutId);

  const highestIntervalId = setInterval(() => {}, 999999);
  for (let i = 0; i < highestIntervalId; i++) {
    clearInterval(i);
  }
  clearInterval(highestIntervalId);
  console.log('[Cleanup] Cleared all intervals up to ID:', highestIntervalId);

  // Clear performance.js memory cleanup interval
  if (window.Performance?.cleanup) {
    window.Performance.cleanup();
    console.log('[Cleanup] Performance cleanup done');
  }

  // Clear home page random facts interval
  if (window.randomFactsIntervalId) {
    clearInterval(window.randomFactsIntervalId);
    window.randomFactsIntervalId = null;
    console.log('[Cleanup] Random facts interval cleared');
  }

  // Clear local server settings status check interval
  if (window.localServerSettingsInstance?.destroy) {
    window.localServerSettingsInstance.destroy();
    console.log('[Cleanup] Local server settings destroyed');
  }

  // Terminate catalog economy worker
  if (window.CatalogPage?.reset) {
    window.CatalogPage.reset();
    console.log('[Cleanup] Catalog worker terminated');
  }

  // Clean up current page if any
  if (window.currentPageName && window.Performance) {
    window.Performance.cleanupPage(window.currentPageName);
    console.log('[Cleanup] Current page cleaned up:', window.currentPageName);
  }

  console.log('[Cleanup] All cleanup tasks completed');
}

function initTitlebar() {
  document.getElementById('btn-minimize')?.addEventListener('click', () => {
    window.RobloxClient.window.minimize();
  });

  document.getElementById('btn-maximize')?.addEventListener('click', () => {
    window.RobloxClient.window.maximize();
  });

  document.getElementById('btn-close')?.addEventListener('click', async () => {
    console.log('[Close] Close button clicked');
    cleanupBeforeClose();

    // Give cleanup a moment to complete before closing
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('[Close] Calling window.close()');
    try {
      // Try to quit the app if the method exists
      if (window.RobloxClient?.app?.quit) {
        console.log('[Close] Calling app.quit()');
        window.RobloxClient.app.quit();
      } else {
        console.log('[Close] Calling window.close()');
        window.RobloxClient.window.close();
      }
    } catch (error) {
      console.error('[Close] Error closing window:', error);
    }
  });

  // Also cleanup on beforeunload in case window is closed another way
  window.addEventListener('beforeunload', () => {
    cleanupBeforeClose();
  });

  // Additional cleanup on unload event
  window.addEventListener('unload', () => {
    cleanupBeforeClose();
  });
}

async function updateSubNavForPage(pageName, params = {}) {
  const subNav = document.getElementById('SubNav');
  if (!subNav) return;

  const myRobloxPages = ['myroblox', 'inbox', 'account', 'character', 'stuff', 'sets', 'groups', 'money', 'advertising', 'ambassadors', 'share', 'places'];

  const isMyRobloxPage = myRobloxPages.includes(pageName);

  let isLoggedIn = false;
  try {
    isLoggedIn = await window.RobloxClient.auth.isLoggedIn();
  } catch (e) {
    isLoggedIn = false;
  }

  if (!isLoggedIn) {
    subNav.style.display = 'none';
    return;
  }

  if (isMyRobloxPage) {
    subNav.style.display = 'block';
    return;
  }

  if (pageName === 'profile' || pageName === 'friends') {
    try {
      const currentUser = await window.RobloxClient.api.getCurrentUser();
      const viewingUserId = params.userId ? String(params.userId) : null;
      if (viewingUserId && currentUser && String(currentUser.id) === viewingUserId) {
        subNav.style.display = 'block';
        return;
      }
    } catch (e) {
      
    }
  }

  subNav.style.display = 'none';
}

function navigateToPage(pageName, params = {}) {
  navigateTo(pageName, params);
}

let currentPageName = null;
window.currentPageName = currentPageName;

function navigateTo(pageName, params = {}) {
  
  if (currentPageName && currentPageName !== pageName && window.Performance) {
    window.Performance.cleanupPage(currentPageName);
  }

  if (pageName !== 'profile' && !isOutrageousThemeSelected()) {
    document.body.classList.remove('obc-theme');
  }

  if (pageName !== 'reviews') {
    if (pageName === 'games' && params.category === 'rovloo') {
      
    } else if (pageName !== 'games') {
      
      removeConditionalRovlooTheme();
    } else {
      
      removeConditionalRovlooTheme();
    }
  }

  if (pageName === 'reviews') {
    applyConditionalRovlooTheme();
  }

  if (pageName !== 'profile' && pageName !== 'reviews') {
    const currentTheme = localStorage.getItem(THEME_STORAGE_KEY) || 'roblox-2.0';
    if (currentTheme === 'roblox-2.0' && areConditionalThemesEnabled()) {
      const seasonalTheme = getCurrentSeasonalTheme();
      if (seasonalTheme) {
        document.body.classList.add(seasonalTheme);
      }
    }
  }

  if (pageName !== 'badge' && typeof window.resetBadgePage === 'function') {
    window.resetBadgePage();
  }

  if (pageName !== 'catalog-item' && typeof window.resetCatalogItemPage === 'function') {
    window.resetCatalogItemPage();
  }

  if (pageName !== 'game-detail' && window.GameDetailPage?.reset) {
    window.GameDetailPage.reset();
  }

  if (pageName !== 'catalog' && window.CatalogPage?.reset) {
    window.CatalogPage.reset();
  }

  if (pageName !== 'games' && window.GamesPage?.reset) {
    window.GamesPage.reset();
  }

  if (pageName !== 'profile' && window.ProfilePage?.reset) {
    window.ProfilePage.reset();
  }

  if (pageName !== 'myroblox' && window.MyRobloxPage?.reset) {
    window.MyRobloxPage.reset();
  }

  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });

  currentPageName = window.currentPageName = pageName;

  const targetPage = document.getElementById(`page-${pageName}`);
  if (targetPage) {
    targetPage.classList.add('active');
  }

  document.querySelectorAll('#MainNav li').forEach(li => {
    li.classList.remove('active');
    const link = li.querySelector('a[data-page]');
    if (link && link.dataset.page === pageName) {
      li.classList.add('active');
    }
  });

  updateSubNavForPage(pageName, params);

  document.dispatchEvent(new CustomEvent('pageChange', { 
    detail: { page: pageName, params } 
  }));

  switch (pageName) {
    case 'home':
      loadHomePage();
      break;
    case 'games':
      
      break;
    case 'profile':
      loadProfilePage(params.userId);
      break;
    case 'catalog':
      
      break;
    case 'bc':
      
      break;
    case 'people':
      loadPeoplePage();
      break;
    case 'friends':
      
      if (params.userId) {
        window.location.hash = `#friends?id=${params.userId}`;
      }
      loadFriendsPage(params.userId);
      break;
    case 'stuff':
      
      if (params.userId) {
        window.location.hash = `#stuff?id=${params.userId}`;
      }
      loadStuffPage(params.userId);
      break;
    case 'myroblox':
      
      break;
    case 'inbox':
      
      if (typeof loadInboxPage === 'function') {
        loadInboxPage();
      }
      break;
    case 'groups':
      
      break;
    case 'badge':
      
      if (params.badgeId) {
        loadBadgePage(params.badgeId);
      }
      break;
    case 'gamepass':
      
      if (params.id && window.loadGamePassPage) {
        window.loadGamePassPage(params.id);
      }
      break;
    case 'catalog-item':
      
      if (params.id && window.loadCatalogItemPage) {
        window.loadCatalogItemPage(params.id, params.type || 'Asset');
      }
      break;
    case 'character':
      
      loadCharacterPage();
      break;
    case 'account':
      
      if (window.BlacklistMenu && typeof window.BlacklistMenu.initAccountPage === 'function') {
        window.BlacklistMenu.initAccountPage();
      }
      break;
    case 'game-detail':
      
      if (params.id || params.placeId) {
        loadGameDetailPage(params.id || params.placeId, params.universe || params.universeId);
      }
      break;
  }
}

async function loadGameDetailPage(placeId, universeId = null) {
  
  if (window.GameDetailPage?.load) {
    window.GameDetailPage.load(placeId, universeId);
  } else if (window.loadGameDetailPage) {
    window.loadGameDetailPage(placeId, universeId);
  }
}

window.addEventListener('hashchange', handleHashChange);

document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="#profile"]');
  if (link) {
    e.preventDefault();
    const href = link.getAttribute('href');
    const currentHash = window.location.hash;

    if (currentHash === href) {
      const params = new URLSearchParams(href.split('?')[1] || '');
      const userId = params.get('id');
      if (userId) {
        navigateTo('profile', { userId });
      }
    } else {
      
      window.location.hash = href;
    }
  }
  
  const friendsLink = e.target.closest('a[href^="#friends"]');
  if (friendsLink) {
    e.preventDefault();
    const href = friendsLink.getAttribute('href');
    const currentHash = window.location.hash;

    if (currentHash === href) {
      const params = new URLSearchParams(href.split('?')[1] || '');
      const userId = params.get('id');
      if (userId) {
        navigateTo('friends', { userId });
      }
    } else {
      window.location.hash = href;
    }
  }

  const catalogItemLink = e.target.closest('a[href^="#catalog-item"]');
  if (catalogItemLink) {
    e.preventDefault();
    const href = catalogItemLink.getAttribute('href');
    const currentHash = window.location.hash;

    if (currentHash === href) {
      const params = new URLSearchParams(href.split('?')[1] || '');
      const itemId = params.get('id');
      const itemType = params.get('type') || 'Asset';
      if (itemId) {
        navigateTo('catalog-item', { id: itemId, type: itemType });
      }
    } else {
      window.location.hash = href;
    }
  }

  const gameDetailLink = e.target.closest('a[href^="#game-detail"]');
  if (gameDetailLink) {
    e.preventDefault();
    const href = gameDetailLink.getAttribute('href');
    const currentHash = window.location.hash;

    if (currentHash === href) {
      const params = new URLSearchParams(href.split('?')[1] || '');
      const placeId = params.get('id') || params.get('placeId');
      const universeId = params.get('universe') || params.get('universeId');
      if (placeId) {
        navigateTo('game-detail', { id: placeId, universe: universeId });
      }
    } else {
      window.location.hash = href;
    }
  }
});

function handleHashChange() {
  const hash = window.location.hash;

  if (hash.startsWith('#profile')) {
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const userId = params.get('id');
    if (userId) {
      navigateTo('profile', { userId });
    }
  }
  
  else if (hash.startsWith('#game-detail')) {
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const placeId = params.get('id') || params.get('placeId');
    const universeId = params.get('universe') || params.get('universeId');
    if (placeId) {
      navigateTo('game-detail', { id: placeId, universe: universeId });
    }
  }
  
  else if (hash.startsWith('#gamepass')) {
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const gamePassId = params.get('id');
    if (gamePassId) {
      navigateTo('gamepass', { id: gamePassId });
    }
  }
  
  else if (hash.startsWith('#game')) {
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const gameId = params.get('id');
    if (gameId) {
      navigateTo('game-detail', { id: gameId });
    }
  }
  
  else if (hash.startsWith('#badge')) {
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const badgeId = params.get('id');
    if (badgeId) {
      navigateTo('badge', { badgeId });
    }
  }
  
  else if (hash.startsWith('#friends')) {
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const userId = params.get('id');
    if (userId) {
      navigateTo('friends', { userId });
    }
  }
  
  else if (hash.startsWith('#group')) {
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const groupId = params.get('id');
    if (groupId) {
      navigateTo('groups', { groupId });
    }
  }
  
  else if (hash.startsWith('#catalog-item')) {
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const itemId = params.get('id');
    const itemType = params.get('type') || 'Asset';
    if (itemId) {
      navigateTo('catalog-item', { id: itemId, type: itemType });
    }
  }
  
  else if (hash.startsWith('#catalog')) {
    navigateTo('catalog');
  }
}

setTimeout(() => {
  if (window.location.hash) {
    handleHashChange();
  }
}, 100);

async function loadCharacterPage() {
  const container = document.getElementById('character-content');
  if (!container) return;

  container.innerHTML = '<div class="loading">Loading character...</div>';

  try {
    const response = await fetch('pages/character.html');
    if (!response.ok) throw new Error('Failed to load character page');
    const html = await response.text();
    container.innerHTML = html;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        
        if (window.CharacterPage && window.CharacterPage.init) {
          window.CharacterPage.init();
        }
      });
    });
  } catch (e) {
    console.error('Failed to load character page:', e);
    container.innerHTML = '<div style="text-align: center; padding: 40px; color: #cc0000;">Failed to load character page.</div>';
  }
}

async function loadProfilePage(userId) {
  const container = document.getElementById('profile-content');
  if (!container) return;
  
  if (!userId) {
    container.innerHTML = `
      <div style="text-align: center; padding: 60px; color: #666;">
        <p style="font-size: 14px;">No user specified.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div id="ProfileLoading" style="text-align: center; padding: 60px;">
      <div class="loading">Loading profile...</div>
    </div>
    <div id="ProfileError" style="display: none; text-align: center; padding: 60px; color: #cc0000;">
      <p>Failed to load profile.</p>
    </div>
    <div id="ProfileContent" class="MyRobloxContainer" style="display: none;">
      <!-- Left Column -->
      <div class="Column1d">
        <!-- Profile Header Box -->
        <div class="StandardBoxHeader">
          <span id="ProfileHeader">User's Profile</span>
        </div>
        <div class="StandardBox">
          <div style="text-align: center;">
            <div>
              <span id="UserOnlineStatus" class="UserOfflineMessage">[ Offline ]</span>
            </div>
            <div style="margin-bottom: 10px;">
              <span style="font-size: 12px;">
                <a id="UserProfileURL" href="#" target="_blank" style="color: #006699;"></a>
              </span>
            </div>
            <div id="AvatarImageContainer" style="margin-bottom: 10px; position: relative; display: inline-block; width: 150px; height: 200px;">
              <img id="AvatarImage" src="assets/ui/guest.png" alt="Avatar" style="height:200px;width:150px;"/>
            </div>
            <div class="UserBlurb">
              <span id="UserBlurb" style="font-size: 12px;"></span>
            </div>
          </div>
        </div>
        
        <!-- ROBLOX Badges -->
        <div class="StandardTabWhite"><span>ROBLOX Badges</span></div>
        <div class="StandardBoxWhite">
          <div id="NoRobloxBadges" style="display: none; text-align: center; color: #666; padding: 10px;">This user has no ROBLOX badges.</div>
          <div id="RobloxBadgesList" style="text-align: center;"></div>
        </div>
        
        <!-- Player Badges -->
        <div class="StandardTabWhite"><span>Player Badges</span></div>
        <div class="StandardBoxWhite">
          <div id="NoBadges" style="display: none; text-align: center; color: #666; padding: 10px;">This user has no badges.</div>
          <div id="BadgesList" style="text-align: center;"></div>
        </div>
        
        <!-- Statistics -->
        <div class="StandardTabWhite"><span>Statistics</span></div>
        <div class="StandardBoxWhite">
          <table class="statsTable">
            <tr>
              <td class="statsLabel"><acronym title="The number of this user's friends.">Friends</acronym>:</td>
              <td class="statsValue"><span id="FriendsCount">0</span></td>
            </tr>
            <tr>
              <td class="statsLabel"><acronym title="The number of users following this user.">Followers</acronym>:</td>
              <td class="statsValue"><span id="FollowersCount">0</span></td>
            </tr>
            <tr>
              <td class="statsLabel"><acronym title="The number of users this user is following.">Following</acronym>:</td>
              <td class="statsValue"><span id="FollowingCount">0</span></td>
            </tr>
            <tr>
              <td class="statsLabel"><acronym title="When this user joined ROBLOX.">Join Date</acronym>:</td>
              <td class="statsValue"><span id="JoinDate">Unknown</span></td>
            </tr>
          </table>
        </div>
        
        <!-- Groups -->
        <div class="StandardTabWhite"><span>Groups</span></div>
        <div class="StandardBoxWhite">
          <div id="NoGroups" style="display: none; text-align: center; color: #666; padding: 10px;">This user is not in any groups.</div>
          <table id="GroupsList" cellspacing="0" align="Center" border="0" style="border-collapse:collapse;"></table>
        </div>
      </div>
      
      <!-- Right Column -->
      <div class="Column2d">
        <!-- Active Places -->
        <div class="StandardBoxHeader">
          <span>Active Places</span>
        </div>
        <div id="UserPlacesPane" class="StandardBox">
          <div id="UserPlaces" style="overflow:visible;">
            <div id="NoPlaces" style="display: none; text-align: center; color: #666; padding: 20px;">This user has no active places.</div>
            <div id="PlacesList"></div>
          </div>
        </div>
        
        <!-- Friends -->
        <div class="StandardTabWhite">
          <span id="FriendsHeader">Friends</span>
        </div>
        <div class="StandardBoxWhite">
          <div id="NoFriends" style="display: none; text-align: center; color: #666; padding: 20px;">This user has no friends.</div>
          <table id="FriendsList" cellspacing="0" align="Center" border="0" style="border-collapse:collapse;"></table>
        </div>
        
        <!-- Favorites -->
        <div class="StandardTabWhite">
          <span id="FavoritesHeader">Favorites</span>
        </div>
        <div class="StandardBoxWhite">
          <div id="NoFavorites" style="display: none; text-align: center; color: #666; padding: 20px;">This user has no favorites.</div>
          <div id="FavoritesList" style="text-align: center;"></div>
          <div id="FavoritesPagination" style="text-align: left; padding: 10px; display: none;">
            <a id="FavoritesPrevPage" href="#" style="margin-right: 20px;">
              <img src="images/arrow_36px_left.png" alt="Previous" style="vertical-align: middle;" />
            </a>
            <span id="FavoritesPageInfo">Page 1</span>
            <a id="FavoritesNextPage" href="#" style="margin-left: 20px;">
              <img src="images/arrow_36px_right.png" alt="Next" style="vertical-align: middle;" />
            </a>
          </div>
        </div>
      </div>
      <div style="clear: both;"></div>
    </div>
    <!-- Stuff section at bottom, full width - authentic 2011 placement -->
    <div id="UserContainer">
      <div id="UserAssetsPane">
        <div class="StandardBoxHeader">
          <span>Stuff</span>
        </div>
        <div id="UserAssets" class="StandardBox">
          <div id="AssetsMenu">
            <!-- Asset category buttons will be rendered here -->
          </div>
          <div id="AssetsContent">
            <table id="AssetsList" cellspacing="0" border="0" style="border-collapse:collapse;">
            </table>
          </div>
          <div id="AssetsPagination" class="FooterPager" style="display: none;">
            <a id="AssetsPrevPage" href="javascript:void(0)"><span class="NavigationIndicators">&lt;&lt;</span> Previous</a>
            <span id="AssetsPageInfo" style="margin: 0 15px;">Page 1</span>
            <a id="AssetsNextPage" href="javascript:void(0)">Next <span class="NavigationIndicators">&gt;&gt;</span></a>
          </div>
        </div>
      </div>
    </div>
  `;

  try {
    const userInfo = await window.roblox.getUserInfo(userId);
    if (!userInfo) {
      throw new Error('User not found');
    }

    document.title = `${userInfo.displayName || userInfo.name} - ROBLOX`;

    const [
      friendsCount,
      followersCount,
      followingCount,
      presence,
      friends,
      games,
      badges,
      groups,
      robloxBadges,
      favorites
    ] = await Promise.all([
      window.roblox.getFriendsCount(userId).catch(() => ({ count: 0 })),
      window.roblox.getFollowersCount(userId).catch(() => ({ count: 0 })),
      window.roblox.getFollowingCount(userId).catch(() => ({ count: 0 })),
      window.roblox.getUserPresence([userId]).catch(() => ({ userPresences: [] })),
      window.roblox.getFriends(userId).catch(() => ({ data: [] })),
      window.roblox.getUserGames(userId).catch(() => ({ data: [] })),
      window.roblox.getUserBadges(userId, 25, '').catch(() => ({ data: [], nextPageCursor: null })),
      window.roblox.getUserGroups(userId).catch(() => ({ data: [] })),
      window.roblox.getRobloxBadges(userId).catch(() => []),
      getAllUserFavoriteGames(userId).catch(() => ({ data: [] }))
    ]);

    await renderProfileData(userInfo, {
      friendsCount: friendsCount.count || 0,
      followersCount: followersCount.count || 0,
      followingCount: followingCount.count || 0,
      presence: presence.userPresences?.[0] || null,
      friends: friends.data || [],
      games: games.data || [],
      badges: badges.data || [],
      badgesCursor: badges.nextPageCursor || null,
      groups: groups.data || [],
      robloxBadges: robloxBadges || [],
      favorites: favorites.data || [],
      userId: userId
    });

    document.getElementById('ProfileLoading').style.display = 'none';
    document.getElementById('ProfileContent').style.display = 'block';
    
  } catch (error) {
    console.error('Failed to load profile:', error);
    if (window.showErrorPage) {
      window.showErrorPage('Failed to load user profile. The user may not exist.', 'profile-content');
    } else {
      document.getElementById('ProfileLoading').style.display = 'none';
      document.getElementById('ProfileError').style.display = 'block';
      document.getElementById('ProfileError').querySelector('p').textContent = 'Failed to load user profile. The user may not exist.';
    }
  }
}

async function renderProfileData(user, data) {
  
  console.log('Full user object:', user);

  const headerEl = document.getElementById('ProfileHeader');
  if (headerEl) headerEl.textContent = `${user.displayName || user.name}'s Profile`;

  const statusEl = document.getElementById('UserOnlineStatus');
  if (statusEl && data.presence) {
    const isOnline = data.presence.userPresenceType > 0;
    statusEl.textContent = isOnline ? '[ Online ]' : '[ Offline ]';
    statusEl.className = isOnline ? 'UserOnlineMessage' : 'UserOfflineMessage';
    statusEl.style.color = isOnline ? 'green' : '#666';
  }

  const urlEl = document.getElementById('UserProfileURL');
  if (urlEl) {
    urlEl.textContent = `https://www.roblox.com/users/${user.id}/profile`;
    urlEl.href = `https://www.roblox.com/users/${user.id}/profile`;
  }

  try {
    const thumbResult = await window.roblox.getUserThumbnails([user.id], '150x200', 'AvatarBust');
    const avatarEl = document.getElementById('AvatarImage');
    if (avatarEl && thumbResult?.data?.[0]?.imageUrl) {
      avatarEl.src = thumbResult.data[0].imageUrl;
    }
  } catch (e) {
    console.warn('Failed to load avatar:', e);
  }

  const avatarContainer = document.getElementById('AvatarImageContainer');
  if (avatarContainer) {
    
    const existingOverlay = avatarContainer.querySelector('.obc-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }

    try {
      const hasPremium = await window.roblox.validatePremiumMembership(user.id);

      if (hasPremium === true) {
        console.log('Premium user detected:', user.name);

        const bcType = isRandomizeBCEnabled() ? getBCTypeForUser(user.id) : 'OBC';
        const overlayImage = getBCOverlayImage(bcType);

        if (areConditionalThemesEnabled() && bcType === 'OBC') {
          
          document.body.classList.remove('halloween-theme', 'thanksgiving-theme', 'christmas-theme');
          document.body.classList.add('obc-theme');
        } else if (!isOutrageousThemeSelected()) {
          
          document.body.classList.remove('obc-theme');
        }

        const overlay = document.createElement('img');
        overlay.src = overlayImage;
        overlay.alt = bcType;
        overlay.className = 'obc-overlay';
        overlay.style.cssText = 'position: absolute; bottom: 0; left: 0; height: auto; pointer-events: none;';
        avatarContainer.appendChild(overlay);
      } else if (!isOutrageousThemeSelected()) {
        
        document.body.classList.remove('obc-theme');
      }
    } catch (e) {
      
      if (!isOutrageousThemeSelected()) {
        document.body.classList.remove('obc-theme');
      }
      console.debug('Could not verify premium status:', e);
    }
  }

  const blurbEl = document.getElementById('UserBlurb');
  if (blurbEl) {
    let description = user.description;

    if (!description && window.roblox.getUserDescription) {
      try {
        description = await window.roblox.getUserDescription(user.id);
      } catch (e) {
        console.log('Could not fetch user description:', e);
      }
    }
    
    if (description && description.trim()) {
      blurbEl.textContent = description;
      blurbEl.style.fontStyle = 'normal';
      blurbEl.style.color = '';
    } else {
      blurbEl.textContent = 'No description available.';
      blurbEl.style.fontStyle = 'italic';
      blurbEl.style.color = '#666';
    }
  }

  const friendsCountEl = document.getElementById('FriendsCount');
  const followersCountEl = document.getElementById('FollowersCount');
  const followingCountEl = document.getElementById('FollowingCount');
  const joinDateEl = document.getElementById('JoinDate');
  
  if (friendsCountEl) friendsCountEl.textContent = formatNumber(data.friendsCount);
  if (followersCountEl) followersCountEl.textContent = formatNumber(data.followersCount);
  if (followingCountEl) followingCountEl.textContent = formatNumber(data.followingCount);

  if (joinDateEl) {
    let created = user.created;

    if (!created) {
      try {
        const freshData = await window.roblox.getUserInfo(user.id);
        created = freshData?.created;
      } catch (e) {
        console.log('Could not fetch user created date:', e);
      }
    }
    
    if (created) {
      const joinDate = new Date(created);
      joinDateEl.textContent = joinDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  }

  renderRobloxBadges(user, data);

  await renderProfileFriends(data.friends.slice(0, 6), user.name, user.id);

  await renderProfileGames(data.games.slice(0, 6));

  await renderProfileBadges(data.badges, data.badgesCursor, data.userId);

  await renderProfileGroups(data.groups);

  await renderProfileInventory(data.userId);

  await renderProfileFavorites(data.favorites, user.name, user.id, 1);
}

async function renderProfileFavorites(favorites, username, userId, page = 1) {
  const container = document.getElementById('FavoritesList');
  const noFavoritesEl = document.getElementById('NoFavorites');
  const headerEl = document.getElementById('FavoritesHeader');
  const paginationEl = document.getElementById('FavoritesPagination');
  const prevBtn = document.getElementById('FavoritesPrevPage');
  const nextBtn = document.getElementById('FavoritesNextPage');
  const pageInfoEl = document.getElementById('FavoritesPageInfo');
  
  if (!container) return;

  if (headerEl) {
    headerEl.textContent = 'Favorites';
  }
  
  if (!favorites || favorites.length === 0) {
    if (noFavoritesEl) noFavoritesEl.style.display = 'block';
    if (paginationEl) paginationEl.style.display = 'none';
    return;
  }
  
  if (noFavoritesEl) noFavoritesEl.style.display = 'none';
  if (paginationEl) paginationEl.style.display = 'block';
  
  container.innerHTML = '';
  
  const itemsPerPage = 6;
  const totalPages = Math.ceil(favorites.length / itemsPerPage);
  const startIndex = (page - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const pagedFavorites = favorites.slice(startIndex, endIndex);

  if (pageInfoEl) pageInfoEl.textContent = `Page ${page} of ${totalPages}`;

  if (prevBtn) prevBtn.style.display = (page > 1) ? 'inline-block' : 'none';
  if (nextBtn) nextBtn.style.display = (page < totalPages) ? 'inline-block' : 'none';

  if (prevBtn && nextBtn) {
    const newPrevBtn = prevBtn.cloneNode(true);
    const newNextBtn = nextBtn.cloneNode(true);
    prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
    nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
    
    if (page > 1) {
      newPrevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        renderProfileFavorites(favorites, username, userId, page - 1);
      });
    }
    if (page < totalPages) {
      newNextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        renderProfileFavorites(favorites, username, userId, page + 1);
      });
    }
  }

  const universeIds = pagedFavorites.map(f => f.id);
  let thumbnails = {};
  try {
    const thumbResult = await window.robloxAPI.getGameIcons(universeIds, '150x150');
    if (thumbResult?.data) {
      thumbResult.data.forEach(t => {
        thumbnails[t.targetId] = t.imageUrl;
      });
    }
  } catch (e) {
    console.warn('Failed to load favorite thumbnails:', e);
  }

  pagedFavorites.forEach(game => {
    const thumb = thumbnails[game.id] || '';
    const creatorName = game.creator?.name || game.creator?.username || 'Unknown';
    const creatorType = game.creator?.type || game.creator?.creatorType || 'User';
    const creatorId = game.creator?.id || game.creator?.creatorTargetId;

    let creatorDisplay;
    if (creatorType === 'User' && creatorId) {
      creatorDisplay = `<a href="#profile?id=${creatorId}" style="color:#00F;">${escapeHtml(creatorName)}</a>`;
    } else if (creatorType === 'Group' && creatorId) {
      creatorDisplay = `<a href="#group?id=${creatorId}" style="color:#00F;">${escapeHtml(creatorName)}</a>`;
    } else {
      creatorDisplay = escapeHtml(creatorName);
    }

    const div = document.createElement('div');
    div.className = 'Asset';
    
    div.innerHTML = `
      <div class="AssetThumbnail">
        <a href="#game?id=${game.rootPlaceId || game.id}" title="${escapeHtml(game.name)}" style="display:inline-block;height:110px;width:110px;cursor:pointer;">
          ${thumb ? `<img src="${thumb}" border="0" alt="${escapeHtml(game.name)}" style="width:110px;height:110px;object-fit:cover;" onerror="this.style.display='none'"/>` : ''}
        </a>
      </div>
      <div class="AssetDetails">
        <div class="AssetName" style="font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          <a href="#game?id=${game.rootPlaceId || game.id}" style="color:#00F;">${escapeHtml(game.name)}</a>
        </div>
        <div class="AssetCreator" style="font-size: 11px; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          <strong style="color: #000;">Creator:</strong> ${creatorDisplay}
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

async function getAllUserFavoriteGames(userId) {
    let allFavorites = [];
    let cursor = '';
    let hasNextPage = true;

    while(hasNextPage) {
        try {
            const result = await window.roblox.getUserFavoriteGames(userId, 50, cursor);
            if (result.data && result.data.length > 0) {
                allFavorites = allFavorites.concat(result.data);
            }
            cursor = result.nextPageCursor;
            hasNextPage = !!cursor;
        } catch (error) {
            console.error('Failed to fetch a page of favorites:', error);
            hasNextPage = false;
        }
    }
    return { data: allFavorites };
}

function renderRobloxBadges(user, data) {
  const container = document.getElementById('RobloxBadgesList');
  const noBadgesEl = document.getElementById('NoRobloxBadges');
  
  if (!container) return;

  const badge2011Images = {
    
    'Veteran': 'images/Badges/Veteran-75x75_v-2.png',
    'Friendship': 'images/Badges/Friendship-75x75_v-2.png',
    'Homestead': 'images/Badges/Homestead-70x75_v-2.png',
    'Bricksmith': 'images/Badges/Bricksmith-54x75_v-2.png',
    'Warrior': 'images/Badges/Warrior-75x75_v-2.png',
    'Bloxxer': 'images/Badges/Bloxxer-75x75_v-2.png',
    'Combat Initiation': 'images/Badges/CombatInitiation-75x75_v-2.png',
    'Inviter': 'images/Badges/Inviter-75x75_v-2.png',
    'Administrator': 'images/Badges/Administrator-75x75_v-2.png',
    'Welcome To The Club': 'images/Badges/BuildersClub-75x75.png',
    'Builders Club': 'images/Badges/BuildersClub-75x75.png',
    'Turbo Builders Club': 'images/Badges/TurboBuildersClub-75x75.png',
    'Outrageous Builders Club': 'images/Badges/obcbadge75x75.png',
    
    1: 'images/Badges/Administrator-75x75_v-2.png', 
    2: 'images/Badges/Friendship-75x75_v-2.png', 
    3: 'images/Badges/CombatInitiation-75x75_v-2.png', 
    4: 'images/Badges/Warrior-75x75_v-2.png', 
    5: 'images/Badges/Bloxxer-75x75_v-2.png', 
    6: 'images/Badges/Homestead-70x75_v-2.png', 
    7: 'images/Badges/Bricksmith-54x75_v-2.png', 
    11: 'images/Badges/Inviter-75x75_v-2.png', 
    12: 'images/Badges/Veteran-75x75_v-2.png', 
    18: 'images/Badges/BuildersClub-75x75.png' 
  };

  const robloxBadges = data.robloxBadges || [];
  
  if (robloxBadges.length === 0) {
    if (noBadgesEl) noBadgesEl.style.display = 'block';
    return;
  }
  
  if (noBadgesEl) noBadgesEl.style.display = 'none';
  container.innerHTML = '';

  const table = document.createElement('table');
  table.cellSpacing = '0';
  table.align = 'Center';
  table.border = '0';
  table.style.borderCollapse = 'collapse';
  
  let currentRow = null;
  robloxBadges.forEach((badge, index) => {
    if (index % 4 === 0) {
      currentRow = document.createElement('tr');
      table.appendChild(currentRow);
    }

    const localImage = badge2011Images[badge.name] || badge2011Images[badge.id];
    const imageUrl = localImage || badge.imageUrl || '';
    
    const td = document.createElement('td');
    td.innerHTML = `
      <div class="Badge">
        <div class="BadgeImage">
          <a title="${escapeHtml(badge.description || '')}">
            <img src="${imageUrl}" alt="${escapeHtml(badge.name)}" style="height:75px;border-width:0px;" onerror="this.src='${badge.imageUrl || ''}'; this.onerror=null;"/>
          </a>
        </div>
        <div class="BadgeLabel">
          <a>${escapeHtml(badge.name)}</a>
        </div>
      </div>
    `;
    currentRow.appendChild(td);
  });
  
  container.appendChild(table);
}

async function renderProfileFriends(friends, username, userId) {
  const container = document.getElementById('FriendsList');
  const noFriendsEl = document.getElementById('NoFriends');
  const headerEl = document.getElementById('FriendsHeader');
  
  if (!container) return;

  if (headerEl && username) {
    headerEl.innerHTML = `${escapeHtml(username)}'s Friends (<a href="#friends?id=${userId}" style="color:#006699;">See All</a>)`;
  }
  
  if (!friends || friends.length === 0) {
    if (noFriendsEl) noFriendsEl.style.display = 'block';
    return;
  }
  
  if (noFriendsEl) noFriendsEl.style.display = 'none';
  container.innerHTML = '';
  
  const friendIds = friends.map(f => f.id);

  let userDetails = {};
  try {
    const usersResult = await window.roblox.getUsersByIds(friendIds);
    if (usersResult?.data) {
      usersResult.data.forEach(u => {
        userDetails[u.id] = u;
      });
    }
  } catch (e) {
    console.warn('Failed to load user details:', e);
  }

  let thumbnails = {};
  try {
    const thumbResult = await window.roblox.getUserThumbnails(friendIds, '150x150', 'AvatarBust');
    if (thumbResult?.data) {
      thumbResult.data.forEach(t => {
        thumbnails[t.targetId] = t.imageUrl;
      });
    }
  } catch (e) {
    console.warn('Failed to load friend thumbnails:', e);
  }

  let presenceMap = {};
  try {
    const presenceResult = await window.roblox.getUserPresence(friendIds);
    if (presenceResult?.userPresences) {
      presenceResult.userPresences.forEach(p => {
        presenceMap[p.userId] = p.userPresenceType; 
      });
    }
  } catch (e) {
    console.warn('Failed to load friend presence:', e);
  }

  let currentRow = null;
  friends.forEach((friend, index) => {
    if (index % 3 === 0) {
      currentRow = document.createElement('tr');
      container.appendChild(currentRow);
    }
    
    const thumb = thumbnails[friend.id] || 'assets/ui/guest.png';
    const presence = presenceMap[friend.id] || 0;
    const isOnline = presence > 0;
    const statusIcon = isOnline ? 'assets/ui/online.png' : 'assets/ui/offline.png';

    const user = userDetails[friend.id] || {};
    const friendName = user.name || user.displayName || friend.name || friend.displayName || 'Unknown';
    
    const td = document.createElement('td');
    td.style.cssText = 'padding: 5px; text-align: center; vertical-align: top;';
    td.innerHTML = `
      <div class="Friend" style="width: 100px; display: inline-block;">
        <div class="Avatar" style="position: relative; display: inline-block; width: 100px; height: 100px;">
          <a href="#profile?id=${friend.id}" title="${escapeHtml(friendName)}" style="display:inline-block;height:100px;width:100px;cursor:pointer;">
            <img src="${thumb}" border="0" alt="${escapeHtml(friendName)}" style="width:100px;height:100px;object-fit:cover;" onerror="this.src='assets/ui/guest.png'"/>
          </a>
        </div>
        <div class="Summary" style="margin-top: 3px; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          <img src="${statusIcon}" alt="${isOnline ? 'Online' : 'Offline'}" style="width:10px;height:10px;vertical-align:middle;margin-right:2px;"/>
          <a href="#profile?id=${friend.id}" style="color:#006699;">${escapeHtml(friendName)}</a>
        </div>
      </div>
    `;
    currentRow.appendChild(td);

    const avatarContainer = td.querySelector('.Avatar');
    if (avatarContainer) {
      addObcOverlayIfPremium(avatarContainer, friend.id);
    }
  });
}

async function renderProfileGames(games) {
  const container = document.getElementById('PlacesList');
  const noPlacesEl = document.getElementById('NoPlaces');
  
  if (!container) return;
  
  if (!games || games.length === 0) {
    if (noPlacesEl) noPlacesEl.style.display = 'block';
    return;
  }
  
  if (noPlacesEl) noPlacesEl.style.display = 'none';
  container.innerHTML = '';

  const universeIds = games.map(g => g.id);
  let thumbnails = {};
  try {
    
    const thumbResult = await window.roblox.getGameThumbnails(universeIds, '480x270');
    if (thumbResult?.data) {
      thumbResult.data.forEach(t => {
        
        if (t.thumbnails && t.thumbnails.length > 0) {
          thumbnails[t.universeId] = t.thumbnails[0].imageUrl;
        }
      });
    }
  } catch (e) {
    console.warn('Failed to load game thumbnails:', e);
  }

  games.forEach((game, index) => {
    const thumb = thumbnails[game.id] || '';
    const placeId = game.rootPlaceId || game.id;
    
    const div = document.createElement('div');
    div.innerHTML = `
      <div class="AccordionHeader">
        ${escapeHtml(game.name)}
      </div>
      <div style="${index === 0 ? 'display:block;' : 'display:none;'}">
        <div class="Place">
          <div class="PlayStatus"></div>
          <br>
          <div class="PlayOptions" style="display:block">
            <div style="overflow: hidden; width: 414px;">
              <a href="#game?id=${placeId}" title="Play this game" class="profile-play-btn"></a>
            </div>
          </div>
          <div class="Statistics">
            <span>Visited ${formatNumber(game.placeVisits || 0)} times</span>
          </div>
          <div class="Thumbnail" style="width:100%;max-width:414px;overflow:hidden;">
            <a href="#game?id=${placeId}" title="${escapeHtml(game.name)}" style="display:block;">
              ${thumb ? `<img src="${thumb}" border="0" alt="${escapeHtml(game.name)}" style="width:100%;height:auto;" onerror="this.style.display='none'"/>` : ''}
            </a>
          </div>
          ${game.description ? `<div class="Description"><span>${escapeHtml(game.description)}</span></div>` : ''}
        </div>
      </div>
    `;

    const header = div.querySelector('.AccordionHeader');
    const content = div.querySelector('.AccordionHeader + div');
    header.addEventListener('click', () => {
      
      if (content.style.display === 'none') {
        content.style.display = 'block';
      } else {
        content.style.display = 'none';
      }
    });
    
    container.appendChild(div);
  });
}

const badgePaginationState = {
  allBadges: [],
  currentPage: 0,
  userId: null,
  nextApiCursor: null,
  hasMoreFromApi: false,
  isLoading: false,
  thumbnailCache: new Map()
};
const badgesPerPage = 12;

function handleBadgePagination(e) {
  const btn = e.target.closest('#badgePrevBtn, #badgeNextBtn');
  if (!btn || btn.disabled || badgePaginationState.isLoading) return;

  if (btn.id === 'badgePrevBtn' && badgePaginationState.currentPage > 0) {
    badgePaginationState.currentPage--;
    renderProfileBadges(null, null, null);
  } else if (btn.id === 'badgeNextBtn') {
    badgePaginationState.currentPage++;
    renderProfileBadges(null, null, null);
  }
}

async function renderProfileBadges(badges, nextCursor, userId) {
  const container = document.getElementById('BadgesList');
  const noBadgesEl = document.getElementById('NoBadges');

  if (!container) return;

  if (userId) {
    badgePaginationState.userId = userId;
    badgePaginationState.allBadges = badges || [];
    badgePaginationState.currentPage = 0;
    badgePaginationState.nextApiCursor = nextCursor;
    badgePaginationState.hasMoreFromApi = !!nextCursor;
    badgePaginationState.thumbnailCache.clear();
  }

  if (badgePaginationState.allBadges.length === 0) {
    if (noBadgesEl) noBadgesEl.style.display = 'block';
    const existingPager = container.parentElement?.querySelector('.badge-pager');
    if (existingPager) existingPager.remove();
    return;
  }

  if (noBadgesEl) noBadgesEl.style.display = 'none';

  badgePaginationState.isLoading = true;
  container.style.maxWidth = '416px';
  container.style.opacity = '0.5';

  const startIdx = badgePaginationState.currentPage * badgesPerPage;
  let pageBadges = badgePaginationState.allBadges.slice(startIdx, startIdx + badgesPerPage);

  while (pageBadges.length < badgesPerPage && badgePaginationState.hasMoreFromApi) {
    try {
      const result = await window.roblox.getUserBadges(badgePaginationState.userId, 25, badgePaginationState.nextApiCursor);
      if (result?.data && result.data.length > 0) {
        badgePaginationState.allBadges = badgePaginationState.allBadges.concat(result.data);
        pageBadges = badgePaginationState.allBadges.slice(startIdx, startIdx + badgesPerPage);
      }
      badgePaginationState.nextApiCursor = result?.nextPageCursor || null;
      badgePaginationState.hasMoreFromApi = !!result?.nextPageCursor;

      if (!result?.data || result.data.length === 0) break;
    } catch (e) {
      console.warn('Failed to fetch more badges:', e);
      badgePaginationState.hasMoreFromApi = false;
      break;
    }
  }

  const badgeIds = pageBadges.map(b => b.id);
  const uncachedIds = badgeIds.filter(id => !badgePaginationState.thumbnailCache.has(id));

  if (uncachedIds.length > 0) {
    try {
      const thumbResult = await window.roblox.getBadgeThumbnails(uncachedIds, '150x150');
      if (thumbResult?.data) {
        thumbResult.data.forEach(t => {
          badgePaginationState.thumbnailCache.set(t.targetId, t.imageUrl);
        });
      }
    } catch (e) {
      console.warn('Failed to load badge thumbnails:', e);
    }
  }

  container.innerHTML = '';
  pageBadges.forEach(badge => {
    const thumb = badgePaginationState.thumbnailCache.get(badge.id) || '';
    const div = document.createElement('div');
    div.className = 'TileBadges';
    div.style.cssText = 'display: inline-block; margin: 5px; text-align: center; vertical-align: top;';
    div.innerHTML = `
      <a href="#badge?id=${badge.id}" title="${escapeHtml(badge.name)}" style="display:inline-block;height:75px;width:75px;cursor:pointer;">
        ${thumb ? `<img src="${thumb}" border="0" alt="${escapeHtml(badge.name)}" style="width:75px;height:75px;" onerror="this.style.display='none'"/>` : ''}
      </a>
    `;
    container.appendChild(div);
  });

  container.style.opacity = '1';
  badgePaginationState.isLoading = false;

  const totalLoaded = badgePaginationState.allBadges.length;
  const currentPageEnd = (badgePaginationState.currentPage + 1) * badgesPerPage;
  const hasNext = currentPageEnd < totalLoaded || badgePaginationState.hasMoreFromApi;
  const hasPrev = badgePaginationState.currentPage > 0;

  let pager = container.parentElement?.querySelector('.badge-pager');
  if (hasNext || hasPrev) {
    if (!pager) {
      pager = document.createElement('div');
      pager.className = 'badge-pager';
      pager.style.cssText = 'text-align: center; padding: 5px; margin-top: 5px;';
      pager.addEventListener('click', handleBadgePagination);
      container.parentElement.appendChild(pager);
    }
    pager.innerHTML = `
      <button id="badgePrevBtn" style="margin-right: 10px;" ${!hasPrev ? 'disabled' : ''}>« Prev</button>
      <span>Page ${badgePaginationState.currentPage + 1}</span>
      <button id="badgeNextBtn" style="margin-left: 10px;" ${!hasNext ? 'disabled' : ''}>Next »</button>
    `;
  } else if (pager) {
    pager.remove();
  }
}

const groupPaginationState = {
  allGroups: [],
  currentPage: 0,
  isLoading: false,
  thumbnailCache: new Map()
};
const groupsPerPage = 15;

function handleGroupPagination(e) {
  const btn = e.target.closest('#groupPrevBtn, #groupNextBtn');
  if (!btn || btn.disabled || groupPaginationState.isLoading) return;

  const totalPages = Math.ceil(groupPaginationState.allGroups.length / groupsPerPage);

  if (btn.id === 'groupPrevBtn' && groupPaginationState.currentPage > 0) {
    groupPaginationState.currentPage--;
    renderProfileGroups(null, true);
  } else if (btn.id === 'groupNextBtn' && groupPaginationState.currentPage < totalPages - 1) {
    groupPaginationState.currentPage++;
    renderProfileGroups(null, true);
  }
}

async function renderProfileGroups(groups, isPageChange = false) {
  const container = document.getElementById('GroupsList');
  const noGroupsEl = document.getElementById('NoGroups');

  if (!container) return;

  if (!isPageChange && groups) {
    groupPaginationState.allGroups = groups;
    groupPaginationState.currentPage = 0;
    groupPaginationState.thumbnailCache.clear();
  }

  if (!groupPaginationState.allGroups || groupPaginationState.allGroups.length === 0) {
    if (noGroupsEl) noGroupsEl.style.display = 'block';
    const existingPager = container.parentElement?.querySelector('.group-pager');
    if (existingPager) existingPager.remove();
    return;
  }

  if (noGroupsEl) noGroupsEl.style.display = 'none';

  groupPaginationState.isLoading = true;
  container.style.opacity = '0.5';

  const startIdx = groupPaginationState.currentPage * groupsPerPage;
  const pageGroups = groupPaginationState.allGroups.slice(startIdx, startIdx + groupsPerPage);

  const groupIds = pageGroups.map(g => g.group?.id || g.id);
  const uncachedIds = groupIds.filter(id => !groupPaginationState.thumbnailCache.has(id));

  if (uncachedIds.length > 0) {
    try {
      const thumbResult = await window.roblox.getGroupThumbnails(uncachedIds, '150x150');
      if (thumbResult?.data) {
        thumbResult.data.forEach(t => {
          groupPaginationState.thumbnailCache.set(t.targetId, t.imageUrl);
        });
      }
    } catch (e) {
      console.warn('Failed to load group thumbnails:', e);
    }
  }

  container.innerHTML = '';
  let currentRow = null;
  pageGroups.forEach((groupData, index) => {
    const group = groupData.group || groupData;
    if (index % 5 === 0) {
      currentRow = document.createElement('tr');
      container.appendChild(currentRow);
    }

    const thumb = groupPaginationState.thumbnailCache.get(group.id) || '';
    const td = document.createElement('td');
    td.innerHTML = `
      <div class="groupEmblemThumbnail" style="width:70px; overflow:hidden; margin-left:0px; padding:0px;">
        <div class="groupEmblemImage" style="width: 70px; height:72px; margin: 0px; padding-top: 0px;">
          <a href="#group?id=${group.id}" title="${escapeHtml(group.name)}" style="display:inline-block;height:62px;width:60px;cursor:pointer;">
            ${thumb ? `<img src="${thumb}" border="0" alt="${escapeHtml(group.name)}" style="width:60px;height:62px;object-fit:cover;" onerror="this.style.display='none'"/>` : ''}
          </a>
        </div>
      </div>
    `;
    currentRow.appendChild(td);
  });

  container.style.opacity = '1';
  groupPaginationState.isLoading = false;

  const totalPages = Math.ceil(groupPaginationState.allGroups.length / groupsPerPage);

  let pager = container.parentElement?.querySelector('.group-pager');
  if (totalPages > 1) {
    if (!pager) {
      pager = document.createElement('div');
      pager.className = 'group-pager';
      pager.style.cssText = 'text-align: center; padding: 5px; margin-top: 5px;';
      pager.addEventListener('click', handleGroupPagination);
      container.parentElement.appendChild(pager);
    }
    pager.innerHTML = `
      <button id="groupPrevBtn" style="margin-right: 10px;" ${groupPaginationState.currentPage === 0 ? 'disabled' : ''}>« Prev</button>
      <span>Page ${groupPaginationState.currentPage + 1} of ${totalPages}</span>
      <button id="groupNextBtn" style="margin-left: 10px;" ${groupPaginationState.currentPage >= totalPages - 1 ? 'disabled' : ''}>Next »</button>
    `;
  } else if (pager) {
    pager.remove();
  }
}

const assetCategories = [
  { id: 17, name: 'Heads' },
  { id: 18, name: 'Faces' },
  { id: 19, name: 'Gear' },
  { id: 8, name: 'Hats' },
  { id: 2, name: 'T-Shirts' },
  { id: 11, name: 'Shirts' },
  { id: 12, name: 'Pants' },
  { id: 13, name: 'Decals' },
  { id: 10, name: 'Models' },
  { id: 9, name: 'Places' },
  { id: 21, name: 'Badges' },
  { id: 32, name: 'Packages' }
];

let currentAssetCategory = 8; 
let currentAssetCursor = '';
let currentAssetPage = 1;
let currentInventoryUserId = null;
let assetCursorHistory = []; 

async function renderProfileInventory(userId) {
  currentInventoryUserId = userId;
  assetCursorHistory = []; 
  const menuContainer = document.getElementById('AssetsMenu');
  const assetsContent = document.getElementById('AssetsContent');
  if (!menuContainer) return;

  let canView = true;
  try {
    const result = await window.roblox.canViewInventory(userId);
    canView = result?.canView !== false;
  } catch (e) {
    console.warn('Could not check inventory visibility:', e);
  }
  
  if (!canView) {
    menuContainer.innerHTML = '';
    if (assetsContent) {
      assetsContent.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">This user\'s inventory is private.</div>';
    }
    return;
  }

  menuContainer.innerHTML = assetCategories.map(cat => `
    <div class="${cat.id === currentAssetCategory ? 'AssetsMenuItem_Selected' : 'AssetsMenuItem'}">
      <a href="javascript:void(0)" class="${cat.id === currentAssetCategory ? 'AssetsMenuButton_Selected' : 'AssetsMenuButton'}"
         onclick="selectAssetCategory(${cat.id})">${cat.name}</a>
    </div>
  `).join('');

  const assetsContentEl = document.getElementById('AssetsContent');
  if (assetsContentEl && !assetsContentEl.dataset.handlerAttached) {
    assetsContentEl.dataset.handlerAttached = 'true';
    assetsContentEl.addEventListener('click', (e) => {
      const link = e.target.closest('.inventory-item-link');
      if (link) {
        e.preventDefault();
        const assetId = link.dataset.assetId;
        if (assetId) {
          navigateToPage('catalog-item', { id: assetId });
        }
      }
    });
  }

  await loadInventoryCategory(userId, currentAssetCategory);
}

window.selectAssetCategory = async function(categoryId) {
  currentAssetCategory = categoryId;
  currentAssetCursor = '';
  currentAssetPage = 1;
  assetCursorHistory = []; 

  const menuContainer = document.getElementById('AssetsMenu');
  if (menuContainer) {
    menuContainer.innerHTML = assetCategories.map(cat => `
      <div class="${cat.id === currentAssetCategory ? 'AssetsMenuItem_Selected' : 'AssetsMenuItem'}">
        <a href="javascript:void(0)" class="${cat.id === currentAssetCategory ? 'AssetsMenuButton_Selected' : 'AssetsMenuButton'}" 
           onclick="selectAssetCategory(${cat.id})">${cat.name}</a>
      </div>
    `).join('');
  }
  
  await loadInventoryCategory(currentInventoryUserId, categoryId);
};

async function fetchInventoryEconomyDetails(assetIds) {
  const economyDetails = {};
  if (!window.roblox?.getAssetEconomyDetails) return economyDetails;
  
  for (const assetId of assetIds) {
    try {
      const ecoData = await window.roblox.getAssetEconomyDetails(assetId);
      if (ecoData) {
        economyDetails[assetId] = {
          isLimited: ecoData.IsLimited || ecoData.isLimited || false,
          isLimitedUnique: ecoData.IsLimitedUnique || ecoData.isLimitedUnique || false,
          lowestSellerPrice: ecoData.LowestSellerPrice ?? ecoData.lowestSellerPrice ?? null,
          priceInRobux: ecoData.PriceInRobux ?? ecoData.priceInRobux ?? null,
          isForSale: ecoData.IsForSale ?? ecoData.isForSale ?? false
        };
      }
    } catch (e) {
      console.warn('Failed to load economy details for asset', assetId, ':', e);
    }
  }
  return economyDetails;
}

function buildInventoryPriceHtml(details, ecoData) {
  const restrictions = details.itemRestrictions || [];
  const isLimited = restrictions.includes('Limited') || restrictions.includes('Collectible') || ecoData?.isLimited;
  const isLimitedUnique = restrictions.includes('LimitedUnique') || ecoData?.isLimitedUnique;
  
  if (isLimited || isLimitedUnique) {
    
    const resalePrice = ecoData?.lowestSellerPrice || details.lowestPrice;
    if (resalePrice && resalePrice > 0) {
      return `<div class="PriceInRobux">R$: ${resalePrice.toLocaleString()}</div>`;
    }
    
    return '';
  } else {
    
    const isForSale = ecoData?.isForSale;
    const price = ecoData?.priceInRobux ?? details.price;
    
    if (isForSale === false) {
      
      return `<div class="PriceInRobux" style="color:#cc0000;">Off Sale</div>`;
    } else if (price !== undefined && price !== null) {
      
      return price === 0 ? `<div class="PriceInRobux">Free</div>` : `<div class="PriceInRobux">R$: ${price.toLocaleString()}</div>`;
    }
    return '';
  }
}

async function loadInventoryCategory(userId, assetTypeId, cursor = '', isGoingBack = false) {
  const container = document.getElementById('AssetsList');
  const paginationEl = document.getElementById('AssetsPagination');

  if (!container) return;

  container.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Loading...</td></tr>';

  try {
    
    if (assetTypeId === 21) {
      await loadInventoryBadges(userId, cursor, isGoingBack);
      return;
    }

    const result = await window.roblox.getUserInventory(userId, assetTypeId, 10, cursor, 'Desc');

    if (!result?.data || result.data.length === 0) {
      container.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #666; padding: 20px;">No items to display.</td></tr>';
      if (paginationEl) paginationEl.style.display = 'none';
      return;
    }

    const assetIds = result.data.map(item => item.assetId);
    let thumbnails = {};
    try {
      const thumbResult = await window.robloxAPI.getAssetThumbnails(assetIds, '110x110');
      if (thumbResult?.data) {
        thumbResult.data.forEach(t => {
          thumbnails[t.targetId] = t.imageUrl;
        });
      }
    } catch (e) {
      console.warn('Failed to load asset thumbnails:', e);
    }

    let itemDetails = {};
    try {
      const items = assetIds.map(id => ({ itemType: 'Asset', id: id }));
      const detailsResult = await window.roblox.getCatalogItemDetails(items);
      if (detailsResult?.data) {
        detailsResult.data.forEach(item => {
          itemDetails[item.id] = item;
        });
      }
    } catch (e) {
      console.warn('Failed to load catalog item details:', e);
    }

    const economyDetails = await fetchInventoryEconomyDetails(assetIds);

    container.innerHTML = '';
    let currentRow = null;
    result.data.forEach((item, index) => {
      if (index % 5 === 0) {
        currentRow = document.createElement('tr');
        container.appendChild(currentRow);
      }

      const thumb = thumbnails[item.assetId] || 'images/spinners/spinner100x100.gif';
      const details = itemDetails[item.assetId] || {};
      const ecoData = economyDetails[item.assetId] || {};
      const creatorName = details.creatorName || 'ROBLOX';
      const creatorType = details.creatorType || 'User';

      const restrictions = details.itemRestrictions || [];
      const isLimited = restrictions.includes('Limited') || restrictions.includes('Collectible') || ecoData.isLimited;
      const isLimitedUnique = restrictions.includes('LimitedUnique') || ecoData.isLimitedUnique;

      let limitedOverlay = '';
      if (isLimitedUnique) {
        limitedOverlay = '<img src="images/assetIcons/limitedunique.png" class="limited-overlay" alt="Limited U"/>';
      } else if (isLimited) {
        limitedOverlay = '<img src="images/assetIcons/limited.png" class="limited-overlay" alt="Limited"/>';
      }

      const priceHtml = buildInventoryPriceHtml(details, ecoData);

      const td = document.createElement('td');
      td.className = 'Asset';
      td.setAttribute('valign', 'top');
      td.innerHTML = `
        <div style="padding: 5px">
          <div class="AssetThumbnail" style="position: relative;">
            <a href="javascript:void(0)" data-asset-id="${item.assetId}" class="inventory-item-link" title="${escapeHtml(item.assetName || item.name || 'Item')}" style="display:inline-block;height:110px;width:110px;cursor:pointer;">
              <img src="${thumb}" border="0" alt="${escapeHtml(item.assetName || item.name || 'Item')}" onerror="this.src='images/spinners/spinner100x100.gif'"/>
            </a>
            ${limitedOverlay}
          </div>
          <div class="AssetDetails">
            <div class="AssetName">
              <a href="javascript:void(0)" data-asset-id="${item.assetId}" class="inventory-item-link">${escapeHtml(item.assetName || item.name || 'Item')}</a>
            </div>
            <div class="AssetCreator">
              <span class="Label">Creator:</span> <span class="Detail">
                <a href="${creatorType === 'Group' ? '#group?id=' + details.creatorTargetId : '#profile?id=' + details.creatorTargetId}">${escapeHtml(creatorName)}</a>
              </span>
            </div>
            ${priceHtml}
          </div>
        </div>
      `;
      currentRow.appendChild(td);
    });

    currentAssetCursor = result.nextPageCursor || '';
    
    if (paginationEl) {
      const prevBtn = document.getElementById('AssetsPrevPage');
      const nextBtn = document.getElementById('AssetsNextPage');
      const pageInfo = document.getElementById('AssetsPageInfo');
      
      if (pageInfo) pageInfo.textContent = `Page ${currentAssetPage}`;
      
      if (prevBtn) {
        prevBtn.style.visibility = currentAssetPage > 1 ? 'visible' : 'hidden';
        prevBtn.onclick = () => {
          if (currentAssetPage > 1) {
            currentAssetPage--;
            
            assetCursorHistory.pop();
            const prevCursor = assetCursorHistory.length > 0 ? assetCursorHistory[assetCursorHistory.length - 1] : '';
            loadInventoryCategory(userId, assetTypeId, prevCursor, true); 
          }
        };
      }
      
      if (nextBtn) {
        nextBtn.style.visibility = currentAssetCursor ? 'visible' : 'hidden';
        nextBtn.onclick = () => {
          if (currentAssetCursor) {
            currentAssetPage++;
            assetCursorHistory.push(currentAssetCursor);
            loadInventoryCategory(userId, assetTypeId, currentAssetCursor);
          }
        };
      }
      
      paginationEl.style.display = (currentAssetPage > 1 || currentAssetCursor) ? 'block' : 'none';
    }
    
  } catch (error) {
    console.error('Failed to load inventory:', error);
    container.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #cc0000; padding: 20px;">Failed to load inventory.</td></tr>';
  }
}

async function loadInventoryBadges(userId, cursor = '', isGoingBack = false) {
  const container = document.getElementById('AssetsList');
  const paginationEl = document.getElementById('AssetsPagination');
  
  if (!container) return;
  
  try {
    const result = await window.roblox.getUserBadges(userId, 10, cursor);
    
    if (!result?.data || result.data.length === 0) {
      container.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #666; padding: 20px;">No items to display.</td></tr>';
      if (paginationEl) paginationEl.style.display = 'none';
      return;
    }

    const badgeIds = result.data.map(badge => badge.id);
    let thumbnails = {};
    try {
      const thumbResult = await window.roblox.getBadgeThumbnails(badgeIds, '150x150');
      if (thumbResult?.data) {
        thumbResult.data.forEach(t => {
          thumbnails[t.targetId] = t.imageUrl;
        });
      }
    } catch (e) {
      console.warn('Failed to load badge thumbnails:', e);
    }

    container.innerHTML = '';
    let currentRow = null;
    result.data.forEach((badge, index) => {
      if (index % 5 === 0) {
        currentRow = document.createElement('tr');
        container.appendChild(currentRow);
      }
      
      const thumb = thumbnails[badge.id] || 'images/spinners/spinner100x100.gif';
      
      const td = document.createElement('td');
      td.className = 'Asset';
      td.setAttribute('valign', 'top');
      td.innerHTML = `
        <div style="padding: 5px">
          <div class="AssetThumbnail" style="position: relative;">
            <a href="#badge?id=${badge.id}" title="${escapeHtml(badge.name || 'Badge')}" style="display:inline-block;height:110px;width:110px;cursor:pointer;">
              <img src="${thumb}" border="0" alt="${escapeHtml(badge.name || 'Badge')}" style="max-width:110px;max-height:110px;" onerror="this.src='images/spinners/spinner100x100.gif'"/>
            </a>
          </div>
          <div class="AssetDetails">
            <div class="AssetName">
              <a href="#badge?id=${badge.id}">${escapeHtml(badge.name || 'Badge')}</a>
            </div>
          </div>
        </div>
      `;
      currentRow.appendChild(td);
    });

    currentAssetCursor = result.nextPageCursor || '';
    
    if (paginationEl) {
      const prevBtn = document.getElementById('AssetsPrevPage');
      const nextBtn = document.getElementById('AssetsNextPage');
      const pageInfo = document.getElementById('AssetsPageInfo');
      
      if (pageInfo) pageInfo.textContent = `Page ${currentAssetPage}`;
      
      if (prevBtn) {
        prevBtn.style.visibility = currentAssetPage > 1 ? 'visible' : 'hidden';
        prevBtn.onclick = () => {
          if (currentAssetPage > 1) {
            currentAssetPage--;
            assetCursorHistory.pop();
            const prevCursor = assetCursorHistory.length > 0 ? assetCursorHistory[assetCursorHistory.length - 1] : '';
            loadInventoryBadges(userId, prevCursor, true);
          }
        };
      }
      
      if (nextBtn) {
        nextBtn.style.visibility = currentAssetCursor ? 'visible' : 'hidden';
        nextBtn.onclick = () => {
          if (currentAssetCursor) {
            currentAssetPage++;
            assetCursorHistory.push(currentAssetCursor);
            loadInventoryBadges(userId, currentAssetCursor);
          }
        };
      }
      
      paginationEl.style.display = (currentAssetPage > 1 || currentAssetCursor) ? 'block' : 'none';
    }
    
  } catch (error) {
    console.error('Failed to load badges:', error);
    container.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #cc0000; padding: 20px;">Failed to load badges.</td></tr>';
  }
}

async function loadStuffPage(userId) {
  const container = document.getElementById('stuff-content');
  if (!container) return;

  if (!userId) {
    try {
      const currentUser = await window.RobloxClient.api.getCurrentUser();
      if (currentUser && currentUser.id) {
        userId = currentUser.id;
      }
    } catch (e) {
      console.error('Could not get current user:', e);
    }
  }
  
  if (!userId) {
    container.innerHTML = `
      <div style="text-align: center; padding: 60px; color: #666;">
        <p style="font-size: 14px;">Please log in to view your inventory.</p>
      </div>
    `;
    return;
  }

  let userInfo = null;
  try {
    userInfo = await window.roblox.getUserInfo(userId);
  } catch (e) {
    console.error('Could not get user info:', e);
  }
  
  const username = userInfo?.displayName || userInfo?.name || 'User';

  container.innerHTML = `
    <div id="UserContainer">
      <div id="UserAssetsPane">
        <div class="StandardBoxHeader">
          <span>${escapeHtml(username)}'s Stuff</span>
        </div>
        <div id="StuffUserAssets" class="StandardBox">
          <div id="StuffAssetsMenu">
            <!-- Asset category buttons will be rendered here -->
          </div>
          <div id="StuffAssetsContent">
            <table id="StuffAssetsList" cellspacing="0" border="0" style="border-collapse:collapse;">
            </table>
          </div>
          <div id="StuffAssetsPagination" class="FooterPager" style="display: none;">
            <a id="StuffAssetsPrevPage" href="javascript:void(0)"><span class="NavigationIndicators">&lt;&lt;</span> Previous</a>
            <span id="StuffAssetsPageInfo" style="margin: 0 15px;">Page 1</span>
            <a id="StuffAssetsNextPage" href="javascript:void(0)">Next <span class="NavigationIndicators">&gt;&gt;</span></a>
          </div>
        </div>
      </div>
    </div>
  `;

  await renderStuffPageInventory(userId);

  const stuffContentEl = document.getElementById('stuff-content');
  if (stuffContentEl && !stuffContentEl.dataset.handlerAttached) {
    stuffContentEl.dataset.handlerAttached = 'true';
    stuffContentEl.addEventListener('click', (e) => {
      const link = e.target.closest('.stuff-item-link');
      if (link) {
        e.preventDefault();
        const assetId = link.dataset.assetId;
        if (assetId) {
          navigateToPage('catalog-item', { id: assetId });
        }
      }
    });
  }
}

let stuffCurrentCategory = 8; 
let stuffCurrentCursor = '';
let stuffCurrentPage = 1;
let stuffUserId = null;
let stuffCursorHistory = []; 

async function renderStuffPageInventory(userId) {
  stuffUserId = userId;
  stuffCursorHistory = []; 
  const menuContainer = document.getElementById('StuffAssetsMenu');
  const assetsContent = document.getElementById('StuffAssetsContent');
  if (!menuContainer) return;

  let canView = true;
  try {
    const result = await window.roblox.canViewInventory(userId);
    canView = result?.canView !== false;
  } catch (e) {
    console.warn('Could not check inventory visibility:', e);
  }
  
  if (!canView) {
    menuContainer.innerHTML = '';
    if (assetsContent) {
      assetsContent.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">This user\'s inventory is private.</div>';
    }
    return;
  }

  menuContainer.innerHTML = assetCategories.map(cat => `
    <div class="${cat.id === stuffCurrentCategory ? 'AssetsMenuItem_Selected' : 'AssetsMenuItem'}">
      <a href="javascript:void(0)" class="${cat.id === stuffCurrentCategory ? 'AssetsMenuButton_Selected' : 'AssetsMenuButton'}" 
         onclick="selectStuffCategory(${cat.id})">${cat.name}</a>
    </div>
  `).join('');

  await loadStuffCategory(userId, stuffCurrentCategory);
}

window.selectStuffCategory = async function(categoryId) {
  stuffCurrentCategory = categoryId;
  stuffCurrentCursor = '';
  stuffCurrentPage = 1;
  stuffCursorHistory = []; 

  const menuContainer = document.getElementById('StuffAssetsMenu');
  if (menuContainer) {
    menuContainer.innerHTML = assetCategories.map(cat => `
      <div class="${cat.id === stuffCurrentCategory ? 'AssetsMenuItem_Selected' : 'AssetsMenuItem'}">
        <a href="javascript:void(0)" class="${cat.id === stuffCurrentCategory ? 'AssetsMenuButton_Selected' : 'AssetsMenuButton'}" 
           onclick="selectStuffCategory(${cat.id})">${cat.name}</a>
      </div>
    `).join('');
  }
  
  await loadStuffCategory(stuffUserId, categoryId);
};

async function loadStuffCategory(userId, assetTypeId, cursor = '', isGoingBack = false) {
  const container = document.getElementById('StuffAssetsList');
  const paginationEl = document.getElementById('StuffAssetsPagination');

  if (!container) return;

  container.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Loading...</td></tr>';

  try {
    
    if (assetTypeId === 21) {
      await loadStuffBadges(userId, cursor, isGoingBack);
      return;
    }
    const result = await window.roblox.getUserInventory(userId, assetTypeId, 10, cursor, 'Desc');

    if (!result?.data || result.data.length === 0) {
      container.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #666; padding: 20px;">No items to display.</td></tr>';
      if (paginationEl) paginationEl.style.display = 'none';
      return;
    }

    const assetIds = result.data.map(item => item.assetId);
    let thumbnails = {};
    try {
      const thumbResult = await window.robloxAPI.getAssetThumbnails(assetIds, '110x110');
      if (thumbResult?.data) {
        thumbResult.data.forEach(t => {
          thumbnails[t.targetId] = t.imageUrl;
        });
      }
    } catch (e) {
      console.warn('Failed to load asset thumbnails:', e);
    }

    let itemDetails = {};
    try {
      const items = assetIds.map(id => ({ itemType: 'Asset', id: id }));
      const detailsResult = await window.roblox.getCatalogItemDetails(items);
      if (detailsResult?.data) {
        detailsResult.data.forEach(item => {
          itemDetails[item.id] = item;
        });
      }
    } catch (e) {
      console.warn('Failed to load catalog item details:', e);
    }

    const economyDetails = await fetchInventoryEconomyDetails(assetIds);

    container.innerHTML = '';
    let currentRow = null;
    result.data.forEach((item, index) => {
      if (index % 5 === 0) {
        currentRow = document.createElement('tr');
        container.appendChild(currentRow);
      }

      const thumb = thumbnails[item.assetId] || 'images/spinners/spinner100x100.gif';
      const details = itemDetails[item.assetId] || {};
      const ecoData = economyDetails[item.assetId] || {};
      const creatorName = details.creatorName || 'ROBLOX';
      const creatorType = details.creatorType || 'User';

      const restrictions = details.itemRestrictions || [];
      const isLimited = restrictions.includes('Limited') || restrictions.includes('Collectible') || ecoData.isLimited;
      const isLimitedUnique = restrictions.includes('LimitedUnique') || ecoData.isLimitedUnique;

      let limitedOverlay = '';
      if (isLimitedUnique) {
        limitedOverlay = '<img src="images/assetIcons/limitedunique.png" class="limited-overlay" alt="Limited U"/>';
      } else if (isLimited) {
        limitedOverlay = '<img src="images/assetIcons/limited.png" class="limited-overlay" alt="Limited"/>';
      }

      const priceHtml = buildInventoryPriceHtml(details, ecoData);

      const td = document.createElement('td');
      td.className = 'Asset';
      td.setAttribute('valign', 'top');
      td.innerHTML = `
        <div style="padding: 5px">
          <div class="AssetThumbnail" style="position: relative;">
            <a href="javascript:void(0)" data-asset-id="${item.assetId}" class="stuff-item-link" title="${escapeHtml(item.assetName || item.name || 'Item')}" style="display:inline-block;height:110px;width:110px;cursor:pointer;">
              <img src="${thumb}" border="0" alt="${escapeHtml(item.assetName || item.name || 'Item')}" onerror="this.src='images/spinners/spinner100x100.gif'"/>
            </a>
            ${limitedOverlay}
          </div>
          <div class="AssetDetails">
            <div class="AssetName">
              <a href="javascript:void(0)" data-asset-id="${item.assetId}" class="stuff-item-link">${escapeHtml(item.assetName || item.name || 'Item')}</a>
            </div>
            <div class="AssetCreator">
              <span class="Label">Creator:</span> <span class="Detail">
                <a href="${creatorType === 'Group' ? '#group?id=' + details.creatorTargetId : '#profile?id=' + details.creatorTargetId}">${escapeHtml(creatorName)}</a>
              </span>
            </div>
            ${priceHtml}
          </div>
        </div>
      `;
      currentRow.appendChild(td);
    });

    stuffCurrentCursor = result.nextPageCursor || '';
    
    if (paginationEl) {
      const prevBtn = document.getElementById('StuffAssetsPrevPage');
      const nextBtn = document.getElementById('StuffAssetsNextPage');
      const pageInfo = document.getElementById('StuffAssetsPageInfo');
      
      if (pageInfo) pageInfo.textContent = `Page ${stuffCurrentPage}`;
      
      if (prevBtn) {
        prevBtn.style.visibility = stuffCurrentPage > 1 ? 'visible' : 'hidden';
        prevBtn.onclick = () => {
          if (stuffCurrentPage > 1) {
            stuffCurrentPage--;
            
            stuffCursorHistory.pop();
            const prevCursor = stuffCursorHistory.length > 0 ? stuffCursorHistory[stuffCursorHistory.length - 1] : '';
            loadStuffCategory(userId, assetTypeId, prevCursor, true); 
          }
        };
      }
      
      if (nextBtn) {
        nextBtn.style.visibility = stuffCurrentCursor ? 'visible' : 'hidden';
        nextBtn.onclick = () => {
          if (stuffCurrentCursor) {
            stuffCurrentPage++;
            stuffCursorHistory.push(stuffCurrentCursor);
            loadStuffCategory(userId, assetTypeId, stuffCurrentCursor);
          }
        };
      }
      
      paginationEl.style.display = (stuffCurrentPage > 1 || stuffCurrentCursor) ? 'block' : 'none';
    }
    
  } catch (error) {
    console.error('Failed to load inventory:', error);
    container.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #cc0000; padding: 20px;">Failed to load inventory.</td></tr>';
  }
}

async function loadStuffBadges(userId, cursor = '', isGoingBack = false) {
  const container = document.getElementById('StuffAssetsList');
  const paginationEl = document.getElementById('StuffAssetsPagination');
  
  if (!container) return;
  
  try {
    const result = await window.roblox.getUserBadges(userId, 10, cursor);
    
    if (!result?.data || result.data.length === 0) {
      container.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #666; padding: 20px;">No items to display.</td></tr>';
      if (paginationEl) paginationEl.style.display = 'none';
      return;
    }

    const badgeIds = result.data.map(badge => badge.id);
    let thumbnails = {};
    try {
      const thumbResult = await window.roblox.getBadgeThumbnails(badgeIds, '150x150');
      if (thumbResult?.data) {
        thumbResult.data.forEach(t => {
          thumbnails[t.targetId] = t.imageUrl;
        });
      }
    } catch (e) {
      console.warn('Failed to load badge thumbnails:', e);
    }

    container.innerHTML = '';
    let currentRow = null;
    result.data.forEach((badge, index) => {
      if (index % 5 === 0) {
        currentRow = document.createElement('tr');
        container.appendChild(currentRow);
      }
      
      const thumb = thumbnails[badge.id] || 'images/spinners/spinner100x100.gif';
      
      const td = document.createElement('td');
      td.className = 'Asset';
      td.setAttribute('valign', 'top');
      td.innerHTML = `
        <div style="padding: 5px">
          <div class="AssetThumbnail" style="position: relative;">
            <a href="#badge?id=${badge.id}" title="${escapeHtml(badge.name || 'Badge')}" style="display:inline-block;height:110px;width:110px;cursor:pointer;">
              <img src="${thumb}" border="0" alt="${escapeHtml(badge.name || 'Badge')}" style="max-width:110px;max-height:110px;" onerror="this.src='images/spinners/spinner100x100.gif'"/>
            </a>
          </div>
          <div class="AssetDetails">
            <div class="AssetName">
              <a href="#badge?id=${badge.id}">${escapeHtml(badge.name || 'Badge')}</a>
            </div>
          </div>
        </div>
      `;
      currentRow.appendChild(td);
    });

    stuffCurrentCursor = result.nextPageCursor || '';
    
    if (paginationEl) {
      const prevBtn = document.getElementById('StuffAssetsPrevPage');
      const nextBtn = document.getElementById('StuffAssetsNextPage');
      const pageInfo = document.getElementById('StuffAssetsPageInfo');
      
      if (pageInfo) pageInfo.textContent = `Page ${stuffCurrentPage}`;
      
      if (prevBtn) {
        prevBtn.style.visibility = stuffCurrentPage > 1 ? 'visible' : 'hidden';
        prevBtn.onclick = () => {
          if (stuffCurrentPage > 1) {
            stuffCurrentPage--;
            stuffCursorHistory.pop();
            const prevCursor = stuffCursorHistory.length > 0 ? stuffCursorHistory[stuffCursorHistory.length - 1] : '';
            loadStuffBadges(userId, prevCursor, true);
          }
        };
      }
      
      if (nextBtn) {
        nextBtn.style.visibility = stuffCurrentCursor ? 'visible' : 'hidden';
        nextBtn.onclick = () => {
          if (stuffCurrentCursor) {
            stuffCurrentPage++;
            stuffCursorHistory.push(stuffCurrentCursor);
            loadStuffBadges(userId, stuffCurrentCursor);
          }
        };
      }
      
      paginationEl.style.display = (stuffCurrentPage > 1 || stuffCurrentCursor) ? 'block' : 'none';
    }
    
  } catch (error) {
    console.error('Failed to load badges:', error);
    container.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #cc0000; padding: 20px;">Failed to load badges.</td></tr>';
  }
}

  async function loadFriendsPage(userId) {
    const container = document.getElementById('friends-content');
    if (!container) return;

    if (!userId) {
      container.innerHTML = `
        <div style="text-align: center; padding: 60px; color: #666;">
          <p style="font-size: 14px;">No user specified.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div id="FriendsLoading" style="text-align: center; padding: 60px;">
        <div class="loading">Loading friends...</div>
      </div>
      <div id="FriendsError" style="display: none; text-align: center; padding: 60px; color: #cc0000;">
        <p>Failed to load friends.</p>
      </div>
      <div class="MyRobloxContainer" id="FriendsContent" style="display: none; padding: 10px;">
        <div class="StandardTabWhite">
          <span id="FriendsPageHeader">User's Friends</span>
        </div>
        <div class="StandardBoxWhite">
          <div id="FriendsPagerTop" style="text-align:center; padding: 5px; margin-bottom: 10px;"></div>
          <div id="FriendsGridContainer">
            <div id="NoFriendsMessage" style="display: none; text-align: center; padding: 20px;">This user has no friends.</div>
            <table id="FriendsTable" cellspacing="0" align="Center" border="0" style="border-collapse:collapse; width: 100%;"></table>
          </div>
          <div id="FriendsPagerBottom" style="text-align:center; padding: 5px; margin-top: 10px;"></div>
        </div>
      </div>
    `;

    if (window.FriendsPage) {
      window.FriendsPage.load();
    }
  }

  function loadPeoplePage() {
  const container = document.getElementById('people-content');
  if (container) {
    container.innerHTML = `
      <div id="BrowseContainer" style="font-family: Verdana, Sans-Serif; text-align: left">
        <!-- Search Bar - matching Group Details style -->
        <div id="SearchControls" class="StandardBox" style="width: 876px; height: 28px; margin-left: -4px; clear: both; display: block; background-color: #006699;">
          <table width="876px" border="0">
            <tr>
              <td style="font-family: Verdana, Helvetica, Sans-Serif; font-size: 12pt; color: Black; font-weight: bold; width: 200px; text-align: left;">
                Search
              </td>
              <td style="width: 660px; text-align: right;">
                <input type="text" id="peopleSearchInput" style="width: 520px;" maxlength="100" value="Search all users" onclick="if(this.value=='Search all users') this.value='';">
                <input type="submit" id="peopleSearchBtn" value="Search">
              </td>
            </tr>
          </table>
        </div>
        
        <div id="peopleSearchError" class="SearchError" style="display:none; color: red; padding: 10px;"></div>
        
        <div id="peopleSearchInitial" class="search-initial-text" style="text-align: center; padding: 60px;">
          <p style="font-size: 14px;">Search for users by entering a username above.</p>
        </div>
        <div id="peopleSearchLoading" style="display: none; text-align: center; padding: 60px;">
          <div class="loading">Searching...</div>
        </div>
        <div id="peopleSearchResults" style="display: none;">
          <div class="StandardBoxHeader" style="margin-top: 10px;">
            <span id="peopleResultsHeader">Search Results</span>
          </div>
          <div class="StandardBox" id="peopleResultsList" style="padding: 10px;"></div>
        </div>
        <div id="peopleNoResults" class="search-initial-text" style="display: none; text-align: center; padding: 60px;">
          <p style="font-size: 14px;">No users found matching your search.</p>
        </div>
      </div>
    `;

    initPeopleSearch();
  }
}

function initPeopleSearch() {
  
  setTimeout(() => {
    const searchBtn = document.getElementById('peopleSearchBtn');
    const searchInput = document.getElementById('peopleSearchInput');
    
    if (searchBtn) {
      searchBtn.onclick = doPeopleSearch;
    }
    if (searchInput) {
      searchInput.onkeypress = (e) => {
        if (e.key === 'Enter') doPeopleSearch();
      };
      searchInput.focus();
    }
  }, 0);
}

async function doPeopleSearch() {
  const input = document.getElementById('peopleSearchInput');
  let query = input?.value.trim();

  if (!query || query === 'Search all users') {
    document.getElementById('peopleSearchError').textContent = 'Please enter a username to search.';
    document.getElementById('peopleSearchError').style.display = 'block';
    return;
  }

  document.getElementById('peopleSearchError').style.display = 'none';
  document.getElementById('peopleSearchInitial').style.display = 'none';
  document.getElementById('peopleSearchResults').style.display = 'none';
  document.getElementById('peopleNoResults').style.display = 'none';
  document.getElementById('peopleSearchLoading').style.display = 'block';
  
  try {
    const result = await window.roblox.searchUsers(query, 12);
    
    document.getElementById('peopleSearchLoading').style.display = 'none';
    
    if (!result || !result.data || result.data.length === 0) {
      document.getElementById('peopleNoResults').style.display = 'block';
      return;
    }

    const userIds = result.data.map(u => u.id);
    let thumbnails = {};
    try {
      const thumbResult = await window.roblox.getUserThumbnails(userIds, '150x150', 'Headshot');
      if (thumbResult?.data) {
        thumbResult.data.forEach(t => {
          thumbnails[t.targetId] = t.imageUrl;
        });
      }
    } catch (e) {
      console.warn('Failed to load thumbnails:', e);
    }

    const container = document.getElementById('peopleResultsList');
    container.innerHTML = '';
    
    for (const user of result.data) {
      const thumb = thumbnails[user.id] || 'assets/ui/guest.png';
      const div = document.createElement('div');
      div.className = 'UserSearchResult';
      div.style.cssText = 'display: inline-block; width: 140px; margin: 10px; text-align: center; vertical-align: top;';
      div.innerHTML = `
        <div class="UserThumbnail" style="margin-bottom: 5px; position: relative; display: inline-block;">
          <a href="#profile?id=${user.id}" style="cursor: pointer;">
            <img src="${thumb}" alt="${escapeHtml(user.name)}" 
                 style="width: 100px; height: 100px; border: 1px solid #ccc;"
                 onerror="this.src='assets/ui/guest.png'"/>
          </a>
        </div>
        <div class="UserName" style="font-weight: bold; font-size: 12px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
          <a href="#profile?id=${user.id}">${escapeHtml(user.name)}</a>
        </div>
        <div class="UserDisplayName" style="font-size: 11px; color: #666; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
          ${user.displayName !== user.name ? escapeHtml(user.displayName) : ''}
        </div>
      `;
      container.appendChild(div);

      const thumbContainer = div.querySelector('.UserThumbnail');
      if (thumbContainer) {
        addObcOverlayIfPremium(thumbContainer, user.id, { bottom: '3px', left: '1px' });
      }
    }
    
    document.getElementById('peopleResultsHeader').textContent = `Search Results for "${query}"`;
    document.getElementById('peopleSearchResults').style.display = 'block';
    
  } catch (error) {
    console.error('Search error:', error);
    document.getElementById('peopleSearchLoading').style.display = 'none';
    document.getElementById('peopleSearchError').textContent = 'Failed to search users. Please try again.';
    document.getElementById('peopleSearchError').style.display = 'block';
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDescription(text) {
  if (!text) return '';
  return escapeHtml(text).replace(/\n/g, '<br>');
}

window.formatDescription = formatDescription;

function formatNumber(num) {
  if (num === undefined || num === null) return '0';
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
  } else if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toLocaleString();
}

function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'className') {
      el.className = value;
    } else if (key === 'textContent') {
      el.textContent = value;
    } else if (key === 'innerHTML') {
      el.innerHTML = value;
    } else if (key.startsWith('on')) {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else {
      el.setAttribute(key, value);
    }
  }
  children.forEach(child => {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else if (child) {
      el.appendChild(child);
    }
  });
  return el;
}

function showLoading(container) {
  container.innerHTML = '<div class="loading">Loading...</div>';
}

function showError(container, message) {
  container.innerHTML = `<div class="error">${message}</div>`;
}

function showErrorPage(errorReason, containerId) {
  
  let container;
  if (containerId) {
    container = document.getElementById(containerId);
  }

  if (!container) {
    container = document.getElementById('home-content') ||
                document.getElementById('catalog-content') ||
                document.getElementById('games-content') ||
                document.getElementById('profile-content') ||
                document.getElementById('friends-content') ||
                document.getElementById('groups-content') ||
                document.getElementById('inbox-content') ||
                document.getElementById('character-content') ||
                document.getElementById('badge-content') ||
                document.getElementById('bc-content') ||
                document.getElementById('people-content') ||
                document.querySelector('#Body > div[id$="-content"]') ||
                document.getElementById('Body');
  }

  if (!container) {
    console.error('Could not find container to show error page');
    return;
  }

  container.innerHTML = '';
  
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-page';
  errorDiv.style.cssText = 'text-align: center; padding: 40px 20px; font-family: Arial, Helvetica, sans-serif;';
  
  const h1 = document.createElement('h1');
  h1.className = 'error-page-title';
  h1.style.cssText = 'font-size: 24px; font-weight: bold; margin: 0 0 10px 0;';
  h1.textContent = 'Oops - page failure';
  
  const p = document.createElement('p');
  p.className = 'error-page-message';
  p.style.cssText = 'font-size: 18px; font-weight: bold; margin: 0 0 30px 0;';
  p.textContent = 'Error: ' + errorReason;
  
  const img = document.createElement('img');
  img.src = 'images/page_failure.png';
  img.alt = 'Error';
  img.style.cssText = 'margin: 20px 0;';
  
  const br = document.createElement('br');
  
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.style.cssText = 'display: inline-block; background-color: #0066cc; color: #fff; font-weight: bold; font-size: 14px; padding: 8px 20px; text-decoration: none; border: 2px outset #6699cc; cursor: pointer; margin-top: 20px;';
  btn.textContent = 'Go Back';
  btn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    navigateTo('home');
  });
  
  errorDiv.appendChild(h1);
  errorDiv.appendChild(p);
  errorDiv.appendChild(img);
  errorDiv.appendChild(br);
  errorDiv.appendChild(btn);
  
  container.appendChild(errorDiv);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

window.showErrorPage = showErrorPage;

let lastErrorTime = 0;
const ERROR_DEBOUNCE_MS = 2000;

function showErrorNotification(message) {
  
  const existing = document.getElementById('error-notification');
  if (existing) existing.remove();
  
  const notification = document.createElement('div');
  notification.id = 'error-notification';
  notification.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: #cc0000; color: white; padding: 12px 20px; border-radius: 4px; z-index: 10000; font-family: Arial, sans-serif; font-size: 12px; max-width: 400px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);';
  notification.textContent = message;

  const closeBtn = document.createElement('span');
  closeBtn.textContent = ' ×';
  closeBtn.style.cssText = 'cursor: pointer; font-weight: bold; margin-left: 10px;';
  closeBtn.onclick = () => notification.remove();
  notification.appendChild(closeBtn);
  
  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentNode) notification.remove();
  }, 8000);
}
window.showErrorNotification = showErrorNotification;

function isCriticalError(error, filename) {
  
  if (filename && /\.(png|gif|jpg|jpeg|svg|ico|css)$/i.test(filename)) {
    return false;
  }

  if (error?.message?.includes('ResizeObserver')) {
    return false;
  }

  if (error instanceof SyntaxError || error instanceof ReferenceError || error instanceof TypeError) {
    return true;
  }

  const criticalPatterns = ['Cannot read', 'is not defined', 'is not a function', 'Failed to fetch', 'NetworkError'];
  if (error?.message && criticalPatterns.some(p => error.message.includes(p))) {
    return true;
  }
  
  return false;
}

function findActiveContentContainer() {
  
  const activePage = document.querySelector('.page.active');
  if (activePage) {
    const contentId = activePage.id.replace('page-', '') + '-content';
    const content = document.getElementById(contentId);
    if (content) return content;
  }

  return document.querySelector('[id$="-content"]:not(:empty)') ||
         document.getElementById('Body');
}

window.addEventListener('error', function(event) {
  console.error('Uncaught error:', event.error || event.message);

  const now = Date.now();
  if (now - lastErrorTime < ERROR_DEBOUNCE_MS) return;
  lastErrorTime = now;

  if (!event.error && event.message) {
    const isSyntaxError = event.message.includes('SyntaxError') || 
                          event.message.includes('Unexpected token') ||
                          event.message.includes('Unexpected identifier') ||
                          event.message.includes('Unexpected end of input') ||
                          event.message.includes('Invalid or unexpected token');
    
    if (isSyntaxError) {
      const filename = event.filename ? event.filename.split('/').pop() : 'unknown';
      const errorMsg = `Syntax error in ${filename} (line ${event.lineno}): ${event.message}`;
      console.error('Syntax error detected:', errorMsg);
      
      const container = findActiveContentContainer();
      if (container && window.showErrorPage) {
        window.showErrorPage(errorMsg, container.id);
      }
      return;
    }
  }

  if (!event.error) return;
  
  const errorMessage = event.error.message || 'Unknown error';
  
  if (isCriticalError(event.error, event.filename)) {
    
    const container = findActiveContentContainer();
    if (container && window.showErrorPage) {
      window.showErrorPage('JavaScript error: ' + errorMessage, container.id);
    }
  } else {
    
    showErrorNotification('Error: ' + errorMessage);
  }
});

window.addEventListener('unhandledrejection', function(event) {
  console.error('Unhandled promise rejection:', event.reason);

  const now = Date.now();
  if (now - lastErrorTime < ERROR_DEBOUNCE_MS) return;
  lastErrorTime = now;
  
  const reason = event.reason?.message || String(event.reason);

  if (!reason || reason === 'undefined' || reason === '[object Object]') return;

  const isCritical = reason.includes('Failed to fetch') || 
                     reason.includes('NetworkError') ||
                     reason.includes('net::ERR_') ||
                     reason.includes('ECONNREFUSED');
  
  if (isCritical) {
    const container = findActiveContentContainer();
    if (container && window.showErrorPage) {
      window.showErrorPage('Network error: ' + reason, container.id);
    }
  } else {
    
    showErrorNotification('Error: ' + reason);
  }
});

window.addEventListener('offline', function() {
  console.warn('Network connection lost');
  
  const notification = document.createElement('div');
  notification.id = 'offline-notification';
  notification.style.cssText = 'position: fixed; top: 30px; left: 50%; transform: translateX(-50%); background: #cc0000; color: white; padding: 10px 20px; border-radius: 4px; z-index: 10000; font-family: Arial, sans-serif; font-size: 12px;';
  notification.textContent = 'You are offline. Some features may not work.';
  document.body.appendChild(notification);
});

window.addEventListener('online', function() {
  console.log('Network connection restored');
  const notification = document.getElementById('offline-notification');
  if (notification) {
    notification.remove();
  }
});

let gameLaunchCancelled = false;

function showGameLaunchOverlay(statusText = 'Starting Roblox...') {
    gameLaunchCancelled = false;
    const overlay = document.getElementById('game-launch-overlay');
    const statusEl = document.getElementById('game-launch-status');
    const cancelBtn = document.getElementById('game-launch-cancel');
    
    if (overlay) {
        if (statusEl) statusEl.textContent = statusText;
        
        overlay.style.display = 'flex';

        if (cancelBtn) {
            cancelBtn.onclick = async (e) => {
                e.preventDefault();
                gameLaunchCancelled = true;

                if (statusEl) statusEl.textContent = 'Cancelling...';

                try {
                    if (window.roblox?.cancelGameLaunch) {
                        await window.roblox.cancelGameLaunch();
                        console.log('Game launch cancelled via API');
                    } else if (window.robloxAPI?.cancelGameLaunch) {
                        await window.robloxAPI.cancelGameLaunch();
                        console.log('Game launch cancelled via robloxAPI');
                    }
                } catch (err) {
                    console.error('Error cancelling game launch:', err);
                }
                
                hideGameLaunchOverlay();
            };
        }
    } else {
        console.error('[Overlay] Game launch overlay element not found!');
    }
}

function updateGameLaunchStatus(statusText) {
    const statusEl = document.getElementById('game-launch-status');
    if (statusEl) statusEl.textContent = statusText;
}

function hideGameLaunchOverlay() {
    const overlay = document.getElementById('game-launch-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function isGameLaunchCancelled() {
    return gameLaunchCancelled;
}

function autoHideGameLaunchOverlay(delay = 5000) {
    setTimeout(() => {
        if (!gameLaunchCancelled) {
            hideGameLaunchOverlay();
        }
    }, delay);
}

window.showGameLaunchOverlay = showGameLaunchOverlay;
window.updateGameLaunchStatus = updateGameLaunchStatus;
window.hideGameLaunchOverlay = hideGameLaunchOverlay;
window.isGameLaunchCancelled = isGameLaunchCancelled;
window.autoHideGameLaunchOverlay = autoHideGameLaunchOverlay;


// ============================================
// Party Game Launch Toast Notification
// ============================================

/**
 * Show a toast notification for party game launches
 * @param {Object} data - Game launch data { gameName, gameThumbnail, countdown, placeId }
 */
function showPartyGameLaunchToast(data) {
    // Remove any existing toast
    const existingToast = document.getElementById('party-game-toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.id = 'party-game-toast';
    toast.className = 'party-game-toast';
    
    const thumbnailHtml = data.gameThumbnail 
        ? `<img src="${data.gameThumbnail}" alt="${data.gameName}" class="toast-game-icon" onerror="this.style.display='none'">`
        : '<div class="toast-game-icon-placeholder"></div>';
    
    toast.innerHTML = `
        <div class="toast-content">
            ${thumbnailHtml}
            <div class="toast-text">
                <div class="toast-title">Party Game Launch</div>
                <div class="toast-game-name">${data.gameName || 'Unknown Game'}</div>
                <div class="toast-countdown">Launching in <span id="toast-countdown-num">${data.countdown || 5}</span>s...</div>
            </div>
        </div>
    `;
    
    // Add styles if not already present
    if (!document.getElementById('party-toast-styles')) {
        const style = document.createElement('style');
        style.id = 'party-toast-styles';
        style.textContent = `
            .party-game-toast {
                position: fixed;
                top: 80px;
                right: 20px;
                background: linear-gradient(135deg, #003366 0%, #004080 100%);
                border: 2px solid #0066cc;
                border-radius: 4px;
                padding: 12px;
                z-index: 100000;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
                animation: toast-slide-in 0.3s ease-out;
                max-width: 300px;
                font-family: Arial, sans-serif;
            }
            
            @keyframes toast-slide-in {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            .party-game-toast .toast-content {
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .party-game-toast .toast-game-icon {
                width: 56px;
                height: 56px;
                border-radius: 4px;
                object-fit: cover;
                flex-shrink: 0;
                border: 1px solid #0066cc;
            }
            
            .party-game-toast .toast-game-icon-placeholder {
                width: 56px;
                height: 56px;
                border-radius: 4px;
                background: #002244;
                flex-shrink: 0;
                border: 1px solid #0066cc;
            }
            
            .party-game-toast .toast-text {
                flex: 1;
                min-width: 0;
            }
            
            .party-game-toast .toast-title {
                font-size: 11px;
                color: #66b3ff;
                font-weight: bold;
                text-transform: uppercase;
                margin-bottom: 2px;
            }
            
            .party-game-toast .toast-game-name {
                font-size: 14px;
                color: #fff;
                font-weight: bold;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin-bottom: 2px;
            }
            
            .party-game-toast .toast-countdown {
                font-size: 12px;
                color: #99ccff;
            }
            
            .party-game-toast .toast-countdown span {
                color: #ffcc00;
                font-weight: bold;
            }
            
            .party-game-toast.toast-fade-out {
                animation: toast-fade-out 0.3s ease-in forwards;
            }
            
            @keyframes toast-fade-out {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    // Countdown timer
    let countdown = data.countdown || 5;
    const countdownEl = document.getElementById('toast-countdown-num');
    
    const countdownInterval = setInterval(() => {
        countdown--;
        if (countdownEl) {
            countdownEl.textContent = countdown;
        }
        
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            toast.classList.add('toast-fade-out');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }
    }, 1000);
    
    // Store interval for cleanup
    toast.dataset.intervalId = countdownInterval;
}

/**
 * Initialize party event listeners for themes
 */
function initPartyListeners() {
    if (window.roblox?.party?.onGameLaunching) {
        const cleanup = window.roblox.party.onGameLaunching((data) => {
            console.log('[2011 Theme] Party game launching:', data);
            showPartyGameLaunchToast(data);
            
            // Also launch the game after countdown
            if (data.placeId) {
                setTimeout(() => {
                    if (window.roblox?.launchGameDirect) {
                        window.roblox.launchGameDirect(data.placeId, data.gameName, data.gameThumbnail);
                    } else if (window.robloxAPI?.launchGameDirect) {
                        window.robloxAPI.launchGameDirect(data.placeId, data.gameName, data.gameThumbnail);
                    }
                }, (data.countdown || 5) * 1000);
            }
        });
        
        // Store cleanup function for later
        window._partyCleanup = cleanup;
    }
}

// Initialize party listeners when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPartyListeners);
} else {
    initPartyListeners();
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window._partyCleanup) {
        window._partyCleanup();
    }
});

// Export for external use
window.showPartyGameLaunchToast = showPartyGameLaunchToast;
