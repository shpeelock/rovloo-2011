

const ReviewComponent = {
  
  placeId: null,  
  universeId: null,  
  containerId: null,
  container: null,  
  currentPage: 1,
  totalPages: 1,
  reviewsPerPage: 10,
  reviews: [],
  userReview: null,
  gameStats: null,
  currentUserId: null,
  currentUsername: null,
  currentDisplayName: null,
  sortOption: 'recent',
  filterOption: 'all',
  isLoading: false,
  isSubmitting: false,
  _pendingReload: false,  
  _requestId: 0,  
  _clickHandler: null,  
  rovlooAuthenticated: false,
  rovlooUser: null,
  cachedPlaytimeData: null,  
  replySummary: {},  
  expandedReplies: new Set(),  
  userGameVote: null,  
  userVoteCache: {},  
  userReplyVoteCache: {},  
  donorStatusCache: {},  
  DONOR_ITEM_ID: 86478952287791,  

  browseMode: false,  
  searchQuery: '',    
  adminPicksMode: false,  
  myReviewsMode: false,  
  myReviewsUserId: null,  
  clientSideSort: false,  
  allReviewsCache: null,  
  avatarCache: new Map(),  

  getAvatarUrl(avatarUrl, userId) {
    
    if (userId && this.avatarCache.has(userId)) {
      return this.avatarCache.get(userId);
    }
    
    if (avatarUrl && !avatarUrl.includes('30DAY-AvatarHeadshot')) {
      return avatarUrl;
    }

    return 'images/spinners/spinner100x100.gif';
  },

  async refreshExpiredAvatars() {
    if (!window.roblox?.getUserThumbnails) return;

    const avatarImages = this.container?.querySelectorAll('.author-avatar, .reply-avatar') || [];
    const userIdsToFetch = new Set();
    const imagesByUserId = new Map();
    
    avatarImages.forEach(img => {
      
      const authorLink = img.closest('.author-link');
      if (!authorLink) return;
      
      const href = authorLink.getAttribute('href') || '';
      const match = href.match(/id=(\d+)/);
      if (!match) return;
      
      const userId = parseInt(match[1]);
      if (!userId) return;

      const src = img.getAttribute('src') || '';
      if (src.includes('spinner') || src.includes('30DAY-AvatarHeadshot')) {
        userIdsToFetch.add(userId);
        if (!imagesByUserId.has(userId)) {
          imagesByUserId.set(userId, []);
        }
        imagesByUserId.get(userId).push(img);
      }
    });
    
    if (userIdsToFetch.size === 0) return;
    
    try {
      const userIds = Array.from(userIdsToFetch);
      console.log('[ReviewComponent] Fetching fresh avatars for', userIds.length, 'users');
      
      const result = await window.roblox.getUserThumbnails(userIds, '150x150', 'Headshot');
      if (result?.data) {
        result.data.forEach(item => {
          if (item.imageUrl && item.targetId) {
            
            this.avatarCache.set(item.targetId, item.imageUrl);

            const images = imagesByUserId.get(item.targetId);
            if (images) {
              images.forEach(img => {
                img.src = item.imageUrl;
              });
            }
          }
        });
      }
    } catch (e) {
      console.warn('[ReviewComponent] Failed to fetch fresh avatars:', e);
    }
  },

  async checkDonorStatus(userId) {
    if (!userId) return false;

    const userIdStr = String(userId);
    if (this.donorStatusCache.hasOwnProperty(userIdStr)) {
      return this.donorStatusCache[userIdStr];
    }
    
    try {
      
      const result = await window.roblox.userOwnsItem(userId, 'Asset', this.DONOR_ITEM_ID);
      const isDonor = result?.data && result.data.length > 0;

      this.donorStatusCache[userIdStr] = isDonor;
      return isDonor;
    } catch (e) {
      console.warn('[ReviewComponent] Failed to check donor status for user', userId, ':', e);
      this.donorStatusCache[userIdStr] = false;
      return false;
    }
  },

  async batchCheckDonorStatus(userIds) {
    if (!userIds || userIds.length === 0) return {};

    const uncachedUserIds = userIds.filter(id => !this.donorStatusCache.hasOwnProperty(String(id)));
    
    if (uncachedUserIds.length > 0) {
      
      const batchSize = 10;
      for (let i = 0; i < uncachedUserIds.length; i += batchSize) {
        const batch = uncachedUserIds.slice(i, i + batchSize);
        await Promise.all(batch.map(userId => this.checkDonorStatus(userId)));
      }
    }

    const results = {};
    userIds.forEach(id => {
      results[String(id)] = this.donorStatusCache[String(id)] || false;
    });
    return results;
  },

  async refreshDonorBadges() {
    if (!this.container) return;

    const userIds = new Set();
    this.reviews.forEach(review => {
      if (review.author?.userId) {
        userIds.add(review.author.userId);
      }
    });
    
    if (userIds.size === 0) return;
    
    console.log('[ReviewComponent] Checking donor status for', userIds.size, 'users');

    const donorStatus = await this.batchCheckDonorStatus(Array.from(userIds));

    this.reviews.forEach(review => {
      const userId = review.author?.userId;
      if (!userId) return;
      
      const isDonor = donorStatus[String(userId)];
      if (!isDonor) return;

      const reviewItem = this.container.querySelector(`.review-item[data-review-id="${review.id}"]`);
      if (!reviewItem) return;

      const nameRow = reviewItem.querySelector('.author-name-row');
      if (!nameRow || nameRow.querySelector('.donor-badge')) return;

      const authorName = nameRow.querySelector('.author-name');
      if (authorName) {
        const badgeHtml = `<a href="#catalog-item?id=86478952287791" class="author-badge donor-badge" title="Supporter - owns Rovloo's Calling"><img src="images/rovloo/donate128.png" alt="Supporter"></a>`;
        authorName.insertAdjacentHTML('afterend', badgeHtml);
      }
    });
  },

  async refreshReplyDonorBadges(reviewId, replies) {
    if (!this.container || !replies || replies.length === 0) return;

    const userIds = new Set();
    replies.forEach(reply => {
      if (reply.author?.userId) {
        userIds.add(reply.author.userId);
      }
    });
    
    if (userIds.size === 0) return;

    const donorStatus = await this.batchCheckDonorStatus(Array.from(userIds));

    replies.forEach(reply => {
      const userId = reply.author?.userId;
      if (!userId) return;
      
      const isDonor = donorStatus[String(userId)];
      if (!isDonor) return;

      const replyItem = this.container.querySelector(`.reply-item[data-reply-id="${reply.id}"]`);
      if (!replyItem) return;

      const authorInfo = replyItem.querySelector('.reply-author-info');
      if (!authorInfo || authorInfo.querySelector('.donor-badge')) return;

      const authorName = authorInfo.querySelector('.reply-author-name');
      if (authorName) {
        const badgeHtml = `<a href="#catalog-item?id=86478952287791" class="author-badge donor-badge" title="Supporter - owns Rovloo's Calling"><img src="images/rovloo/donate128.png" alt="Supporter"></a>`;
        authorName.insertAdjacentHTML('afterend', badgeHtml);
      }
    });
  },

  async init(placeId, containerId, options = {}) {
    console.log('[ReviewComponent] init called:', { placeId, containerId, options });

    this._requestId++;
    const initRequestId = this._requestId;
    console.log('[ReviewComponent] New request ID:', initRequestId);

    this.removeEventListeners();
    
    this.placeId = placeId;
    this.universeId = options.universeId || null;
    this.containerId = containerId;
    this.currentPage = 1;
    this.reviews = [];
    this.userReview = null;
    this.gameStats = null;
    this.cachedPlaytimeData = null;
    this.replySummary = {};
    this.expandedReplies = new Set();
    this.userGameVote = null;

    this.browseMode = options.browseMode || placeId === 'browse';
    this.searchQuery = options.searchQuery || '';
    this.adminPicksMode = options.adminPicksMode || false;
    this.myReviewsMode = options.myReviewsMode || false;
    this.myReviewsUserId = options.myReviewsUserId || null;
    this.sortOption = options.sortOption || 'recent';
    this.filterOption = options.filterOption || 'all';
    this.clientSideSort = options.clientSideSort || false;
    this.allReviewsCache = null;

    try {
      const user = await window.roblox.getCurrentUser();
      if (user) {
        this.currentUserId = user.id;
        this.currentUsername = user.name;
        this.currentDisplayName = user.displayName;

        if (!this.browseMode && window.PlaytimeTracker) {
          this.cachedPlaytimeData = await window.PlaytimeTracker.getPlaytimeDataAsync(placeId, this.universeId);
        }

        if (!this.browseMode && this.universeId && window.roblox?.getUserVote) {
          try {
            const voteData = await window.roblox.getUserVote(this.universeId);
            
            this.userGameVote = voteData?.userVote;
            console.log('[ReviewComponent] User game vote:', this.userGameVote);
          } catch (e) {
            console.log('[ReviewComponent] Failed to get user vote:', e);
          }
        }
      }
    } catch (e) {
      console.log('Not logged in or failed to get user:', e);
    }

    await this.checkRovlooAuth();

    if (initRequestId !== this._requestId) {
      console.log('[ReviewComponent] Init aborted - newer request started:', initRequestId, 'vs', this._requestId);
      return;
    }

    console.log('[ReviewComponent] Rendering container');
    this.renderContainer();

    console.log('[ReviewComponent] Loading reviews');
    await this.loadReviews(initRequestId);
    console.log('[ReviewComponent] Init complete');
  },

  async checkRovlooAuth() {
    try {
      const status = await window.roblox.reviews.getAuthStatus();
      this.rovlooAuthenticated = status.authenticated;
      this.rovlooUser = status.user;
      console.log('[Reviews] Rovloo auth status:', status);

      if (this.rovlooAuthenticated) {
        return;
      }

      if (this.currentUserId) {
        console.log('[Reviews] Not authenticated with Rovloo, attempting direct auth...');
        const result = await window.roblox.reviews.login();
        if (result.success) {
          this.rovlooAuthenticated = true;
          this.rovlooUser = result.user;
          console.log('[Reviews] Direct auth to Rovloo successful:', result.method);
        } else {
          console.log('[Reviews] Direct auth failed, user will need to click Connect button');
        }
      }
      
    } catch (e) {
      console.log('[Reviews] Failed to check Rovloo auth:', e);
      this.rovlooAuthenticated = false;
      this.rovlooUser = null;
    }
  },

  async handleRovlooLogin() {
    try {
      const result = await window.roblox.reviews.login();
      if (result.success) {
        this.rovlooAuthenticated = true;
        this.rovlooUser = result.user;
        
        this.renderReviewForm();
        
        this.showFormMessage('Successfully logged in to Rovloo!', 'success');
      } else {
        this.showFormError(result.error || 'Failed to login to Rovloo');
      }
    } catch (error) {
      console.error('[Reviews] Rovloo login error:', error);
      this.showFormError(error.message || 'Failed to login to Rovloo');
    }
  },

  renderContainer() {
    const container = document.getElementById(this.containerId);
    console.log('[ReviewComponent] renderContainer:', { 
      containerId: this.containerId, 
      containerFound: !!container 
    });
    if (!container) {
      console.warn('[ReviewComponent] Container not found:', this.containerId);
      return;
    }

    this.container = container;

    const isInsideTab = container.closest('.tab-content') !== null || container.id === 'ReviewsSection';
    const skipHeader = isInsideTab || this.browseMode;

    if (skipHeader) {

      container.innerHTML = `
        <div class="reviews-section reviews-tab-view">
          <div class="review-form-container"></div>
          <div class="reviews-list">
            <div class="reviews-loading">Loading reviews...</div>
          </div>
          <div class="reviews-pagination"></div>
        </div>
      `;
    } else {
      
      container.innerHTML = `
        <div class="ShadowedStandardBox reviews-section">
          <div class="Header">
            <img src="images/rovloo/rovloo-ico64.png" alt="Rovloo" class="rovloo-icon" onerror="this.style.display='none'">
            <span>Reviews</span>
            <div class="review-stats">
              <span class="stats-loading">Loading...</span>
            </div>
          </div>
          <div class="Content">
            <div class="review-form-container"></div>
            <div class="review-controls">
              <div class="review-sort">
                <label>Sort:</label>
                <select class="review-select review-sort-select">
                  <option value="recent">Newest</option>
                  <option value="quality">Quality</option>
                  <option value="highest-voted">Most Helpful</option>
                  <option value="most-playtime">Most Playtime</option>
                </select>
              </div>
              <div class="review-filter">
                <label>Filter:</label>
                <select class="review-select review-filter-select">
                  <option value="all">All Reviews</option>
                  <option value="like">Likes Only</option>
                  <option value="dislike">Dislikes Only</option>
                </select>
              </div>
            </div>
            <div class="reviews-list">
              <div class="reviews-loading">Loading reviews...</div>
            </div>
            <div class="reviews-pagination"></div>
          </div>
        </div>
      `;
    }

    this.setupEventListeners();
  },

  setupEventListeners() {
    if (!this.container) return;
    
    const sortSelect = this.container.querySelector('.review-sort-select');
    const filterSelect = this.container.querySelector('.review-filter-select');

    sortSelect?.addEventListener('change', (e) => {
      this.sortOption = e.target.value;
      this.currentPage = 1;
      this.loadReviews();
    });

    filterSelect?.addEventListener('change', (e) => {
      this.filterOption = e.target.value;
      this.currentPage = 1;
      this.loadReviews();
    });

  },

  removeEventListeners() {

  },

  async loadReviews(requestId) {
    console.log('[ReviewComponent] loadReviews called, requestId:', requestId);

    const currentRequestId = requestId ?? this._requestId;
    
    if (this.isLoading) {
      console.log('[ReviewComponent] Already loading, queuing reload');
      
      this._pendingReload = true;
      return;
    }
    this.isLoading = true;
    this._pendingReload = false;

    const listContainer = this.container?.querySelector('.reviews-list');
    console.log('[ReviewComponent] reviews-list container found:', !!listContainer);
    if (listContainer) {
      listContainer.innerHTML = '<div class="reviews-loading">Loading reviews...</div>';
    } else {
      console.warn('[ReviewComponent] reviews-list container not found - reviews may not render');
    }

    try {
      let stats = null;
      let reviewsData = null;

      if (this.browseMode) {
        if (this.adminPicksMode) {
          
          console.log('[ReviewComponent] Loading admin picks...');
          const picksData = await window.roblox.reviews.getAdminPicks({
            limit: this.reviewsPerPage,
            page: this.currentPage
          });
          console.log('[ReviewComponent] Admin picks response:', picksData);

          const picks = picksData.picks || picksData || [];
          if (Array.isArray(picks) && picks.length > 0) {
            
            if (picks[0].review) {
              
              reviewsData = picks.map(pick => ({
                ...pick.review,
                adminPick: true,
                pickReason: pick.reason || pick.pickReason
              }));
            } else {
              
              reviewsData = picks;
            }
          } else {
            reviewsData = [];
          }
          this.totalPages = picksData.totalPages || 1;
          console.log('[ReviewComponent] Processed admin picks:', reviewsData.length, 'reviews');
        } else if (this.myReviewsMode) {
          
          console.log('[ReviewComponent] Loading my reviews for user:', this.myReviewsUserId);
          
          if (!this.myReviewsUserId) {
            reviewsData = [];
            this.totalPages = 1;
            console.log('[ReviewComponent] No user ID for my reviews');
          } else {
            const response = await window.roblox.reviews.getAllReviews({
              userId: this.myReviewsUserId,
              sort: this.sortOption,
              limit: this.reviewsPerPage,
              page: this.currentPage
            });
            
            console.log('[ReviewComponent] My reviews response:', response);
            
            if (Array.isArray(response)) {
              reviewsData = response;
              this.totalPages = response.length > 0 ? Math.ceil(response.length / this.reviewsPerPage) : 1;
            } else if (response && typeof response === 'object') {
              reviewsData = response.reviews || [];
              this.totalPages = response.totalPages || 1;
            } else {
              reviewsData = [];
              this.totalPages = 1;
            }
            
            console.log('[ReviewComponent] My reviews:', reviewsData.length, 'reviews');
          }
        } else if (this.clientSideSort) {
          
          console.log('[ReviewComponent] Using client-side sorting for:', this.sortOption);

          if (!this.allReviewsCache) {
            console.log('[ReviewComponent] Fetching all reviews for client-side sorting...');

            const LIMIT = 100;
            let page = 1;
            let totalReviews = Infinity;
            let allReviews = [];
            
            while (allReviews.length < totalReviews) {
              const response = await window.roblox.reviews.getAllReviews({
                search: this.searchQuery,
                likeStatus: this.filterOption !== 'all' ? this.filterOption : undefined,
                sort: 'balanced_discovery', 
                limit: LIMIT,
                page: page
              });
              
              let chunk = [];
              if (Array.isArray(response)) {
                chunk = response;
                
                if (page === 1) totalReviews = chunk.length < LIMIT ? chunk.length : Infinity;
              } else if (response && typeof response === 'object') {
                chunk = response.reviews || [];
                
                if (page === 1) {
                  totalReviews = response.totalReviews || chunk.length;
                  console.log('[ReviewComponent] Server reports', totalReviews, 'total reviews');
                }
              }
              
              allReviews.push(...chunk);
              console.log('[ReviewComponent] Page', page, ':', chunk.length, 'reviews (total:', allReviews.length, '/', totalReviews, ')');

              if (chunk.length === 0 || chunk.length < LIMIT) break;
              page++;

              if (page > 100) {
                console.warn('[ReviewComponent] Safety limit reached, stopping at page 100');
                break;
              }
            }

            if (this.sortOption === 'most-replies' || this.sortOption === 'least-replies') {
              try {
                const reviewIds = allReviews.map(r => r.id).filter(Boolean);
                if (reviewIds.length > 0) {
                  const summary = await window.roblox.reviews.getReplySummary(reviewIds);
                  this.replySummary = summary || {};
                }
              } catch (e) {
                console.warn('Failed to fetch reply summary for sorting:', e);
              }
            }
            
            this.allReviewsCache = allReviews;
            console.log('[ReviewComponent] Cached', allReviews.length, 'reviews for client-side sorting');
          }

          let sortedReviews = this.sortReviewsClientSide([...this.allReviewsCache], this.sortOption);

          const totalReviews = sortedReviews.length;
          this.totalPages = Math.max(1, Math.ceil(totalReviews / this.reviewsPerPage));

          const startIndex = (this.currentPage - 1) * this.reviewsPerPage;
          const endIndex = startIndex + this.reviewsPerPage;
          reviewsData = sortedReviews.slice(startIndex, endIndex);
          
          console.log('[ReviewComponent] Client-side sorted:', totalReviews, 'total,', reviewsData.length, 'on page', this.currentPage);
        } else {
          
          console.log('[ReviewComponent] Calling getAllReviews with:', {
            search: this.searchQuery,
            likeStatus: this.filterOption !== 'all' ? this.filterOption : undefined,
            sort: this.sortOption,
            limit: this.reviewsPerPage,
            page: this.currentPage
          });
          
          const response = await window.roblox.reviews.getAllReviews({
            search: this.searchQuery,
            likeStatus: this.filterOption !== 'all' ? this.filterOption : undefined,
            sort: this.sortOption,
            limit: this.reviewsPerPage,
            page: this.currentPage
          });
          
          console.log('[ReviewComponent] getAllReviews raw response:', response);
          console.log('[ReviewComponent] Response type:', typeof response, 'isArray:', Array.isArray(response));

          if (Array.isArray(response)) {
            
            reviewsData = response;
            this.totalPages = response.length > 0 ? Math.ceil(response.length / this.reviewsPerPage) : 1;
            console.log('[ReviewComponent] Direct array response with', response.length, 'reviews');
          } else if (response && typeof response === 'object') {
            
            reviewsData = response.reviews || [];
            this.totalPages = response.totalPages || 1;
            console.log('[ReviewComponent] Object response with', reviewsData.length, 'reviews, totalPages:', this.totalPages);
          } else {
            
            console.warn('[ReviewComponent] Unexpected response format:', response);
            reviewsData = [];
            this.totalPages = 1;
          }
          
          console.log('[ReviewComponent] Final reviewsData:', reviewsData.length, 'reviews');
        }
      } else {
        
        [stats, reviewsData] = await Promise.all([
          window.roblox.reviews.getStats(this.placeId).catch(() => null),
          window.roblox.reviews.getReviews(this.placeId, {
            sort: this.sortOption,
            limit: this.reviewsPerPage,
            offset: (this.currentPage - 1) * this.reviewsPerPage,
            likeStatus: this.filterOption !== 'all' ? this.filterOption : undefined
          })
        ]);
      }

      this.gameStats = stats;
      this.reviews = Array.isArray(reviewsData) ? reviewsData : (reviewsData?.reviews || []);

      if (this.reviews.length > 0) {
        console.log('[ReviewComponent] Sample review data:', JSON.stringify(this.reviews[0], null, 2));
      }

      if (this.reviews.length > 0) {
        const authorIds = [...new Set(this.reviews.map(r => r.author?.userId).filter(Boolean))];
        const ratingPromises = authorIds.map(userId => 
          window.roblox.reviews.getUserRating(userId).catch(() => null)
        );
        const ratings = await Promise.all(ratingPromises);

        const ratingMap = {};
        authorIds.forEach((userId, index) => {
          if (ratings[index]) {
            ratingMap[userId] = ratings[index];
          }
        });

        this.reviews.forEach(review => {
          if (review.author?.userId && ratingMap[review.author.userId]) {
            review.author.rating = ratingMap[review.author.userId];
          }
        });
      }

      if (!this.browseMode) {
        const totalReviews = stats?.totalReviews || this.reviews.length;
        this.totalPages = Math.max(1, Math.ceil(totalReviews / this.reviewsPerPage));
      }

      const needsReplySummary = !this.browseMode || this.reviews.some(r => r.replyCount === undefined);
      if (this.reviews.length > 0 && needsReplySummary) {
        try {
          const reviewIds = this.reviews.map(r => r.id).filter(Boolean);
          if (reviewIds.length > 0) {
            console.log('[ReviewComponent] Fetching reply summary for', reviewIds.length, 'reviews:', reviewIds);
            const summary = await window.roblox.reviews.getReplySummary(reviewIds);
            console.log('[ReviewComponent] Reply summary response:', summary, 'type:', typeof summary, 'isArray:', Array.isArray(summary));

            this.replySummary = {};
            
            if (Array.isArray(summary)) {
              
              summary.forEach(item => {
                if (item && item.reviewId !== undefined && item.count !== undefined) {
                  this.replySummary[String(item.reviewId)] = { count: item.count };
                }
              });
            } else if (summary && typeof summary === 'object' && Object.keys(summary).length > 0) {
              
              for (const [reviewId, value] of Object.entries(summary)) {
                if (typeof value === 'number') {
                  this.replySummary[reviewId] = { count: value };
                } else if (typeof value === 'object' && value !== null && value.count !== undefined) {
                  this.replySummary[reviewId] = value;
                }
              }
            }
            
            console.log('[ReviewComponent] Processed replySummary:', this.replySummary);

            if (Object.keys(this.replySummary).length === 0 && reviewIds.length > 0) {
              console.log('[ReviewComponent] Summary endpoint returned no data, fetching counts individually');
              const countPromises = reviewIds.slice(0, 10).map(async (reviewId) => {
                try {
                  const data = await window.roblox.reviews.getReplies(reviewId, { limit: 1 });
                  const total = data?.total ?? data?.items?.length ?? (Array.isArray(data) ? data.length : 0);
                  return { reviewId, count: total };
                } catch (e) {
                  return { reviewId, count: 0 };
                }
              });
              
              const counts = await Promise.all(countPromises);
              counts.forEach(({ reviewId, count }) => {
                this.replySummary[String(reviewId)] = { count };
              });
              console.log('[ReviewComponent] Individual reply counts:', this.replySummary);
            }
          }
        } catch (e) {
          console.warn('[ReviewComponent] Failed to fetch reply summary:', e);
          this.replySummary = {};
        }
      } else if (this.reviews.length > 0) {
        
        this.replySummary = {};
        this.reviews.forEach(r => {
          if (r.id && r.replyCount !== undefined) {
            this.replySummary[String(r.id)] = { count: r.replyCount };
          }
        });
      }

      if (!this.browseMode && this.currentUserId) {
        this.userReview = this.reviews.find(r => r.author?.userId === this.currentUserId) || null;

        if (!this.userReview) {
          try {
            this.userReview = await window.roblox.reviews.getUserReview(this.placeId, this.currentUserId);
          } catch (e) {}
        }
      }

      if (currentRequestId !== this._requestId) {
        console.log('[ReviewComponent] Discarding stale response:', currentRequestId, 'vs current:', this._requestId);
        return;
      }

      console.log('[ReviewComponent] Rendering UI, reviews count:', this.reviews.length);
      if (!this.browseMode) {
        this.renderStats();
        this.renderReviewForm();
      }
      this.renderReviewsList();
      this.renderPagination();
      console.log('[ReviewComponent] Rendering complete');

      this.refreshExpiredAvatars();

      this.refreshDonorBadges();

    } catch (error) {
      console.error('[ReviewComponent] Failed to load reviews:', error);
      console.error('[ReviewComponent] Error stack:', error.stack);

      if (currentRequestId === this._requestId && listContainer) {
        listContainer.innerHTML = `
          <div class="reviews-error">
            <p>Failed to load reviews. Please try again.</p>
            <p style="font-size: 11px; color: #999;">${error.message}</p>
            <button class="Button" onclick="ReviewComponent.loadReviews()">Retry</button>
          </div>
        `;
      }
    } finally {
      this.isLoading = false;

      if (this._pendingReload && currentRequestId === this._requestId) {
        console.log('[ReviewComponent] Processing pending reload');
        this._pendingReload = false;
        
        setTimeout(() => this.loadReviews(), 0);
      }
    }
  },

  sortReviewsClientSide(reviews, sortOption) {
    console.log('[ReviewComponent] Sorting', reviews.length, 'reviews by:', sortOption);
    
    switch (sortOption) {
      case 'quality':
      case 'balanced_discovery':

        return reviews.sort((a, b) => {
          const scoreA = this.calculateEngagementScore(a);
          const scoreB = this.calculateEngagementScore(b);
          if (scoreB !== scoreA) return scoreB - scoreA;
          
          return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
        });
        
      case 'highest-voted':

        return reviews.sort((a, b) => {
          const scoreA = (a.voteStats?.upvotes ?? a.upvotes ?? 0) - (a.voteStats?.downvotes ?? a.downvotes ?? 0);
          const scoreB = (b.voteStats?.upvotes ?? b.upvotes ?? 0) - (b.voteStats?.downvotes ?? b.downvotes ?? 0);
          if (scoreB !== scoreA) return scoreB - scoreA;
          
          return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
        });
        
      case 'lowest-voted':
        
        return reviews.sort((a, b) => {
          const scoreA = (a.voteStats?.upvotes ?? a.upvotes ?? 0) - (a.voteStats?.downvotes ?? a.downvotes ?? 0);
          const scoreB = (b.voteStats?.upvotes ?? b.upvotes ?? 0) - (b.voteStats?.downvotes ?? b.downvotes ?? 0);
          if (scoreA !== scoreB) return scoreA - scoreB;
          
          return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
        });
        
      case 'most-replies':
        
        return reviews.sort((a, b) => {
          const repliesA = this.replySummary[String(a.id)]?.count ?? a.replyCount ?? 0;
          const repliesB = this.replySummary[String(b.id)]?.count ?? b.replyCount ?? 0;
          if (repliesB !== repliesA) return repliesB - repliesA;
          
          return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
        });
        
      case 'least-replies':
        
        return reviews.sort((a, b) => {
          const repliesA = this.replySummary[String(a.id)]?.count ?? a.replyCount ?? 0;
          const repliesB = this.replySummary[String(b.id)]?.count ?? b.replyCount ?? 0;
          if (repliesA !== repliesB) return repliesA - repliesB;
          
          return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
        });
        
      case 'most-playtime':
        
        return reviews.sort((a, b) => {
          const playtimeA = a.playtimeData?.totalMinutes ?? a.playtimeMinutes ?? 0;
          const playtimeB = b.playtimeData?.totalMinutes ?? b.playtimeMinutes ?? 0;
          if (playtimeB !== playtimeA) return playtimeB - playtimeA;
          
          return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
        });
        
      case 'least-playtime':
        
        return reviews.sort((a, b) => {
          const playtimeA = a.playtimeData?.totalMinutes ?? a.playtimeMinutes ?? 0;
          const playtimeB = b.playtimeData?.totalMinutes ?? b.playtimeMinutes ?? 0;
          if (playtimeA !== playtimeB) return playtimeA - playtimeB;
          
          return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
        });
        
      case 'highest_rated':
      case 'lowest_rated':

        const gameReviewReception = {};
        reviews.forEach(review => {
          const gameId = review.gameId;
          if (!gameReviewReception[gameId]) {
            gameReviewReception[gameId] = { likes: 0, dislikes: 0 };
          }
          if (review.likeStatus === 'like') {
            gameReviewReception[gameId].likes++;
          } else if (review.likeStatus === 'dislike') {
            gameReviewReception[gameId].dislikes++;
          }
        });

        const getReceptionScore = (gameId) => {
          const reception = gameReviewReception[gameId];
          if (!reception) return 0.5;
          const total = reception.likes + reception.dislikes;
          if (total < 5) return 0.5; 
          
          const z = 1.96;
          const phat = reception.likes / total;
          const score = (phat + z * z / (2 * total) - z * Math.sqrt((phat * (1 - phat) + z * z / (4 * total)) / total)) / (1 + z * z / total);
          return score;
        };
        
        return reviews.sort((a, b) => {
          
          const aBlacklisted = a.isBlacklisted === true;
          const bBlacklisted = b.isBlacklisted === true;
          if (aBlacklisted && !bBlacklisted) return 1;
          if (!aBlacklisted && bBlacklisted) return -1;
          
          const scoreA = getReceptionScore(a.gameId);
          const scoreB = getReceptionScore(b.gameId);
          
          if (sortOption === 'highest_rated') {
            if (scoreA !== scoreB) return scoreB - scoreA;
          } else {
            if (scoreA !== scoreB) return scoreA - scoreB;
          }

          const totalA = (gameReviewReception[a.gameId]?.likes || 0) + (gameReviewReception[a.gameId]?.dislikes || 0);
          const totalB = (gameReviewReception[b.gameId]?.likes || 0) + (gameReviewReception[b.gameId]?.dislikes || 0);
          return totalB - totalA;
        });
        
      case 'underrated':

        return reviews
          .filter(r => {
            const players = r.game?.playing || 0;
            return players < 1000;
          })
          .sort((a, b) => {
            
            const scoreA = a.discoveryScore || this.calculateEngagementScore(a);
            const scoreB = b.discoveryScore || this.calculateEngagementScore(b);
            return scoreB - scoreA;
          });
        
      case 'hidden_gems':

        return reviews.sort((a, b) => {
          const aIsHidden = (a.game?.visits || 0) < 10000;
          const bIsHidden = (b.game?.visits || 0) < 10000;
          if (aIsHidden && !bIsHidden) return -1;
          if (!aIsHidden && bIsHidden) return 1;
          
          const scoreA = a.discoveryScore || this.calculateEngagementScore(a);
          const scoreB = b.discoveryScore || this.calculateEngagementScore(b);
          return scoreB - scoreA;
        });
        
      case 'trending':

        return reviews.sort((a, b) => {
          const aIsRising = (a.game?.visits || 0) >= 1000 && (a.game?.visits || 0) <= 100000;
          const bIsRising = (b.game?.visits || 0) >= 1000 && (b.game?.visits || 0) <= 100000;
          if (aIsRising && !bIsRising) return -1;
          if (!aIsRising && bIsRising) return 1;
          
          return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
        });
        
      case 'oldest':
        
        return reviews.sort((a, b) => {
          const timeA = new Date(a.timestamp || a.createdAt || 0).getTime();
          const timeB = new Date(b.timestamp || b.createdAt || 0).getTime();
          return timeA - timeB;
        });
        
      case 'game':

        return reviews.sort((a, b) => {
          const nameA = a.game?.name || '';
          const nameB = b.game?.name || '';
          return nameA.localeCompare(nameB);
        });
        
      case 'most_visits':

        return reviews.sort((a, b) => {
          const visitsA = a.game?.visits || 0;
          const visitsB = b.game?.visits || 0;
          return visitsB - visitsA;
        });
        
      case 'least_visits':

        return reviews.sort((a, b) => {
          const visitsA = a.game?.visits || 0;
          const visitsB = b.game?.visits || 0;
          return visitsA - visitsB;
        });
        
      case 'highest-rated-user':

        return reviews.sort((a, b) => {
          const scoreA = a.author?.rating?.totalScore || 0;
          const scoreB = b.author?.rating?.totalScore || 0;
          if (scoreB !== scoreA) return scoreB - scoreA;
          
          return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
        });
        
      case 'lowest-rated-user':

        return reviews.sort((a, b) => {
          const scoreA = a.author?.rating?.totalScore || 0;
          const scoreB = b.author?.rating?.totalScore || 0;
          if (scoreA !== scoreB) return scoreA - scoreB;
          
          return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
        });
        
      default:
        
        return reviews.sort((a, b) => {
          const timeA = new Date(a.timestamp || a.createdAt || 0).getTime();
          const timeB = new Date(b.timestamp || b.createdAt || 0).getTime();
          return timeB - timeA;
        });
    }
  },

  calculateWilsonScore(likes, dislikes) {
    const total = likes + dislikes;
    if (total < 5) return 0.5; 

    const z = 1.96;
    const phat = likes / total;
    const score = (phat + z * z / (2 * total) - z * Math.sqrt((phat * (1 - phat) + z * z / (4 * total)) / total)) / (1 + z * z / total);
    return score;
  },

  calculateEngagementScore(review) {
    const now = Date.now();
    const reviewDate = new Date(review.timestamp || 0).getTime();
    const daysOld = (now - reviewDate) / (1000 * 60 * 60 * 24);

    const baseScore = review.discoveryScore || 1;

    const reviewLength = review.text ? review.text.length : 0;
    const lengthMultiplier = Math.min(1 + (reviewLength / 300), 2.0);

    const voteCount = (review.voteStats?.upvotes ?? review.upvotes ?? 0) + 
                      (review.voteStats?.downvotes ?? review.downvotes ?? 0);
    const interactionMultiplier = 1 + Math.min(voteCount / 20, 1.5);

    const totalVotes = (review.game?.upvotes || 0) + (review.game?.downvotes || 0);
    const gameRating = totalVotes >= 10 
        ? (review.game?.upvotes || 0) / totalVotes
        : 0.5;
    const qualityMultiplier = 0.5 + (gameRating * 1.5);

    const freshnessMultiplier = Math.max(0.3, 1 - (daysOld / 14));

    const varietyBonus = this.getDiscoveryTypeBonus(review);

    const engagementScore = baseScore * 
        lengthMultiplier * 
        interactionMultiplier * 
        qualityMultiplier * 
        freshnessMultiplier * 
        varietyBonus;

    const reviewId = review.id || `${review.gameId}_${review.timestamp}`;
    const deterministicSeed = String(reviewId).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const deterministicFactor = 0.95 + ((deterministicSeed % 100) / 1000);
    
    return engagementScore * deterministicFactor;
  },

  getDiscoveryTypeBonus(review) {
    const game = review.game || {};
    const visits = game.visits || 0;
    const players = game.playing || 0;
    const totalVotes = (game.upvotes || 0) + (game.downvotes || 0);
    const rating = totalVotes > 0 ? game.upvotes / totalVotes : 0.8;
    const hasReliableRating = totalVotes >= 10;
    const isPositiveReview = review.likeStatus === 'like';

    if (hasReliableRating && isPositiveReview && players < 1000 && players > 0 && rating >= 0.7) {
      return 1.3; 
    } else if (hasReliableRating && isPositiveReview && visits < 10000 && rating >= 0.7) {
      return 1.2; 
    } else if (hasReliableRating && isPositiveReview && visits >= 1000 && visits <= 50000 && rating >= 0.8) {
      return 1.15; 
    }
    
    return 1.0; 
  },

  calculateQualityScore(review) {
    let score = 0;

    const voteScore = (review.voteStats?.upvotes ?? review.upvotes ?? 0) - (review.voteStats?.downvotes ?? review.downvotes ?? 0);
    score += voteScore * 10;

    const textLength = (review.text || '').length;
    if (textLength > 50) score += 5;
    if (textLength > 150) score += 10;
    if (textLength > 300) score += 15;

    const playtime = review.playtimeData?.totalMinutes || review.playtimeMinutes || 0;
    if (playtime > 60) score += 5;  
    if (playtime > 300) score += 10; 
    if (playtime > 600) score += 15; 

    const authorRating = review.author?.rating?.totalScore || 0;
    score += authorRating * 2;

    const ageInDays = (Date.now() - new Date(review.timestamp || review.createdAt || 0).getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays < 7) score += 10;
    else if (ageInDays < 30) score += 5;
    
    return score;
  },

  renderStats() {

    const totalReviews = this.gameStats?.totalReviews || 0;
    this.updateReviewsTabText(totalReviews);
  },

  updateReviewsTabText(count) {
    
    const tab = document.getElementById('GameDetailReviewsTab') || document.getElementById('ReviewsTab');
    if (tab) {
      const span = tab.querySelector('span');
      if (span) {
        if (count > 0) {
          span.textContent = `Reviews (${count.toLocaleString()})`;
        } else {
          span.textContent = 'Reviews';
        }
      }
    }
  },

  renderReviewForm() {
    const formContainer = this.container?.querySelector('.review-form-container');
    if (!formContainer) return;

    if (!this.currentUserId) {
      formContainer.innerHTML = `
        <div class="review-form-login">
          <p>Log in to Roblox to write a review</p>
        </div>
      `;
      return;
    }

    if (!this.rovlooAuthenticated) {
      formContainer.innerHTML = `
        <div class="review-form-login rovloo-login">
          <img src="images/rovloo/rovloo-ico64.png" alt="Rovloo" class="rovloo-login-icon" onerror="this.style.display='none'">
          <p>Connect to Rovloo to write reviews and vote</p>
          <button class="Button rovloo-login-btn" onclick="ReviewComponent.handleRovlooLogin()">
            <img src="images/rovloo/rovloo-ico64.png" alt="" class="btn-icon" onerror="this.style.display='none'">
            Connect to Rovloo
          </button>
          <p class="rovloo-info">This will authenticate you with Rovloo using your Roblox account</p>
          <div id="formError" class="form-error" style="display: none;"></div>
          <div id="formMessage" class="form-message" style="display: none;"></div>
        </div>
      `;
      return;
    }

    const playtimeData = this.cachedPlaytimeData || 
      (window.PlaytimeTracker ? window.PlaytimeTracker.getPlaytimeData(this.placeId) : { totalMinutes: 0, formattedPlaytime: '< 1m' });

    if (this.userReview) {
      formContainer.innerHTML = `
        <div class="review-form existing-review">
          <div class="form-header">
            <button class="review-status-btn" disabled>
              <img src="images/rovloo/btn-review_submitted.png" alt="Review Submitted">
            </button>
            <span class="playtime-badge">
              <img src="images/rovloo/playtime-indicator.png" alt="Playtime" class="playtime-icon">
              ${playtimeData.formattedPlaytime}
            </span>
          </div>
          <div class="your-review-content">
            <div class="like-status ${this.userReview.likeStatus}">
              <img src="images/rovloo/btn-thumbs${this.userReview.likeStatus === 'like' ? 'up' : 'down'}.png" alt="${this.userReview.likeStatus}">
              ${this.userReview.likeStatus === 'like' ? 'Recommended' : 'Not Recommended'}
            </div>
            ${this.userReview.text ? `<p class="review-text">${this.formatMarkdown(this.userReview.text)}</p>` : ''}
          </div>
          <div class="form-actions">
            <button class="Button edit-review-btn" onclick="ReviewComponent.showEditForm()">Edit Review</button>
            <button class="Button delete-review-btn" onclick="ReviewComponent.handleDelete('${this.userReview.id}')">Delete</button>
          </div>
        </div>
      `;
      return;
    }

    const hasVoted = this.userGameVote !== null && this.userGameVote !== undefined;
    const likeStatus = this.userGameVote === true ? 'like' : (this.userGameVote === false ? 'dislike' : null);
    const voteText = likeStatus === 'like' ? 'Recommended' : (likeStatus === 'dislike' ? 'Not Recommended' : 'Not Voted');

    this.selectedLikeStatus = likeStatus;
    
    if (!hasVoted) {
      
      formContainer.innerHTML = `
        <div class="review-form new-review">
          <div class="form-header">
            <span class="playtime-badge">
              <img src="images/rovloo/playtime-indicator.png" alt="Playtime" class="playtime-icon">
              ${playtimeData.formattedPlaytime}
            </span>
          </div>
          <div class="review-form-content">
            <div class="vote-required-message">
              <img src="images/rovloo/btn-thumbsup.png" alt="Vote" style="width: 24px; height: 24px; vertical-align: middle;">
              <p>You need to <strong>like or dislike</strong> this game before writing a review.</p>
              <p class="vote-hint">Use the thumbs up/down buttons above to vote on this game first.</p>
            </div>
          </div>
        </div>
      `;
      return;
    }
    
    formContainer.innerHTML = `
      <div class="review-form new-review">
        <div class="form-header">
          <button class="review-toggle-btn" id="toggleReviewFormBtn" onclick="ReviewComponent.toggleReviewForm()">
            <img src="images/rovloo/btn-review_hide.png" alt="Hide Review Form">
          </button>
          <span class="playtime-badge">
            <img src="images/rovloo/playtime-indicator.png" alt="Playtime" class="playtime-icon">
            ${playtimeData.formattedPlaytime}
          </span>
        </div>
        <div class="review-form-content" id="reviewFormContent">
          <div class="vote-status-display ${likeStatus}">
            <img src="images/rovloo/btn-thumbs${likeStatus === 'like' ? 'up' : 'down'}.png" alt="${likeStatus}">
            <span>${voteText}</span>
            <span class="vote-source">(based on your Roblox vote)</span>
          </div>
          <div class="review-editor-container">
            <div class="formatting-toolbar">
              <button type="button" class="format-btn" data-format="bold" title="Bold (**text**)"><strong>B</strong></button>
              <button type="button" class="format-btn" data-format="italic" title="Italic (*text*)"><em>I</em></button>
              <button type="button" class="format-btn" data-format="strike" title="Strikethrough (~~text~~)"><del>S</del></button>
              <button type="button" class="format-btn" data-format="code" title="Code (\`code\`)"><code>&lt;/&gt;</code></button>
              <button type="button" class="format-btn" data-format="link" title="Link ([text](url))">🔗</button>
              <span class="format-hint">Supports Markdown formatting</span>
            </div>
            <div id="reviewText" class="review-editable" contenteditable="true" data-placeholder="Write your review (optional, max 1000 characters)..."></div>
            <div class="preview-toggle">
              <label><input type="checkbox" id="showPreview" checked> Show preview</label>
            </div>
            <div class="review-preview" id="reviewPreview">
              <div class="preview-label">Preview:</div>
              <div class="preview-content" id="previewContent"><span class="preview-placeholder">Your formatted review will appear here...</span></div>
            </div>
          </div>
          <div class="char-count"><span id="charCount">0</span>/1000</div>
          <div class="form-actions">
            <button class="Button submit-review-btn" id="submitReviewBtn" onclick="ReviewComponent.submitReview()">
              Submit Review
            </button>
          </div>
          <div id="formError" class="form-error" style="display: none;"></div>
          <div id="formMessage" class="form-message" style="display: none;"></div>
        </div>
      </div>
    `;

    this.setupFormPreview();
  },

  setupFormPreview(textareaId = 'reviewText', previewId = 'previewContent', charCountId = 'charCount') {
    const editable = document.getElementById(textareaId);
    const preview = document.getElementById(previewId);
    const charCount = document.getElementById(charCountId);
    const showPreviewCheckbox = document.getElementById('showPreview');
    const previewContainer = document.getElementById('reviewPreview');
    
    if (!editable) return;

    let isUpdating = false;

    const updateInlineFormatting = () => {
      if (isUpdating) return;
      isUpdating = true;
      
      const text = this.getEditableText(editable);
      
      if (charCount) {
        charCount.textContent = text.length;
      }

      const cursorPos = this.saveCursorPosition(editable);
      editable.innerHTML = this.formatMarkdownInline(text) || '<br>'; 
      this.restoreCursorPosition(editable, cursorPos);

      if (preview && previewContainer && previewContainer.style.display !== 'none') {
        if (text.trim()) {
          preview.innerHTML = this.formatMarkdown(text);
        } else {
          preview.innerHTML = '<span class="preview-placeholder">Your formatted review will appear here...</span>';
        }
      }
      
      isUpdating = false;
    };
    
    editable.addEventListener('input', updateInlineFormatting);

    editable.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = e.clipboardData.getData('text/plain');
      document.execCommand('insertText', false, text);
    });

    if (showPreviewCheckbox && previewContainer) {
      showPreviewCheckbox.addEventListener('change', () => {
        previewContainer.style.display = showPreviewCheckbox.checked ? 'block' : 'none';
        if (showPreviewCheckbox.checked) {
          updateInlineFormatting();
        }
      });
    }

    const toolbar = editable.closest('.review-editor-container')?.querySelector('.formatting-toolbar');
    if (toolbar) {
      toolbar.querySelectorAll('.format-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.insertFormattingEditable(editable, btn.dataset.format);
          updateInlineFormatting();
        });
      });
    }

    updateInlineFormatting();
  },

  insertFormattingEditable(editable, format) {
    editable.focus();
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    const selectedText = range.toString();
    
    let newText = '';
    let selectStart = 0;
    let selectEnd = 0;
    
    switch (format) {
      case 'bold':
        newText = `**${selectedText || 'bold text'}**`;
        selectStart = 2;
        selectEnd = newText.length - 2;
        break;
      case 'italic':
        newText = `*${selectedText || 'italic text'}*`;
        selectStart = 1;
        selectEnd = newText.length - 1;
        break;
      case 'strike':
        newText = `~~${selectedText || 'strikethrough'}~~`;
        selectStart = 2;
        selectEnd = newText.length - 2;
        break;
      case 'code':
        newText = `\`${selectedText || 'code'}\``;
        selectStart = 1;
        selectEnd = newText.length - 1;
        break;
      case 'link':
        if (selectedText) {
          newText = `[${selectedText}](url)`;
          selectStart = newText.length - 4;
          selectEnd = newText.length - 1;
        } else {
          newText = '[link text](url)';
          selectStart = 1;
          selectEnd = 10;
        }
        break;
      default:
        return;
    }

    document.execCommand('insertText', false, newText);
  },

  insertFormatting(textarea, format) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const beforeText = textarea.value.substring(0, start);
    const afterText = textarea.value.substring(end);
    
    let newText = '';
    let cursorOffset = 0;
    
    switch (format) {
      case 'bold':
        newText = `**${selectedText || 'bold text'}**`;
        cursorOffset = selectedText ? newText.length : 2;
        break;
      case 'italic':
        newText = `*${selectedText || 'italic text'}*`;
        cursorOffset = selectedText ? newText.length : 1;
        break;
      case 'strike':
        newText = `~~${selectedText || 'strikethrough'}~~`;
        cursorOffset = selectedText ? newText.length : 2;
        break;
      case 'code':
        newText = `\`${selectedText || 'code'}\``;
        cursorOffset = selectedText ? newText.length : 1;
        break;
      case 'link':
        if (selectedText) {
          newText = `[${selectedText}](url)`;
          cursorOffset = newText.length - 4; 
        } else {
          newText = '[link text](url)';
          cursorOffset = 1; 
        }
        break;
      default:
        return;
    }
    
    textarea.value = beforeText + newText + afterText;

    const newCursorPos = start + cursorOffset;
    textarea.setSelectionRange(newCursorPos, selectedText ? newCursorPos : start + newText.length - (format === 'link' ? 5 : (format === 'bold' || format === 'strike' ? 2 : 1)));
    textarea.focus();
  },

  toggleReviewForm() {
    const formContent = document.getElementById('reviewFormContent');
    const toggleBtn = document.getElementById('toggleReviewFormBtn');
    
    if (!formContent || !toggleBtn) return;
    
    const isVisible = formContent.style.display !== 'none';
    
    if (isVisible) {
      
      formContent.style.display = 'none';
      toggleBtn.querySelector('img').src = 'images/rovloo/btn-review.png';
      toggleBtn.querySelector('img').alt = 'Write a Review';
    } else {
      
      formContent.style.display = 'block';
      toggleBtn.querySelector('img').src = 'images/rovloo/btn-review_hide.png';
      toggleBtn.querySelector('img').alt = 'Hide Review Form';
    }
  },

  selectLikeStatus(status) {
    this.selectedLikeStatus = status;
    
    const likeBtn = document.getElementById('likeBtn');
    const dislikeBtn = document.getElementById('dislikeBtn');
    const submitBtn = document.getElementById('submitReviewBtn');

    likeBtn?.classList.toggle('selected', status === 'like');
    dislikeBtn?.classList.toggle('selected', status === 'dislike');

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Review';
    }
  },

  showEditForm() {
    console.log('[ReviewComponent] showEditForm called');
    if (!this.userReview) {
      console.warn('[ReviewComponent] showEditForm: No user review found');
      return;
    }

    const formContainer = this.container?.querySelector('.review-form-container');
    if (!formContainer) {
      console.warn('[ReviewComponent] showEditForm: Form container not found');
      return;
    }

    const playtimeData = this.cachedPlaytimeData || 
      (window.PlaytimeTracker ? window.PlaytimeTracker.getPlaytimeData(this.placeId) : { totalMinutes: 0, formattedPlaytime: '< 1m' });

    const likeStatus = this.userGameVote === true ? 'like' : 
                       (this.userGameVote === false ? 'dislike' : this.userReview.likeStatus);
    const voteText = likeStatus === 'like' ? 'Recommended' : 'Not Recommended';
    
    this.selectedLikeStatus = likeStatus;

    formContainer.innerHTML = `
      <div class="review-form edit-review">
        <div class="form-header">
          <span>Edit Your Review</span>
          <span class="playtime-badge">
            <img src="images/rovloo/playtime-indicator.png" alt="Playtime" class="playtime-icon">
            ${playtimeData.formattedPlaytime}
          </span>
        </div>
        <div class="vote-status-display ${likeStatus}">
          <img src="images/rovloo/btn-thumbs${likeStatus === 'like' ? 'up' : 'down'}.png" alt="${likeStatus}">
          <span>${voteText}</span>
          <span class="vote-source">(based on your Roblox vote)</span>
        </div>
        <div class="review-editor-container">
          <div class="formatting-toolbar">
            <button type="button" class="format-btn" data-format="bold" title="Bold (**text**)"><strong>B</strong></button>
            <button type="button" class="format-btn" data-format="italic" title="Italic (*text*)"><em>I</em></button>
            <button type="button" class="format-btn" data-format="strike" title="Strikethrough (~~text~~)"><del>S</del></button>
            <button type="button" class="format-btn" data-format="code" title="Code (\`code\`)"><code>&lt;/&gt;</code></button>
            <button type="button" class="format-btn" data-format="link" title="Link ([text](url))">🔗</button>
            <span class="format-hint">Supports Markdown formatting</span>
          </div>
          <div id="reviewText" class="review-editable" contenteditable="true" data-placeholder="Write your review (optional, max 1000 characters)...">${this.formatMarkdownInline(this.userReview.text || '')}</div>
          <div class="preview-toggle">
            <label><input type="checkbox" id="showPreview" checked> Show preview</label>
          </div>
          <div class="review-preview" id="reviewPreview">
            <div class="preview-label">Preview:</div>
            <div class="preview-content" id="previewContent">${this.userReview.text ? this.formatMarkdown(this.userReview.text) : '<span class="preview-placeholder">Your formatted review will appear here...</span>'}</div>
          </div>
        </div>
        <div class="char-count"><span id="charCount">${(this.userReview.text || '').length}</span>/1000</div>
        <div class="form-actions">
          <button class="Button submit-review-btn" id="submitReviewBtn" onclick="ReviewComponent.updateReview()">Update Review</button>
          <button class="Button cancel-btn" onclick="ReviewComponent.renderReviewForm()">Cancel</button>
        </div>
        <div id="formError" class="form-error" style="display: none;"></div>
      </div>
    `;

    this.setupFormPreview();
    
    console.log('[ReviewComponent] showEditForm complete');
  },

  async submitReview() {
    if (this.isSubmitting || !this.selectedLikeStatus) return;

    if (!this.rovlooAuthenticated) {
      this.showFormError('Please login to Rovloo first');
      return;
    }
    
    // Check if user already has a review (prevent duplicates)
    if (this.userReview) {
      this.showFormError('You already have a review for this game. Please edit your existing review instead.');
      return;
    }

    const submitBtn = document.getElementById('submitReviewBtn');
    const errorDiv = document.getElementById('formError');
    const editable = document.getElementById('reviewText');

    if (!this.selectedLikeStatus) {
      this.showFormError('Please select Like or Dislike');
      return;
    }

    const text = editable ? this.getEditableText(editable).trim() : '';
    if (text.length > 1000) {
      this.showFormError('Review text must be 1000 characters or less');
      return;
    }

    this.isSubmitting = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
    }

    try {
      
      const playtimeData = window.roblox?.playtime ? 
        await window.roblox.playtime.getPlaytimeData(this.currentUserId, this.placeId) : { totalMinutes: 0, source: 'native' };

      const author = {
        userId: this.currentUserId,
        username: this.currentUsername,
        displayName: this.currentDisplayName || this.currentUsername
      };

      const reviewData = {
        likeStatus: this.selectedLikeStatus,
        text: text || '',
        playtimeData: playtimeData,
        author: author
      };

      await window.roblox.reviews.create(this.placeId, reviewData);

      if (window.roblox?.playtime && playtimeData.totalMinutes > 0) {
        await window.roblox.playtime.markSynced(this.currentUserId, this.placeId);
      }

      await this.loadReviews();

      if (typeof loadRovlooStats === 'function') {
        loadRovlooStats(this.placeId);
      } else if (window.loadRovlooStats) {
        window.loadRovlooStats(this.placeId);
      }

    } catch (error) {
      console.error('Failed to submit review:', error);

      if (error.message?.includes('authentication') || error.message?.includes('OAuth') || error.message?.includes('login')) {
        this.rovlooAuthenticated = false;
        this.showFormError('Session expired. Please login to Rovloo again.');
        this.renderReviewForm();
      } else {
        this.showFormError(error.message || 'Failed to submit review. Please try again.');
      }
      
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Review';
      }
    } finally {
      this.isSubmitting = false;
    }
  },

  async updateReview() {
    if (this.isSubmitting || !this.userReview) return;

    if (!this.rovlooAuthenticated) {
      this.showFormError('Please login to Rovloo first');
      return;
    }

    const submitBtn = document.getElementById('submitReviewBtn');
    const editable = document.getElementById('reviewText');

    const text = editable ? this.getEditableText(editable).trim() : '';
    if (text.length > 1000) {
      this.showFormError('Review text must be 1000 characters or less');
      return;
    }

    this.isSubmitting = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Updating...';
    }

    try {
      
      const playtimeData = window.PlaytimeTracker ? 
        await window.PlaytimeTracker.getPlaytimeDataAsync(this.placeId) : { totalMinutes: 0 };

      const reviewData = {
        gameId: this.placeId, 
        likeStatus: this.selectedLikeStatus || this.userReview.likeStatus,
        text: text || null,
        playtimeData: playtimeData
      };

      await window.roblox.reviews.update(this.userReview.id, reviewData);

      if (window.PlaytimeTracker && playtimeData.totalMinutes > 0) {
        await window.PlaytimeTracker.markPlaytimeSynced(this.placeId);
      }

      await this.loadReviews();

    } catch (error) {
      console.error('Failed to update review:', error);

      if (error.message?.includes('authentication') || error.message?.includes('OAuth') || error.message?.includes('login')) {
        this.rovlooAuthenticated = false;
        this.showFormError('Session expired. Please login to Rovloo again.');
        this.renderReviewForm();
      } else {
        this.showFormError(error.message || 'Failed to update review. Please try again.');
      }
      
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Update Review';
      }
    } finally {
      this.isSubmitting = false;
    }
  },

  async handleDelete(reviewId, gameId = null) {
    if (!confirm('Are you sure you want to delete your review?')) return;

    if (!this.rovlooAuthenticated) {
      alert('Please login to Rovloo first');
      return;
    }

    const placeId = this.browseMode ? (gameId || this.getReviewGameId(reviewId)) : this.placeId;
    
    if (!placeId || placeId === 'browse') {
      alert('Unable to delete review: game ID not found');
      return;
    }

    try {
      await window.roblox.reviews.delete(placeId, reviewId);
      this.userReview = null;
      await this.loadReviews();

    } catch (error) {
      console.error('Failed to delete review:', error);

      if (error.message?.includes('authentication') || error.message?.includes('OAuth') || error.message?.includes('login')) {
        this.rovlooAuthenticated = false;
        alert('Session expired. Please login to Rovloo again.');
        this.renderReviewForm();
      } else {
        alert('Failed to delete review: ' + (error.message || 'Unknown error'));
      }
    }
  },

  getReviewGameId(reviewId) {
    const review = this.reviews.find(r => r.id === reviewId);
    return review?.gameId || review?.game?.id || review?.game?.gameId || null;
  },

  showInlineEditForm(reviewId) {
    console.log('[ReviewComponent] showInlineEditForm called for review:', reviewId);
    const review = this.reviews.find(r => r.id === reviewId);
    if (!review) {
      console.error('[ReviewComponent] Review not found for edit:', reviewId);
      alert('Review not found');
      return;
    }

    const reviewItem = this.container?.querySelector(`.review-item[data-review-id="${reviewId}"]`);
    if (!reviewItem) {
      console.error('[ReviewComponent] Review item element not found:', reviewId);
      return;
    }

    const textDiv = reviewItem.querySelector('.review-text');
    if (!textDiv) {
      console.error('[ReviewComponent] Review text div not found');
      return;
    }

    const originalContent = textDiv.innerHTML;

    textDiv.innerHTML = `
      <div class="inline-edit-form">
        <div class="like-buttons-inline">
          <button type="button" class="like-btn ${review.likeStatus === 'like' ? 'selected' : ''}" 
                  onclick="event.stopPropagation(); this.classList.add('selected'); this.nextElementSibling.classList.remove('selected');">
            <img src="images/rovloo/btn-thumbsup.png" alt="Like">
            <span>Recommend</span>
          </button>
          <button type="button" class="dislike-btn ${review.likeStatus === 'dislike' ? 'selected' : ''}"
                  onclick="event.stopPropagation(); this.classList.add('selected'); this.previousElementSibling.classList.remove('selected');">
            <img src="images/rovloo/btn-thumbsdown.png" alt="Dislike">
            <span>Not Recommended</span>
          </button>
        </div>
        <div class="inline-edit-editable" contenteditable="true" data-placeholder="Write your review...">${this.formatMarkdownInline(review.text || '')}</div>
        <div class="inline-edit-actions">
          <button type="button" class="Button" onclick="event.stopPropagation(); ReviewComponent.saveInlineEdit('${reviewId}')">Save</button>
          <button type="button" class="Button cancel-btn" onclick="event.stopPropagation(); ReviewComponent.cancelInlineEdit('${reviewId}')">Cancel</button>
        </div>
      </div>
    `;

    const editable = textDiv.querySelector('.inline-edit-editable');
    if (editable) {
      let isUpdating = false;
      editable.addEventListener('input', () => {
        if (isUpdating) return;
        isUpdating = true;
        const text = this.getEditableText(editable);
        const cursorPos = this.saveCursorPosition(editable);
        editable.innerHTML = this.formatMarkdownInline(text) || '<br>';
        this.restoreCursorPosition(editable, cursorPos);
        isUpdating = false;
      });
      editable.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
      });
    }

    textDiv.dataset.originalContent = originalContent;
    console.log('[ReviewComponent] showInlineEditForm complete');
  },

  async saveInlineEdit(reviewId) {
    const review = this.reviews.find(r => r.id === reviewId);
    if (!review) return;

    const reviewItem = this.container?.querySelector(`.review-item[data-review-id="${reviewId}"]`);
    if (!reviewItem) return;

    const editable = reviewItem.querySelector('.inline-edit-editable');
    const likeBtn = reviewItem.querySelector('.like-btn');
    const dislikeBtn = reviewItem.querySelector('.dislike-btn');
    
    const text = editable ? this.getEditableText(editable).trim() : '';
    const likeStatus = likeBtn?.classList.contains('selected') ? 'like' : 
                       dislikeBtn?.classList.contains('selected') ? 'dislike' : review.likeStatus;

    if (text.length > 1000) {
      alert('Review text must be 1000 characters or less');
      return;
    }

    const gameId = review.gameId || review.game?.id || review.game?.gameId;
    if (!gameId) {
      alert('Unable to update review: game ID not found');
      return;
    }

    try {
      const reviewData = {
        gameId: gameId,
        likeStatus: likeStatus,
        text: text || null
      };

      await window.roblox.reviews.update(review.id, reviewData);

      await this.loadReviews();
    } catch (error) {
      console.error('Failed to update review:', error);
      alert('Failed to update review: ' + (error.message || 'Unknown error'));
    }
  },

  cancelInlineEdit(reviewId) {
    const reviewItem = this.container?.querySelector(`.review-item[data-review-id="${reviewId}"]`);
    if (!reviewItem) return;

    const textDiv = reviewItem.querySelector('.review-text');
    if (!textDiv || !textDiv.dataset.originalContent) {
      
      this.loadReviews();
      return;
    }

    textDiv.innerHTML = textDiv.dataset.originalContent;
    delete textDiv.dataset.originalContent;
  },

  showFormError(message) {
    const errorDiv = document.getElementById('formError');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';
      errorDiv.className = 'form-error';
      setTimeout(() => {
        errorDiv.style.display = 'none';
      }, 5000);
    }
  },

  showFormMessage(message, type = 'info') {
    const messageDiv = document.getElementById('formMessage');
    if (messageDiv) {
      messageDiv.textContent = message;
      messageDiv.style.display = 'block';
      messageDiv.className = `form-message ${type}`;
      setTimeout(() => {
        messageDiv.style.display = 'none';
      }, 3000);
    }
  },

  renderReviewsList() {
    const listContainer = this.container?.querySelector('.reviews-list');
    console.log('[ReviewComponent] renderReviewsList:', {
      containerFound: !!listContainer,
      reviewsCount: this.reviews?.length || 0,
      containerVisible: listContainer ? listContainer.offsetParent !== null : false,
      containerDisplay: listContainer ? window.getComputedStyle(listContainer).display : 'N/A'
    });
    if (!listContainer) {
      console.warn('[ReviewComponent] reviewsList container not found');
      return;
    }

    if (!this.reviews || this.reviews.length === 0) {
      console.log('[ReviewComponent] No reviews to display');
      listContainer.innerHTML = `
        <div class="no-reviews">
          <p>No reviews yet. Be the first to review this game!</p>
        </div>
      `;
      return;
    }

    console.log('[ReviewComponent] Rendering', this.reviews.length, 'reviews');
    try {
      const html = this.reviews.map((review, index) => {
        try {
          return this.renderReviewItem(review);
        } catch (err) {
          console.error(`[ReviewComponent] Error rendering review ${index}:`, err);
          return `<div class="review-item" style="color: red;">Error rendering review: ${err.message}</div>`;
        }
      }).join('');
      console.log('[ReviewComponent] Generated HTML length:', html.length);
      listContainer.innerHTML = html;
      console.log('[ReviewComponent] innerHTML set, children count:', listContainer.children.length);

      if (this.browseMode) {
        this.lazyLoadGameThumbnails();
      }
    } catch (err) {
      console.error('[ReviewComponent] Error in renderReviewsList:', err);
      listContainer.innerHTML = `<div class="reviews-error">Error rendering reviews: ${err.message}</div>`;
    }
  },

  async lazyLoadGameThumbnails() {
    const images = document.querySelectorAll('img[data-needs-thumbnail="true"]');
    if (images.length === 0) return;

    if (!window.RobloxClient?.api?.getGameIcons) {
      console.warn('[ReviewComponent] RobloxClient.api.getGameIcons not available, skipping lazy load');
      return;
    }

    const universeIds = [...new Set(Array.from(images).map(img => img.dataset.universeId).filter(Boolean))];
    if (universeIds.length === 0) return;
    
    console.log('[ReviewComponent] Lazy loading thumbnails for', universeIds.length, 'games');
    
    try {
      
      const icons = await window.RobloxClient.api.getGameIcons(universeIds, '150x150');
      
      if (icons?.data) {
        
        const iconMap = {};
        icons.data.forEach(icon => {
          if (icon.targetId && icon.imageUrl) {
            iconMap[icon.targetId] = icon.imageUrl;
          }
        });

        images.forEach(img => {
          const universeId = img.dataset.universeId;
          if (universeId && iconMap[universeId]) {
            img.src = iconMap[universeId];
            img.removeAttribute('data-needs-thumbnail');
          }
        });
      }
    } catch (err) {
      console.error('[ReviewComponent] Failed to lazy load thumbnails:', err);
    }
  },

  renderReviewItem(review) {
    const isOwnReview = review.author?.userId === this.currentUserId;
    const timestamp = review.timestamp ? new Date(review.timestamp).toLocaleDateString() : '';
    const editedTimestamp = review.editedTimestamp ? new Date(review.editedTimestamp).toLocaleDateString() : '';

    const playtimeMinutes = review.playtimeData?.totalMinutes || 0;
    const playtimeFormatted = window.PlaytimeTracker ? 
      window.PlaytimeTracker.formatPlaytime(playtimeMinutes * 60) : 
      `${playtimeMinutes}m`;

    const upvotes = review.voteStats?.upvotes || 0;
    const downvotes = review.voteStats?.downvotes || 0;
    const voteScore = review.voteStats?.score || (upvotes - downvotes);
    const scoreClass = voteScore > 0 ? 'positive' : voteScore < 0 ? 'negative' : 'neutral';

    const reviewIdStr = String(review.id);
    const cachedVote = this.userVoteCache[reviewIdStr];
    const userVote = cachedVote !== undefined ? cachedVote : (review.userVote || null);

    const replySummaryCount = (this.replySummary && typeof this.replySummary === 'object') 
      ? this.replySummary[reviewIdStr]?.count 
      : undefined;
    const replyCount = review.replyCount ?? replySummaryCount ?? 0;

    if (!this.browseMode) {
      console.log('[ReviewComponent] renderReviewItem reply count for', reviewIdStr, ':', {
        'review.replyCount': review.replyCount,
        'replySummaryCount': replySummaryCount,
        'final replyCount': replyCount,
        'replySummary keys': Object.keys(this.replySummary || {})
      });
    }

    const isExpanded = (this.expandedReplies instanceof Set) 
      ? this.expandedReplies.has(review.id) 
      : false;

    const authorRating = review.author?.rating;
    const authorTotalScore = authorRating?.totalScore ?? 0;
    const authorScoreClass = authorTotalScore > 0 ? 'positive' : authorTotalScore < 0 ? 'negative' : 'neutral';
    const authorScoreText = authorTotalScore > 0 ? `+${authorTotalScore}` : authorTotalScore.toString();

    const authorBadges = review.author?.badges || [];
    const isAdmin = review.author?.isAdmin || authorBadges.some(b => b.id === 'admin');
    
    const authorUserId = review.author?.userId;
    const isDonor = review.author?.isDonor || 
                    authorBadges.some(b => b.id === 'donation') ||
                    (authorUserId && this.donorStatusCache[String(authorUserId)]);
    const isBanned = review.author?.isBanned || false;
    
    let badgesHtml = '';
    if (isDonor) {
      badgesHtml += `<a href="#catalog-item?id=86478952287791" class="author-badge donor-badge" title="Supporter - owns Rovloo's Calling"><img src="images/rovloo/donate128.png" alt="Supporter"></a>`;
    }
    if (isAdmin) {
      badgesHtml += `<span class="author-badge admin-badge" title="Administrator"><img src="images/rovloo/admin64.png" alt="Admin"></span>`;
    }
    if (isBanned) {
      badgesHtml += `<span class="author-badge banned-badge" title="Banned User">🚫</span>`;
    }

    let reviewTextHtml = '';
    if (review.text) {
      const MAX_LENGTH = 300; 
      
      if (review.text.length > MAX_LENGTH) {

        let truncateAt = MAX_LENGTH;
        const lastSpace = review.text.lastIndexOf(' ', MAX_LENGTH);
        if (lastSpace > MAX_LENGTH * 0.7) {
          truncateAt = lastSpace;
        }

        const truncatedRawText = review.text.substring(0, truncateAt).replace(/[\s\n]+$/, '');
        let truncatedFormatted = this.formatMarkdown(truncatedRawText);
        
        truncatedFormatted = truncatedFormatted.replace(/(<br\s*\/?>)+$/gi, '');
        const fullFormatted = this.formatMarkdown(review.text);

        reviewTextHtml = `<div class="review-text"><span class="review-text-content"><span class="review-text-short" id="review-text-short-${review.id}">${truncatedFormatted}</span><span class="review-ellipsis" id="review-ellipsis-${review.id}">...</span><span class="review-text-full" id="review-text-full-${review.id}" style="display: none;">${fullFormatted}</span></span><button class="show-more-btn" onclick="ReviewComponent.toggleReviewText('${review.id}')"><span class="show-more-text">Show More</span><span class="show-less-text" style="display: none;">Show Less</span></button></div>`;
      } else {
        const formattedText = this.formatMarkdown(review.text);
        reviewTextHtml = `<div class="review-text">${formattedText}</div>`;
      }
    }

    let gameContextHtml = '';
    if (this.browseMode && review.game) {
      const game = review.game;
      const gameName = game.name || 'Unknown Game';
      const gameId = game.gameId || game.id || review.gameId;
      const universeId = game.universeId || game.id;

      let thumbnailUrl = null;
      let needsLazyLoad = false;
      
      if (game.thumbnailUrl && (game.thumbnailUrl.includes('rbxcdn.com') || game.thumbnailUrl.includes('roblox.com'))) {
        thumbnailUrl = game.thumbnailUrl;
      } else {
        
        thumbnailUrl = 'images/spinners/spinner100x100.gif';
        needsLazyLoad = true;
      }
      
      gameContextHtml = `
        <div class="game-info-inline">
          <a href="#game-detail?id=${gameId}" class="game-link-inline">
            <img src="${thumbnailUrl}" alt="${this.escapeHtml(gameName)}" class="game-thumbnail-inline" 
                 ${needsLazyLoad ? `data-universe-id="${universeId}" data-needs-thumbnail="true"` : ''}
                 onerror="this.src='images/spinners/spinner100x100.gif'">
          </a>
          <div class="game-details-inline">
            <a href="#game-detail?id=${gameId}" class="game-name-link">${this.escapeHtml(gameName)}</a>
            <div class="game-stats-inline">
              ${game.playing ? `<span>👥 ${game.playing.toLocaleString()}</span>` : ''}
              ${game.visits ? `<span>👁️ ${game.visits.toLocaleString()}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="review-item ${isOwnReview ? 'own-review' : ''} ${this.browseMode ? 'browse-mode' : ''}" data-review-id="${review.id}">
        <div class="review-header">
          ${gameContextHtml}
          <a href="#profile?id=${review.author?.userId || review.author?.id}" class="author-link">
            <img src="${this.getAvatarUrl(review.author?.avatarUrl, review.author?.userId || review.author?.id)}" alt="Avatar" class="author-avatar" onerror="this.src='images/spinners/spinner100x100.gif'">
          </a>
          <div class="author-info">
            <div class="author-name-row">
              <a href="#profile?id=${review.author?.userId || review.author?.id}" class="author-name">
                ${this.escapeHtml(review.author?.displayName || review.author?.username || 'Unknown')}
              </a>
              ${badgesHtml}
              <span class="author-score ${authorScoreClass}" title="Rovloo Score: ${authorScoreText}">${authorScoreText}</span>
            </div>
            <span class="author-username">@${this.escapeHtml(review.author?.username || 'unknown')}</span>
          </div>
          <div class="review-meta">
            <span class="like-indicator ${review.likeStatus}">
              <img src="images/rovloo/btn-thumbs${review.likeStatus === 'like' ? 'up' : 'down'}.png" alt="${review.likeStatus}">
              ${review.likeStatus === 'like' ? 'Recommended' : 'Not Recommended'}
            </span>
            <span class="playtime-badge">
              <img src="images/rovloo/playtime-indicator.png" alt="Playtime" class="playtime-icon">
              ${playtimeFormatted}
            </span>
            <span class="review-date">${timestamp}</span>
            ${editedTimestamp ? `<span class="edited-indicator">(edited ${editedTimestamp})</span>` : ''}
          </div>
        </div>
        ${reviewTextHtml}
        <div class="review-footer">
          <div class="vote-buttons">
            <button class="vote-btn upvote ${userVote === 'upvote' ? 'voted' : ''} ${isOwnReview ? 'own-review-disabled' : ''}" 
                    onclick="ReviewComponent.handleVote('${review.id}', 'upvote')"
                    ${!this.currentUserId ? 'disabled title="Log in to vote"' : (isOwnReview ? 'disabled title="You cannot vote on your own review"' : '')}>
              <img src="images/rovloo/btn-thumbsup.png" alt="Upvote">
              <span>${upvotes}</span>
            </button>
            <button class="vote-btn downvote ${userVote === 'downvote' ? 'voted' : ''} ${isOwnReview ? 'own-review-disabled' : ''}" 
                    onclick="ReviewComponent.handleVote('${review.id}', 'downvote')"
                    ${!this.currentUserId ? 'disabled title="Log in to vote"' : (isOwnReview ? 'disabled title="You cannot vote on your own review"' : '')}>
              <img src="images/rovloo/btn-thumbsdown.png" alt="Downvote">
              <span>${downvotes}</span>
            </button>
            <span class="vote-score ${scoreClass}">Score: ${voteScore > 0 ? '+' : ''}${voteScore}</span>
          </div>
          <div class="reply-section">
            <button class="reply-toggle-btn ${isExpanded ? 'expanded' : ''}" 
                    onclick="ReviewComponent.toggleReplies('${review.id}')"
                    data-review-id="${review.id}">
              <span class="reply-icon">💬</span>
              Replies (<span class="reply-count">${replyCount}</span>)
              <span class="toggle-arrow">${isExpanded ? '▲' : '▼'}</span>
            </button>
            ${isOwnReview ? `
              <button class="edit-review-btn-inline" onclick="ReviewComponent.showInlineEditForm('${review.id}')">Edit</button>
              <button class="delete-review-btn-inline" onclick="ReviewComponent.handleDelete('${review.id}', '${review.gameId || review.game?.id || ''}')">Delete</button>
            ` : ''}
          </div>
        </div>
        <div class="replies-thread" data-review-id="${review.id}" style="display: ${isExpanded ? 'block' : 'none'};">
          ${isExpanded ? '<div class="replies-loading">Loading replies...</div>' : ''}
        </div>
      </div>
    `;
  },

  toggleReviewText(reviewId) {
    
    const queryScope = this.container || document;
    const shortText = queryScope.querySelector(`#review-text-short-${reviewId}`);
    const fullText = queryScope.querySelector(`#review-text-full-${reviewId}`);
    const ellipsis = queryScope.querySelector(`#review-ellipsis-${reviewId}`);
    const btn = event.target.closest('.show-more-btn');
    
    if (!shortText || !fullText || !btn) return;
    
    const showMoreText = btn.querySelector('.show-more-text');
    const showLessText = btn.querySelector('.show-less-text');
    
    if (fullText.style.display === 'none') {
      
      shortText.style.display = 'none';
      if (ellipsis) ellipsis.style.display = 'none';
      fullText.style.display = 'inline';
      showMoreText.style.display = 'none';
      showLessText.style.display = 'inline';
    } else {
      
      shortText.style.display = 'inline';
      if (ellipsis) ellipsis.style.display = 'inline';
      fullText.style.display = 'none';
      showMoreText.style.display = 'inline';
      showLessText.style.display = 'none';
    }
  },

  async handleVote(reviewId, voteType) {
    if (!this.currentUserId) return;

    if (!this.rovlooAuthenticated) {
      
      const shouldLogin = confirm('You need to login to Rovloo to vote on reviews. Login now?');
      if (shouldLogin) {
        await this.handleRovlooLogin();
      }
      return;
    }

    const review = this.reviews.find(r => r.id === reviewId);
    if (!review) return;

    if (!review.voteStats) {
      review.voteStats = { upvotes: 0, downvotes: 0, score: 0 };
    }

    const reviewIdStr = String(reviewId);
    const currentVote = this.userVoteCache[reviewIdStr] !== undefined 
      ? this.userVoteCache[reviewIdStr] 
      : (review.userVote || null);

    try {
      
      if (currentVote === voteType) {
        await window.roblox.reviews.removeVote(reviewId);
        this.userVoteCache[reviewIdStr] = null;
        review.userVote = null;
        if (voteType === 'upvote') {
          review.voteStats.upvotes = Math.max(0, review.voteStats.upvotes - 1);
        } else {
          review.voteStats.downvotes = Math.max(0, review.voteStats.downvotes - 1);
        }
      } else {
        
        if (currentVote) {
          if (currentVote === 'upvote') {
            review.voteStats.upvotes = Math.max(0, review.voteStats.upvotes - 1);
          } else {
            review.voteStats.downvotes = Math.max(0, review.voteStats.downvotes - 1);
          }
        }

        await window.roblox.reviews.vote(reviewId, voteType);
        this.userVoteCache[reviewIdStr] = voteType;
        review.userVote = voteType;
        if (voteType === 'upvote') {
          review.voteStats.upvotes = (review.voteStats.upvotes || 0) + 1;
        } else {
          review.voteStats.downvotes = (review.voteStats.downvotes || 0) + 1;
        }
      }

      review.voteStats.score = review.voteStats.upvotes - review.voteStats.downvotes;

      this.renderReviewsList();

    } catch (error) {
      console.error('Failed to vote:', error);

      if (error.message?.includes('authentication') || error.message?.includes('OAuth') || error.message?.includes('login')) {
        this.rovlooAuthenticated = false;
        const shouldLogin = confirm('Session expired. Login to Rovloo again?');
        if (shouldLogin) {
          await this.handleRovlooLogin();
        }
      }
    }
  },

  renderPagination() {
    const paginationContainer = this.container?.querySelector('.reviews-pagination');
    if (!paginationContainer) return;

    if (this.totalPages <= 1) {
      paginationContainer.innerHTML = '';
      return;
    }

    let paginationHtml = '<div class="pagination-controls">';

    paginationHtml += `
      <button class="pagination-btn prev" 
              onclick="ReviewComponent.goToPage(${this.currentPage - 1})"
              ${this.currentPage === 1 ? 'disabled' : ''}>
        &lt; Prev
      </button>
    `;

    paginationHtml += '<div class="page-numbers">';
    
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
      paginationHtml += `<button class="pagination-btn page" onclick="ReviewComponent.goToPage(1)">1</button>`;
      if (startPage > 2) {
        paginationHtml += '<span class="pagination-ellipsis">...</span>';
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      paginationHtml += `
        <button class="pagination-btn page ${i === this.currentPage ? 'current' : ''}" 
                onclick="ReviewComponent.goToPage(${i})"
                ${i === this.currentPage ? 'disabled' : ''}>
          ${i}
        </button>
      `;
    }

    if (endPage < this.totalPages) {
      if (endPage < this.totalPages - 1) {
        paginationHtml += '<span class="pagination-ellipsis">...</span>';
      }
      paginationHtml += `<button class="pagination-btn page" onclick="ReviewComponent.goToPage(${this.totalPages})">${this.totalPages}</button>`;
    }

    paginationHtml += '</div>';

    paginationHtml += `
      <button class="pagination-btn next" 
              onclick="ReviewComponent.goToPage(${this.currentPage + 1})"
              ${this.currentPage === this.totalPages ? 'disabled' : ''}>
        Next &gt;
      </button>
    `;

    paginationHtml += '</div>';
    paginationHtml += `<div class="pagination-info">Page ${this.currentPage} of ${this.totalPages}</div>`;

    paginationContainer.innerHTML = paginationHtml;
  },

  async goToPage(page) {
    if (page < 1 || page > this.totalPages || page === this.currentPage) return;
    this.currentPage = page;
    await this.loadReviews();

    const container = document.getElementById(this.containerId);
    container?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  async updateFilters(options) {
    if (options.sort !== undefined) this.sortOption = options.sort;
    if (options.filter !== undefined) this.filterOption = options.filter;
    this.currentPage = 1;
    await this.loadReviews();
  },

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  formatMarkdown(text) {
    if (!text) return '';

    let formatted = this.escapeHtml(text);

    formatted = formatted.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    
    // Bold: **text** or __text__
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    
    // Italic: *text* or _text_ (but not inside words for underscore)
    // Be careful not to match ** or __ which are bold
    formatted = formatted.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
    formatted = formatted.replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>');
    
    // Strikethrough: ~~text~~
    formatted = formatted.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    
    // Links: [text](url) - only allow safe URLs (http, https, roblox game links)
    formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
      // Validate URL - only allow http, https, and roblox.com links
      const trimmedUrl = url.trim();
      if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
        // Additional safety: escape the URL
        const safeUrl = this.escapeHtml(trimmedUrl);
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="markdown-link">${linkText}</a>`;
      }
      // If URL doesn't match safe patterns, just return the text without link
      return linkText;
    });
    
    // Line breaks: convert newlines to <br>
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
  },

  /**
   * Format markdown inline - keeps symbols visible but applies styling
   * Used for live editing in contenteditable fields
   */
  formatMarkdownInline(text) {
    if (!text) return '';
    
    // First escape HTML to prevent XSS
    let formatted = this.escapeHtml(text);
    
    // Code blocks (inline) - wrap entire `code` including backticks
    formatted = formatted.replace(/(`[^`]+`)/g, '<span class="md-code">$1</span>');

    formatted = formatted.replace(/(\*\*[^*]+\*\*)/g, '<span class="md-bold">$1</span>');

    formatted = formatted.replace(/(~~[^~]+~~)/g, '<span class="md-strike">$1</span>');

    formatted = formatted.replace(/(?<!\*)(\*[^*]+\*)(?!\*)/g, '<span class="md-italic">$1</span>');

    formatted = formatted.replace(/(\[[^\]]+\]\([^)]+\))/g, '<span class="md-link">$1</span>');

    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
  },

  getEditableText(element) {
    if (!element) return '';
    
    let text = '';
    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      } else if (node.nodeName === 'BR') {
        text += '\n';
      } else if (node.nodeName === 'DIV' && text.length > 0 && !text.endsWith('\n')) {
        text += '\n';
        for (const child of node.childNodes) walk(child);
      } else {
        for (const child of node.childNodes) walk(child);
      }
    };
    walk(element);
    return text;
  },

  saveCursorPosition(element) {
    const selection = window.getSelection();
    if (!selection.rangeCount) return null;
    
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.startContainer, range.startOffset);
    const start = preCaretRange.toString().length;
    
    return {
      start,
      end: start + range.toString().length
    };
  },

  restoreCursorPosition(element, pos) {
    if (!pos || !element) return;
    
    const selection = window.getSelection();
    const range = document.createRange();
    
    let charIndex = 0;
    let foundStart = false;
    let foundEnd = false;
    let startNode, startOffset, endNode, endOffset;
    
    const walk = (node) => {
      if (foundEnd) return;
      
      if (node.nodeType === Node.TEXT_NODE) {
        const nextCharIndex = charIndex + node.length;
        
        if (!foundStart && pos.start >= charIndex && pos.start <= nextCharIndex) {
          startNode = node;
          startOffset = pos.start - charIndex;
          foundStart = true;
        }
        
        if (!foundEnd && pos.end >= charIndex && pos.end <= nextCharIndex) {
          endNode = node;
          endOffset = pos.end - charIndex;
          foundEnd = true;
        }
        
        charIndex = nextCharIndex;
      } else {
        for (const child of node.childNodes) {
          walk(child);
          if (foundEnd) return;
        }
      }
    };
    
    walk(element);
    
    if (foundStart && foundEnd) {
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      selection.removeAllRanges();
      selection.addRange(range);
    } else if (foundStart) {
      range.setStart(startNode, startOffset);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  },

  async toggleReplies(reviewId) {
    console.log('[ReviewComponent] toggleReplies called for:', reviewId);

    if (!this.expandedReplies || !(this.expandedReplies instanceof Set)) {
      console.warn('[ReviewComponent] expandedReplies was not initialized, creating new Set');
      this.expandedReplies = new Set();
    }

    const queryScope = this.container || document;
    const threadContainer = queryScope.querySelector(`.replies-thread[data-review-id="${reviewId}"]`);
    const toggleBtn = queryScope.querySelector(`.reply-toggle-btn[data-review-id="${reviewId}"]`);
    
    if (!threadContainer) {
      console.warn('[ReviewComponent] Thread container not found for review:', reviewId);
      return;
    }

    const isExpanded = this.expandedReplies.has(reviewId);
    console.log('[ReviewComponent] Current expanded state:', isExpanded);
    
    if (isExpanded) {
      
      this.expandedReplies.delete(reviewId);
      threadContainer.style.display = 'none';
      threadContainer.innerHTML = '';
      if (toggleBtn) {
        toggleBtn.classList.remove('expanded');
        toggleBtn.querySelector('.toggle-arrow').textContent = '▼';
      }
    } else {
      
      this.expandedReplies.add(reviewId);
      threadContainer.style.display = 'block';
      threadContainer.innerHTML = '<div class="replies-loading">Loading replies...</div>';
      if (toggleBtn) {
        toggleBtn.classList.add('expanded');
        toggleBtn.querySelector('.toggle-arrow').textContent = '▲';
      }
      await this.loadReplies(reviewId);
    }
  },

  async loadReplies(reviewId) {
    
    const queryScope = this.container || document;
    const threadContainer = queryScope.querySelector(`.replies-thread[data-review-id="${reviewId}"]`);
    if (!threadContainer) return;

    try {
      const data = await window.roblox.reviews.getReplies(reviewId, { limit: 50 });

      let replies = [];
      let total = 0;
      
      if (data) {
        if (Array.isArray(data)) {
          
          replies = data;
          total = data.length;
        } else if (Array.isArray(data.items)) {
          
          replies = data.items;
          total = data.total || data.items.length;
        } else if (Array.isArray(data.replies)) {
          
          replies = data.replies;
          total = data.total || data.replies.length;
        }
      }

      this.replySummary[String(reviewId)] = { count: total };

      const countSpan = queryScope.querySelector(`.reply-toggle-btn[data-review-id="${reviewId}"] .reply-count`);
      if (countSpan) countSpan.textContent = total;

      this.renderRepliesThread(reviewId, replies, total, threadContainer);

      this.refreshExpiredAvatars();

      this.refreshReplyDonorBadges(reviewId, replies);
    } catch (error) {
      console.error('Failed to load replies:', error);
      threadContainer.innerHTML = `
        <div class="replies-error">
          Failed to load replies. <button class="retry-btn" onclick="ReviewComponent.loadReplies('${reviewId}')">Retry</button>
        </div>
      `;
    }
  },

  renderRepliesThread(reviewId, replies, total, container) {
    let html = '<div class="replies-list">';

    if (replies.length === 0) {
      html += '<div class="no-replies">No replies yet. Be the first to reply!</div>';
    } else {
      for (const reply of replies) {
        html += this.renderReplyItem(reply, reviewId);
      }
    }

    html += '</div>';

    if (this.rovlooAuthenticated) {
      html += `
        <div class="reply-form" data-review-id="${reviewId}">
          <div class="reply-editor-container">
            <div class="formatting-toolbar compact">
              <button type="button" class="format-btn" data-format="bold" title="Bold"><strong>B</strong></button>
              <button type="button" class="format-btn" data-format="italic" title="Italic"><em>I</em></button>
              <button type="button" class="format-btn" data-format="code" title="Code"><code>&lt;/&gt;</code></button>
            </div>
            <div class="reply-editable" contenteditable="true" data-placeholder="Write a reply..."></div>
            <div class="reply-preview" style="display: none;">
              <div class="preview-content"></div>
            </div>
          </div>
          <div class="reply-form-actions">
            <span class="reply-char-count"><span class="count">0</span>/500</span>
            <label class="preview-toggle-inline"><input type="checkbox" class="reply-preview-toggle"> Preview</label>
            <button class="Button reply-submit-btn" onclick="ReviewComponent.submitReply('${reviewId}')">Post Reply</button>
          </div>
        </div>
      `;
    } else if (this.currentUserId) {
      html += `
        <div class="reply-form-login">
          <button class="Button" onclick="ReviewComponent.handleRovlooLogin()">Login to Rovloo to reply</button>
        </div>
      `;
    } else {
      html += `
        <div class="reply-form-login">
          <span>Log in to Roblox to reply</span>
        </div>
      `;
    }

    container.innerHTML = html;

    const editable = container.querySelector('.reply-editable');
    const charCount = container.querySelector('.reply-char-count .count');
    const previewToggle = container.querySelector('.reply-preview-toggle');
    const previewContainer = container.querySelector('.reply-preview');
    const previewContent = container.querySelector('.reply-preview .preview-content');
    
    if (editable) {
      let isUpdating = false;

      const updateReplyFormatting = () => {
        if (isUpdating) return;
        isUpdating = true;
        
        const text = this.getEditableText(editable);
        
        if (charCount) charCount.textContent = text.length;

        const cursorPos = this.saveCursorPosition(editable);
        editable.innerHTML = this.formatMarkdownInline(text) || '<br>';
        this.restoreCursorPosition(editable, cursorPos);

        if (previewContent && previewContainer && previewContainer.style.display !== 'none') {
          previewContent.innerHTML = text.trim() 
            ? this.formatMarkdown(text) 
            : '<span class="preview-placeholder">Preview...</span>';
        }
        
        isUpdating = false;
      };
      
      editable.addEventListener('input', updateReplyFormatting);

      editable.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
      });

      if (previewToggle && previewContainer) {
        previewToggle.addEventListener('change', () => {
          previewContainer.style.display = previewToggle.checked ? 'block' : 'none';
          if (previewToggle.checked) updateReplyFormatting();
        });
      }

      const toolbar = container.querySelector('.formatting-toolbar');
      if (toolbar) {
        toolbar.querySelectorAll('.format-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            this.insertFormattingEditable(editable, btn.dataset.format);
            updateReplyFormatting();
          });
        });
      }
    }
  },

  renderReplyItem(reply, reviewId) {
    const isOwnReply = reply.author?.userId === this.currentUserId;
    const timestamp = reply.createdAt ? new Date(reply.createdAt).toLocaleDateString() : '';
    const editedTimestamp = reply.editedAt ? new Date(reply.editedAt).toLocaleDateString() : '';

    const upvotes = reply.voteStats?.upvotes || 0;
    const downvotes = reply.voteStats?.downvotes || 0;
    const voteScore = reply.voteStats?.score || (upvotes - downvotes);
    const scoreClass = voteScore > 0 ? 'positive' : voteScore < 0 ? 'negative' : 'neutral';

    const replyIdStr = String(reply.id);
    const cachedVote = this.userReplyVoteCache[replyIdStr];
    const userVote = cachedVote !== undefined ? cachedVote : (reply.userVote || null);

    const authorBadges = reply.author?.badges || [];
    const isAdmin = reply.author?.isAdmin || authorBadges.some(b => b.id === 'admin');
    
    const authorUserId = reply.author?.userId;
    const isDonor = reply.author?.isDonor || 
                    authorBadges.some(b => b.id === 'donation') ||
                    (authorUserId && this.donorStatusCache[String(authorUserId)]);
    const isBanned = reply.author?.isBanned || false;
    
    let badgesHtml = '';
    if (isDonor) {
      badgesHtml += `<a href="#catalog-item?id=86478952287791" class="author-badge donor-badge" title="Supporter - owns Rovloo's Calling"><img src="images/rovloo/donate128.png" alt="Supporter"></a>`;
    }
    if (isAdmin) {
      badgesHtml += `<span class="author-badge admin-badge" title="Administrator"><img src="images/rovloo/admin64.png" alt="Admin"></span>`;
    }
    if (isBanned) {
      badgesHtml += `<span class="author-badge banned-badge" title="Banned User">🚫</span>`;
    }

    return `
      <div class="reply-item ${isOwnReply ? 'own-reply' : ''}" data-reply-id="${reply.id}">
        <div class="reply-header">
          <a href="#profile?id=${reply.author?.userId || reply.author?.id}" class="author-link">
            <img src="${this.getAvatarUrl(reply.author?.avatarUrl, reply.author?.userId || reply.author?.id)}" alt="Avatar" class="reply-avatar" onerror="this.src='images/spinners/spinner100x100.gif'">
          </a>
          <div class="reply-author-info">
            <a href="#profile?id=${reply.author?.userId || reply.author?.id}" class="reply-author-name">
              ${this.escapeHtml(reply.author?.displayName || reply.author?.username || 'Unknown')}
            </a>
            ${badgesHtml}
            <span class="reply-date">${timestamp}</span>
            ${editedTimestamp ? `<span class="reply-edited">(edited)</span>` : ''}
          </div>
        </div>
        <div class="reply-text">${this.formatMarkdown(reply.text || '')}</div>
        <div class="reply-footer">
          <div class="reply-vote-buttons">
            <button class="vote-btn upvote ${userVote === 'upvote' ? 'voted' : ''} ${isOwnReply ? 'own-review-disabled' : ''}" 
                    onclick="ReviewComponent.handleReplyVote('${reply.id}', '${reviewId}', 'upvote')"
                    ${!this.currentUserId ? 'disabled' : (isOwnReply ? 'disabled title="You cannot vote on your own reply"' : '')}>
              <img src="images/rovloo/btn-thumbsup.png" alt="Upvote">
              <span>${upvotes}</span>
            </button>
            <button class="vote-btn downvote ${userVote === 'downvote' ? 'voted' : ''} ${isOwnReply ? 'own-review-disabled' : ''}" 
                    onclick="ReviewComponent.handleReplyVote('${reply.id}', '${reviewId}', 'downvote')"
                    ${!this.currentUserId ? 'disabled' : (isOwnReply ? 'disabled title="You cannot vote on your own reply"' : '')}>
              <img src="images/rovloo/btn-thumbsdown.png" alt="Downvote">
              <span>${downvotes}</span>
            </button>
            <span class="vote-score ${scoreClass}">${voteScore > 0 ? '+' : ''}${voteScore}</span>
          </div>
          ${isOwnReply ? `
            <div class="reply-actions">
              <button class="reply-edit-btn" onclick="ReviewComponent.showEditReplyForm('${reply.id}', '${reviewId}')">Edit</button>
              <button class="reply-delete-btn" onclick="ReviewComponent.deleteReply('${reply.id}', '${reviewId}')">Delete</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  },

  async submitReply(reviewId) {
    if (!this.rovlooAuthenticated) {
      alert('Please login to Rovloo first');
      return;
    }

    const queryScope = this.container || document;
    const form = queryScope.querySelector(`.reply-form[data-review-id="${reviewId}"]`);
    const editable = form?.querySelector('.reply-editable');
    const submitBtn = form?.querySelector('.reply-submit-btn');
    
    if (!editable) {
      console.error('[ReviewComponent] Reply editable not found for review:', reviewId);
      return;
    }

    const text = this.getEditableText(editable).trim();
    if (text.length < 2) {
      alert('Reply must be at least 2 characters.');
      return;
    }
    if (text.length > 500) {
      alert('Reply must be 500 characters or less.');
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Posting...';
    }

    try {
      
      const gameId = this.getReviewGameId(reviewId);
      console.log('[ReviewComponent] Creating reply for review:', reviewId, 'gameId:', gameId, 'text length:', text.length);
      await window.roblox.reviews.createReply(reviewId, text, gameId);
      console.log('[ReviewComponent] Reply created successfully');
      editable.innerHTML = '<br>';

      await this.loadReplies(reviewId);
    } catch (error) {
      console.error('[ReviewComponent] Failed to post reply:', error);
      alert('Failed to post reply: ' + (error.message || 'Unknown error'));
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post Reply';
      }
    }
  },

  showEditReplyForm(replyId, reviewId) {
    const replyItem = document.querySelector(`.reply-item[data-reply-id="${replyId}"]`);
    if (!replyItem) return;

    const textDiv = replyItem.querySelector('.reply-text');
    const currentText = textDiv?.textContent || '';

    textDiv.innerHTML = `
      <textarea class="reply-edit-textarea" maxlength="500" rows="2">${this.escapeHtml(currentText)}</textarea>
      <div class="reply-edit-actions">
        <button class="Button" onclick="ReviewComponent.saveReplyEdit('${replyId}', '${reviewId}')">Save</button>
        <button class="Button cancel-btn" onclick="ReviewComponent.loadReplies('${reviewId}')">Cancel</button>
      </div>
    `;
  },

  async saveReplyEdit(replyId, reviewId) {
    const replyItem = document.querySelector(`.reply-item[data-reply-id="${replyId}"]`);
    const textarea = replyItem?.querySelector('.reply-edit-textarea');
    
    if (!textarea) return;

    const text = textarea.value.trim();
    if (text.length < 2) {
      alert('Reply must be at least 2 characters.');
      return;
    }

    try {
      await window.roblox.reviews.updateReply(replyId, text);
      await this.loadReplies(reviewId);
    } catch (error) {
      console.error('Failed to update reply:', error);
      alert('Failed to update reply: ' + (error.message || 'Unknown error'));
    }
  },

  async deleteReply(replyId, reviewId) {
    if (!confirm('Are you sure you want to delete this reply?')) return;

    try {
      await window.roblox.reviews.deleteReply(replyId);
      await this.loadReplies(reviewId);
    } catch (error) {
      console.error('Failed to delete reply:', error);
      alert('Failed to delete reply: ' + (error.message || 'Unknown error'));
    }
  },

  async handleReplyVote(replyId, reviewId, voteType) {
    if (!this.currentUserId) return;

    if (!this.rovlooAuthenticated) {
      const shouldLogin = confirm('You need to login to Rovloo to vote. Login now?');
      if (shouldLogin) {
        await this.handleRovlooLogin();
      }
      return;
    }

    const replyIdStr = String(replyId);
    const currentVote = this.userReplyVoteCache[replyIdStr];

    try {
      
      if (currentVote === voteType) {
        
        await window.roblox.reviews.voteReply(replyId, voteType);
        this.userReplyVoteCache[replyIdStr] = null;
      } else {
        await window.roblox.reviews.voteReply(replyId, voteType);
        this.userReplyVoteCache[replyIdStr] = voteType;
      }
      
      await this.loadReplies(reviewId);
    } catch (error) {
      console.error('Failed to vote on reply:', error);
    }
  },

  destroy() {
    console.log('[ReviewComponent] destroy called');

    this._requestId++;

    this.removeEventListeners();

    if (window.PlaytimeTracker) {
      window.PlaytimeTracker.clearCache();
    }

    this.placeId = null;
    this.universeId = null;
    this.containerId = null;
    this.container = null;
    this.reviews = [];
    this.userReview = null;
    this.gameStats = null;
    this.currentPage = 1;
    this.cachedPlaytimeData = null;
    this.replySummary = {};
    this.expandedReplies = new Set();
    this.isLoading = false;
    this.isSubmitting = false;
    this._pendingReload = false;
    this.allReviewsCache = null;
    this.clientSideSort = false;
    this.myReviewsMode = false;
    this.myReviewsUserId = null;
    this.avatarCache = new Map();  
    this._clickHandler = null;
  }
};

window.ReviewComponent = ReviewComponent;
