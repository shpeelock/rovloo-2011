
(function() {
    'use strict';

    const PAGE_ID = 'reviews';

    let currentTab = 'reviews'; 
    let searchQuery = '';
    let filterOption = 'all';
    let sortOption = 'quality';
    let currentUserId = null;

    function handlePageChange(e) {
        if (e.detail.page === PAGE_ID) {
            loadReviewsPage();
        }
    }

    document.addEventListener('pageChange', handlePageChange);

    window.addEventListener('hashchange', handleHashChange);

    setTimeout(() => {
        if (window.location.hash.startsWith('#' + PAGE_ID)) {
            handleHashChange();
        }
    }, 100);

    function handleHashChange() {
        const hash = window.location.hash;
        if (hash.startsWith('#' + PAGE_ID)) {
            if (typeof navigateTo === 'function') {
                navigateTo(PAGE_ID);
            }
        }
    }

    async function loadReviewsPage() {
        const container = document.getElementById('reviews-content');
        if (!container) {
            console.error('Reviews container not found');
            return;
        }

        currentTab = 'reviews';
        searchQuery = '';
        filterOption = 'all';
        sortOption = 'quality';

        try {
            const user = await window.roblox.getCurrentUser();
            currentUserId = user?.id || null;
        } catch (e) {
            currentUserId = null;
        }

        container.innerHTML = `
            <div style="text-align: center; padding: 60px;">
                <img src="images/spinners/spinner100x100.gif" alt="Loading..."/>
                <p style="margin-top: 20px; color: #666;">Loading reviews...</p>
            </div>
        `;

        try {
            
            const response = await fetch('pages/reviews.html');
            if (!response.ok) throw new Error('Failed to load reviews template');
            const html = await response.text();
            container.innerHTML = html;

            setupTabs();

            setupControls();

            await initializeReviewComponent();

        } catch (error) {
            console.error('Failed to load reviews page:', error);
            container.innerHTML = `
                <div style="text-align: center; padding: 60px; color: #cc0000;">
                    <p>Failed to load reviews.</p>
                    <p style="font-size: 12px; color: #666;">${error.message}</p>
                </div>
            `;
        }
    }

    function setupTabs() {
        const reviewsTab = document.getElementById('ReviewsTab');
        const myReviewsTab = document.getElementById('MyReviewsTab');
        const adminPicksTab = document.getElementById('AdminPicksTab');
        const reviewsContent = document.getElementById('ReviewsContent');
        const myReviewsContent = document.getElementById('MyReviewsContent');
        const adminPicksContent = document.getElementById('AdminPicksContent');

        if (!currentUserId && myReviewsTab) {
            myReviewsTab.style.display = 'none';
        }

        reviewsTab?.addEventListener('click', () => {
            currentTab = 'reviews';
            reviewsTab.className = 'StandardTabGrayActive';
            myReviewsTab.className = 'StandardTabGray';
            adminPicksTab.className = 'StandardTabGray';
            reviewsContent.style.display = 'block';
            myReviewsContent.style.display = 'none';
            adminPicksContent.style.display = 'none';
            
            initializeReviewComponent();
        });

        myReviewsTab?.addEventListener('click', () => {
            if (!currentUserId) {
                alert('Please log in to view your reviews.');
                return;
            }
            currentTab = 'my-reviews';
            myReviewsTab.className = 'StandardTabGrayActive';
            reviewsTab.className = 'StandardTabGray';
            adminPicksTab.className = 'StandardTabGray';
            myReviewsContent.style.display = 'block';
            reviewsContent.style.display = 'none';
            adminPicksContent.style.display = 'none';
            
            initializeReviewComponent();
        });

        adminPicksTab?.addEventListener('click', () => {
            currentTab = 'admin-picks';
            adminPicksTab.className = 'StandardTabGrayActive';
            reviewsTab.className = 'StandardTabGray';
            myReviewsTab.className = 'StandardTabGray';
            adminPicksContent.style.display = 'block';
            reviewsContent.style.display = 'none';
            myReviewsContent.style.display = 'none';
            
            initializeReviewComponent();
        });
    }

    function setupControls() {
        const searchInput = document.getElementById('reviewSearchInput');
        const searchBtn = document.getElementById('reviewSearchBtn');
        const filterSelect = document.getElementById('browseReviewFilter');
        const sortSelect = document.getElementById('browseReviewSort');

        searchBtn?.addEventListener('click', () => {
            searchQuery = searchInput?.value || '';
            initializeReviewComponent();
        });

        searchInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchQuery = searchInput.value || '';
                initializeReviewComponent();
            }
        });

        filterSelect?.addEventListener('change', (e) => {
            filterOption = e.target.value;
            initializeReviewComponent();
        });

        sortSelect?.addEventListener('change', (e) => {
            sortOption = e.target.value;
            initializeReviewComponent();
        });
    }

    const CLIENT_SIDE_SORT_OPTIONS = [
        'quality',        
        'underrated',     
        'trending',       
        'hidden_gems',    
        'highest-voted',  
        'lowest-voted',   
        'most-replies',   
        'least-replies',  
        'most-playtime',  
        'least-playtime', 
        'highest-rated-user', 
        'lowest-rated-user',  
        'oldest',         
        'highest_rated',  
        'lowest_rated',   
        'game',           
        'most_visits',    
        'least_visits'    
    ];

    function requiresClientSideSort(sort) {
        return CLIENT_SIDE_SORT_OPTIONS.includes(sort);
    }

    async function initializeReviewComponent() {
        
        if (window.ReviewComponent) {
            window.ReviewComponent.destroy();
        }

        let containerId;
        if (currentTab === 'admin-picks') {
            containerId = 'adminPicksList';
        } else if (currentTab === 'my-reviews') {
            containerId = 'myReviewsList';
        } else {
            containerId = 'browseReviewsList';
        }

        await window.ReviewComponent.init('browse', containerId, {
            browseMode: true,
            adminPicksMode: currentTab === 'admin-picks',
            myReviewsMode: currentTab === 'my-reviews',
            myReviewsUserId: currentTab === 'my-reviews' ? currentUserId : null,
            searchQuery: currentTab === 'reviews' ? searchQuery : '',
            filterOption: currentTab === 'reviews' ? filterOption : 'all',
            sortOption: currentTab === 'my-reviews' ? 'recent' : sortOption,
            clientSideSort: currentTab === 'reviews' && requiresClientSideSort(sortOption)
        });

        if (currentTab === 'reviews') {
            updateReviewsTabCount();
        }
    }

    async function updateReviewsTabCount() {
        try {
            
            const allReviews = await window.roblox.reviews.getAllReviews({ limit: 1 });
            const totalCount = allReviews.totalReviews || 0;
            
            const countEl = document.getElementById('totalReviewsCount');
            if (countEl) {
                countEl.textContent = totalCount.toLocaleString();
            }
        } catch (e) {
            console.warn('Failed to get total review count:', e);
        }
    }

    window.BrowseReviewsPage = {
        load: loadReviewsPage,
        refresh: initializeReviewComponent
    };

})();
