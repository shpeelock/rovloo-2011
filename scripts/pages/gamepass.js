

async function loadGamePassPage(gamePassId) {
  const container = document.getElementById('gamepass-content');
  if (!container) return;

  container.innerHTML = '<div class="loading">Loading game pass...</div>';
  
  try {
    
    const gamePass = await window.roblox.getGamePass(gamePassId);
    
    if (!gamePass || !gamePass.gamePassId) {
      
      if (window.showErrorPage) {
        window.showErrorPage('Game Pass not found or has been deleted.', 'gamepass-content');
      } else {
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: #cc0000;">Game Pass not found.</div>';
      }
      return;
    }

    const response = await fetch('pages/gamepass.html?v=' + Date.now());
    const html = await response.text();
    container.innerHTML = html;

    populateGamePassData(gamePass);
    
  } catch (error) {
    console.error('Failed to load game pass:', error);
    if (window.showErrorPage) {
      window.showErrorPage('Failed to load game pass details: ' + error.message, 'gamepass-content');
    } else {
      container.innerHTML = '<div style="text-align: center; padding: 40px; color: #cc0000;">Failed to load game pass details.</div>';
    }
  }
}

async function populateGamePassData(gamePass) {
  const gamePassId = gamePass.gamePassId;

  const nameEl = document.getElementById('gamepass-name');
  if (nameEl) nameEl.textContent = gamePass.name || 'Unknown Game Pass';

  const largeLinkEl = document.getElementById('gamepass-large-link');
  const largeImageEl = document.getElementById('gamepass-large-image');
  if (largeImageEl) {
    try {
      const thumbResult = await window.roblox.getGamePassIcons([gamePassId], '150x150');
      if (thumbResult?.data?.[0]?.imageUrl) {
        largeImageEl.src = thumbResult.data[0].imageUrl;
      }
    } catch (e) {
      console.warn('Failed to load game pass thumbnail:', e);
    }
    largeImageEl.alt = gamePass.name || 'Game Pass';
  }
  if (largeLinkEl) {
    largeLinkEl.title = gamePass.name || 'Game Pass';
  }

  const priceEl = document.getElementById('gamepass-price');
  const price = gamePass.priceInformation?.defaultPriceInRobux;
  if (priceEl) {
    if (gamePass.isForSale && price !== null && price !== undefined) {
      if (price === 0) {
        priceEl.textContent = 'Free';
        priceEl.className = 'price-free';
      } else {
        priceEl.textContent = `R$ ${price.toLocaleString()}`;
        priceEl.className = 'price-robux';
      }
    } else {
      priceEl.textContent = 'Off Sale';
      priceEl.className = 'price-offsale';
    }
  }

  const descEl = document.getElementById('gamepass-description');
  if (descEl) {
    if (window.formatDescription) {
      descEl.innerHTML = window.formatDescription(gamePass.description);
    } else {
      descEl.textContent = gamePass.description || 'No description available.';
    }
  }

  let creatorId = null;
  let creatorName = 'Unknown';
  let creatorType = 'User';
  let universeId = null;
  let universeName = 'Unknown Game';

  if (gamePass.placeId) {
    try {
      const placeDetails = await window.roblox.getPlaceDetails([gamePass.placeId]);
      if (placeDetails?.[0]?.universeId) {
        universeId = placeDetails[0].universeId;

        const gameDetails = await window.roblox.getGameDetails([universeId]);
        if (gameDetails?.data?.[0]) {
          const game = gameDetails.data[0];
          universeName = game.name || 'Unknown Game';
          if (game.creator) {
            creatorId = game.creator.id;
            creatorName = game.creator.name || 'Unknown';
            creatorType = game.creator.type || 'User';
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch game details for creator:', e);
    }
  }

  const creatorLinkEl = document.getElementById('gamepass-creator-link');
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

  const creatorAvatarEl = document.getElementById('gamepass-creator-avatar');
  const creatorAvatarLinkEl = document.getElementById('gamepass-creator-avatar-link');
  
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

  const buyBtn = document.getElementById('gamepass-buy-btn');
  const buyPriceEl = document.getElementById('gamepass-buy-price');
  const ownedLabel = document.getElementById('gamepass-owned-label');
  const offsaleLabel = document.getElementById('gamepass-offsale-label');

  let userOwns = false;
  try {
    const currentUser = await window.roblox.getCurrentUser();
    if (currentUser?.id) {
      const ownershipResult = await window.roblox.userOwnsItem(currentUser.id, 'GamePass', gamePassId);
      userOwns = ownershipResult?.data?.length > 0;
    }
  } catch (e) {
    console.warn('Failed to check ownership:', e);
  }
  
  if (userOwns) {
    if (ownedLabel) ownedLabel.style.display = '';
    if (buyBtn) buyBtn.style.display = 'none';
    if (offsaleLabel) offsaleLabel.style.display = 'none';
  } else if (gamePass.isForSale && price !== null && price !== undefined) {
    if (buyBtn) {
      buyBtn.style.display = '';
      if (buyPriceEl) buyPriceEl.textContent = price.toLocaleString();
      buyBtn.onclick = () => purchaseGamePass(gamePassId, price, creatorId);
    }
    if (ownedLabel) ownedLabel.style.display = 'none';
    if (offsaleLabel) offsaleLabel.style.display = 'none';
  } else {
    if (offsaleLabel) offsaleLabel.style.display = '';
    if (buyBtn) buyBtn.style.display = 'none';
    if (ownedLabel) ownedLabel.style.display = 'none';
  }

  const placeSection = document.getElementById('GamePassPlaceSection');
  const placeImageEl = document.getElementById('gamepass-place-image');
  const placeImageLinkEl = document.getElementById('gamepass-place-image-link');
  const placeNameLinkEl = document.getElementById('gamepass-place-name-link');
  
  if (gamePass.placeId && universeId) {
    if (placeSection) placeSection.style.display = 'block';
    
    if (placeNameLinkEl) {
      placeNameLinkEl.textContent = universeName;
      placeNameLinkEl.href = '#';
      placeNameLinkEl.onclick = (e) => {
        e.preventDefault();
        window.location.hash = `#game?id=${gamePass.placeId}`;
      };
    }
    
    if (placeImageLinkEl) {
      placeImageLinkEl.title = universeName;
      placeImageLinkEl.href = '#';
      placeImageLinkEl.onclick = (e) => {
        e.preventDefault();
        window.location.hash = `#game?id=${gamePass.placeId}`;
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
  } else {
    if (placeSection) placeSection.style.display = 'none';
  }
}

async function purchaseGamePass(gamePassId, price, sellerId) {
  try {
    
    const confirmed = confirm(`Are you sure you want to buy this Game Pass for R$ ${price.toLocaleString()}?`);
    if (!confirmed) return;
    
    const result = await window.roblox.purchaseGamePass(gamePassId, price, 1, sellerId || 0);
    
    if (result?.purchased) {
      alert('Purchase successful! You now own this Game Pass.');
      
      loadGamePassPage(gamePassId);
    } else if (result?.reason) {
      alert('Purchase failed: ' + result.reason);
    } else {
      alert('Purchase failed. Please try again.');
    }
  } catch (error) {
    console.error('Purchase error:', error);
    alert('Purchase failed: ' + (error.message || 'Unknown error'));
  }
}

function resetGamePassPage() {
  const container = document.getElementById('gamepass-content');
  if (container) {
    container.innerHTML = '';
  }
}

window.loadGamePassPage = loadGamePassPage;
window.resetGamePassPage = resetGamePassPage;
