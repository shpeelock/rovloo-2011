

let groupsInitialized = false;
let currentSearchCursor = '';
let currentSearchKeyword = '';
let searchCursorHistory = []; 
let currentSearchPage = 1;
let currentGroupId = null;
let currentRoleId = null;
let membersCursor = '';
let membersCursorHistory = []; 
let currentMembersPage = 1;
let wallCursor = '';
let wallCursorHistory = []; 
let currentWallPage = 1;
let wallPostsCache = []; 
let wallHasMore = true; 
let currentUserId = null;

const WALL_POSTS_PER_PAGE = 8;

document.addEventListener('pageChange', async (e) => {
  if (e.detail.page === 'groups') {
    await initGroupsPage(e.detail.params);
  }
});

async function initGroupsPage(params = {}) {
  
  if (!groupsInitialized) {
    setupGroupsEventListeners();
    groupsInitialized = true;
  }

  if (params.groupId) {
    await loadGroupDetail(params.groupId);
    return;
  }

  document.getElementById('groups-search-view').style.display = 'block';
  document.getElementById('group-detail-view').style.display = 'none';
  document.getElementById('group-search-controls').style.display = 'none';

  await loadMyGroups();
}

function setupGroupsEventListeners() {
  
  document.getElementById('groups-search-btn')?.addEventListener('click', () => {
    const keyword = document.getElementById('groups-search-input').value.trim();
    if (keyword) {
      currentSearchKeyword = keyword;
      currentSearchCursor = '';
      searchCursorHistory = [];
      currentSearchPage = 1;
      searchGroups(keyword);
    }
  });

  document.getElementById('groups-search-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const keyword = e.target.value.trim();
      if (keyword) {
        currentSearchKeyword = keyword;
        currentSearchCursor = '';
        searchCursorHistory = [];
        currentSearchPage = 1;
        searchGroups(keyword);
      }
    }
  });

  document.getElementById('groups-prev-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentSearchPage > 1) {
      currentSearchPage--;
      
      const prevCursor = currentSearchPage === 1 ? '' : searchCursorHistory[currentSearchPage - 2] || '';
      searchGroups(currentSearchKeyword, prevCursor, true);
    }
  });

  document.getElementById('groups-next-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentSearchCursor) {
      
      searchCursorHistory[currentSearchPage - 1] = currentSearchCursor;
      currentSearchPage++;
      searchGroups(currentSearchKeyword, currentSearchCursor);
    }
  });

  document.getElementById('group-back-btn')?.addEventListener('click', () => {
    document.getElementById('groups-search-view').style.display = 'block';
    document.getElementById('group-detail-view').style.display = 'none';
    document.getElementById('group-search-controls').style.display = 'none';
    currentGroupId = null;
  });

  document.getElementById('group-join-btn')?.addEventListener('click', async () => {
    if (currentGroupId) {
      await joinGroup(currentGroupId);
    }
  });

  document.getElementById('group-leave-btn')?.addEventListener('click', async () => {
    if (currentGroupId) {
      await leaveGroup(currentGroupId);
    }
  });

  document.getElementById('members-prev-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentMembersPage > 1 && currentGroupId) {
      currentMembersPage = 1;
      membersCursorHistory = [];
      loadGroupMembers(currentGroupId, currentRoleId, '');
    }
  });

  document.getElementById('members-prev-page-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentMembersPage > 1 && currentGroupId) {
      currentMembersPage--;
      const prevCursor = currentMembersPage === 1 ? '' : membersCursorHistory[currentMembersPage - 2] || '';
      loadGroupMembers(currentGroupId, currentRoleId, prevCursor);
    }
  });

  document.getElementById('members-next-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (membersCursor && currentGroupId) {
      membersCursorHistory[currentMembersPage - 1] = membersCursor;
      currentMembersPage++;
      loadGroupMembers(currentGroupId, currentRoleId, membersCursor);
    }
  });

  document.getElementById('wall-next-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentGroupId) {
      currentWallPage++;
      displayWallPage();
    }
  });
  
  document.getElementById('wall-prev-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentWallPage > 1 && currentGroupId) {
      currentWallPage--;
      displayWallPage();
    }
  });
}

async function loadMyGroups() {
  const container = document.getElementById('my-groups-list');
  if (!container) return;
  
  try {
    const isLoggedIn = await window.RobloxClient.auth.isLoggedIn();
    if (!isLoggedIn) {
      container.innerHTML = '<div style="color: #666; padding: 10px;">Login to see your groups</div>';
      return;
    }
    
    const currentUser = await window.RobloxClient.api.getCurrentUser();
    if (!currentUser) {
      container.innerHTML = '<div style="color: #666; padding: 10px;">Could not load user info</div>';
      return;
    }
    
    const groups = await window.roblox.getUserGroups(currentUser.id);
    
    if (!groups?.data || groups.data.length === 0) {
      container.innerHTML = '<div style="color: #666; padding: 10px;">You are not in any groups</div>';
      return;
    }

    const groupIds = groups.data.map(g => g.group.id);
    let thumbnails = {};
    try {
      const thumbResult = await window.roblox.getGroupThumbnails(groupIds, '150x150');
      if (thumbResult?.data) {
        thumbResult.data.forEach(t => {
          thumbnails[t.targetId] = t.imageUrl;
        });
      }
    } catch (e) {
      console.warn('Failed to load group thumbnails:', e);
    }
    
    container.innerHTML = groups.data.map(item => {
      const group = item.group;
      const thumb = thumbnails[group.id] || 'images/spinners/spinner100x100.gif';
      return `
        <div class="my-group-item">
          <img src="${thumb}" alt="${group.name}" class="my-group-icon" 
               onclick="loadGroupDetail(${group.id})" style="cursor: pointer;">
          <a href="#" class="my-group-name" onclick="loadGroupDetail(${group.id}); return false;">${group.name}</a>
        </div>
      `;
    }).join('');
    
  } catch (error) {
    console.error('Failed to load my groups:', error);
    if (window.showErrorPage) {
      window.showErrorPage('Failed to load groups: ' + error.message, 'groups-content');
    } else {
      container.innerHTML = '<div style="color: #cc0000; padding: 10px;">Failed to load groups</div>';
    }
  }
}

async function searchGroups(keyword, cursor = '', isGoingBack = false) {
  const tbody = document.getElementById('groups-results-body');
  const pagination = document.getElementById('groups-search-pagination');
  
  if (!tbody) return;
  
  tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px;">Searching...</td></tr>';
  
  try {
    
    const searchCursor = (isGoingBack && searchCursorHistory.length === 0) ? '' : cursor;
    const results = await window.roblox.searchGroups(keyword, 10, searchCursor);
    
    if (!results?.data || results.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #666;">No groups found</td></tr>';
      pagination.style.display = 'none';
      return;
    }

    const groupIds = results.data.map(g => g.id);
    let thumbnails = {};
    try {
      const thumbResult = await window.roblox.getGroupThumbnails(groupIds, '150x150');
      if (thumbResult?.data) {
        thumbResult.data.forEach(t => {
          thumbnails[t.targetId] = t.imageUrl;
        });
      }
    } catch (e) {
      console.warn('Failed to load group thumbnails:', e);
    }
    
    tbody.innerHTML = results.data.map(group => {
      const thumb = thumbnails[group.id] || 'images/spinners/spinner100x100.gif';
      const description = group.description ? 
        (group.description.length > 100 ? group.description.substring(0, 100) + '...' : group.description) : 
        'No description';
      return `
        <tr>
          <td class="group-icon-cell">
            <img src="${thumb}" alt="${group.name}" onclick="loadGroupDetail(${group.id})" style="cursor: pointer;">
          </td>
          <td>
            <a href="#" class="group-name-link" onclick="loadGroupDetail(${group.id}); return false;">${group.name}</a>
          </td>
          <td style="font-size: 11px; color: #666;">${description}</td>
          <td style="text-align: center;">${group.memberCount?.toLocaleString() || 0}</td>
          <td style="text-align: center;">${group.publicEntryAllowed ? 'Yes' : 'No'}</td>
        </tr>
      `;
    }).join('');

    currentSearchCursor = results.nextPageCursor || '';

    document.getElementById('groups-page-info').textContent = `Page ${currentSearchPage}`;

    const prevBtn = document.getElementById('groups-prev-btn');
    if (currentSearchPage > 1) {
      prevBtn.classList.remove('disabled');
    } else {
      prevBtn.classList.add('disabled');
    }

    const nextBtn = document.getElementById('groups-next-btn');
    if (currentSearchCursor) {
      nextBtn.classList.remove('disabled');
    } else {
      nextBtn.classList.add('disabled');
    }
    
    pagination.style.display = 'block';
    
  } catch (error) {
    console.error('Failed to search groups:', error);
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #cc0000;">Search failed</td></tr>';
  }
}

async function loadGroupDetail(groupId) {
  currentGroupId = groupId;

  document.getElementById('groups-search-view').style.display = 'none';
  document.getElementById('group-detail-view').style.display = 'block';
  document.getElementById('group-search-controls').style.display = 'block';

  membersCursor = '';
  membersCursorHistory = [];
  currentMembersPage = 1;
  wallCursor = '';
  currentRoleId = null;

  const wallSection = document.getElementById('group-wall-section');
  if (wallSection) {
    wallSection.style.display = '';
  }
  
  try {
    
    const group = await window.roblox.getGroup(groupId);
    
    if (!group) {
      document.getElementById('group-detail-name').textContent = 'Group not found';
      return;
    }

    document.getElementById('group-detail-name').textContent = group.name;
    document.getElementById('group-detail-description').innerHTML = window.formatDescription ? window.formatDescription(group.description) : escapeHtml(group.description || 'No description');

    const emblemLink = document.getElementById('group-emblem-link');
    if (emblemLink) {
      emblemLink.title = group.name;
    }

    try {
      const thumbResult = await window.roblox.getGroupThumbnails([groupId], '150x150');
      if (thumbResult?.data?.[0]?.imageUrl) {
        document.getElementById('group-detail-emblem').src = thumbResult.data[0].imageUrl;
        document.getElementById('group-detail-emblem').alt = group.name;
      }
    } catch (e) {
      console.warn('Failed to load group emblem:', e);
    }

    if (group.owner) {
      const ownerLink = document.getElementById('group-owner-link');
      ownerLink.textContent = group.owner.username || group.owner.displayName;
      ownerLink.href = '#';
      ownerLink.onclick = () => {
        
        const ownerId = group.owner.userId || group.owner.id;
        navigateTo('profile', { userId: ownerId });
        return false;
      };
    } else {
      document.getElementById('group-owner-link').textContent = 'No owner';
    }

    const statusBox = document.getElementById('group-status-box');
    
    if (group.shout && group.shout.body) {
      document.getElementById('group-status-text').textContent = group.shout.body;
      
      const posterLink = document.getElementById('group-status-poster');
      if (group.shout.poster) {
        posterLink.textContent = group.shout.poster.username;
        posterLink.href = '#';
        posterLink.onclick = () => {
          navigateTo('profile', { userId: group.shout.poster.userId });
          return false;
        };
      }
      
      const statusDate = document.getElementById('group-status-date');
      if (group.shout.updated) {
        const date = new Date(group.shout.updated);
        statusDate.textContent = date.toLocaleDateString('en-US', {
          month: 'numeric', day: 'numeric', year: 'numeric',
          hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
        });
      }
      
      statusBox.style.display = 'block';
    } else {
      statusBox.style.display = 'none';
    }

    await loadGroupRoles(groupId);

    await loadGroupWall(groupId);

    await updateGroupMembershipUI(groupId);

  } catch (error) {
    console.error('Failed to load group detail:', error);
    document.getElementById('group-detail-name').textContent = 'Failed to load group';
  }
}

function showGroupsSearch() {
  document.getElementById('groups-search-view').style.display = 'block';
  document.getElementById('group-detail-view').style.display = 'none';
  document.getElementById('group-search-controls').style.display = 'none';
  currentGroupId = null;
}

window.showGroupsSearch = showGroupsSearch;

async function loadGroupRoles(groupId) {
  const tabsContainer = document.getElementById('group-role-tabs');
  if (!tabsContainer) return;
  
  try {
    const roles = await window.roblox.getGroupRoles(groupId);
    
    if (!roles?.roles || roles.roles.length === 0) {
      tabsContainer.innerHTML = '';
      await loadGroupMembers(groupId);
      return;
    }

    const sortedRoles = roles.roles.sort((a, b) => b.rank - a.rank);

    tabsContainer.innerHTML = sortedRoles.map((role, index) => `
      <input type="button" 
             value="${role.name}" 
             title="${role.name}"
             class="${index === 0 ? 'SelectedRoleSetButton' : 'RoleSetButton'}"
             data-role-id="${role.id}"
             data-role-rank="${role.rank}"
             data-role-count="${role.memberCount || 0}"
             onclick="selectRole(${groupId}, ${role.id}, this)">
    `).join('');

    if (sortedRoles.length > 0) {
      currentRoleId = sortedRoles[0].id;
      
      document.getElementById('group-role-name').textContent = sortedRoles[0].name;
      document.getElementById('group-role-count').textContent = sortedRoles[0].memberCount || 0;
      document.getElementById('group-role-rank').textContent = sortedRoles[0].rank;
      await loadGroupMembers(groupId, sortedRoles[0].id);
    }
    
  } catch (error) {
    console.error('Failed to load group roles:', error);
    tabsContainer.innerHTML = '';
    await loadGroupMembers(groupId);
  }
}

async function selectRole(groupId, roleId, element) {
  
  document.querySelectorAll('#group-role-tabs input').forEach(btn => {
    btn.className = 'RoleSetButton';
  });
  element.className = 'SelectedRoleSetButton';

  document.getElementById('group-role-name').textContent = element.value;
  document.getElementById('group-role-count').textContent = element.dataset.roleCount || 0;
  document.getElementById('group-role-rank').textContent = element.dataset.roleRank || 1;
  
  currentRoleId = roleId;
  membersCursor = '';
  membersCursorHistory = [];
  currentMembersPage = 1;
  await loadGroupMembers(groupId, roleId);
}

window.selectRole = selectRole;

async function loadGroupMembers(groupId, roleId = null, cursor = '') {
  const container = document.getElementById('group-members-grid');
  const pagination = document.getElementById('group-members-pagination');
  
  if (!container) return;
  
  if (!cursor) {
    container.innerHTML = '<div style="color: #666; text-align: center;">Loading members...</div>';
  }
  
  try {
    let members;
    let useRoleEndpoint = false;

    if (roleId) {
      try {
        
        members = await window.roblox.getGroupRoleMembers(groupId, roleId, 10, cursor, 'Desc');
        useRoleEndpoint = true;
      } catch (e) {
        console.warn('Role members endpoint failed, falling back to general members:', e);
        
        members = await window.roblox.getGroupMembers(groupId, 10, cursor, 'Desc');
      }
    } else {
      members = await window.roblox.getGroupMembers(groupId, 10, cursor, 'Desc');
    }
    
    if (!members?.data || members.data.length === 0) {
      container.innerHTML = '<div style="color: #666; text-align: center;">No members found</div>';
      pagination.style.display = 'none';
      return;
    }

    let filteredMembers = members.data;
    if (roleId && !useRoleEndpoint) {
      filteredMembers = members.data.filter(m => m.role?.id === roleId);
      if (filteredMembers.length === 0) {
        container.innerHTML = '<div style="color: #666; text-align: center;">No members in this role</div>';
        pagination.style.display = 'none';
        return;
      }
    }

    filteredMembers = filteredMembers.filter(m => {
      const userId = m.userId || m.user?.userId;
      const username = m.username || m.user?.username;
      return userId && username;
    });
    
    if (filteredMembers.length === 0) {
      container.innerHTML = '<div style="color: #666; text-align: center;">No valid members found</div>';
      pagination.style.display = 'none';
      return;
    }

    const displayMembers = filteredMembers.slice(0, 9);

    const userIds = displayMembers.map(m => m.userId || m.user?.userId).filter(id => id);
    let avatars = {};
    try {
      const avatarResult = await window.roblox.getUserThumbnails(userIds, '48x48', 'Headshot');
      if (avatarResult?.data) {
        avatarResult.data.forEach(a => {
          avatars[a.targetId] = a.imageUrl;
        });
      }
    } catch (e) {
      console.warn('Failed to load member avatars:', e);
    }

    let html = '';
    for (let i = 0; i < displayMembers.length; i += 3) {
      html += '<div style="height: 70px; margin-bottom: 5px; overflow: hidden;">';
      for (let j = 0; j < 3 && (i + j) < displayMembers.length; j++) {
        const member = displayMembers[i + j];
        
        const userId = member.userId || member.user?.userId;
        const username = member.username || member.user?.username || 'Unknown';

        if (!userId) continue;
        
        const avatar = avatars[userId] || '';
        
        const placeholderAvatar = 'images/spinners/spinner100x100.gif';
        
        const floatStyle = j === 1 ? 'float: right' : 'float: left';
        const widthStyle = j === 1 ? 'width: 33%' : 'width: 33%';
        html += `
          <div class="GroupMember" style="${floatStyle}; text-align: center; ${widthStyle}">
            <div class="Avatar">
              <a href="#" title="${username}" onclick="navigateTo('profile', { userId: ${userId} }); return false;" style="display:inline-block;height:48px;width:48px;cursor:pointer;">
                <img src="${avatar || placeholderAvatar}" alt="${username}" border="0" style="width:48px;height:48px;" onerror="this.src='${placeholderAvatar}'; this.onerror=null;">
              </a>
            </div>
            <div class="Summary">
              <span class="Name">
                <a href="#" title="${username}" onclick="navigateTo('profile', { userId: ${userId} }); return false;">${username}</a>
              </span>
            </div>
          </div>
        `;
      }
      html += '</div>';
    }
    
    container.innerHTML = html;

    membersCursor = members.nextPageCursor || '';

    document.getElementById('members-page-info').textContent = currentMembersPage;

    const firstBtn = document.getElementById('members-prev-btn');
    const prevBtn = document.getElementById('members-prev-page-btn');
    if (currentMembersPage > 1) {
      firstBtn?.removeAttribute('disabled');
      prevBtn?.removeAttribute('disabled');
    } else {
      firstBtn?.setAttribute('disabled', 'disabled');
      prevBtn?.setAttribute('disabled', 'disabled');
    }

    if (membersCursor) {
      pagination.style.display = 'block';
      document.getElementById('members-next-btn').removeAttribute('disabled');
    } else {
      document.getElementById('members-next-btn').setAttribute('disabled', 'disabled');
    }
    
    pagination.style.display = 'block';
    
  } catch (error) {
    console.error('Failed to load group members:', error);
    container.innerHTML = '<div style="color: #cc0000; text-align: center;">Failed to load members</div>';
  }
}

async function loadGroupWall(groupId) {
  const container = document.getElementById('group-wall-container');
  
  if (!container) return;

  wallPostsCache = [];
  wallCursor = '';
  wallHasMore = true;
  currentWallPage = 1;
  
  container.innerHTML = '<tr><td colspan="2" style="text-align: center; padding: 20px; color: #666;">Loading wall posts...</td></tr>';
  
  try {
    
    await fetchMoreWallPosts(groupId);

    displayWallPage();
    
  } catch (error) {
    console.error('Failed to load group wall:', error);
    
    const isPermissionError = error?.message?.includes('permission') || 
                              error?.message?.includes('Permission') ||
                              error?.message?.includes('403');
    
    const wallSection = document.getElementById('group-wall-section');
    if (isPermissionError && wallSection) {
      
      wallSection.style.display = 'none';
    } else {
      container.innerHTML = '<tr><td colspan="2" style="text-align: center; padding: 20px; color: #cc0000;">Failed to load wall</td></tr>';
    }
  }
}

async function fetchMoreWallPosts(groupId) {
  if (!wallHasMore) return;
  
  const wall = await window.roblox.getGroupWall(groupId, 25, wallCursor, 'Desc');
  
  if (wall?.data && wall.data.length > 0) {
    
    const userIds = wall.data
      .filter(p => p.poster?.user?.userId)
      .map(p => p.poster.user.userId);
    
    let avatars = {};
    if (userIds.length > 0) {
      try {
        const avatarResult = await window.roblox.getUserThumbnails(userIds, '48x48', 'Headshot');
        if (avatarResult?.data) {
          avatarResult.data.forEach(a => {
            avatars[a.targetId] = a.imageUrl;
          });
        }
      } catch (e) {
        console.warn('Failed to load wall avatars:', e);
      }
    }

    wall.data.forEach(post => {
      if (post.poster?.user?.userId) {
        post._avatarUrl = avatars[post.poster.user.userId] || 'images/spinners/spinner100x100.gif';
      }
    });
    
    wallPostsCache = wallPostsCache.concat(wall.data);
  }
  
  wallCursor = wall?.nextPageCursor || '';
  wallHasMore = !!wallCursor;
}

async function displayWallPage() {
  const container = document.getElementById('group-wall-container');
  const pagination = document.getElementById('group-wall-pagination');
  const prevBtn = document.getElementById('wall-prev-btn');
  const nextBtn = document.getElementById('wall-next-btn');
  const pageInfo = document.getElementById('wall-page-info');
  
  if (!container) return;
  
  const startIndex = (currentWallPage - 1) * WALL_POSTS_PER_PAGE;
  const endIndex = startIndex + WALL_POSTS_PER_PAGE;

  if (endIndex > wallPostsCache.length && wallHasMore) {
    container.innerHTML = '<tr><td colspan="2" style="text-align: center; padding: 20px; color: #666;">Loading more posts...</td></tr>';
    await fetchMoreWallPosts(currentGroupId);
  }
  
  const postsToShow = wallPostsCache.slice(startIndex, endIndex);
  
  if (postsToShow.length === 0) {
    container.innerHTML = '<tr><td colspan="2" style="text-align: center; padding: 20px; color: #666;">No wall posts</td></tr>';
    if (pagination) pagination.style.display = 'none';
    return;
  }

  const html = postsToShow.map((post, index) => {
    if (!post.poster?.user) return '';
    
    const userId = post.poster.user.userId;
    const username = post.poster.user.username || post.poster.user.displayName || 'Unknown';
    const avatar = post._avatarUrl || 'images/spinners/spinner100x100.gif';
    const date = new Date(post.created).toLocaleDateString('en-US', {
      month: 'numeric', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
    });
    const rowClass = index % 2 === 0 ? 'AlternatingItemTemplateOdd' : 'AlternatingItemTemplateEven';
    
    const fullText = escapeHtml(post.body);
    const needsTruncate = post.body.length > 35;
    const truncatedText = needsTruncate ? escapeHtml(post.body.substring(0, 35)) + '...' : fullText;
    const postId = `wall-post-${post.id}`;
    
    const showMoreLink = needsTruncate ? 
      `<a href="javascript:void(0)" id="${postId}-link" class="show-more-link" onclick="toggleWallPost('${postId}')" style="color:#00f;font-size:10px;font-weight:normal;font-style:normal;">Show More</a>` : '';
    
    return `
      <tr class="${rowClass}">
        <td class="RepeaterImage" style="width: 55px; vertical-align: top; padding: 5px;">
          <a href="#" title="${username}" onclick="navigateTo('profile', { userId: ${userId} }); return false;" style="display:inline-block;height:48px;width:48px;cursor:pointer;"><img src="${avatar}" border="0" alt="${username}" style="width:48px;height:48px;"></a><br>
          <a href="#" onclick="navigateTo('profile', { userId: ${userId} }); return false;" style="color:#00f;text-decoration:none;font-size:11px;">${username}</a>
        </td>
        <td class="RepeaterText" style="vertical-align: top; padding: 5px;">
          <b><i><span id="${postId}-short">${truncatedText}</span><span id="${postId}-full" style="display:none;">${fullText}</span></i></b> ${showMoreLink}<br><br>
          <span style="color: Gray; font-size: 8px;">${date}</span>
        </td>
      </tr>
    `;
  }).filter(h => h).join('');
  
  container.innerHTML = html || '<tr><td colspan="2" style="text-align: center; padding: 20px; color: #666;">No wall posts</td></tr>';

  const hasNextPage = endIndex < wallPostsCache.length || wallHasMore;
  const hasPrevPage = currentWallPage > 1;
  
  if (pagination) {
    if (pageInfo) {
      pageInfo.textContent = `Page ${currentWallPage}`;
    }
    
    if (prevBtn) {
      prevBtn.style.display = hasPrevPage ? 'inline' : 'none';
    }
    
    if (nextBtn) {
      nextBtn.style.display = hasNextPage ? 'inline' : 'none';
    }

    pagination.style.display = (hasPrevPage || hasNextPage) ? 'block' : 'none';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function toggleWallPost(postId) {
  const shortEl = document.getElementById(`${postId}-short`);
  const fullEl = document.getElementById(`${postId}-full`);
  const link = document.getElementById(`${postId}-link`);
  
  if (fullEl.style.display === 'none') {
    shortEl.style.display = 'none';
    fullEl.style.display = 'inline';
    if (link) link.textContent = 'Show Less';
  } else {
    shortEl.style.display = 'inline';
    fullEl.style.display = 'none';
    if (link) link.textContent = 'Show More';
  }
}

window.toggleWallPost = toggleWallPost;

window.loadGroupDetail = loadGroupDetail;

window.searchGroups = searchGroups;

let pendingGroupChallenge = null;

async function updateGroupMembershipUI(groupId) {
  const joinBtn = document.getElementById('group-join-btn');
  const leaveBtn = document.getElementById('group-leave-btn');
  const container = document.getElementById('group-join-container');

  if (!joinBtn || !leaveBtn || !container) return;

  try {
    
    const isLoggedIn = await window.RobloxClient.auth.isLoggedIn();
    if (!isLoggedIn) {
      container.style.display = 'none';
      return;
    }

    const currentUser = await window.RobloxClient.api.getCurrentUser();
    if (!currentUser) {
      container.style.display = 'none';
      return;
    }

    currentUserId = currentUser.id;

    const isMember = await window.roblox.isUserInGroup(currentUserId, groupId);

    if (isMember) {
      joinBtn.style.display = 'none';
      leaveBtn.style.display = 'inline-block';
    } else {
      joinBtn.style.display = 'inline-block';
      leaveBtn.style.display = 'none';
    }

    container.style.display = 'block';

  } catch (error) {
    console.error('Failed to check group membership:', error);
    container.style.display = 'none';
  }
}

async function joinGroup(groupId) {
  const joinBtn = document.getElementById('group-join-btn');
  if (!joinBtn) return;

  const originalText = joinBtn.textContent;
  joinBtn.disabled = true;
  joinBtn.textContent = 'Joining...';

  try {
    
    if (window.roblox?.bat) {
      const initResult = await window.roblox.bat.initialize();
      if (initResult?.success && initResult?.hasKeys) {
        console.log('Using BAT client to join group from Roblox context');
        const url = `https://groups.roblox.com/v1/groups/${groupId}/users`;
        const body = { sessionId: '', redemptionToken: '' };
        
        const result = await window.roblox.bat.makeRequest(url, 'POST', body, null);
        console.log('BAT request result:', result);
        
        if (result?.success) {
          await updateGroupMembershipUI(groupId);
          await loadMyGroups();
          return;
        } else if (result?.challengeId) {
          
          console.log('Challenge required:', result.challengeType);
          await handleGroupChallenge({
            requiresChallenge: true,
            challengeId: result.challengeId,
            challengeType: result.challengeType,
            challengeMetadata: result.challengeMetadata
          }, groupId, 'join');
          return;
        } else {
          console.log('BAT request failed:', result?.error || result?.data);
          
        }
      }
    }

    const result = await window.roblox.joinGroup(groupId);

    if (result?.requiresChallenge) {
      await handleGroupChallenge(result, groupId, 'join');
      return;
    }

    if (result?.success || result?.groupId) {
      await updateGroupMembershipUI(groupId);
      await loadMyGroups(); 
    } else {
      throw new Error(result?.message || 'Failed to join group');
    }

  } catch (error) {
    console.error('Failed to join group:', error);
    alert('Failed to join group: ' + (error.message || 'Unknown error'));
    joinBtn.disabled = false;
    joinBtn.textContent = originalText;
  }
}

async function leaveGroup(groupId) {
  const leaveBtn = document.getElementById('group-leave-btn');
  if (!leaveBtn || !currentUserId) return;

  if (!confirm('Are you sure you want to leave this group?')) {
    return;
  }

  const originalText = leaveBtn.textContent;
  leaveBtn.disabled = true;
  leaveBtn.textContent = 'Leaving...';

  try {
    
    if (window.roblox?.bat) {
      const initResult = await window.roblox.bat.initialize();
      if (initResult?.success && initResult?.hasKeys) {
        console.log('Using BAT client to leave group from Roblox context');
        const url = `https://groups.roblox.com/v1/groups/${groupId}/users/${currentUserId}`;
        
        const result = await window.roblox.bat.makeRequest(url, 'DELETE', null, null);
        console.log('BAT request result:', result);
        
        if (result?.success) {
          await updateGroupMembershipUI(groupId);
          await loadMyGroups();
          return;
        } else if (result?.challengeId) {
          
          console.log('Challenge required:', result.challengeType);
          await handleGroupChallenge({
            requiresChallenge: true,
            challengeId: result.challengeId,
            challengeType: result.challengeType,
            challengeMetadata: result.challengeMetadata
          }, groupId, 'leave');
          return;
        } else {
          console.log('BAT request failed:', result?.error || result?.data);
          
        }
      }
    }

    const result = await window.roblox.leaveGroup(groupId, currentUserId);

    if (result?.requiresChallenge) {
      await handleGroupChallenge(result, groupId, 'leave');
      return;
    }

    if (result?.success || !result?.errors) {
      await updateGroupMembershipUI(groupId);
      await loadMyGroups(); 
    } else {
      throw new Error(result?.errors?.[0]?.message || 'Failed to leave group');
    }

  } catch (error) {
    console.error('Failed to leave group:', error);
    alert('Failed to leave group: ' + (error.message || 'Unknown error'));
    leaveBtn.disabled = false;
    leaveBtn.textContent = originalText;
  }
}

async function handleGroupChallenge(challengeResult, groupId, action) {
  console.log('Group action requires challenge:', challengeResult);

  pendingGroupChallenge = {
    challengeId: challengeResult.challengeId,
    challengeType: challengeResult.challengeType,
    groupId: groupId,
    action: action
  };

  const challengeType = challengeResult.challengeType;

  if (challengeType === 'twostepverification' || challengeType === 'forcetwostepverification') {
    await showGroupTwoStepVerification(challengeResult, action);
  } else if (challengeType === 'captcha' || challengeResult.challengeMetadata?.dataExchangeBlob) {
    
    await showGroupCaptchaChallenge(challengeResult, groupId, action);
  } else if (challengeType === 'proofofwork') {
    
    await handleProofOfWorkChallenge(challengeResult, groupId, action);
  } else if (challengeType === 'rostile') {
    
    console.log('Rostile puzzle challenge detected:', challengeResult.challengeMetadata);

    const showedRostile = await showRostileChallenge(challengeResult, groupId, action);
    if (!showedRostile) {
      
      const actionText = action === 'join' ? 'join' : 'leave';
      const confirmed = confirm(
        `This group requires puzzle verification (Rostile) which cannot be completed in the app.\n\n` +
        `Would you like to open the group page on Roblox.com to ${actionText} this group?`
      );
      
      if (confirmed) {
        const groupUrl = `https://www.roblox.com/communities/${groupId}`;
        if (window.roblox?.openExternal) {
          window.roblox.openExternal(groupUrl);
        } else {
          window.open(groupUrl, '_blank');
        }
      }
      
      resetGroupButtons();
    }
  } else {
    alert('This action requires verification. Please complete the action on the Roblox website.');
    resetGroupButtons();
  }
}

async function handleProofOfWorkChallenge(challengeResult, groupId, action) {
  console.log('Handling proof of work challenge...');

  try {
    
    const metadata = challengeResult.challengeMetadata;
    console.log('Proof of work metadata:', metadata);

    if (metadata.dataExchangeBlob) {
      console.log('Detected FunCaptcha requirement, showing captcha UI...');
      await showGroupCaptchaChallenge(challengeResult, groupId, action);
      return;
    }

    console.log('Calling continue endpoint for proof of work...');

    const continueMetadata = {
      challengeId: metadata.genericChallengeId || challengeResult.challengeId,
      actionType: 'Generic'
    };

    const continueResult = await window.roblox.continueProofOfWorkChallenge(
      challengeResult.challengeId,
      challengeResult.challengeType,
      continueMetadata
    );

    console.log('Continue result:', continueResult);

    console.log('Retrying group action after continue...');

    let result;
    if (action === 'join') {
      result = await window.roblox.joinGroup(groupId);
    } else {
      if (!currentUserId) {
        const currentUser = await window.RobloxClient.api.getCurrentUser();
        currentUserId = currentUser?.id;
      }
      result = await window.roblox.leaveGroup(groupId, currentUserId);
    }

    if (result?.requiresChallenge) {
      
      const newChallengeType = result.challengeType;
      if (newChallengeType === 'captcha' || result.challengeMetadata?.dataExchangeBlob) {
        console.log('Second attempt returned captcha challenge');
        await showGroupCaptchaChallenge(result, groupId, action);
        return;
      }

      alert('Verification failed. Please try again or complete the action on the Roblox website.');
      resetGroupButtons();
    } else if (result?.success || result?.groupId || !result?.errors) {
      await updateGroupMembershipUI(groupId);
      await loadMyGroups();
      pendingGroupChallenge = null;
    } else {
      throw new Error(result?.message || result?.errors?.[0]?.message || 'Action failed');
    }

  } catch (error) {
    console.error('Proof of work challenge handling failed:', error);
    alert('Failed to complete action: ' + (error.message || 'Unknown error'));
    resetGroupButtons();
  }
}

async function showRostileChallenge(challengeResult, groupId, action) {
  console.log('Rostile challenge detected - using in-app Roblox window');
  console.log('Metadata:', challengeResult.challengeMetadata);

  if (window.roblox?.bat?.performGroupAction) {
    try {
      const result = await window.roblox.bat.performGroupAction(groupId, action);
      
      if (result?.success) {
        await updateGroupMembershipUI(groupId);
        await loadMyGroups();
        pendingGroupChallenge = null;
      } else if (result?.cancelled) {
        console.log('User cancelled the action');
      } else if (result?.timeout) {
        alert('The action timed out. Please try again.');
      } else {
        alert('Failed to complete action: ' + (result?.error || 'Unknown error'));
      }
      
      resetGroupButtons();
      return true;
      
    } catch (error) {
      console.error('Failed to perform group action for Rostile:', error);
    }
  }
  
  return false; 
}

let currentCaptchaSession = null;

async function showGroupCaptchaChallenge(challengeResult, groupId, action) {
  console.log('Challenge required for group action, trying in-app captcha...');
  
  const actionText = action === 'join' ? 'join' : 'leave';
  const blob = challengeResult.challengeMetadata?.dataExchangeBlob;

  pendingGroupChallenge = {
    challengeId: challengeResult.challengeId,
    challengeType: challengeResult.challengeType,
    challengeMetadata: challengeResult.challengeMetadata,
    groupId: groupId,
    action: action
  };

  if (window.roblox?.funcaptcha && blob) {
    try {
      console.log('Starting in-app FunCaptcha...');
      
      const captchaResult = await window.roblox.funcaptcha.start({
        actionType: 'JoinGroup',
        blob: blob
      });
      
      console.log('FunCaptcha start result:', captchaResult);
      
      if (captchaResult?.success) {
        
        if (captchaResult.suppressed) {
          console.log('Captcha is suppressed, retrying action...');
          pendingGroupChallenge.captchaToken = captchaResult.token;
          await retryGroupActionAfterCaptcha();
          return;
        }

        currentCaptchaSession = {
          sessionId: captchaResult.sessionId,
          token: captchaResult.token,
          info: captchaResult.info,
          groupId: groupId,
          action: action
        };
        
        showCaptchaModal(captchaResult);
        return;
      } else {
        console.log('FunCaptcha start failed:', captchaResult?.error);
      }
    } catch (error) {
      console.error('In-app FunCaptcha error:', error);
    }
  }

  if (window.roblox?.bat?.performGroupAction) {
    try {
      console.log(`Falling back to Roblox window to ${actionText} group ${groupId}...`);
      
      const result = await window.roblox.bat.performGroupAction(groupId, action);
      
      console.log('Group action result:', result);
      
      if (result?.success) {
        await updateGroupMembershipUI(groupId);
        await loadMyGroups();
        pendingGroupChallenge = null;
      } else if (result?.cancelled) {
        console.log('User cancelled the action');
      } else if (result?.timeout) {
        alert('The action timed out. Please try again.');
      } else {
        alert('Failed to complete action: ' + (result?.error || 'Unknown error'));
      }
      
      resetGroupButtons();
      return;
      
    } catch (error) {
      console.error('Failed to perform group action:', error);
    }
  }

  alert(`This action requires verification that cannot be completed in the app.\n\nPlease ${actionText} the group on Roblox.com`);
  resetGroupButtons();
}

function showCaptchaModal(captchaResult) {
  const modal = document.getElementById('group-captcha-modal');
  const image = document.getElementById('captcha-image');
  const instruction = document.getElementById('captcha-instruction');
  const progress = document.getElementById('captcha-progress');
  const status = document.getElementById('captcha-status');
  const loading = document.getElementById('captcha-loading');
  const tiles = document.querySelectorAll('.captcha-tile');
  
  if (!modal) {
    console.error('Captcha modal not found');
    return;
  }

  instruction.textContent = captchaResult.info?.instruction || 'Pick the correct image';
  progress.textContent = `Wave ${(captchaResult.info?.currentWave || 0) + 1} of ${captchaResult.info?.waves || 1}`;
  status.textContent = '';
  loading.style.display = 'none';

  if (captchaResult.image) {
    image.src = `data:image/gif;base64,${captchaResult.image}`;
    image.style.display = 'block';
  }

  tiles.forEach(tile => {
    tile.disabled = false;
    tile.style.opacity = '1';
  });

  tiles.forEach(tile => {
    tile.onclick = () => handleCaptchaTileClick(parseInt(tile.dataset.tile));
  });

  const closeBtn = document.getElementById('captcha-close-btn');
  if (closeBtn) {
    closeBtn.onclick = () => cancelCaptcha();
  }

  modal.style.display = 'flex';
}

async function handleCaptchaTileClick(tileIndex) {
  if (!currentCaptchaSession) {
    console.error('No active captcha session');
    return;
  }
  
  const tiles = document.querySelectorAll('.captcha-tile');
  const status = document.getElementById('captcha-status');
  const progress = document.getElementById('captcha-progress');
  const image = document.getElementById('captcha-image');

  tiles.forEach(tile => {
    tile.disabled = true;
    tile.style.opacity = '0.5';
  });
  
  status.textContent = 'Checking answer...';
  
  try {
    const result = await window.roblox.funcaptcha.answer(
      currentCaptchaSession.sessionId,
      tileIndex
    );
    
    console.log('Captcha answer result:', result);
    
    if (!result.success) {
      status.textContent = 'Error: ' + (result.error || 'Unknown error');
      tiles.forEach(tile => {
        tile.disabled = false;
        tile.style.opacity = '1';
      });
      return;
    }
    
    if (result.completed) {
      
      if (result.solved) {
        status.textContent = 'Verification successful!';
        pendingGroupChallenge.captchaToken = currentCaptchaSession.token;

        setTimeout(async () => {
          hideCaptchaModal();
          await retryGroupActionAfterCaptcha();
        }, 500);
      } else {
        status.textContent = 'Verification failed. Please try again.';
        setTimeout(() => {
          hideCaptchaModal();
          resetGroupButtons();
        }, 1500);
      }
    } else {
      
      progress.textContent = `Wave ${result.wave + 1} of ${currentCaptchaSession.info?.waves || 1}`;
      status.textContent = '';

      if (result.image) {
        image.src = `data:image/gif;base64,${result.image}`;
      }

      tiles.forEach(tile => {
        tile.disabled = false;
        tile.style.opacity = '1';
      });
    }
  } catch (error) {
    console.error('Captcha answer error:', error);
    status.textContent = 'Error: ' + error.message;
    tiles.forEach(tile => {
      tile.disabled = false;
      tile.style.opacity = '1';
    });
  }
}

function hideCaptchaModal() {
  const modal = document.getElementById('group-captcha-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  currentCaptchaSession = null;
}

async function cancelCaptcha() {
  if (currentCaptchaSession?.sessionId) {
    try {
      await window.roblox.funcaptcha.cancel(currentCaptchaSession.sessionId);
    } catch (e) {
      console.log('Error cancelling captcha:', e);
    }
  }
  
  hideCaptchaModal();
  resetGroupButtons();
}

function handleGroupCaptchaMessage(event) {
  
  if (event.origin.includes('arkoselabs.com') || event.origin.includes('funcaptcha.com')) {
    console.log('Group CAPTCHA message received:', event.data);

    if (event.data && event.data.eventId) {
      if (event.data.eventId === 'challenge-complete' || event.data.eventId === 'challenge-suppressed') {
        console.log('CAPTCHA completed, retrying group action...');
        
        window.removeEventListener('message', handleGroupCaptchaMessage);
        retryGroupActionAfterCaptcha();
      }
    }
  }
}

async function retryGroupActionAfterCaptcha() {
  if (!pendingGroupChallenge) {
    console.error('No pending group challenge data');
    return;
  }

  const captchaContainer = document.getElementById('group-captcha-container');
  const captchaIframe = document.getElementById('group-captcha-iframe');

  try {
    const { challengeId, challengeMetadata, groupId, action, captchaToken } = pendingGroupChallenge;

    console.log('Retrying group action after captcha completion with challenge data...');

    const captchaId = challengeMetadata?.unifiedCaptchaId;

    const challengeParams = {
      challengeId: challengeId,
      challengeType: 'captcha',
      challengeMetadata: {
        unifiedCaptchaId: captchaId,
        captchaToken: captchaToken,
        actionType: 'Generic'
      }
    };

    console.log('Retrying with challenge params:', challengeParams);

    let result;
    if (action === 'join') {
      result = await window.roblox.joinGroup(groupId, challengeParams);
    } else {
      if (!currentUserId) {
        const currentUser = await window.RobloxClient.api.getCurrentUser();
        currentUserId = currentUser?.id;
      }
      result = await window.roblox.leaveGroup(groupId, currentUserId, challengeParams);
    }

    captchaContainer.style.display = 'none';
    captchaIframe.src = '';

    if (result?.requiresChallenge) {
      
      await handleGroupChallenge(result, groupId, action);
    } else if (result?.success || result?.groupId || !result?.errors) {
      await updateGroupMembershipUI(groupId);
      await loadMyGroups();
      pendingGroupChallenge = null;
    } else {
      throw new Error(result?.message || result?.errors?.[0]?.message || 'Action failed');
    }

  } catch (error) {
    console.error('Failed to complete group action after captcha:', error);
    alert('Failed to complete action: ' + (error.message || 'Unknown error'));
    captchaContainer.style.display = 'none';
    captchaIframe.src = '';
    resetGroupButtons();
  }
}

async function showGroupTwoStepVerification(challengeResult, action) {
  const actionText = action === 'join' ? 'join' : 'leave';
  const metadata = challengeResult.challengeMetadata;

  const code = prompt(
    `Two-Step Verification Required\n\n` +
    `To ${actionText} this group, enter the 6-digit code from your authenticator app:`
  );

  if (!code || code.trim().length !== 6) {
    resetGroupButtons();
    return;
  }

  try {
    if (!currentUserId) {
      const currentUser = await window.RobloxClient.api.getCurrentUser();
      currentUserId = currentUser?.id;
    }

    const challengeIdToUse = challengeResult.challengeType === 'twostepverification'
      ? (metadata?.challengeId || challengeResult.challengeId)
      : challengeResult.challengeId;

    console.log('Verifying 2FA for group action, challengeId:', challengeIdToUse);

    const verifyResult = await window.roblox.verifyTwoStepForChallenge(
      currentUserId,
      challengeIdToUse,
      code.trim(),
      'authenticator'
    );

    if (!verifyResult?.success) {
      throw new Error(verifyResult?.error || 'Verification failed');
    }

    console.log('2FA verified, continuing challenge...');

    const continueResult = await window.roblox.continueChallenge(
      challengeResult.challengeId,
      challengeResult.challengeType,
      verifyResult.verificationToken,
      verifyResult.rememberTicket,
      challengeIdToUse
    );

    console.log('Retrying group action...');

    let result;
    if (action === 'join') {
      result = await window.roblox.joinGroup(pendingGroupChallenge.groupId);
    } else {
      result = await window.roblox.leaveGroup(pendingGroupChallenge.groupId, currentUserId);
    }

    if (result?.requiresChallenge) {
      alert('Verification failed. Please try again.');
      resetGroupButtons();
    } else if (result?.success || result?.groupId || !result?.errors) {
      await updateGroupMembershipUI(pendingGroupChallenge.groupId);
      await loadMyGroups();
      pendingGroupChallenge = null;
    } else {
      throw new Error(result?.message || result?.errors?.[0]?.message || 'Action failed');
    }

  } catch (error) {
    console.error('2FA verification for group action failed:', error);
    alert('Verification failed: ' + (error.message || 'Unknown error'));
    resetGroupButtons();
  }
}

function resetGroupButtons() {
  const joinBtn = document.getElementById('group-join-btn');
  const leaveBtn = document.getElementById('group-leave-btn');
  const captchaModal = document.getElementById('group-captcha-modal');

  if (joinBtn) {
    joinBtn.disabled = false;
    joinBtn.textContent = 'Join Group';
  }

  if (leaveBtn) {
    leaveBtn.disabled = false;
    leaveBtn.textContent = 'Leave Group';
  }

  if (captchaModal) {
    captchaModal.style.display = 'none';
  }

  currentCaptchaSession = null;
  pendingGroupChallenge = null;
}
