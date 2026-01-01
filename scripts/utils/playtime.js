

const PlaytimeTracker = {
  
  _currentUserId: null,

  _playtimeCache: {},
  _cacheExpiry: 30000, 

  async _getUserId() {
    if (this._currentUserId) {
      return this._currentUserId;
    }
    
    try {
      const user = await window.roblox.getCurrentUser();
      if (user) {
        this._currentUserId = String(user.id);
        return this._currentUserId;
      }
    } catch (e) {
      console.error('[PlaytimeTracker] Failed to get current user:', e);
    }
    return null;
  },

  startSession(gameId) {

    console.log(`[PlaytimeTracker] Page session started for game ${gameId}`);
  },

  endSession() {

    console.log('[PlaytimeTracker] Page session ended');
    return 0;
  },

  formatPlaytime(seconds) {
    if (seconds < 60) {
      return '< 1m';
    }
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      if (minutes > 0) {
        return `${hours}h ${minutes}m`;
      }
      return `${hours}h`;
    }
    
    return `${minutes}m`;
  },

  formatPlaytimeMinutes(minutes) {
    return this.formatPlaytime(minutes * 60);
  },

  async getPlaytimeDataAsync(placeId, universeId = null) {
    try {
      const userId = await this._getUserId();
      if (!userId) {
        return this._getDefaultPlaytimeData();
      }

      const cacheKey = `${userId}_${placeId}`;
      const cached = this._playtimeCache[cacheKey];
      if (cached && Date.now() - cached.timestamp < this._cacheExpiry) {
        
        if (universeId && !cached.data.universeId) {
          cached.data.universeId = universeId;
        }
        return cached.data;
      }

      const data = await window.roblox.playtime.getPlaytimeData(userId, placeId);

      if (universeId) {
        data.universeId = universeId;
      }

      data.source = 'native';

      this._playtimeCache[cacheKey] = {
        data: data,
        timestamp: Date.now()
      };
      
      return data;
    } catch (e) {
      console.error('[PlaytimeTracker] Failed to get playtime data:', e);
      return this._getDefaultPlaytimeData();
    }
  },

  getPlaytimeData(placeId) {
    
    const userId = this._currentUserId;
    if (userId) {
      const cacheKey = `${userId}_${placeId}`;
      const cached = this._playtimeCache[cacheKey];
      if (cached) {
        return cached.data;
      }
    }

    this.getPlaytimeDataAsync(placeId).catch(() => {});

    return this._getDefaultPlaytimeData();
  },

  _getDefaultPlaytimeData() {
    return {
      totalMinutes: 0,
      currentMinutes: 0,
      formattedPlaytime: '< 1m',
      source: 'native'  
    };
  },

  async preloadPlaytime(placeId) {
    await this.getPlaytimeDataAsync(placeId);
  },

  async getAllPlaytime() {
    try {
      const userId = await this._getUserId();
      if (!userId) {
        return {};
      }
      return await window.roblox.playtime.getAllPlaytime(userId);
    } catch (e) {
      console.error('[PlaytimeTracker] Failed to get all playtime:', e);
      return {};
    }
  },

  async getCurrentSession() {
    try {
      return await window.roblox.playtime.getCurrentSession();
    } catch (e) {
      console.error('[PlaytimeTracker] Failed to get current session:', e);
      return null;
    }
  },

  async markPlaytimeSynced(placeId) {
    try {
      const userId = await this._getUserId();
      if (!userId) {
        console.warn('[PlaytimeTracker] Cannot mark synced: no user ID');
        return;
      }
      
      await window.roblox.playtime.markSynced(userId, placeId);

      const cacheKey = `${userId}_${placeId}`;
      delete this._playtimeCache[cacheKey];
      
      console.log(`[PlaytimeTracker] Marked playtime as synced for place ${placeId}`);
    } catch (e) {
      console.error('[PlaytimeTracker] Failed to mark playtime synced:', e);
    }
  },

  clearCache() {
    this._playtimeCache = {};
  }
};

window.PlaytimeTracker = PlaytimeTracker;
