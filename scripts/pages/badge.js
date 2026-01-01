

const badgeGenreIconMap = {
  'All': { icon: 'Classic.png', name: 'All Genres' },
  'Adventure': { icon: 'Adventure.png', name: 'Adventure' },
  'Building': { icon: 'Classic.png', name: 'Building' },
  'Comedy': { icon: 'LOL.png', name: 'Comedy' },
  'Fighting': { icon: 'Ninja.png', name: 'Fighting' },
  'FPS': { icon: 'ModernMilitary.png', name: 'FPS' },
  'Horror': { icon: 'Cthulu.png', name: 'Horror' },
  'Medieval': { icon: 'Castle.png', name: 'Medieval' },
  'Military': { icon: 'ModernMilitary.png', name: 'Military' },
  'Naval': { icon: 'Pirate.png', name: 'Naval' },
  'RPG': { icon: 'Adventure.png', name: 'RPG' },
  'Sci-Fi': { icon: 'SciFi.png', name: 'Sci-Fi' },
  'SciFi': { icon: 'SciFi.png', name: 'Sci-Fi' },
  'Sports': { icon: 'Sports.png', name: 'Sports' },
  'Town and City': { icon: 'City.png', name: 'Town and City' },
  'TownAndCity': { icon: 'City.png', name: 'Town and City' },
  'Western': { icon: 'WildWest.png', name: 'Western' },
  'Pirate': { icon: 'Pirate.png', name: 'Pirate' },
  'Skateboarding': { icon: 'Skatepark.png', name: 'Skateboarding' },
  'Tutorial': { icon: 'Tutorial.gif', name: 'Tutorial' },
  'Ninja': { icon: 'Ninja.png', name: 'Ninja' }
};

function updateBadgeGenre(genre) {
  const genreInfo = badgeGenreIconMap[genre] || badgeGenreIconMap['All'];

  const genreIconEl = document.getElementById('badge-genre-icon');
  const genreLinkEl = document.getElementById('badge-genre-link');

  if (genreIconEl) {
    genreIconEl.src = `assets/genres/${genreInfo.icon}`;
    genreIconEl.alt = genreInfo.name;
  }
  if (genreLinkEl) {
    genreLinkEl.textContent = genreInfo.name;
    genreLinkEl.href = `#games?genre=${encodeURIComponent(genre)}`;
  }
}

async function loadBadgePage(badgeId) {
  const container = document.getElementById('badge-content');
  if (!container) return;

  container.innerHTML = '<div class="loading">Loading badge...</div>';
  
  try {
    
    const badge = await window.roblox.getBadge(badgeId);
    
    if (!badge || !badge.id) {
      container.innerHTML = '<div style="text-align: center; padding: 40px; color: #cc0000;">Badge not found.</div>';
      return;
    }

    const response = await fetch('pages/badge.html');
    const html = await response.text();
    container.innerHTML = html;

    populateBadgeData(badge);
    
  } catch (error) {
    console.error('Failed to load badge:', error);
    if (window.showErrorPage) {
      window.showErrorPage('Failed to load badge details: ' + error.message, 'badge-content');
    } else {
      container.innerHTML = '<div style="text-align: center; padding: 40px; color: #cc0000;">Failed to load badge details.</div>';
    }
  }
}

async function populateBadgeData(badge) {
  
  const nameEl = document.getElementById('badge-name');
  if (nameEl) nameEl.textContent = badge.name || 'Unknown Badge';

  const largeLinkEl = document.getElementById('badge-large-link');
  const largeImageEl = document.getElementById('badge-large-image');
  if (largeImageEl) {
    try {
      
      const thumbResult = await window.roblox.getBadgeThumbnails([badge.id], '150x150');
      if (thumbResult?.data?.[0]?.imageUrl) {
        largeImageEl.src = thumbResult.data[0].imageUrl;
      }
    } catch (e) {
      console.warn('Failed to load badge thumbnail:', e);
    }
    largeImageEl.alt = badge.name || 'Badge';
  }
  if (largeLinkEl) {
    largeLinkEl.title = badge.name || 'Badge';
  }

  const createdEl = document.getElementById('badge-created');
  if (createdEl && badge.created) {
    createdEl.textContent = formatDate(badge.created);
  }

  const updatedEl = document.getElementById('badge-updated');
  if (updatedEl && badge.updated) {
    updatedEl.textContent = formatRelativeTime(badge.updated);
  }

  const descEl = document.getElementById('badge-description');
  if (descEl) {
    if (window.formatDescription) {
      descEl.innerHTML = window.formatDescription(badge.description);
    } else {
      descEl.textContent = badge.description || 'No description available.';
    }
  }

  let creatorId = null;
  let creatorName = 'Unknown';
  let creatorType = 'User';
  let gameGenre = 'All';

  if (badge.awardingUniverse && badge.awardingUniverse.id) {
    try {
      const gameDetails = await window.roblox.getGameDetails([badge.awardingUniverse.id]);
      if (gameDetails?.data?.[0]) {
        const game = gameDetails.data[0];
        if (game.creator) {
          creatorId = game.creator.id;
          creatorName = game.creator.name || 'Unknown';
          creatorType = game.creator.type || 'User'; 
        }
        
        gameGenre = game.genre || 'All';
      }
    } catch (e) {
      console.warn('Failed to fetch game details for creator:', e);
      creatorName = badge.awardingUniverse.name || 'Unknown Game';
    }
  }

  updateBadgeGenre(gameGenre);

  const creatorLinkEl = document.getElementById('badge-creator-link');
  if (creatorLinkEl) {
    creatorLinkEl.textContent = creatorName;
    if (creatorId) {
      creatorLinkEl.href = '#';
      if (creatorType === 'User') {
        creatorLinkEl.onclick = (e) => {
          e.preventDefault();
          window.location.hash = `#profile?id=${creatorId}`;
        };
      } else if (creatorType === 'Group') {
        creatorLinkEl.onclick = (e) => {
          e.preventDefault();
          window.location.hash = `#group?id=${creatorId}`;
        };
      }
    }
  }

  const creatorAvatarEl = document.getElementById('badge-creator-avatar');
  const creatorAvatarLinkEl = document.getElementById('badge-creator-avatar-link');
  
  if (creatorAvatarLinkEl && creatorId) {
    creatorAvatarLinkEl.title = creatorName;
    creatorAvatarLinkEl.href = '#';
    if (creatorType === 'User') {
      creatorAvatarLinkEl.onclick = (e) => {
        e.preventDefault();
        window.location.hash = `#profile?id=${creatorId}`;
      };
    } else if (creatorType === 'Group') {
      creatorAvatarLinkEl.onclick = (e) => {
        e.preventDefault();
        window.location.hash = `#group?id=${creatorId}`;
      };
    }
  }
  
  if (creatorAvatarEl && creatorId) {
    try {
      if (creatorType === 'User') {
        
        const avatarResult = await window.roblox.getUserThumbnails([creatorId], '150x150');
        if (avatarResult?.data?.[0]?.imageUrl) {
          creatorAvatarEl.src = avatarResult.data[0].imageUrl;
        }
      } else if (creatorType === 'Group') {
        const groupThumbResult = await window.roblox.getGroupThumbnails([creatorId], '150x150');
        if (groupThumbResult?.data?.[0]?.imageUrl) {
          creatorAvatarEl.src = groupThumbResult.data[0].imageUrl;
        }
      }
    } catch (e) {
      console.warn('Failed to load creator avatar:', e);
    }
    creatorAvatarEl.alt = creatorName;
  }

  if (badge.awardingUniverse) {
    const placeSection = document.getElementById('BadgePlaceSection');
    const placeImageEl = document.getElementById('badge-place-image');
    const placeImageLinkEl = document.getElementById('badge-place-image-link');
    const placeNameLinkEl = document.getElementById('badge-place-name-link');
    
    const universeId = badge.awardingUniverse.id;
    const universeName = badge.awardingUniverse.name || 'Unknown Game';
    const rootPlaceId = badge.awardingUniverse.rootPlaceId;
    
    if (placeSection) placeSection.style.display = 'block';
    
    if (placeNameLinkEl) {
      placeNameLinkEl.textContent = universeName;
      placeNameLinkEl.href = '#';
      placeNameLinkEl.onclick = (e) => {
        e.preventDefault();
        if (rootPlaceId) {
          window.location.hash = `#game?id=${rootPlaceId}`;
        }
      };
    }
    
    if (placeImageLinkEl) {
      placeImageLinkEl.title = universeName;
      placeImageLinkEl.href = '#';
      placeImageLinkEl.onclick = (e) => {
        e.preventDefault();
        if (rootPlaceId) {
          window.location.hash = `#game?id=${rootPlaceId}`;
        }
      };
    }

    if (placeImageEl && universeId) {
      try {
        
        const gameThumbResult = await window.roblox.getGameThumbnails([universeId], '256x144');
        if (gameThumbResult?.data?.[0]?.thumbnails?.[0]?.imageUrl) {
          placeImageEl.src = gameThumbResult.data[0].thumbnails[0].imageUrl;
        }
      } catch (e) {
        console.warn('Failed to load game thumbnail:', e);
      }
      placeImageEl.alt = universeName;
    }
  }
}

function formatDate(dateString) {
  if (!dateString) return '--';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatRelativeTime(dateString) {
  if (!dateString) return '--';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays < 1) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
  }
  const years = Math.floor(diffDays / 365);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

function resetBadgePage() {
  const container = document.getElementById('badge-content');
  if (container) {
    container.innerHTML = '';
  }
}

window.loadBadgePage = loadBadgePage;
window.resetBadgePage = resetBadgePage;
