

(function() {
    'use strict';

    let currentUserId = null;
    let allFriends = [];
    let currentPage = 1;
    let isLoading = false; 
    const friendsPerPage = 30; 
    const isStandalone = window.location.pathname.includes('friends.html');
    const assetPath = isStandalone ? '../images/' : 'images/';
    const uiPath = isStandalone ? '../assets/ui/' : 'assets/ui/';

    document.addEventListener('DOMContentLoaded', function() {
        const isStandalonePage = window.location.pathname.includes('friends.html');
        if (isStandalonePage && document.getElementById('FriendsLoading')) {
            init();
        }
    });

    document.addEventListener('pageChange', function(e) {
        if (e.detail && e.detail.page === 'friends') {
            console.log('Friends page activated via SPA');
        }
    });

    window.FriendsPage = {
        load: loadFriendsFromHash
    };

    function init() {
        console.log('Friends page initialized');
        loadFriendsFromHash();
    }

    function loadFriendsFromHash() {
        const userId = getUserIdFromHash();
        if (userId) {
            currentUserId = userId;
            loadFriends(userId);
        } else {
            showError('No user ID specified.');
        }
    }

    function getUserIdFromHash() {
        const hash = window.location.hash;
        if (hash.includes('?id=')) {
            const params = new URLSearchParams(hash.split('?')[1]);
            return params.get('id');
        }
        const match = hash.match(/friends\/(\d+)/);
        if (match) return match[1];
        return null;
    }

    async function loadFriends(userId) {
        if (!document.getElementById('FriendsLoading')) return;

        if (isLoading) return;
        isLoading = true;

        showLoading();

        try {
            
            const [userInfo, friendsResult] = await Promise.all([
                window.roblox.getUserInfo(userId),
                window.roblox.getFriends(userId)
            ]);

            if (!userInfo) throw new Error('User not found');

            document.title = `${userInfo.displayName || userInfo.name}'s Friends - ROBLOX`;
            const headerEl = document.getElementById('FriendsPageHeader');
            if (headerEl) headerEl.textContent = `${userInfo.displayName || userInfo.name}'s Friends`;

            allFriends = friendsResult.data || [];

            renderPage(1);
            showContent();
        } catch (error) {
            console.error('Failed to load friends:', error);
            showError('Failed to load friends list.');
        } finally {
            isLoading = false;
        }
    }

    function renderPage(page) {
        currentPage = page;
        const container = document.getElementById('FriendsTable');
        const noFriendsEl = document.getElementById('NoFriendsMessage');
        
        if (!container) return;
        container.innerHTML = '';

        if (allFriends.length === 0) {
            if (noFriendsEl) noFriendsEl.style.display = 'block';
            updatePagers(0);
            return;
        }

        if (noFriendsEl) noFriendsEl.style.display = 'none';

        const totalPages = Math.ceil(allFriends.length / friendsPerPage);
        const startIndex = (page - 1) * friendsPerPage;
        const pagedFriends = allFriends.slice(startIndex, startIndex + friendsPerPage);

        renderFriendsGrid(pagedFriends);
        updatePagers(totalPages);
    }

    async function renderFriendsGrid(friends) {
        const container = document.getElementById('FriendsTable');
        if (!container) return;

        container.innerHTML = '';
        
        const friendIds = friends.map(f => f.id);

        renderSkeletonGrid(container, friends.length);

        const [userDetailsResult, thumbnailsResult, presenceResult] = await Promise.all([
            window.roblox.getUsersByIds(friendIds).catch(() => ({ data: [] })),
            window.roblox.getUserThumbnails(friendIds, '100x100', 'AvatarBust').catch(() => ({ data: [] })),
            window.roblox.getUserPresence(friendIds).catch(() => ({ userPresences: [] }))
        ]);

        const userDetails = {};
        if (userDetailsResult?.data) userDetailsResult.data.forEach(u => userDetails[u.id] = u);

        const thumbnails = {};
        if (thumbnailsResult?.data) thumbnailsResult.data.forEach(t => thumbnails[t.targetId] = t.imageUrl);

        const presenceMap = {};
        if (presenceResult?.userPresences) presenceResult.userPresences.forEach(p => presenceMap[p.userId] = p);

        const PREMIUM_CACHE_TTL = 24 * 60 * 60 * 1000;
        const cachedPremiumStatus = {};
        const uncachedFriendIds = [];
        
        if (window.premiumStatusCache) {
            friends.forEach(friend => {
                const cached = window.premiumStatusCache.get(String(friend.id));
                if (cached && cached.value !== null && (Date.now() - cached.timestamp < PREMIUM_CACHE_TTL)) {
                    cachedPremiumStatus[friend.id] = cached.value;
                } else {
                    uncachedFriendIds.push(friend.id);
                }
            });
        }

        container.innerHTML = '';

        const uncachedContainers = {};

        let currentRow = null;
        friends.forEach((friend, index) => {
            if (index % 6 === 0) {
                currentRow = document.createElement('tr');
                container.appendChild(currentRow);
            }

            const name = userDetails[friend.id]?.name || userDetails[friend.id]?.displayName || friend.name || 'Unknown';
            const thumb = thumbnails[friend.id] || `${uiPath}guest.png`;
            const presence = presenceMap[friend.id];
            const isOnline = presence && presence.userPresenceType > 0;
            const statusIcon = isOnline ? `${assetPath}online.png` : `${assetPath}offline.png`;
            
            let statusText = isOnline ? `${name} is online` : `${name} is offline`;
            if (presence?.lastLocation) statusText += ` at ${presence.lastLocation}`;

            const td = document.createElement('td');
            td.style.cssText = 'padding: 10px; text-align: center; vertical-align: top; width: 16.66%;';
            td.innerHTML = `
                <div class="Friend">
                    <div class="Avatar" style="position: relative; display: inline-block; width: 100px; height: 100px;">
                        <a href="#profile?id=${friend.id}" title="${escapeHtml(name)}" style="display:inline-block;height:100px;width:100px;cursor:pointer;">
                            <img src="${thumb}" border="0" alt="${escapeHtml(name)}" style="width:100px;height:100px;object-fit:cover;" onerror="this.src='${uiPath}guest.png'"/>
                        </a>
                    </div>
                    <div class="Summary">
                        <span class="OnlineStatus"><img src="${statusIcon}" alt="${escapeHtml(statusText)}" title="${escapeHtml(statusText)}" style="border-width:0px; vertical-align:middle; margin-right:2px;"/></span>
                        <span class="Name"><a href="#profile?id=${friend.id}" style="color:#00F;">${escapeHtml(name)}</a></span>
                    </div>
                </div>
            `;
            currentRow.appendChild(td);
            
            const avatarContainer = td.querySelector('.Avatar');

            if (cachedPremiumStatus[friend.id] === true && avatarContainer) {
                addObcOverlay(avatarContainer, friend.id);
            } else if (uncachedFriendIds.includes(friend.id) && avatarContainer) {
                uncachedContainers[friend.id] = avatarContainer;
            }
        });

        if (window.addObcOverlayIfPremium && uncachedFriendIds.length > 0) {
            
            const sortedUncached = uncachedFriendIds.sort((a, b) => {
                const aOnline = presenceMap[a]?.userPresenceType > 0 ? 1 : 0;
                const bOnline = presenceMap[b]?.userPresenceType > 0 ? 1 : 0;
                return bOnline - aOnline;
            });

            const MAX_PREMIUM_CHECKS = 6;
            const friendsToCheck = sortedUncached.slice(0, MAX_PREMIUM_CHECKS);

            const rateLimitResetIn = window.getPremiumRateLimitResetIn ? window.getPremiumRateLimitResetIn() : 0;
            if (rateLimitResetIn > 30000) {
                
                console.log(`Skipping premium checks - rate limited for ${Math.ceil(rateLimitResetIn/1000)}s`);
                return;
            }

            friendsToCheck.forEach((friendId, index) => {
                const container = uncachedContainers[friendId];
                if (container && document.body.contains(container)) {
                    
                    setTimeout(() => {
                        if (document.body.contains(container)) {
                            window.addObcOverlayIfPremium(container, friendId);
                        }
                    }, index * 2000);
                }
            });
        }
    }

    function renderSkeletonGrid(container, count) {
        container.innerHTML = '';
        let currentRow = null;
        
        for (let i = 0; i < count; i++) {
            if (i % 6 === 0) {
                currentRow = document.createElement('tr');
                container.appendChild(currentRow);
            }
            
            const td = document.createElement('td');
            td.style.cssText = 'padding: 10px; text-align: center; vertical-align: top; width: 16.66%;';
            td.innerHTML = `
                <div class="Friend skeleton-friend">
                    <div class="Avatar" style="position: relative; display: inline-block; width: 100px; height: 100px; background: #e0e0e0; animation: skeleton-pulse 1.5s ease-in-out infinite;">
                    </div>
                    <div class="Summary" style="margin-top: 5px;">
                        <span style="display: inline-block; width: 60px; height: 12px; background: #e0e0e0; animation: skeleton-pulse 1.5s ease-in-out infinite;"></span>
                    </div>
                </div>
            `;
            currentRow.appendChild(td);
        }
    }

    function addObcOverlay(container, userId) {
        if (!container) return;

        const existing = container.querySelector('.obc-overlay');
        if (existing) existing.remove();

        const bcType = window.isRandomizeBCEnabled && window.isRandomizeBCEnabled() 
            ? window.getBCTypeForUser(userId) 
            : 'OBC';
        const overlayImage = window.getBCOverlayImage 
            ? window.getBCOverlayImage(bcType) 
            : (isStandalone ? '../images/icons/overlay_obcOnly.png' : 'images/icons/overlay_obcOnly.png');

        let finalImage = overlayImage;
        if (isStandalone && !overlayImage.startsWith('../')) {
            finalImage = '../' + overlayImage;
        }
        
        const overlay = document.createElement('img');
        overlay.src = finalImage;
        overlay.alt = bcType;
        overlay.className = 'obc-overlay';
        overlay.style.cssText = 'position: absolute; bottom: 0; left: 0; height: auto; pointer-events: none;';
        container.appendChild(overlay);
    }

    function updatePagers(totalPages) {
        const topPager = document.getElementById('FriendsPagerTop');
        const bottomPager = document.getElementById('FriendsPagerBottom');
        
        const pagerHtml = totalPages <= 1 ? '' : `
            <div class="Pager">
                Pages: 
                ${currentPage > 1 ? `<a href="#" class="prev-page" style="color:#00F; font-weight:bold;">&lt;&lt; Previous</a>` : ''}
                ${Array.from({length: totalPages}, (_, i) => i + 1).map(p => 
                    p === currentPage ? `<span>${p}</span>` : `<a href="#" class="goto-page" data-page="${p}" style="color:#00F; margin: 0 5px;">${p}</a>`
                ).join('')}
                ${currentPage < totalPages ? `<a href="#" class="next-page" style="color:#00F; font-weight:bold;">Next &gt;&gt;</a>` : ''}
            </div>
        `;

        [topPager, bottomPager].forEach(pager => {
            if (!pager) return;
            pager.innerHTML = pagerHtml;
            
            pager.querySelectorAll('.prev-page').forEach(el => el.onclick = (e) => {
                e.preventDefault();
                renderPage(currentPage - 1);
            });
            pager.querySelectorAll('.next-page').forEach(el => el.onclick = (e) => {
                e.preventDefault();
                renderPage(currentPage + 1);
            });
            pager.querySelectorAll('.goto-page').forEach(el => el.onclick = (e) => {
                e.preventDefault();
                renderPage(parseInt(el.getAttribute('data-page')));
            });
        });
    }

    function showLoading() {
        document.getElementById('FriendsLoading').style.display = 'block';
        document.getElementById('FriendsError').style.display = 'none';
        document.getElementById('FriendsContent').style.display = 'none';
    }

    function showContent() {
        document.getElementById('FriendsLoading').style.display = 'none';
        document.getElementById('FriendsError').style.display = 'none';
        document.getElementById('FriendsContent').style.display = 'block';
    }

    function showError(message) {
        
        if (window.showErrorPage) {
            window.showErrorPage(message, 'friends-content');
        } else {
            
            document.getElementById('FriendsLoading').style.display = 'none';
            const errorEl = document.getElementById('FriendsError');
            errorEl.style.display = 'block';
            errorEl.querySelector('p').textContent = message;
            document.getElementById('FriendsContent').style.display = 'none';
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

})();
