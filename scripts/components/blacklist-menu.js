

window.BlacklistMenu = {
    initGameDetailPage: async function(game, container) {
        console.log('[BlacklistMenu] initGameDetailPage called');
        if (!container || !game) return;

        const universeId = game.universeId || game.id;
        const gameName = game.name || 'Unknown Game';
        const creatorId = game.creator?.id || game.creatorId;
        const creatorType = game.creator?.type || game.creatorType || 'User';
        const creatorName = game.creator?.name || game.creatorName || 'Unknown';

        var isGameBlacklisted = false;
        var isCreatorBlacklisted = false;

        if (window.roblox && window.roblox.blacklist) {
            try {
                isGameBlacklisted = await window.roblox.blacklist.isGameBlacklisted(universeId);
                if (creatorId) {
                    isCreatorBlacklisted = await window.roblox.blacklist.isCreatorBlacklisted(creatorId, creatorType);
                }
            } catch (e) {
                console.warn('[Blacklist] Failed to check status:', e);
            }
        }

        var section = document.createElement('div');
        section.className = 'blacklist-section';
        
        var html = '<div class="blacklist-label">Hide from lists:</div>';
        html += '<div class="blacklist-actions">';
        html += '<a href="#" class="blacklist-btn ' + (isGameBlacklisted ? 'blacklisted' : '') + '" id="blacklist-game-btn">';
        html += isGameBlacklisted ? '✓ Game Hidden' : 'Hide This Game';
        html += '</a>';
        
        if (creatorId) {
            var truncName = creatorName.length > 20 ? creatorName.substring(0, 20) + '...' : creatorName;
            html += '<a href="#" class="blacklist-btn ' + (isCreatorBlacklisted ? 'blacklisted' : '') + '" id="blacklist-creator-btn">';
            html += isCreatorBlacklisted ? '✓ Creator Hidden' : 'Hide All by ' + truncName;
            html += '</a>';
        }
        html += '</div>';
        
        section.innerHTML = html;
        container.appendChild(section);

        var gameBtn = section.querySelector('#blacklist-game-btn');
        if (gameBtn) {
            gameBtn.addEventListener('click', function(e) {
                e.preventDefault();
                window.BlacklistMenu.toggleGameBlacklist(universeId, gameName, gameBtn);
            });
        }

        var creatorBtn = section.querySelector('#blacklist-creator-btn');
        if (creatorBtn && creatorId) {
            creatorBtn.addEventListener('click', function(e) {
                e.preventDefault();
                window.BlacklistMenu.toggleCreatorBlacklist(creatorId, creatorType, creatorName, creatorBtn);
            });
        }
    },

    initItemDetailPage: async function(item, container) {
        console.log('[BlacklistMenu] initItemDetailPage called');
        if (!container || !item) return;

        var assetId = item.id || item.assetId;
        var itemName = item.name || 'Unknown Item';
        var creatorId = item.creatorTargetId || (item.creator && item.creator.id);
        var creatorType = item.creatorType || (item.creator && item.creator.type) || 'User';
        var creatorName = item.creatorName || (item.creator && item.creator.name) || 'Unknown';

        var isItemBlacklisted = false;
        var isCreatorBlacklisted = false;

        if (window.roblox && window.roblox.blacklist) {
            try {
                isItemBlacklisted = await window.roblox.blacklist.isItemBlacklisted(assetId);
                if (creatorId) {
                    isCreatorBlacklisted = await window.roblox.blacklist.isCreatorBlacklisted(creatorId, creatorType);
                }
            } catch (e) {
                console.warn('[Blacklist] Failed to check status:', e);
            }
        }

        var section = document.createElement('div');
        section.className = 'blacklist-section';
        
        var html = '<div class="blacklist-label">Hide from catalog:</div>';
        html += '<div class="blacklist-actions">';
        html += '<a href="#" class="blacklist-btn ' + (isItemBlacklisted ? 'blacklisted' : '') + '" id="blacklist-item-btn">';
        html += isItemBlacklisted ? '✓ Item Hidden' : 'Hide This Item';
        html += '</a>';
        
        if (creatorId) {
            var truncName = creatorName.length > 20 ? creatorName.substring(0, 20) + '...' : creatorName;
            html += '<a href="#" class="blacklist-btn ' + (isCreatorBlacklisted ? 'blacklisted' : '') + '" id="blacklist-creator-btn">';
            html += isCreatorBlacklisted ? '✓ Creator Hidden' : 'Hide All by ' + truncName;
            html += '</a>';
        }
        html += '</div>';
        
        section.innerHTML = html;
        container.appendChild(section);

        var itemBtn = section.querySelector('#blacklist-item-btn');
        if (itemBtn) {
            itemBtn.addEventListener('click', function(e) {
                e.preventDefault();
                window.BlacklistMenu.toggleItemBlacklist(assetId, itemName, itemBtn);
            });
        }

        var creatorBtn = section.querySelector('#blacklist-creator-btn');
        if (creatorBtn && creatorId) {
            creatorBtn.addEventListener('click', function(e) {
                e.preventDefault();
                window.BlacklistMenu.toggleCreatorBlacklist(creatorId, creatorType, creatorName, creatorBtn);
            });
        }
    },

    toggleGameBlacklist: async function(universeId, name, btn) {
        if (!window.roblox || !window.roblox.blacklist) return;
        try {
            var isBlacklisted = await window.roblox.blacklist.isGameBlacklisted(universeId);
            if (isBlacklisted) {
                await window.roblox.blacklist.removeGame(universeId);
                btn.classList.remove('blacklisted');
                btn.textContent = 'Hide This Game';
                window.BlacklistMenu.showToast('Unhidden: ' + name);
            } else {
                await window.roblox.blacklist.addGame(universeId, name);
                btn.classList.add('blacklisted');
                btn.textContent = '✓ Game Hidden';
                window.BlacklistMenu.showToast('Hidden: ' + name);
            }
        } catch (e) {
            console.error('[Blacklist] Toggle failed:', e);
        }
    },

    toggleItemBlacklist: async function(assetId, name, btn) {
        if (!window.roblox || !window.roblox.blacklist) return;
        try {
            var isBlacklisted = await window.roblox.blacklist.isItemBlacklisted(assetId);
            if (isBlacklisted) {
                await window.roblox.blacklist.removeItem(assetId);
                btn.classList.remove('blacklisted');
                btn.textContent = 'Hide This Item';
                window.BlacklistMenu.showToast('Unhidden: ' + name);
            } else {
                await window.roblox.blacklist.addItem(assetId, name);
                btn.classList.add('blacklisted');
                btn.textContent = '✓ Item Hidden';
                window.BlacklistMenu.showToast('Hidden: ' + name);
            }
        } catch (e) {
            console.error('[Blacklist] Toggle failed:', e);
        }
    },

    toggleCreatorBlacklist: async function(creatorId, creatorType, name, btn) {
        if (!window.roblox || !window.roblox.blacklist) return;
        try {
            var isBlacklisted = await window.roblox.blacklist.isCreatorBlacklisted(creatorId, creatorType);
            var truncName = name.length > 20 ? name.substring(0, 20) + '...' : name;
            if (isBlacklisted) {
                await window.roblox.blacklist.removeCreator(creatorId, creatorType);
                btn.classList.remove('blacklisted');
                btn.textContent = 'Hide All by ' + truncName;
                window.BlacklistMenu.showToast('Unhidden: ' + name);
            } else {
                await window.roblox.blacklist.addCreator(creatorId, creatorType, name);
                btn.classList.add('blacklisted');
                btn.textContent = '✓ Creator Hidden';
                window.BlacklistMenu.showToast('Hidden all by: ' + name);
            }
        } catch (e) {
            console.error('[Blacklist] Toggle failed:', e);
        }
    },

    showToast: function(message) {
        var existing = document.querySelector('.blacklist-toast');
        if (existing) existing.remove();
        var toast = document.createElement('div');
        toast.className = 'blacklist-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(function() { toast.remove(); }, 2500);
    },

    initAccountPage: async function() {
        var summaryEl = document.getElementById('blacklist-summary');
        var manageBtn = document.getElementById('manage-blacklist-btn');
        var modal = document.getElementById('blacklist-modal');
        var closeBtn = document.getElementById('blacklist-modal-close');
        
        if (!summaryEl || !manageBtn || !modal) return;

        await this.updateSummary();

        manageBtn.addEventListener('click', function() {
            modal.style.display = 'block';
            window.BlacklistMenu.loadBlacklistTab('games');
        });

        if (closeBtn) {
            closeBtn.addEventListener('click', function(e) {
                e.preventDefault();
                modal.style.display = 'none';
            });
        }

        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        var tabs = document.querySelectorAll('.blacklist-tab');
        tabs.forEach(function(tab) {
            tab.addEventListener('click', function(e) {
                e.preventDefault();
                var tabName = this.getAttribute('data-tab');
                window.BlacklistMenu.loadBlacklistTab(tabName);
            });
        });
    },
    
    updateSummary: async function() {
        var summaryEl = document.getElementById('blacklist-summary');
        if (!summaryEl || !window.roblox?.blacklist) {
            if (summaryEl) summaryEl.textContent = 'Blacklist not available';
            return;
        }
        
        try {
            var all = await window.roblox.blacklist.getAll();
            var gamesCount = all.games?.length || 0;
            var itemsCount = all.items?.length || 0;
            var creatorsCount = all.creators?.length || 0;
            var total = gamesCount + itemsCount + creatorsCount;
            
            if (total === 0) {
                summaryEl.innerHTML = '<span style="color: #666;">No hidden content.</span>';
            } else {
                var parts = [];
                if (gamesCount > 0) parts.push(gamesCount + ' game' + (gamesCount !== 1 ? 's' : ''));
                if (itemsCount > 0) parts.push(itemsCount + ' item' + (itemsCount !== 1 ? 's' : ''));
                if (creatorsCount > 0) parts.push(creatorsCount + ' creator' + (creatorsCount !== 1 ? 's' : ''));
                summaryEl.innerHTML = 'Hidden: <strong>' + parts.join(', ') + '</strong>';
            }
        } catch (e) {
            summaryEl.textContent = 'Error loading blacklist';
        }
    },
    
    loadBlacklistTab: async function(tabName) {
        
        var tabs = document.querySelectorAll('.blacklist-tab');
        tabs.forEach(function(tab) {
            if (tab.getAttribute('data-tab') === tabName) {
                tab.classList.add('active');
                tab.style.background = '#f0f0f0';
            } else {
                tab.classList.remove('active');
                tab.style.background = '#ddd';
            }
        });

        var contents = document.querySelectorAll('.blacklist-tab-content');
        contents.forEach(function(content) {
            content.style.display = 'none';
        });
        var activeContent = document.getElementById('blacklist-tab-' + tabName);
        if (activeContent) activeContent.style.display = 'block';

        if (tabName === 'games') {
            await this.loadGamesList();
        } else if (tabName === 'items') {
            await this.loadItemsList();
        } else if (tabName === 'creators') {
            await this.loadCreatorsList();
        }
    },
    
    loadGamesList: async function() {
        var listEl = document.getElementById('blacklist-games-list');
        if (!listEl) return;
        
        listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Loading...</div>';
        
        try {
            var games = await window.roblox.blacklist.getGames();
            if (!games || games.length === 0) {
                listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">No hidden games.</div>';
                return;
            }
            
            var html = '<table style="width: 100%; border-collapse: collapse;">';
            html += '<tr style="background: #eee;"><th style="padding: 8px; text-align: left; border-bottom: 1px solid #ccc;">Game</th><th style="padding: 8px; width: 80px; border-bottom: 1px solid #ccc;">Action</th></tr>';
            
            games.forEach(function(game) {
                html += '<tr data-id="' + game.universeId + '">';
                html += '<td style="padding: 8px; border-bottom: 1px solid #eee;">';
                html += '<a href="#game-detail?id=' + game.universeId + '" style="color: #0066cc;">' + (game.name || 'Unknown Game') + '</a>';
                html += '</td>';
                html += '<td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">';
                html += '<a href="#" class="unhide-game-btn" data-id="' + game.universeId + '" style="color: #cc0000; font-size: 11px;">Unhide</a>';
                html += '</td></tr>';
            });
            
            html += '</table>';
            listEl.innerHTML = html;

            listEl.querySelectorAll('.unhide-game-btn').forEach(function(btn) {
                btn.addEventListener('click', async function(e) {
                    e.preventDefault();
                    var id = parseInt(this.getAttribute('data-id'));
                    await window.roblox.blacklist.removeGame(id);
                    window.BlacklistMenu.showToast('Game unhidden');
                    window.BlacklistMenu.loadGamesList();
                    window.BlacklistMenu.updateSummary();
                });
            });
        } catch (e) {
            listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: #c00;">Error loading games</div>';
        }
    },
    
    loadItemsList: async function() {
        var listEl = document.getElementById('blacklist-items-list');
        if (!listEl) return;
        
        listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Loading...</div>';
        
        try {
            var items = await window.roblox.blacklist.getItems();
            if (!items || items.length === 0) {
                listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">No hidden items.</div>';
                return;
            }
            
            var html = '<table style="width: 100%; border-collapse: collapse;">';
            html += '<tr style="background: #eee;"><th style="padding: 8px; text-align: left; border-bottom: 1px solid #ccc;">Item</th><th style="padding: 8px; width: 80px; border-bottom: 1px solid #ccc;">Action</th></tr>';
            
            items.forEach(function(item) {
                html += '<tr data-id="' + item.assetId + '">';
                html += '<td style="padding: 8px; border-bottom: 1px solid #eee;">';
                html += '<a href="#catalog-item?id=' + item.assetId + '" style="color: #0066cc;">' + (item.name || 'Unknown Item') + '</a>';
                html += '</td>';
                html += '<td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">';
                html += '<a href="#" class="unhide-item-btn" data-id="' + item.assetId + '" style="color: #cc0000; font-size: 11px;">Unhide</a>';
                html += '</td></tr>';
            });
            
            html += '</table>';
            listEl.innerHTML = html;

            listEl.querySelectorAll('.unhide-item-btn').forEach(function(btn) {
                btn.addEventListener('click', async function(e) {
                    e.preventDefault();
                    var id = parseInt(this.getAttribute('data-id'));
                    await window.roblox.blacklist.removeItem(id);
                    window.BlacklistMenu.showToast('Item unhidden');
                    window.BlacklistMenu.loadItemsList();
                    window.BlacklistMenu.updateSummary();
                });
            });
        } catch (e) {
            listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: #c00;">Error loading items</div>';
        }
    },
    
    loadCreatorsList: async function() {
        var listEl = document.getElementById('blacklist-creators-list');
        if (!listEl) return;
        
        listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">Loading...</div>';
        
        try {
            var creators = await window.roblox.blacklist.getCreators();
            if (!creators || creators.length === 0) {
                listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">No hidden creators.</div>';
                return;
            }
            
            var html = '<table style="width: 100%; border-collapse: collapse;">';
            html += '<tr style="background: #eee;"><th style="padding: 8px; text-align: left; border-bottom: 1px solid #ccc;">Creator</th><th style="padding: 8px; width: 60px; border-bottom: 1px solid #ccc;">Type</th><th style="padding: 8px; width: 80px; border-bottom: 1px solid #ccc;">Action</th></tr>';
            
            creators.forEach(function(creator) {
                var link = creator.creatorType === 'Group' ? '#group?id=' + creator.creatorId : '#profile?id=' + creator.creatorId;
                html += '<tr data-id="' + creator.creatorId + '" data-type="' + creator.creatorType + '">';
                html += '<td style="padding: 8px; border-bottom: 1px solid #eee;">';
                html += '<a href="' + link + '" style="color: #0066cc;">' + (creator.name || 'Unknown') + '</a>';
                html += '</td>';
                html += '<td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 11px; color: #666;">' + creator.creatorType + '</td>';
                html += '<td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">';
                html += '<a href="#" class="unhide-creator-btn" data-id="' + creator.creatorId + '" data-type="' + creator.creatorType + '" style="color: #cc0000; font-size: 11px;">Unhide</a>';
                html += '</td></tr>';
            });
            
            html += '</table>';
            listEl.innerHTML = html;

            listEl.querySelectorAll('.unhide-creator-btn').forEach(function(btn) {
                btn.addEventListener('click', async function(e) {
                    e.preventDefault();
                    var id = parseInt(this.getAttribute('data-id'));
                    var type = this.getAttribute('data-type');
                    await window.roblox.blacklist.removeCreator(id, type);
                    window.BlacklistMenu.showToast('Creator unhidden');
                    window.BlacklistMenu.loadCreatorsList();
                    window.BlacklistMenu.updateSummary();
                });
            });
        } catch (e) {
            listEl.innerHTML = '<div style="text-align: center; padding: 20px; color: #c00;">Error loading creators</div>';
        }
    }
};

if (window.BlacklistMenu && typeof window.BlacklistMenu.initGameDetailPage === 'function') {
    console.log('[BlacklistMenu] Loaded successfully - initGameDetailPage:', typeof window.BlacklistMenu.initGameDetailPage, 'initItemDetailPage:', typeof window.BlacklistMenu.initItemDetailPage);
} else {
    console.error('[BlacklistMenu] FAILED to load properly!', window.BlacklistMenu);
}
