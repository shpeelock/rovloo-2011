

let currentFeaturedGameRequestId = 0;
let currentHomeUserAvatarRequestId = 0;

async function loadHomePage() {
  const container = document.getElementById('page-home');
  if (!container) return;

  try {
    
    initVideoPlayer();

    loadFeaturedGame();

    loadRandomFacts();

    const isLoggedIn = await window.RobloxClient.auth.isLoggedIn();
    if (isLoggedIn) {
      await updateLoggedInUI();
    }
  } catch (error) {
    console.error('Failed to load home page:', error);
    if (window.showErrorPage) {
      window.showErrorPage('Failed to load home page: ' + error.message, 'home-content');
    }
  }
}

function toggleVideoPlay() {
  const video = document.getElementById('homeVideo');
  const playBtn = document.getElementById('videoPlayBtn');
  if (!video) return;
  
  if (video.paused) {
    video.play().catch(err => console.log('Play error:', err));
    if (playBtn) playBtn.textContent = '⏸';
  } else {
    video.pause();
    if (playBtn) playBtn.textContent = '▶';
  }
}

function seekVideo(e) {
  const video = document.getElementById('homeVideo');
  const container = document.getElementById('videoProgressContainer');
  if (!video || !container) return;
  
  const rect = container.getBoundingClientRect();
  const percent = (e.clientX - rect.left) / rect.width;
  video.currentTime = percent * video.duration;
}

function toggleVideoMute() {
  const video = document.getElementById('homeVideo');
  const muteBtn = document.getElementById('videoMuteBtn');
  const volumeSlider = document.getElementById('videoVolume');
  if (!video) return;
  
  video.muted = !video.muted;
  if (muteBtn) muteBtn.textContent = video.muted ? '🔇' : '🔊';
  if (volumeSlider) volumeSlider.value = video.muted ? 0 : video.volume;
}

function setVideoVolume(value) {
  const video = document.getElementById('homeVideo');
  const muteBtn = document.getElementById('videoMuteBtn');
  if (!video) return;
  
  video.volume = value;
  video.muted = value == 0;
  if (muteBtn) muteBtn.textContent = video.muted ? '🔇' : '🔊';
}

function toggleVideoFullscreen() {
  const container = document.getElementById('videoPlayerContainer');
  if (!container) return;
  
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    container.requestFullscreen().catch(err => console.log('Fullscreen error:', err));
  }
}

function initVideoPlayer() {
  const video = document.getElementById('homeVideo');
  const playBtn = document.getElementById('videoPlayBtn');
  const progress = document.getElementById('videoProgress');
  const timeDisplay = document.getElementById('videoTime');

  if (!video) return;

  function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  video.addEventListener('play', () => {
    if (playBtn) playBtn.textContent = '⏸';
  });

  video.addEventListener('pause', () => {
    if (playBtn) playBtn.textContent = '▶';
  });

  video.addEventListener('timeupdate', () => {
    if (progress) {
      const percent = (video.currentTime / video.duration) * 100;
      progress.style.width = percent + '%';
    }
    if (timeDisplay) {
      timeDisplay.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration || 0)}`;
    }
  });

  video.addEventListener('ended', () => {
    if (playBtn) playBtn.textContent = '▶';
  });
}

async function loadFeaturedGame() {
  const requestId = ++currentFeaturedGameRequestId;

  const existingWrapper = document.querySelector('.creator-overlay-wrapper');
  if (existingWrapper) {
    const existingOverlay = existingWrapper.querySelector('.obc-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }
  }

  const creatorAvatarEl = document.getElementById('featuredCreatorAvatar');
  const creatorNameEl = document.getElementById('featuredCreatorName');
  if (creatorAvatarEl) {
    creatorAvatarEl.src = 'images/spinners/spinner100x100.gif'; 
  }
  if (creatorNameEl) {
    creatorNameEl.textContent = 'Loading...';
    creatorNameEl.onclick = null;
  }

  const gameImageEl = document.getElementById('featuredGameImage');
  const gameNameEl = document.getElementById('featuredGameName');
  if (gameImageEl) {
    gameImageEl.src = 'images/spinners/spinner100x100.gif';
  }
  if (gameNameEl) {
    gameNameEl.textContent = 'Loading...';
  }
  
  try {
    
    let featuredGame = null;

    if (window.robloxAPI && window.robloxAPI.getGameSorts) {
      const sortsData = await window.robloxAPI.getGameSorts();

      if (requestId !== currentFeaturedGameRequestId) return;

      if (sortsData?.sorts && sortsData.sorts.length > 0) {
        
        for (const sort of sortsData.sorts) {
          if (sort.games && sort.games.length > 0) {
            
            const randomIndex = Math.floor(Math.random() * Math.min(5, sort.games.length));
            featuredGame = sort.games[randomIndex];
            break;
          }
        }
      }
    }

    if (featuredGame) {
      
      const nameEl = document.getElementById('featuredGameName');
      const imageEl = document.getElementById('featuredGameImage');
      const linkEl = document.getElementById('featuredGameLink');
      const playBtn = document.getElementById('featuredPlayBtn');
      const visitsEl = document.getElementById('featuredGameVisits');
      const favoritesEl = document.getElementById('featuredGameFavorites');
      const updatedEl = document.getElementById('featuredGameUpdated');
      const creatorNameEl = document.getElementById('featuredCreatorName');

      if (nameEl) nameEl.textContent = truncateText(featuredGame.name || 'Unknown Game', 28);
      if (visitsEl) visitsEl.textContent = formatNumber(featuredGame.totalUpVotes || 0) + ' times';
      if (favoritesEl) favoritesEl.textContent = formatNumber(featuredGame.totalUpVotes || 0) + ' times';

      const universeId = featuredGame.universeId;
      if (imageEl && universeId) {
        try {
          
          if (window.roblox && window.roblox.getGameThumbnails) {
            const thumbResult = await window.roblox.getGameThumbnails([universeId], '768x432');
            
            if (requestId !== currentFeaturedGameRequestId) return;
            if (thumbResult?.data && thumbResult.data[0]?.thumbnails?.[0]?.imageUrl) {
              imageEl.src = thumbResult.data[0].thumbnails[0].imageUrl;
            } else if (featuredGame.imageUrl) {
              imageEl.src = featuredGame.imageUrl;
            }
          } else if (featuredGame.imageUrl) {
            imageEl.src = featuredGame.imageUrl;
          }
        } catch (e) {
          console.log('Could not load game thumbnail:', e);
          if (requestId === currentFeaturedGameRequestId && featuredGame.imageUrl) {
            imageEl.src = featuredGame.imageUrl;
          }
        }
      } else if (imageEl && featuredGame.imageUrl) {
        imageEl.src = featuredGame.imageUrl;
      }

      const placeId = featuredGame.placeId || featuredGame.rootPlaceId;
      if (placeId) {
        
        if (linkEl) {
          linkEl.href = `#game-detail?placeId=${placeId}`;
          linkEl.onclick = null; 
        }
        
        if (playBtn) {
          playBtn.href = '#';
          playBtn.onclick = () => { launchGame(placeId); return false; };
        }
      }

      if (featuredGame.universeId) {
        try {
          const details = await window.robloxAPI.getGameDetails([featuredGame.universeId]);
          
          if (requestId !== currentFeaturedGameRequestId) return;
          if (details?.data && details.data[0]) {
            const game = details.data[0];
            if (visitsEl) visitsEl.textContent = formatNumber(game.visits || 0) + ' times';
            if (favoritesEl) favoritesEl.textContent = formatNumber(game.favoritedCount || 0) + ' times';
            if (updatedEl) updatedEl.textContent = formatTimeAgo(game.updated);
            if (creatorNameEl) {
              creatorNameEl.textContent = game.creator?.name || 'Unknown';
              creatorNameEl.href = '#';
              if (game.creator?.type === 'Group') {
                creatorNameEl.onclick = () => {
                  if (game.creator?.id) {
                    navigateTo('groups', { groupId: game.creator.id });
                  }
                  return false;
                };
              } else {
                creatorNameEl.onclick = () => {
                  if (game.creator?.id) {
                    viewProfile(game.creator.id);
                  }
                  return false;
                };
              }
            }

            if (game.creator?.id) {
              if (game.creator?.type === 'Group') {
                loadCreatorGroupImage(game.creator.id, requestId);
              } else {
                loadCreatorAvatar(game.creator.id, requestId);
              }
            }
          }
        } catch (e) {
          console.log('Could not load game details:', e);
        }
      }
    } else {
      
      const nameEl = document.getElementById('featuredGameName');
      if (nameEl) nameEl.textContent = 'Browse Games to Discover!';
    }
  } catch (error) {
    console.error('Failed to load featured game:', error);
    if (requestId === currentFeaturedGameRequestId) {
      const nameEl = document.getElementById('featuredGameName');
      if (nameEl) nameEl.textContent = 'Click to explore games';
    }
  }
}

async function loadCreatorAvatar(userId, requestId) {
  try {
    const avatarEl = document.getElementById('featuredCreatorAvatar');
    const linkEl = document.getElementById('featuredCreatorLink');

    const thumbnails = await window.roblox.getUserThumbnails([userId], '352x352', 'AvatarThumbnail');

    if (requestId !== undefined && requestId !== currentFeaturedGameRequestId) {
      console.log('Creator avatar request cancelled (stale):', userId);
      return;
    }
    
    if (avatarEl && thumbnails?.data && thumbnails.data[0]?.imageUrl) {
      avatarEl.src = thumbnails.data[0].imageUrl;
    }
    
    if (linkEl) {
      linkEl.onclick = () => { viewProfile(userId); return false; };
    }

    const clippedContainer = avatarEl?.parentElement?.parentElement;
    if (clippedContainer) {
      
      let overlayWrapper = clippedContainer.parentElement?.querySelector('.creator-overlay-wrapper');
      if (!overlayWrapper) {
        overlayWrapper = document.createElement('div');
        overlayWrapper.className = 'creator-overlay-wrapper';
        overlayWrapper.style.cssText = 'position: relative; display: inline-block;';
        clippedContainer.parentElement.insertBefore(overlayWrapper, clippedContainer);
        overlayWrapper.appendChild(clippedContainer);
      }

      const existingOverlay = overlayWrapper.querySelector('.obc-overlay');
      if (existingOverlay) {
        existingOverlay.remove();
      }

      if (requestId !== undefined && requestId !== currentFeaturedGameRequestId) return;

      try {
        let hasPremium = null;
        
        if (window.getPremiumStatus) {
          hasPremium = await window.getPremiumStatus(userId);
        } else if (window.premiumStatusCache) {
          const cached = window.premiumStatusCache.get(String(userId));
          if (cached && (Date.now() - cached.timestamp < 5 * 60 * 1000)) {
            hasPremium = cached.value;
          } else {
            hasPremium = await window.roblox.validatePremiumMembership(userId);
            window.premiumStatusCache.set(String(userId), { value: hasPremium, timestamp: Date.now() });
          }
        }

        if (requestId !== undefined && requestId !== currentFeaturedGameRequestId) {
          return;
        }
        
        if (hasPremium === true) {
          
          const bcType = window.isRandomizeBCEnabled && window.isRandomizeBCEnabled() 
              ? window.getBCTypeForUser(userId) 
              : 'OBC';
          const overlayImage = window.getBCOverlayImage 
              ? window.getBCOverlayImage(bcType) 
              : 'images/icons/overlay_obcOnly.png';
          
          const overlay = document.createElement('img');
          overlay.src = overlayImage;
          overlay.alt = bcType;
          overlay.className = 'obc-overlay';
          overlay.style.cssText = 'position: absolute; bottom: 0; left: 0; width: 55px; height: auto; pointer-events: none;';
          overlayWrapper.appendChild(overlay);
        }
      } catch (e) {
        console.log('Premium check failed for creator:', e);
      }
    }
  } catch (e) {
    console.log('Could not load creator avatar:', e);
  }
}

async function loadCreatorGroupImage(groupId, requestId) {
  try {
    const avatarEl = document.getElementById('featuredCreatorAvatar');
    const linkEl = document.getElementById('featuredCreatorLink');

    const thumbnails = await window.roblox.getGroupThumbnails([groupId], '150x150');

    if (requestId !== undefined && requestId !== currentFeaturedGameRequestId) {
      console.log('Creator group image request cancelled (stale):', groupId);
      return;
    }
    
    if (avatarEl && thumbnails?.data && thumbnails.data[0]?.imageUrl) {
      avatarEl.src = thumbnails.data[0].imageUrl;
      
      avatarEl.style.width = '100%';
      avatarEl.style.marginTop = '0';
      avatarEl.style.marginLeft = '0';
    }
    
    if (linkEl) {
      linkEl.onclick = () => { 
        navigateTo('groups', { groupId: groupId }); 
        return false; 
      };
    }

    const clippedContainer = avatarEl?.parentElement?.parentElement;
    if (clippedContainer) {
      const overlayWrapper = clippedContainer.parentElement?.querySelector('.creator-overlay-wrapper');
      if (overlayWrapper) {
        const existingOverlay = overlayWrapper.querySelector('.obc-overlay');
        if (existingOverlay) {
          existingOverlay.remove();
        }
      }
    }
  } catch (e) {
    console.log('Could not load creator group image:', e);
  }
}

let randomFactsIntervalId = null;
window.randomFactsIntervalId = randomFactsIntervalId;

function loadRandomFacts() {
  const facts = [
    'Millions of games are available to play!',
    'Users have visited games billions of times',
    'Create your own games with Roblox Studio',
    'Join groups to meet players with similar interests',
    'Earn badges by completing in-game achievements',
    'Customize your avatar with thousands of items',
    'Play with friends from around the world',
    'New games are published every day'
  ];

  const fact1El = document.getElementById('randomFact1');
  const fact2El = document.getElementById('randomFact2');
  
  if (!fact1El || !fact2El) return;

  if (randomFactsIntervalId) {
    clearInterval(randomFactsIntervalId);
  }
  if (window.randomFactsIntervalId) {
    clearInterval(window.randomFactsIntervalId);
  }
  
  let factIndex = 0;
  
  function getNextFact() {
    const fact = facts[factIndex];
    factIndex = (factIndex + 1) % facts.length;
    return fact;
  }

  fact1El.style.transition = 'opacity 2s ease-in-out';
  fact2El.style.transition = 'opacity 2s ease-in-out';

  fact1El.textContent = getNextFact();
  fact2El.textContent = getNextFact();
  fact1El.style.opacity = '1';
  fact2El.style.opacity = '1';

  let showingFact1 = true;
  
  randomFactsIntervalId = window.randomFactsIntervalId = setInterval(() => {
    if (showingFact1) {
      
      fact1El.style.opacity = '0';
      
      setTimeout(() => {
        fact1El.textContent = getNextFact();
        fact1El.style.opacity = '1';
      }, 2000);
    } else {
      
      fact2El.style.opacity = '0';
      
      setTimeout(() => {
        fact2El.textContent = getNextFact();
        fact2El.style.opacity = '1';
      }, 2000);
    }
    showingFact1 = !showingFact1;
  }, 4000); 
}

async function updateLoggedInUI() {
  try {
    const user = await window.RobloxClient.api.getCurrentUser();

    const signUpBtn = document.querySelector('.SignUpAndPlay');
    if (signUpBtn) {
      signUpBtn.style.display = 'none';
    }

    const loginBox = document.querySelector('#page-home .DarkGradientBox');
    if (loginBox && user) {
      loginBox.style.height = 'auto';
      loginBox.innerHTML = `
        <div class="DGB_Header">Logged in</div>
        <div class="DGB_Content" style="text-align: center;">
          <div id="home-user-avatar" style="width: 140px; height: 200px; margin: 0 auto; position: relative; overflow: hidden;">
            <img src="images/spinners/spinner100x100.gif" style="width: 100%; height: 100%; margin-top: -15px; object-fit: cover; object-position: top center;" alt="Loading..."/>
          </div>
        </div>
      `;

      const avatarRequestId = ++currentHomeUserAvatarRequestId;
      loadHomeUserAvatar(user.id, avatarRequestId);
    }
  } catch (error) {
    console.error('Failed to update logged in UI:', error);
  }
}

async function loadHomeUserAvatar(userId, requestId) {
  try {
    const container = document.getElementById('home-user-avatar');
    if (!container) return;

    const thumbnails = await window.roblox.getUserThumbnails([userId], '352x352', 'AvatarThumbnail');

    if (requestId !== undefined && requestId !== currentHomeUserAvatarRequestId) return;
    
    if (thumbnails?.data && thumbnails.data[0]?.imageUrl) {
      container.innerHTML = `<img src="${thumbnails.data[0].imageUrl}" alt="Avatar" style="width: 120%; height: 120%; object-fit: cover; object-position: top center; margin-left: -10%; margin-top: -14px;">`;
    }

    if (requestId !== undefined && requestId !== currentHomeUserAvatarRequestId) return;

    if (window.addObcOverlayIfPremium) {
      await window.addObcOverlayIfPremium(container, userId);
    }
  } catch (error) {
    console.error('Failed to load user avatar:', error);
  }
}

function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + 'B';
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

function formatTimeAgo(dateString) {
  if (!dateString) return '--';
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return diffDays + ' days ago';
    if (diffDays < 30) return Math.floor(diffDays / 7) + ' weeks ago';
    if (diffDays < 365) return Math.floor(diffDays / 30) + ' months ago';
    return Math.floor(diffDays / 365) + ' years ago';
  } catch (e) {
    return '--';
  }
}

function viewProfile(userId) {
  navigateToPage('profile', { userId: userId });
}

let homeLaunchInProgress = false;

async function launchGame(placeId) {
  console.log('Launching game from home:', placeId);

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

  if (homeLaunchInProgress) {
    console.log('Launch already in progress, ignoring');
    return;
  }
  homeLaunchInProgress = true;

  if (window.showGameLaunchOverlay) {
    window.showGameLaunchOverlay('Starting Roblox...');
  }
  
  try {
    
    const launchFn = window.roblox?.launchGame || window.robloxAPI?.launchGame;
    
    if (!launchFn) {
      throw new Error('Game launch API not available');
    }
    
    const result = await launchFn(placeId);
    console.log('launchGame result:', result);

    if (result?.cancelled) {
      console.log('Game launch was cancelled');
      if (window.hideGameLaunchOverlay) {
        window.hideGameLaunchOverlay();
      }
      return;
    }
    
    const launched = result?.success === true || result === undefined;
    
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
    } else {
      throw new Error(result?.error || 'Failed to launch game');
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
    
    homeLaunchInProgress = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  
  const homePage = document.getElementById('page-home');
  if (homePage && homePage.classList.contains('active')) {
    loadHomePage();
  }
});
