

self.addEventListener('message', function(e) {
    const { type, data, id } = e.data;

    try {
        let result;

        switch (type) {
            case 'PARSE_ECONOMY_CACHE':
                
                result = parseEconomyCache(data);
                break;

            case 'FILTER_EXPIRED_ITEMS':
                
                result = filterExpiredItems(data.cache, data.ttl);
                break;

            case 'SORT_BY_TIMESTAMP':
                
                result = sortByTimestamp(data);
                break;

            case 'MERGE_ECONOMY_DATA':
                
                result = mergeEconomyData(data.cache, data.newData, data.maxSize);
                break;

            case 'BATCH_PROCESS_ITEMS':
                
                result = batchProcessItems(data);
                break;

            default:
                throw new Error(`Unknown task type: ${type}`);
        }

        self.postMessage({
            id: id,
            success: true,
            result: result
        });

    } catch (error) {
        
        self.postMessage({
            id: id,
            success: false,
            error: error.message
        });
    }
});

function parseEconomyCache(jsonString) {
    if (!jsonString) return {};

    const cache = JSON.parse(jsonString);
    const validCache = {};

    for (const [id, data] of Object.entries(cache)) {
        if (data && typeof data === 'object' && data.timestamp) {
            validCache[id] = data;
        }
    }

    return validCache;
}

function filterExpiredItems(cache, ttl) {
    const now = Date.now();
    const filtered = {};

    for (const [id, data] of Object.entries(cache)) {
        const age = now - (data.timestamp || 0);
        if (age < ttl) {
            filtered[id] = data;
        }
    }

    return filtered;
}

function sortByTimestamp(cache) {
    const entries = Object.entries(cache);

    entries.sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0));

    return entries;
}

function mergeEconomyData(cache, newData, maxSize) {
    
    const merged = { ...cache };

    for (const [id, data] of Object.entries(newData)) {
        merged[id] = {
            ...data,
            timestamp: Date.now()
        };
    }

    const entries = Object.entries(merged);

    if (entries.length > maxSize) {
        
        entries.sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0));

        const trimmed = {};
        entries.slice(-maxSize).forEach(([id, data]) => {
            trimmed[id] = data;
        });

        return trimmed;
    }

    return merged;
}

function batchProcessItems(items) {
    const processed = [];

    for (const item of items) {
        const hasLimitedRestriction = item.itemRestrictions?.includes('Limited');
        const hasLimitedUniqueRestriction = item.itemRestrictions?.includes('LimitedUnique');
        const hasCollectibleRestriction = item.itemRestrictions?.includes('Collectible');

        const isLimitedUnique = item.isLimitedUnique ||
            item.collectibleItemType === 'LimitedUnique' ||
            hasLimitedUniqueRestriction ||
            hasCollectibleRestriction;

        const isLimited = !isLimitedUnique && (
            item.isLimited ||
            item.collectibleItemType === 'Limited' ||
            hasLimitedRestriction
        );

        processed.push({
            id: item.id,
            name: item.name,
            isLimited: isLimited,
            isLimitedUnique: isLimitedUnique,
            price: item.price ?? item.lowestPrice ?? null,
            lowestResalePrice: item.lowestResalePrice ?? null,
            remaining: item.unitsAvailableForConsumption ?? null
        });
    }

    return processed;
}

console.log('[EconomyWorker] Economy worker initialized and ready');
