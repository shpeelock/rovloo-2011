
(function() {
    'use strict';

    const PAGE_ID = 'games';

    let gamesLoaded = false;
    let isLoading = false;
    let currentSort = 'MostPopular';
    let currentTime = 'Now';
    let currentGenre = 'All';
    let currentCategory = 'trending'; 
    let currentPage = 1;
    const gamesPerPage = 20;

    let currentLoadRequestId = 0;

    function isRequestStale(requestId) {
        return requestId !== currentLoadRequestId;
    }

    let allGames = [];
    let unfilteredGames = []; 
    let totalPages = 1;

    let isSearchMode = false;
    let searchQuery = '';
    let searchSessionId = null;
    let searchNextPageToken = '';
    let searchDebounceTimer = null;
    let unfilteredSearchResults = []; 

    let isPaginating = false;
    let pendingPage = null;

    function applyClientSideFilters() {
        
        if (currentCategory === 'trending') {
            console.log('[ClientFilter] Skipping - trending category uses API filtering');
            return; 
        }

        console.log('[ClientFilter] Applying filters - Category:', currentCategory, 'Genre:', currentGenre, 'Sort:', currentSort);
        console.log('[ClientFilter] unfilteredGames count:', unfilteredGames.length);

        if (unfilteredGames.length > 0) {
            console.log('[ClientFilter] Sample game genres:', unfilteredGames.slice(0, 5).map(g => ({ name: g.name, genre: g.genre, genre_l1: g.genre_l1 })));
        }

        let filteredGames = [...unfilteredGames];

        if (currentGenre !== 'All') {
            filteredGames = filteredGames.filter(game => {
                const gameGenre = (game.genre || game.genre_l1 || '').toLowerCase();
                const filterGenre = currentGenre.toLowerCase();

                if (!gameGenre || gameGenre === 'all') {
                    return false;
                }

                if (gameGenre === filterGenre) {
                    return true;
                }

                if (gameGenre.startsWith(filterGenre + ' ') || gameGenre.startsWith(filterGenre + '-')) {
                    return true;
                }

                if (gameGenre.includes(' and ') && gameGenre.split(' and ')[0] === filterGenre) {
                    return true;
                }
                
                return false;
            });
            console.log('[ClientFilter] After genre filter:', filteredGames.length, 'games');
        }

        filteredGames = sortGamesClientSide(filteredGames);

        allGames = filteredGames;
        totalPages = Math.ceil(allGames.length / gamesPerPage);
        currentPage = 1;

        console.log('[ClientFilter] Final result:', allGames.length, 'games, totalPages:', totalPages);

        displayCurrentPage();
    }

    function sortGamesClientSide(games) {
        const sortedGames = [...games];
        const now = new Date();

        switch (currentCategory) {
            case 'recommended':
                
                switch (currentSort) {
                    case 'PlayHistory':
                        
                        break;
                    case 'Favorites':
                        
                        sortedGames.sort((a, b) => (b.favoritedCount || 0) - (a.favoritedCount || 0));
                        break;
                    case 'Friends':
                        
                        break;
                    case 'Similar':
                        
                        break;
                    default:
                        break;
                }
                break;

            case 'favorites':
                
                switch (currentSort) {
                    case 'Recent':
                        
                        break;
                    case 'Alphabetical':
                        sortedGames.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                        break;
                    case 'MostPlayed':
                        sortedGames.sort((a, b) => (b.visits || 0) - (a.visits || 0));
                        break;
                    default:
                        break;
                }
                break;

            case 'recent':
                
                switch (currentSort) {
                    case 'LastPlayed':
                        
                        const getGameDate = (game) => {
                            return new Date(game.lastPlayed || game.updated || game.created || 0);
                        };
                        return sortedGames.sort((a, b) => getGameDate(b) - getGameDate(a));

                    case 'MostPlaytime':
                        
                        return sortedGames.sort((a, b) => {
                            const playtimeA = (a.playtime?.totalMinutes || 0);
                            const playtimeB = (b.playtime?.totalMinutes || 0);
                            return playtimeB - playtimeA;
                        });

                    default:
                        return sortedGames;
                }

            case 'rovloo':
                
                return sortRovlooGames(sortedGames);

            default:
                break;
        }

        return sortedGames;
    }

    const isStandalonePage = window.location.pathname.includes('games.html');

    if (isStandalonePage) {
        document.addEventListener('DOMContentLoaded', initGames);
    } else {
        
        document.addEventListener('pageChange', function(e) {
            if (e.detail.page === 'games') {
                if (!gamesLoaded) {
                    loadGamesPage(e.detail.params);
                } else {
                    
                    handlePageParams(e.detail.params || {});
                }
            }
        });
    }

    async function loadGamesPage(params = null) {
        if (isLoading) return;
        
        const container = document.getElementById('games-content');
        if (!container) {
            console.error('Games container not found');
            return;
        }

        isLoading = true;
        container.innerHTML = '<div class="loading">Loading games...</div>';

        try {
            const response = await fetch('pages/games.html');
            if (!response.ok) throw new Error('Failed to fetch games page');
            
            let html = await response.text();

            let content = '';

            const bodyRegex = /<div id="Body">([\s\S]*?)<div id="Footer">/i;
            const bodyMatch = html.match(bodyRegex);
            
            if (bodyMatch && bodyMatch[1]) {
                 
                 content = bodyMatch[1];
            } else {
                
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const bodyDiv = doc.getElementById('Body') || doc.body;
                
                if (bodyDiv) {
                    
                    content = bodyDiv.innerHTML;
                }
            }
            
            if (content) {
                
                content = content.replace(/\.\.\/images\
                content = content.replace(/\.\.\/CSS\
                
                container.innerHTML = content;
                gamesLoaded = true;
                isLoading = false;

                registerCleanup();

                setTimeout(() => {
                    initGames(params);
                    
                    if (!isSearchMode) {
                        loadGamesFromAPI();
                    }
                }, 0);
            } else {
                isLoading = false;
                console.error('Failed to extract content from games.html');
                if (window.showErrorPage) {
                    window.showErrorPage('Failed to parse games page content', 'games-content');
                } else {
                    container.innerHTML = '<div class="error">Failed to parse games page content</div>';
                }
            }
        } catch (error) {
            isLoading = false;
            console.error('Failed to load games page:', error);
            if (window.showErrorPage) {
                window.showErrorPage('Failed to load games: ' + error.message, 'games-content');
            } else {
                container.innerHTML = '<div class="error">Failed to load games: ' + error.message + '</div>';
            }
        }
    }

    function initGames(params = null) {
        
        isSearchMode = false;
        searchQuery = '';
        searchSessionId = null;
        searchNextPageToken = '';

        const gamesColumn = document.querySelector('.Column1e');
        const mainColumn = document.querySelector('.Column2e');
        const body = document.getElementById('Body');
        const gamesList = document.getElementById('GamesList');
        if (gamesColumn) gamesColumn.classList.remove('sidebar-hidden');
        if (mainColumn) mainColumn.classList.remove('search-mode-expanded');
        if (body) body.classList.remove('search-mode');
        if (gamesList) gamesList.classList.remove('games-fading-out');

        initFilterHandlers();
        initPaginationHandlers();
        initSearchHandler();
        console.log('Games page initialized');

        preloadCachedGamesIntoMemory();

        if (!params && window.location.hash) {
            params = parseHashParams();
        }

        if (params) {
            console.log('Games page params:', params);
            handlePageParams(params);
        } else {
            
            resetToDefaultState();
        }

        if (isStandalonePage && !isSearchMode) {
            loadGamesFromAPI();
        }
    }

    function parseHashParams() {
        
        const hash = window.location.hash;
        const params = {};

        const queryIndex = hash.indexOf('?');
        if (queryIndex !== -1) {
            const queryString = hash.substring(queryIndex + 1);
            const pairs = queryString.split('&');
            pairs.forEach(pair => {
                const [key, value] = pair.split('=');
                if (key) {
                    params[key] = decodeURIComponent(value || '1');
                }
            });
        }

        return Object.keys(params).length > 0 ? params : null;
    }

    function initSearchHandler() {
        const searchBox = document.getElementById('GamesSearchBox');
        if (!searchBox) return;

        const keydownHandler = function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const query = searchBox.value.trim();
                if (query.length >= 2) {
                    performSearch(query);
                }
            } else if (e.key === 'Escape') {
                
                searchBox.value = '';
                if (isSearchMode) {
                    exitSearchMode();
                }
            }
        };

        const inputHandler = function(e) {
            const query = searchBox.value.trim();

            if (query.length === 0 && isSearchMode) {
                exitSearchMode();
            }
        };

        if (window.PerformanceUtils) {
            window.PerformanceUtils.addPageListener(PAGE_ID, searchBox, 'keydown', keydownHandler);
            window.PerformanceUtils.addPageListener(PAGE_ID, searchBox, 'input', inputHandler);
        } else {
            searchBox.addEventListener('keydown', keydownHandler);
            searchBox.addEventListener('input', inputHandler);
        }
    }

    async function performSearch(query) {
        if (isLoading) return;

        console.log('Performing search for:', query);
        searchQuery = query;

        if (!isSearchMode) {
            await enterSearchMode();
        }

        searchNextPageToken = '';
        searchSessionId = null;
        currentPage = 1;
        allGames = [];
        unfilteredSearchResults = [];
        currentGenre = 'All';
        updateFilterUI('#Genre', 'All');

        updateDisplayLabel();

        await loadSearchResults();
    }

    async function enterSearchMode() {
        isSearchMode = true;
        currentGenre = 'All'; 

        const gamesList = document.getElementById('GamesList');
        const gamesColumn = document.querySelector('.Column1e');
        const mainColumn = document.querySelector('.Column2e');
        const body = document.getElementById('Body');

        if (gamesList) {
            gamesList.classList.add('games-fading-out');
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        if (gamesColumn) {
            gamesColumn.classList.add('sidebar-hidden');
        }
        if (mainColumn) {
            mainColumn.classList.add('search-mode-expanded');
        }
        if (body) {
            body.classList.add('search-mode');
        }

        createSearchModeHoverTrigger();

        await new Promise(resolve => setTimeout(resolve, 400));
    }

    async function exitSearchMode() {
        if (!isSearchMode) return;

        console.log('Exiting search mode');
        isSearchMode = false;
        searchQuery = '';
        searchSessionId = null;
        searchNextPageToken = '';
        currentGenre = 'All'; 

        const gamesList = document.getElementById('GamesList');
        const gamesColumn = document.querySelector('.Column1e');
        const mainColumn = document.querySelector('.Column2e');
        const body = document.getElementById('Body');

        const searchBox = document.getElementById('GamesSearchBox');
        if (searchBox) {
            searchBox.value = '';
        }

        removeSearchModeHoverTrigger();

        if (body) {
            body.classList.remove('search-mode');
        }
        if (gamesColumn) {
            gamesColumn.classList.remove('sidebar-hidden');
            gamesColumn.classList.remove('sidebar-peek');
        }
        if (mainColumn) {
            mainColumn.classList.remove('search-mode-expanded');
        }

        await new Promise(resolve => setTimeout(resolve, 400));

        updateDisplayLabel();

        if (gamesList) {
            gamesList.classList.remove('games-fading-out');
        }

        await loadGamesFromAPI();
    }

    async function loadSearchResults() {
        const gamesList = document.getElementById('GamesList');
        const loading = document.getElementById('GamesLoading');
        const error = document.getElementById('GamesError');

        if (!window.roblox || !window.roblox.searchGames) {
            console.error('Search API not available');
            if (error) {
                error.textContent = 'Search is not available.';
                error.style.display = 'block';
            }
            return;
        }

        if (loading) loading.style.display = 'block';
        if (gamesList) {
            gamesList.classList.remove('games-fading-out');
            gamesList.style.display = 'none';
        }
        if (error) error.style.display = 'none';

        isLoading = true;

        try {
            const result = await window.roblox.searchGames(searchQuery, searchNextPageToken, searchSessionId);

            console.log('Search results:', result);

            if (result && result.games) {
                
                unfilteredSearchResults = result.games;
                allGames = result.games;
                searchSessionId = result.sessionId;
                searchNextPageToken = result.nextPageToken || '';

                await enrichGamesWithCreatorInfo(allGames);
                
                unfilteredSearchResults = [...allGames];

                if (currentGenre !== 'All') {
                    applySearchGenreFilter();
                }

                totalPages = Math.ceil(allGames.length / gamesPerPage);

                if (allGames.length === 0) {
                    if (gamesList) {
                        gamesList.innerHTML = `
                            <div style="text-align: center; padding: 60px 20px;">
                                <p style="font-size: 14px; color: #666;">No games found for "${searchQuery}"</p>
                                <p style="font-size: 12px; color: #999; margin-top: 10px;">Try a different search term</p>
                            </div>
                        `;
                        gamesList.style.display = 'block';
                    }
                } else {
                    await displayCurrentPage();
                }
            }
        } catch (err) {
            console.error('Search failed:', err);
            if (error) {
                error.textContent = 'Search failed: ' + err.message;
                error.style.display = 'block';
            }
        } finally {
            isLoading = false;
            if (loading) loading.style.display = 'none';
        }
    }

    function handlePageParams(params) {

        if (params.search || params.sort === 'search') {
            enterSearchModeImmediate();
            return; 
        }

        let wasInSearchMode = false;
        if (isSearchMode) {
            resetSearchModeUI();
            wasInSearchMode = true;
        }

        const hasParams = params && Object.keys(params).length > 0;
        
        if (!hasParams) {
            
            resetToDefaultState();
            loadGamesFromAPI();
            return;
        }

        let changed = false;

        if (params.genre) {
            setGenreFilter(params.genre, false);
            changed = true;
        } else if (params.genre === undefined && currentGenre !== 'All') {
            setGenreFilter('All', false);
            changed = true;
        }

        if (params.sort) {
            setSortFilter(params.sort, false);
            changed = true;
        } else if (params.sort === undefined && currentSort !== 'MostPopular') {
            setSortFilter('MostPopular', false);
            changed = true;
        }

        if (params.time) {
            setTimeFilter(params.time, false);
            changed = true;
        }

        if (changed || wasInSearchMode || hasParams) {
            loadGamesFromAPI();
        }
    }

    async function enterSearchModeImmediate() {
        
        isSearchMode = true;
        currentGenre = 'All'; 

        const gamesList = document.getElementById('GamesList');
        const gamesColumn = document.querySelector('.Column1e');
        const mainColumn = document.querySelector('.Column2e');
        const body = document.getElementById('Body');
        const searchBox = document.getElementById('GamesSearchBox');
        const loading = document.getElementById('GamesLoading');

        if (loading) loading.style.display = 'none';
        if (gamesList) {
            gamesList.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <p style="font-size: 14px; color: #666;">Type a search query above to find games</p>
                </div>
            `;
            gamesList.style.display = 'block';
        }

        if (gamesColumn) {
            gamesColumn.classList.add('sidebar-hidden');
        }
        if (mainColumn) {
            mainColumn.classList.add('search-mode-expanded');
        }
        if (body) {
            body.classList.add('search-mode');
        }

        createSearchModeHoverTrigger();

        const label = document.getElementById('GamesDisplayLabel');
        if (label) {
            label.textContent = 'Search Games';
        }

        updatePaginationUI();

        setTimeout(() => {
            if (searchBox) {
                searchBox.focus();
            }
        }, 100);
    }

    function createSearchModeHoverTrigger() {
        
        const existingTrigger = document.querySelector('.search-mode-hover-trigger');
        if (existingTrigger) {
            existingTrigger.remove();
        }

        const bodyEl = document.getElementById('Body');
        if (!bodyEl) return;

        bodyEl.style.position = 'relative';

        const trigger = document.createElement('div');
        trigger.className = 'search-mode-hover-trigger';
        trigger.title = 'Hover to show genre filters';
        bodyEl.appendChild(trigger);

        const gamesColumn = document.querySelector('.Column1e');
        const mainColumn = document.querySelector('.Column2e');
        let hideTimeout = null;

        const showSidebar = () => {
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }
            if (isSearchMode) {
                if (gamesColumn) {
                    gamesColumn.classList.add('sidebar-peek');
                }
                if (mainColumn) {
                    mainColumn.classList.add('sidebar-peeking');
                }
            }
        };

        const hideSidebar = () => {
            hideTimeout = setTimeout(() => {
                if (gamesColumn) {
                    gamesColumn.classList.remove('sidebar-peek');
                }
                if (mainColumn) {
                    mainColumn.classList.remove('sidebar-peeking');
                }
            }, 300); 
        };

        trigger.addEventListener('mouseenter', showSidebar);
        trigger.addEventListener('mouseleave', hideSidebar);

        if (gamesColumn) {
            gamesColumn.addEventListener('mouseenter', () => {
                if (isSearchMode && gamesColumn.classList.contains('sidebar-peek')) {
                    if (hideTimeout) {
                        clearTimeout(hideTimeout);
                        hideTimeout = null;
                    }
                }
            });
            gamesColumn.addEventListener('mouseleave', () => {
                if (isSearchMode && gamesColumn.classList.contains('sidebar-peek')) {
                    hideSidebar();
                }
            });
        }
    }

    function removeSearchModeHoverTrigger() {
        const trigger = document.querySelector('.search-mode-hover-trigger');
        if (trigger) {
            trigger.remove();
        }
        const gamesColumn = document.querySelector('.Column1e');
        if (gamesColumn) {
            gamesColumn.classList.remove('sidebar-peek');
        }
        const mainColumn = document.querySelector('.Column2e');
        if (mainColumn) {
            mainColumn.classList.remove('sidebar-peeking');
        }
    }

    function initFilterHandlers() {
        
        document.querySelectorAll('#CategorySelector .GamesFilter').forEach(link => {
            const handler = function(e) {
                e.preventDefault();
                const category = link.getAttribute('data-category');
                if (category && category !== currentCategory) {
                    
                    if (isSearchMode) {
                        exitSearchMode();
                    }
                    switchCategory(category);
                }
            };

            if (window.PerformanceUtils) {
                window.PerformanceUtils.addPageListener(PAGE_ID, link, 'click', handler);
            } else {
                link.addEventListener('click', handler);
            }
        });

        document.querySelectorAll('#Timespan .GamesFilter').forEach(link => {
            const filter = link.getAttribute('data-filter');
            const handler = function(e) {
                e.preventDefault();
                if (filter) {
                    setTimeFilter(filter);
                }
            };

            if (window.PerformanceUtils) {
                window.PerformanceUtils.addPageListener(PAGE_ID, link, 'click', handler);
            } else {
                link.addEventListener('click', handler);
            }
        });

        document.querySelectorAll('#SortBy .GamesFilter').forEach(link => {
            const filter = link.getAttribute('data-filter');
            const handler = function(e) {
                e.preventDefault();
                if (filter) {
                    setSortFilter(filter);
                }
            };

            if (window.PerformanceUtils) {
                window.PerformanceUtils.addPageListener(PAGE_ID, link, 'click', handler);
            } else {
                link.addEventListener('click', handler);
            }
        });

        document.querySelectorAll('#Genre .GamesFilter').forEach(link => {
            const filter = link.getAttribute('data-filter');
            const handler = function(e) {
                e.preventDefault();
                if (filter) {
                    setGenreFilter(filter);
                }
            };

            if (window.PerformanceUtils) {
                window.PerformanceUtils.addPageListener(PAGE_ID, link, 'click', handler);
            } else {
                link.addEventListener('click', handler);
            }
        });

        document.querySelectorAll('#RecommendedFilters .GamesFilter[data-filter="PlayHistory"], #RecommendedFilters .GamesFilter[data-filter="Favorites"], #RecommendedFilters .GamesFilter[data-filter="Friends"], #RecommendedFilters .GamesFilter[data-filter="Similar"]').forEach(link => {
            const filter = link.getAttribute('data-filter');
            const handler = function(e) {
                e.preventDefault();
                if (filter) {
                    currentSort = filter;
                    updateFilterUI('#RecommendedFilters', filter);
                    updateDisplayLabel();
                    
                    applyClientSideFilters();
                }
            };

            if (window.PerformanceUtils) {
                window.PerformanceUtils.addPageListener(PAGE_ID, link, 'click', handler);
            } else {
                link.addEventListener('click', handler);
            }
        });

        const recommendedGenreFilters = ['All', 'RPG', 'Action', 'Adventure', 'Shooter', 'Sports', 'Simulation', 'Roleplay', 'Obby', 'Survival'];
        document.querySelectorAll('#RecommendedFilters .GamesFilter').forEach(link => {
            const filter = link.getAttribute('data-filter');
            
            if (filter && recommendedGenreFilters.includes(filter)) {
                const handler = function(e) {
                    e.preventDefault();
                    if (filter) {
                        currentGenre = filter;
                        
                        document.querySelectorAll('#RecommendedFilters .GamesFilter').forEach(f => {
                            const fFilter = f.getAttribute('data-filter');
                            if (recommendedGenreFilters.includes(fFilter)) {
                                f.classList.toggle('SelectedFilter', fFilter === filter);
                            }
                        });
                        updateDisplayLabel();
                        applyClientSideFilters();
                    }
                };

                if (window.PerformanceUtils) {
                    window.PerformanceUtils.addPageListener(PAGE_ID, link, 'click', handler);
                } else {
                    link.addEventListener('click', handler);
                }
            }
        });

        const favSortLinks = document.querySelectorAll('#FavoritesFilters .GamesFilter[data-filter="Recent"], #FavoritesFilters .GamesFilter[data-filter="Alphabetical"], #FavoritesFilters .GamesFilter[data-filter="MostPlayed"]');
        console.log('[Favorites] Found', favSortLinks.length, 'sort filter links');
        favSortLinks.forEach(link => {
            const filter = link.getAttribute('data-filter');
            const handler = function(e) {
                e.preventDefault();
                console.log('[Favorites] Sort filter clicked:', filter);
                if (filter) {
                    currentSort = filter;
                    
                    document.querySelectorAll('#FavoritesFilters .GamesFilter').forEach(f => {
                        const fFilter = f.getAttribute('data-filter');
                        if (fFilter === 'Recent' || fFilter === 'Alphabetical' || fFilter === 'MostPlayed') {
                            f.classList.toggle('SelectedFilter', fFilter === filter);
                        }
                    });
                    updateDisplayLabel();
                    applyClientSideFilters();
                }
            };

            if (window.PerformanceUtils) {
                window.PerformanceUtils.addPageListener(PAGE_ID, link, 'click', handler);
            } else {
                link.addEventListener('click', handler);
            }
        });

        const favoritesGenreFilters = ['All', 'RPG', 'Action', 'Adventure', 'Shooter', 'Sports', 'Simulation', 'Roleplay', 'Obby', 'Survival'];
        const favGenreLinks = document.querySelectorAll('#FavoritesFilters .GamesFilter');
        console.log('[Favorites] Found', favGenreLinks.length, 'total filter links for genre check');
        favGenreLinks.forEach(link => {
            const filter = link.getAttribute('data-filter');
            
            if (filter && favoritesGenreFilters.includes(filter)) {
                console.log('[Favorites] Attaching genre handler for:', filter);
                const handler = function(e) {
                    e.preventDefault();
                    console.log('[Favorites] Genre filter clicked:', filter);
                    if (filter) {
                        currentGenre = filter;
                        
                        document.querySelectorAll('#FavoritesFilters .GamesFilter').forEach(f => {
                            const fFilter = f.getAttribute('data-filter');
                            if (favoritesGenreFilters.includes(fFilter)) {
                                f.classList.toggle('SelectedFilter', fFilter === filter);
                            }
                        });
                        updateDisplayLabel();
                        applyClientSideFilters();
                    }
                };

                if (window.PerformanceUtils) {
                    window.PerformanceUtils.addPageListener(PAGE_ID, link, 'click', handler);
                } else {
                    link.addEventListener('click', handler);
                }
            }
        });

        document.querySelectorAll('#RecentFilters .GamesFilter').forEach(link => {
            const filter = link.getAttribute('data-filter');
            const handler = function(e) {
                e.preventDefault();
                if (filter) {
                    currentSort = filter;
                    updateFilterUI('#RecentFilters', filter);
                    updateDisplayLabel();
                    
                    applyClientSideFilters();
                }
            };

            if (window.PerformanceUtils) {
                window.PerformanceUtils.addPageListener(PAGE_ID, link, 'click', handler);
            } else {
                link.addEventListener('click', handler);
            }
        });

        document.querySelectorAll('#RovlooSortBy .GamesFilter').forEach(link => {
            const filter = link.getAttribute('data-filter');
            const handler = function(e) {
                e.preventDefault();
                
                if (currentCategory !== 'rovloo') {
                    console.log('[RovlooSort] Ignoring click - not in Rovloo category');
                    return;
                }
                if (filter) {
                    currentSort = filter;
                    updateFilterUI('#RovlooSortBy', filter);
                    updateDisplayLabel();
                    
                    loadGamesFromAPI();
                }
            };

            if (window.PerformanceUtils) {
                window.PerformanceUtils.addPageListener(PAGE_ID, link, 'click', handler);
            } else {
                link.addEventListener('click', handler);
            }
        });

        document.querySelectorAll('#RovlooGenre .GamesFilter').forEach(link => {
            const filter = link.getAttribute('data-filter');
            const handler = function(e) {
                e.preventDefault();
                
                if (currentCategory !== 'rovloo') {
                    console.log('[RovlooGenre] Ignoring click - not in Rovloo category');
                    return;
                }
                if (filter) {
                    currentGenre = filter;
                    updateFilterUI('#RovlooGenre', filter);
                    
                    applyClientSideFilters();
                }
            };

            if (window.PerformanceUtils) {
                window.PerformanceUtils.addPageListener(PAGE_ID, link, 'click', handler);
            } else {
                link.addEventListener('click', handler);
            }
        });

        const recentSortLinks = document.querySelectorAll('#RecentSortBy .GamesFilter');
        console.log('[Recent] Found', recentSortLinks.length, 'sort filter links');
        recentSortLinks.forEach(link => {
            const filter = link.getAttribute('data-filter');
            const handler = function(e) {
                e.preventDefault();
                console.log('[Recent] Sort filter clicked:', filter);
                if (filter) {
                    currentSort = filter;
                    localStorage.setItem('recentGamesSort', filter);  

                    document.querySelectorAll('#RecentSortBy .GamesFilter').forEach(f => {
                        const fFilter = f.getAttribute('data-filter');
                        f.classList.toggle('SelectedFilter', fFilter === filter);
                    });
                    updateDisplayLabel();
                    applyClientSideFilters();
                }
            };

            if (window.PerformanceUtils) {
                window.PerformanceUtils.addPageListener(PAGE_ID, link, 'click', handler);
            } else {
                link.addEventListener('click', handler);
            }
        });
    }

    function initPaginationHandlers() {
        const prevBtn = document.getElementById('GamesPrevPage');
        const nextBtn = document.getElementById('GamesNextPage');

        if (prevBtn) {
            const clickHandler = async function(e) {
                e.preventDefault();
                if (currentPage > 1) {
                    await navigateToPage(currentPage - 1);
                }
            };

            if (window.PerformanceUtils) {
                window.PerformanceUtils.addPageListener(PAGE_ID, prevBtn, 'click', clickHandler);
            } else {
                prevBtn.addEventListener('click', clickHandler);
            }

            const prevImg = prevBtn.querySelector('img');
            if (prevImg) {
                const mouseenterHandler = function() {
                    prevImg.src = 'images/arrow36px_leftOn.png';
                };
                const mouseleaveHandler = function() {
                    prevImg.src = 'images/arrow_36px_left.png';
                };

                if (window.PerformanceUtils) {
                    window.PerformanceUtils.addPageListener(PAGE_ID, prevBtn, 'mouseenter', mouseenterHandler);
                    window.PerformanceUtils.addPageListener(PAGE_ID, prevBtn, 'mouseleave', mouseleaveHandler);
                } else {
                    prevBtn.addEventListener('mouseenter', mouseenterHandler);
                    prevBtn.addEventListener('mouseleave', mouseleaveHandler);
                }
            }
        }

        if (nextBtn) {
            const clickHandler = async function(e) {
                e.preventDefault();

                if (isSearchMode && currentPage >= totalPages && searchNextPageToken) {
                    await loadMoreSearchResults();
                } else if (currentPage < totalPages) {
                    await navigateToPage(currentPage + 1);
                }
            };

            if (window.PerformanceUtils) {
                window.PerformanceUtils.addPageListener(PAGE_ID, nextBtn, 'click', clickHandler);
            } else {
                nextBtn.addEventListener('click', clickHandler);
            }

            const nextImg = nextBtn.querySelector('img');
            if (nextImg) {
                const mouseenterHandler = function() {
                    nextImg.src = 'images/arrow36px_rightOn.png';
                };
                const mouseleaveHandler = function() {
                    nextImg.src = 'images/arrow_36px_right.png';
                };

                if (window.PerformanceUtils) {
                    window.PerformanceUtils.addPageListener(PAGE_ID, nextBtn, 'mouseenter', mouseenterHandler);
                    window.PerformanceUtils.addPageListener(PAGE_ID, nextBtn, 'mouseleave', mouseleaveHandler);
                } else {
                    nextBtn.addEventListener('mouseenter', mouseenterHandler);
                    nextBtn.addEventListener('mouseleave', mouseleaveHandler);
                }
            }
        }
    }

    async function navigateToPage(targetPage) {
        
        if (isPaginating) {
            pendingPage = targetPage;
            currentPage = targetPage; 
            updatePaginationUI(); 
            return;
        }

        isPaginating = true;
        currentPage = targetPage;

        try {
            await displayCurrentPage();

            if (pendingPage !== null && pendingPage !== currentPage) {
                currentPage = pendingPage;
                pendingPage = null;
                await displayCurrentPage();
            }
        } finally {
            isPaginating = false;
            pendingPage = null;
        }
    }

    async function loadMoreSearchResults() {
        if (isLoading || !searchNextPageToken) return;

        const loading = document.getElementById('GamesLoading');
        const gamesList = document.getElementById('GamesList');
        const pageInfo = document.getElementById('GamesPageInfo');

        console.log('Loading more search results with token:', searchNextPageToken);

        isLoading = true;
        if (loading) loading.style.display = 'block';

        if (pageInfo) {
            pageInfo.textContent = 'Loading more...';
        }

        try {
            const result = await window.roblox.searchGames(searchQuery, searchNextPageToken, searchSessionId);

            if (result && result.games && result.games.length > 0) {
                
                await enrichGamesWithCreatorInfo(result.games);

                allGames = allGames.concat(result.games);
                searchNextPageToken = result.nextPageToken || '';

                totalPages = Math.ceil(allGames.length / gamesPerPage);
                currentPage++;

                console.log('Loaded', result.games.length, 'more games. Total:', allGames.length);

                await displayCurrentPage();
            } else {
                
                searchNextPageToken = '';
                updatePaginationUI();
            }
        } catch (err) {
            console.error('Failed to load more search results:', err);
            
            updatePaginationUI();
        } finally {
            isLoading = false;
            if (loading) loading.style.display = 'none';
        }
    }

    function setTimeFilter(time, refresh = true) {
        
        if (isSearchMode) {
            resetSearchModeUI();
        }
        currentTime = time;
        currentPage = 1;
        updateFilterUI('#Timespan', time);
        if (refresh) loadGamesFromAPI();
    }

    function setSortFilter(sort, refresh = true) {
        
        if (isSearchMode && sort !== 'search') {
            resetSearchModeUI();
        }
        currentSort = sort;
        currentPage = 1;
        updateFilterUI('#SortBy', sort);
        updateDisplayLabel();
        if (refresh) loadGamesFromAPI();
    }

    function setGenreFilter(genre, refresh = true) {
        
        if (isSearchMode) {
            currentGenre = genre;
            currentPage = 1;
            updateFilterUI('#Genre', genre);
            updateDisplayLabel();
            
            applySearchGenreFilter();
            return;
        }
        currentGenre = genre;
        currentPage = 1;
        updateFilterUI('#Genre', genre);
        updateSortByState(); 
        updateDisplayLabel();
        if (refresh) loadGamesFromAPI();
    }

    function applySearchGenreFilter() {
        if (!isSearchMode || !unfilteredSearchResults) {
            return;
        }

        console.log('[SearchFilter] Applying genre filter:', currentGenre);
        console.log('[SearchFilter] Unfiltered results:', unfilteredSearchResults.length);

        if (currentGenre === 'All') {
            allGames = [...unfilteredSearchResults];
        } else {
            allGames = unfilteredSearchResults.filter(game => {
                const gameGenre = (game.genre || game.genre_l1 || '').toLowerCase();
                const filterGenre = currentGenre.toLowerCase();
                
                if (!gameGenre || gameGenre === 'all') {
                    return false;
                }

                if (gameGenre === filterGenre) {
                    return true;
                }

                if (gameGenre.startsWith(filterGenre + ' ') || gameGenre.startsWith(filterGenre + '-')) {
                    return true;
                }
                
                if (gameGenre.includes(' and ') && gameGenre.split(' and ')[0] === filterGenre) {
                    return true;
                }
                
                return false;
            });
        }

        console.log('[SearchFilter] Filtered results:', allGames.length);

        totalPages = Math.ceil(allGames.length / gamesPerPage);
        currentPage = 1;
        displayCurrentPage();
    }

    function switchCategory(category) {
        if (category === currentCategory) return;
        
        console.log(`Switching to category: ${category}`);

        if (category === 'rovloo' && window.applyConditionalRovlooTheme) {
            window.applyConditionalRovlooTheme();
        } else if (currentCategory === 'rovloo' && window.removeConditionalRovlooTheme) {
            
            window.removeConditionalRovlooTheme();
        }

        currentCategory = category;
        currentPage = 1;

        updateFilterUI('#CategorySelector', category);

        document.querySelectorAll('.category-filters').forEach(filter => {
            filter.style.display = 'none';
        });

        const filterMap = {
            'trending': '#TrendingFilters',
            'recommended': '#RecommendedFilters', 
            'favorites': '#FavoritesFilters',
            'recent': '#RecentFilters',
            'rovloo': '#RovlooFilters',
            'custom': '#CustomFilters'
        };
        
        const targetFilter = document.querySelector(filterMap[category]);
        if (targetFilter) {
            targetFilter.style.display = 'block';
        }

        resetCategoryFilters(category);

        updateDisplayLabel();
        loadGamesFromAPI();
    }

    function resetCategoryFilters(category) {

        unfilteredGames = [];
        
        switch (category) {
            case 'trending':
                currentSort = 'MostPopular';
                currentTime = 'Now';
                currentGenre = 'All';
                
                updateFilterUI('#Timespan', 'Now');
                updateFilterUI('#SortBy', 'MostPopular');
                updateFilterUI('#Genre', 'All');
                break;
            case 'recommended':
                currentSort = 'PlayHistory';
                currentGenre = 'All';
                
                updateFilterUI('#RecommendedBasedOn', 'PlayHistory');
                updateFilterUI('#RecommendedFilters .GameFilter:last-child', 'All');
                break;
            case 'favorites':
                currentSort = 'Recent';
                currentGenre = 'All';
                
                updateFilterUI('#FavoritesSortBy', 'Recent');
                updateFilterUI('#FavoritesGenre', 'All');
                break;
            case 'recent':
                
                const savedRecentSort = localStorage.getItem('recentGamesSort');
                currentSort = savedRecentSort || 'LastPlayed';
                currentGenre = 'All';
                
                updateFilterUI('#RecentSortBy', currentSort);
                break;
            case 'rovloo':
                currentSort = 'balanced_discovery';
                currentGenre = 'All';
                
                updateFilterUI('#RovlooSortBy', 'balanced_discovery');
                updateFilterUI('#RovlooGenre', 'All');
                break;
            case 'custom':
                
                break;
        }
    }

    function resetToDefaultState() {
        
        if (currentCategory === 'rovloo' && window.removeConditionalRovlooTheme) {
            window.removeConditionalRovlooTheme();
        }

        currentCategory = 'trending';
        currentSort = 'MostPopular';
        currentTime = 'Now';
        currentGenre = 'All';
        currentPage = 1;

        console.log('Resetting to default state - category:', currentCategory);

        const categorySelector = document.querySelector('#CategorySelector');
        if (categorySelector) {
            
            categorySelector.querySelectorAll('.GamesFilter').forEach(link => {
                link.classList.remove('SelectedFilter');
            });

            const trendingLink = categorySelector.querySelector('[data-category="trending"]');
            if (trendingLink) {
                trendingLink.classList.add('SelectedFilter');
                console.log('Set trending as selected category');
            }
        }

        document.querySelectorAll('.category-filters').forEach(filter => {
            filter.style.display = 'none';
        });
        
        const trendingFilters = document.querySelector('#TrendingFilters');
        if (trendingFilters) {
            trendingFilters.style.display = 'block';
            console.log('Showing trending filters');
        }

        updateFilterUI('#Timespan', 'Now');
        updateFilterUI('#SortBy', 'MostPopular');
        updateFilterUI('#Genre', 'All');

        updateFilterUI('#RovlooSortBy', 'balanced_discovery');
        updateFilterUI('#RovlooGenre', 'All');
        updateFilterUI('#FavoritesSortBy', 'Recent');
        updateFilterUI('#FavoritesGenre', 'All');
        updateFilterUI('#RecentSortBy', 'LastPlayed');

        updateDisplayLabel();
        
        console.log('Default state reset complete');
    }

    function resetSearchModeUI() {
        
        isSearchMode = false;
        searchQuery = '';
        searchSessionId = null;
        searchNextPageToken = '';
        unfilteredSearchResults = [];
        currentGenre = 'All'; 

        const searchBox = document.getElementById('GamesSearchBox');
        if (searchBox) {
            searchBox.value = '';
        }

        removeSearchModeHoverTrigger();

        const gamesColumn = document.querySelector('.Column1e');
        const mainColumn = document.querySelector('.Column2e');
        const body = document.getElementById('Body');
        const gamesList = document.getElementById('GamesList');

        if (gamesColumn) {
            gamesColumn.classList.remove('sidebar-hidden');
            gamesColumn.classList.remove('sidebar-peek');
        }
        if (mainColumn) mainColumn.classList.remove('search-mode-expanded');
        if (body) body.classList.remove('search-mode');
        if (gamesList) gamesList.classList.remove('games-fading-out');

        updateFilterUI('#Genre', 'All');

        updateDisplayLabel();
    }

    function updateFilterUI(containerId, selectedFilter) {
        const container = document.querySelector(containerId);
        if (!container) return;

        container.querySelectorAll('.GamesFilter').forEach(link => {
            
            const filter = link.getAttribute('data-filter') || link.getAttribute('data-category');
            if (filter === selectedFilter) {
                link.classList.add('SelectedFilter');
            } else {
                link.classList.remove('SelectedFilter');
            }
        });
    }
    
    function updateSortByState() {
        const sortByContainer = document.getElementById('SortBy');
        if (!sortByContainer) return;
        
        const isGenreSelected = currentGenre !== 'All';
        
        sortByContainer.querySelectorAll('.GamesFilter').forEach(link => {
            if (isGenreSelected) {
                
                link.classList.add('DisabledFilter');
                link.style.color = '#999';
                link.style.cursor = 'not-allowed';
                link.style.pointerEvents = 'none';
            } else {
                
                link.classList.remove('DisabledFilter');
                link.style.color = '';
                link.style.cursor = '';
                link.style.pointerEvents = '';
            }
        });

        const sortByLabel = sortByContainer.querySelector('div');
        if (sortByLabel) {
            sortByLabel.style.color = isGenreSelected ? '#999' : '';
        }
    }

    function updateDisplayLabel() {
        const label = document.getElementById('GamesDisplayLabel');
        if (!label) return;

        if (isSearchMode && searchQuery) {
            let labelText = `Search: "${searchQuery}"`;
            if (currentGenre !== 'All') {
                labelText += ` (${currentGenre})`;
            }
            label.textContent = labelText;
            return;
        }

        const categoryLabels = {
            'trending': {
                'MostPopular': 'Most Popular Games',
                'TopTrending': 'Top Trending Games',
                'TopRated': 'Top Rated Games',
                'TopFavorites': 'Top Favorite Games',
                'Featured': 'Featured Games',
                'RecentlyUpdated': 'Recently Updated Games',
                'FunWithFriends': 'Fun with Friends',
                'TopEarning': 'Top Earning Games',
                'TopPaidAccess': 'Top Paid Access Games'
            },
            'recommended': {
                'PlayHistory': 'Recommended for You',
                'Favorites': 'Based on Your Favorites',
                'Friends': 'Popular with Friends',
                'Similar': 'Similar to Your Games',
                'default': 'Recommended Games'
            },
            'favorites': {
                'Recent': 'Your Favorite Games',
                'Alphabetical': 'Your Favorites (A-Z)',
                'MostPlayed': 'Your Most Played Favorites'
            },
            'recent': {
                'Today': 'Recently Played Today',
                'PastWeek': 'Recently Played This Week',
                'PastMonth': 'Recently Played This Month',
                'AllTime': 'All Recently Played Games'
            },
            'rovloo': {
                'most_reviews': 'Most Reviewed Games',
                'highest_rated': 'Highest Rated on Rovloo',
                'lowest_rated': 'Lowest Rated on Rovloo',
                'newest_reviews': 'Newest Reviewed Games',
                'default': 'Rovloo Reviewed Games'
            },
            'custom': {
                'default': 'Custom Game Lists'
            }
        };
        
        const genreNames = {
            'RPG': 'Trending in RPG',
            'Sports': 'Trending in Sports & Racing',
            'Shooter': 'Trending in Shooter',
            'Action': 'Trending in Action',
            'Adventure': 'Trending in Adventure',
            'Obby': 'Trending in Obby & Platformer',
            'Simulation': 'Trending in Simulation',
            'Roleplay': 'Trending in Roleplay & Avatar Sim',
            'Survival': 'Trending in Survival',
            'Puzzle': 'Trending in Puzzle',
            'Strategy': 'Trending in Strategy',
            'Horror': 'Horror Games',
            'Fighting': 'Fighting Games',
            'Tycoon': 'Tycoon Games',
            'Building': 'Building Games'
        };
        
        let labelText = 'Games';

        if (categoryLabels[currentCategory]) {
            if (currentCategory === 'trending' && currentGenre !== 'All' && genreNames[currentGenre]) {
                
                labelText = genreNames[currentGenre];
            } else {
                
                labelText = categoryLabels[currentCategory][currentSort] || categoryLabels[currentCategory]['default'] || 'Games';
            }
        }
        
        label.textContent = labelText;
    }

    const sortMapping = {
        'MostPopular': ['most-popular'],
        'TopTrending': ['top-trending'],
        'TopRated': ['top-rated'],
        'TopFavorites': ['top-revisited'],
        'Featured': ['up-and-coming'],
        'RecentlyUpdated': ['up-and-coming'],
        'FunWithFriends': ['fun-with-friends'],
        'TopEarning': ['top-earning'],
        'TopPaidAccess': ['top-paid-access'],
        'TopPlayingNow': ['top-playing-now']
    };

    const genreMapping = {
        'All': null, 
        'RPG': ['trending-in-rpg'],
        'Sports': ['trending-in-sports-and-racing'],
        'Shooter': ['trending-in-shooter'],
        'Action': ['trending-in-action'],
        'Adventure': ['trending-in-adventure'],
        'Obby': ['trending-in-obby-and-platformer'],
        'Simulation': ['trending-in-simulation'],
        'Roleplay': ['trending-in-roleplay-and-avatar-sim'],
        'Survival': ['trending-in-survival'],
        'Puzzle': ['trending-in-puzzle'],
        'Strategy': ['trending-in-strategy']
    };

    function getGenreInfo(genre) {
        const genreInfoMap = {
            
            'Shooter': { icon: 'ModernMilitary.png', name: 'Shooter' },
            'Action': { icon: 'Ninja.png', name: 'Action' },
            'Adventure': { icon: 'Adventure.png', name: 'Adventure' },
            'RPG': { icon: 'Castle.png', name: 'RPG' },
            'Simulation': { icon: 'City.png', name: 'Simulation' },
            'Sports': { icon: 'Sports.png', name: 'Sports' },
            'Sports and Racing': { icon: 'Sports.png', name: 'Sports' },
            'Obby and Platformer': { icon: 'Skatepark.png', name: 'Obby' },
            'Roleplay and Avatar Sim': { icon: 'City.png', name: 'Roleplay' },
            'Party and Casual': { icon: 'LOL.png', name: 'Casual' },
            'Puzzle': { icon: 'Classic.png', name: 'Puzzle' },
            'Strategy': { icon: 'Castle.png', name: 'Strategy' },
            'Survival': { icon: 'Cthulu.png', name: 'Survival' },
            'Entertainment': { icon: 'LOL.png', name: 'Entertainment' },
            'Shopping': { icon: 'City.png', name: 'Shopping' },
            
            'Fighting': { icon: 'Ninja.png', name: 'Fighting' },
            'Horror': { icon: 'Cthulu.png', name: 'Horror' },
            'Comedy': { icon: 'LOL.png', name: 'Comedy' },
            'Naval': { icon: 'Pirate.png', name: 'Naval' },
            'Sci-Fi': { icon: 'SciFi.png', name: 'Sci-Fi' },
            'SciFi': { icon: 'SciFi.png', name: 'Sci-Fi' },
            'Western': { icon: 'WildWest.png', name: 'Western' },
            'Military': { icon: 'ModernMilitary.png', name: 'Military' },
            'Medieval': { icon: 'Castle.png', name: 'Medieval' },
            'Town and City': { icon: 'City.png', name: 'Town and City' },
            'Building': { icon: 'Classic.png', name: 'Building' },
            'Pirate': { icon: 'Pirate.png', name: 'Pirate' },
            'Ninja': { icon: 'Ninja.png', name: 'Ninja' },
            'Obby': { icon: 'Skatepark.png', name: 'Obby' },
            'Roleplay': { icon: 'City.png', name: 'Roleplay' },
            'All': { icon: 'Classic.png', name: 'All Genres' }
        };
        return genreInfoMap[genre] || { icon: 'Classic.png', name: genre || 'All Genres' };
    }

    async function enrichGamesWithCreatorInfo(games) {
        if (!games || games.length === 0) return;

        try {
            
            const universeIds = games.map(g => g.universeId || g.id).filter(id => id);

            if (universeIds.length === 0) {
                console.log('[Enrich] No universe IDs found in games data');
                return;
            }

            console.log('[Enrich] Fetching details for', universeIds.length, 'games...');

            const BATCH_SIZE = 50;
            const detailsMap = {};

            for (let i = 0; i < universeIds.length; i += BATCH_SIZE) {
                const batch = universeIds.slice(i, i + BATCH_SIZE);

                try {
                    const gameDetails = await window.robloxAPI.getGameDetails(batch);

                    if (gameDetails && gameDetails.data) {
                        
                        gameDetails.data.forEach(detail => {
                            detailsMap[detail.id] = detail;
                        });
                    }
                } catch (batchError) {
                    console.warn(`Failed to fetch batch ${i / BATCH_SIZE + 1}:`, batchError);
                }
            }

            let enrichedCount = 0;
            games.forEach(game => {
                const gameUniverseId = game.universeId || game.id;
                const detail = detailsMap[gameUniverseId];
                if (detail) {
                    
                    if (!game.universeId) {
                        game.universeId = gameUniverseId;
                    }
                    if (detail.creator) {
                        game.creator = detail.creator;
                        game.creatorName = detail.creator.name;
                    }

                    if (!game.placeId && !game.rootPlaceId && detail.rootPlaceId) {
                        game.placeId = detail.rootPlaceId;
                        game.rootPlaceId = detail.rootPlaceId;
                    }
                    
                    game.visits = detail.visits;
                    game.favoritedCount = detail.favoritedCount;
                    game.updated = detail.updated;
                    
                    if (detail.playing !== undefined) {
                        game.playing = detail.playing;
                        game.playerCount = detail.playing;
                        game.totalPlaying = detail.playing;
                    }

                    if (!game.genre || game.genre === 'All') {
                        if (detail.genre_l1 && detail.genre_l1 !== 'All') {
                            game.genre = detail.genre_l1;
                        } else if (detail.genre && detail.genre !== 'All' && !detail.isAllGenre) {
                            game.genre = detail.genre;
                        }
                    }
                    
                    enrichedCount++;
                } else {
                    console.log('[Enrich] No details found for game:', gameUniverseId, game.name);
                }
            });

            console.log(`[Enrich] Successfully enriched ${enrichedCount}/${games.length} games`);
        } catch (error) {
            console.warn('Failed to enrich games with creator info:', error);
            
        }
    }

    async function enrichGamesWithPlaytime(games) {
        try {
            const currentUser = await window.robloxAPI.getCurrentUser();
            if (!currentUser?.id) return;

            const playtimeData = await window.roblox.playtime.getAllPlaytime(currentUser.id);

            games.forEach(game => {
                const placeId = String(game.placeId || game.rootPlaceId);
                if (playtimeData[placeId]) {
                    game.playtime = {
                        totalMinutes: playtimeData[placeId].totalMinutes || 0,
                        lastPlayed: playtimeData[placeId].lastPlayed
                    };

                    if (playtimeData[placeId].lastPlayed) {
                        game.lastPlayed = new Date(playtimeData[placeId].lastPlayed).toISOString();
                    }
                } else {
                    game.playtime = {
                        totalMinutes: 0,
                        lastPlayed: null
                    };
                }
            });

            console.log('[Recent] Enriched games with playtime data');
        } catch (e) {
            console.warn('[Recent] Failed to enrich with playtime:', e);
        }
    }

    async function loadGamesFromAPI() {
        
        const gamesList = document.getElementById('GamesList');
        const loading = document.getElementById('GamesLoading');
        const error = document.getElementById('GamesError');

        if (!gamesList) {
            console.error('GamesList element not found in DOM');
            return;
        }

        if (!window.robloxAPI) {
            console.error('window.robloxAPI is not defined - preload script may not be loaded');
            if (error) {
                error.textContent = 'API not available. Please reload the page.';
                error.style.display = 'block';
            }
            if (loading) loading.style.display = 'none';
            return;
        }

        const requestId = ++currentLoadRequestId;
        const requestCategory = currentCategory;
        console.log(`[Games] Starting load request #${requestId} for category: ${requestCategory}, page: ${currentPage}`);

        if (currentCategory === 'recommended') {
            const cachedRecommended = getRecommendedGamesCache();
            if (cachedRecommended && cachedRecommended.length > 0) {
                console.log(`[Games] Using cached recommended games, skipping loading state`);
                allGames = cachedRecommended;
                unfilteredGames = [...allGames];
                totalPages = Math.ceil(allGames.length / gamesPerPage);
                await displayCurrentPage();
                return;
            }
        }

        if (loading) loading.style.display = 'block';
        if (gamesList) gamesList.style.display = 'none';
        if (error) error.style.display = 'none';

        currentPage = 1;
        allGames = [];

        try {
            let games = [];
            
            console.log('Loading games for category:', currentCategory);

            switch (currentCategory) {
                case 'trending':
                    games = await loadTrendingGames(requestId);
                    break;
                case 'recommended':
                    games = await loadRecommendedGames(requestId);
                    break;
                case 'favorites':
                    games = await loadFavoriteGames(requestId);
                    break;
                case 'recent':
                    games = await loadRecentGames(requestId);
                    break;
                case 'rovloo':
                    games = await loadRovlooReviewedGames(requestId);
                    break;
                case 'custom':
                    games = await loadCustomListGames(requestId);
                    break;
                default:
                    games = await loadTrendingGames(requestId); 
            }

            if (requestId !== currentLoadRequestId) {
                console.log(`[Games] Request #${requestId} is stale (current: #${currentLoadRequestId}), discarding results for ${requestCategory}`);
                return;
            }

            allGames = games || [];

            if (currentCategory !== 'trending') {
                unfilteredGames = [...allGames];
            }
            totalPages = Math.ceil(allGames.length / gamesPerPage);
            
            console.log(`[Games] Request #${requestId} completed: ${allGames.length} games for category: ${currentCategory}`);
            console.log('First few games:', allGames.slice(0, 3));
            
            if (allGames.length === 0) {
                showNoGamesMessage();
            } else {
                await displayCurrentPage();
            }

        } catch (err) {
            
            if (requestId !== currentLoadRequestId) {
                console.log(`[Games] Request #${requestId} error ignored (stale request)`);
                return;
            }
            console.error('Failed to load games:', err);
            if (error) {
                error.textContent = 'Failed to load games. Please try again.';
                error.style.display = 'block';
            }
        } finally {
            
            if (requestId === currentLoadRequestId && loading) {
                loading.style.display = 'none';
            }
        }
    }

    async function loadTrendingGames(requestId) {
        
        const loading = document.getElementById('GamesLoading');

        let debugInfo = {
            requestedSort: currentSort,
            requestedGenre: currentGenre,
            targetSorts: [],
            availableSorts: [],
            matchedSort: null,
            fallbackUsed: null,
            errors: []
        };

        let games = []; 

        try {
            
            if (window.robloxAPI.getGameSorts) {
                console.log('Fetching game sorts for filter:', currentSort, 'genre:', currentGenre);

                if (isRequestStale(requestId)) {
                    console.log(`[Trending] Request #${requestId} is stale, aborting`);
                    return [];
                }

                try {
                    const sortsData = await window.robloxAPI.getGameSorts();

                    if (isRequestStale(requestId)) {
                        console.log(`[Trending] Request #${requestId} is stale after API call, aborting`);
                        return [];
                    }
                    
                    console.log('Game sorts response:', sortsData);
                    
                    if (sortsData && sortsData.sorts && Array.isArray(sortsData.sorts)) {
                        
                        debugInfo.availableSorts = sortsData.sorts.map(s => ({
                            sortId: s.sortId || s.id,
                            displayName: s.sortDisplayName,
                            gameCount: s.games?.length || 0
                        }));

                        let targetSorts;

                        if (currentGenre !== 'All' && genreMapping[currentGenre]) {
                            targetSorts = genreMapping[currentGenre];
                            console.log('Using genre-specific sorts:', targetSorts);
                        } else {
                            
                            targetSorts = sortMapping[currentSort] || sortMapping['MostPopular'];
                            console.log('Using sort filter:', targetSorts);
                        }
                        
                        debugInfo.targetSorts = targetSorts;

                        let matchedSort = null;
                        for (const sortId of targetSorts) {
                            matchedSort = sortsData.sorts.find(s => {
                                const id = (s.sortId || s.id || '').toLowerCase();
                                return id === sortId.toLowerCase();
                            });
                            if (matchedSort && matchedSort.games && matchedSort.games.length > 0) {
                                console.log('Found matching sort:', matchedSort.sortDisplayName || matchedSort.sortId);
                                debugInfo.matchedSort = matchedSort.sortId || matchedSort.sortDisplayName;
                                break;
                            }
                        }
                        
                        if (matchedSort && matchedSort.games && matchedSort.games.length > 0) {
                            games = matchedSort.games;
                            console.log('Got', games.length, 'games from sort:', matchedSort.sortDisplayName || matchedSort.sortId);

                            await enrichGamesWithCreatorInfo(games);
                        } else {
                            
                            console.log('No exact match found for target sorts');
                            debugInfo.errors.push('No exact match found for target sorts: ' + targetSorts.join(', '));
                        }
                    } else {
                        debugInfo.errors.push('Invalid sorts data structure received from API');
                    }
                } catch (sortsErr) {
                    console.warn('Game sorts API failed:', sortsErr);
                    debugInfo.errors.push('Game sorts API error: ' + sortsErr.message);
                }
            } else {
                debugInfo.errors.push('robloxAPI not available or getGameSorts not defined');
            }
        } catch (err) {
            console.error('API error:', err);
            debugInfo.errors.push('General API error: ' + err.message);
        }

        if (games.length === 0) {
            console.error('Failed to load games. Debug info:', debugInfo);
            console.log('API available:', !!window.robloxAPI);
            console.log('getGameSorts available:', !!window.robloxAPI?.getGameSorts);
            
            console.log('Generating placeholder games as fallback...');
            games = generatePlaceholderGames(20);
        }

        console.log('loadTrendingGames returning', games.length, 'games');
        return games; 
    }
    
    function showDetailedError(debugInfo) {
        const gamesList = document.getElementById('GamesList');
        const error = document.getElementById('GamesError');
        
        let errorHtml = `
            <div style="padding: 20px; background: #fff3cd; border: 1px solid #ffc107; margin: 10px; font-family: monospace; font-size: 12px;">
                <h3 style="color: #856404; margin-top: 0;">⚠️ Failed to Load Games</h3>
                
                <div style="margin-bottom: 10px;">
                    <strong>Requested:</strong> Sort="${debugInfo.requestedSort}", Genre="${debugInfo.requestedGenre}"
                </div>
                
                <div style="margin-bottom: 10px;">
                    <strong>Target Sort IDs:</strong> ${debugInfo.targetSorts.join(', ') || 'None'}
                </div>
                
                <div style="margin-bottom: 10px;">
                    <strong>Matched Sort:</strong> ${debugInfo.matchedSort || 'None'}
                </div>
                
                <div style="margin-bottom: 10px;">
                    <strong>Fallback Used:</strong> ${debugInfo.fallbackUsed || 'None'}
                </div>
                
                <div style="margin-bottom: 10px; color: #721c24;">
                    <strong>Errors:</strong>
                    <ul style="margin: 5px 0; padding-left: 20px;">
                        ${debugInfo.errors.map(e => `<li>${e}</li>`).join('') || '<li>No specific errors</li>'}
                    </ul>
                </div>
                
                <details style="margin-top: 10px;">
                    <summary style="cursor: pointer; color: #00F;">Available Sorts from API (${debugInfo.availableSorts.length})</summary>
                    <div style="max-height: 200px; overflow-y: auto; background: #f8f9fa; padding: 10px; margin-top: 5px;">
                        ${debugInfo.availableSorts.length > 0 
                            ? debugInfo.availableSorts.map(s => 
                                `<div style="padding: 2px 0;"><code>${s.sortId}</code> - ${s.displayName} (${s.gameCount} games)</div>`
                            ).join('')
                            : '<div>No sorts available</div>'
                        }
                    </div>
                </details>
            </div>
        `;
        
        if (gamesList) {
            gamesList.innerHTML = errorHtml;
            gamesList.style.display = 'block';
        }
        if (error) {
            error.style.display = 'none';
        }
    }

    async function displayCurrentPage() {
        const gamesList = document.getElementById('GamesList');
        const pageInfo = document.getElementById('GamesPageInfo');
        const prevBtn = document.getElementById('GamesPrevPage');
        const nextBtn = document.getElementById('GamesNextPage');

        if (!gamesList) return;

        const renderingPage = currentPage;

        const startIndex = (currentPage - 1) * gamesPerPage;
        const endIndex = startIndex + gamesPerPage;
        let pageGames = allGames.slice(startIndex, endIndex);
        console.log('Displaying page', currentPage, 'of', totalPages, '- Games', startIndex + 1, 'to', Math.min(endIndex, allGames.length));

        if (window.roblox?.blacklist?.filterGames) {
            try {
                const filtered = await window.roblox.blacklist.filterGames(pageGames);
                if (filtered.length < pageGames.length) {
                    console.log('[Blacklist] Filtered', pageGames.length - filtered.length, 'games');
                }
                pageGames = filtered;
            } catch (e) {
                console.warn('[Blacklist] Filter failed:', e);
            }
        }

        gamesList.classList.add('games-fading-out');
        await new Promise(resolve => setTimeout(resolve, 150));

        if (renderingPage !== currentPage) {
            return;
        }

        await renderGames(pageGames, renderingPage);

        if (renderingPage === currentPage) {
            gamesList.style.display = 'block';
            
            gamesList.classList.remove('games-fading-out');
            
            updatePaginationUI();
        }
    }

    function updatePaginationUI() {
        const pageInfo = document.getElementById('GamesPageInfo');
        const prevBtn = document.getElementById('GamesPrevPage');
        const nextBtn = document.getElementById('GamesNextPage');
        const paginationContainer = document.getElementById('GamesPagination');

        if (isSearchMode && !searchQuery) {
            if (paginationContainer) paginationContainer.style.visibility = 'hidden';
            if (pageInfo) pageInfo.style.visibility = 'hidden';
            if (prevBtn) prevBtn.style.visibility = 'hidden';
            if (nextBtn) nextBtn.style.visibility = 'hidden';
            return;
        }

        if (paginationContainer) paginationContainer.style.visibility = 'visible';
        if (pageInfo) pageInfo.style.visibility = 'visible';

        if (pageInfo) {
            if (isSearchMode) {
                
                const startResult = (currentPage - 1) * gamesPerPage + 1;
                const endResult = Math.min(currentPage * gamesPerPage, allGames.length);
                
                if (allGames.length === 0) {
                    pageInfo.textContent = 'No results';
                } else if (searchNextPageToken) {
                    
                    pageInfo.textContent = `${startResult}-${endResult} of ${allGames.length}+ results`;
                } else {
                    
                    pageInfo.textContent = `${startResult}-${endResult} of ${allGames.length} results`;
                }
            } else {
                pageInfo.textContent = 'Page ' + currentPage + ' of ' + totalPages;
            }
        }

        if (prevBtn) {
            prevBtn.style.visibility = currentPage > 1 ? 'visible' : 'hidden';
        }
        if (nextBtn) {
            
            const hasMorePages = currentPage < totalPages;
            const hasMoreSearchResults = isSearchMode && searchNextPageToken;
            nextBtn.style.visibility = (hasMorePages || hasMoreSearchResults) ? 'visible' : 'hidden';
        }
    }

    function generatePlaceholderGames(count = 20) {
        
        const placeholderGames = [];
        const gameNames = [
            'Natural Disaster Survival', 'Work at a Pizza Place', 'Jailbreak',
            'Adopt Me!', 'MeepCity', 'Murder Mystery 2', 'Brookhaven',
            'Tower of Hell', 'Piggy', 'Blox Fruits', 'Arsenal',
            'Royale High', 'Phantom Forces', 'Bee Swarm Simulator',
            'Pet Simulator X', 'Shindo Life', 'King Legacy', 'Doors',
            'Build A Boat For Treasure', 'Theme Park Tycoon 2',
            'Anime Fighters Simulator', 'All Star Tower Defense', 'Bedwars',
            'Islands', 'Lumber Tycoon 2', 'Vehicle Simulator', 'Mad City',
            'Ninja Legends', 'Bubble Gum Simulator', 'Speed Run 4',
            'Flee the Facility', 'Epic Minigames', 'Super Golf', 'Obby Creator',
            'Restaurant Tycoon 2', 'Mining Simulator 2', 'Dragon Adventures',
            'Creatures of Sonaria', 'World Zero', 'Dungeon Quest'
        ];

        for (let i = 0; i < count; i++) {
            placeholderGames.push({
                placeId: 100000 + i,
                name: gameNames[i % gameNames.length] + (i >= gameNames.length ? ' ' + Math.floor(i / gameNames.length + 1) : ''),
                playerCount: Math.floor(Math.random() * 50000),
                creator: { name: 'ROBLOX' },
                totalUpVotes: Math.floor(Math.random() * 100000),
                totalDownVotes: Math.floor(Math.random() * 10000)
            });
        }
        return placeholderGames;
    }

    async function renderGames(games, renderingPage = null) {
        const gamesList = document.getElementById('GamesList');
        if (!gamesList) return;

        if (!games || games.length === 0) {
            gamesList.innerHTML = '<div style="text-align: center; padding: 40px;">No games found</div>';
            return;
        }

        console.log('Rendering', games.length, 'games via authentic template.');

        const timeAgo = (dateString) => {
            if (!dateString) return 'a while ago';
            const date = new Date(dateString);
            const seconds = Math.floor((new Date() - date) / 1000);
            let interval = seconds / 31536000;
            if (interval > 1) return Math.floor(interval) + " years ago";
            interval = seconds / 2592000;
            if (interval > 1) return Math.floor(interval) + " months ago";
            interval = seconds / 604800;
            if (interval > 1) return Math.floor(interval) + " weeks ago";
            interval = seconds / 86400;
            if (interval > 1) return Math.floor(interval) + " days ago";
            return "recently";
        };

        const formatPlaytime = (minutes) => {
            if (!minutes || minutes < 1) return '< 1m';

            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;

            if (hours > 0) {
                return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
            }
            return `${mins}m`;
        };

        let html = '<div class="GamesGrid" style="display: block;">';
        
        games.forEach(game => {
            
            const playerCount = game.playerCount || game.playing || game.totalPlaying || 0;
            const gameName = game.name || game.gameName || 'Unknown Game';
            const creatorName = game.creator?.name || game.creatorName || 'Unknown';
            const creatorType = game.creator?.type || game.creator?.creatorType;
            const creatorId = game.creator?.id || game.creator?.creatorTargetId;
            const universeId = game.universeId || game.id || 0;
            const placeId = game.placeId || game.rootPlaceId || universeId;

            const visits = game.visits || game.placeVisits || 0;
            const favorites = game.favoritedCount || game.totalUpVotes || 0; 
            const updated = game.updated || new Date().toISOString();

            let creatorDisplay;
            if (creatorType === 'User' && creatorId) {
                creatorDisplay = `<a href="#profile?id=${creatorId}">${creatorName}</a>`;
            } else if (creatorType === 0 && creatorId) {
                
                creatorDisplay = `<a href="#profile?id=${creatorId}">${creatorName}</a>`;
            } else if (creatorType === 'Group' && creatorId) {
                creatorDisplay = `<a href="#group?id=${creatorId}">${creatorName}</a>`;
            } else if (creatorType === 1 && creatorId) {
                
                creatorDisplay = `<a href="#group?id=${creatorId}">${creatorName}</a>`;
            } else {
                creatorDisplay = creatorName;
            }

            const imageUrl = game.imageUrl || game.thumbnailUrl || game.gameIconUrl || '';

            const genre = game.genre || 'All';
            const genreInfo = getGenreInfo(genre);

            html += `
                <div class="GameItem">
                    <div class="AlwaysShown">
                        <div class="GameThumbnail">
                            <a href="#game-detail?id=${placeId}&universe=${universeId}&genre=${encodeURIComponent(genre)}">
                                <img src="${imageUrl}" alt="${gameName}"
                                     width="160" height="100"
                                     data-placeid="${placeId}"
                                     data-universeid="${universeId}"
                                     style="opacity: ${imageUrl ? '1' : '0.3'}"
                                     onload="this.style.opacity='1'"
                                     onerror="this.style.opacity='0.2';"/>
                            </a>
                        </div>
                        <div class="GameName">
                            <a href="#game-detail?id=${placeId}&universe=${universeId}&genre=${encodeURIComponent(genre)}" title="${gameName}">${gameName}</a>
                        </div>
                        <div class="PlayerCount">
                            <span>${formatNumber(playerCount)} players online</span>
                            <img class="GenreIcon" src="images/GenreIcons/${genreInfo.icon}" alt="${genreInfo.name}" title="${genreInfo.name}">
                        </div>
                        <div class="CreatorName" style="margin-top: 4px !important;" title="by ${creatorName}">
                            by ${creatorDisplay}
                        </div>
                    </div>
                    <div class="HoverShown">
                        <div class="StatsPlayed">Played ${formatNumber(visits)} times</div>
                        <div class="StatsFavorited">Favorited ${formatNumber(favorites)} times</div>
                        <div class="StatsUpdated">Updated ${timeAgo(updated)}</div>
                        ${currentCategory === 'recent' && game.playtime?.totalMinutes > 0 ? `
                            <div class="StatsPlaytime">
                                <img src="images/rovloo/playtime-indicator.png" class="playtime-icon" alt="Playtime" />
                                Playtime: ${formatPlaytime(game.playtime.totalMinutes)}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        
        html += '<div style="clear:both;"></div></div>';
        gamesList.innerHTML = html;

        if (renderingPage !== null && renderingPage !== currentPage) {
            console.log('Skipping thumbnail load - page changed from', renderingPage, 'to', currentPage);
            return;
        }

        await loadGameThumbnails(games, renderingPage);
    }

    async function loadGameThumbnails(games, renderingPage = null) {
        try {
            if (!games || games.length === 0) return;

            const universeIds = games.map(g => g.universeId || g.id).filter(id => id);
            if (universeIds.length === 0) return;

            console.log('Fetching thumbnails for', universeIds.length, 'games');

            if (window.roblox && window.roblox.getGameThumbnails) {
                
                const thumbResult = await window.roblox.getGameThumbnails(universeIds, '256x144');

                if (renderingPage !== null && renderingPage !== currentPage) {
                    console.log('Skipping thumbnail update - page changed from', renderingPage, 'to', currentPage);
                    return;
                }

                if (thumbResult?.data) {
                    thumbResult.data.forEach(gameThumb => {
                        
                        if (gameThumb.thumbnails && gameThumb.thumbnails.length > 0) {
                            const imageUrl = gameThumb.thumbnails[0].imageUrl;
                            if (imageUrl) {
                                
                                const imgs = document.querySelectorAll(`img[data-universeid="${gameThumb.universeId}"]`);
                                imgs.forEach(img => {
                                    img.src = imageUrl;
                                    img.style.opacity = '1';
                                });
                            }
                        }
                    });
                    console.log('Successfully loaded thumbnails');
                }
            }
        } catch (err) {
            console.warn('Failed to load game thumbnails:', err);
            
        }
    }

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

    function resetGamesPage() {
        
        if (currentCategory === 'rovloo' && window.removeConditionalRovlooTheme) {
            window.removeConditionalRovlooTheme();
        }

        allGames = [];
        unfilteredGames = [];
        unfilteredSearchResults = [];
        gamesLoaded = false;
        isLoading = false;
        currentPage = 1;
        totalPages = 1;

        currentCategory = 'trending';

        isSearchMode = false;
        searchQuery = '';
        searchSessionId = null;
        searchNextPageToken = '';
        if (searchDebounceTimer) {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = null;
        }

        isPaginating = false;
        pendingPage = null;

        const gamesColumn = document.querySelector('.Column1e');
        const mainColumn = document.querySelector('.Column2e');
        const body = document.getElementById('Body');
        if (gamesColumn) gamesColumn.classList.remove('sidebar-hidden');
        if (mainColumn) mainColumn.classList.remove('search-mode-expanded');
        if (body) body.classList.remove('search-mode');

        const container = document.getElementById('games-content');
        if (container) {
            container.innerHTML = '';
        }
    }

    function registerCleanup() {
        if (window.Performance && window.Performance.registerCleanup) {
            window.Performance.registerCleanup('games', resetGamesPage);
        }
    }

    window.GamesPage = {
        init: initGames,
        load: loadGamesPage,
        setSort: setSortFilter,
        setTime: setTimeFilter,
        setGenre: setGenreFilter,
        refresh: loadGamesFromAPI,
        reset: resetGamesPage,
        search: performSearch,
        exitSearch: exitSearchMode,
        isSearchMode: () => isSearchMode
    };

    const RECOMMENDED_GAMES_CACHE_KEY = 'rovloo_games_page_recommended_cache';
    const RECOMMENDED_GAMES_CACHE_TTL = 5 * 60 * 1000; 
    const RECOMMENDED_GAMES_FETCH_COOLDOWN_KEY = 'rovloo_recommended_fetch_cooldown';
    const RECOMMENDED_GAMES_FETCH_COOLDOWN = 2 * 60 * 1000; 

    let recommendedGamesMemoryCache = null;
    let recommendedGamesMemoryCacheTimestamp = 0;

    const RECENT_GAMES_CACHE_KEY = 'rovloo_games_page_recent_cache';
    const RECENT_GAMES_CACHE_TTL = 5 * 60 * 1000; 

    let recentGamesMemoryCache = null;
    let recentGamesMemoryCacheTimestamp = 0;

    const ROVLOO_GAMES_CACHE_KEY = 'rovloo_games_page_rovloo_cache';
    const ROVLOO_GAMES_CACHE_TTL = 5 * 60 * 1000; 

    let rovlooGamesMemoryCache = null;
    let rovlooGamesMemoryCacheTimestamp = 0;

    function getRecommendedGamesCache(allowExpired = false) {
        
        if (recommendedGamesMemoryCache && recommendedGamesMemoryCache.length > 0) {
            const isExpired = (Date.now() - recommendedGamesMemoryCacheTimestamp) >= RECOMMENDED_GAMES_CACHE_TTL;
            if (!isExpired || allowExpired) {
                console.log('[Recommended] Using in-memory cached games:', recommendedGamesMemoryCache.length);
                return recommendedGamesMemoryCache;
            }
        }

        try {
            const cached = localStorage.getItem(RECOMMENDED_GAMES_CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed.timestamp) {
                    const isExpired = (Date.now() - parsed.timestamp) >= RECOMMENDED_GAMES_CACHE_TTL;
                    if (!isExpired || allowExpired) {
                        if (allowExpired && isExpired) {
                            console.log('[Recommended] Using expired localStorage cache data');
                        } else {
                            console.log('[Recommended] Using localStorage cached games data');
                        }
                        
                        recommendedGamesMemoryCache = parsed.data;
                        recommendedGamesMemoryCacheTimestamp = parsed.timestamp;
                        return parsed.data;
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to read recommended games cache:', e);
        }
        return null;
    }

    function setRecommendedGamesCache(data) {
        
        recommendedGamesMemoryCache = data;
        recommendedGamesMemoryCacheTimestamp = Date.now();

        try {
            localStorage.setItem(RECOMMENDED_GAMES_CACHE_KEY, JSON.stringify({
                data: data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Failed to save recommended games cache:', e);
        }
    }

    function getRecentGamesCache() {
        
        if (recentGamesMemoryCache && recentGamesMemoryCache.length > 0) {
            const isExpired = (Date.now() - recentGamesMemoryCacheTimestamp) >= RECENT_GAMES_CACHE_TTL;
            if (!isExpired) {
                console.log('[Recent] Using in-memory cached games:', recentGamesMemoryCache.length);
                return recentGamesMemoryCache;
            }
        }

        try {
            const cached = localStorage.getItem(RECENT_GAMES_CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed.timestamp) {
                    const isExpired = (Date.now() - parsed.timestamp) >= RECENT_GAMES_CACHE_TTL;
                    if (!isExpired) {
                        console.log('[Recent] Using localStorage cached games data');
                        
                        recentGamesMemoryCache = parsed.data;
                        recentGamesMemoryCacheTimestamp = parsed.timestamp;
                        return parsed.data;
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to read recent games cache:', e);
        }
        return null;
    }

    function setRecentGamesCache(data) {
        
        recentGamesMemoryCache = data;
        recentGamesMemoryCacheTimestamp = Date.now();

        try {
            localStorage.setItem(RECENT_GAMES_CACHE_KEY, JSON.stringify({
                data: data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Failed to save recent games cache:', e);
        }
    }

    function getRovlooGamesCache() {
        
        if (rovlooGamesMemoryCache && rovlooGamesMemoryCache.length > 0) {
            const isExpired = (Date.now() - rovlooGamesMemoryCacheTimestamp) >= ROVLOO_GAMES_CACHE_TTL;
            if (!isExpired) {
                console.log('[Rovloo] Using in-memory cached games:', rovlooGamesMemoryCache.length);
                return rovlooGamesMemoryCache;
            }
        }

        try {
            const cached = localStorage.getItem(ROVLOO_GAMES_CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed.timestamp) {
                    const isExpired = (Date.now() - parsed.timestamp) >= ROVLOO_GAMES_CACHE_TTL;
                    if (!isExpired) {
                        console.log('[Rovloo] Using localStorage cached games data');
                        
                        rovlooGamesMemoryCache = parsed.data;
                        rovlooGamesMemoryCacheTimestamp = parsed.timestamp;
                        return parsed.data;
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to read Rovloo games cache:', e);
        }
        return null;
    }

    function setRovlooGamesCache(data) {
        
        rovlooGamesMemoryCache = data;
        rovlooGamesMemoryCacheTimestamp = Date.now();

        try {
            localStorage.setItem(ROVLOO_GAMES_CACHE_KEY, JSON.stringify({
                data: data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Failed to save Rovloo games cache:', e);
        }
    }

    async function preloadCachedGamesIntoMemory() {
        try {
            
            const recommendedResult = await window.roblox?.getCachedRecommendedGames?.();
            if (recommendedResult?.cached && recommendedResult?.data?.length > 0) {
                console.log('[Preload] Loading', recommendedResult.data.length, 'recommended games into client memory');
                const convertedGames = recommendedResult.data.map(game => ({
                    universeId: game.id,
                    placeId: game.rootPlaceId,
                    name: game.name,
                    playerCount: game.playing || 0,
                    playing: game.playing || 0,
                    totalPlaying: game.playing || 0,
                    genre: (game.genre && game.genre !== 'All' && !game.isAllGenre) ? game.genre : 'All',
                    visits: game.visits || 0,
                    favoritedCount: game.favoritedCount || 0,
                    updated: game.updated,
                    creator: {
                        id: game.creator?.id,
                        name: game.creator?.name,
                        type: game.creator?.type
                    },
                    creatorName: game.creator?.name,
                    creatorType: game.creator?.type,
                    creatorTargetId: game.creator?.id
                }));
                setRecommendedGamesCache(convertedGames);
            }

            const recentResult = await window.roblox?.getCachedRecentGames?.();
            if (recentResult?.cached && recentResult?.data?.length > 0) {
                console.log('[Preload] Loading', recentResult.data.length, 'recent games into client memory');
                
                setRecentGamesCache(recentResult.data);
            }

            const rovlooResult = await window.roblox?.getCachedRovlooGames?.();
            if (rovlooResult?.cached && rovlooResult?.data?.length > 0) {
                console.log('[Preload] Loading', rovlooResult.data.length, 'Rovloo games into client memory');
                
                setRovlooGamesCache(rovlooResult.data);
            }
        } catch (e) {
            console.log('[Preload] Failed to preload cached games:', e);
        }
    }

    function isRecommendedGamesFetchOnCooldown() {
        try {
            const lastFetch = localStorage.getItem(RECOMMENDED_GAMES_FETCH_COOLDOWN_KEY);
            if (lastFetch) {
                const timeSinceLastFetch = Date.now() - parseInt(lastFetch, 10);
                return timeSinceLastFetch < RECOMMENDED_GAMES_FETCH_COOLDOWN;
            }
        } catch (e) {
            console.warn('Failed to check fetch cooldown:', e);
        }
        return false;
    }
    
    function setRecommendedGamesFetchCooldown() {
        try {
            localStorage.setItem(RECOMMENDED_GAMES_FETCH_COOLDOWN_KEY, Date.now().toString());
        } catch (e) {
            console.warn('Failed to set fetch cooldown:', e);
        }
    }

    async function fetchGameDetailsClientSide(universeIds, loadingElement) {
        const BATCH_SIZE = 30;
        const BATCH_DELAY = 800;
        const RATE_LIMIT_WAIT = 3000;
        const MAX_RATE_LIMITS = 3;
        const MAX_ROBLOX_ID = 50000000000; 

        const validIds = universeIds.filter(id => {
            const numId = typeof id === 'string' ? parseInt(id, 10) : id;
            return numId && !isNaN(numId) && numId > 0 && numId < MAX_ROBLOX_ID;
        });
        
        console.log(`[Client] Filtered ${universeIds.length} IDs to ${validIds.length} valid IDs`);
        
        if (validIds.length === 0) {
            console.warn('[Client] No valid universe IDs to fetch');
            return [];
        }
        
        let gamesData = [];
        let consecutiveRateLimits = 0;
        
        if (!window.roblox?.getGamesProductInfo) {
            console.error('getGamesProductInfo not available');
            return [];
        }
        
        const totalBatches = Math.ceil(validIds.length / BATCH_SIZE);
        
        for (let i = 0; i < validIds.length; i += BATCH_SIZE) {
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const batch = validIds.slice(i, i + BATCH_SIZE);
            
            if (loadingElement) {
                loadingElement.innerHTML = `Loading games... (${gamesData.length}/${validIds.length})`;
            }
            
            try {
                console.log(`[Client] Fetching batch ${batchNum}/${totalBatches}: ${batch.length} games`);
                const gamesInfo = await window.roblox.getGamesProductInfo(batch);
                if (gamesInfo?.data) {
                    gamesData = gamesData.concat(gamesInfo.data);
                    consecutiveRateLimits = 0;
                }
                
                if (i + BATCH_SIZE < validIds.length) {
                    await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
                }
            } catch (e) {
                console.warn(`[Client] Batch ${batchNum} failed:`, e);
                if (e.message?.includes('429') || e.message?.includes('Too many')) {
                    consecutiveRateLimits++;
                    console.log(`[Client] Rate limited (${consecutiveRateLimits}/${MAX_RATE_LIMITS}), waiting...`);
                    
                    if (consecutiveRateLimits >= MAX_RATE_LIMITS) {
                        console.log('[Client] Too many rate limits, stopping. Got', gamesData.length, 'games.');
                        break;
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_WAIT));
                    i -= BATCH_SIZE; 
                } else if (e.message?.includes('invalid')) {
                    
                    console.log(`[Client] Invalid IDs in batch, trying individual fetches...`);
                    for (const id of batch) {
                        try {
                            const singleResult = await window.roblox.getGamesProductInfo([id]);
                            if (singleResult?.data) {
                                gamesData = gamesData.concat(singleResult.data);
                            }
                        } catch (singleErr) {
                            console.warn(`[Client] Failed to fetch game ${id}:`, singleErr.message);
                        }
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }
            }
        }
        
        console.log(`[Client] Fetched ${gamesData.length} games total`);
        return gamesData;
    }
    
    async function loadRecommendedGames(requestId) {
        console.log('Loading recommended games...');

        const cachedGames = getRecommendedGamesCache();
        if (cachedGames && cachedGames.length > 0) {
            console.log('[Recommended] Returning', cachedGames.length, 'client-cached games');
            return cachedGames;
        }

        if (isRequestStale(requestId)) {
            console.log(`[Recommended] Request #${requestId} is stale, aborting`);
            return [];
        }

        try {
            const preloadedResult = await window.roblox?.getCachedRecommendedGames?.();

            if (isRequestStale(requestId)) {
                console.log(`[Recommended] Request #${requestId} is stale after preload check, aborting`);
                return [];
            }
            
            if (preloadedResult?.cached && preloadedResult?.data?.length > 0) {
                console.log('[Recommended] Using', preloadedResult.data.length, 'preloaded games from main process');

                const convertedGames = preloadedResult.data.map(game => ({
                    universeId: game.id,
                    placeId: game.rootPlaceId,
                    name: game.name,
                    playerCount: game.playing || 0,
                    playing: game.playing || 0,
                    totalPlaying: game.playing || 0,
                    genre: (game.genre && game.genre !== 'All' && !game.isAllGenre) ? game.genre : 'All',
                    visits: game.visits || 0,
                    favoritedCount: game.favoritedCount || 0,
                    updated: game.updated,
                    creator: {
                        id: game.creator?.id,
                        name: game.creator?.name,
                        type: game.creator?.type
                    },
                    creatorName: game.creator?.name,
                    creatorType: game.creator?.type,
                    creatorTargetId: game.creator?.id
                }));

                setRecommendedGamesCache(convertedGames);
                
                return convertedGames;
            }
        } catch (e) {
            console.log('[Recommended] Preloaded cache not available:', e.message);
        }

        if (isRecommendedGamesFetchOnCooldown()) {
            console.log('[Recommended] Fetch is on cooldown, using expired cache if available');
            const expiredCache = getRecommendedGamesCache(true);
            if (expiredCache && expiredCache.length > 0) {
                return expiredCache;
            }
            
            console.log('[Recommended] No expired cache available, showing empty state');
            return [];
        }

        setRecommendedGamesFetchCooldown();
        
        try {

            let universeIds = [];

            if (window.roblox?.getOmniRecommendations) {
                const recommendationsData = await window.roblox.getOmniRecommendations('Home');
                console.log('Omni recommendations data:', recommendationsData);

                if (recommendationsData?.sorts && recommendationsData.sorts.length > 0) {
                    console.log('Found', recommendationsData.sorts.length, 'sorts');
                    for (const sort of recommendationsData.sorts) {
                        console.log('Sort:', sort.topic, 'has', sort.recommendationList?.length || 0, 'recommendations');
                        if (sort.recommendationList && sort.recommendationList.length > 0) {

                            const sortUniverseIds = sort.recommendationList
                                .filter(rec => rec.contentType === 'Game' && rec.contentId)
                                .map(rec => rec.contentId);
                            universeIds.push(...sortUniverseIds);
                        }
                    }
                }
                console.log('Collected universe IDs:', universeIds.length);
            } else {
                console.error('getOmniRecommendations not available on window.roblox');
                throw new Error('getOmniRecommendations not available');
            }

            const uniqueUniverseIds = [...new Set(universeIds)];
            
            console.log(`Total unique recommended games: ${uniqueUniverseIds.length}`);

            if (uniqueUniverseIds.length === 0) {
                console.log('No universe IDs found in recommendations');
                throw new Error('No universe IDs found');
            }

            const loading = document.getElementById('GamesLoading');
            
            let gamesData = [];

            const localServerStatus = await window.RobloxClient?.localServer?.getStatus?.();
            
            if (localServerStatus?.isRunning) {
                console.log('[Recommended] Using local server for batch game details');
                if (loading) {
                    loading.innerHTML = `Loading ${uniqueUniverseIds.length} recommended games via local server...`;
                }
                
                try {
                    const result = await window.RobloxClient.localServer.batchGameDetails(uniqueUniverseIds);
                    
                    if (result?.success && result?.data) {
                        gamesData = result.data;
                        console.log(`[Recommended] Local server fetched ${gamesData.length} games (${result.stats?.cached || 0} cached, ${result.stats?.apiCalls || 0} API calls)`);
                    } else {
                        console.warn('[Recommended] Local server returned error:', result?.error);
                        throw new Error(result?.error || 'Local server failed');
                    }
                } catch (localServerError) {
                    console.warn('[Recommended] Local server failed, falling back to client-side:', localServerError);
                    
                }
            }

            if (gamesData.length === 0) {
                console.log('[Recommended] Using client-side batch fetching');
                gamesData = await fetchGameDetailsClientSide(uniqueUniverseIds, loading);
            }

            if (loading) {
                loading.innerHTML = 'Loading games...';
            }

            if (gamesData.length === 0) {
                console.log('No game data returned');
                throw new Error('No game data returned');
            }

            const convertedGames = gamesData.map(game => {
                
                if (gamesData.indexOf(game) === 0) {
                    console.log('[Recommended] First game raw data:', {
                        name: game.name,
                        genre: game.genre,
                        isAllGenre: game.isAllGenre,
                        allKeys: Object.keys(game)
                    });
                }

                let gameGenre = 'All';
                if (game.genre && game.genre !== 'All' && !game.isAllGenre) {
                    gameGenre = game.genre;
                }
                
                return {
                    universeId: game.id,
                    placeId: game.rootPlaceId,
                    name: game.name,
                    playerCount: game.playing || 0,
                    playing: game.playing || 0,
                    totalPlaying: game.playing || 0,
                    
                    genre: gameGenre,
                    
                    visits: game.visits || 0,
                    favoritedCount: game.favoritedCount || 0,
                    updated: game.updated,
                    
                    creator: {
                        id: game.creator?.id,
                        name: game.creator?.name,
                        type: game.creator?.type
                    },
                    creatorName: game.creator?.name,
                    creatorType: game.creator?.type,
                    creatorTargetId: game.creator?.id
                };
            });

            console.log('Successfully loaded', convertedGames.length, 'recommended games');
            console.log('[Recommended] First converted game genre:', convertedGames[0]?.genre);

            await enrichGamesWithCreatorInfo(convertedGames);
            
            console.log('[Recommended] First game genre after enrichment:', convertedGames[0]?.genre);

            setRecommendedGamesCache(convertedGames);
            
            return convertedGames;

        } catch (error) {
            console.warn('Failed to load omni recommendations:', error);

            try {
                console.log('Falling back to top-rated games as recommendations...');
                if (window.robloxAPI.getGameSorts) {
                    const sortsData = await window.robloxAPI.getGameSorts();
                    if (sortsData && sortsData.sorts && Array.isArray(sortsData.sorts)) {
                        
                        const recommendedSort = sortsData.sorts.find(s => 
                            (s.sortId || s.id || '').toLowerCase().includes('top-rated') ||
                            (s.sortId || s.id || '').toLowerCase().includes('up-and-coming') ||
                            (s.sortId || s.id || '').toLowerCase().includes('featured')
                        );
                        
                        if (recommendedSort && recommendedSort.games && recommendedSort.games.length > 0) {
                            console.log('Using top-rated/featured games as recommendations fallback');
                            await enrichGamesWithCreatorInfo(recommendedSort.games);
                            return recommendedSort.games.slice(0, 25); 
                        }

                        const alternativeSort = sortsData.sorts.find(s => 
                            !(s.sortId || s.id || '').toLowerCase().includes('popular')
                        );
                        
                        if (alternativeSort && alternativeSort.games && alternativeSort.games.length > 0) {
                            console.log('Using alternative sort as recommendations fallback:', alternativeSort.sortId || alternativeSort.id);
                            await enrichGamesWithCreatorInfo(alternativeSort.games);
                            return alternativeSort.games.slice(0, 25);
                        }
                    }
                }
            } catch (e) {
                console.warn('Could not load fallback games for recommendations:', e);
            }

            console.log('Generating placeholder games for recommendations...');
            return generatePlaceholderGames(15);
        }
    }

    async function loadFavoriteGames(requestId) {
        console.log('Loading favorite games...');
        
        let favorites = [];

        if (isRequestStale(requestId)) {
            console.log(`[Favorites] Request #${requestId} is stale, aborting`);
            return [];
        }

        try {
            const preloadedResult = await window.roblox?.getCachedFavoriteGames?.();

            if (isRequestStale(requestId)) {
                console.log(`[Favorites] Request #${requestId} is stale after preload check, aborting`);
                return [];
            }
            
            if (preloadedResult?.cached && preloadedResult?.data?.length > 0) {
                console.log('[Favorites] Using', preloadedResult.data.length, 'preloaded games from main process');
                favorites = preloadedResult.data;
            }
        } catch (e) {
            console.log('[Favorites] Preloaded cache not available:', e.message);
        }

        if (favorites.length === 0) {
            try {
                
                if (isRequestStale(requestId)) {
                    console.log(`[Favorites] Request #${requestId} is stale before API call, aborting`);
                    return [];
                }
                
                const currentUser = await window.robloxAPI.getCurrentUser();
                console.log('Current user for favorites:', currentUser);
                if (!currentUser?.id) {
                    console.log('User not logged in, cannot load favorites');
                    return []; 
                }

                if (isRequestStale(requestId)) {
                    console.log(`[Favorites] Request #${requestId} is stale after getting user, aborting`);
                    return [];
                }
                
                console.log('Fetching user favorites with limit 100...');
                try {
                    const result = await window.robloxAPI.getUserFavoriteGames(currentUser.id, 100);
                    console.log('User favorites response:', result);
                    favorites = result?.data || [];
                } catch (apiError) {
                    console.warn('API error when fetching favorites:', apiError.message);
                    
                    if (apiError.message.includes('Allowed values')) {
                        console.log('Retrying with limit 50...');
                        try {
                            const result = await window.robloxAPI.getUserFavoriteGames(currentUser.id, 50);
                            favorites = result?.data || [];
                        } catch (retryError) {
                            console.warn('Retry also failed:', retryError.message);
                            return [];
                        }
                    } else {
                        throw apiError; 
                    }
                }
            } catch (e) {
                console.error('Failed to load favorite games:', e);
                return [];
            }
        }

        if (isRequestStale(requestId)) {
            console.log(`[Favorites] Request #${requestId} is stale before enrichment, aborting`);
            return [];
        }

        if (favorites.length > 0) {
            await enrichGamesWithCreatorInfo(favorites);
        }
        
        return favorites;
    }

    async function loadRecentGames(requestId) {
        console.log('Loading recent games...');

        const cachedGames = getRecentGamesCache();
        if (cachedGames && cachedGames.length > 0) {
            console.log('[Recent] Returning', cachedGames.length, 'client-cached games');
            
            await enrichGamesWithPlaytime(cachedGames);
            return cachedGames;
        }

        if (isRequestStale(requestId)) {
            console.log(`[Recent] Request #${requestId} is stale, aborting`);
            return [];
        }

        try {
            const preloadedResult = await window.roblox?.getCachedRecentGames?.();

            if (isRequestStale(requestId)) {
                console.log(`[Recent] Request #${requestId} is stale after preload check, aborting`);
                return [];
            }
            
            if (preloadedResult?.cached && preloadedResult?.data?.length > 0) {
                console.log('[Recent] Using', preloadedResult.data.length, 'preloaded games from main process');
                
                setRecentGamesCache(preloadedResult.data);
                
                await enrichGamesWithPlaytime(preloadedResult.data);
                return preloadedResult.data;
            }
        } catch (e) {
            console.log('[Recent] Preloaded cache not available:', e.message);
        }
        
        try {
            
            if (isRequestStale(requestId)) {
                console.log(`[Recent] Request #${requestId} is stale before API call, aborting`);
                return [];
            }
            
            const currentUser = await window.robloxAPI.getCurrentUser();
            console.log('Current user for recent games:', currentUser);
            if (!currentUser?.id) {
                console.log('User not logged in, cannot load recent games');
                return []; 
            }

            if (isRequestStale(requestId)) {
                console.log(`[Recent] Request #${requestId} is stale after getting user, aborting`);
                return [];
            }
            
            console.log('Fetching user recent games from omni recommendations...');
            let recentGames = [];

            if (window.roblox?.getOmniRecommendations) {
                try {
                    const recommendationsData = await window.roblox.getOmniRecommendations('Home');

                    if (isRequestStale(requestId)) {
                        console.log(`[Recent] Request #${requestId} is stale after recommendations, aborting`);
                        return [];
                    }
                    
                    console.log('[Recent] Omni recommendations data:', recommendationsData);
                    
                    if (recommendationsData?.sorts && recommendationsData.sorts.length > 0) {
                        
                        console.log('[Recent] Available sorts:', recommendationsData.sorts.map(s => s.topic));

                        const recentSort = recommendationsData.sorts.find(sort => {
                            const topic = (sort.topic || '').toLowerCase();
                            
                            return topic.startsWith('continue');
                        });
                        
                        if (recentSort && recentSort.recommendationList && recentSort.recommendationList.length > 0) {
                            console.log('[Recent] Found Continue sort:', recentSort.topic, 'with', recentSort.recommendationList.length, 'games');

                            const universeIds = recentSort.recommendationList
                                .filter(rec => rec.contentType === 'Game' && rec.contentId)
                                .map(rec => rec.contentId);
                            
                            if (universeIds.length > 0) {
                                
                                const loading = document.getElementById('GamesLoading');
                                if (loading) {
                                    loading.innerHTML = `Loading ${universeIds.length} recent games...`;
                                }

                                const localServerStatus = await window.RobloxClient?.localServer?.getStatus?.();
                                
                                if (localServerStatus?.isRunning) {
                                    try {
                                        const result = await window.RobloxClient.localServer.batchGameDetails(universeIds);
                                        if (result?.success && result?.data) {
                                            recentGames = result.data.map(game => ({
                                                universeId: game.id,
                                                placeId: game.rootPlaceId,
                                                name: game.name,
                                                playerCount: game.playing || 0,
                                                playing: game.playing || 0,
                                                genre: (game.genre && game.genre !== 'All' && !game.isAllGenre) ? game.genre : 'All',
                                                visits: game.visits || 0,
                                                favoritedCount: game.favoritedCount || 0,
                                                updated: game.updated,
                                                
                                                creator: {
                                                    id: game.creator?.id,
                                                    name: game.creator?.name,
                                                    type: game.creator?.type
                                                },
                                                creatorName: game.creator?.name
                                            }));
                                        }
                                    } catch (e) {
                                        console.warn('[Recent] Local server failed:', e);
                                    }
                                }

                                if (recentGames.length === 0) {
                                    recentGames = await fetchGameDetailsClientSide(universeIds, loading);
                                    recentGames = recentGames.map(game => ({
                                        universeId: game.id,
                                        placeId: game.rootPlaceId,
                                        name: game.name,
                                        playerCount: game.playing || 0,
                                        playing: game.playing || 0,
                                        genre: (game.genre && game.genre !== 'All' && !game.isAllGenre) ? game.genre : 'All',
                                        visits: game.visits || 0,
                                        favoritedCount: game.favoritedCount || 0,
                                        updated: game.updated,
                                        
                                        creator: {
                                            id: game.creator?.id,
                                            name: game.creator?.name,
                                            type: game.creator?.type
                                        },
                                        creatorName: game.creator?.name
                                    }));
                                }
                                
                                if (loading) {
                                    loading.innerHTML = 'Loading games...';
                                }
                            }
                        } else {
                            console.log('[Recent] No "Continue" sort found in recommendations');
                        }
                    }
                } catch (apiError) {
                    console.warn('[Recent] API error:', apiError.message);
                }
            }

            if (recentGames.length > 0) {
                await enrichGamesWithCreatorInfo(recentGames);
                await enrichGamesWithPlaytime(recentGames);
            }

            if (recentGames.length > 0) {
                setRecentGamesCache(recentGames);
            }

            return recentGames;
        } catch (e) {
            console.error('Failed to load recent games:', e);
            return [];
        }
    }

    let genreLookupCache = new Map();
    let genreLookupTimestamp = 0;
    const GENRE_LOOKUP_TTL = 10 * 60 * 1000; 

    async function buildGenreLookup() {
        const now = Date.now();

        if (genreLookupCache.size > 0 && (now - genreLookupTimestamp) < GENRE_LOOKUP_TTL) {
            console.log('[GenreLookup] Using cached lookup with', genreLookupCache.size, 'entries');
            return genreLookupCache;
        }

        console.log('[GenreLookup] Building genre lookup from game sorts...');
        
        try {
            
            if (!window.robloxAPI?.getGameSorts) {
                console.warn('[GenreLookup] getGameSorts not available');
                return genreLookupCache;
            }

            const sortsData = await window.robloxAPI.getGameSorts();
            
            if (!sortsData?.sorts || !Array.isArray(sortsData.sorts)) {
                console.warn('[GenreLookup] Invalid sorts data');
                return genreLookupCache;
            }

            const sortToGenre = {
                'trending-in-rpg': 'RPG',
                'trending-in-shooter': 'Shooter',
                'trending-in-action': 'Action',
                'trending-in-adventure': 'Adventure',
                'trending-in-sports-and-racing': 'Sports',
                'trending-in-obby-and-platformer': 'Obby',
                'trending-in-simulation': 'Simulation',
                'trending-in-roleplay-and-avatar-sim': 'Roleplay',
                'trending-in-survival': 'Survival',
                'trending-in-puzzle': 'Puzzle',
                'trending-in-strategy': 'Strategy'
            };

            for (const sort of sortsData.sorts) {
                const sortId = (sort.sortId || sort.id || '').toLowerCase();
                const genre = sortToGenre[sortId];
                
                if (genre && sort.games && Array.isArray(sort.games)) {
                    for (const game of sort.games) {
                        const universeId = game.universeId || game.id;
                        if (universeId && !genreLookupCache.has(universeId)) {
                            genreLookupCache.set(universeId, genre);
                        }
                    }
                }
            }

            genreLookupTimestamp = now;
            console.log('[GenreLookup] Built lookup with', genreLookupCache.size, 'entries');
            
        } catch (e) {
            console.warn('[GenreLookup] Failed to build genre lookup:', e.message);
        }

        return genreLookupCache;
    }

    async function enrichGamesWithGenre(games) {
        if (!games || games.length === 0) return;

        const gamesNeedingGenre = games.filter(g => !g.genre || g.genre === 'All');
        
        if (gamesNeedingGenre.length === 0) {
            console.log('[GenreLookup] All games already have genre data');
            return;
        }

        const universeIds = gamesNeedingGenre
            .map(g => g.universeId || g.id)
            .filter(id => id);

        console.log(`[GenreLookup] Looking up genres for ${universeIds.length} games`);

        const localServerStatus = await window.RobloxClient?.localServer?.getStatus?.();
        
        if (localServerStatus?.isRunning) {
            console.log('[GenreLookup] Using local server for genre lookup');
            
            try {
                const result = await window.RobloxClient.localServer.batchGenreLookup(universeIds);
                
                if (result?.success && result?.data) {
                    const genreMap = result.data;
                    let enrichedCount = 0;
                    
                    for (const game of gamesNeedingGenre) {
                        const universeId = game.universeId || game.id;
                        if (universeId && genreMap[universeId]) {
                            game.genre = genreMap[universeId];
                            
                            genreLookupCache.set(universeId, genreMap[universeId]);
                            enrichedCount++;
                        }
                    }
                    
                    console.log(`[GenreLookup] Local server enriched ${enrichedCount}/${gamesNeedingGenre.length} games (${result.stats?.cached || 0} cached, ${result.stats?.apiCalls || 0} API calls)`);
                    return;
                }
            } catch (e) {
                console.warn('[GenreLookup] Local server failed, falling back to client-side:', e.message);
            }
        }

        const lookup = await buildGenreLookup();
        
        if (lookup.size === 0) {
            console.log('[GenreLookup] No genre data available from client-side lookup');
            return;
        }

        let enrichedCount = 0;
        for (const game of gamesNeedingGenre) {
            const universeId = game.universeId || game.id;
            if (universeId && lookup.has(universeId)) {
                game.genre = lookup.get(universeId);
                enrichedCount++;
            }
        }

        console.log(`[GenreLookup] Client-side enriched ${enrichedCount}/${gamesNeedingGenre.length} games with genre data`);
    }

    async function loadRovlooReviewedGames(requestId) {
        console.log(`[Rovloo] Loading reviewed games with sort: ${currentSort}, requestId: ${requestId}`);

        const cachedGames = getRovlooGamesCache();
        if (cachedGames && cachedGames.length > 0) {
            console.log('[Rovloo] Returning', cachedGames.length, 'client-cached games');
            
            const needsGenreEnrichment = cachedGames.some(g => !g.genre || g.genre === 'All');
            if (needsGenreEnrichment) {
                await enrichGamesWithGenre(cachedGames);
                
                setRovlooGamesCache(cachedGames);
                
                if (window.roblox?.setRovlooGamesCache) {
                    window.roblox.setRovlooGamesCache(cachedGames).catch(e => {
                        console.warn('[Rovloo] Could not update main process cache after genre enrichment:', e.message);
                    });
                }
            }
            return sortRovlooGames([...cachedGames]);
        }

        if (window.roblox?.getCachedRovlooGames) {
            try {
                const preloaded = await window.roblox.getCachedRovlooGames();
                if (preloaded?.cached && preloaded?.data?.length > 0) {
                    console.log('[Rovloo] Using preloaded games from main process:', preloaded.data.length);
                    
                    setRovlooGamesCache(preloaded.data);
                    
                    const needsGenreEnrichment = preloaded.data.some(g => !g.genre || g.genre === 'All');
                    if (needsGenreEnrichment) {
                        await enrichGamesWithGenre(preloaded.data);
                        
                        setRovlooGamesCache(preloaded.data);
                        
                        if (window.roblox?.setRovlooGamesCache) {
                            window.roblox.setRovlooGamesCache(preloaded.data).catch(e => {
                                console.warn('[Rovloo] Could not update main process cache after genre enrichment:', e.message);
                            });
                        }
                    }
                    return sortRovlooGames([...preloaded.data]);
                } else if (preloaded?.isLoading) {
                    console.log('[Rovloo] Background preload in progress, loading manually...');
                }
            } catch (e) {
                console.warn('[Rovloo] Could not get preloaded cache:', e.message);
            }
        }
        
        try {
            
            if (!window.roblox?.reviews?.getReviewedGames) {
                console.warn('[Rovloo] Reviews API not available');
                return [];
            }

            if (isRequestStale(requestId)) {
                console.log(`[Rovloo] Request #${requestId} is stale before API call, aborting`);
                return [];
            }

            const reviewedGames = await window.roblox.reviews.getReviewedGames({
                sort: currentSort
                
            });

            if (isRequestStale(requestId)) {
                console.log(`[Rovloo] Request #${requestId} is stale after API call, aborting`);
                return [];
            }
            
            console.log('[Rovloo] Got reviewed games:', reviewedGames);
            
            if (!reviewedGames || reviewedGames.length === 0) {
                console.log('[Rovloo] No reviewed games found');
                return [];
            }
            
            const loading = document.getElementById('GamesLoading');
            
            if (loading && !isRequestStale(requestId)) {
                loading.innerHTML = `Processing ${reviewedGames.length} games...`;
            }

            const gamesWithCompleteData = [];
            const gamesNeedingEnrichment = [];
            
            for (const g of reviewedGames) {
                
                const hasCompleteData = g.universeId && g.name && g.name !== 'Unknown Game';
                if (hasCompleteData) {
                    gamesWithCompleteData.push(g);
                } else {
                    gamesNeedingEnrichment.push(g);
                }
            }
            
            console.log('[Rovloo] Games with complete data:', gamesWithCompleteData.length, '| Need enrichment:', gamesNeedingEnrichment.length);

            const MIN_VALID_ID = 100000; 
            const MAX_VALID_ID = 99999999999; 
            
            const filteredOut = [];
            const validGamesForConversion = gamesNeedingEnrichment.filter(g => {
                const id = typeof g.gameId === 'string' ? parseInt(g.gameId, 10) : g.gameId;
                const isValid = id && !isNaN(id) && id >= MIN_VALID_ID && id <= MAX_VALID_ID;
                if (!isValid) {
                    filteredOut.push({ gameId: g.gameId, name: g.name, reason: !id ? 'no id' : isNaN(id) ? 'NaN' : id < MIN_VALID_ID ? 'too small' : 'too large' });
                }
                return isValid;
            });
            
            if (filteredOut.length > 0) {
                console.log('[Rovloo] Filtered out games (invalid place IDs):', filteredOut);
            }

            const placeIdToRovlooData = new Map();
            for (const g of validGamesForConversion) {
                const id = typeof g.gameId === 'string' ? parseInt(g.gameId, 10) : g.gameId;
                placeIdToRovlooData.set(id, g);
            }

            const placeIds = Array.from(placeIdToRovlooData.keys());
            const placeToUniverse = new Map();

            if (placeIds.length > 0) {
                const CONCURRENT_REQUESTS = 3; 
                const BATCH_DELAY = 500; 

                const failedConversions = [];

                async function getPlaceDetailsWithRetry(placeId, retries = 3) {
                    for (let attempt = 0; attempt < retries; attempt++) {
                        try {
                            const placeDetails = await window.roblox.getPlaceDetails([placeId]);
                            return placeDetails;
                        } catch (e) {
                            const isRateLimit = e.message?.includes('Too many requests') || e.message?.includes('429');
                            if (isRateLimit && attempt < retries - 1) {
                                const delay = 1000 * Math.pow(2, attempt);
                                await new Promise(resolve => setTimeout(resolve, delay));
                            } else {
                                throw e;
                            }
                        }
                    }
                }

                for (let i = 0; i < placeIds.length; i += CONCURRENT_REQUESTS) {
                    const batch = placeIds.slice(i, Math.min(i + CONCURRENT_REQUESTS, placeIds.length));
                    
                    if (loading) {
                        const percent = Math.round((i / placeIds.length) * 100);
                        loading.innerHTML = `Converting place IDs... ${percent}% (${placeToUniverse.size} found)`;
                    }

                    const promises = batch.map(async (placeId) => {
                        try {
                            const placeDetails = await getPlaceDetailsWithRetry(placeId);
                            if (placeDetails && placeDetails[0] && placeDetails[0].universeId) {
                                return { placeId, universeId: placeDetails[0].universeId };
                            } else {
                                const rovlooData = placeIdToRovlooData.get(placeId);
                                failedConversions.push({ placeId, name: rovlooData?.name, reason: 'no universeId in response' });
                            }
                        } catch (e) {
                            const rovlooData = placeIdToRovlooData.get(placeId);
                            failedConversions.push({ placeId, name: rovlooData?.name, reason: e.message });
                        }
                        return null;
                    });
                    
                    const results = await Promise.all(promises);
                    for (const result of results) {
                        if (result) {
                            placeToUniverse.set(result.placeId, result.universeId);
                        }
                    }

                    if (i + CONCURRENT_REQUESTS < placeIds.length) {
                        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
                    }
                }
                
                console.log('[Rovloo] Converted', placeToUniverse.size, 'place IDs to universe IDs');
                if (failedConversions.length > 0) {
                    console.log('[Rovloo] Failed to convert', failedConversions.length, 'place IDs:', failedConversions);
                }
            }

            if (placeToUniverse.size === 0 && gamesWithCompleteData.length === 0) {
                console.log('[Rovloo] No games to process (no conversions and no complete games)');
                return [];
            }

            const formattedGames = [];

            for (const g of gamesWithCompleteData) {
                formattedGames.push({
                    universeId: g.universeId,
                    placeId: g.placeId || g.gameId,
                    name: g.name,
                    playerCount: g.playing || g.playerCount || 0,
                    playing: g.playing || g.playerCount || 0,
                    genre: g.genre || 'All',
                    visits: g.visits || 0,
                    favoritedCount: g.favoritedCount || 0,
                    creator: g.creator ? { name: g.creator } : null,
                    creatorName: g.creatorName || g.creator || 'Unknown',
                    thumbnailUrl: g.thumbnailUrl || '',
                    
                    rovlooReviewCount: g.rovlooReviewCount || g.reviewCount || 0,
                    rovlooLikeRatio: g.rovlooLikeRatio || g.likeRatio || 0,
                    rovlooLikeCount: g.rovlooLikeCount || g.likeCount || 0,
                    rovlooDislikeCount: g.rovlooDislikeCount || g.dislikeCount || 0,
                    newestReviewTimestamp: g.newestReviewTimestamp || 0,
                    
                    isBlacklisted: g.isBlacklisted || false
                });
            }
            
            console.log(`[Rovloo] Added ${gamesWithCompleteData.length} games with complete data (no API calls)`);

            if (placeToUniverse.size > 0) {
                const universeIds = Array.from(placeToUniverse.values());
                
                if (loading) {
                    loading.innerHTML = `Loading ${universeIds.length} game details...`;
                }
                
                let gameDetailsMap = new Map();

                const localServerStatus = await window.RobloxClient?.localServer?.getStatus?.();
                
                if (localServerStatus?.isRunning && universeIds.length > 10) {
                    console.log('[Rovloo] Using local server for batch game details');
                    if (loading) {
                        loading.innerHTML = `Loading ${universeIds.length} game details via local server...`;
                    }
                    
                    try {
                        const result = await window.RobloxClient.localServer.batchGameDetails(universeIds);
                        
                        if (result?.success && result?.data) {
                            console.log(`[Rovloo] Local server fetched ${result.data.length} games (${result.stats?.cached || 0} cached)`);
                            for (const game of result.data) {
                                gameDetailsMap.set(game.id, game);
                            }
                        } else {
                            throw new Error(result?.error || 'Local server failed');
                        }
                    } catch (localServerError) {
                        console.warn('[Rovloo] Local server failed, falling back to client-side:', localServerError);
                        
                        gameDetailsMap = new Map(); 
                    }
                }

                if (gameDetailsMap.size === 0 && universeIds.length > 0) {
                    
                    async function fetchWithRetry(batch, retries = 3, baseDelay = 1000) {
                        for (let attempt = 0; attempt < retries; attempt++) {
                            try {
                                const result = await window.roblox.getGameDetails(batch);
                                return result;
                            } catch (e) {
                                const isRateLimit = e.message?.includes('Too many requests') || e.message?.includes('429');
                                if (isRateLimit && attempt < retries - 1) {
                                    const delay = baseDelay * Math.pow(2, attempt); 
                                    console.log(`[Rovloo] Rate limited, waiting ${delay}ms before retry ${attempt + 1}/${retries - 1}...`);
                                    await new Promise(resolve => setTimeout(resolve, delay));
                                } else {
                                    throw e;
                                }
                            }
                        }
                    }

                    const GAME_BATCH_SIZE = 30; 
                    const BATCH_DELAY = 500; 
                    
                    for (let i = 0; i < universeIds.length; i += GAME_BATCH_SIZE) {
                        const batch = universeIds.slice(i, i + GAME_BATCH_SIZE);
                        
                        if (loading) {
                            const percent = Math.round((i / universeIds.length) * 100);
                            loading.innerHTML = `Loading game details... ${percent}% (${gameDetailsMap.size}/${universeIds.length})`;
                        }
                        
                        try {
                            const result = await fetchWithRetry(batch);
                            if (result?.data) {
                                for (const game of result.data) {
                                    gameDetailsMap.set(game.id, game);
                                }
                            }
                        } catch (e) {
                            console.warn('[Rovloo] Game details batch failed after retries:', e.message);
                            
                        }

                        if (i + GAME_BATCH_SIZE < universeIds.length) {
                            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
                        }
                    }
                } 
                
                console.log('[Rovloo] Got details for', gameDetailsMap.size, 'games that needed enrichment');

                for (const [placeId, universeId] of placeToUniverse) {
                    const rovlooData = placeIdToRovlooData.get(placeId);
                    const gameData = gameDetailsMap.get(universeId);
                    
                    if (gameData) {
                        formattedGames.push({
                            universeId: gameData.id,
                            placeId: gameData.rootPlaceId || placeId,
                            name: gameData.name,
                            playerCount: gameData.playing || 0,
                            playing: gameData.playing || 0,
                            genre: gameData.genre || 'All',
                            visits: gameData.visits || 0,
                            favoritedCount: gameData.favoritedCount || 0,
                            updated: gameData.updated,
                            creator: {
                                id: gameData.creator?.id,
                                name: gameData.creator?.name,
                                type: gameData.creator?.type
                            },
                            creatorName: gameData.creator?.name || 'Unknown',
                            
                            rovlooReviewCount: rovlooData?.reviewCount || 0,
                            rovlooLikeRatio: rovlooData?.likeRatio || 0,
                            rovlooLikeCount: rovlooData?.likeCount || 0,
                            rovlooDislikeCount: rovlooData?.dislikeCount || 0,
                            newestReviewTimestamp: rovlooData?.newestReviewTimestamp || 0,
                            
                            isBlacklisted: rovlooData?.isBlacklisted || false
                        });
                    }
                }
            } 
            
            console.log('[Rovloo] Final formatted games:', formattedGames.length);

            if (formattedGames.length > 0) {
                try {
                    await enrichGamesWithCreatorInfo(formattedGames);
                } catch (e) {
                    console.warn('[Rovloo] Could not enrich with creator info:', e.message);
                }

                try {
                    await enrichGamesWithGenre(formattedGames);
                } catch (e) {
                    console.warn('[Rovloo] Could not enrich with genre data:', e.message);
                }
            }

            setRovlooGamesCache(formattedGames);

            if (window.roblox?.setRovlooGamesCache && formattedGames.length > 0) {
                window.roblox.setRovlooGamesCache(formattedGames).catch(e => {
                    console.warn('[Rovloo] Could not update main process cache:', e.message);
                });
            }
            
            return sortRovlooGames(formattedGames);
        } catch (e) {
            console.error('[Rovloo] Failed to load reviewed games:', e);
            return [];
        }
    }

    function calculateWilsonScore(likes, dislikes) {
        const total = likes + dislikes;
        if (total < 5) return 0.5; 

        const z = 1.96;
        const phat = likes / total;
        const score = (phat + z * z / (2 * total) - z * Math.sqrt((phat * (1 - phat) + z * z / (4 * total)) / total)) / (1 + z * z / total);
        return score;
    }

    function calculateGameDiscoveryScore(game) {
        const playerCount = game.playing || game.playerCount || 0;
        const visits = game.visits || 0;
        const reviewCount = game.rovlooReviewCount || 0;
        const likeCount = game.rovlooLikeCount || 0;
        const dislikeCount = game.rovlooDislikeCount || 0;

        if (reviewCount < 1) return 0;

        const wilsonScore = calculateWilsonScore(likeCount, dislikeCount);

        if (wilsonScore < 0.5) return 0;

        let baseScore = 0;
        if (playerCount >= 10 && playerCount <= 99) {
            baseScore = 100; 
        } else if (playerCount >= 100 && playerCount <= 999) {
            baseScore = 80; 
        } else if (playerCount > 0 && playerCount < 10) {
            baseScore = 60; 
        } else if (playerCount === 0 && visits < 10000) {
            baseScore = 40; 
        } else if (playerCount >= 1000 && playerCount < 5000) {
            baseScore = 30; 
        } else {
            baseScore = 10; 
        }

        if (baseScore > 0 && visits < 10000) {
            baseScore += 15;
        } else if (baseScore > 0 && visits < 50000) {
            baseScore += 5;
        }

        const reviewMultiplier = Math.min(1 + (reviewCount / 10), 2.0);

        const ratingMultiplier = 0.5 + (wilsonScore * 1.5);

        const finalScore = baseScore * reviewMultiplier * ratingMultiplier;
        
        return Math.round(finalScore * 100) / 100;
    }
    
    function sortRovlooGames(games) {
        switch (currentSort) {
            case 'balanced_discovery':
                
                games.sort((a, b) => {
                    const scoreA = calculateGameDiscoveryScore(a);
                    const scoreB = calculateGameDiscoveryScore(b);
                    if (scoreA !== scoreB) {
                        return scoreB - scoreA;
                    }
                    
                    const wilsonA = calculateWilsonScore(a.rovlooLikeCount, a.rovlooDislikeCount);
                    const wilsonB = calculateWilsonScore(b.rovlooLikeCount, b.rovlooDislikeCount);
                    return wilsonB - wilsonA;
                });
                console.log('[Rovloo] Sorted by balanced discovery. Top 5:', games.slice(0, 5).map(g => ({ 
                    name: g.name, 
                    discoveryScore: calculateGameDiscoveryScore(g),
                    playing: g.playing,
                    visits: g.visits,
                    reviews: g.rovlooReviewCount,
                    wilsonScore: calculateWilsonScore(g.rovlooLikeCount, g.rovlooDislikeCount).toFixed(3)
                })));
                break;
            case 'highest_rated':
                
                games.sort((a, b) => {
                    const scoreA = calculateWilsonScore(a.rovlooLikeCount, a.rovlooDislikeCount);
                    const scoreB = calculateWilsonScore(b.rovlooLikeCount, b.rovlooDislikeCount);
                    if (scoreA !== scoreB) {
                        return scoreB - scoreA;
                    }
                    
                    return b.rovlooReviewCount - a.rovlooReviewCount;
                });
                console.log('[Rovloo] Sorted by highest rated (Wilson score). Top 5:', games.slice(0, 5).map(g => ({ 
                    name: g.name, 
                    wilsonScore: calculateWilsonScore(g.rovlooLikeCount, g.rovlooDislikeCount).toFixed(3),
                    likes: g.rovlooLikeCount, 
                    dislikes: g.rovlooDislikeCount,
                    total: g.rovlooReviewCount
                })));
                break;
            case 'lowest_rated':
                
                games.sort((a, b) => {
                    const scoreA = calculateWilsonScore(a.rovlooLikeCount, a.rovlooDislikeCount);
                    const scoreB = calculateWilsonScore(b.rovlooLikeCount, b.rovlooDislikeCount);
                    if (scoreA !== scoreB) {
                        return scoreA - scoreB;
                    }
                    
                    return b.rovlooReviewCount - a.rovlooReviewCount;
                });
                console.log('[Rovloo] Sorted by lowest rated (Wilson score). Top 5:', games.slice(0, 5).map(g => ({ 
                    name: g.name, 
                    wilsonScore: calculateWilsonScore(g.rovlooLikeCount, g.rovlooDislikeCount).toFixed(3),
                    likes: g.rovlooLikeCount, 
                    dislikes: g.rovlooDislikeCount,
                    total: g.rovlooReviewCount
                })));
                break;
            case 'newest_reviews':
                
                games.sort((a, b) => {
                    const timestampA = a.newestReviewTimestamp || 0;
                    const timestampB = b.newestReviewTimestamp || 0;
                    return timestampB - timestampA;
                });
                console.log('[Rovloo] Sorted by newest reviews. Top 5:', games.slice(0, 5).map(g => ({ 
                    name: g.name, 
                    newestReview: g.newestReviewTimestamp ? new Date(g.newestReviewTimestamp).toLocaleDateString() : 'N/A',
                    reviews: g.rovlooReviewCount
                })));
                break;
            case 'most_reviews':
                games.sort((a, b) => b.rovlooReviewCount - a.rovlooReviewCount);
                console.log('[Rovloo] Sorted by most reviews. Top 5:', games.slice(0, 5).map(g => ({ name: g.name, reviews: g.rovlooReviewCount })));
                break;
            default:
                
                games.sort((a, b) => {
                    const scoreA = calculateGameDiscoveryScore(a);
                    const scoreB = calculateGameDiscoveryScore(b);
                    return scoreB - scoreA;
                });
                break;
        }

        const nonBlacklisted = games.filter(g => !g.isBlacklisted);
        const blacklisted = games.filter(g => g.isBlacklisted);
        if (blacklisted.length > 0) {
            console.log(`[Rovloo] Pushing ${blacklisted.length} blacklisted games to bottom`);
        }
        return [...nonBlacklisted, ...blacklisted];
    }

    async function loadCustomListGames(requestId) {
        console.log('Loading custom list games...');

        if (isRequestStale(requestId)) {
            console.log(`[Custom] Request #${requestId} is stale, aborting`);
            return [];
        }

        if (window.customGameLists && window.customGameLists.length > 0) {
            
            return window.customGameLists[0].games || [];
        }
        
        return [];
    }

    function showNoGamesMessage() {
        const gamesList = document.getElementById('GamesList');
        const error = document.getElementById('GamesError');
        
        if (!gamesList || !error) return;
        
        let message = 'No games found.';
        
        switch (currentCategory) {
            case 'recommended':
                message = 'No personalized recommendations available. Try favoriting some games or playing more games to get better recommendations!';
                break;
            case 'favorites':
                message = 'You haven\'t favorited any games yet. Click the heart icon on games you enjoy!';
                break;
            case 'recent':
                message = 'No recently played games found.';
                break;
            case 'rovloo':
                message = 'No Rovloo reviewed games found. Be the first to review games on Rovloo!';
                break;
            case 'custom':
                message = 'No custom game lists available. Install extensions to add custom lists!';
                break;
            default:
                message = 'No games found for the selected filters.';
        }
        
        error.textContent = message;
        error.style.display = 'block';
        gamesList.style.display = 'none';
    }

    window.registerCustomGameList = function(listName, games, description) {
        if (!window.customGameLists) {
            window.customGameLists = [];
        }
        
        window.customGameLists.push({
            name: listName,
            games: games,
            description: description || ''
        });

        updateCustomListsUI();

        const customCategory = document.querySelector('#CategorySelector .GamesFilter[data-category="custom"]');
        if (customCategory) {
            customCategory.style.display = 'block';
        }
    };

    function updateCustomListsUI() {
        const container = document.getElementById('CustomListsContainer');
        if (!container || !window.customGameLists) return;

        container.innerHTML = '';
        
        if (window.customGameLists.length === 0) {
            container.innerHTML = '<li><a class="GamesFilter" data-filter="NoLists" href="#" style="color: #999; cursor: default;">No custom lists available</a></li>';
            return;
        }

        window.customGameLists.forEach((list, index) => {
            const li = document.createElement('li');
            li.className = 'custom-list-item';
            li.innerHTML = `
                <a class="GamesFilter" data-filter="CustomList${index}" href="#games?category=custom&list=${index}">
                    ${list.name}
                    <span class="list-count">(${list.games.length})</span>
                </a>
                ${list.description ? `<div class="list-info">${list.description}</div>` : ''}
            `;
            container.appendChild(li);
        });
    }

})();