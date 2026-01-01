

(function() {
  'use strict';

  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        const src = img.dataset.src;
        if (src) {
          img.src = src;
          img.removeAttribute('data-src');
          img.classList.remove('lazy');
          img.classList.add('lazy-loaded');
        }
        observer.unobserve(img);
      }
    });
  }, {
    rootMargin: '100px', 
    threshold: 0.01
  });

  function makeLazy(img, src) {
    if (!src) return;
    img.dataset.src = src;
    img.classList.add('lazy');
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; 
    imageObserver.observe(img);
  }

  function observeLazyImages(container) {
    const images = container.querySelectorAll('img[data-src]');
    images.forEach(img => imageObserver.observe(img));
  }

  function unobserveLazyImages(container) {
    const images = container.querySelectorAll('img.lazy, img[data-src]');
    images.forEach(img => imageObserver.unobserve(img));
  }

  const pageListeners = new Map();

  function addPageListener(pageId, element, event, handler, options) {
    if (!pageListeners.has(pageId)) {
      pageListeners.set(pageId, []);
    }
    element.addEventListener(event, handler, options);
    pageListeners.get(pageId).push({ element, event, handler, options });
    console.log(`[Performance] Added ${event} listener for page: ${pageId}, total: ${pageListeners.get(pageId).length}`);
  }

  function cleanupPageListeners(pageId) {
    const listeners = pageListeners.get(pageId);
    if (listeners) {
      console.log(`[Performance] Cleaning up ${listeners.length} listeners for page: ${pageId}`);
      listeners.forEach(({ element, event, handler, options }) => {
        element.removeEventListener(event, handler, options);
      });
      pageListeners.delete(pageId);
    } else {
      console.log(`[Performance] No listeners to clean up for page: ${pageId}`);
    }
  }

  class LRUCache {
    constructor(maxSize = 50, ttl = 10 * 60 * 1000) {
      this.maxSize = maxSize;
      this.ttl = ttl;
      this.cache = new Map();
    }

    get(key) {
      const entry = this.cache.get(key);
      if (!entry) return undefined;

      if (Date.now() - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        return undefined;
      }

      this.cache.delete(key);
      this.cache.set(key, entry);
      return entry.value;
    }

    set(key, value) {
      
      if (this.cache.has(key)) {
        this.cache.delete(key);
      }

      while (this.cache.size >= this.maxSize) {
        const oldestKey = this.cache.keys().next().value;
        this.cache.delete(oldestKey);
      }

      this.cache.set(key, { value, timestamp: Date.now() });
    }

    has(key) {
      return this.get(key) !== undefined;
    }

    delete(key) {
      return this.cache.delete(key);
    }

    clear() {
      this.cache.clear();
    }

    get size() {
      return this.cache.size;
    }
  }

  const pageAbortControllers = new Map();

  function getPageAbortController(pageId) {
    if (!pageAbortControllers.has(pageId)) {
      pageAbortControllers.set(pageId, new AbortController());
    }
    return pageAbortControllers.get(pageId);
  }

  function abortPageRequests(pageId) {
    const controller = pageAbortControllers.get(pageId);
    if (controller) {
      controller.abort();
      pageAbortControllers.delete(pageId);
    }
  }

  function getPageSignal(pageId) {
    return getPageAbortController(pageId).signal;
  }

  const pageCleanupFunctions = new Map();

  function registerCleanup(pageId, cleanupFn) {
    if (!pageCleanupFunctions.has(pageId)) {
      pageCleanupFunctions.set(pageId, []);
    }
    pageCleanupFunctions.get(pageId).push(cleanupFn);
  }

  function cleanupPage(pageId) {
    
    const cleanups = pageCleanupFunctions.get(pageId);
    if (cleanups) {
      cleanups.forEach(fn => {
        try { fn(); } catch (e) { console.warn('Cleanup error:', e); }
      });
      pageCleanupFunctions.delete(pageId);
    }

    cleanupPageListeners(pageId);

    abortPageRequests(pageId);

    const pageEl = document.getElementById(`page-${pageId}`);
    if (pageEl) {
      unobserveLazyImages(pageEl);
    }
  }

  function clearContainer(container) {
    
    unobserveLazyImages(container);

    container.innerHTML = '';
  }

  function throttle(fn, delay) {
    let lastCall = 0;
    return function(...args) {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        return fn.apply(this, args);
      }
    };
  }

  function debounce(fn, delay) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function getMemoryUsage() {
    if (performance.memory) {
      return {
        usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1048576),
        totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1048576)
      };
    }
    return null;
  }

  const registeredCaches = [];

  function registerCache(cache) {
    if (cache && typeof cache.clear === 'function') {
      registeredCaches.push(cache);
    }
  }

  function runMemoryCleanup() {
    let clearedCount = 0;
    registeredCaches.forEach(cache => {
      if (cache && cache.cache instanceof Map) {
        const now = Date.now();
        for (const [key, entry] of cache.cache.entries()) {
          if (entry.timestamp && now - entry.timestamp > cache.ttl) {
            cache.cache.delete(key);
            clearedCount++;
          }
        }
      }
    });

    for (const [pageId, listeners] of pageListeners.entries()) {
      if (!listeners || listeners.length === 0) {
        pageListeners.delete(pageId);
      }
    }
    
    return clearedCount;
  }

  const memoryCleanupInterval = setInterval(runMemoryCleanup, 2 * 60 * 1000);

  function cleanup() {
    if (memoryCleanupInterval) {
      clearInterval(memoryCleanupInterval);
    }
  }

  window.Performance = {

    makeLazy,
    observeLazyImages,
    unobserveLazyImages,

    addPageListener,
    cleanupPageListeners,

    LRUCache,
    registerCache,

    getPageAbortController,
    abortPageRequests,
    getPageSignal,

    registerCleanup,
    cleanupPage,

    clearContainer,

    throttle,
    debounce,

    getMemoryUsage,
    runMemoryCleanup,

    cleanup
  };

  window.PerformanceUtils = window.Performance;

})();
