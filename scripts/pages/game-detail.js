(function() {
    'use strict';

    let currentPlaceId = null;
    let currentUniverseId = null;
    let isLoading = false;
    let currentPlayingCount = 0;

    const PAGE_ID = 'game-detail';

    let allBadges = [];
    let allBadgeThumbnails = {};
    let userOwnedBadges = new Set();
    let currentBadgePage = 1;
    const BADGES_PER_PAGE = 5;

    let playerAvatarCache = {};

    let allPrivateServers = [];
    let currentPrivateServerPage = 1;
    const PRIVATE_SERVERS_PER_PAGE = 6;

    let allPublicServers = [];
    let currentServerPage = 1;
    const serversPerPage = 10;
    let currentServerRequestId = 0;
    let isBestConnectionProcessing = false;

    function handlePageChange(e) {
        if (e.detail.page === 'game-detail') {
            const params = e.detail.params || {};
            if (params.id || params.placeId) {
                loadGameDetailPage(params.id || params.placeId, params.universe || params.universeId, params.genre);
            }
        }
    }

    document.addEventListener('pageChange', handlePageChange);

    window.addEventListener('hashchange', handleHashChange);

    setTimeout(() => {
        if (window.location.hash.startsWith('#game-detail')) {
            handleHashChange();
        }
    }, 100);

    function handleHashChange() {
        const hash = window.location.hash;
        if (hash.startsWith('#game-detail')) {
            const params = new URLSearchParams(hash.split('?')[1] || '');
            const placeId = params.get('id') || params.get('placeId');
            const universeId = params.get('universe') || params.get('universeId');
            const genre = params.get('genre');
            if (placeId) {

                if (typeof navigateTo === 'function') {
                    navigateTo('game-detail', { id: placeId, universe: universeId, genre: genre });
                }
            }
        }
    }

    async function loadGameDetailPage(placeId, universeId = null, genre = null) {
        if (isLoading) return;

        const container = document.getElementById('game-detail-content');
        if (!container) {
            console.error('Game detail container not found');
            return;
        }

        isLoading = true;
        currentPlaceId = placeId;

        if (window.PerformanceUtils) {
            window.PerformanceUtils.cleanupPage(PAGE_ID);
        }

        cleanupServerFilters();
        cleanupServerPagination();

        if (window.ReviewComponent) {
            window.ReviewComponent.destroy();
        }

        allBadges = [];
        allBadgeThumbnails = {};
        userOwnedBadges.clear();
        currentBadgePage = 1;

        allGamepasses = [];
        allGamepassThumbnails = {};
        ownedGamepasses.clear();
        hideOffsaleGamepasses = true;
        gamepassOwnershipFilter = 'all';

        currentServerRequestId = 0;
        isBestConnectionProcessing = false;
        allPublicServers = [];

        delete window._regionLatencyRanking;
        delete window._regionLatencyData;
        currentServerPage = 1;
        playerAvatarCache = {};

        allPrivateServers = [];
        currentPrivateServerPage = 1;

        container.innerHTML = `
            <div style="text-align: center; padding: 60px;">
                <img src="images/spinners/spinner100x100.gif" alt="Loading..."/>
                <p style="margin-top: 20px; color: #666;">Loading game details...</p>
            </div>
        `;

        try {

            const response = await fetch('pages/game-detail.html');
            if (!response.ok) throw new Error('Failed to load game detail template');
            const html = await response.text();
            container.innerHTML = html;

            if (!universeId) {

                try {

                    if (window.roblox?.getPlaceDetails) {
                        const placeDetails = await window.roblox.getPlaceDetails([placeId]);
                        if (placeDetails && placeDetails[0] && placeDetails[0].universeId) {
                            universeId = placeDetails[0].universeId;
                        }
                    }

                    if (!universeId && window.roblox?.multigetPlaceDetails) {
                        const details = await window.roblox.multigetPlaceDetails([placeId]);
                        if (details && details[0] && details[0].universeId) {
                            universeId = details[0].universeId;
                        }
                    }

                    if (!universeId && window.roblox?.getGameDetails) {
                        try {
                            const gameDetails = await window.roblox.getGameDetails([placeId]);
                            if (gameDetails?.data?.[0]?.id) {
                                universeId = gameDetails.data[0].id;
                            }
                        } catch (e) {

                        }
                    }
                } catch (e) {
                    console.error('Failed to get universe ID:', e);
                }
            }

            currentUniverseId = universeId;

            if (!universeId) {
                throw new Error('Could not determine universe ID for this game. The place may no longer exist or be private.');
            }

            await loadGameData(placeId, universeId, genre);

        } catch (error) {
            console.error('Failed to load game detail page:', error);
            isLoading = false;

            if (window.showErrorPage) {
                window.showErrorPage('Failed to load game: ' + error.message, 'game-detail-content');
            } else {
                container.innerHTML = `
                    <div style="text-align: center; padding: 60px; color: #cc0000;">
                        <p>Failed to load game details.</p>
                        <p style="font-size: 12px; color: #666;">${error.message}</p>
                    </div>
                `;
            }
        }
    }

    async function loadGameData(placeId, universeId, passedGenre = null) {
        try {

            const gameDetails = await window.roblox.getGameDetails([universeId]);
            if (!gameDetails?.data?.[0]) {
                throw new Error('Game not found');
            }

            const game = gameDetails.data[0];

            if (passedGenre && !game.genre && !game.genre_l1) {
                game.genre = passedGenre;
            }

            updateBasicInfo(game);

            const promises = [
                loadCreatorInfo(game.creator),
                loadGameThumbnail(universeId),
                loadVotes(universeId),
                loadPublicServers(placeId),
                loadPrivateServers(placeId),
                loadBadges(universeId),
                loadGamepasses(universeId),
                loadRecommendations(universeId)
            ];

            if (window.roblox.getGameFavoritesCount) {
                promises.push(loadFavoritesCount(universeId));
            }

            await Promise.allSettled(promises);

            setupPlayButton(placeId);
            setupFavoriteButton(universeId);
            setupVoteButtons(universeId);
            setupTabs();
            setupBadgesGamepassesTabs();
            setupGamepassPurchaseModal();

            console.log('[GameDetail] Checking BlacklistMenu:', typeof window.BlacklistMenu, typeof window.BlacklistMenu?.initGameDetailPage);
            if (window.BlacklistMenu && typeof window.BlacklistMenu.initGameDetailPage === 'function') {
                const blacklistContainer = document.getElementById('BlacklistSection');
                console.log('[GameDetail] BlacklistSection container:', blacklistContainer);
                if (blacklistContainer) {
                    console.log('[GameDetail] Initializing blacklist with game:', game.name, game.id);
                    window.BlacklistMenu.initGameDetailPage(game, blacklistContainer);
                }
            } else {
                console.warn('[GameDetail] BlacklistMenu not available');
            }

            if (window.ReviewComponent) {
                console.log('[GameDetail] Initializing ReviewComponent for placeId:', placeId, 'universeId:', universeId);

                window.ReviewComponent.init(placeId, 'ReviewsSection', { universeId: universeId }).catch(err => {
                    console.error('[GameDetail] ReviewComponent init failed:', err);
                });
            } else {
                console.warn('[GameDetail] ReviewComponent not available');
            }

            loadRovlooStats(placeId);

            isLoading = false;

        } catch (error) {
            console.error('Error loading game data:', error);
            throw error;
        }
    }

    function updateBasicInfo(game) {

        const titleEl = document.getElementById('GameTitle');
        if (titleEl) titleEl.textContent = game.name || 'Unknown Game';

        const descEl = document.getElementById('GameDescription');
        if (descEl) descEl.innerHTML = window.formatDescription ? window.formatDescription(game.description) : (game.description || 'No description available.');

        currentPlayingCount = game.playing || 0;
        updatePublicServersTabText(currentPlayingCount);

        const visitsEl = document.getElementById('VisitsCount');
        if (visitsEl) visitsEl.textContent = formatNumber(game.visits || 0);

        const avatarTypeEl = document.getElementById('AvatarType');
        if (avatarTypeEl) {

            avatarTypeEl.textContent = formatAvatarType(game.universeAvatarType);

            loadAvatarTypeDetails(game.id, avatarTypeEl);
        }

        const maxPlayersEl = document.getElementById('MaxPlayers');
        if (maxPlayersEl) maxPlayersEl.textContent = game.maxPlayers || '--';

        const createdEl = document.getElementById('CreatedDate');
        if (createdEl && game.created) {
            createdEl.textContent = formatDate(game.created);
        }

        const updatedEl = document.getElementById('UpdatedDate');
        if (updatedEl && game.updated) {
            updatedEl.textContent = formatRelativeTime(game.updated);
        }

        const genreEl = document.getElementById('GenreName');
        const genreIconEl = document.getElementById('GenreIcon');

        let genre;
        if (game.genre_l1 && game.genre_l1 !== 'All') {
            genre = game.genre_l1;
        } else if (game.genre && game.genre !== 'All') {
            genre = game.genre;
        } else {
            genre = game.genre_l1 || game.genre || 'All';
        }

        const genreIconMap = {

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
            'FPS': { icon: 'ModernMilitary.png', name: 'FPS' },
            'All': { icon: 'Classic.png', name: 'All Genres' }
        };

        const genreInfo = genreIconMap[genre] || { icon: 'Classic.png', name: genre || 'All Genres' };

        if (genreEl) genreEl.textContent = genreInfo.name;

        if (genreIconEl) {
            const iconPath = `images/GenreIcons/${genreInfo.icon}`;
            genreIconEl.src = iconPath;
            genreIconEl.alt = genreInfo.name;
            genreIconEl.title = genreInfo.name;
        }

        const favEl = document.getElementById('FavoritesCount');
        if (favEl && game.favoritedCount !== undefined) {
            favEl.textContent = formatNumber(game.favoritedCount);
        }
    }

    async function loadCreatorInfo(creator) {
        if (!creator) return;

        const creatorLink = document.getElementById('CreatorLink');
        const creatorAvatarLink = document.getElementById('CreatorAvatarLink');
        const creatorAvatar = document.getElementById('CreatorAvatar');

        const creatorType = creator.type || 'User';
        const creatorId = creator.id;
        const creatorName = creator.name || 'Unknown';

        if (creatorLink) {
            creatorLink.textContent = creatorName;
            if (creatorType === 'User') {
                creatorLink.href = `#profile?id=${creatorId}`;
            } else if (creatorType === 'Group') {
                creatorLink.href = `#group?id=${creatorId}`;
            }
        }

        if (creatorAvatarLink) {
            if (creatorType === 'User') {
                creatorAvatarLink.href = `#profile?id=${creatorId}`;
            } else if (creatorType === 'Group') {
                creatorAvatarLink.href = `#group?id=${creatorId}`;
            }
            creatorAvatarLink.title = creatorName;
        }

        if (creatorAvatar && creatorId) {
            try {
                if (creatorType === 'User' && window.roblox?.getUserThumbnails) {
                    const thumbnail = await window.roblox.getUserThumbnails([creatorId], '110x110');
                    if (thumbnail?.data?.[0]?.imageUrl) {
                        creatorAvatar.src = thumbnail.data[0].imageUrl;
                    }

                    if (window.addObcOverlayIfPremium) {
                        await window.addObcOverlayIfPremium(creatorAvatarLink, creatorId, { bottom: '3px', left: '1px' });
                    }
                } else if (creatorType === 'Group' && window.roblox?.getGroupThumbnails) {

                    const thumbnail = await window.roblox.getGroupThumbnails([creatorId], '150x150');
                    if (thumbnail?.data?.[0]?.imageUrl) {
                        creatorAvatar.src = thumbnail.data[0].imageUrl;
                    }
                }
            } catch (e) {
                console.error('Failed to load creator avatar:', e);
            }
        }
    }

    async function loadGameThumbnail(universeId) {
        const thumbnailEl = document.getElementById('GameThumbnail');
        if (!thumbnailEl) return;

        try {
            if (window.roblox?.getGameThumbnails) {
                const thumbnails = await window.roblox.getGameThumbnails([universeId], '768x432');
                if (thumbnails?.data?.[0]?.thumbnails?.[0]?.imageUrl) {
                    thumbnailEl.src = thumbnails.data[0].thumbnails[0].imageUrl;
                } else if (thumbnails?.data?.[0]?.imageUrl) {
                    thumbnailEl.src = thumbnails.data[0].imageUrl;
                }
            }
        } catch (e) {
            console.error('Failed to load game thumbnail:', e);

        }
    }

    async function loadVotes(universeId) {
        const upVotesEl = document.getElementById('VoteUpCount');
        const downVotesEl = document.getElementById('VoteDownCount');

        if (!upVotesEl || !downVotesEl) return;

        try {

            const [votes, userVote] = await Promise.all([
                window.roblox?.getGameVotes?.([universeId]),
                window.roblox?.getUserVote?.(universeId).catch(() => null)
            ]);

            if (votes?.data?.[0]) {
                const upVotes = votes.data[0].upVotes || 0;
                const downVotes = votes.data[0].downVotes || 0;

                upVotesEl.textContent = formatVoteCount(upVotes);
                downVotesEl.textContent = formatVoteCount(downVotes);

                updateVoteBar(upVotes, downVotes);
            }

            if (userVote !== null) {
                updateVoteButtonStates(userVote.userVote);
            }
        } catch (e) {
            console.error('Failed to load votes:', e);
        }
    }

    async function loadRovlooStats(placeId) {
        const sectionEl = document.getElementById('RovlooStatsSection');
        const receptionEl = document.getElementById('ReviewReception');
        const playtimeEl = document.getElementById('UserPlaytime');

        if (!sectionEl || !receptionEl || !playtimeEl) return;

        try {

            let currentUserId = null;
            try {
                const user = await window.roblox.getCurrentUser();
                currentUserId = user?.id;
            } catch (e) {}

            const [stats, userReview, localPlaytime] = await Promise.all([
                window.roblox?.reviews?.getStats?.(placeId).catch(() => null),
                currentUserId ? window.roblox?.reviews?.getUserReview?.(placeId, currentUserId).catch(() => null) : null,
                currentUserId && window.PlaytimeTracker ? window.PlaytimeTracker.getPlaytimeDataAsync(placeId).catch(() => null) : null
            ]);

            if (!stats && !userReview && !localPlaytime) return;

            sectionEl.style.display = 'block';

            if (stats && stats.totalReviews > 0) {
                const likes = stats.likes || 0;
                const dislikes = stats.dislikes || 0;
                const total = likes + dislikes;
                const likePercentage = total > 0 ? Math.round((likes / total) * 100) : 0;

                let receptionBadge = '';
                let receptionColor = '';

                if (likePercentage >= 95) {
                    receptionBadge = 'Overwhelmingly Positive';
                    receptionColor = '#0a6e2d';
                } else if (likePercentage >= 80) {
                    receptionBadge = 'Very Positive';
                    receptionColor = '#1a8f44';
                } else if (likePercentage >= 70) {
                    receptionBadge = 'Positive';
                    receptionColor = '#2ecc71';
                } else if (likePercentage >= 50) {
                    receptionBadge = 'Mostly Positive';
                    receptionColor = '#5dade2';
                } else if (likePercentage >= 40) {
                    receptionBadge = 'Mixed';
                    receptionColor = '#95a5a6';
                } else if (likePercentage >= 20) {
                    receptionBadge = 'Mostly Negative';
                    receptionColor = '#e67e22';
                } else {
                    receptionBadge = 'Overwhelmingly Negative';
                    receptionColor = '#c0392b';
                }

                receptionEl.innerHTML = `
                    <div style="display: inline-block; padding: 4px 8px; background: ${receptionColor}; color: #fff; font-size: 11px; font-weight: bold; border-radius: 2px;">
                        ${receptionBadge}
                    </div>
                    <div style="font-size: 11px; color: #666; margin-top: 4px;">
                        <img src="images/rovloo/btn-thumbsup.png" alt="Likes" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 2px;">
                        ${likes.toLocaleString()} /
                        <img src="images/rovloo/btn-thumbsdown.png" alt="Dislikes" style="width: 14px; height: 14px; vertical-align: middle; margin: 0 2px;">
                        ${dislikes.toLocaleString()} (${stats.totalReviews.toLocaleString()} reviews)
                    </div>
                `;
            } else {
                receptionEl.innerHTML = '<div style="font-size: 11px; color: #666;">No reviews yet</div>';
            }

            let totalMinutes = 0;
            let playtimeSource = '';

            if (userReview) {
                console.log('[GameDetail] User review data:', userReview);
                console.log('[GameDetail] playtimeData:', userReview.playtimeData);
                console.log('[GameDetail] playtimeMinutes:', userReview.playtimeMinutes);
            }

            let serverMinutes = userReview?.playtimeData?.totalMinutes || 0;

            if (serverMinutes === 0 && currentUserId) {
                try {

                    const rovlooPlaytime = await window.roblox?.reviews?.getUserPlaytime?.(currentUserId);
                    console.log('[GameDetail] Rovloo server playtime data:', rovlooPlaytime);

                    if (rovlooPlaytime?.sessions) {
                        const gameSession = rovlooPlaytime.sessions.find(s => s.placeId === placeId || s.gameId === placeId);
                        if (gameSession?.totalMinutes) {
                            serverMinutes = gameSession.totalMinutes;
                            console.log('[GameDetail] Found playtime in Rovloo server:', serverMinutes);
                        }
                    }
                } catch (e) {
                    console.warn('[GameDetail] Failed to fetch Rovloo server playtime:', e);
                }
            }

            console.log('[GameDetail] Server minutes:', serverMinutes);

            const localMinutes = localPlaytime?.totalMinutes || 0;

            console.log('[GameDetail] Local minutes:', localMinutes);

            totalMinutes = serverMinutes + localMinutes;

            console.log('[GameDetail] Total minutes:', totalMinutes);

            if (serverMinutes > 0 && localMinutes > 0) {
                playtimeSource = 'combined';
            } else if (serverMinutes > 0) {
                playtimeSource = 'server';
            } else if (localMinutes > 0) {
                playtimeSource = 'local';
            }

            if (totalMinutes > 0) {
                const hours = Math.floor(totalMinutes / 60);
                const minutes = totalMinutes % 60;
                let playtimeText = '';

                if (hours > 0) {
                    playtimeText = `${hours}h ${minutes}m`;
                } else {
                    playtimeText = `${minutes}m`;
                }

                let sourceNote = '';
                if (playtimeSource === 'local') {
                    sourceNote = ' <span style="color: #999; font-size: 10px;">(local only - submit a review to sync)</span>';
                } else if (playtimeSource === 'combined') {
                    sourceNote = ` <span style="color: #999; font-size: 10px;">(${serverMinutes}m synced + ${localMinutes}m local)</span>`;
                }

                playtimeEl.innerHTML = `
                    <img src="images/rovloo/playtime-indicator.png" alt="Playtime" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 3px;">
                    Your playtime: <strong>${playtimeText}</strong>${sourceNote}
                `;
            } else {
                playtimeEl.innerHTML = '<span style="color: #999;">No playtime recorded</span>';
            }

        } catch (e) {
            console.error('Failed to load Rovloo stats:', e);
        }
    }

    function updateVoteButtonStates(userVote) {
        const voteUpBtn = document.getElementById('VoteUpButton');
        const voteDownBtn = document.getElementById('VoteDownButton');

        if (!voteUpBtn || !voteDownBtn) return;

        voteUpBtn.classList.remove('voted');
        voteDownBtn.classList.remove('voted');

        if (userVote === true) {
            voteUpBtn.classList.add('voted');
        } else if (userVote === false) {
            voteDownBtn.classList.add('voted');
        }
    }

    function updateVoteBar(upVotes, downVotes) {
        const likesBar = document.getElementById('VoteBarLikes');
        const dislikesBar = document.getElementById('VoteBarDislikes');

        if (!likesBar || !dislikesBar) return;

        const total = upVotes + downVotes;
        if (total === 0) {
            likesBar.style.width = '50%';
            dislikesBar.style.width = '50%';
            return;
        }

        const likePercent = (upVotes / total) * 100;
        const dislikePercent = (downVotes / total) * 100;

        likesBar.style.width = likePercent + '%';
        dislikesBar.style.width = dislikePercent + '%';
    }

    function formatVoteCount(count) {
        if (count >= 1000000) {
            return (count / 1000000).toFixed(0) + 'M+';
        } else if (count >= 1000) {
            return (count / 1000).toFixed(0) + 'K+';
        }
        return count.toString();
    }

    async function loadFavoritesCount(universeId) {
        const favEl = document.getElementById('FavoritesCount');
        if (!favEl) return;

        try {
            const result = await window.roblox.getGameFavoritesCount(universeId);
            if (result?.favoritesCount !== undefined) {
                favEl.textContent = formatNumber(result.favoritesCount);
            }
        } catch (e) {
            console.error('Failed to load favorites count:', e);
        }
    }

    async function loadPlayerAvatarsForServers(servers) {

        const playerTokenSet = new Set();
        servers.forEach(server => {
            if (server.playerTokens && Array.isArray(server.playerTokens)) {
                server.playerTokens.forEach(token => playerTokenSet.add(token));
            }
        });

        const playerTokens = Array.from(playerTokenSet);

        if (playerTokens.length === 0) {
            return;
        }

        try {

            const batchSize = 100;
            const batches = [];
            for (let i = 0; i < playerTokens.length; i += batchSize) {
                batches.push(playerTokens.slice(i, i + batchSize));
            }

            const batchResults = await Promise.all(
                batches.map(batch => window.robloxAPI.getPlayerAvatarsByToken(batch, '150x150', 'Webp'))
            );

            const avatarMap = {};
            batchResults.forEach(result => {
                if (result?.data) {
                    result.data.forEach(item => {

                        const match = item.requestId.match(/AvatarHeadShot::([A-F0-9]+)::/);
                        if (match && item.imageUrl) {
                            const token = match[1];
                            avatarMap[token] = item.imageUrl;
                        }
                    });
                }
            });

            servers.forEach(server => {
                server.playerAvatars = [];
                if (server.playerTokens && Array.isArray(server.playerTokens)) {
                    server.playerTokens.forEach(token => {
                        if (avatarMap[token]) {
                            server.playerAvatars.push(avatarMap[token]);
                        }
                    });
                }
            });
        } catch (e) {
            console.error('Failed to load player avatars:', e);
        }
    }

    async function loadPublicServers(placeId) {

        const excludeFullCheckbox = document.getElementById('ExcludeFullServers');
        const sortDropdown = document.getElementById('ServerSortOrder');
        const sortOrderValue = sortDropdown?.value || 'desc';

        if (isBestConnectionProcessing && sortOrderValue === 'bestConnection') {
            console.log('Best Connection already processing, ignoring duplicate request');
            return;
        }

        const requestId = ++currentServerRequestId;
        const loadingEl = document.getElementById('PublicServersLoading');
        const listEl = document.getElementById('PublicServersList');
        const noServersEl = document.getElementById('NoPublicServers');
        const paginationEl = document.getElementById('PublicServersPagination');

        if (!listEl) return;

        currentPlaceId = placeId;

        const excludeFullUserPref = excludeFullCheckbox?.checked || false;

        const excludeFull = sortOrderValue === 'bestConnection' ? true : excludeFullUserPref;

        const isApiSort = sortOrderValue === 'desc' || sortOrderValue === 'asc';
        const apiSortOrder = isApiSort ? (sortOrderValue === 'desc' ? 'Desc' : 'Asc') : 'Desc';

        if (loadingEl) loadingEl.style.display = 'block';
        if (listEl) listEl.style.display = 'none';
        if (noServersEl) noServersEl.style.display = 'none';
        if (paginationEl) paginationEl.style.display = 'none';

        try {
            if (window.robloxAPI?.getGameServers) {

                const servers = await window.robloxAPI.getGameServers(placeId, 'Public', 100, '', apiSortOrder, excludeFull);

                if (requestId !== currentServerRequestId) {
                    console.log('Server request cancelled (newer request started)');
                    return;
                }

                if (loadingEl) loadingEl.style.display = 'none';

                if (servers?.data && servers.data.length > 0) {

                    await loadPlayerAvatarsForServers(servers.data);

                    if (requestId !== currentServerRequestId) {
                        console.log('Server request cancelled after avatar loading');
                        return;
                    }

                    let sortedServers = [...servers.data];

                    const updateLoadingStatus = (message) => {
                        const statusEl = document.getElementById('ServerLoadingStatus');
                        if (statusEl) statusEl.textContent = message;
                    };

                    if (sortOrderValue === 'bestConnection') {

                        console.log('Sorting by best connection (region proximity)...');

                        isBestConnectionProcessing = true;

                        if (loadingEl) loadingEl.style.display = 'block';
                        updateLoadingStatus('Detecting your best region...');

                        try {

                            let localServerStatus = await window.RobloxClient?.localServer?.getStatus();

                            if (!localServerStatus?.isRunning && sortedServers.length > 50) {
                                console.log('Auto-starting local server for better performance...');
                                updateLoadingStatus('Starting advanced detection engine...');

                                try {
                                    const startResult = await window.RobloxClient?.localServer?.start();
                                    if (startResult?.success) {
                                        console.log(`Local server started on port ${startResult.port}`);
                                        localServerStatus = { isRunning: true, port: startResult.port };
                                    } else {
                                        console.warn('Failed to start local server:', startResult?.error);
                                    }
                                } catch (startError) {
                                    console.warn('Could not start local server:', startError);
                                }
                            }

                            const useLocalServer = localServerStatus?.isRunning && sortedServers.length > 50;

                            if (useLocalServer) {
                                console.log('Using local server for advanced server region detection...');
                                updateLoadingStatus('Using advanced detection (local server)...');

                                await processServersWithLocalServer(sortedServers, placeId, updateLoadingStatus);
                            } else {

                                console.log('Using client-side server region detection...');
                                await processServersClientSide(sortedServers, placeId, updateLoadingStatus);
                            }

                            if (loadingEl) loadingEl.style.display = 'none';

                            sortServersByLatency(sortedServers);

                            let serversToResolve;
                            if (sortedServers.length <= 100) {

                                serversToResolve = sortedServers;
                            } else {

                                const firstBatch = sortedServers.slice(0, 50);
                                const remaining = sortedServers.slice(50);

                                const sampleSize = Math.min(50, remaining.length);
                                const randomSample = [];

                                const weightedRemaining = remaining.sort((a, b) => (b.playing || 0) - (a.playing || 0));

                                const step = Math.max(1, Math.floor(weightedRemaining.length / sampleSize));
                                for (let i = 0; i < weightedRemaining.length && randomSample.length < sampleSize; i += step) {
                                    randomSample.push(weightedRemaining[i]);
                                }

                                serversToResolve = [...firstBatch, ...randomSample];
                                console.log(`Large server list (${sortedServers.length}): analyzing ${serversToResolve.length} strategically sampled servers`);
                            }
                            let resolvedCount = 0;
                            let errorCount = 0;

                            console.log(`Resolving regions for ${serversToResolve.length} servers...`);
                            updateLoadingStatus(`Detecting server regions (0/${serversToResolve.length})...`);

                            const REGION_CACHE_VERSION = 2;
                            const cacheKey = `serverRegions_v${REGION_CACHE_VERSION}_${placeId}`;
                            let cachedRegions = {};
                            try {
                                const cached = localStorage.getItem(cacheKey);
                                if (cached) {
                                    cachedRegions = JSON.parse(cached);

                                    const oneHourAgo = Date.now() - (60 * 60 * 1000);
                                    Object.keys(cachedRegions).forEach(serverId => {
                                        if (cachedRegions[serverId].timestamp < oneHourAgo) {
                                            delete cachedRegions[serverId];
                                        }
                                    });
                                }
                            } catch (e) {
                                cachedRegions = {};
                            }

                            const batchSize = 10;
                            for (let i = 0; i < serversToResolve.length; i += batchSize) {
                                const batch = serversToResolve.slice(i, i + batchSize);

                                await Promise.all(batch.map(async (server) => {
                                    try {

                                        if (cachedRegions[server.id]) {
                                            const cached = cachedRegions[server.id];
                                            server.regionString = cached.regionString;
                                            server.estimatedLatency = cached.estimatedLatency;
                                            server.serverIP = cached.serverIP;
                                            resolvedCount++;
                                            return;
                                        }

                                        const connInfo = await window.robloxAPI.getServerConnectionInfo(placeId, server.id);

                                        if (!connInfo) {
                                            errorCount++;
                                            return;
                                        }

                                        if (connInfo.status === 22) {
                                            console.log(`Server ${server.id} is full (status 22)`);
                                            return;
                                        }

                                        if (resolvedCount === 0 && connInfo.joinScript) {
                                            console.log('Sample server connection info:', JSON.stringify(connInfo).substring(0, 500));
                                        }

                                        const ip = connInfo?.joinScript?.UdmuxEndpoints?.[0]?.Address ||
                                                   connInfo?.joinScript?.MachineAddress;

                                        if (ip) {

                                            server.serverIP = ip;

                                            const regionInfo = await window.RobloxClient?.region?.resolveIp(ip);
                                            if (regionInfo) {

                                                server.regionString = regionInfo.locationString;

                                                let latencyRegionKey = regionInfo.regionKey;
                                                if (regionInfo.routedTo) {
                                                    latencyRegionKey = regionInfo.routedTo;
                                                }
                                                const rank = window._regionLatencyRanking?.[latencyRegionKey];
                                                server.estimatedLatency = rank !== undefined ? window._regionLatencyData[rank]?.latency ?? 9999 : 9999;
                                                resolvedCount++;

                                                cachedRegions[server.id] = {
                                                    regionString: server.regionString,
                                                    estimatedLatency: server.estimatedLatency,
                                                    serverIP: ip,
                                                    timestamp: Date.now()
                                                };
                                            } else {

                                                server.regionString = `Unknown`;
                                                server.estimatedLatency = 9999;
                                                resolvedCount++;

                                                cachedRegions[server.id] = {
                                                    regionString: server.regionString,
                                                    estimatedLatency: server.estimatedLatency,
                                                    serverIP: ip,
                                                    timestamp: Date.now()
                                                };
                                            }
                                        } else if (connInfo.status && connInfo.status !== 0 && connInfo.status !== 2 && connInfo.status !== 6) {

                                            console.warn(`Server ${server.id} status: ${connInfo.status} - ${connInfo.message || 'unknown'}`);
                                        }
                                    } catch (e) {
                                        errorCount++;
                                    }
                                }));

                                updateLoadingStatus(`Detecting server regions (${Math.min(i + batchSize, serversToResolve.length)}/${serversToResolve.length})...`);

                                if (i + batchSize < serversToResolve.length) {
                                    await new Promise(r => setTimeout(r, 150));
                                }
                            }

                            console.log(`Resolved regions for ${resolvedCount}/${serversToResolve.length} servers (${errorCount} errors)`);

                            try {
                                localStorage.setItem(cacheKey, JSON.stringify(cachedRegions));
                            } catch (e) {
                                console.warn('Failed to save server region cache:', e);
                            }

                            if (loadingEl) loadingEl.style.display = 'none';

                            sortServersByLatency(sortedServers);

                            isBestConnectionProcessing = false;

                        } catch (e) {
                            console.error('Failed to sort by best connection:', e);
                            if (loadingEl) loadingEl.style.display = 'none';
                            isBestConnectionProcessing = false;
                        }
                    } else if (sortOrderValue === 'newest') {

                        sortedServers.sort((a, b) => {
                            const idA = a.id || '';
                            const idB = b.id || '';
                            return idB.localeCompare(idA);
                        });
                    } else if (sortOrderValue === 'oldest') {

                        sortedServers.sort((a, b) => {
                            const idA = a.id || '';
                            const idB = b.id || '';
                            return idA.localeCompare(idB);
                        });
                    }

                    allPublicServers = sortedServers;
                    currentServerPage = 1;

                    renderServerPage();

                    const controlsEl = document.querySelector('#PublicServersContent .server-controls');
                    if (controlsEl) controlsEl.style.display = 'block';

                    setupServerFilters();
                    setupServerPagination();

                    setupServerJoinButtons(placeId);
                } else {

                    if (noServersEl) {
                        noServersEl.style.display = 'block';
                        if (sortOrderValue === 'bestConnection') {
                            noServersEl.textContent = 'No available servers with open slots. Best Connection requires servers with available space to detect their region.';
                        } else if (excludeFull) {
                            noServersEl.textContent = 'No available servers. Try unchecking "Exclude Full Servers".';
                        } else {
                            noServersEl.textContent = 'No public servers are currently running.';
                        }
                    }
                }
            } else {
                if (loadingEl) loadingEl.style.display = 'none';
                if (noServersEl) noServersEl.style.display = 'block';
            }
        } catch (e) {
            console.error('Failed to load public servers:', e);
            if (loadingEl) loadingEl.style.display = 'none';
            if (noServersEl) noServersEl.style.display = 'block';
        }
    }

    function renderServerPage() {
        const listEl = document.getElementById('PublicServersList');
        const paginationEl = document.getElementById('PublicServersPagination');
        const pageInfoEl = document.getElementById('ServersPageInfo');
        const prevBtn = document.getElementById('PrevServersPage');
        const nextBtn = document.getElementById('NextServersPage');

        if (!listEl || !allPublicServers.length) return;

        const totalPages = Math.ceil(allPublicServers.length / serversPerPage);
        const startIdx = (currentServerPage - 1) * serversPerPage;
        const endIdx = Math.min(startIdx + serversPerPage, allPublicServers.length);
        const pageServers = allPublicServers.slice(startIdx, endIdx);

        listEl.innerHTML = renderServers(pageServers, currentPlaceId, 'public');
        listEl.style.display = 'block';

        if (paginationEl) {
            if (totalPages > 1) {
                paginationEl.style.display = 'block';
                if (pageInfoEl) pageInfoEl.textContent = `Page ${currentServerPage} of ${totalPages}`;
                if (prevBtn) prevBtn.disabled = currentServerPage === 1;
                if (nextBtn) nextBtn.disabled = currentServerPage === totalPages;
            } else {
                paginationEl.style.display = 'none';
            }
        }

        setupServerJoinButtons(currentPlaceId);
    }

    let serverPaginationSetup = false;
    let prevPageHandler = null;
    let nextPageHandler = null;

    function cleanupServerPagination() {

        if (serverPaginationSetup) {
            const prevBtn = document.getElementById('PrevServersPage');
            const nextBtn = document.getElementById('NextServersPage');

            if (prevBtn && prevPageHandler) {
                prevBtn.removeEventListener('click', prevPageHandler);
            }
            if (nextBtn && nextPageHandler) {
                nextBtn.removeEventListener('click', nextPageHandler);
            }
        }

        serverPaginationSetup = false;
        prevPageHandler = null;
        nextPageHandler = null;
    }

    function setupServerPagination() {
        if (serverPaginationSetup) return;
        serverPaginationSetup = true;

        const prevBtn = document.getElementById('PrevServersPage');
        const nextBtn = document.getElementById('NextServersPage');

        prevPageHandler = () => {
            if (currentServerPage > 1) {
                currentServerPage--;
                renderServerPage();
            }
        };

        nextPageHandler = () => {
            const totalPages = Math.ceil(allPublicServers.length / serversPerPage);
            if (currentServerPage < totalPages) {
                currentServerPage++;
                renderServerPage();
            }
        };

        if (prevBtn) {
            prevBtn.addEventListener('click', prevPageHandler);
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', nextPageHandler);
        }
    }

    let serverFiltersSetup = false;
    let filterChangeHandler = null;
    let sortChangeHandler = null;
    let refreshClickHandler = null;

    function cleanupServerFilters() {

        if (serverFiltersSetup) {
            const excludeFullCheckbox = document.getElementById('ExcludeFullServers');
            const sortDropdown = document.getElementById('ServerSortOrder');
            const refreshLink = document.getElementById('RefreshServers');

            if (excludeFullCheckbox && filterChangeHandler) {
                excludeFullCheckbox.removeEventListener('change', filterChangeHandler);
            }
            if (sortDropdown && sortChangeHandler) {
                sortDropdown.removeEventListener('change', sortChangeHandler);
            }
            if (refreshLink && refreshClickHandler) {
                refreshLink.removeEventListener('click', refreshClickHandler);
            }
        }

        serverFiltersSetup = false;
        filterChangeHandler = null;
        sortChangeHandler = null;
        refreshClickHandler = null;
    }

    function setupServerFilters() {
        if (serverFiltersSetup) return;
        serverFiltersSetup = true;

        const excludeFullCheckbox = document.getElementById('ExcludeFullServers');
        const sortDropdown = document.getElementById('ServerSortOrder');
        const refreshLink = document.getElementById('RefreshServers');

        filterChangeHandler = function() {
            loadPublicServers(currentPlaceId);
        };

        sortChangeHandler = function() {
            loadPublicServers(currentPlaceId);
        };

        refreshClickHandler = function(e) {
            e.preventDefault();
            e.stopPropagation();
            loadPublicServers(currentPlaceId);
            return false;
        };

        if (excludeFullCheckbox) {
            excludeFullCheckbox.addEventListener('change', filterChangeHandler);
        }

        if (sortDropdown) {
            sortDropdown.addEventListener('change', sortChangeHandler);
        }

        if (refreshLink) {
            refreshLink.addEventListener('click', refreshClickHandler);
        }
    }

    async function loadPrivateServers(placeId) {
        const loadingEl = document.getElementById('PrivateServersLoading');
        const listEl = document.getElementById('PrivateServersList');
        const noServersEl = document.getElementById('NoPrivateServers');
        const paginationEl = document.getElementById('PrivateServersPagination');

        if (!listEl) return;

        try {
            if (window.robloxAPI?.getPrivateServers) {

                const servers = await window.robloxAPI.getPrivateServers(placeId, 50);

                if (loadingEl) loadingEl.style.display = 'none';

                if (servers?.data && servers.data.length > 0) {

                    await loadOwnerAvatarsForPrivateServers(servers.data);

                    allPrivateServers = servers.data;
                    currentPrivateServerPage = 1;

                    renderPrivateServerPage(placeId);
                    setupPrivateServerPagination(placeId);
                } else {
                    if (noServersEl) noServersEl.style.display = 'block';
                    if (paginationEl) paginationEl.style.display = 'none';
                }
            } else {
                if (loadingEl) loadingEl.style.display = 'none';
                if (noServersEl) noServersEl.style.display = 'block';
            }
        } catch (e) {
            console.error('Failed to load private servers:', e);
            if (loadingEl) loadingEl.style.display = 'none';
            if (noServersEl) noServersEl.style.display = 'block';
        }
    }

    function renderPrivateServerPage(placeId) {
        const listEl = document.getElementById('PrivateServersList');
        const paginationEl = document.getElementById('PrivateServersPagination');
        const pageInfoEl = document.getElementById('PrivateServersPageInfo');
        const prevBtn = document.getElementById('PrevPrivateServersPage');
        const nextBtn = document.getElementById('NextPrivateServersPage');

        if (!listEl || !allPrivateServers.length) return;

        const totalPages = Math.ceil(allPrivateServers.length / PRIVATE_SERVERS_PER_PAGE);
        const startIdx = (currentPrivateServerPage - 1) * PRIVATE_SERVERS_PER_PAGE;
        const endIdx = Math.min(startIdx + PRIVATE_SERVERS_PER_PAGE, allPrivateServers.length);
        const pageServers = allPrivateServers.slice(startIdx, endIdx);

        listEl.innerHTML = renderPrivateServers(pageServers, placeId);
        listEl.style.display = 'block';

        if (paginationEl) {
            if (totalPages > 1) {
                paginationEl.style.display = 'block';
                if (pageInfoEl) pageInfoEl.textContent = `Page ${currentPrivateServerPage} of ${totalPages}`;
                if (prevBtn) prevBtn.disabled = currentPrivateServerPage === 1;
                if (nextBtn) nextBtn.disabled = currentPrivateServerPage === totalPages;
            } else {
                paginationEl.style.display = 'none';
            }
        }

        setupPrivateServerJoinButtons(placeId);
    }

    let privateServerPaginationSetup = false;

    function setupPrivateServerPagination(placeId) {
        if (privateServerPaginationSetup) return;
        privateServerPaginationSetup = true;

        const prevBtn = document.getElementById('PrevPrivateServersPage');
        const nextBtn = document.getElementById('NextPrivateServersPage');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (currentPrivateServerPage > 1) {
                    currentPrivateServerPage--;
                    renderPrivateServerPage(placeId);
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const totalPages = Math.ceil(allPrivateServers.length / PRIVATE_SERVERS_PER_PAGE);
                if (currentPrivateServerPage < totalPages) {
                    currentPrivateServerPage++;
                    renderPrivateServerPage(placeId);
                }
            });
        }
    }

    async function loadOwnerAvatarsForPrivateServers(servers) {

        const ownerIds = [];
        servers.forEach(server => {
            const ownerId = server.owner?.id || server.ownerId;
            if (ownerId && !playerAvatarCache[ownerId]) {
                ownerIds.push(ownerId);
            }
        });

        if (ownerIds.length === 0) return;

        try {

            const avatarResult = await window.roblox.getUserThumbnails(ownerIds, '150x150');
            if (avatarResult?.data) {
                avatarResult.data.forEach(item => {
                    if (item.targetId && item.imageUrl) {
                        playerAvatarCache[item.targetId] = item.imageUrl;
                    }
                });
            }
        } catch (e) {
            console.error('Failed to load owner avatars:', e);
        }
    }

    function renderServers(servers, placeId, serverType = 'public') {
        let html = '<div class="servers-list">';

        servers.forEach((server) => {
            const playerCount = server.playing || 0;
            const maxPlayers = server.maxPlayers || 0;
            const jobId = server.id || '';

            const playerAvatars = server.playerAvatars || [];

            const measuredPing = server.measuredPing;
            const apiPing = server.ping;
            const hasRegionInfo = !!server.regionString;

            let pingClass = '';
            let pingText = '';
            let pingTitle = '';

            if (measuredPing && measuredPing > 0) {

                const pingNum = Math.round(measuredPing);
                if (pingNum < 80) {
                    pingClass = 'good';
                } else if (pingNum < 150) {
                    pingClass = 'medium';
                } else {
                    pingClass = 'poor';
                }
                pingText = `Ping: ${pingNum}ms`;
                pingTitle = `Measured ping to server`;
            } else if (apiPing !== undefined && apiPing !== null && !hasRegionInfo) {

                const pingNum = parseInt(apiPing);
                if (!isNaN(pingNum)) {

                    const cappedPing = Math.min(pingNum, 200);
                    const performancePercent = Math.round(100 - (cappedPing / 200 * 100));

                    if (performancePercent >= 75) {
                        pingClass = 'good';
                    } else if (performancePercent >= 50) {
                        pingClass = 'medium';
                    } else {
                        pingClass = 'poor';
                    }
                    pingText = `Performance: ${performancePercent}%`;
                    pingTitle = 'Server performance indicator (higher is better)';
                }
            }

            let avatarsHtml = '';
            const maxAvatars = 7;
            const hasPlayerAvatars = playerAvatars && playerAvatars.length > 0;

            if (hasPlayerAvatars) {

                const visiblePlayers = Math.min(playerAvatars.length, maxAvatars);
                const extraPlayers = Math.max(0, playerCount - visiblePlayers);

                for (let i = 0; i < visiblePlayers; i++) {
                    const avatarUrl = playerAvatars[i];
                    avatarsHtml += `<div class="player-avatar"><img src="${avatarUrl}" alt="Player" onerror="this.src='assets/ui/guest.png'"/></div>`;
                }

                if (extraPlayers > 0) {
                    avatarsHtml += `<span class="player-count-badge">+${extraPlayers}</span>`;
                }
            } else {

                const playersToShow = Math.min(playerCount, maxAvatars);
                const extraPlayers = Math.max(0, playerCount - playersToShow);

                for (let i = 0; i < playersToShow; i++) {
                    avatarsHtml += `<div class="player-avatar"><img src="assets/ui/guest.png" alt="Player"/></div>`;
                }

                if (extraPlayers > 0) {
                    avatarsHtml += `<span class="player-count-badge">+${extraPlayers}</span>`;
                }
            }

            const regionString = server.regionString || '';
            const estimatedLatency = server.estimatedLatency;
            let regionHtml = '';
            if (regionString) {
                const latencyText = estimatedLatency && estimatedLatency < 9999 ? ` (~${estimatedLatency}ms)` : '';

                const isUncertain = regionString === 'Unknown' || (estimatedLatency && estimatedLatency >= 9999);
                const icon = isUncertain ? '📍' : '📍';
                const tooltip = isUncertain
                    ? 'Region could not be determined from server IP'
                    : 'Server datacenter location based on IP. Note: Roblox may route your connection through a different path.';
                regionHtml = `<div class="server-region${isUncertain ? ' uncertain' : ''}" title="${tooltip}">${icon} ${regionString}${latencyText}</div>`;
            }

            const pingHtml = pingText ? `<div class="server-ping ${pingClass}" title="${pingTitle}">${pingText}</div>` : '';

            html += `
                <div class="server-row">
                    <div class="player-avatars">
                        ${avatarsHtml}
                    </div>
                    <div class="server-info">
                        <div class="server-players">${playerCount} of ${maxPlayers} players</div>
                        ${regionHtml}
                        ${pingHtml}
                    </div>
                    <div class="server-actions">
                        <button class="JoinServerBtn" data-job-id="${jobId}" data-place-id="${placeId}" data-server-type="${serverType}">Join</button>
                    </div>
                    <div style="clear: both;"></div>
                </div>
            `;
        });

        html += '</div>';
        return html;
    }

    function renderPrivateServers(servers, placeId) {
        let html = '<div class="private-servers-grid">';

        servers.forEach((server) => {
            const name = server.name || 'Private Server';
            const playerCount = server.playing || 0;
            const maxPlayers = server.maxPlayers || 0;
            const isActive = server.active !== false;
            const accessCode = server.accessCode || '';
            const vipServerId = server.vipServerId || server.id || '';
            const ownerId = server.owner?.id || server.ownerId || '';
            const ownerName = server.owner?.name || server.owner?.displayName || 'Owner';
            const ownerAvatar = playerAvatarCache[ownerId] || 'assets/ui/guest.png';

            html += `
                <div class="private-server-card">
                    <div class="private-server-header">
                        <span class="private-server-name">${name}</span>
                    </div>
                    <div class="private-server-content">
                        <div class="private-server-owner">
                            <a href="#profile?id=${ownerId}" title="${ownerName}">
                                <img src="${ownerAvatar}" alt="${ownerName}" class="private-server-avatar">
                            </a>
                            <div class="private-server-owner-info">
                                <a href="#profile?id=${ownerId}" class="private-server-owner-name">${ownerName}</a>
                                <div class="private-server-players">${playerCount} of ${maxPlayers} people max</div>
                            </div>
                        </div>
                        <div class="private-server-actions">
                            ${isActive ? `<input type="button" class="JoinPrivateServerBtn" value="Start & Join" data-access-code="${accessCode}" data-vip-server-id="${vipServerId}" data-place-id="${placeId}"/>` : '<span class="private-server-inactive">Inactive</span>'}
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        return html;
    }

    function setupServerJoinButtons(placeId) {

        const serversList = document.getElementById('PublicServersList');
        if (!serversList) return;

        const oldHandler = serversList._joinButtonHandler;
        if (oldHandler) {
            serversList.removeEventListener('click', oldHandler);
        }

        const handler = function(e) {
            if (e.target.classList.contains('JoinServerBtn')) {
                const jobId = e.target.getAttribute('data-job-id');
                if (jobId) {
                    joinServer(placeId, jobId);
                } else {
                    launchGame(placeId);
                }
            }
        };

        serversList._joinButtonHandler = handler;
        serversList.addEventListener('click', handler);
    }

    function setupPrivateServerJoinButtons(placeId) {
        const serversList = document.getElementById('PrivateServersList');
        if (!serversList) return;

        const oldHandler = serversList._joinPrivateButtonHandler;
        if (oldHandler) {
            serversList.removeEventListener('click', oldHandler);
        }

        const handler = function(e) {
            if (e.target.classList.contains('JoinPrivateServerBtn')) {
                const accessCode = e.target.getAttribute('data-access-code');
                const vipServerId = e.target.getAttribute('data-vip-server-id');
                if (accessCode || vipServerId) {
                    joinPrivateServer(placeId, accessCode, vipServerId);
                }
            }
        };

        serversList._joinPrivateButtonHandler = handler;
        serversList.addEventListener('click', handler);
    }

    async function loadBadges(universeId) {
        const loadingEl = document.getElementById('BadgesLoading');
        const listEl = document.getElementById('BadgesList');
        const noBadgesEl = document.getElementById('NoBadges');

        if (!listEl) return;

        try {
            if (window.roblox?.getGameBadges) {

                const badges = await window.roblox.getGameBadges(universeId, 100);

                if (loadingEl) loadingEl.style.display = 'none';

                if (badges?.data && badges.data.length > 0) {

                    allBadges = badges.data;
                    currentBadgePage = 1;
                    userOwnedBadges.clear();

                    const badgeIds = badges.data.map(b => b.id);
                    try {
                        const thumbResult = await window.roblox.getBadgeThumbnails(badgeIds, '150x150');
                        if (thumbResult?.data) {
                            thumbResult.data.forEach(t => {
                                allBadgeThumbnails[t.targetId] = t.imageUrl;
                            });
                        }
                    } catch (e) {
                        console.warn('Failed to load badge thumbnails:', e);
                    }

                    try {
                        const isLoggedIn = await window.RobloxClient.auth.isLoggedIn();
                        if (isLoggedIn) {
                            const currentUser = await window.RobloxClient.api.getCurrentUser();
                            if (currentUser?.id) {
                                const awardedDates = await window.robloxAPI.getBadgeAwardedDates(currentUser.id, badgeIds);
                                if (awardedDates?.data) {

                                    awardedDates.data.forEach(item => {
                                        if (item.badgeId && item.awardedDate) {
                                            userOwnedBadges.add(item.badgeId);
                                        }
                                    });
                                }
                            }
                        }
                    } catch (e) {

                        console.warn('Failed to load user badge data:', e);
                    }

                    renderBadgesPage();
                    listEl.style.display = 'block';
                } else {
                    if (noBadgesEl) noBadgesEl.style.display = 'block';
                }
            } else {
                if (loadingEl) loadingEl.style.display = 'none';
                if (noBadgesEl) noBadgesEl.style.display = 'block';
            }
        } catch (e) {
            console.error('Failed to load badges:', e);
            if (loadingEl) loadingEl.style.display = 'none';
            if (noBadgesEl) noBadgesEl.style.display = 'block';
        }
    }

    function renderBadgesPage() {
        const listEl = document.getElementById('BadgesList');
        if (!listEl) return;

        const totalPages = Math.ceil(allBadges.length / BADGES_PER_PAGE);
        const startIdx = (currentBadgePage - 1) * BADGES_PER_PAGE;
        const endIdx = startIdx + BADGES_PER_PAGE;
        const pageBadges = allBadges.slice(startIdx, endIdx);

        let html = renderBadges(pageBadges, allBadgeThumbnails);

        if (totalPages > 1) {
            html += renderBadgesPagination(totalPages);
        }

        listEl.innerHTML = html;

        if (totalPages > 1) {
            setupBadgesPagination();
        }
    }

    function renderBadgesPagination(totalPages) {
        let html = '<div class="badges-pagination" style="margin-top: 15px; text-align: center; padding: 10px 0; border-top: 1px solid #eee;">';

        if (currentBadgePage > 1) {
            html += `<a href="#" class="badge-page-btn" data-page="${currentBadgePage - 1}" style="margin: 0 5px; color: #00F; text-decoration: none;">&lt; Previous</a>`;
        } else {
            html += `<span style="margin: 0 5px; color: #ccc;">&lt; Previous</span>`;
        }

        html += '<span style="margin: 0 10px; color: #666;">Page ' + currentBadgePage + ' of ' + totalPages + '</span>';

        if (currentBadgePage < totalPages) {
            html += `<a href="#" class="badge-page-btn" data-page="${currentBadgePage + 1}" style="margin: 0 5px; color: #00F; text-decoration: none;">Next &gt;</a>`;
        } else {
            html += `<span style="margin: 0 5px; color: #ccc;">Next &gt;</span>`;
        }

        html += '</div>';
        return html;
    }

    function setupBadgesPagination() {
        const listEl = document.getElementById('BadgesList');
        if (!listEl) return;

        const oldHandler = listEl._badgePaginationHandler;
        if (oldHandler) {
            listEl.removeEventListener('click', oldHandler);
        }

        const handler = function(e) {
            if (e.target.classList.contains('badge-page-btn')) {
                e.preventDefault();
                const page = parseInt(e.target.getAttribute('data-page'));
                if (page) {
                    currentBadgePage = page;
                    renderBadgesPage();

                    document.getElementById('BadgesSection')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            }
        };

        listEl._badgePaginationHandler = handler;
        listEl.addEventListener('click', handler);
    }

    function renderBadges(badges, thumbnails = {}) {
        let html = '';

        badges.forEach(badge => {
            const iconUrl = thumbnails[badge.id] || 'images/spinners/spinner100x100.gif';
            const description = badge.description || '';
            const winRatePercent = badge.statistics?.winRatePercentage || 0;
            const pastDayAwardedCount = badge.statistics?.pastDayAwardedCount || 0;
            const awardedCount = badge.statistics?.awardedCount || 0;

            let rarityLabel = 'Freebie';
            if (winRatePercent === 0) {
                rarityLabel = 'Impossible';
            } else if (winRatePercent < 1) {
                rarityLabel = 'Impossible';
            } else if (winRatePercent < 5) {
                rarityLabel = 'Insane';
            } else if (winRatePercent < 10) {
                rarityLabel = 'Extreme';
            } else if (winRatePercent < 25) {
                rarityLabel = 'Hard';
            } else if (winRatePercent < 50) {
                rarityLabel = 'Moderate';
            } else if (winRatePercent < 75) {
                rarityLabel = 'Easy';
            } else {
                rarityLabel = 'Freebie';
            }

            const isOwned = userOwnedBadges.has(badge.id);

            html += `
                <div class="badge-row" style="display: flex; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid #eee;">
                    <div class="badge-icon" style="flex-shrink: 0; margin-right: 12px;">
                        <a href="#badge?id=${badge.id}">
                            <img src="${iconUrl}" alt="${badge.name}" style="width:75px; height:75px; border-radius: 50%; border:1px solid ${isOwned ? '#4CAF50' : '#ccc'};"/>
                        </a>
                    </div>
                    <div class="badge-info" style="flex: 1;">
                        <div class="badge-name" style="margin-bottom: 4px;">
                            <a href="#badge?id=${badge.id}" style="color: #00F; font-weight: bold; font-size: 12px; text-decoration: none;">${badge.name}</a>
                        </div>
                        <div class="badge-description" style="color: #666; font-size: 11px; line-height: 1.4;">
                            ${description}
                        </div>
                    </div>
                    <div class="badge-stats" style="flex-shrink: 0; text-align: left; min-width: 180px; font-size: 11px;">
                        <div style="margin-bottom: 4px;">Rarity ${winRatePercent.toFixed(1)}% (${rarityLabel})</div>
                        <div style="color: #666;">Won Yesterday ${pastDayAwardedCount}</div>
                        <div style="color: #666;">Won Ever ${awardedCount}</div>
                        ${isOwned ? '<div style="color: #4CAF50; font-weight: bold; margin-top: 4px;">✓ You won this badge</div>' : ''}
                    </div>
                </div>
            `;
        });

        return html;
    }

    let allGamepasses = [];
    let allGamepassThumbnails = {};
    let ownedGamepasses = new Set();
    let hideOffsaleGamepasses = true;
    let gamepassOwnershipFilter = 'all';

    async function loadGamepasses(universeId) {
        const loadingEl = document.getElementById('GamepassesLoading');
        const listEl = document.getElementById('GamepassesList');
        const noGamepassesEl = document.getElementById('NoGamepasses');
        const filterEl = document.getElementById('GamepassesFilter');

        if (!listEl) return;

        try {
            if (window.robloxAPI?.getGamePasses) {

                const response = await window.robloxAPI.getGamePasses(universeId, 50);

                if (loadingEl) loadingEl.style.display = 'none';

                if (response?.gamePasses && response.gamePasses.length > 0) {

                    allGamepasses = response.gamePasses;

                    const gamepassIds = response.gamePasses.map(gp => gp.id);
                    try {
                        const thumbResult = await window.robloxAPI.getGamePassIcons(gamepassIds, '150x150', 'Png');
                        if (thumbResult?.data) {
                            thumbResult.data.forEach(t => {
                                allGamepassThumbnails[t.targetId] = t.imageUrl;
                            });
                        }
                    } catch (e) {
                        console.warn('Failed to load gamepass thumbnails:', e);
                    }

                    checkGamepassOwnership(gamepassIds);

                    if (filterEl) {
                        filterEl.style.display = 'block';
                        setupGamepassFilter();
                    }

                    renderGamepasses();
                    listEl.style.display = 'block';
                } else {
                    if (noGamepassesEl) {
                        noGamepassesEl.style.display = 'block';
                        noGamepassesEl.textContent = 'This game has no gamepasses.';
                    }
                }
            } else {
                if (loadingEl) loadingEl.style.display = 'none';
                if (noGamepassesEl) noGamepassesEl.style.display = 'block';
            }
        } catch (e) {
            console.error('Failed to load gamepasses:', e);
            if (loadingEl) loadingEl.style.display = 'none';
            if (noGamepassesEl) {
                noGamepassesEl.style.display = 'block';
                noGamepassesEl.textContent = 'Unable to load gamepasses.';
            }
        }
    }

    async function checkGamepassOwnership(gamepassIds) {
        try {

            const currentUser = await window.RobloxClient?.api?.getCurrentUser?.();
            if (!currentUser?.id) return;

            const checkPromises = gamepassIds.map(async (gpId) => {
                try {
                    const result = await window.roblox.userOwnsItem(currentUser.id, 'GamePass', gpId);

                    if (result?.data && result.data.length > 0) {
                        ownedGamepasses.add(gpId);
                    }
                } catch (e) {

                }
            });

            await Promise.all(checkPromises);

            renderGamepasses();
        } catch (e) {
            console.warn('Failed to check gamepass ownership:', e);
        }
    }

    function setupGamepassFilter() {
        const checkbox = document.getElementById('HideOffsaleGamepasses');
        const ownershipSelect = document.getElementById('GamepassOwnershipFilter');
        if (!checkbox) return;

        checkbox.checked = hideOffsaleGamepasses;
        if (ownershipSelect) ownershipSelect.value = gamepassOwnershipFilter;

        const changeHandler = function() {
            hideOffsaleGamepasses = checkbox.checked;
            renderGamepasses();
        };

        const ownershipChangeHandler = function() {
            gamepassOwnershipFilter = ownershipSelect.value;
            renderGamepasses();
        };

        if (window.PerformanceUtils) {
            window.PerformanceUtils.addPageListener(PAGE_ID, checkbox, 'change', changeHandler);
        } else {
            checkbox.addEventListener('change', changeHandler);
        }

        if (ownershipSelect) {
            if (window.PerformanceUtils) {
                window.PerformanceUtils.addPageListener(PAGE_ID, ownershipSelect, 'change', ownershipChangeHandler);
            } else {
                ownershipSelect.addEventListener('change', ownershipChangeHandler);
            }
        }
    }

    function renderGamepasses() {
        const listEl = document.getElementById('GamepassesList');
        const noGamepassesEl = document.getElementById('NoGamepasses');
        if (!listEl || !allGamepasses.length) return;

        let filteredGamepasses = hideOffsaleGamepasses
            ? allGamepasses.filter(gp => gp.isForSale !== false)
            : allGamepasses;

        if (gamepassOwnershipFilter === 'owned') {
            filteredGamepasses = filteredGamepasses.filter(gp => ownedGamepasses.has(gp.id));
        } else if (gamepassOwnershipFilter === 'notowned') {
            filteredGamepasses = filteredGamepasses.filter(gp => !ownedGamepasses.has(gp.id));
        }

        if (filteredGamepasses.length === 0) {
            listEl.style.display = 'none';
            if (noGamepassesEl) {
                noGamepassesEl.style.display = 'block';

                if (gamepassOwnershipFilter === 'owned') {
                    noGamepassesEl.textContent = 'You don\'t own any gamepasses for this game.';
                } else if (gamepassOwnershipFilter === 'notowned' && hideOffsaleGamepasses) {
                    noGamepassesEl.textContent = 'No unowned gamepasses for sale. Try changing the filters.';
                } else if (gamepassOwnershipFilter === 'notowned') {
                    noGamepassesEl.textContent = 'You own all gamepasses for this game!';
                } else if (hideOffsaleGamepasses) {
                    noGamepassesEl.textContent = 'No gamepasses for sale. Uncheck the filter to see off-sale gamepasses.';
                } else {
                    noGamepassesEl.textContent = 'This game has no gamepasses.';
                }
            }
            return;
        }

        if (noGamepassesEl) noGamepassesEl.style.display = 'none';
        listEl.style.display = 'block';

        let html = '';

        filteredGamepasses.forEach(gamepass => {
            const iconUrl = allGamepassThumbnails[gamepass.id] || 'images/spinners/spinner100x100.gif';
            const name = gamepass.displayName || gamepass.name || 'Unnamed';
            const description = gamepass.displayDescription || gamepass.description || 'No description available.';
            const price = gamepass.price !== null && gamepass.price !== undefined ? gamepass.price : null;
            const isForSale = gamepass.isForSale !== false;
            const productId = gamepass.productId || gamepass.id;
            const sellerId = gamepass.creator?.creatorId || 0;
            const isOwned = ownedGamepasses.has(gamepass.id);

            html += `
                <div class="gamepass-row" style="display: flex; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid #eee;">
                    <div class="gamepass-icon" style="flex-shrink: 0; margin-right: 12px;">
                        <a href="#gamepass?id=${gamepass.id}">
                            <img src="${iconUrl}" alt="${name}" style="width:75px; height:75px; border-radius: 4px; border:1px solid #ccc;"/>
                        </a>
                    </div>
                    <div class="gamepass-info" style="flex: 1;">
                        <div class="gamepass-name" style="margin-bottom: 4px;">
                            <a href="#gamepass?id=${gamepass.id}" style="color: #00F; font-weight: bold; font-size: 12px; text-decoration: none;">${name}</a>
                            ${isOwned ? '<span style="color: #060; font-size: 10px; margin-left: 5px;">(Owned)</span>' : ''}
                        </div>
                        <div class="gamepass-description" style="color: #666; font-size: 11px; line-height: 1.4; text-align: left;">
                            ${description}
                        </div>
                    </div>
                    <div class="gamepass-price" style="flex-shrink: 0; text-align: right; min-width: 120px; font-size: 11px;">
                        ${isOwned ? '<div style="color: #060; font-size: 12px; font-weight: bold;">✓ Owned</div>' :
                          isForSale && price !== null ? `
                            <div style="font-weight: bold; color: #060; font-size: 13px; margin-bottom: 5px;">
                                R$ ${price.toLocaleString()}
                            </div>
                            <button class="gamepass-buy-btn" data-gamepass-id="${productId}" data-price="${price}" data-seller-id="${sellerId}" data-name="${name.replace(/"/g, '&quot;')}" data-thumbnail="${iconUrl}" style="padding: 5px 12px; background: #060; color: white; border: 1px solid #050; cursor: pointer; font-size: 11px; font-weight: bold;">
                                Buy
                            </button>
                        ` : !isForSale ? '<div style="color: #999; font-size: 11px;">Not for sale</div>' : '<div style="color: #666; font-size: 11px;">Price not available</div>'}
                    </div>
                </div>
            `;
        });

        listEl.innerHTML = html;

        const buyButtons = listEl.querySelectorAll('.gamepass-buy-btn');
        buyButtons.forEach(btn => {
            const clickHandler = function() {
                const gamepassId = btn.getAttribute('data-gamepass-id');
                const price = parseInt(btn.getAttribute('data-price'));
                const sellerId = parseInt(btn.getAttribute('data-seller-id')) || 0;
                const name = btn.getAttribute('data-name');
                const thumbnail = btn.getAttribute('data-thumbnail');
                showGamepassPurchaseModal(gamepassId, price, sellerId, name, thumbnail);
            };

            if (window.PerformanceUtils) {
                window.PerformanceUtils.addPageListener(PAGE_ID, btn, 'click', clickHandler);
            } else {
                btn.addEventListener('click', clickHandler);
            }
        });
    }

    let currentGamepassPurchase = null;

    function showGamepassPurchaseModal(gamepassId, price, sellerId, name, thumbnail) {
        currentGamepassPurchase = { gamepassId, price, sellerId, name, thumbnail };

        const modal = document.getElementById('gamepass-purchase-modal');
        const thumbnailEl = document.getElementById('gamepass-modal-thumbnail');
        const nameEl = document.getElementById('gamepass-modal-name');
        const priceEl = document.getElementById('gamepass-modal-price');
        const balanceEl = document.getElementById('gamepass-modal-balance');
        const errorEl = document.getElementById('gamepass-modal-error');
        const successEl = document.getElementById('gamepass-modal-success');
        const buttonsEl = document.getElementById('gamepass-modal-buttons');
        const confirmBtn = document.getElementById('gamepass-confirm-btn');

        if (!modal) return;

        errorEl.style.display = 'none';
        errorEl.textContent = '';
        successEl.style.display = 'none';
        successEl.textContent = '';
        buttonsEl.style.display = 'block';
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Buy Now';

        thumbnailEl.src = thumbnail || 'images/spinners/spinner100x100.gif';
        nameEl.textContent = name;
        priceEl.textContent = `R$ ${price.toLocaleString()}`;
        balanceEl.textContent = 'Loading balance...';

        loadUserBalanceForModal(balanceEl);

        modal.style.display = 'block';
    }

    async function loadUserBalanceForModal(balanceEl) {
        try {
            if (window.roblox?.getCurrentUser) {
                const currentUser = await window.roblox.getCurrentUser();
                if (currentUser && window.roblox?.getUserCurrency) {
                    const currencyData = await window.roblox.getUserCurrency(currentUser.id);
                    if (currencyData?.robux !== undefined) {
                        balanceEl.textContent = `Your balance: R$ ${currencyData.robux.toLocaleString()}`;
                    }
                }
            }
        } catch (e) {
            balanceEl.textContent = 'Your balance: R$ --';
        }
    }

    function closeGamepassPurchaseModal() {
        const modal = document.getElementById('gamepass-purchase-modal');
        if (modal) {
            modal.style.display = 'none';
        }
        currentGamepassPurchase = null;
    }

    async function confirmGamepassPurchase() {
        if (!currentGamepassPurchase) return;

        const { gamepassId, price, sellerId, name } = currentGamepassPurchase;
        const errorEl = document.getElementById('gamepass-modal-error');
        const successEl = document.getElementById('gamepass-modal-success');
        const buttonsEl = document.getElementById('gamepass-modal-buttons');
        const confirmBtn = document.getElementById('gamepass-confirm-btn');

        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Purchasing...';
        errorEl.style.display = 'none';

        try {
            console.log('Purchasing gamepass:', { gamepassId, price, sellerId, name });

            const result = await window.robloxAPI.purchaseGamePass(gamepassId, price, 1, sellerId);

            console.log('Purchase API response:', result);

            const purchaseData = result?.data || result;

            if (purchaseData && purchaseData.purchased) {

                successEl.textContent = `Successfully purchased ${name}!`;
                successEl.style.display = 'block';
                buttonsEl.style.display = 'none';

                if (window.refreshHeaderRobux) {
                    window.refreshHeaderRobux();
                }

                setTimeout(() => closeGamepassPurchaseModal(), 2000);
            } else {
                const reason = purchaseData?.reason || purchaseData?.errorMsg || result?.message || 'Unknown error';
                console.error('Purchase failed:', purchaseData);
                errorEl.textContent = `Purchase failed: ${reason}`;
                errorEl.style.display = 'block';
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Try Again';
            }
        } catch (error) {
            console.error('Gamepass purchase error:', error);

            let errorMessage = 'Unknown error occurred';

            if (error.message) {
                if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                    errorMessage = 'You must be logged in to purchase gamepasses.';
                } else if (error.message.includes('insufficient') || error.message.includes('InsufficientFunds')) {
                    errorMessage = 'Insufficient Robux to complete this purchase.';
                } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
                    errorMessage = 'You do not have permission to purchase this gamepass.';
                } else {
                    errorMessage = error.message;
                }
            }

            errorEl.textContent = errorMessage;
            errorEl.style.display = 'block';
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Try Again';
        }
    }

    function setupGamepassPurchaseModal() {
        const modal = document.getElementById('gamepass-purchase-modal');
        const closeBtn = document.getElementById('gamepass-modal-close');
        const confirmBtn = document.getElementById('gamepass-confirm-btn');
        const cancelBtn = document.getElementById('gamepass-cancel-btn');

        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    closeGamepassPurchaseModal();
                }
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', function(e) {
                e.preventDefault();
                closeGamepassPurchaseModal();
            });
        }

        if (confirmBtn) {
            confirmBtn.addEventListener('click', confirmGamepassPurchase);
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', closeGamepassPurchaseModal);
        }
    }

    function setupBadgesGamepassesTabs() {
        const badgesTab = document.getElementById('BadgesTab');
        const gamepassesTab = document.getElementById('GamepassesTab');
        const badgesContent = document.getElementById('BadgesContent');
        const gamepassesContent = document.getElementById('GamepassesContent');

        if (!badgesTab || !gamepassesTab) return;

        const showBadges = function() {
            badgesTab.className = 'StandardTabWhiteActive';
            gamepassesTab.className = 'StandardTabWhite';
            badgesTab.style.cursor = 'pointer';
            gamepassesTab.style.cursor = 'pointer';
            if (badgesContent) badgesContent.style.display = 'block';
            if (gamepassesContent) gamepassesContent.style.display = 'none';
        };

        const showGamepasses = function() {
            badgesTab.className = 'StandardTabWhite';
            gamepassesTab.className = 'StandardTabWhiteActive';
            badgesTab.style.cursor = 'pointer';
            gamepassesTab.style.cursor = 'pointer';
            if (badgesContent) badgesContent.style.display = 'none';
            if (gamepassesContent) gamepassesContent.style.display = 'block';
        };

        if (window.PerformanceUtils) {
            window.PerformanceUtils.addPageListener(PAGE_ID, badgesTab, 'click', showBadges);
            window.PerformanceUtils.addPageListener(PAGE_ID, gamepassesTab, 'click', showGamepasses);
        } else {
            badgesTab.addEventListener('click', showBadges);
            gamepassesTab.addEventListener('click', showGamepasses);
        }
    }

    async function loadRecommendations(universeId) {
        const loadingEl = document.getElementById('RecommendationsLoading');
        const listEl = document.getElementById('RecommendationsList');

        if (!listEl) return;

        try {

            let games = [];

            if (window.robloxAPI?.getGameRecommendations) {
                try {
                    const recs = await window.robloxAPI.getGameRecommendations(universeId, 6);

                    if (recs?.games && recs.games.length > 0) {
                        games = recs.games.slice(0, 6);
                    }
                } catch (e) {

                }
            }

            if (games.length === 0 && window.robloxAPI?.getOmniRecommendations) {
                try {
                    const recs = await window.robloxAPI.getOmniRecommendations('Game', null);

                    if (recs?.sorts && Array.isArray(recs.sorts)) {
                        for (const sort of recs.sorts) {
                            if (sort.topic && sort.topic.id) {

                                const topicGames = sort.topic.id.map(id => recs.contentMetadata?.Game?.[id]).filter(g => g);
                                if (topicGames.length > 0) {
                                    games = topicGames.slice(0, 6);
                                    break;
                                }
                            } else if (sort.games && sort.games.length > 0) {
                                games = sort.games.slice(0, 6);
                                break;
                            }
                        }
                    }

                    if (games.length === 0 && recs?.contentRows) {
                        for (const row of recs.contentRows) {
                            if (row.contents && row.contents.length > 0) {
                                games = row.contents.slice(0, 6);
                                break;
                            }
                        }
                    }
                } catch (e) {
                    console.warn('Omni recommendations failed:', e);
                }
            }

            if (games.length === 0 && window.robloxAPI?.getPopularGames) {
                try {
                    const popular = await window.robloxAPI.getPopularGames();
                    console.log('Popular games response:', popular);
                    if (popular?.data) {
                        games = popular.data.slice(0, 6);
                    }
                } catch (e) {
                    console.warn('Popular games failed:', e);
                }
            }

            if (loadingEl) loadingEl.style.display = 'none';

            if (games.length > 0) {

                await loadGameThumbnailsForRecommendations(games);
                listEl.innerHTML = renderRecommendations(games);
                listEl.style.display = 'block';
            } else {
                listEl.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">No recommendations available.</div>';
                listEl.style.display = 'block';
            }
        } catch (e) {
            console.error('Failed to load recommendations:', e);
            if (loadingEl) loadingEl.style.display = 'none';
            listEl.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">Could not load recommendations.</div>';
            listEl.style.display = 'block';
        }
    }

    async function loadGameThumbnailsForRecommendations(games) {

        const universeIds = games.map(g => g.universeId || g.id).filter(id => id);

        if (universeIds.length === 0) {
            console.warn('No universe IDs found for recommendations');
            return;
        }

        try {

            if (window.robloxAPI?.getGameIcons) {
                const icons = await window.robloxAPI.getGameIcons(universeIds, '150x150');
                if (icons?.data) {
                    icons.data.forEach(icon => {
                        const game = games.find(g => (g.universeId || g.id) === icon.targetId);
                        if (game && icon.imageUrl) {
                            game.imageUrl = icon.imageUrl;
                        }
                    });
                }
            }
        } catch (e) {

        }
    }

    function renderRecommendations(games) {
        let html = '<table style="width:100%; border-collapse:collapse;"><tr>';

        games.forEach((game, index) => {
            if (index > 0 && index % 3 === 0) {
                html += '</tr><tr>';
            }

            const name = game.name || 'Unknown Game';
            const placeId = game.placeId || game.rootPlaceId || '';
            const universeId = game.universeId || game.id || '';
            const imageUrl = game.imageUrl || game.thumbnailUrl || 'images/spinners/spinner100x100.gif';
            const creatorName = game.creator?.name || game.creatorName || 'Unknown';
            const creatorId = game.creator?.id || game.creatorId || game.creatorTargetId || '';

            let creatorTypeRaw = game.creator?.type || game.creatorType || 'User';
            const isGroup = creatorTypeRaw === 'Group' || creatorTypeRaw === 1;

            let creatorHtml;
            if (creatorId) {
                const creatorHref = isGroup ? `#group?id=${creatorId}` : `#profile?id=${creatorId}`;
                creatorHtml = `<a href="${creatorHref}" style="color:#00f; text-decoration:none;">${creatorName}</a>`;
            } else {
                creatorHtml = creatorName;
            }

            html += `
                <td style="padding:10px; vertical-align:top;">
                    <div class="PortraitDiv">
                        <div class="AssetThumbnail">
                            <a href="#game-detail?id=${placeId}&universe=${universeId}" title="${name}">
                                <img src="${imageUrl}" alt="${name}" style="width:110px; height:110px; object-fit:cover;"/>
                            </a>
                        </div>
                        <div class="AssetDetails">
                            <div class="AssetName">
                                <a href="#game-detail?id=${placeId}&universe=${universeId}" title="${name}">${name}</a>
                            </div>
                            <div class="AssetCreator">
                                <span class="Label">Creator:</span> ${creatorHtml}
                            </div>
                        </div>
                    </div>
                </td>
            `;
        });

        html += '</tr></table>';
        return html;
    }

    let launchInProgress = false;

    function setupPlayButton(placeId) {
        const playBtn = document.getElementById('PlayButton');
        if (playBtn) {

            const newPlayBtn = playBtn.cloneNode(true);
            playBtn.parentNode.replaceChild(newPlayBtn, playBtn);

            const handler = function(e) {
                e.preventDefault();
                e.stopPropagation();

                if (launchInProgress) {
                    console.log('Launch already in progress, ignoring click');
                    return;
                }

                launchGame(placeId);
            };

            if (window.PerformanceUtils) {
                window.PerformanceUtils.addPageListener(PAGE_ID, newPlayBtn, 'click', handler);
            } else {
                newPlayBtn.addEventListener('click', handler);
            }
        }
    }

    async function launchGame(placeId) {
        console.log('Launching game:', placeId);

        try {
            const isLoggedIn = await window.RobloxClient?.auth?.isLoggedIn?.();
            if (!isLoggedIn) {
                console.log('User not logged in, showing sign-in prompt');
                if (window.showGameLaunchOverlay) {
                    window.showGameLaunchOverlay('Sign in required to play games. Returning to Rovloo Hub...');
                }

                setTimeout(() => {
                    if (window.hideGameLaunchOverlay) {
                        window.hideGameLaunchOverlay();
                    }
                    if (window.RobloxClient?.auth?.returnToHub) {
                        window.RobloxClient.auth.returnToHub();
                    }
                }, 2500);
                return;
            }
        } catch (authError) {
            console.error('Auth check failed:', authError);
        }

        if (launchInProgress) {
            console.log('Launch already in progress, ignoring');
            return;
        }
        launchInProgress = true;

        if (window.showGameLaunchOverlay) {
            window.showGameLaunchOverlay('Starting Roblox...');
        }

        try {
            let launched = false;
            let errorMessage = null;
            let wasCancelled = false;

            if (window.roblox?.launchGame) {
                console.log('Using window.roblox.launchGame...');
                try {
                    const result = await window.roblox.launchGame(placeId);
                    console.log('launchGame result:', result);
                    launched = result?.success === true;
                    wasCancelled = result?.cancelled === true;
                    if (!launched && result?.error) {
                        errorMessage = result.error;
                    }
                } catch (launchError) {
                    console.error('launchGame threw error:', launchError);
                    errorMessage = launchError.message || 'Unknown launch error';
                    launched = false;
                }

                if (wasCancelled) {
                    console.log('Game launch was cancelled');
                    if (window.hideGameLaunchOverlay) {
                        window.hideGameLaunchOverlay();
                    }
                    return;
                }

                if (launched) {

                    if (window.updateGameLaunchStatus) {
                        setTimeout(() => {
                            if (!window.isGameLaunchCancelled || !window.isGameLaunchCancelled()) {
                                window.updateGameLaunchStatus('The server is ready. Joining the game...');
                            }
                        }, 2000);
                    }

                    if (window.autoHideGameLaunchOverlay) {
                        window.autoHideGameLaunchOverlay(6000);
                    }
                }
            } else if (window.RobloxClient?.game?.launch) {
                console.log('Using window.RobloxClient.game.launch...');
                await window.RobloxClient.game.launch(placeId);
                launched = true;
                if (window.autoHideGameLaunchOverlay) {
                    window.autoHideGameLaunchOverlay(6000);
                }
            } else {

                console.log('Using fallback roblox-player protocol...');
                const launchUrl = `roblox-player:1+launchmode:play+gameinfo:+placelauncherurl:https://assetgame.roblox.com/game/PlaceLauncher.ashx?request=RequestGame&placeId=${placeId}`;
                window.location.href = launchUrl;
                launched = true;
                if (window.autoHideGameLaunchOverlay) {
                    window.autoHideGameLaunchOverlay(6000);
                }
            }

            if (!launched) {
                throw new Error(errorMessage || 'Failed to launch game. Make sure Roblox is installed.');
            }
        } catch (error) {
            console.error('Failed to launch game:', error);

            if (window.updateGameLaunchStatus) {
                let displayError = error.message || 'Failed to launch game';

                if (displayError.includes('authentication ticket')) {
                    displayError = 'Login expired. Please log in again.';
                } else if (displayError.includes('Not logged in')) {
                    displayError = 'Please log in to play games.';
                }
                window.updateGameLaunchStatus(displayError);
            }

            setTimeout(() => {
                if (window.hideGameLaunchOverlay) {
                    window.hideGameLaunchOverlay();
                }
            }, 3000);
        } finally {

            launchInProgress = false;
        }
    }

    async function joinServer(placeId, jobId) {
        console.log('Joining server:', placeId, jobId);

        try {
            const isLoggedIn = await window.RobloxClient?.auth?.isLoggedIn?.();
            if (!isLoggedIn) {
                console.log('User not logged in, showing sign-in prompt');
                if (window.showGameLaunchOverlay) {
                    window.showGameLaunchOverlay('Sign in required to play games. Returning to Rovloo Hub...');
                }
                setTimeout(() => {
                    if (window.hideGameLaunchOverlay) {
                        window.hideGameLaunchOverlay();
                    }
                    if (window.RobloxClient?.auth?.returnToHub) {
                        window.RobloxClient.auth.returnToHub();
                    }
                }, 2500);
                return;
            }
        } catch (authError) {
            console.error('Auth check failed:', authError);
        }

        if (launchInProgress) {
            console.log('Launch already in progress, ignoring');
            return;
        }
        launchInProgress = true;

        if (window.showGameLaunchOverlay) {
            window.showGameLaunchOverlay('Starting Roblox...');
        }

        try {
            let launched = false;
            let errorMessage = null;

            if (window.roblox?.joinGameInstance) {
                console.log('Using window.roblox.joinGameInstance...');
                try {
                    const result = await window.roblox.joinGameInstance(placeId, jobId);
                    console.log('joinGameInstance result:', result);
                    launched = result?.success === true;
                    if (!launched && result?.error) {
                        errorMessage = result.error;
                    }
                } catch (joinError) {
                    console.error('joinGameInstance threw error:', joinError);
                    errorMessage = joinError.message || 'Unknown join error';
                    launched = false;
                }

                if (launched) {

                    if (window.updateGameLaunchStatus) {
                        setTimeout(() => {
                            if (!window.isGameLaunchCancelled || !window.isGameLaunchCancelled()) {
                                window.updateGameLaunchStatus('The server is ready. Joining the game...');
                            }
                        }, 2000);
                    }

                    if (window.autoHideGameLaunchOverlay) {
                        window.autoHideGameLaunchOverlay(6000);
                    }
                }
            } else if (window.RobloxClient?.game?.joinInstance) {
                console.log('Using window.RobloxClient.game.joinInstance...');
                await window.RobloxClient.game.joinInstance(placeId, jobId);
                launched = true;
                if (window.autoHideGameLaunchOverlay) {
                    window.autoHideGameLaunchOverlay(6000);
                }
            } else {

                console.log('Using fallback roblox-player protocol for server join...');
                const launchUrl = `roblox-player:1+launchmode:play+gameinfo:${jobId}+placelauncherurl:https://assetgame.roblox.com/game/PlaceLauncher.ashx?request=RequestGameJob&placeId=${placeId}&gameId=${jobId}`;
                window.location.href = launchUrl;
                launched = true;
                if (window.autoHideGameLaunchOverlay) {
                    window.autoHideGameLaunchOverlay(6000);
                }
            }

            if (!launched) {
                throw new Error(errorMessage || 'Failed to join server. Make sure Roblox is installed.');
            }
        } catch (error) {
            console.error('Failed to join server:', error);
            if (window.updateGameLaunchStatus) {
                let displayError = error.message || 'Failed to join server';
                if (displayError.includes('authentication ticket')) {
                    displayError = 'Login expired. Please log in again.';
                } else if (displayError.includes('Not logged in')) {
                    displayError = 'Please log in to join servers.';
                }
                window.updateGameLaunchStatus(displayError);
            }
            setTimeout(() => {
                if (window.hideGameLaunchOverlay) {
                    window.hideGameLaunchOverlay();
                }
            }, 3000);
        } finally {

            launchInProgress = false;
        }
    }

    async function joinPrivateServer(placeId, accessCode, vipServerId) {
        console.log('Joining private server:', placeId, accessCode, vipServerId);

        try {
            const isLoggedIn = await window.RobloxClient?.auth?.isLoggedIn?.();
            if (!isLoggedIn) {
                console.log('User not logged in, showing sign-in prompt');
                if (window.showGameLaunchOverlay) {
                    window.showGameLaunchOverlay('Sign in required to play games. Returning to Rovloo Hub...');
                }
                setTimeout(() => {
                    if (window.hideGameLaunchOverlay) {
                        window.hideGameLaunchOverlay();
                    }
                    if (window.RobloxClient?.auth?.returnToHub) {
                        window.RobloxClient.auth.returnToHub();
                    }
                }, 2500);
                return;
            }
        } catch (authError) {
            console.error('Auth check failed:', authError);
        }

        if (launchInProgress) {
            console.log('Launch already in progress, ignoring');
            return;
        }
        launchInProgress = true;

        if (window.showGameLaunchOverlay) {
            window.showGameLaunchOverlay('Starting Roblox...');
        }

        try {
            let launched = false;
            let errorMessage = null;

            if (window.roblox?.joinPrivateServer) {
                console.log('Using window.roblox.joinPrivateServer...');
                try {
                    const result = await window.roblox.joinPrivateServer(placeId, accessCode, vipServerId);
                    console.log('joinPrivateServer result:', result);
                    launched = result?.success === true;
                    if (!launched && result?.error) {
                        errorMessage = result.error;
                    }
                } catch (joinError) {
                    console.error('joinPrivateServer threw error:', joinError);
                    errorMessage = joinError.message || 'Unknown join error';
                    launched = false;
                }

                if (launched) {
                    if (window.updateGameLaunchStatus) {
                        setTimeout(() => {
                            if (!window.isGameLaunchCancelled || !window.isGameLaunchCancelled()) {
                                window.updateGameLaunchStatus('The server is ready. Joining the game...');
                            }
                        }, 2000);
                    }

                    if (window.autoHideGameLaunchOverlay) {
                        window.autoHideGameLaunchOverlay(6000);
                    }
                }
            } else if (window.roblox?.launchGame) {

                console.log('Using window.roblox.launchGame with private server params...');
                try {
                    const result = await window.roblox.launchGame(placeId, { accessCode, vipServerId });
                    console.log('launchGame (private) result:', result);
                    launched = result?.success === true;
                    if (!launched && result?.error) {
                        errorMessage = result.error;
                    }
                } catch (launchError) {
                    console.error('launchGame (private) threw error:', launchError);
                    errorMessage = launchError.message || 'Unknown launch error';
                    launched = false;
                }

                if (launched && window.autoHideGameLaunchOverlay) {
                    window.autoHideGameLaunchOverlay(6000);
                }
            } else {

                console.log('Using fallback roblox-player protocol for private server...');
                let launchUrl = `roblox-player:1+launchmode:play+placelauncherurl:https://assetgame.roblox.com/game/PlaceLauncher.ashx?request=RequestPrivateGame&placeId=${placeId}`;
                if (accessCode) {
                    launchUrl += `&accessCode=${accessCode}`;
                }
                window.location.href = launchUrl;
                launched = true;
                if (window.autoHideGameLaunchOverlay) {
                    window.autoHideGameLaunchOverlay(6000);
                }
            }

            if (!launched) {
                throw new Error(errorMessage || 'Failed to join private server. Make sure Roblox is installed.');
            }
        } catch (error) {
            console.error('Failed to join private server:', error);
            if (window.updateGameLaunchStatus) {
                let displayError = error.message || 'Failed to join private server';
                if (displayError.includes('authentication ticket')) {
                    displayError = 'Login expired. Please log in again.';
                } else if (displayError.includes('Not logged in')) {
                    displayError = 'Please log in to join private servers.';
                }
                window.updateGameLaunchStatus(displayError);
            }
            setTimeout(() => {
                if (window.hideGameLaunchOverlay) {
                    window.hideGameLaunchOverlay();
                }
            }, 3000);
        } finally {

            launchInProgress = false;
        }
    }

    function showStatus(message) {
        const statusEl = document.getElementById('PlayStatus');
        if (statusEl) {
            statusEl.textContent = message;
        }
    }

    function setupFavoriteButton(universeId) {
        const favStar = document.getElementById('FavoriteStar');
        const favText = document.getElementById('FavoriteText');
        if (!favStar) return;

        const handler = async function(e) {
            e.preventDefault();

            let isLoggedIn = false;
            try {
                const currentUser = await window.roblox?.getCurrentUser();
                isLoggedIn = !!currentUser?.id;
            } catch (e) {}
            if (!isLoggedIn) {
                alert('You must be logged in to favorite games.');
                return;
            }

            const isFavorited = favStar.classList.contains('favorited');

            try {

                if (isFavorited) {
                    await window.roblox.setGameFavorite(universeId, false);
                    favStar.classList.remove('favorited');
                    favStar.classList.add('notFavorited');
                    favStar.title = 'Add to favorites';
                    if (favText) favText.textContent = 'Add to Favorites';
                } else {
                    await window.roblox.setGameFavorite(universeId, true);
                    favStar.classList.remove('notFavorited');
                    favStar.classList.add('favorited');
                    favStar.title = 'Remove from favorites';
                    if (favText) favText.textContent = 'Favorited';
                }

                const favCountEl = document.getElementById('FavoritesCount');
                if (favCountEl) {
                    const currentCount = parseInt(favCountEl.textContent.replace(/[^\d]/g, '')) || 0;
                    const newCount = isFavorited ? currentCount - 1 : currentCount + 1;
                    favCountEl.textContent = formatNumber(newCount);
                }
            } catch (error) {
                console.error('Failed to toggle favorite:', error);
                alert('Failed to update favorite status. Please try again.');
            }
        };

        if (window.PerformanceUtils) {
            window.PerformanceUtils.addPageListener(PAGE_ID, favStar, 'click', handler);
        } else {
            favStar.addEventListener('click', handler);
        }

        checkFavoriteStatus(universeId, favStar);
    }

    async function checkFavoriteStatus(universeId, favStar) {
        try {

            let isLoggedIn = false;
            try {
                const currentUser = await window.roblox?.getCurrentUser();
                isLoggedIn = !!currentUser?.id;
            } catch (e) {

            }
            if (!isLoggedIn) return;

            if (window.roblox?.getGameFavoriteStatus) {
                const status = await window.roblox.getGameFavoriteStatus(universeId);
                const favText = document.getElementById('FavoriteText');
                if (status?.isFavorited) {
                    favStar.classList.remove('notFavorited');
                    favStar.classList.add('favorited');
                    favStar.title = 'Remove from favorites';
                    if (favText) favText.textContent = 'Favorited';
                }
            }
        } catch (error) {
            console.error('Failed to check favorite status:', error);
        }
    }

    function setupVoteButtons(universeId) {
        const voteUpBtn = document.getElementById('VoteUpButton');
        const voteDownBtn = document.getElementById('VoteDownButton');

        if (!voteUpBtn || !voteDownBtn) return;

        const upHandler = async function(e) {
            e.preventDefault();
            await handleVote(universeId, true);
        };

        const downHandler = async function(e) {
            e.preventDefault();
            await handleVote(universeId, false);
        };

        if (window.PerformanceUtils) {
            window.PerformanceUtils.addPageListener(PAGE_ID, voteUpBtn, 'click', upHandler);
            window.PerformanceUtils.addPageListener(PAGE_ID, voteDownBtn, 'click', downHandler);
        } else {
            voteUpBtn.addEventListener('click', upHandler);
            voteDownBtn.addEventListener('click', downHandler);
        }
    }

    async function handleVote(universeId, isUpvote) {

        let isLoggedIn = false;
        try {
            const currentUser = await window.roblox?.getCurrentUser();
            isLoggedIn = !!currentUser?.id;
        } catch (e) {}
        if (!isLoggedIn) {
            alert('You must be logged in to vote on games.');
            return;
        }

        try {

            if (window.roblox?.voteGame) {
                const result = await window.roblox.voteGame(universeId, isUpvote);

                if (result?.errors && result.errors.length > 0) {
                    const errorMsg = result.errors[0]?.message || result.errors[0]?.userFacingMessage || 'Unknown error';
                    alert(errorMsg);
                    return;
                }

                updateVoteButtonStates(isUpvote);

                const votes = await window.roblox.getGameVotes([universeId]);
                if (votes?.data?.[0]) {
                    const upVotesEl = document.getElementById('VoteUpCount');
                    const downVotesEl = document.getElementById('VoteDownCount');

                    const upVotes = votes.data[0].upVotes || 0;
                    const downVotes = votes.data[0].downVotes || 0;

                    if (upVotesEl && downVotesEl) {
                        upVotesEl.textContent = formatVoteCount(upVotes);
                        downVotesEl.textContent = formatVoteCount(downVotes);
                    }

                    updateVoteBar(upVotes, downVotes);
                }

                if (window.ReviewComponent) {
                    window.ReviewComponent.userGameVote = isUpvote;
                    if (window.ReviewComponent.renderReviewForm) {
                        window.ReviewComponent.renderReviewForm();
                    }

                    const reviewsTab = document.getElementById('GameDetailReviewsTab');
                    const reviewsContent = document.getElementById('GameDetailReviewsContent');
                    if (reviewsTab && reviewsContent) {

                        document.querySelectorAll('.game-detail-tab').forEach(t => t.classList.remove('active'));
                        document.querySelectorAll('.game-detail-tab-content').forEach(c => c.classList.remove('active'));

                        reviewsTab.classList.add('active');
                        reviewsContent.classList.add('active');
                    }
                }
            }
        } catch (error) {
            console.error('Failed to vote:', error);
            const errorMsg = error.message || '';
            if (errorMsg.includes('play') || errorMsg.includes('Play')) {
                alert('You must play the game before you can vote on it.');
            } else if (errorMsg.includes('already voted')) {
                alert('You have already voted on this game.');
            } else {
                alert(errorMsg || 'Failed to submit vote. Please try again.');
            }
        }
    }

    function setupTabs() {
        const publicServersTab = document.getElementById('PublicServersTab');
        const privateServersTab = document.getElementById('PrivateServersTab');
        const reviewsTab = document.getElementById('GameDetailReviewsTab');
        const recommendationsTab = document.getElementById('RecommendationsTab');
        const publicServersContent = document.getElementById('PublicServersContent');
        const privateServersContent = document.getElementById('PrivateServersContent');
        const reviewsContent = document.getElementById('GameDetailReviewsContent');
        const recommendationsContent = document.getElementById('RecommendationsContent');

        if (!publicServersTab || !privateServersTab || !recommendationsTab) {
            return;
        }

        const allTabs = [publicServersTab, privateServersTab, reviewsTab, recommendationsTab].filter(Boolean);
        const allContents = [publicServersContent, privateServersContent, reviewsContent, recommendationsContent].filter(Boolean);

        const switchToTab = (activeTab, activeContent) => {

            allTabs.forEach(tab => tab.className = 'StandardTabGray');

            allContents.forEach(content => { if (content) content.style.display = 'none'; });

            if (activeTab) activeTab.className = 'StandardTabGrayActive';

            if (activeContent) activeContent.style.display = 'block';
        };

        const publicServersHandler = function() {
            switchToTab(publicServersTab, publicServersContent);
        };

        const privateServersHandler = function() {
            switchToTab(privateServersTab, privateServersContent);
        };

        const reviewsHandler = function() {
            switchToTab(reviewsTab, reviewsContent);

            if (window.ReviewComponent && window.ReviewComponent.placeId) {
                setTimeout(() => {
                    if (window.ReviewComponent.renderReviewsList) {
                        window.ReviewComponent.renderReviewsList();
                    }
                }, 50);
            }
        };

        const recommendationsHandler = function() {
            switchToTab(recommendationsTab, recommendationsContent);
        };

        if (window.PerformanceUtils) {
            window.PerformanceUtils.addPageListener(PAGE_ID, publicServersTab, 'click', publicServersHandler);
            window.PerformanceUtils.addPageListener(PAGE_ID, privateServersTab, 'click', privateServersHandler);
            if (reviewsTab) window.PerformanceUtils.addPageListener(PAGE_ID, reviewsTab, 'click', reviewsHandler);
            window.PerformanceUtils.addPageListener(PAGE_ID, recommendationsTab, 'click', recommendationsHandler);
        } else {
            publicServersTab.addEventListener('click', publicServersHandler);
            privateServersTab.addEventListener('click', privateServersHandler);
            if (reviewsTab) reviewsTab.addEventListener('click', reviewsHandler);
            recommendationsTab.addEventListener('click', recommendationsHandler);
        }
    }

    function formatNumber(num) {
        if (num >= 1000000000) {
            return (num / 1000000000).toFixed(1) + 'B';
        } else if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toLocaleString();
    }

    function formatPlayerCountForTab(num) {
        if (num >= 1000000000) {
            return Math.floor(num / 1000000000) + 'B+';
        } else if (num >= 1000000) {
            return Math.floor(num / 1000000) + 'M+';
        } else if (num >= 1000) {
            return Math.floor(num / 1000) + 'K+';
        }
        return num.toLocaleString();
    }

    function updatePublicServersTabText(playerCount) {
        const tab = document.getElementById('PublicServersTab');
        if (tab) {
            const span = tab.querySelector('span');
            if (span) {
                if (playerCount > 0) {
                    span.textContent = `Public Servers (${formatPlayerCountForTab(playerCount)})`;

                    span.title = `${playerCount.toLocaleString()} players currently playing`;
                } else {
                    span.textContent = 'Public Servers';
                    span.title = '';
                }
            }
        }
    }

    function formatAvatarType(avatarType, avatarRules = null) {

        if (avatarRules) {
            const maxScales = avatarRules.universeAvatarMaxScales;
            const isRthroEnabled = maxScales &&
                (maxScales.proportion > 0 || maxScales.bodyType > 0);

            const baseType = avatarRules.gameAvatarType || avatarType;

            if (baseType === 'MorphToR15' && isRthroEnabled) {
                return 'R15 + Rthro';
            } else if (baseType === 'PlayerChoice' && isRthroEnabled) {
                return 'R6/R15 + Rthro';
            }

            switch (baseType) {
                case 'MorphToR6':
                    return 'R6';
                case 'MorphToR15':
                    return 'R15';
                case 'PlayerChoice':
                    return 'R6/R15';
                default:
                    return baseType || 'Unknown';
            }
        }

        switch (avatarType) {
            case 'MorphToR6':
                return 'R6';
            case 'MorphToR15':
                return 'R15';
            case 'PlayerChoice':
                return 'R6/R15';
            case 'MorphToRthro':
            case 'Rthro':
                return 'Rthro';
            default:
                return avatarType || 'Unknown';
        }
    }

    async function loadAvatarTypeDetails(universeId, element) {
        try {
            const avatarRules = await window.roblox.getGameAvatarRules(universeId);
            if (avatarRules && element) {
                element.textContent = formatAvatarType(null, avatarRules);
            }
        } catch (e) {

            console.warn('Failed to load avatar rules:', e);
        }
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric'
        });
    }

    function formatRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            if (diffHours === 0) {
                const diffMins = Math.floor(diffMs / (1000 * 60));
                return diffMins <= 1 ? 'just now' : `${diffMins} minutes ago`;
            }
            return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
        } else if (diffDays === 1) {
            return '1 day ago';
        } else if (diffDays < 30) {
            return `${diffDays} days ago`;
        } else if (diffDays < 365) {
            const months = Math.floor(diffDays / 30);
            return months === 1 ? '1 month ago' : `${months} months ago`;
        } else {
            const years = Math.floor(diffDays / 365);
            return years === 1 ? '1 year ago' : `${years} years ago`;
        }
    }

    function reset() {

        if (window.PerformanceUtils) {
            window.PerformanceUtils.cleanupPage(PAGE_ID);
            window.PerformanceUtils.abortPageRequests(PAGE_ID);
        }

        currentPlaceId = null;
        currentUniverseId = null;
        isLoading = false;
        currentPlayingCount = 0;

        allBadges = [];
        allBadgeThumbnails = {};
        userOwnedBadges.clear();
        currentBadgePage = 1;

        playerAvatarCache = {};

        allPrivateServers = [];
        currentPrivateServerPage = 1;

        allPublicServers = [];
        currentServerPage = 1;
        currentServerRequestId = 0;
        isBestConnectionProcessing = false;

        const container = document.getElementById('game-detail-content');
        if (container) {
            container.innerHTML = '';
        }
    }

    window.GameDetailPage = {
        load: loadGameDetailPage,
        launchGame: launchGame,
        joinServer: joinServer,
        reset: reset
    };

    window.loadGameDetailPage = loadGameDetailPage;

    window.loadRovlooStats = loadRovlooStats;
})();

async function processServersWithLocalServer(sortedServers, placeId, updateLoadingStatus) {
    try {

        if (!window._regionLatencyRanking) {
            console.log('Measuring latency to all Roblox regions...');
            const regionResults = await window.RobloxClient?.ping?.measureAllRegions();
            if (regionResults && regionResults.length > 0) {

                window._regionLatencyRanking = {};
                window._regionLatencyData = regionResults;
                regionResults.forEach((r, index) => {
                    window._regionLatencyRanking[r.region] = index;
                });
                console.log('Top 5 regions:', regionResults.slice(0, 5).map(r => `${r.region}: ~${r.latency}ms`).join(', '));
            }
        }

        updateLoadingStatus(`Analyzing all ${sortedServers.length} servers...`);

        const userRegionRanking = {
            ...window._regionLatencyRanking,
            _data: window._regionLatencyData
        };

        const result = await window.RobloxClient?.localServer?.resolveServers(
            sortedServers,
            placeId,
            userRegionRanking
        );

        if (result?.success && result.results) {

            const resultMap = new Map();
            result.results.forEach(r => {
                if (r.regionString) {
                    resultMap.set(r.serverId, r);
                }
            });

            let resolvedCount = 0;
            sortedServers.forEach(server => {
                const serverResult = resultMap.get(server.id);
                if (serverResult) {
                    server.regionString = serverResult.regionString;
                    server.estimatedLatency = serverResult.estimatedLatency;
                    resolvedCount++;
                }
            });

            console.log(`Local server resolved ${resolvedCount}/${sortedServers.length} servers (${result.stats?.cached || 0} from cache)`);
            updateLoadingStatus(`Resolved ${resolvedCount} server regions`);

        } else {
            console.error('Local server processing failed:', result?.error);
            updateLoadingStatus('Local server failed, falling back to client-side...');

            await processServersClientSide(sortedServers, placeId, updateLoadingStatus);
        }

    } catch (error) {
        console.error('Local server processing error:', error);
        updateLoadingStatus('Local server error, falling back to client-side...');

        await processServersClientSide(sortedServers, placeId, updateLoadingStatus);
    }
}

async function processServersClientSide(sortedServers, placeId, updateLoadingStatus) {
    try {

        if (!window._regionLatencyRanking) {
            console.log('Measuring latency to all Roblox regions...');
            const regionResults = await window.RobloxClient?.ping?.measureAllRegions();
            if (regionResults && regionResults.length > 0) {

                window._regionLatencyRanking = {};
                window._regionLatencyData = regionResults;
                regionResults.forEach((r, index) => {
                    window._regionLatencyRanking[r.region] = index;
                });

                console.log('Top 5 regions:', regionResults.slice(0, 5).map(r => `${r.region}: ~${r.latency}ms`).join(', '));
                updateLoadingStatus(`Best region: ${regionResults[0]?.region} (~${regionResults[0]?.latency}ms)`);
            }
        } else {
            const bestRegion = window._regionLatencyData?.[0];
            if (bestRegion) {
                updateLoadingStatus(`Best region: ${bestRegion.region} (~${bestRegion.latency}ms)`);
            }
        }

        let serversToResolve;
        if (sortedServers.length <= 100) {

            serversToResolve = sortedServers;
        } else {

            const firstBatch = sortedServers.slice(0, 50);
            const remaining = sortedServers.slice(50);

            const sampleSize = Math.min(50, remaining.length);
            const randomSample = [];

            const weightedRemaining = remaining.sort((a, b) => (b.playing || 0) - (a.playing || 0));

            const step = Math.max(1, Math.floor(weightedRemaining.length / sampleSize));
            for (let i = 0; i < weightedRemaining.length && randomSample.length < sampleSize; i += step) {
                randomSample.push(weightedRemaining[i]);
            }

            serversToResolve = [...firstBatch, ...randomSample];
            console.log(`Large server list (${sortedServers.length}): analyzing ${serversToResolve.length} strategically sampled servers`);
        }
        let resolvedCount = 0;
        let errorCount = 0;

        console.log(`Resolving regions for ${serversToResolve.length} servers...`);
        updateLoadingStatus(`Detecting server regions (0/${serversToResolve.length})...`);

        const REGION_CACHE_VERSION = 2;
        const cacheKey = `serverRegions_v${REGION_CACHE_VERSION}_${placeId}`;
        let cachedRegions = {};
        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                cachedRegions = JSON.parse(cached);

                const oneHourAgo = Date.now() - (60 * 60 * 1000);
                Object.keys(cachedRegions).forEach(serverId => {
                    if (cachedRegions[serverId].timestamp < oneHourAgo) {
                        delete cachedRegions[serverId];
                    }
                });
            }
        } catch (e) {
            cachedRegions = {};
        }

        const batchSize = 10;
        for (let i = 0; i < serversToResolve.length; i += batchSize) {
            const batch = serversToResolve.slice(i, i + batchSize);

            await Promise.all(batch.map(async (server) => {
                try {

                    if (cachedRegions[server.id]) {
                        const cached = cachedRegions[server.id];
                        server.regionString = cached.regionString;
                        server.estimatedLatency = cached.estimatedLatency;
                        resolvedCount++;
                        return;
                    }

                    const connInfo = await window.robloxAPI.getServerConnectionInfo(placeId, server.id);

                    if (!connInfo) {
                        errorCount++;
                        return;
                    }

                    if (connInfo.status === 22) {
                        console.log(`Server ${server.id} is full (status 22)`);
                        return;
                    }

                    if (resolvedCount === 0 && connInfo.joinScript) {
                        console.log('Sample server connection info:', JSON.stringify(connInfo).substring(0, 500));
                    }

                    const ip = connInfo?.joinScript?.UdmuxEndpoints?.[0]?.Address ||
                               connInfo?.joinScript?.MachineAddress;

                    if (ip) {
                        const regionInfo = await window.RobloxClient?.region?.resolveIp(ip);
                        if (regionInfo) {

                            server.regionString = regionInfo.locationString;

                            let latencyRegionKey = regionInfo.regionKey;
                            if (regionInfo.routedTo) {
                                latencyRegionKey = regionInfo.routedTo;
                            }
                            const rank = window._regionLatencyRanking?.[latencyRegionKey];
                            server.estimatedLatency = rank !== undefined ? window._regionLatencyData[rank]?.latency ?? 9999 : 9999;
                            resolvedCount++;

                            cachedRegions[server.id] = {
                                regionString: server.regionString,
                                estimatedLatency: server.estimatedLatency,
                                timestamp: Date.now()
                            };
                        } else {

                            server.regionString = `Unknown`;
                            server.estimatedLatency = 9999;
                            resolvedCount++;

                            cachedRegions[server.id] = {
                                regionString: server.regionString,
                                estimatedLatency: server.estimatedLatency,
                                timestamp: Date.now()
                            };
                        }
                    } else if (connInfo.status && connInfo.status !== 0 && connInfo.status !== 2 && connInfo.status !== 6) {

                        console.warn(`Server ${server.id} status: ${connInfo.status} - ${connInfo.message || 'unknown'}`);
                    }
                } catch (e) {
                    errorCount++;
                }
            }));

            updateLoadingStatus(`Detecting server regions (${Math.min(i + batchSize, serversToResolve.length)}/${serversToResolve.length})...`);

            if (i + batchSize < serversToResolve.length) {
                await new Promise(r => setTimeout(r, 150));
            }
        }

        console.log(`Resolved regions for ${resolvedCount}/${serversToResolve.length} servers (${errorCount} errors)`);

        try {
            localStorage.setItem(cacheKey, JSON.stringify(cachedRegions));
        } catch (e) {
            console.warn('Failed to save server region cache:', e);
        }

        if (serversToResolve.length < sortedServers.length) {
            startBackgroundProcessing(sortedServers, serversToResolve, placeId, cachedRegions);
        }

    } catch (error) {
        console.error('Client-side server processing error:', error);
        throw error;
    }
}

function startBackgroundProcessing(sortedServers, serversToResolve, placeId, cachedRegions) {
    const remainingServers = sortedServers.slice(serversToResolve.length);
    console.log(`Starting background processing for ${remainingServers.length} additional servers...`);

    setTimeout(async () => {
        try {
            let bgResolvedCount = 0;
            const bgBatchSize = 3;

            const REGION_CACHE_VERSION = 2;
            const cacheKey = `serverRegions_v${REGION_CACHE_VERSION}_${placeId}`;

            for (let i = 0; i < remainingServers.length && i < 50; i += bgBatchSize) {
                const bgBatch = remainingServers.slice(i, i + bgBatchSize);

                await Promise.all(bgBatch.map(async (server) => {
                    try {
                        if (cachedRegions[server.id]) return;

                        const connInfo = await window.robloxAPI.getServerConnectionInfo(placeId, server.id);
                        if (!connInfo || connInfo.status === 22) return;

                        const ip = connInfo?.joinScript?.UdmuxEndpoints?.[0]?.Address ||
                                   connInfo?.joinScript?.MachineAddress;

                        if (ip) {
                            const regionInfo = await window.RobloxClient?.region?.resolveIp(ip);
                            if (regionInfo) {

                                let latencyRegionKey = regionInfo.regionKey;
                                if (regionInfo.routedTo) {
                                    latencyRegionKey = regionInfo.routedTo;
                                }
                                const rank = window._regionLatencyRanking?.[latencyRegionKey];
                                cachedRegions[server.id] = {
                                    regionString: regionInfo.locationString,
                                    estimatedLatency: rank !== undefined ? window._regionLatencyData[rank]?.latency ?? 9999 : 9999,
                                    timestamp: Date.now()
                                };
                                bgResolvedCount++;
                            }
                        }
                    } catch (e) {

                    }
                }));

                if (i + bgBatchSize < remainingServers.length) {
                    await new Promise(r => setTimeout(r, 500));
                }
            }

            if (bgResolvedCount > 0) {
                try {
                    localStorage.setItem(cacheKey, JSON.stringify(cachedRegions));
                    console.log(`Background processing: cached ${bgResolvedCount} additional server regions`);
                } catch (e) {

                }
            }
        } catch (e) {
            console.warn('Background server processing failed:', e);
        }
    }, 2000);
}

function sortServersByLatency(sortedServers) {
    sortedServers.sort((a, b) => {
        const latencyA = a.estimatedLatency ?? 9999;
        const latencyB = b.estimatedLatency ?? 9999;

        if (latencyA !== latencyB) return latencyA - latencyB;

        const pingA = a.ping ?? 9999;
        const pingB = b.ping ?? 9999;
        if (pingA !== pingB) return pingA - pingB;

        return (b.playing || 0) - (a.playing || 0);
    });

    const resolvedServers = sortedServers.filter(s => s.regionString);
    console.log('Sorted servers by region:', resolvedServers.slice(0, 10).map(s =>
        `${s.regionString} (~${s.estimatedLatency}ms, API: ${s.ping}ms)`
    ).join(', '));
}
