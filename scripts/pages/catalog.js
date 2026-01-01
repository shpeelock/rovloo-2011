
(function() {
    'use strict';

    let catalogLoaded = false;
    let currentMode = 'Classic';
    let currentCategory = 'All';
    let currentSubcategory = '';
    let currentPage = 1;
    let currentCursor = '';
    let currentKeyword = '';
    let totalPages = 1;
    const itemsPerPage = 30;

    let currentSalesType = 'All';

    let currentTimeFilter = 'AllTime';

    let classicItemsList = null;

    let cursorHistory = [''];
    let isLoadingPage = false;

    let economyWorker = null;
    let workerTaskId = 0;
    const workerCallbacks = new Map();

    function initWorker() {
        if (!economyWorker) {
            try {
                economyWorker = new Worker('scripts/workers/economy-worker.js');
                economyWorker.addEventListener('message', function(e) {
                    const { id, success, result, error } = e.data;
                    const callback = workerCallbacks.get(id);
                    if (callback) {
                        workerCallbacks.delete(id);
                        if (success) {
                            callback.resolve(result);
                        } else {
                            callback.reject(new Error(error));
                        }
                    }
                });
                economyWorker.addEventListener('error', function(e) {
                    console.error('[Catalog] Worker error:', e.message);
                });
                console.log('[Catalog] Economy worker initialized');
            } catch (e) {
                console.warn('[Catalog] Failed to initialize worker:', e);
            }
        }
    }

    function runWorkerTask(type, data) {
        if (!economyWorker) return Promise.reject(new Error('Worker not initialized'));

        return new Promise((resolve, reject) => {
            const id = ++workerTaskId;
            workerCallbacks.set(id, { resolve, reject });
            economyWorker.postMessage({ type, data, id });
        });
    }

    const categoryMap = {
        'All': { categoryFilter: null },
        'Hats': { categoryFilter: 8 },
        'Hair': { categoryFilter: 41 },
        'Face': { categoryFilter: 42 },
        'Neck': { categoryFilter: 43 },
        'Shoulder': { categoryFilter: 44 },
        'Front': { categoryFilter: 45 },
        'Back': { categoryFilter: 46 },
        'Waist': { categoryFilter: 47 },
        'Gear': { categoryFilter: 19 },
        'Faces': { categoryFilter: 18 },
        'Packages': { categoryFilter: null, subcategory: 'Bundles' }, 
        'Heads': { categoryFilter: 17 },
        'T-Shirts': { categoryFilter: 2 },
        'Shirts': { categoryFilter: 11 },
        'Pants': { categoryFilter: 12 },
        'Emotes': { categoryFilter: 61 },
        'Animations': { categoryFilter: null, taxonomy: 'whf6kUVBwk2xdwKUmRYN6G' },
        
        '3D T-Shirts': { categoryFilter: null, taxonomy: 'fLRqNzGqjX7MzcqeMro9hc' },
        '3D Shirts': { categoryFilter: null, taxonomy: 'pJ71PxerdfEuarTNRtSZYs' },
        'Sweaters': { categoryFilter: null, taxonomy: '31M6WgEMmyq9TTfk3pUUpZ' },
        'Jackets': { categoryFilter: null, taxonomy: 'kPZpEVNdProGcqMbj1jDKJ' },
        '3D Pants': { categoryFilter: null, taxonomy: '1MvRtnnsy2FJWmkErSBxBa' },
        'Shorts': { categoryFilter: null, taxonomy: 'etAPg889P243JyjdbZCXhw' },
        'Dresses & Skirts': { categoryFilter: null, taxonomy: 'oSSCBSqkQPZu6HataAUAxB' },
        'Bodysuits': { categoryFilter: null, taxonomy: 'u5jaNLyf2ZhvR95GS37ui5' },
        'Shoes': { categoryFilter: null, taxonomy: 'uLRgNoJ1awZkhpVw9WyvKo' }
    };

    const sortTypeMap = {
        'Classic': 0,       
        'Featured': 0,      
        'TopFavorites': 1,  
        'BestSelling': 2,   
        'RecentlyUpdated': 3, 
        'ForSale': 4,       
        'PriceHighToLow': 4, 
        'PriceLowToHigh': 5, 
        'PublicDomain': 0   
    };

    let filterCreator = '';
    let filterPriceMin = null;
    let filterPriceMax = null;

    const isStandalonePage = window.location.pathname.includes('catalog.html');

    if (isStandalonePage) {
        document.addEventListener('DOMContentLoaded', initCatalog);
    } else {
        
        document.addEventListener('pageChange', function(e) {
            if (e.detail.page === 'catalog') {
                if (!catalogLoaded) {
                    loadCatalogPage();
                } else {
                    
                    initCatalog();
                }
            }
        });
    }

    async function loadClassicItemsFromJSON() {
        if (classicItemsList) {
            return classicItemsList;
        }

        try {
            const response = await fetch('data/classic-items.json');
            if (!response.ok) throw new Error('Failed to load classic items JSON');

            const data = await response.json();

            let allItems = [];

            if (Array.isArray(data.items)) {
                
                allItems = data.items;
            } else if (data.items && typeof data.items === 'object') {
                
                for (const category of Object.keys(data.items)) {
                    const categoryItems = data.items[category];
                    if (Array.isArray(categoryItems)) {
                        allItems.push(...categoryItems);
                    }
                }
            }

            try {
                const facesResponse = await fetch('data/faces-2011.json');
                if (facesResponse.ok) {
                    const facesData = await facesResponse.json();
                    if (facesData.faces && Array.isArray(facesData.faces)) {
                        
                        const faceItems = facesData.faces.map(face => ({
                            id: face.id,
                            name: face.name,
                            filter: 'Faces-ForSale', 
                            category: 'Faces',
                            source: face.source || 'wayback-2011'
                        }));

                        const existingIds = new Set(allItems.map(item => item.id));
                        const newFaces = faceItems.filter(face => !existingIds.has(face.id));

                        if (newFaces.length > 0) {
                            allItems.push(...newFaces);
                            console.log(`Added ${newFaces.length} faces from 2011 Wayback catalog`);
                        }
                    }
                }
            } catch (facesError) {
                console.warn('Failed to load 2011 faces:', facesError);
                
            }

            classicItemsList = allItems;
            console.log(`Loaded ${classicItemsList.length} classic items from JSON`);
            return classicItemsList;
        } catch (error) {
            console.error('Failed to load classic items JSON:', error);
            return [];
        }
    }

    async function loadCatalogPage() {
        const container = document.getElementById('catalog-content');
        if (!container) {
            console.error('Catalog container not found');
            return;
        }

        container.innerHTML = '<div class="catalog-loading">Loading catalog...</div>';

        try {
            const response = await fetch('pages/catalog.html');
            if (!response.ok) throw new Error('Failed to fetch catalog page');

            let html = await response.text();

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const catalogContainer = doc.getElementById('CatalogContainer');
            if (catalogContainer) {
                let content = catalogContainer.innerHTML;
                content = content.replace(/\.\.\/images\//g, 'images/');
                content = content.replace(/\.\.\/CSS\//g, 'CSS/');

                browseModeHandlerAttached = false;
                categoryHandlerAttached = false;
                paginationHandlerAttached = false;

                container.innerHTML = '<div id="CatalogContainer">' + content + '</div>';
                catalogLoaded = true;
                initCatalog();
            } else {
                const bodyDiv = doc.getElementById('Body');
                if (bodyDiv) {
                    let content = bodyDiv.innerHTML;
                    content = content.replace(/\.\.\/images\//g, 'images/');
                    content = content.replace(/\.\.\/CSS\//g, 'CSS/');

                    browseModeHandlerAttached = false;
                    categoryHandlerAttached = false;
                    paginationHandlerAttached = false;

                    container.innerHTML = content;
                    catalogLoaded = true;
                    initCatalog();
                } else {
                    if (window.showErrorPage) {
                        window.showErrorPage('Failed to parse catalog page', 'catalog-content');
                    } else {
                        container.innerHTML = '<div class="catalog-error">Failed to parse catalog page</div>';
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load catalog page:', error);
            if (window.showErrorPage) {
                window.showErrorPage('Failed to load catalog: ' + error.message, 'catalog-content');
            } else {
                container.innerHTML = '<div class="catalog-error">Failed to load catalog: ' + error.message + '</div>';
            }
        }
    }

    function initCatalog() {
        
        initWorker();

        filterCreator = '';
        filterPriceMin = null;
        filterPriceMax = null;

        const creatorInput = document.getElementById('CatalogCreatorFilter');
        const priceMinInput = document.getElementById('CatalogPriceMin');
        const priceMaxInput = document.getElementById('CatalogPriceMax');
        if (creatorInput) creatorInput.value = '';
        if (priceMinInput) priceMinInput.value = '';
        if (priceMaxInput) priceMaxInput.value = '';

        const itemsContainer = document.querySelector('#CatalogContainer .Assets .StandardBox');
        if (itemsContainer) {
            itemsContainer.innerHTML = `
                <div class="catalog-classic-loading" style="text-align: center; padding: 60px 20px;">
                    <img src="images/spinners/spinner100x100.gif" alt="Loading..." style="margin-bottom: 10px;"><br>
                    <span style="color: #666;">Loading items...</span>
                </div>
            `;
        }

        initSearchHandlers();
        initBrowseModeHandlers();
        initCategoryHandlers();
        initPaginationHandlers();
        initFilterHandlers();

        updateCategoryAvailability();

        updateDisplayLabel();

        loadCatalogItems();
        
        console.log('Catalog page initialized with live API');
    }

    function initFilterHandlers() {
        const creatorInput = document.getElementById('CatalogCreatorFilter');
        const priceMinInput = document.getElementById('CatalogPriceMin');
        const priceMaxInput = document.getElementById('CatalogPriceMax');
        const applyBtn = document.getElementById('CatalogApplyFilters');
        const clearBtn = document.getElementById('CatalogClearFilters');

        if (applyBtn) {
            applyBtn.addEventListener('click', function(e) {
                e.preventDefault();

                filterCreator = creatorInput?.value.trim() || '';
                filterPriceMin = priceMinInput?.value ? parseInt(priceMinInput.value, 10) : null;
                filterPriceMax = priceMaxInput?.value ? parseInt(priceMaxInput.value, 10) : null;

                currentPage = 1;
                currentCursor = '';
                cursorHistory = [''];
                
                updateDisplayLabel();
                loadCatalogItems();
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', function(e) {
                e.preventDefault();

                filterCreator = '';
                filterPriceMin = null;
                filterPriceMax = null;

                if (creatorInput) creatorInput.value = '';
                if (priceMinInput) priceMinInput.value = '';
                if (priceMaxInput) priceMaxInput.value = '';

                currentPage = 1;
                currentCursor = '';
                cursorHistory = [''];
                
                updateDisplayLabel();
                loadCatalogItems();
            });
        }

        [creatorInput, priceMinInput, priceMaxInput].forEach(input => {
            if (input) {
                input.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        applyBtn?.click();
                    }
                });
            }
        });
    }

    function initSearchHandlers() {
        const searchInput = document.getElementById('ctl00_cphRoblox_rbxCatalog_SearchTextBox');
        const searchBtn = document.getElementById('ctl00_cphRoblox_rbxCatalog_SearchButton');
        const resetBtn = document.getElementById('ctl00_cphRoblox_rbxCatalog_ResetSearchButton');

        if (searchBtn) {
            searchBtn.addEventListener('click', function(e) {
                e.preventDefault();
                const query = searchInput?.value.trim();
                searchCatalog(query);
            });
        }

        if (searchInput) {
            searchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    searchCatalog(this.value.trim());
                }
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (searchInput) searchInput.value = '';
                currentKeyword = '';
                setMode('Relevance');
            });
        }
    }

    let browseModeHandlerAttached = false;
    let categoryHandlerAttached = false;
    let paginationHandlerAttached = false;

    function initBrowseModeHandlers() {
        
        if (browseModeHandlerAttached) return;

        const browseMode = document.getElementById('BrowseMode');
        if (!browseMode) return;

        browseMode.addEventListener('click', function(e) {
            
            const link = e.target.closest('a');

            if (link && browseMode.contains(link)) {
                e.preventDefault();
                e.stopPropagation();

                const href = link.getAttribute('href') || '';
                const modeMatch = href.match(/m=(\w+)/);
                if (modeMatch) {
                    setMode(modeMatch[1]);
                }
            }
        });

        browseModeHandlerAttached = true;
    }

    function initCategoryHandlers() {
        const browseMode = document.getElementById('BrowseMode');
        if (!browseMode) return;

        const browseUl = browseMode.querySelector('ul');
        if (!browseUl) return;

        if (!document.getElementById('TimeFilterList')) {
            const timeFilterHtml = `
                <div id="TimeFilterSection" style="display: none;">
                    <h2 id="TimeFilterHeader">Time</h2>
                    <ul id="TimeFilterList">
                        <li class="selected"><h3><a href="#" data-timefilter="AllTime">All Time</a></h3></li>
                        <li><h3><a href="#" data-timefilter="PastWeek">Past Week</a></h3></li>
                        <li><h3><a href="#" data-timefilter="PastDay">Past Day</a></h3></li>
                    </ul>
                </div>
            `;
            browseMode.insertAdjacentHTML('beforebegin', timeFilterHtml);
        }

        if (!document.getElementById('SortByList')) {
            const sortByHtml = `
                <h2>Sort By</h2>
                <ul id="SortByList">
                    <li class="selected"><h3><a href="#" data-salestype="All">All</a></h3></li>
                    <li><h3><a href="#" data-salestype="Collectible">Collectible</a></h3></li>
                </ul>
            `;
            browseUl.insertAdjacentHTML('afterend', sortByHtml);
        }

        if (!document.getElementById('CategoryList')) {
            const sortByList = document.getElementById('SortByList');
            if (sortByList) {
                const categoryHtml = `
                    <h2>Categories</h2>
                    <ul id="CategoryList">
                        <li class="selected"><h3><a href="#" data-category="All">All Categories</a></h3></li>
                        
                        <li class="category-group">
                            <h3><a href="#" class="category-toggle" data-group="accessories">▶ Accessories</a></h3>
                            <ul class="category-subitems" data-group="accessories" style="display: none;">
                                <li><h3><a href="#" data-category="Hats">Hats</a></h3></li>
                                <li><h3><a href="#" data-category="Hair">Hair</a></h3></li>
                                <li><h3><a href="#" data-category="Face">Face Accessories</a></h3></li>
                                <li><h3><a href="#" data-category="Neck">Neck</a></h3></li>
                                <li><h3><a href="#" data-category="Shoulder">Shoulder</a></h3></li>
                                <li><h3><a href="#" data-category="Front">Front</a></h3></li>
                                <li><h3><a href="#" data-category="Back">Back</a></h3></li>
                                <li><h3><a href="#" data-category="Waist">Waist</a></h3></li>
                            </ul>
                        </li>
                        
                        <li class="category-group">
                            <h3><a href="#" class="category-toggle" data-group="body">▶ Body</a></h3>
                            <ul class="category-subitems" data-group="body" style="display: none;">
                                <li><h3><a href="#" data-category="Faces">Faces</a></h3></li>
                                <li><h3><a href="#" data-category="Heads">Heads</a></h3></li>
                                <li><h3><a href="#" data-category="Packages">Packages</a></h3></li>
                            </ul>
                        </li>
                        
                        <li class="category-group">
                            <h3><a href="#" class="category-toggle" data-group="clothing">▶ Clothing</a></h3>
                            <ul class="category-subitems" data-group="clothing" style="display: none;">
                                <li><h3><a href="#" data-category="T-Shirts">T-Shirts</a></h3></li>
                                <li><h3><a href="#" data-category="Shirts">Shirts</a></h3></li>
                                <li><h3><a href="#" data-category="Pants">Pants</a></h3></li>
                            </ul>
                        </li>
                        
                        <li class="category-group">
                            <h3><a href="#" class="category-toggle" data-group="clothing3d">▶ 3D Clothing</a></h3>
                            <ul class="category-subitems" data-group="clothing3d" style="display: none;">
                                <li><h3><a href="#" data-category="3D T-Shirts">T-Shirts</a></h3></li>
                                <li><h3><a href="#" data-category="3D Shirts">Shirts</a></h3></li>
                                <li><h3><a href="#" data-category="Sweaters">Sweaters</a></h3></li>
                                <li><h3><a href="#" data-category="Jackets">Jackets</a></h3></li>
                                <li><h3><a href="#" data-category="3D Pants">Pants</a></h3></li>
                                <li><h3><a href="#" data-category="Shorts">Shorts</a></h3></li>
                                <li><h3><a href="#" data-category="Dresses & Skirts">Dresses & Skirts</a></h3></li>
                                <li><h3><a href="#" data-category="Bodysuits">Bodysuits</a></h3></li>
                                <li><h3><a href="#" data-category="Shoes">Shoes</a></h3></li>
                            </ul>
                        </li>
                        
                        <li><h3><a href="#" data-category="Gear">Gear</a></h3></li>
                        <li><h3><a href="#" data-category="Emotes">Emotes</a></h3></li>
                        <li><h3><a href="#" data-category="Animations">Animations</a></h3></li>
                    </ul>
                `;
                sortByList.insertAdjacentHTML('afterend', categoryHtml);
            }
        }

        const sortByList = document.getElementById('SortByList');
        if (sortByList && !sortByList.dataset.handlerAttached) {
            sortByList.addEventListener('click', function(e) {
                const link = e.target.closest('a[data-salestype]');
                if (link) {
                    e.preventDefault();
                    const salesType = link.dataset.salestype;
                    setSalesType(salesType);
                }
            });
            sortByList.dataset.handlerAttached = 'true';
        }

        const timeFilterList = document.getElementById('TimeFilterList');
        if (timeFilterList && !timeFilterList.dataset.handlerAttached) {
            timeFilterList.addEventListener('click', function(e) {
                const link = e.target.closest('a[data-timefilter]');
                if (link) {
                    e.preventDefault();
                    const timeFilter = link.dataset.timefilter;
                    setTimeFilter(timeFilter);
                }
            });
            timeFilterList.dataset.handlerAttached = 'true';
        }

        if (categoryHandlerAttached) return;

        const categoryList = document.getElementById('CategoryList');
        if (categoryList) {
            categoryList.addEventListener('click', function(e) {
                
                const toggleLink = e.target.closest('a.category-toggle');
                if (toggleLink) {
                    e.preventDefault();
                    const group = toggleLink.dataset.group;
                    const subitems = categoryList.querySelector(`.category-subitems[data-group="${group}"]`);
                    if (subitems) {
                        const isHidden = subitems.style.display === 'none';
                        subitems.style.display = isHidden ? '' : 'none';
                        
                        toggleLink.textContent = (isHidden ? '▼ ' : '▶ ') + toggleLink.textContent.substring(2);
                    }
                    return;
                }

                const link = e.target.closest('a[data-category]');
                if (link) {
                    e.preventDefault();
                    const category = link.dataset.category;
                    setCategory(category);
                }
            });
            categoryHandlerAttached = true;
        }
    }

    function initPaginationHandlers() {
        
        if (paginationHandlerAttached) return;

        const catalogContainer = document.getElementById('catalog-content') || document.body;
        catalogContainer.addEventListener('click', function(e) {
            
            const prevBtn = e.target.closest('.catalog-prev-btn');
            if (prevBtn) {
                e.preventDefault();
                if (isLoadingPage) return;

                if (currentPage > 1) {
                    currentPage--;
                    
                    if (currentMode !== 'Classic' && cursorHistory.length > 1) {
                        cursorHistory.pop(); 
                        currentCursor = cursorHistory[cursorHistory.length - 1] || '';
                    }
                    loadCatalogItems();
                }
                return;
            }

            const nextBtn = e.target.closest('.catalog-next-btn');
            if (nextBtn) {
                e.preventDefault();
                if (isLoadingPage) return;

                const canGoNext = currentMode === 'Classic'
                    ? currentPage < totalPages
                    : (currentPage < totalPages || currentCursor);

                if (canGoNext) {
                    currentPage++;
                    loadCatalogItems();
                }
            }
        });

        paginationHandlerAttached = true;
    }

    function bindPaginationHandlers() {
        
    }

    function setMode(mode) {
        currentMode = mode;
        currentPage = 1;
        currentCursor = '';
        cursorHistory = ['']; 

        const modeItems = document.querySelectorAll('#BrowseMode ul li');
        modeItems.forEach(li => {
            const link = li.querySelector('a');
            const href = link?.getAttribute('href') || '';
            if (href.includes('m=' + mode)) {
                li.className = 'Selected';
            } else {
                li.className = '';
            }
        });

        updateCategoryAvailability();

        updateTimeFilterVisibility();

        updateDisplayLabel();
        loadCatalogItems();
    }

    function updateCategoryAvailability() {
        const categoryList = document.getElementById('CategoryList');
        if (!categoryList) return;

        const isClassicMode = currentMode === 'Classic';
        const isCollectibleMode = currentSalesType === 'Collectible';
        const allowedInClassic = ['All', 'Faces'];
        
        const notAllowedInCollectible = ['T-Shirts', 'Shirts', 'Pants', 'Faces', 'Packages', 'Heads', 'Emotes', 'Animations',
            '3D T-Shirts', '3D Shirts', 'Sweaters', 'Jackets', '3D Pants', 'Shorts', 'Dresses & Skirts', 'Bodysuits', 'Shoes'];

        categoryList.querySelectorAll('li').forEach(li => {
            const link = li.querySelector('a[data-category]');
            if (!link) return;

            const category = link.dataset.category;

            let isAllowed = true;
            if (isClassicMode && !allowedInClassic.includes(category)) {
                isAllowed = false;
            }
            if (isCollectibleMode && notAllowedInCollectible.includes(category)) {
                isAllowed = false;
            }

            if (isAllowed) {
                li.classList.remove('disabled');
                link.style.pointerEvents = '';
                link.style.color = '';
            } else {
                li.classList.add('disabled');
                link.style.pointerEvents = 'none';
                link.style.color = '#999';
            }
        });

        if (isCollectibleMode && notAllowedInCollectible.includes(currentCategory)) {
            currentCategory = 'All';
            categoryList.querySelectorAll('li').forEach(li => {
                
                if (li.classList.contains('category-group')) return;
                
                const link = li.querySelector('a[data-category]');
                if (link?.dataset.category === 'All') {
                    li.classList.add('selected');
                } else {
                    li.classList.remove('selected');
                }
            });
        }

        const sortByList = document.getElementById('SortByList');
        if (sortByList) {
            sortByList.querySelectorAll('li').forEach(li => {
                const link = li.querySelector('a[data-salestype]');
                if (!link) return;

                const salesType = link.dataset.salestype;
                const isAllowed = !isClassicMode || salesType === 'All';

                if (isAllowed) {
                    li.classList.remove('disabled');
                    link.style.pointerEvents = '';
                    link.style.color = '';
                } else {
                    li.classList.add('disabled');
                    link.style.pointerEvents = 'none';
                    link.style.color = '#999';
                }
            });

            if (isClassicMode && currentSalesType === 'Collectible') {
                currentSalesType = 'All';
                sortByList.querySelectorAll('li').forEach(li => {
                    const link = li.querySelector('a[data-salestype]');
                    if (link?.dataset.salestype === 'All') {
                        li.className = 'selected';
                    } else {
                        li.className = '';
                    }
                });
            }
        }
    }

    function setCategory(category) {
        currentCategory = category;
        currentPage = 1;
        currentCursor = '';
        cursorHistory = ['']; 

        document.querySelectorAll('#CategoryList li').forEach(li => {
            
            if (li.classList.contains('category-group')) return;
            
            const link = li.querySelector('a[data-category]');
            if (link?.dataset.category === category) {
                li.classList.add('selected');
            } else {
                li.classList.remove('selected');
            }
        });

        updateDisplayLabel();
        loadCatalogItems();
    }

    function setSalesType(salesType) {
        currentSalesType = salesType;
        currentPage = 1;
        currentCursor = '';
        cursorHistory = ['']; 

        document.querySelectorAll('#SortByList li').forEach(li => {
            const link = li.querySelector('a');
            if (link?.dataset.salestype === salesType) {
                li.className = 'selected';
            } else {
                li.className = '';
            }
        });

        updateCategoryAvailability();

        updateDisplayLabel();
        loadCatalogItems();
    }

    function setTimeFilter(timeFilter) {
        currentTimeFilter = timeFilter;
        currentPage = 1;
        currentCursor = '';
        cursorHistory = ['']; 

        document.querySelectorAll('#TimeFilterList li').forEach(li => {
            const link = li.querySelector('a');
            if (link?.dataset.timefilter === timeFilter) {
                li.className = 'selected';
            } else {
                li.className = '';
            }
        });

        updateDisplayLabel();
        loadCatalogItems();
    }

    function updateTimeFilterVisibility() {
        const timeFilterSection = document.getElementById('TimeFilterSection');
        const timeFilterList = document.getElementById('TimeFilterList');

        const showTimeFilter = currentMode === 'TopFavorites' || currentMode === 'BestSelling';
        
        if (timeFilterSection) {
            timeFilterSection.style.display = showTimeFilter ? '' : 'none';
        }

        if (!showTimeFilter && currentTimeFilter !== 'AllTime') {
            currentTimeFilter = 'AllTime';
            if (timeFilterList) {
                timeFilterList.querySelectorAll('li').forEach(li => {
                    const link = li.querySelector('a[data-timefilter]');
                    if (link?.dataset.timefilter === 'AllTime') {
                        li.className = 'selected';
                    } else {
                        li.className = '';
                    }
                });
            }
        }
    }

    function updateDisplayLabel() {
        const displayLabel = document.getElementById('ctl00_cphRoblox_rbxCatalog_AssetsDisplaySetLabel');
        if (displayLabel) {
            const modeNames = {
                'Classic': 'Classic Items',
                'Featured': 'Featured Items',
                'TopFavorites': 'Top Favorites',
                'RecentlyUpdated': 'Recently Updated',
                'ForSale': 'For Sale',
                'BestSelling': 'Best Selling',
                'PriceHighToLow': 'Price (High to Low)',
                'PriceLowToHigh': 'Price (Low to High)'
            };
            
            let label = modeNames[currentMode] || 'Items';

            if ((currentMode === 'TopFavorites' || currentMode === 'BestSelling') && currentTimeFilter !== 'AllTime') {
                const timeNames = {
                    'PastWeek': '(Past Week)',
                    'PastDay': '(Past Day)'
                };
                label += ' ' + (timeNames[currentTimeFilter] || '');
            }

            if (currentSalesType === 'Collectible') {
                label = 'Collectible ' + label;
            }
            if (currentKeyword) {
                label = `Search Results: "${currentKeyword}"`;
            } else if (currentCategory !== 'All') {
                label += ` - ${currentCategory}`;
            }

            if (filterCreator) {
                label += ` by ${filterCreator}`;
            }
            if (filterPriceMin !== null || filterPriceMax !== null) {
                const minStr = filterPriceMin !== null ? `R$${filterPriceMin}` : 'R$0';
                const maxStr = filterPriceMax !== null ? `R$${filterPriceMax}` : '∞';
                label += ` (${minStr} - ${maxStr})`;
            }
            
            displayLabel.textContent = label;
        }
    }

    function searchCatalog(query) {
        currentKeyword = query;
        currentPage = 1;
        currentCursor = '';
        cursorHistory = ['']; 
        updateDisplayLabel();
        loadCatalogItems();
    }

    async function loadClassicItems() {
        const itemsContainer = document.querySelector('#CatalogContainer .Assets .StandardBox');
        const table = itemsContainer?.querySelector('table');

        const allItems = await loadClassicItemsFromJSON();

        if (!allItems || allItems.length === 0) {
            console.warn('No classic items found in JSON');
            return [];
        }

        let filteredItems = allItems;
        if (currentKeyword) {
            const keyword = currentKeyword.toLowerCase();
            filteredItems = allItems.filter(item => 
                item.name && item.name.toLowerCase().includes(keyword)
            );
        }

        if (currentCategory && currentCategory !== 'All') {
            filteredItems = filteredItems.filter(item => {
                
                if (item.filter) {
                    return item.filter.toLowerCase().startsWith(currentCategory.toLowerCase());
                }
                
                if (item.category) {
                    return item.category.toLowerCase() === currentCategory.toLowerCase();
                }
                return false;
            });
        }

        totalPages = Math.ceil(filteredItems.length / itemsPerPage);
        const startIdx = (currentPage - 1) * itemsPerPage;
        const pageItems = filteredItems.slice(startIdx, startIdx + itemsPerPage);

        console.log(`Classic items: ${filteredItems.length} total, page ${currentPage}/${totalPages}, showing ${pageItems.length} items`);

        if (pageItems.length > 0) {
            const items = pageItems.map(item => ({ itemType: 'Asset', id: item.id }));
            try {
                let detailsResponse;
                if (window.roblox?.getCatalogItemDetails) {
                    detailsResponse = await window.roblox.getCatalogItemDetails(items);
                } else if (window.robloxAPI?.getCatalogItemDetails) {
                    detailsResponse = await window.robloxAPI.getCatalogItemDetails(items);
                }

                if (detailsResponse?.data) {
                    
                    const detailsMap = new Map();
                    detailsResponse.data.forEach(item => {
                        const id = item.id || item.assetId;
                        if (id) detailsMap.set(id, item);
                    });

                    const economyCache = getEconomyCache();

                    const mergedItems = pageItems.map(jsonItem => {
                        const apiItem = detailsMap.get(jsonItem.id);
                        const economyData = economyCache[jsonItem.id];
                        
                        let result;
                        if (apiItem) {
                            result = {
                                ...apiItem,
                                id: jsonItem.id,
                                name: apiItem.name || jsonItem.name,
                                itemType: apiItem.itemType || 'Asset'
                            };
                        } else {
                            
                            result = {
                                id: jsonItem.id,
                                name: jsonItem.name,
                                itemType: 'Asset',
                                creatorName: 'ROBLOX',
                                creatorTargetId: 1,
                                price: null,
                                favoriteCount: 0
                            };
                        }

                        if (economyData) {
                            result.isLimited = economyData.isLimited;
                            result.isLimitedUnique = economyData.isLimitedUnique;
                            result.isForSale = economyData.isForSale;
                            result.priceInRobux = economyData.priceInRobux;
                            if (economyData.lowestSellerPrice) {
                                result.lowestResalePrice = economyData.lowestSellerPrice;
                            }
                        }
                        
                        return result;
                    });

                    return mergedItems;
                }
            } catch (error) {
                console.warn('Failed to fetch item details, using JSON data:', error);
            }
        }

        const economyCache = getEconomyCache();
        return pageItems.map(item => {
            const economyData = economyCache[item.id];
            const result = {
                id: item.id,
                name: item.name,
                itemType: 'Asset',
                creatorName: 'ROBLOX',
                creatorTargetId: 1,
                price: null,
                favoriteCount: 0
            };

            if (economyData) {
                result.isLimited = economyData.isLimited;
                result.isLimitedUnique = economyData.isLimitedUnique;
                result.isForSale = economyData.isForSale;
                result.priceInRobux = economyData.priceInRobux;
                if (economyData.lowestSellerPrice) {
                    result.lowestResalePrice = economyData.lowestSellerPrice;
                }
            }
            
            return result;
        });
    }

    function applyFilters(items) {
        if (!items || items.length === 0) {
            return items;
        }

        let filteredItems = items;

        if (filterCreator) {
            const creatorLower = filterCreator.toLowerCase();
            filteredItems = filteredItems.filter(item => {
                const itemCreator = (item.creatorName || '').toLowerCase();
                return itemCreator.includes(creatorLower);
            });
        }

        if (filterPriceMin !== null || filterPriceMax !== null) {
            filteredItems = filteredItems.filter(item => {
                
                const price = item.lowestResalePrice || item.price || item.priceInRobux;

                if (price === null || price === undefined) {
                    return false;
                }

                if (filterPriceMin !== null && price < filterPriceMin) {
                    return false;
                }
                if (filterPriceMax !== null && price > filterPriceMax) {
                    return false;
                }
                return true;
            });
        }

        if (filterPriceMin !== null || filterPriceMax !== null) {
            filteredItems.sort((a, b) => {
                const priceA = a.lowestResalePrice || a.price || a.priceInRobux || 0;
                const priceB = b.lowestResalePrice || b.price || b.priceInRobux || 0;
                return priceA - priceB;
            });
        }

        if (filterCreator) {
            filteredItems.sort((a, b) => {
                const creatorA = (a.creatorName || '').toLowerCase();
                const creatorB = (b.creatorName || '').toLowerCase();
                return creatorA.localeCompare(creatorB);
            });
        }

        return filteredItems;
    }

    async function loadCatalogItems() {
        if (isLoadingPage) return;
        isLoadingPage = true;
        
        const itemsContainer = document.querySelector('#CatalogContainer .Assets .StandardBox');
        if (!itemsContainer) {
            console.log('Items container not found');
            isLoadingPage = false;
            return;
        }

        const table = itemsContainer.querySelector('table');

        if (currentMode === 'Classic' && !table) {
            itemsContainer.innerHTML = `
                <div class="catalog-classic-loading" style="text-align: center; padding: 60px 20px;">
                    <img src="images/spinners/spinner100x100.gif" alt="Loading..." style="margin-bottom: 10px;"><br>
                    <span style="color: #666;">Loading classic items...</span>
                </div>
            `;
        } else {
            
            let loadingOverlay = itemsContainer.querySelector('.catalog-loading-overlay');
            if (!loadingOverlay) {
                loadingOverlay = document.createElement('div');
                loadingOverlay.className = 'catalog-loading-overlay';
                loadingOverlay.innerHTML = `<div class="catalog-loading-spinner">Loading page ${currentPage}...</div>`;
                itemsContainer.style.position = 'relative';
                itemsContainer.appendChild(loadingOverlay);
            } else {
                loadingOverlay.innerHTML = `<div class="catalog-loading-spinner">Loading page ${currentPage}...</div>`;
                loadingOverlay.style.display = 'flex';
            }

            if (table) {
                table.style.opacity = '0.3';
            }
        }

        document.querySelectorAll('.catalog-prev-btn, .catalog-next-btn').forEach(btn => {
            btn.style.opacity = '0.5';
            btn.style.pointerEvents = 'none';
        });

        try {
            
            const hasFilters = filterCreator || filterPriceMin !== null || filterPriceMax !== null;

            if (currentMode === 'Classic' && !hasFilters) {
                const items = await loadClassicItems();
                await renderCatalogItems(items);
                updatePagination();

                fetchResalePricesForLimitedItems(items, true);

                preloadAllClassicEconomyData();
                return;
            }

            const catMapping = categoryMap[currentCategory] || { categoryFilter: null };
            const sortType = sortTypeMap[currentMode] ?? 0;

            let sortAggregation = null;
            if ((currentMode === 'TopFavorites' || currentMode === 'BestSelling') && currentTimeFilter !== 'AllTime') {
                sortAggregation = currentTimeFilter === 'PastDay' ? 1 : 3; 
            }

            const cursorToUse = cursorHistory[currentPage - 1] || '';

            const params = {
                categoryFilter: catMapping.categoryFilter,
                subcategory: catMapping.subcategory || '',
                taxonomy: catMapping.taxonomy || '',
                sortType: sortType,
                sortAggregation: sortAggregation,
                keyword: currentKeyword,
                limit: itemsPerPage,
                cursor: cursorToUse,
                collectiblesOnly: currentSalesType === 'Collectible', 
                
                creatorName: filterCreator || '',
                minPrice: filterPriceMin,
                maxPrice: filterPriceMax
            };

            console.log('Fetching catalog with params:', params);

            let response;
            if (window.roblox?.searchCatalog) {
                response = await window.roblox.searchCatalog(params);
            } else if (window.robloxAPI?.searchCatalog) {
                response = await window.robloxAPI.searchCatalog(params);
            } else {
                throw new Error('Catalog API not available');
            }

            console.log('Catalog response:', response);

            if (response?.data) {
                await renderCatalogItems(response.data);

                if (response.nextPageCursor) {
                    currentCursor = response.nextPageCursor;
                    
                    if (cursorHistory.length <= currentPage) {
                        cursorHistory.push(currentCursor);
                        
                        if (cursorHistory.length > 10) {
                            cursorHistory.shift(); 
                            currentPage--; 
                        }
                    } else {
                        cursorHistory[currentPage] = currentCursor;
                    }
                    totalPages = currentPage + 1;
                } else {
                    currentCursor = '';
                    totalPages = currentPage;
                }
                updatePagination();

                fetchResalePricesForLimitedItems(response.data);
            } else {
                await renderCatalogItems([]);
            }
        } catch (error) {
            console.error('Failed to load catalog items:', error);
            const table = itemsContainer.querySelector('table');
            if (table) {
                table.style.opacity = '1';
                table.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: #cc0000;">Failed to load items: ' + error.message + '</td></tr>';
            }
        } finally {
            isLoadingPage = false;

            const overlay = itemsContainer.querySelector('.catalog-loading-overlay');
            if (overlay) {
                overlay.style.display = 'none';
            }

            const table = itemsContainer.querySelector('table');
            if (table) {
                table.style.opacity = '1';
            }

            document.querySelectorAll('.catalog-prev-btn, .catalog-next-btn').forEach(btn => {
                btn.style.opacity = '';
                btn.style.pointerEvents = '';
            });
        }
    }

    async function renderCatalogItems(items) {
        const itemsContainer = document.querySelector('#CatalogContainer .Assets .StandardBox');
        if (!itemsContainer) return;

        if (window.roblox?.blacklist?.filterItems) {
            try {
                const filtered = await window.roblox.blacklist.filterItems(items);
                if (filtered.length < items.length) {
                    console.log('[Blacklist] Filtered', items.length - filtered.length, 'catalog items');
                }
                items = filtered;
            } catch (e) {
                console.warn('[Blacklist] Filter failed:', e);
            }
        }

        const loadingIndicator = itemsContainer.querySelector('.catalog-classic-loading');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }

        let table = itemsContainer.querySelector('table');
        if (!table) {
            table = document.createElement('table');
            table.id = 'ctl00_cphRoblox_rbxCatalog_AssetsDataList';
            table.cellSpacing = '0';
            table.align = 'Center';
            table.border = '0';
            table.style.borderCollapse = 'collapse';
            itemsContainer.innerHTML = '';
            itemsContainer.appendChild(table);
        }

        if (items.length === 0) {
            table.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px;">No items found</td></tr>';
            return;
        }

        const ITEMS_PER_ROW = 5;
        const INITIAL_ROWS = 3; 
        const rowCount = Math.ceil(items.length / ITEMS_PER_ROW);
        const initialRowCount = Math.min(rowCount, INITIAL_ROWS);

        let html = '';
        for (let row = 0; row < initialRowCount; row++) {
            html += '<tr>';
            for (let col = 0; col < ITEMS_PER_ROW; col++) {
                const idx = row * ITEMS_PER_ROW + col;
                if (idx < items.length) {
                    html += renderCatalogItem(items[idx]);
                } else {
                    html += '<td></td>';
                }
            }
            html += '</tr>';
        }

        table.innerHTML = html;

        if (rowCount > initialRowCount) {
            
            const loadMoreRows = () => {
                const fragment = document.createDocumentFragment();
                for (let row = initialRowCount; row < rowCount; row++) {
                    const tr = document.createElement('tr');
                    for (let col = 0; col < ITEMS_PER_ROW; col++) {
                        const idx = row * ITEMS_PER_ROW + col;
                        if (idx < items.length) {
                            const td = document.createElement('td');
                            td.innerHTML = renderCatalogItem(items[idx]);
                            tr.appendChild(td.firstChild);
                        } else {
                            tr.appendChild(document.createElement('td'));
                        }
                    }
                    fragment.appendChild(tr);
                }
                table.appendChild(fragment);
            };

            setTimeout(loadMoreRows, 100);
        }

        table.querySelectorAll('.Asset').forEach(asset => {
            asset.addEventListener('click', function(e) {
                if (e.target.tagName !== 'A') {
                    const itemId = this.dataset.itemId;
                    const itemType = this.dataset.itemType || 'Asset';
                    if (itemId) {
                        navigateToItemDetail(itemId, itemType);
                    }
                }
            });
        });

        fetchThumbnails(items);
    }

    async function fetchThumbnails(items) {
        
        const assetItems = items.filter(item => item.itemType !== 'Bundle');
        const bundleItems = items.filter(item => item.itemType === 'Bundle');

        const assetIds = assetItems.map(item => item.id || item.assetId).filter(Boolean);
        const bundleIds = bundleItems.map(item => item.id || item.bundleId).filter(Boolean);

        const fetchPromises = [];

        if (assetIds.length > 0) {
            const assetPromise = (async () => {
                try {
                    let thumbnailData;
                    if (window.roblox?.getAssetThumbnails) {
                        thumbnailData = await window.roblox.getAssetThumbnails(assetIds, '110x110');
                    } else if (window.robloxAPI?.getAssetThumbnails) {
                        thumbnailData = await window.robloxAPI.getAssetThumbnails(assetIds, '110x110');
                    }

                    if (thumbnailData?.data) {
                        thumbnailData.data.forEach(thumb => {
                            if (thumb.state === 'Completed' && thumb.imageUrl) {
                                const img = document.querySelector(`.Asset[data-item-id="${thumb.targetId}"] img`);
                                if (img) {
                                    img.src = thumb.imageUrl;
                                }
                            }
                        });
                    }
                } catch (error) {
                    console.warn('Failed to fetch asset thumbnails:', error);
                }
            })();
            fetchPromises.push(assetPromise);
        }

        if (bundleIds.length > 0) {
            const bundlePromise = (async () => {
                try {
                    let thumbnailData;
                    if (window.roblox?.getBundleThumbnails) {
                        thumbnailData = await window.roblox.getBundleThumbnails(bundleIds, '150x150');
                    } else if (window.robloxAPI?.getBundleThumbnails) {
                        thumbnailData = await window.robloxAPI.getBundleThumbnails(bundleIds, '150x150');
                    }

                    if (thumbnailData?.data) {
                        thumbnailData.data.forEach(thumb => {
                            if (thumb.state === 'Completed' && thumb.imageUrl) {
                                const img = document.querySelector(`.Asset[data-item-id="${thumb.targetId}"] img`);
                                if (img) {
                                    img.src = thumb.imageUrl;
                                }
                            }
                        });
                    }
                } catch (error) {
                    console.warn('Failed to fetch bundle thumbnails:', error);
                }
            })();
            fetchPromises.push(bundlePromise);
        }

        await Promise.all(fetchPromises);
    }

    const ECONOMY_CACHE_KEY = 'classicEconomyCache_v4';
    const ECONOMY_CACHE_PRELOAD_KEY = 'classicEconomyPreloadTimestamp';
    const ECONOMY_CACHE_TTL = 24 * 60 * 60 * 1000; 
    const ECONOMY_CACHE_MAX_SIZE = 500; 
    const PRELOAD_COOLDOWN = 7 * 24 * 60 * 60 * 1000; 
    let preloadInProgress = false;

    function getEconomyCache() {
        try {
            const cache = JSON.parse(localStorage.getItem(ECONOMY_CACHE_KEY) || '{}');
            const now = Date.now();

            const validCache = {};
            for (const [id, data] of Object.entries(cache)) {
                if (data.timestamp && (now - data.timestamp < ECONOMY_CACHE_TTL)) {
                    validCache[id] = data;
                }
            }

            if (Object.keys(validCache).length !== Object.keys(cache).length) {
                setEconomyCache(validCache);
            }

            return validCache;
        } catch { return {}; }
    }

    function checkLocalStorageQuota() {
        try {
            let totalSize = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    totalSize += localStorage[key].length + key.length;
                }
            }
            
            const sizeKB = (totalSize / 1024).toFixed(2);
            
            const quotaWarningThreshold = 4 * 1024 * 1024; 

            if (totalSize > quotaWarningThreshold) {
                console.warn(`[Catalog] localStorage usage high: ${sizeKB} KB. Consider clearing old data.`);
                return false;
            }
            return true;
        } catch (e) {
            return true; 
        }
    }

    function setEconomyCache(cache) {
        try {
            
            checkLocalStorageQuota();

            const entries = Object.entries(cache);

            if (entries.length > ECONOMY_CACHE_MAX_SIZE) {
                
                entries.sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0));

                const trimmedCache = {};
                entries.slice(-ECONOMY_CACHE_MAX_SIZE).forEach(([id, data]) => {
                    trimmedCache[id] = data;
                });

                localStorage.setItem(ECONOMY_CACHE_KEY, JSON.stringify(trimmedCache));
            } else {
                localStorage.setItem(ECONOMY_CACHE_KEY, JSON.stringify(cache));
            }
        } catch (e) {
            
            console.warn('[Catalog] localStorage quota exceeded, clearing economy cache');
            try {
                localStorage.removeItem(ECONOMY_CACHE_KEY);
                localStorage.setItem(ECONOMY_CACHE_KEY, JSON.stringify(cache));
            } catch {  }
        }
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function preloadAllClassicEconomyData() {
        if (preloadInProgress) return;

        try {
            const lastPreload = localStorage.getItem(ECONOMY_CACHE_PRELOAD_KEY);
            if (lastPreload) {
                const timeSincePreload = Date.now() - parseInt(lastPreload);
                if (timeSincePreload < PRELOAD_COOLDOWN) {
                    const daysRemaining = Math.ceil((PRELOAD_COOLDOWN - timeSincePreload) / (24 * 60 * 60 * 1000));
                    console.log(`[Catalog] Skipping preload - last run ${Math.floor(timeSincePreload / (24 * 60 * 60 * 1000))} days ago, next run in ${daysRemaining} days`);
                    return;
                }
            }
        } catch (e) {
            console.warn('[Catalog] Error checking preload timestamp:', e);
        }

        preloadInProgress = true;

        const allItems = await loadClassicItemsFromJSON();
        if (!allItems || allItems.length === 0) {
            preloadInProgress = false;
            return;
        }

        const cache = getEconomyCache();
        const uncachedItems = allItems.filter(item => !cache[item.id]);

        if (uncachedItems.length === 0 || Object.keys(cache).length >= ECONOMY_CACHE_MAX_SIZE * 0.8) {
            console.log(`[Catalog] Cache sufficiently populated (${Object.keys(cache).length}/${ECONOMY_CACHE_MAX_SIZE}), skipping preload`);
            preloadInProgress = false;
            
            try {
                localStorage.setItem(ECONOMY_CACHE_PRELOAD_KEY, Date.now().toString());
            } catch (e) {}
            return;
        }

        console.log(`[Catalog] Starting batch preload for ${uncachedItems.length} classic items...`);

        const BATCH_SIZE = 20;
        let loaded = 0;

        for (let i = 0; i < uncachedItems.length; i += BATCH_SIZE) {
            
            if (currentMode !== 'Classic') {
                console.log('Preload paused - left Classic mode');
                preloadInProgress = false;
                return;
            }

            const batch = uncachedItems.slice(i, i + BATCH_SIZE);
            const assetIds = batch.map(item => item.id);

            try {
                
                const batchResults = await window.roblox?.getAssetEconomyDetailsBatch(assetIds, BATCH_SIZE);

                if (batchResults) {
                    
                    batchResults.forEach((economyDetails, assetId) => {
                        if (economyDetails) {
                            cache[assetId] = {
                                isLimited: economyDetails.IsLimited || economyDetails.isLimited || false,
                                isLimitedUnique: economyDetails.IsLimitedUnique || economyDetails.isLimitedUnique || false,
                                lowestSellerPrice: economyDetails.LowestSellerPrice ?? economyDetails.lowestSellerPrice ?? null,
                                priceInRobux: economyDetails.PriceInRobux ?? economyDetails.priceInRobux ?? null,
                                isForSale: economyDetails.IsForSale || economyDetails.isForSale || false,
                                timestamp: Date.now() 
                            };

                            loaded++;

                            applyEconomyDataToDOM(assetId, cache[assetId], true);
                        }
                    });

                    setEconomyCache(cache);
                    console.log(`Preloaded ${loaded}/${uncachedItems.length} items (batch ${Math.floor(i / BATCH_SIZE) + 1})`);
                }
            } catch (e) {
                console.warn(`[Catalog] Error loading batch ${Math.floor(i / BATCH_SIZE) + 1}:`, e);
                
            }

            await delay(100);
        }

        setEconomyCache(cache);
        console.log(`[Catalog] Preload complete: ${loaded} items cached`);

        try {
            localStorage.setItem(ECONOMY_CACHE_PRELOAD_KEY, Date.now().toString());
        } catch (e) {
            console.warn('[Catalog] Could not save preload timestamp:', e);
        }

        preloadInProgress = false;
    }

    async function fetchResalePricesForLimitedItems(items, isClassicMode = false) {
        console.log('[Economy] fetchResalePricesForLimitedItems called', { itemCount: items.length, isClassicMode });

        if (!window.roblox?.getAssetEconomyDetails) {
            console.warn('[Economy] window.roblox.getAssetEconomyDetails not available');
            return;
        }

        const cache = getEconomyCache();
        console.log('[Economy] Cache has', Object.keys(cache).length, 'entries');

        const itemsToFetch = isClassicMode
            ? items.filter(item => !cache[item.id]) 
            : items.filter(item => {
                const hasLimitedRestriction = item.itemRestrictions?.includes('Limited') || 
                    item.itemRestrictions?.includes('LimitedUnique') ||
                    item.itemRestrictions?.includes('Collectible');
                const isLimited = item.isLimited || item.isLimitedUnique ||
                    item.collectibleItemType === 'Limited' || item.collectibleItemType === 'LimitedUnique' ||
                    hasLimitedRestriction;
                
                return isLimited && !item.lowestPrice && !cache[item.id];
            });

        console.log('[Economy] Items to fetch:', itemsToFetch.length);

        let cachedApplied = 0;
        for (const item of items) {
            const cached = cache[item.id];
            
            if (cached && !item.lowestPrice) {
                applyEconomyDataToDOM(item.id, cached, isClassicMode);
                cachedApplied++;
            }
        }
        console.log('[Economy] Applied cached data to', cachedApplied, 'items');

        let fetchedCount = 0;
        let errorCount = 0;
        for (const item of itemsToFetch) {
            try {
                const economyDetails = await window.roblox.getAssetEconomyDetails(item.id);
                console.log('[Economy] Fetched item', item.id, ':', economyDetails);

                if (economyDetails) {
                    const data = {
                        isLimited: economyDetails.IsLimited || economyDetails.isLimited || false,
                        isLimitedUnique: economyDetails.IsLimitedUnique || economyDetails.isLimitedUnique || false,
                        lowestSellerPrice: economyDetails.LowestSellerPrice ?? economyDetails.lowestSellerPrice ?? null,
                        priceInRobux: economyDetails.PriceInRobux ?? economyDetails.priceInRobux ?? null,
                        isForSale: economyDetails.IsForSale || economyDetails.isForSale || false,
                        timestamp: Date.now() 
                    };
                    console.log('[Economy] Parsed data:', data);

                    cache[item.id] = data;
                    setEconomyCache(cache);

                    applyEconomyDataToDOM(item.id, data, isClassicMode);
                    fetchedCount++;
                }
            } catch (e) {
                console.warn('[Economy] Error fetching item', item.id, ':', e.message);
                errorCount++;
            }
        }
        console.log('[Economy] Fetched', fetchedCount, 'items, errors:', errorCount);
    }

    function applyEconomyDataToDOM(itemId, data, isClassicMode) {
        const assetEl = document.querySelector(`.Asset[data-item-id="${itemId}"]`);
        if (!assetEl) {
            console.log('[Economy DOM] Element not found for item', itemId);
            return;
        }

        const isLimited = data.isLimited || data.isLimitedUnique;

        if (isLimited) {
            const thumbDiv = assetEl.querySelector('.AssetThumbnail');
            if (thumbDiv && !thumbDiv.querySelector('.limited-badge')) {
                const badge = document.createElement('div');
                badge.className = 'limited-badge';
                badge.innerHTML = data.isLimitedUnique
                    ? '<img src="images/assetIcons/limitedunique.png" alt="Limited U">'
                    : '<img src="images/assetIcons/limited.png" alt="Limited">';
                thumbDiv.appendChild(badge);
                console.log('[Economy DOM] Added limited badge to item', itemId);
            }
        }

        const priceEl = assetEl.querySelector('.AssetPrice .PriceInRobux');
        const priceContainer = assetEl.querySelector('.AssetPrice');
        
        if (isLimited) {
            console.log('[Economy DOM] Item', itemId, 'is limited, lowestSellerPrice:', data.lowestSellerPrice);
            
            if (priceEl && priceContainer) {
                if (data.lowestSellerPrice && data.lowestSellerPrice > 0) {
                    priceEl.textContent = `R$: ${data.lowestSellerPrice.toLocaleString()}`;
                    priceContainer.style.display = 'block';
                    console.log('[Economy DOM] Updated price for limited item', itemId);
                }
                
            }
        } else if (isClassicMode && data.isForSale && data.priceInRobux !== null) {
            
            if (priceEl && priceContainer) {
                priceEl.textContent = data.priceInRobux === 0 ? 'Free' : `R$: ${data.priceInRobux.toLocaleString()}`;
                priceContainer.style.display = 'block';
                console.log('[Economy DOM] Updated price for item', itemId, 'to', data.priceInRobux);
            }
        } else if (isClassicMode && !data.isForSale) {
            
            if (priceEl && priceContainer) {
                priceEl.textContent = 'Off Sale';
                priceEl.style.color = '#cc0000';
                priceContainer.style.display = 'block';
            }
        }
    }

    function renderCatalogItem(item) {
        const id = item.id || item.assetId;
        const name = item.name || 'Unknown Item';

        const hasLimitedRestriction = item.itemRestrictions?.includes('Limited');
        const hasLimitedUniqueRestriction = item.itemRestrictions?.includes('LimitedUnique');
        const hasCollectibleRestriction = item.itemRestrictions?.includes('Collectible');

        const isLimitedUnique = item.isLimitedUnique || 
            item.collectibleItemType === 'LimitedUnique' || 
            hasLimitedUniqueRestriction ||
            hasCollectibleRestriction; 

        const isLimited = !isLimitedUnique && (
            item.isLimited || 
            item.collectibleItemType === 'Limited' || 
            hasLimitedRestriction
        );

        if (hasLimitedRestriction || hasLimitedUniqueRestriction || hasCollectibleRestriction) {
            console.log('[Catalog] Item', id, name, 'restrictions:', item.itemRestrictions, 
                'isLimitedUnique:', isLimitedUnique, 'isLimited:', isLimited);
        }

        let displayPrice = null;
        let priceText = '';
        
        if (isLimited || isLimitedUnique) {
            
            if (item.lowestPrice && item.lowestPrice > 0) {
                displayPrice = item.lowestPrice;
                priceText = `R$: ${displayPrice.toLocaleString()}`;
            } else if (item.lowestResalePrice && item.lowestResalePrice > 0) {
                displayPrice = item.lowestResalePrice;
                priceText = `R$: ${displayPrice.toLocaleString()}`;
            } else {
                
                priceText = '';
            }
        } else if (currentMode === 'Classic') {
            
            if (item.isForSale === false) {
                priceText = 'Off Sale';
            } else if (item.priceInRobux !== undefined && item.priceInRobux !== null) {
                displayPrice = item.priceInRobux;
                priceText = displayPrice === 0 ? 'Free' : `R$: ${displayPrice.toLocaleString()}`;
            }
            
        } else {
            
            const price = item.price ?? item.lowestPrice ?? null;
            if (price !== null && price !== undefined) {
                displayPrice = price;
                priceText = displayPrice === 0 ? 'Free' : `R$: ${displayPrice.toLocaleString()}`;
            }
        }

        const priceInTickets = item.priceInTickets;
        const creatorName = item.creatorName || item.creator?.name || 'ROBLOX';
        const creatorId = item.creatorTargetId || item.creator?.id || 1;
        const creatorType = item.creatorType || item.creator?.type || 'User';
        const favoriteCount = item.favoriteCount || 0;
        const remaining = item.unitsAvailableForConsumption;
        const itemType = item.itemType || 'Asset';

        const creatorHref = creatorType === 'Group' ? `#group?id=${creatorId}` : `#profile?id=${creatorId}`;

        const placeholderImg = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

        let thumbUrl = item.thumbnailUrl || placeholderImg;

        let limitedBadge = '';
        if (isLimitedUnique) {
            limitedBadge = '<div class="limited-badge"><img src="images/assetIcons/limitedunique.png" alt="Limited U"></div>';
        } else if (isLimited) {
            limitedBadge = '<div class="limited-badge"><img src="images/assetIcons/limited.png" alt="Limited"></div>';
        }

        let priceHtml = '';
        if (priceText) {
            const isOffSale = priceText === 'Off Sale';
            const priceStyle = isOffSale ? ' style="color:#cc0000;"' : '';
            priceHtml = `<div class="AssetPrice"><span class="PriceInRobux"${priceStyle}>${priceText}</span></div>`;
        } else if (priceInTickets) {
            priceHtml = `<div class="AssetPrice"><span class="PriceInTickets">Tx: ${priceInTickets.toLocaleString()}</span></div>`;
        } else {
            
            priceHtml = `<div class="AssetPrice" style="display:none;"><span class="PriceInRobux"></span></div>`;
        }

        let lowestPriceHtml = '';
        if (isLimited || isLimitedUnique) {
            lowestPriceHtml = `<div class="AssetFavorites"><span class="Detail"><i>Lowest Price</i></span></div>`;
        }

        let remainingHtml = '';
        if (isLimitedUnique && remaining !== undefined) {
            remainingHtml = `<div class="AssetsSold"><span class="Label" style="color:#cc0000;">Remaining:</span> <span class="Detail">${remaining.toLocaleString()}</span></div>`;
        }

        return `
            <td valign="top">
                <div class="Asset" style="margin-left:5px;margin-right:5px;" data-item-id="${id}" data-item-type="${itemType}">
                    <div class="AssetThumbnail">
                        <a href="#" onclick="return false;" title="${escapeHtml(name)}" style="display:inline-block;height:110px;width:110px;cursor:pointer;"><img src="${thumbUrl}" width="110" height="110" loading="lazy" border="0" alt="${escapeHtml(name)}"/></a>
                        ${limitedBadge}
                    </div>
                    <div class="AssetDetails">
                        <div class="AssetName"><a href="#catalog-item?id=${id}&type=${itemType}">${escapeHtml(name)}</a></div>
                        <div class="AssetCreator">
                            <span class="Label">Creator:</span>
                            <span class="Detail"><a href="${creatorHref}">${escapeHtml(creatorName)}</a></span>
                        </div>
                        ${remainingHtml}
                        <div class="AssetFavorites">
                            <span class="Label">Favorited:</span>
                            <span class="Detail">${favoriteCount.toLocaleString()} times</span>
                        </div>
                        ${priceHtml}
                        ${lowestPriceHtml}
                    </div>
                </div>
            </td>
        `;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function updatePagination() {
        
        const headerPager = document.getElementById('ctl00_cphRoblox_rbxCatalog_HeaderPagerPanel');
        if (headerPager) {
            headerPager.style.display = 'none';
        }

        let pagerHtml = '';
        if (currentPage > 1) {
            pagerHtml += `<a href="#" class="catalog-prev-btn" id="footerPrevBtn"><span class="NavigationIndicators">&lt;&lt;</span> Previous</a> `;
        }

        if (currentMode === 'Classic' && totalPages > 0) {
            pagerHtml += `<span id="ctl00_cphRoblox_rbxCatalog_FooterPagerLabel">Page ${currentPage} of ${totalPages}</span>`;
        } else {
            pagerHtml += `<span id="ctl00_cphRoblox_rbxCatalog_FooterPagerLabel">Page ${currentPage}</span>`;
        }

        const hasMorePages = currentMode === 'Classic' 
            ? currentPage < totalPages 
            : (currentPage < totalPages || currentCursor);
            
        if (hasMorePages) {
            pagerHtml += ` <a href="#" class="catalog-next-btn" id="footerNextBtn">Next <span class="NavigationIndicators">&gt;&gt;</span></a>`;
        }

        const footerPager = document.getElementById('ctl00_cphRoblox_rbxCatalog_FooterPagerPanel');
        if (footerPager) {
            footerPager.innerHTML = pagerHtml;
            footerPager.style.display = 'block';
        }

        bindPaginationHandlers();
    }

    function navigateToItemDetail(itemId, itemType = 'Asset') {
        window.location.hash = `#catalog-item?id=${itemId}&type=${itemType}`;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function resetCatalogPage() {
        
        if (economyWorker) {
            economyWorker.terminate();
            economyWorker = null;
            workerCallbacks.clear();
            console.log('[Catalog] Economy worker terminated');
        }

        classicItemsList = null;

        currentMode = 'Classic';
        currentCategory = 'All';
        currentSubcategory = '';
        currentSalesType = 'All';
        currentTimeFilter = 'AllTime';
        currentPage = 1;
        currentCursor = '';
        currentKeyword = '';
        totalPages = 1;
        cursorHistory = [''];
        isLoadingPage = false;
        catalogLoaded = false;

        browseModeHandlerAttached = false;
        categoryHandlerAttached = false;
        paginationHandlerAttached = false;

        const container = document.getElementById('ctl00_cphRoblox_rbxCatalog_AssetsDataList');
        if (container) {
            container.innerHTML = '';
        }
    }

    window.CatalogPage = {
        init: initCatalog,
        load: loadCatalogPage,
        setMode: setMode,
        setCategory: setCategory,
        setSalesType: setSalesType,
        setTimeFilter: setTimeFilter,
        search: searchCatalog,
        showItem: navigateToItemDetail,
        reset: resetCatalogPage
    };
})();
