

let currentTab = 'inbox';
let currentPage = 0;
let totalPages = 1;
let currentMessages = [];
let selectedMessageId = null;
let inboxInitialized = false;

async function loadInboxPage() {
    console.log('Loading inbox page...');

    if (!inboxInitialized) {
        
        initInboxTabs();

        initInboxButtons();
        
        inboxInitialized = true;
    }

    currentTab = 'inbox';
    currentPage = 0;

    document.querySelectorAll('.inbox-tab').forEach(t => t.classList.remove('active'));
    document.querySelector('.inbox-tab[data-tab="inbox"]')?.classList.add('active');

    showListView();

    await loadMessages('inbox', 0);

    await loadNotificationCount();
}

function initInboxTabs() {
    document.querySelectorAll('.inbox-tab').forEach(tab => {
        tab.addEventListener('click', async () => {
            const tabName = tab.dataset.tab;

            document.querySelectorAll('.inbox-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            currentTab = tabName;
            currentPage = 0;

            showListView();
            
            if (tabName === 'notifications') {
                await loadNotifications();
            } else {
                await loadMessages(tabName, 0);
            }
        });
    });
}

function initInboxButtons() {
    
    document.getElementById('inbox-prev-btn')?.addEventListener('click', async () => {
        if (currentPage > 0) {
            currentPage--;
            await loadMessages(currentTab, currentPage);
        }
    });
    
    document.getElementById('inbox-next-btn')?.addEventListener('click', async () => {
        if (currentPage < totalPages - 1) {
            currentPage++;
            await loadMessages(currentTab, currentPage);
        }
    });

    document.getElementById('pm-back-btn')?.addEventListener('click', () => {
        showListView();
    });

    document.getElementById('inbox-select-all')?.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.message-checkbox');
        checkboxes.forEach(cb => cb.checked = e.target.checked);
    });

    document.getElementById('inbox-mark-read-btn')?.addEventListener('click', async () => {
        await markSelectedMessages('read');
    });

    document.getElementById('inbox-mark-unread-btn')?.addEventListener('click', async () => {
        await markSelectedMessages('unread');
    });
}

async function markSelectedMessages(action) {
    const checkboxes = document.querySelectorAll('.message-checkbox:checked');
    if (checkboxes.length === 0) {
        return;
    }
    
    const messageIds = Array.from(checkboxes)
        .map(cb => cb.dataset.messageId)
        .filter(id => id)
        .map(id => parseInt(id, 10));
    
    if (messageIds.length === 0) return;
    
    try {
        let result;
        if (action === 'read') {
            result = await window.roblox.markMessagesRead(messageIds);
        } else {
            result = await window.roblox.markMessagesUnread(messageIds);
        }

        await loadMessages(currentTab, currentPage);

        const selectAll = document.getElementById('inbox-select-all');
        if (selectAll) selectAll.checked = false;
        
    } catch (error) {
        console.error(`Failed to mark messages as ${action}:`, error);
    }
}

async function loadMessages(tab, pageNumber) {
    const tbody = document.getElementById('inbox-messages-list');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="4" style="text-align: center; padding: 20px;">
                <img src="images/spinners/spinner100x100.gif" style="width: 32px; height: 32px;">
                <div style="margin-top: 10px; color: #666;">Loading messages...</div>
            </td>
        </tr>
    `;
    
    try {
        const response = await window.roblox.getMessages(tab, pageNumber, 20);
        
        currentMessages = response.collection || [];
        totalPages = response.totalPages || 1;
        
        updatePagination();
        renderMessages(currentMessages);
        
    } catch (error) {
        console.error('Failed to load messages:', error);
        if (window.showErrorPage) {
            window.showErrorPage('Failed to load messages: ' + error.message, 'inbox-content');
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 20px; color: #c00;">
                        Failed to load messages. Please try again.
                    </td>
                </tr>
            `;
        }
    }
}

function renderMessages(messages) {
    const tbody = document.getElementById('inbox-messages-list');
    if (!tbody) return;
    
    if (!messages || messages.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="inbox-empty">
                    No messages found.
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = messages.map(msg => {
        
        const isRobloxSender = msg.sender?.id === 1;
        const isUnread = !msg.isRead;
        const date = formatMessageDate(msg.created);
        const senderName = msg.sender?.displayName || msg.sender?.name || 'Unknown';
        
        return `
            <tr class="message-row ${isRobloxSender ? 'system-message' : ''} ${isUnread ? 'unread' : ''}" 
                data-message-id="${msg.id}">
                <td><input type="checkbox" class="message-checkbox" data-message-id="${msg.id}"></td>
                <td>
                    <span class="message-subject">${escapeHtml(msg.subject || '(No Subject)')}</span>
                </td>
                <td class="message-from">
                    ${isRobloxSender ? 
                        'ROBLOX [System Message]' : 
                        `<a href="#" data-user-id="${msg.sender?.id}">${escapeHtml(senderName)}</a>`
                    }
                </td>
                <td class="message-date">${date}</td>
            </tr>
        `;
    }).join('');

    tbody.querySelectorAll('.message-row').forEach(row => {
        row.addEventListener('click', (e) => {
            
            if (e.target.type === 'checkbox') return;
            
            const messageId = row.dataset.messageId;
            const message = currentMessages.find(m => String(m.id) === messageId);
            if (message) {
                showMessageDetail(message);
            }
        });
    });

    tbody.querySelectorAll('.message-from a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const userId = link.dataset.userId;
            if (userId) {
                navigateTo('profile', { userId });
            }
        });
    });
}

async function showMessageDetail(message) {
    selectedMessageId = message.id;

    if (!message.isRead) {
        try {
            await window.roblox.markMessagesRead([message.id]);
            
            message.isRead = true;
            
            const row = document.querySelector(`.message-row[data-message-id="${message.id}"]`);
            if (row) row.classList.remove('unread');
        } catch (e) {
            console.warn('Failed to mark message as read:', e);
        }
    }

    document.getElementById('pm-date').textContent = formatMessageDate(message.created, true);
    document.getElementById('pm-subject').textContent = message.subject || '(No Subject)';

    const bodyEl = document.getElementById('pm-body');
    if (bodyEl) {
        
        const cleanBody = sanitizeMessageBody(message.body || '');
        bodyEl.innerHTML = cleanBody;
    }

    const senderName = message.sender?.displayName || message.sender?.name || 'Unknown';
    const senderLink = document.getElementById('pm-sender-link');
    if (senderLink) {
        senderLink.textContent = senderName;
        senderLink.onclick = (e) => {
            e.preventDefault();
            if (message.sender?.id) {
                navigateTo('profile', { userId: message.sender.id });
            }
        };
    }

    const avatarImg = document.getElementById('pm-avatar-img');
    if (avatarImg && message.sender?.id) {
        try {
            const avatars = await window.roblox.getUserThumbnails([message.sender.id], '150x150', 'AvatarBust');
            if (avatars?.data?.[0]?.imageUrl) {
                avatarImg.src = avatars.data[0].imageUrl;
            }
        } catch (e) {
            console.warn('Failed to load sender avatar:', e);
        }
    }

    document.getElementById('inbox-list-view').style.display = 'none';
    document.getElementById('inbox-detail-view').style.display = 'block';
}

function showListView() {
    document.getElementById('inbox-list-view').style.display = 'block';
    document.getElementById('inbox-detail-view').style.display = 'none';
    selectedMessageId = null;
}

function updatePagination() {
    const prevBtn = document.getElementById('inbox-prev-btn');
    const nextBtn = document.getElementById('inbox-next-btn');
    const pageInfo = document.getElementById('inbox-page-info');
    
    if (prevBtn) prevBtn.disabled = currentPage <= 0;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages - 1;
    if (pageInfo) pageInfo.textContent = `Page ${currentPage + 1} of ${totalPages}`;
}

async function loadNotificationCount() {
    try {
        const count = await window.roblox.getUnreadNotificationsCount();
        const countEl = document.getElementById('inbox-notif-count');
        if (countEl) {
            countEl.textContent = count.unreadNotifications || 0;
        }
    } catch (e) {
        console.warn('Failed to load notification count:', e);
    }
}

async function loadNotifications() {
    const tbody = document.getElementById('inbox-messages-list');
    if (!tbody) return;
    
    tbody.innerHTML = `
        <tr>
            <td colspan="4" style="text-align: center; padding: 20px;">
                <img src="images/spinners/spinner100x100.gif" style="width: 32px; height: 32px;">
                <div style="margin-top: 10px; color: #666;">Loading notifications...</div>
            </td>
        </tr>
    `;
    
    try {
        const response = await window.roblox.getRecentNotifications(20, 0);
        const notifications = response || [];
        
        if (!notifications.length) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="inbox-empty">
                        No notifications found.
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = notifications.map(notif => {
            const date = formatMessageDate(notif.eventDate);
            const content = notif.content?.states?.default?.visualItems?.textBody?.[0]?.label?.text || 'Notification';
            
            return `
                <tr class="message-row system-message">
                    <td><input type="checkbox" class="message-checkbox"></td>
                    <td><span class="message-subject">${escapeHtml(content)}</span></td>
                    <td class="message-from">ROBLOX [System Message]</td>
                    <td class="message-date">${date}</td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Failed to load notifications:', error);
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 20px; color: #c00;">
                    Failed to load notifications.
                </td>
            </tr>
        `;
    }
}

function formatMessageDate(dateStr, includeTime = false) {
    if (!dateStr) return '';
    
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const year = date.getFullYear();
    
    if (includeTime) {
        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        return `${month}/${day}/${year} ${hours}:${minutes}:${seconds} ${ampm}`;
    }
    
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${month}/${day}/${year} ${hours}:${minutes} ${ampm}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function sanitizeMessageBody(html) {

    let clean = html
        .replace(/<br\s*\/?>/gi, '<br>')
        .replace(/\r\n/g, '<br>')
        .replace(/\n/g, '<br>');

    const temp = document.createElement('div');
    temp.innerHTML = clean;

    temp.querySelectorAll('script, style').forEach(el => el.remove());

    temp.querySelectorAll('*').forEach(el => {
        Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('on')) {
                el.removeAttribute(attr.name);
            }
        });
    });
    
    return temp.innerHTML;
}
