

(function() {
    'use strict';

    if (window._characterPageLoaded) {
        console.log('[Character] Script already loaded, skipping duplicate');
        return;
    }
    window._characterPageLoaded = true;
    console.log('[Character] Script loading...');

    let currentUserId = null;
    let currentCategory = 2; 
    let wardrobePage = 1;
    let wardrobeTotalPages = 1;
    let wardrobeItems = []; 
    
    let wardrobeThumbnails = window.Performance ? new window.Performance.LRUCache(75, 10 * 60 * 1000) : {};
    let isLoading = false;
    let currentAvatarType = 'R15'; 

    const ITEMS_PER_PAGE = 8; 

    const categoryNames = {
        
        8: 'Hats',
        41: 'Hair',
        18: 'Faces',
        2: 'T-Shirts',
        11: 'Shirts',
        12: 'Pants',
        
        46: 'Back',
        45: 'Front',
        43: 'Neck',
        44: 'Shoulder',
        47: 'Waist',
        42: 'Face Acc',
        19: 'Gear',
        
        17: 'Heads',
        27: 'Torsos',
        29: 'Left Arms',
        28: 'Right Arms',
        31: 'Left Legs',
        30: 'Right Legs',
        
        'costumes': 'Costumes',
        'animations': 'Animations'
    };

    const outfitCategories = {
        'costumes': [
            { itemType: 'Outfit', itemSubType: 1 },  
            { itemType: 'Outfit', itemSubType: 5 }   
        ],
        'animations': [
            { itemType: 'Outfit', itemSubType: 5 }   
        ]
    };

    let bodyColorsPalette = [];

    let selectedBodyPart = null;
    
    let currentBodyColors = {
        headColor3: 'F5CD30',       
        torsoColor3: 'F5CD30',
        rightArmColor3: 'F5CD30',
        leftArmColor3: 'F5CD30',
        rightLegColor3: 'F5CD30',
        leftLegColor3: 'F5CD30'
    };
    let currentWearingAssets = []; 

    async function initCharacterPage() {
        
        if (window._characterPageInitializing) {
            console.log('[Character] initCharacterPage skipped - already initializing');
            return;
        }
        window._characterPageInitializing = true;
        console.log('[Character] initCharacterPage started');

        try {
            const user = await window.RobloxClient.api.getCurrentUser();
            console.log('[Character] Current user:', user);
            if (!user || !user.id) {
                showError('You must be logged in to view this page.');
                return;
            }
            currentUserId = user.id;
            console.log('[Character] currentUserId set to:', currentUserId);

            currentCategory = 2;
            wardrobePage = 1;
            wardrobeItems = [];
            wardrobeThumbnails = window.Performance ? new window.Performance.LRUCache(75, 10 * 60 * 1000) : {};
            assetCreators = {};
            assetDetails = {};
            
            document.querySelectorAll('.WardrobeTab').forEach(t => {
                t.classList.toggle('active', t.dataset.category === '2');
            });

            setupEventListeners();
            console.log('[Character] Event listeners set up');

            await loadAvatarRules();
            console.log('[Character] Avatar rules loaded');

            console.log('[Character] Starting parallel load of avatar and wardrobe...');
            await Promise.all([
                loadCurrentAvatar(), 
                loadWardrobeItems()
            ]);
            console.log('[Character] Parallel load complete');

        } catch (e) {
            console.error('[Character] Failed to initialize character page:', e);
            showError('Failed to load character page.');
        } finally {
            window._characterPageInitializing = false;
        }
    }

    async function loadAvatarRules() {
        try {
            const rules = await window.roblox.getAvatarRules();
            if (rules?.bodyColorsPalette) {
                bodyColorsPalette = rules.bodyColorsPalette;
                initBodyColors();
            }
        } catch (e) {
            console.warn('Failed to load avatar rules:', e);
        }
    }

    function brickColorToHex(brickColorId) {
        const color = bodyColorsPalette.find(c => c.brickColorId === brickColorId);
        if (color && color.hexColor) {
            
            return color.hexColor.replace('#', '');
        }
        return 'F5CD30'; 
    }

    function rgbToHex(rgb) {
        if (!rgb) return 'F5CD30';
        
        if (rgb.startsWith('#')) return rgb.replace('#', '');
        
        const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
            const r = parseInt(match[1]).toString(16).padStart(2, '0');
            const g = parseInt(match[2]).toString(16).padStart(2, '0');
            const b = parseInt(match[3]).toString(16).padStart(2, '0');
            return `${r}${g}${b}`;
        }
        return 'F5CD30';
    }

    function showError(message) {
        
        if (window.showErrorPage) {
            window.showErrorPage(message, 'character-content');
        } else {
            const container = document.getElementById('CharacterContainer');
            if (container) {
                container.innerHTML = `<div style="text-align: center; padding: 40px; color: #cc0000;">${message}</div>`;
            }
        }
    }

    async function loadCurrentAvatar() {
        console.log('[Character] loadCurrentAvatar started');
        
        const characterContainer = document.getElementById('character-content');
        const wearingContainer = characterContainer?.querySelector('#CurrentlyWearing') || document.getElementById('CurrentlyWearing');
        let avatarImg = characterContainer?.querySelector('#AvatarImage') || document.getElementById('AvatarImage');
        console.log('[Character] Initial AvatarImage element:', avatarImg, 'found:', !!avatarImg, 'in character-content:', !!characterContainer?.querySelector('#AvatarImage'));

        if (wearingContainer) {
            wearingContainer.innerHTML = '<div class="loading">Loading outfit...</div>';
        }

        try {
            
            console.log('[Character] Fetching current avatar from API...');
            const avatar = await window.roblox.getCurrentAvatar();
            console.log('[Character] Avatar data received:', avatar);

            if (avatar?.playerAvatarType) {
                currentAvatarType = avatar.playerAvatarType;
                updateAvatarTypeButtons();
            }

            if (avatar?.bodyColor3s) {
                
                currentBodyColors = {
                    headColor3: avatar.bodyColor3s.headColor3 || 'F5CD30',
                    torsoColor3: avatar.bodyColor3s.torsoColor3 || 'F5CD30',
                    rightArmColor3: avatar.bodyColor3s.rightArmColor3 || 'F5CD30',
                    leftArmColor3: avatar.bodyColor3s.leftArmColor3 || 'F5CD30',
                    rightLegColor3: avatar.bodyColor3s.rightLegColor3 || 'F5CD30',
                    leftLegColor3: avatar.bodyColor3s.leftLegColor3 || 'F5CD30'
                };
                updateBodyPartColors();
            } else if (avatar?.bodyColors) {
                
                const bc = avatar.bodyColors;
                currentBodyColors = {
                    headColor3: brickColorToHex(bc.headColorId),
                    torsoColor3: brickColorToHex(bc.torsoColorId),
                    rightArmColor3: brickColorToHex(bc.rightArmColorId),
                    leftArmColor3: brickColorToHex(bc.leftArmColorId),
                    rightLegColor3: brickColorToHex(bc.rightLegColorId),
                    leftLegColor3: brickColorToHex(bc.leftLegColorId)
                };
                updateBodyPartColors();
            }

            if (!avatarImg) {
                console.log('[Character] AvatarImage not found initially, retrying...');
                avatarImg = characterContainer?.querySelector('#AvatarImage') || document.getElementById('AvatarImage');
                console.log('[Character] Retry AvatarImage element:', avatarImg, 'found:', !!avatarImg);
            }
            console.log('[Character] About to load thumbnail. avatarImg:', !!avatarImg, 'currentUserId:', currentUserId);
            if (avatarImg && currentUserId) {
                
                console.log('[Character] Starting background thumbnail load...');
                loadAvatarThumbnailWithRetry(avatarImg, currentUserId).catch(err => {
                    console.warn('[Character] Avatar thumbnail load failed:', err);
                });
            } else {
                console.warn('[Character] Cannot load thumbnail - missing element or userId');
            }

            currentWearingAssets = avatar?.assets || [];

            if (!wearingContainer) return;

            if (currentWearingAssets.length === 0) {
                wearingContainer.innerHTML = '<div class="NoItems">No items currently worn.</div>';
                return;
            }

            const assetIds = currentWearingAssets.map(a => a.id);
            let thumbnails = {};
            try {
                const thumbResult = await window.roblox.getAssetThumbnails(assetIds, '110x110');
                if (thumbResult?.data) {
                    thumbResult.data.forEach(t => {
                        thumbnails[t.targetId] = t.imageUrl;
                    });
                }
            } catch (e) {
                console.warn('Failed to load thumbnails:', e);
            }

            wearingContainer.innerHTML = '';
            const grid = document.createElement('div');
            grid.className = 'WearingGrid';

            currentWearingAssets.forEach(asset => {
                const assetId = asset.id;
                const assetName = asset.name || `Asset ${assetId}`;
                const assetTypeName = asset.assetType?.name || '';
                const thumb = thumbnails[assetId] || '';

                const item = document.createElement('div');
                item.className = 'WearingItem';
                item.innerHTML = `
                    <div class="ItemAction">
                        <a href="#" class="RemoveBtn" data-asset-id="${assetId}">[ remove ]</a>
                    </div>
                    <div class="ItemThumb">
                        ${thumb ? `<img src="${thumb}" alt="${escapeHtml(assetName)}" />` : ''}
                    </div>
                    <div class="ItemName">${escapeHtml(assetName)}</div>
                    <div class="ItemInfo">
                        <span class="ItemLabel">Type:</span> ${escapeHtml(assetTypeName)}
                    </div>
                `;
                grid.appendChild(item);
            });

            wearingContainer.appendChild(grid);

        } catch (e) {
            console.error('Failed to load current avatar:', e);
            if (wearingContainer) {
                wearingContainer.innerHTML = '<div class="error">Failed to load outfit.</div>';
            }
        }
    }

    function updateBodyPartColors() {
        const colorMap = {
            'Head': currentBodyColors.headColor3,
            'Torso': currentBodyColors.torsoColor3,
            'RightArm': currentBodyColors.rightArmColor3,
            'LeftArm': currentBodyColors.leftArmColor3,
            'RightLeg': currentBodyColors.rightLegColor3,
            'LeftLeg': currentBodyColors.leftLegColor3
        };

        for (const [part, hexColor] of Object.entries(colorMap)) {
            const partEl = document.getElementById(`BP_${part}`);
            if (partEl && hexColor) {
                partEl.style.backgroundColor = `#${hexColor}`;
            }
        }
    }

    async function loadWardrobeItems(resetPage = true) {
        const container = document.getElementById('WardrobeItems');
        if (!container || !currentUserId || isLoading) return;

        isLoading = true;
        if (resetPage) {
            wardrobePage = 1;
            wardrobeItems = [];
            
            wardrobeThumbnails = window.Performance ? new window.Performance.LRUCache(75, 10 * 60 * 1000) : {};
            assetCreators = {};
            assetDetails = {};
        }

        container.innerHTML = '<div class="loading">Loading items...</div>';

        try {
            let allItems = [];

            if (outfitCategories[currentCategory]) {
                
                let pageToken = '';
                do {
                    const result = await window.roblox.getAvatarInventory({
                        sortOption: '1',
                        pageLimit: 50,
                        itemCategories: outfitCategories[currentCategory],
                        pageToken: pageToken || undefined
                    });

                    if (result?.avatarInventoryItems) {
                        allItems = allItems.concat(result.avatarInventoryItems);
                    }
                    pageToken = result?.nextPageToken || '';
                } while (pageToken && allItems.length < 500);
            } else {
                
                let pageToken = '';
                do {
                    const result = await window.roblox.getAvatarInventory({
                        sortOption: '1', 
                        pageLimit: 50,
                        itemSubType: currentCategory,
                        itemType: 'Asset',
                        pageToken: pageToken || undefined
                    });

                    if (result?.avatarInventoryItems) {
                        allItems = allItems.concat(result.avatarInventoryItems);
                    }
                    pageToken = result?.nextPageToken || '';
                } while (pageToken && allItems.length < 500); 
            }

            wardrobeItems = allItems;
            wardrobeTotalPages = Math.ceil(wardrobeItems.length / ITEMS_PER_PAGE);

            if (wardrobeItems.length === 0) {
                container.innerHTML = `<div class="NoItems">No ${categoryNames[currentCategory] || 'items'} in your inventory.</div>`;
                document.getElementById('WardrobePagination').style.display = 'none';
                isLoading = false;
                return;
            }

            await loadWardrobeThumbnails();

            renderWardrobePage();

        } catch (e) {
            console.error('Failed to load wardrobe:', e);
            container.innerHTML = '<div class="error">Failed to load items.</div>';
        }

        isLoading = false;
    }

    async function loadWardrobeThumbnails() {
        const itemIds = wardrobeItems.map(item => item.itemId);

        if (outfitCategories[currentCategory]) {
            
            for (let i = 0; i < itemIds.length; i += 50) {
                const batch = itemIds.slice(i, i + 50);
                try {
                    const thumbResult = await window.roblox.getOutfitThumbnails(batch, '150x150');
                    if (thumbResult?.data) {
                        thumbResult.data.forEach(t => {
                            
                            if (wardrobeThumbnails.set) {
                                wardrobeThumbnails.set(t.targetId, t.imageUrl);
                            } else {
                                wardrobeThumbnails[t.targetId] = t.imageUrl;
                            }
                        });
                    }
                } catch (e) {
                    console.warn('Failed to load outfit thumbnail batch:', e);
                }
            }
        } else {
            
            for (let i = 0; i < itemIds.length; i += 50) {
                const batch = itemIds.slice(i, i + 50);
                try {
                    const thumbResult = await window.roblox.getAssetThumbnails(batch, '110x110');
                    if (thumbResult?.data) {
                        thumbResult.data.forEach(t => {
                            
                            if (wardrobeThumbnails.set) {
                                wardrobeThumbnails.set(t.targetId, t.imageUrl);
                            } else {
                                wardrobeThumbnails[t.targetId] = t.imageUrl;
                            }
                        });
                    }
                } catch (e) {
                    console.warn('Failed to load thumbnail batch:', e);
                }
            }
        }
    }

    let assetCreators = {};
    let assetDetails = {};

    async function loadCreatorInfo(assetIds) {
        const missingIds = assetIds.filter(id => !assetCreators[id]);
        if (missingIds.length === 0) return;

        try {
            
            const items = missingIds.map(id => ({ itemType: 'Asset', id: parseInt(id) }));
            const result = await window.roblox.getCatalogItemDetails(items);

            if (result?.data) {
                result.data.forEach(item => {
                    
                    assetDetails[item.id] = item;

                    if (item.creatorTargetId && item.creatorName) {
                        assetCreators[item.id] = {
                            Id: item.creatorTargetId,
                            Name: item.creatorName,
                            Type: item.creatorType 
                        };
                        
                        const creatorEl = document.querySelector(`.ItemCreator[data-asset-id="${item.id}"]`);
                        if (creatorEl) {
                            creatorEl.innerHTML = `Creator: <a href="#" data-creator-id="${item.creatorTargetId}" data-creator-type="${item.creatorType}">${escapeHtml(item.creatorName)}</a>`;
                        }
                    }

                    const itemThumb = document.querySelector(`.ItemThumb[data-asset-id="${item.id}"]`);
                    if (itemThumb) {
                        const restrictions = item.itemRestrictions || [];
                        const isLimited = restrictions.includes('Limited');
                        const isLimitedUnique = restrictions.includes('LimitedUnique');

                        const existingOverlay = itemThumb.querySelector('.limited-overlay');
                        if (existingOverlay) existingOverlay.remove();

                        if (isLimitedUnique || isLimited) {
                            const overlay = document.createElement('img');
                            overlay.className = 'limited-overlay';
                            overlay.src = isLimitedUnique ? 'images/assetIcons/limitedunique.png' : 'images/assetIcons/limited.png';
                            overlay.alt = isLimitedUnique ? 'Limited U' : 'Limited';
                            itemThumb.appendChild(overlay);
                        }
                    }
                });
            }
        } catch (e) {
            console.warn('Failed to load creator info:', e);
        }
    }

    function renderWardrobePage() {
        const container = document.getElementById('WardrobeItems');
        if (!container) return;

        const startIndex = (wardrobePage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const pageItems = wardrobeItems.slice(startIndex, endIndex);

        if (pageItems.length === 0) {
            container.innerHTML = `<div class="NoItems">No items on this page.</div>`;
            return;
        }

        container.innerHTML = '';
        const grid = document.createElement('div');
        grid.className = 'WardrobeGrid';

        const assetIdsOnPage = [];

        pageItems.forEach(item => {
            const assetId = item.itemId;
            const assetName = item.itemName || `Asset ${assetId}`;
            
            const thumb = (wardrobeThumbnails.get ? wardrobeThumbnails.get(assetId) : wardrobeThumbnails[assetId]) || '';
            const creator = assetCreators[assetId];
            const creatorHtml = creator
                ? `Creator: <a href="#" data-creator-id="${creator.Id}" data-creator-type="${creator.Type}">${escapeHtml(creator.Name)}</a>`
                : 'Creator: ...';

            const isWorn = currentWearingAssets.some(a => a.id == assetId);
            const actionButton = isWorn
                ? `<a href="#" class="RemoveBtn" data-asset-id="${assetId}">[ remove ]</a>`
                : `<a href="#" class="WearBtn" data-asset-id="${assetId}">[ wear ]</a>`;

            assetIdsOnPage.push(assetId);

            const itemEl = document.createElement('div');
            itemEl.className = 'WardrobeItem';
            itemEl.innerHTML = `
                <div class="ItemAction">
                    ${actionButton}
                </div>
                <div class="ItemThumb" data-asset-id="${assetId}">
                    ${thumb ? `<img src="${thumb}" alt="${escapeHtml(assetName)}" />` : ''}
                </div>
                <div class="ItemName">${escapeHtml(assetName)}</div>
                <div class="ItemCreator" data-asset-id="${assetId}">${creatorHtml}</div>
            `;
            grid.appendChild(itemEl);
        });

        container.appendChild(grid);

        updateWardrobePagination();

        loadCreatorInfo(assetIdsOnPage);
    }

    function updateWardrobePagination() {
        const pagination = document.getElementById('WardrobePagination');
        const pagesSpan = document.getElementById('WardrobePages');

        if (!pagination) return;

        const hasPrev = wardrobePage > 1;
        const hasNext = wardrobePage < wardrobeTotalPages;

        if (wardrobeTotalPages <= 1) {
            pagination.style.display = 'none';
            return;
        }

        pagination.style.display = 'block';

        let pages = '';
        let startPage = Math.max(1, wardrobePage - 2);
        let endPage = Math.min(wardrobeTotalPages, startPage + 4);

        if (endPage - startPage < 4) {
            startPage = Math.max(1, endPage - 4);
        }

        for (let i = startPage; i <= endPage; i++) {
            if (i === wardrobePage) {
                pages += `<span class="CurrentPage">${i}</span> `;
            } else {
                pages += `<a href="#" class="PageNum" data-page="${i}">${i}</a> `;
            }
        }

        if (endPage < wardrobeTotalPages) {
            pages += `.. <a href="#" class="PageNum" data-page="${wardrobeTotalPages}">${wardrobeTotalPages}</a>`;
        }

        pagesSpan.innerHTML = pages;

        document.getElementById('WardrobeFirst').style.visibility = hasPrev ? 'visible' : 'hidden';
        document.getElementById('WardrobePrev').style.visibility = hasPrev ? 'visible' : 'hidden';
        document.getElementById('WardrobeNext').style.visibility = hasNext ? 'visible' : 'hidden';
        document.getElementById('WardrobeLast').style.visibility = hasNext ? 'visible' : 'hidden';
    }

    function initBodyColors() {
        const grid = document.getElementById('ColorGrid');
        if (!grid) return;

        grid.innerHTML = '';
        bodyColorsPalette.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = 'ColorSwatch';
            swatch.style.backgroundColor = color.hexColor;
            swatch.title = color.name;
            
            swatch.dataset.hexColor = color.hexColor.replace('#', '');
            swatch.dataset.colorId = color.brickColorId;
            grid.appendChild(swatch);
        });

        const pickerContainer = document.getElementById('ColorPickerContainer');
        if (pickerContainer && !document.getElementById('ColorPickerInput')) {
            const picker = document.createElement('input');
            picker.type = 'color';
            picker.id = 'ColorPickerInput';
            picker.value = '#F5CD30';
            picker.title = 'Pick any color';
            picker.style.cssText = 'width: 30px; height: 30px; border: 1px solid #999; cursor: pointer; padding: 0; margin-left: 5px;';
            pickerContainer.appendChild(picker);
        }

        document.querySelectorAll('.BodyPart').forEach(part => {
            part.style.backgroundColor = '#F5CD30'; 
        });
    }

    function setupEventListeners() {
        
        const wardrobeContainer = document.getElementById('WardrobeItems');
        if (wardrobeContainer && wardrobeContainer._listenersAttached) {
            console.log('[Character] Event listeners already attached to this DOM');
            return;
        }

        console.log('[Character] Attaching event listeners to DOM...');
        if (wardrobeContainer) {
            wardrobeContainer._listenersAttached = true;
        }

        document.querySelectorAll('.WardrobeTab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const categoryStr = tab.dataset.category;
                
                const category = isNaN(categoryStr) ? categoryStr : parseInt(categoryStr);
                if (category && category !== currentCategory) {
                    currentCategory = category;
                    
                    document.querySelectorAll('.WardrobeTab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    loadWardrobeItems(true);
                }
            });
        });

        document.getElementById('WardrobeItems')?.addEventListener('click', async (e) => {
            const wearBtn = e.target.closest('.WearBtn');
            if (wearBtn) {
                e.preventDefault();
                const assetId = wearBtn.dataset.assetId;
                await wearItem(assetId);
                return;
            }

            const removeBtn = e.target.closest('.RemoveBtn');
            if (removeBtn) {
                e.preventDefault();
                const assetId = removeBtn.dataset.assetId;
                await removeItem(assetId);
                return;
            }

            const creatorLink = e.target.closest('a[data-creator-id]');
            if (creatorLink) {
                e.preventDefault();
                const creatorId = creatorLink.dataset.creatorId;
                const creatorType = creatorLink.dataset.creatorType;

                if (creatorType === 'User') {
                    
                    navigateToPage('profile', { userId: creatorId });
                } else if (creatorType === 'Group') {
                    
                    navigateToPage('groups', { groupId: creatorId });
                }
                return;
            }

            const itemThumb = e.target.closest('.ItemThumb');
            const itemName = e.target.closest('.ItemName');

            if (itemThumb || itemName) {
                const wardrobeItem = e.target.closest('.WardrobeItem');
                if (wardrobeItem) {
                    
                    const actionBtn = wardrobeItem.querySelector('.WearBtn, .RemoveBtn');
                    if (actionBtn) {
                        const assetId = actionBtn.dataset.assetId;
                        
                        navigateToPage('catalog-item', { id: assetId });
                    }
                }
            }
        });

        document.getElementById('CurrentlyWearing')?.addEventListener('click', async (e) => {
            const removeBtn = e.target.closest('.RemoveBtn');
            if (removeBtn) {
                e.preventDefault();
                const assetId = removeBtn.dataset.assetId;
                await removeItem(assetId);
            }
        });

        document.querySelectorAll('.BodyPart').forEach(part => {
            part.addEventListener('click', () => {
                selectedBodyPart = part.dataset.part;
                
                document.querySelectorAll('.BodyPart').forEach(p => p.classList.remove('selected'));
                part.classList.add('selected');
                
                document.getElementById('ColorPalette').style.display = 'block';

                const colorPicker = document.getElementById('ColorPickerInput');
                if (colorPicker) {
                    const partToField = {
                        'head': 'headColor3',
                        'torso': 'torsoColor3',
                        'rightArm': 'rightArmColor3',
                        'leftArm': 'leftArmColor3',
                        'rightLeg': 'rightLegColor3',
                        'leftLeg': 'leftLegColor3'
                    };
                    const fieldName = partToField[selectedBodyPart];
                    if (fieldName && currentBodyColors[fieldName]) {
                        colorPicker.value = '#' + currentBodyColors[fieldName];
                    }
                }
            });
        });

        document.getElementById('ColorGrid')?.addEventListener('click', async (e) => {
            const swatch = e.target.closest('.ColorSwatch');
            if (swatch && selectedBodyPart) {
                
                let hexColor = swatch.dataset.hexColor;
                if (!hexColor) {
                    
                    const bgColor = swatch.style.backgroundColor;
                    hexColor = rgbToHex(bgColor);
                }
                
                await setBodyColor(selectedBodyPart, hexColor);
            }
        });

        document.getElementById('ColorPickerInput')?.addEventListener('input', async (e) => {
            if (selectedBodyPart) {
                const hexColor = e.target.value;
                await setBodyColor(selectedBodyPart, hexColor);
            }
        });

        document.getElementById('RedrawAvatarLink')?.addEventListener('click', async (e) => {
            e.preventDefault();
            await redrawAvatar();
        });

        document.getElementById('R6Button')?.addEventListener('click', async (e) => {
            e.preventDefault();
            await setAvatarType('R6');
        });

        document.getElementById('R15Button')?.addEventListener('click', async (e) => {
            e.preventDefault();
            await setAvatarType('R15');
        });

        document.getElementById('WardrobePagination')?.addEventListener('click', (e) => {
            e.preventDefault();
            const target = e.target;

            if (target.id === 'WardrobeNext' && wardrobePage < wardrobeTotalPages) {
                wardrobePage++;
                renderWardrobePage();
            } else if (target.id === 'WardrobePrev' && wardrobePage > 1) {
                wardrobePage--;
                renderWardrobePage();
            } else if (target.id === 'WardrobeFirst') {
                wardrobePage = 1;
                renderWardrobePage();
            } else if (target.id === 'WardrobeLast') {
                wardrobePage = wardrobeTotalPages;
                renderWardrobePage();
            } else if (target.classList.contains('PageNum')) {
                const page = parseInt(target.dataset.page);
                if (page && page !== wardrobePage && page >= 1 && page <= wardrobeTotalPages) {
                    wardrobePage = page;
                    renderWardrobePage();
                }
            }
        });
    }

    async function wearItem(assetId) {
        try {
            
            const wardrobeItem = wardrobeItems.find(item => item.itemId == assetId);
            if (!wardrobeItem) {
                console.error('Item not found in wardrobe:', assetId);
                alert('Item not found in your inventory.');
                return;
            }

            let updatedAssets;

            if (outfitCategories[currentCategory] && wardrobeItem.outfitDetail) {
                
                const outfitAssets = wardrobeItem.outfitDetail.assets || [];
                if (outfitAssets.length === 0) {
                    console.warn('Outfit has no assets');
                    return;
                }

                const newAssets = outfitAssets.map(a => ({
                    id: a.id,
                    name: `Outfit Asset ${a.id}`,
                    assetType: { id: 0, name: 'Unknown' }
                }));

                updatedAssets = [...currentWearingAssets];

                newAssets.forEach(newAsset => {
                    if (!updatedAssets.some(a => a.id === newAsset.id)) {
                        updatedAssets.push(newAsset);
                    }
                });
            } else {

                if (currentWearingAssets.some(a => a.id == assetId)) {
                    console.log('Already wearing this item');
                    return;
                }

                const newAsset = {
                    id: parseInt(assetId),
                    name: wardrobeItem.itemName || `Asset ${assetId}`,
                    assetType: wardrobeItem.assetType || { id: currentCategory, name: categoryNames[currentCategory] || 'Unknown' }
                };

                updatedAssets = [...currentWearingAssets, newAsset];
            }

            const result = await window.roblox.setWearingAssets(updatedAssets);
            if (result?.success) {
                
                await loadCurrentAvatar();
                
                renderWardrobePage();
                
                setTimeout(refreshAvatarThumbnail, 1500);
            } else {
                console.error('Failed to wear item:', result);
                alert('Failed to wear item. Please try again.');
            }
        } catch (e) {
            console.error('Failed to wear item:', e);
            
            const errorMsg = e.message || e.toString();
            if (errorMsg.includes('LimitExceeded')) {
                alert('Cannot wear this item: You have reached the limit for this item type. Try removing a similar item first.');
            } else if (errorMsg.includes('ValidationErrors')) {
                alert('Cannot wear this item: Roblox rejected the request.');
            } else {
                alert('Failed to wear item. Please try again.');
            }
        }
    }

    async function removeItem(assetId) {
        try {
            
            const updatedAssets = currentWearingAssets.filter(a => a.id != assetId);

            const result = await window.roblox.setWearingAssets(updatedAssets);
            if (result?.success) {
                
                await loadCurrentAvatar();
                
                renderWardrobePage();
                
                setTimeout(refreshAvatarThumbnail, 1500);
            } else {
                console.error('Failed to remove item:', result);
                alert('Failed to remove item. Please try again.');
            }
        } catch (e) {
            console.error('Failed to remove item:', e);
            alert('Failed to remove item. Please try again.');
        }
    }

    let bodyColorTimeout = null;
    let pendingBodyColorUpdate = false;
    
    async function setBodyColor(bodyPart, hexColor) {
        try {
            
            const partToField = {
                'head': 'headColor3',
                'torso': 'torsoColor3',
                'rightArm': 'rightArmColor3',
                'leftArm': 'leftArmColor3',
                'rightLeg': 'rightLegColor3',
                'leftLeg': 'leftLegColor3'
            };

            const fieldName = partToField[bodyPart];
            if (!fieldName) return;

            const cleanHex = hexColor.replace('#', '');

            currentBodyColors[fieldName] = cleanHex;

            const partEl = document.getElementById(`BP_${bodyPart.charAt(0).toUpperCase() + bodyPart.slice(1)}`);
            if (partEl) {
                partEl.style.backgroundColor = `#${cleanHex}`;
            }

            const colorPicker = document.getElementById('ColorPickerInput');
            if (colorPicker && selectedBodyPart === bodyPart) {
                colorPicker.value = `#${cleanHex}`;
            }

            if (bodyColorTimeout) {
                clearTimeout(bodyColorTimeout);
            }
            
            bodyColorTimeout = setTimeout(async () => {
                if (pendingBodyColorUpdate) return; 
                pendingBodyColorUpdate = true;
                
                try {
                    
                    await window.roblox.setBodyColors(currentBodyColors);

                    setTimeout(redrawAvatar, 500);
                } catch (e) {
                    console.warn('Failed to set body colors:', e);
                } finally {
                    pendingBodyColorUpdate = false;
                }
            }, 300); 
        } catch (e) {
            console.warn('Failed to set body color:', e);
        }
    }

    let lastRedrawTime = 0;
    const REDRAW_COOLDOWN = 10000; 
    
    async function redrawAvatar() {
        const now = Date.now();
        const timeSinceLastRedraw = now - lastRedrawTime;
        
        if (timeSinceLastRedraw < REDRAW_COOLDOWN) {
            const remainingSeconds = Math.ceil((REDRAW_COOLDOWN - timeSinceLastRedraw) / 1000);
            console.log(`Redraw on cooldown, ${remainingSeconds}s remaining...`);
            
            await refreshAvatarThumbnail();
            return;
        }
        
        const img = document.getElementById('AvatarImage');
        if (img) {
            img.style.opacity = '0.5';
        }
        try {
            lastRedrawTime = now;
            await window.roblox.redrawAvatar();
            
            setTimeout(async () => {
                await refreshAvatarThumbnail();
                if (img) img.style.opacity = '1';
            }, 2000);
        } catch (e) {
            console.warn('Failed to redraw avatar:', e);
            if (img) img.style.opacity = '1';
            
            await refreshAvatarThumbnail();
        }
    }

    function updateAvatarTypeButtons() {
        const r6Button = document.getElementById('R6Button');
        const r15Button = document.getElementById('R15Button');
        
        if (r6Button && r15Button) {
            r6Button.classList.toggle('active', currentAvatarType === 'R6');
            r15Button.classList.toggle('active', currentAvatarType === 'R15');
        }
    }

    async function setAvatarType(avatarType) {
        try {
            console.log(`[Character] Setting avatar type to ${avatarType}...`);

            const r6Button = document.getElementById('R6Button');
            const r15Button = document.getElementById('R15Button');
            if (r6Button) r6Button.disabled = true;
            if (r15Button) r15Button.disabled = true;

            const result = await window.roblox.setAvatarType(avatarType);
            
            if (result?.success) {
                
                currentAvatarType = avatarType;
                updateAvatarTypeButtons();

                setTimeout(async () => {
                    await refreshAvatarThumbnail();
                }, 1500);
                
                console.log(`[Character] Avatar type changed to ${avatarType}`);
            } else {
                console.error('[Character] Failed to set avatar type:', result);
                alert('Failed to change avatar type. Please try again.');
            }
        } catch (e) {
            console.error('[Character] Error setting avatar type:', e);
            alert('Failed to change avatar type. Please try again.');
        } finally {
            
            const r6Button = document.getElementById('R6Button');
            const r15Button = document.getElementById('R15Button');
            if (r6Button) r6Button.disabled = false;
            if (r15Button) r15Button.disabled = false;
        }
    }

    async function loadAvatarThumbnailWithRetry(avatarImg, userId, maxRetries = 5, delay = 1000) {
        console.log('[Character] loadAvatarThumbnailWithRetry started', { userId, maxRetries, delay });
        console.log('[Character] avatarImg element:', avatarImg, 'exists:', !!avatarImg);

        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                console.log(`[Character] Fetching thumbnail attempt ${attempt + 1}/${maxRetries}...`);
                const result = await window.roblox.getUserFullBodyAvatars([userId], '352x352');
                console.log('[Character] Thumbnail API result:', result);
                const thumbData = result?.data?.[0];

                if (thumbData?.imageUrl) {
                    
                    console.log('[Character] Got valid imageUrl:', thumbData.imageUrl);

                    return new Promise((resolve) => {
                        const onLoad = () => {
                            console.log('[Character] Avatar image loaded successfully');
                            avatarImg.removeEventListener('error', onError);
                            resolve(true);
                        };
                        const onError = () => {
                            console.warn('[Character] Avatar image failed to load:', thumbData.imageUrl);
                            avatarImg.removeEventListener('load', onLoad);
                            resolve(false);
                        };
                        avatarImg.addEventListener('load', onLoad, { once: true });
                        avatarImg.addEventListener('error', onError, { once: true });

                        const newUrl = thumbData.imageUrl;
                        if (avatarImg.src === newUrl) {
                            avatarImg.src = ''; 
                        }
                        avatarImg.src = newUrl;
                    });
                } else if (thumbData?.state === 'Pending' || thumbData?.state === 'Blocked') {
                    
                    console.log(`[Character] Avatar thumbnail state: ${thumbData.state}, retry ${attempt + 1}/${maxRetries}...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    
                    delay = Math.min(delay * 1.5, 3000);
                } else {
                    
                    console.warn('[Character] Avatar thumbnail unknown state:', thumbData?.state, thumbData);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            } catch (e) {
                console.warn(`[Character] Failed to load avatar preview (attempt ${attempt + 1}):`, e);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        console.warn('[Character] Failed to load avatar thumbnail after max retries');
        return false;
    }

    async function refreshAvatarThumbnail() {
        
        const characterContainer = document.getElementById('character-content');
        const avatarImg = characterContainer?.querySelector('#AvatarImage') || document.getElementById('AvatarImage');
        if (avatarImg && currentUserId) {
            
            await loadAvatarThumbnailWithRetry(avatarImg, currentUserId, 3, 1500);
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function resetCharacterPage() {
        console.log('[Character] resetCharacterPage called');
        currentUserId = null;
        currentCategory = 2;
        wardrobePage = 1;
        wardrobeTotalPages = 1;
        wardrobeItems = [];
        
        wardrobeThumbnails = window.Performance ? new window.Performance.LRUCache(200, 30 * 60 * 1000) : {};
        assetCreators = {};
        assetDetails = {};
        bodyColorsPalette = [];
        selectedBodyPart = null;
        isLoading = false;
        currentAvatarType = 'R15'; 
        window._characterPageInitializing = false; 
        currentBodyColors = {
            headColor3: 'F5CD30',
            torsoColor3: 'F5CD30',
            rightArmColor3: 'F5CD30',
            leftArmColor3: 'F5CD30',
            rightLegColor3: 'F5CD30',
            leftLegColor3: 'F5CD30'
        };
        currentWearingAssets = [];
    }

    window.CharacterPage = {
        init: initCharacterPage,
        reset: resetCharacterPage
    };

    document.addEventListener('pageChange', function(e) {
        if (e.detail && e.detail.page === 'character') {
            initCharacterPage();
        }
    });

})();
