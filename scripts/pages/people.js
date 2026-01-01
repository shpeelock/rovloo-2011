

(function() {
    'use strict';

    let currentPage = 1;
    let currentQuery = '';
    let totalResults = 0;
    let isInitialized = false;
    const RESULTS_PER_PAGE = 12;

    document.addEventListener('DOMContentLoaded', function() {
        
        if (document.getElementById('SearchTextBox')) {
            init();
        }
    });

    document.addEventListener('pageChange', function(e) {
        if (e.detail && e.detail.page === 'people') {
            console.log('People page activated via SPA');
        }
    });

    window.PeoplePage = {
        init: init,
        search: performSearch
    };

    function init() {
        if (isInitialized) return;
        isInitialized = true;
        
        console.log('People page initialized');

        const searchBtn = document.getElementById('SearchUsersButton');
        if (searchBtn) {
            searchBtn.addEventListener('click', performSearch);
        }

        const searchBox = document.getElementById('SearchTextBox');
        if (searchBox) {
            searchBox.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    performSearch();
                }
            });
            
            searchBox.focus();
        }

        const prevBtn = document.getElementById('SearchPrevPage');
        const nextBtn = document.getElementById('SearchNextPage');
        if (prevBtn) prevBtn.addEventListener('click', prevPage);
        if (nextBtn) nextBtn.addEventListener('click', nextPage);

        checkUrlForSearch();
    }

    function checkUrlForSearch() {
        const hash = window.location.hash;
        if (hash.includes('?q=')) {
            const params = new URLSearchParams(hash.split('?')[1]);
            const query = params.get('q');
            if (query) {
                const searchBox = document.getElementById('SearchTextBox');
                if (searchBox) {
                    searchBox.value = decodeURIComponent(query);
                    performSearch();
                }
            }
        }
    }

    async function performSearch() {
        const searchBox = document.getElementById('SearchTextBox');
        if (!searchBox) return;
        
        const query = searchBox.value.trim();
        
        if (!query) {
            showError('Please enter a username to search.');
            return;
        }

        currentQuery = query;
        currentPage = 1;
        await searchUsers(query, currentPage);
    }

    async function searchUsers(query, page) {
        showLoading();
        hideError();

        try {
            const result = await window.roblox.searchUsers(query, RESULTS_PER_PAGE);
            
            if (!result || !result.data) {
                throw new Error('Invalid response from API');
            }

            totalResults = result.data.length;
            
            if (totalResults === 0) {
                showNoResults();
            } else {
                await renderResults(result.data);
                showResults();
                updatePagination();
            }
        } catch (error) {
            console.error('Search error:', error);
            showError('Failed to search users. Please try again.');
        }
    }

    async function renderResults(users) {
        const container = document.getElementById('SearchResultsList');
        if (!container) return;
        
        container.innerHTML = '';

        const userIds = users.map(u => u.id);
        let thumbnails = {};
        
        try {
            const thumbResult = await window.roblox.getUserThumbnails(userIds, '150x150', 'Headshot');
            if (thumbResult && thumbResult.data) {
                thumbResult.data.forEach(t => {
                    thumbnails[t.targetId] = t.imageUrl;
                });
            }
        } catch (e) {
            console.warn('Failed to load thumbnails:', e);
        }

        for (const user of users) {
            const userDiv = await createUserCard(user, thumbnails[user.id]);
            container.appendChild(userDiv);
        }
    }

    async function createUserCard(user, thumbnailUrl) {
        const div = document.createElement('div');
        div.className = 'UserSearchResult';
        div.style.cssText = 'display: inline-block; width: 140px; margin: 10px; text-align: center; vertical-align: top;';

        const defaultThumb = '../assets/ui/guest.png';
        const thumb = thumbnailUrl || defaultThumb;

        div.innerHTML = `
            <div class="UserThumbnail" style="margin-bottom: 5px; position: relative; display: inline-block;">
                <a href="#profile?id=${user.id}" style="cursor: pointer;">
                    <img src="${thumb}" alt="${escapeHtml(user.name)}" 
                         style="width: 100px; height: 100px; border: 1px solid #ccc;"
                         onerror="this.src='${defaultThumb}'"/>
                </a>
            </div>
            <div class="UserName" style="font-weight: bold; font-size: 12px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
                <a href="#profile?id=${user.id}">${escapeHtml(user.name)}</a>
            </div>
            <div class="UserDisplayName" style="font-size: 11px; color: #666; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">
                ${user.displayName !== user.name ? escapeHtml(user.displayName) : ''}
            </div>
        `;

        const thumbContainer = div.querySelector('.UserThumbnail');
        if (thumbContainer && window.addObcOverlayIfPremium) {
            await window.addObcOverlayIfPremium(thumbContainer, user.id, { bottom: '3px', left: '1px' });
        }

        return div;
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showLoading() {
        const initialEl = document.getElementById('SearchInitial');
        const loadingEl = document.getElementById('SearchLoading');
        const resultsEl = document.getElementById('SearchResults');
        const noResultsEl = document.getElementById('SearchNoResults');
        
        if (initialEl) initialEl.style.display = 'none';
        if (loadingEl) loadingEl.style.display = 'block';
        if (resultsEl) resultsEl.style.display = 'none';
        if (noResultsEl) noResultsEl.style.display = 'none';
    }

    function showResults() {
        const initialEl = document.getElementById('SearchInitial');
        const loadingEl = document.getElementById('SearchLoading');
        const resultsEl = document.getElementById('SearchResults');
        const noResultsEl = document.getElementById('SearchNoResults');
        const headerEl = document.getElementById('SearchResultsHeader');
        
        if (initialEl) initialEl.style.display = 'none';
        if (loadingEl) loadingEl.style.display = 'none';
        if (resultsEl) resultsEl.style.display = 'block';
        if (noResultsEl) noResultsEl.style.display = 'none';
        if (headerEl) headerEl.textContent = `Search Results for "${currentQuery}"`;
    }

    function showNoResults() {
        const initialEl = document.getElementById('SearchInitial');
        const loadingEl = document.getElementById('SearchLoading');
        const resultsEl = document.getElementById('SearchResults');
        const noResultsEl = document.getElementById('SearchNoResults');
        
        if (initialEl) initialEl.style.display = 'none';
        if (loadingEl) loadingEl.style.display = 'none';
        if (resultsEl) resultsEl.style.display = 'none';
        if (noResultsEl) noResultsEl.style.display = 'block';
    }

    function showError(message) {
        
        if (window.showErrorPage && message.includes('Failed')) {
            window.showErrorPage(message, 'people-content');
        } else {
            
            const errorDiv = document.getElementById('SearchError');
            const loadingEl = document.getElementById('SearchLoading');
            
            if (errorDiv) {
                errorDiv.textContent = message;
                errorDiv.style.display = 'block';
            }
            if (loadingEl) loadingEl.style.display = 'none';
        }
    }

    function hideError() {
        const errorDiv = document.getElementById('SearchError');
        if (errorDiv) errorDiv.style.display = 'none';
    }

    function updatePagination() {
        const pageInfo = document.getElementById('SearchPageInfo');
        const prevBtn = document.getElementById('SearchPrevPage');
        const nextBtn = document.getElementById('SearchNextPage');

        if (pageInfo) pageInfo.textContent = `Page ${currentPage}`;
        if (prevBtn) prevBtn.style.visibility = currentPage > 1 ? 'visible' : 'hidden';
        if (nextBtn) nextBtn.style.visibility = totalResults >= RESULTS_PER_PAGE ? 'visible' : 'hidden';
    }

    function prevPage(e) {
        e.preventDefault();
        if (currentPage > 1) {
            currentPage--;
            searchUsers(currentQuery, currentPage);
        }
    }

    function nextPage(e) {
        e.preventDefault();
        currentPage++;
        searchUsers(currentQuery, currentPage);
    }
})();
