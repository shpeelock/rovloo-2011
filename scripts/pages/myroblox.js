(function () {
    'use strict';

    document.addEventListener('pageChange', function (e) {
        if (e.detail && e.detail.page === 'myroblox') {
            loadMyRobloxPage();
        }
    });

    async function loadMyRobloxPage() {
        try {

            const isLoggedIn = await window.RobloxClient.auth.isLoggedIn();
            if (!isLoggedIn) {

                navigateTo('home');
                return;
            }

            const user = await window.RobloxClient.api.getCurrentUser();
            if (!user) {
                navigateTo('home');
                return;
            }

            const greetingEl = document.getElementById('myroblox-greeting');
            if (greetingEl) {
                greetingEl.textContent = `Hi, ${user.displayName || user.name}`;
            }

            loadMyAvatar(user.id);

            loadMyStats(user.id);

            loadNotificationsCount();

            loadRecommendedGames();

            loadMyFeed();

        } catch (error) {
            console.error('Failed to load My ROBLOX page:', error);
            if (window.showErrorPage) {
                window.showErrorPage('Failed to load My ROBLOX page: ' + error.message, 'myroblox-content');
            }
        }
    }

    async function loadMyAvatar(userId) {
        const avatarContainer = document.getElementById('myroblox-avatar');
        if (!avatarContainer) return;

        try {

            const thumbnails = await window.roblox.getUserThumbnails([userId], '352x352', 'AvatarThumbnail');
            if (thumbnails?.data && thumbnails.data[0]?.imageUrl) {
                avatarContainer.innerHTML = `<img src="${thumbnails.data[0].imageUrl}" alt="Avatar" style="width: 100%; height: 100%; margin-top: -15px; object-fit: contain;"/>`;
            }

            if (window.addObcOverlayIfPremium) {
                await window.addObcOverlayIfPremium(avatarContainer, userId, { bottom: '23px', left: '30px' });
            }
        } catch (e) {
            console.error('Failed to load avatar:', e);
        }
    }

    async function loadMyStats(userId) {
        try {

            const friendsCount = await window.roblox.getFriendsCount(userId).catch(() => ({ count: 0 }));
            const friendsEl = document.getElementById('myroblox-friends-count');
            if (friendsEl) {
                friendsEl.textContent = friendsCount.count || 0;
            }

            const messagesEl = document.getElementById('myroblox-messages-count');
            if (messagesEl) {
                try {
                    const unreadCount = await window.roblox.getUnreadMessagesCount();
                    messagesEl.textContent = unreadCount.count || 0;
                } catch (e) {
                    messagesEl.textContent = '0';
                }
            }

            const robuxEl = document.getElementById('myroblox-robux-count');
            if (robuxEl) {
                try {
                    const currency = await window.roblox.getUserCurrency(userId);
                    robuxEl.textContent = (currency.robux || 0).toLocaleString();
                } catch (e) {
                    robuxEl.textContent = '0';
                }
            }

            const rovlooScoreEl = document.getElementById('myroblox-rovloo-score');
            if (rovlooScoreEl) {
                try {
                    const rating = await window.roblox.reviews.getUserRating(userId);
                    const score = rating?.totalScore || 0;
                    const scoreText = score >= 0 ? `+${score}` : score.toString();
                    rovlooScoreEl.textContent = scoreText;
                    rovlooScoreEl.title = `Rovloo Score: ${scoreText} (${rating?.reviewCount || 0} reviews)`;
                } catch (e) {
                    rovlooScoreEl.textContent = '0';
                }
            }

        } catch (e) {
            console.error('Failed to load stats:', e);
        }
    }

    const RECOMMENDED_GAMES_CACHE_KEY = 'rovloo_recommended_games_cache';
    const RECOMMENDED_GAMES_CACHE_TTL = 5 * 60 * 1000;
    const RECOMMENDED_GAMES_RATE_LIMIT_KEY = 'rovloo_recommended_games_ratelimit';
    let recommendedGamesRateLimited = false;
    let recommendedGamesRateLimitResetTime = 0;

    function getRecommendedGamesCache() {
        try {
            const cached = localStorage.getItem(RECOMMENDED_GAMES_CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed.timestamp && (Date.now() - parsed.timestamp < RECOMMENDED_GAMES_CACHE_TTL)) {
                    return parsed.data;
                }
            }
        } catch (e) {
            console.warn('Failed to read recommended games cache:', e);
        }
        return null;
    }

    function setRecommendedGamesCache(data) {
        try {
            localStorage.setItem(RECOMMENDED_GAMES_CACHE_KEY, JSON.stringify({
                data: data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn('Failed to save recommended games cache:', e);
        }
    }

    function loadRecommendedGamesRateLimitState() {
        try {
            const stored = localStorage.getItem(RECOMMENDED_GAMES_RATE_LIMIT_KEY);
            if (stored) {
                const state = JSON.parse(stored);
                if (state.resetTime && Date.now() < state.resetTime) {
                    recommendedGamesRateLimited = true;
                    recommendedGamesRateLimitResetTime = state.resetTime;
                } else {

                    recommendedGamesRateLimited = false;
                    recommendedGamesRateLimitResetTime = 0;
                    localStorage.removeItem(RECOMMENDED_GAMES_RATE_LIMIT_KEY);
                }
            }
        } catch (e) {
            console.warn('Failed to load rate limit state:', e);
        }
    }

    function setRecommendedGamesRateLimited(durationMs = 60000) {
        recommendedGamesRateLimited = true;
        recommendedGamesRateLimitResetTime = Date.now() + durationMs;
        try {
            localStorage.setItem(RECOMMENDED_GAMES_RATE_LIMIT_KEY, JSON.stringify({
                isLimited: true,
                resetTime: recommendedGamesRateLimitResetTime
            }));
        } catch (e) {
            console.warn('Failed to save rate limit state:', e);
        }
    }

    async function loadRecommendedGames() {
        const gamesContainer = document.getElementById('myroblox-recommended-games');
        if (!gamesContainer) return;

        loadRecommendedGamesRateLimitState();

        const cachedGames = getRecommendedGamesCache();
        if (cachedGames && cachedGames.length > 0) {
            console.log('[Recommended] Using cached games data');
            renderRecommendedGames(gamesContainer, cachedGames);
            return;
        }

        if (recommendedGamesRateLimited && Date.now() < recommendedGamesRateLimitResetTime) {
            const waitTime = Math.ceil((recommendedGamesRateLimitResetTime - Date.now()) / 1000);
            console.log(`[Recommended] Rate limited, waiting ${waitTime}s`);
            gamesContainer.innerHTML = `<div style="text-align: center; padding: 20px; color: #666;">Loading recommendations... (retry in ${waitTime}s)</div>`;
            return;
        }

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
                                .map(rec => rec.contentId)
                                .slice(0, 10);
                            universeIds.push(...sortUniverseIds);
                        }
                    }
                }
                console.log('Collected universe IDs:', universeIds.length);
            } else {
                console.error('getOmniRecommendations not available');
            }

            let rovlooGames = [];
            try {

                const rovlooSort = Math.random() > 0.5 ? 'quality' : 'highest-voted';
                const rovlooResult = await window.roblox.reviews.getAllReviews({
                    sort: rovlooSort,
                    limit: 20,
                    page: 1
                });

                const rovlooReviews = rovlooResult?.reviews || rovlooResult || [];
                console.log('[Recommended] Fetched', rovlooReviews.length, 'Rovloo reviews with sort:', rovlooSort);

                const seenGameIds = new Set();
                let blacklistedCount = 0;
                for (const review of rovlooReviews) {

                    if (review.isBlacklisted) {
                        blacklistedCount++;
                        continue;
                    }

                    const game = review.game || review.gameData;
                    if (game?.universeId && !seenGameIds.has(game.universeId)) {
                        seenGameIds.add(game.universeId);
                        rovlooGames.push({
                            universeId: game.universeId,
                            placeId: game.id || review.gameId,
                            name: game.name,
                            playing: game.playing || 0,
                            thumbnailUrl: game.thumbnailUrl,
                            isRovloo: true
                        });
                    }
                }
                if (blacklistedCount > 0) {
                    console.log('[Recommended] Filtered out', blacklistedCount, 'blacklisted games');
                }
                console.log('[Recommended] Found', rovlooGames.length, 'unique Rovloo games');
            } catch (e) {
                console.warn('[Recommended] Failed to fetch Rovloo games:', e);
            }

            const uniqueUniverseIds = [...new Set(universeIds)];

            const rovlooUniverseIds = new Set(rovlooGames.map(g => g.universeId));
            const filteredRobloxIds = uniqueUniverseIds.filter(id => !rovlooUniverseIds.has(id));

            const shuffledRoblox = filteredRobloxIds.sort(() => Math.random() - 0.5).slice(0, 3);

            const shuffledRovloo = rovlooGames.sort(() => Math.random() - 0.5).slice(0, Math.min(2, rovlooGames.length));

            const targetCount = 4;
            let finalRobloxCount = Math.min(shuffledRoblox.length, targetCount - shuffledRovloo.length);
            let finalRovlooCount = Math.min(shuffledRovloo.length, targetCount - finalRobloxCount);

            if (shuffledRovloo.length > 0 && finalRovlooCount === 0) {
                finalRovlooCount = 1;
                finalRobloxCount = Math.min(finalRobloxCount, targetCount - 1);
            }

            const selectedRobloxIds = shuffledRoblox.slice(0, finalRobloxCount);
            const selectedRovlooGames = shuffledRovloo.slice(0, finalRovlooCount);

            console.log('[Recommended] Selected', selectedRobloxIds.length, 'Roblox games and', selectedRovlooGames.length, 'Rovloo games');

            if (selectedRobloxIds.length === 0 && selectedRovlooGames.length === 0) {
                gamesContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">No recommended games available.</div>';
                return;
            }

            let robloxGamesData = [];
            if (selectedRobloxIds.length > 0 && window.roblox?.getGamesProductInfo) {
                try {
                    const gamesInfo = await window.roblox.getGamesProductInfo(selectedRobloxIds);
                    if (gamesInfo?.data) {
                        robloxGamesData = gamesInfo.data;
                    }
                } catch (e) {

                    if (e.message?.includes('429') || e.message?.toLowerCase().includes('rate limit')) {
                        console.warn('[Recommended] Rate limited on getGamesProductInfo');
                        setRecommendedGamesRateLimited(60000);
                        gamesContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Too many requests. Please wait a moment...</div>';
                        return;
                    }
                    console.warn('Failed to fetch game details:', e);
                }
            }

            const allUniverseIds = [
                ...robloxGamesData.map(g => g.id),
                ...selectedRovlooGames.map(g => g.universeId)
            ].filter(Boolean);

            let thumbnailMap = {};

            if (allUniverseIds.length > 0 && window.roblox?.getUniverseThumbnails) {
                try {
                    const thumbResult = await window.roblox.getUniverseThumbnails(allUniverseIds, '256x144');
                    console.log('Thumbnail result:', thumbResult);
                    if (thumbResult?.data) {

                        thumbResult.data.forEach(item => {
                            if (item.thumbnails && item.thumbnails.length > 0) {
                                const thumb = item.thumbnails[0];
                                if (thumb.imageUrl && item.universeId) {
                                    thumbnailMap[item.universeId] = thumb.imageUrl;
                                }
                            }
                        });
                    }
                    console.log('Thumbnail map:', thumbnailMap);
                } catch (e) {

                    if (e.message?.includes('429') || e.message?.toLowerCase().includes('rate limit')) {
                        console.warn('[Recommended] Rate limited on getUniverseThumbnails');
                        setRecommendedGamesRateLimited(60000);
                    }
                    console.warn('Failed to fetch game thumbnails:', e);
                }
            }

            const processedRobloxGames = robloxGamesData.map(game => ({
                id: game.id,
                rootPlaceId: game.rootPlaceId,
                name: game.name,
                playing: game.playing,
                thumbnail: thumbnailMap[game.id] || null,
                isRovloo: false
            }));

            const processedRovlooGames = selectedRovlooGames.map(game => ({
                id: game.universeId,
                rootPlaceId: game.placeId,
                name: game.name,
                playing: game.playing,
                thumbnail: thumbnailMap[game.universeId] || game.thumbnailUrl || null,
                isRovloo: true
            }));

            const allGames = [...processedRobloxGames, ...processedRovlooGames];
            const shuffledFinal = allGames.sort(() => Math.random() - 0.5);

            setRecommendedGamesCache(shuffledFinal);

            renderRecommendedGames(gamesContainer, shuffledFinal);

        } catch (error) {
            console.error('Failed to load recommended games:', error);

            if (error.message?.includes('429') || error.message?.toLowerCase().includes('rate limit')) {
                setRecommendedGamesRateLimited(60000);
                gamesContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Too many requests. Please wait a moment...</div>';
                return;
            }

            gamesContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #c00;">Failed to load recommended games.</div>';
        }
    }

    function renderRecommendedGames(container, gamesData) {
        if (!container || !gamesData || gamesData.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">No recommended games available.</div>';
            return;
        }

        let html = '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">';

        for (const game of gamesData) {
            const placeId = game.rootPlaceId;
            const universeId = game.id;
            const name = game.name || 'Untitled Game';
            const playerCount = game.playing || 0;
            const thumbnail = game.thumbnail || 'images/spinners/spinner100x100.gif';
            const isRovloo = game.isRovloo || false;

            const rovlooBadge = isRovloo
                ? '<img src="images/rovloo/rovloo-ico64.png" alt="Rovloo" title="Recommended by Rovloo community" style="width:14px;height:14px;vertical-align:middle;margin-left:4px;"/>'
                : '';

            html += `
                <a href="#game-detail?id=${placeId}&universe=${universeId}" style="text-decoration: none; display: block; text-align: center; background: #fff; padding: 8px; border: 1px solid #ccc; border-radius: 4px; overflow: hidden; position: relative;">
                    <img src="${thumbnail}" alt="${escapeHtml(name)}" style="width: 100%; max-width: 256px; height: auto; aspect-ratio: 16/9; object-fit: cover; border-radius: 3px; margin-bottom: 5px; display: block; margin-left: auto; margin-right: auto;"/>
                    <div style="font-size: 11px; font-weight: bold; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;" title="${escapeHtml(name)}">${escapeHtml(name)}${rovlooBadge}</div>
                    <div style="font-size: 10px; color: #666; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">
                        <img src="assets/ui/online.png" alt="Playing" style="width:8px;height:8px;vertical-align:middle;margin-right:2px;"/> ${playerCount.toLocaleString()} playing
                    </div>
                </a>
            `;
        }

        html += '</div>';
        container.innerHTML = html;
    }

    async function getGroupShoutNotifications() {
        try {

            const shouts = await window.roblox.groupShouts.getRecent();

            return shouts
                .filter(shout => shout.isNew || !shout.interacted)
                .slice(0, 10)
                .map(shout => ({
                    type: 'groupShout',
                    groupId: shout.groupId,
                    groupName: shout.groupName,
                    shoutBody: shout.body,
                    shoutPoster: shout.poster?.username || 'Unknown',
                    shoutDate: shout.updated,
                    isNew: shout.isNew
                }));
        } catch (e) {
            console.warn('[MyFeed] Failed to get group shouts from service:', e);
            return [];
        }
    }

    function getRovlooNotificationIcon(type) {
        const icons = {

            'content_deleted': '🗑️',
            'banned': '🔨',
            'unbanned': '✅',
            'warning': '⚠️',
            'report_resolved': '✓',
            'report_dismissed': '✗',

            'reply': '💬',
            'upvote': '⬆️',
            'upvote_milestone': '👍',
            'review_featured': '⭐',

            'system_update': '🔔',
            'announcement': '📢',
            'maintenance': '🔧'
        };
        return icons[type] || '📬';
    }

    async function loadMyFeed() {
        const feedEl = document.getElementById('myroblox-feed');
        if (!feedEl) return;

        try {

            const groupShoutPromise = getGroupShoutNotifications();

            const notifications = await window.roblox.getRecentNotifications();

            let rovlooNotifications = [];
            try {
                const rovlooResult = await window.roblox.reviews.getNotifications({ includeRead: false, limit: 20 });
                rovlooNotifications = rovlooResult?.notifications || [];
                console.log('[MyFeed] Loaded', rovlooNotifications.length, 'Rovloo notifications');
            } catch (e) {

                console.log('[MyFeed] Could not load Rovloo notifications:', e.message);
            }

            const groupShoutNotifications = await groupShoutPromise;

            let groupThumbnailMap = {};
            if (groupShoutNotifications.length > 0) {
                const groupIds = groupShoutNotifications.map(n => n.groupId);
                try {
                    const groupThumbs = await window.roblox.getGroupThumbnails(groupIds, '150x150');
                    if (groupThumbs?.data) {
                        groupThumbs.data.forEach(t => {
                            if (t.targetId && t.imageUrl) {
                                groupThumbnailMap[t.targetId] = t.imageUrl;
                            }
                        });
                    }
                } catch (e) {
                    console.warn('Failed to fetch group thumbnails:', e);
                }
            }

            let feedHtml = '<div style="text-align: left; color: #333;">';
            let hasContent = false;

            const allFeedItems = [];

            for (const shoutNotif of groupShoutNotifications) {
                allFeedItems.push({
                    type: 'groupShout',
                    timestamp: shoutNotif.shoutDate ? new Date(shoutNotif.shoutDate).getTime() : Date.now(),
                    data: shoutNotif,
                    thumbnail: groupThumbnailMap[shoutNotif.groupId] || 'images/spinners/spinner100x100.gif'
                });
            }

            for (const rovlooNotif of rovlooNotifications) {
                allFeedItems.push({
                    type: 'rovloo',
                    timestamp: rovlooNotif.timestamp || Date.now(),
                    data: rovlooNotif
                });
            }

            if (notifications && notifications.length > 0) {

                const userIds = [];
                for (const notification of notifications) {
                    try {
                        const thumbnail = notification.content?.states?.default?.visualItems?.thumbnail;
                        if (thumbnail && thumbnail[0]?.idType === 'userThumbnail' && thumbnail[0]?.id) {
                            userIds.push(parseInt(thumbnail[0].id));
                        }
                    } catch (e) {

                    }
                }

                let thumbnailMap = {};
                if (userIds.length > 0) {
                    try {
                        const thumbnails = await window.roblox.getUserThumbnails(userIds, '48x48', 'AvatarHeadShot');
                        if (thumbnails?.data) {
                            thumbnails.data.forEach(t => {
                                if (t.targetId && t.imageUrl) {
                                    thumbnailMap[t.targetId] = t.imageUrl;
                                }
                            });
                        }
                    } catch (e) {
                        console.warn('Failed to fetch notification thumbnails:', e);
                    }
                }

                for (const notification of notifications) {
                    allFeedItems.push({
                        type: 'roblox',
                        timestamp: notification.eventDate ? new Date(notification.eventDate).getTime() : Date.now(),
                        data: notification,
                        thumbnailMap: thumbnailMap
                    });
                }
            }

            allFeedItems.sort((a, b) => b.timestamp - a.timestamp);

            for (const item of allFeedItems) {
                hasContent = true;

                if (item.type === 'groupShout') {
                    const shoutNotif = item.data;
                    const groupThumb = item.thumbnail;
                    const date = shoutNotif.shoutDate
                        ? new Date(shoutNotif.shoutDate).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                        })
                        : '';

                    feedHtml += `
                        <div style="padding: 8px 0; border-bottom: 1px solid #eee; display: flex; align-items: flex-start; background: #fffef0;">
                            <img src="${groupThumb}" alt="${escapeHtml(shoutNotif.groupName)}" style="width: 48px; height: 48px; object-fit: cover; border: 1px solid #ccc; margin-right: 10px; flex-shrink: 0; cursor: pointer;" onclick="navigateTo('groups', { groupId: ${shoutNotif.groupId} })"/>
                            <div style="flex: 1;">
                                <div style="font-size: 12px; color: #666;">
                                    <a href="#" onclick="navigateTo('groups', { groupId: ${shoutNotif.groupId} }); return false;" style="color: #00f; font-weight: bold;">${escapeHtml(shoutNotif.groupName)}</a>
                                    posted a new shout:
                                </div>
                                <div style="font-size: 13px; margin-top: 4px; font-style: italic;">"${escapeHtml(shoutNotif.shoutBody)}"</div>
                                <div style="font-size: 11px; color: #666; margin-top: 2px;">- ${escapeHtml(shoutNotif.shoutPoster)} • ${date}</div>
                            </div>
                        </div>
                    `;
                } else if (item.type === 'rovloo') {
                    const rovlooNotif = item.data;
                    const date = rovlooNotif.timestamp
                        ? new Date(rovlooNotif.timestamp).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                        })
                        : '';

                    const icon = rovlooNotif.icon || getRovlooNotificationIcon(rovlooNotif.type);

                    let linkHtml = escapeHtml(rovlooNotif.message);
                    if (rovlooNotif.data?.gameId) {

                        linkHtml = `<a href="#game-detail?id=${rovlooNotif.data.gameId}" style="color: #00f;">${escapeHtml(rovlooNotif.message)}</a>`;
                    } else if (rovlooNotif.data?.reviewId) {

                        linkHtml = `<a href="#reviews" style="color: #00f;">${escapeHtml(rovlooNotif.message)}</a>`;
                    }

                    const notifId = rovlooNotif.id;
                    const readClass = rovlooNotif.read ? '' : 'background: #f0f8ff;';

                    feedHtml += `
                        <div style="padding: 8px 0; border-bottom: 1px solid #eee; display: flex; align-items: flex-start; ${readClass}" data-rovloo-notif-id="${notifId}">
                            <div style="width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; margin-right: 10px; flex-shrink: 0;">
                                <img src="images/rovloo/rovloo-ico64.png" alt="Rovloo" style="width: 32px; height: 32px;" title="Rovloo Notification"/>
                            </div>
                            <div style="flex: 1;">
                                <div style="font-size: 12px; color: #666;">
                                    <span style="font-size: 14px; margin-right: 4px;">${icon}</span>
                                    <span style="color: #666; font-weight: bold;">Rovloo</span>
                                </div>
                                <div style="font-size: 13px; margin-top: 4px;">${linkHtml}</div>
                                <div style="font-size: 11px; color: #666; margin-top: 2px;">${date}</div>
                            </div>
                        </div>
                    `;
                } else if (item.type === 'roblox') {
                    const notification = item.data;
                    const thumbnailMap = item.thumbnailMap || {};

                    const date = notification.eventDate
                        ? new Date(notification.eventDate).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                        })
                        : '';

                    let avatarHtml = '';
                    try {
                        const thumbnail = notification.content?.states?.default?.visualItems?.thumbnail;
                        if (thumbnail && thumbnail[0]?.idType === 'userThumbnail' && thumbnail[0]?.id) {
                            const userId = thumbnail[0].id;
                            const avatarUrl = thumbnailMap[userId];
                            if (avatarUrl) {
                                avatarHtml = `<img src="${avatarUrl}" alt="" style="width: 48px; height: 48px; object-fit: cover; border: 1px solid #ccc; margin-right: 10px; flex-shrink: 0;"/>`;
                            }
                        }
                    } catch (e) {

                    }

                    let message = '';
                    try {
                        const textBody = notification.content?.states?.default?.visualItems?.textBody;
                        if (textBody && textBody[0]?.label?.text) {
                            message = textBody[0].label.text;

                            message = message.replace(/Connection request/gi, 'Friend request');
                        }
                    } catch (e) {

                    }

                    if (!message) {
                        const notifType = notification.content?.notificationType || notification.notificationSourceType || '';
                        message = notifType || 'New notification';
                    }

                    feedHtml += `
                        <div style="padding: 8px 0; border-bottom: 1px solid #eee; display: flex; align-items: flex-start;">
                            ${avatarHtml}
                            <div style="flex: 1;">
                                <div style="font-size: 13px;">${message}</div>
                                <div style="font-size: 11px; color: #666; margin-top: 2px;">${date}</div>
                            </div>
                        </div>
                    `;
                }
            }

            if (hasContent) {
                feedHtml += '</div>';
                feedEl.innerHTML = feedHtml;
            } else {
                feedEl.innerHTML = `
                    <div style="text-align: left; color: #333;">
                        <p style="color: #666; font-style: italic;">Your feed is empty. Play some games or add friends to see activity here!</p>
                    </div>
                `;
            }
        } catch (e) {
            console.error('Failed to load feed:', e);
            feedEl.innerHTML = `
                <div style="text-align: left; color: #333;">
                    <p style="color: #666; font-style: italic;">Your feed is empty. Play some games or add friends to see activity here!</p>
                </div>
            `;
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async function loadNotificationsCount() {
        const notificationsEl = document.getElementById('myroblox-notifications-count');
        if (!notificationsEl) return;

        try {
            const result = await window.roblox.getUnreadNotificationsCount();
            notificationsEl.textContent = result.unreadNotifications || 0;
        } catch (e) {
            console.warn('Failed to load notifications count:', e);
            notificationsEl.textContent = '0';
        }
    }

    function resetMyRobloxPage() {

        const containers = [
            'myroblox-avatar',
            'myroblox-feed',
            'recommended-games-list'
        ];

        containers.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '';
        });
    }

    window.MyRobloxPage = {
        load: loadMyRobloxPage,
        reset: resetMyRobloxPage
    };

})();
