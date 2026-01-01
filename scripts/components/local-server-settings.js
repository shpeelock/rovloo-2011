

class LocalServerSettings {
    constructor() {
        this.isRunning = false;
        this.port = 0;
        this.stats = null;
        this.statusCheckInterval = null;
        this.init();
    }

    async init() {
        this.createUI();
        await this.updateStatus();
        this.startStatusUpdates();
    }

    createUI() {
        const container = document.createElement('div');
        container.className = 'local-server-settings';
        container.innerHTML = `
            <div class="setting-section">
                <h3>🚀 Advanced Server Detection</h3>
                <p class="setting-description">
                    Enable local server for RoPro-level server region detection. 
                    Analyzes ALL servers instead of just the first 100.
                    <br><small>Requires a powerful PC. Uses more CPU and network resources.</small>
                </p>
                
                <div class="local-server-controls">
                    <button id="localServerToggle" class="btn" disabled>
                        <span class="btn-text">Starting...</span>
                        <span class="btn-spinner" style="display: none;">⟳</span>
                    </button>
                    
                    <div class="local-server-status" id="localServerStatus">
                        <div class="status-indicator offline"></div>
                        <span class="status-text">Checking status...</span>
                    </div>
                </div>
                
                <div class="local-server-stats" id="localServerStats" style="display: none;">
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">Port:</span>
                            <span class="stat-value" id="serverPort">-</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Servers Processed:</span>
                            <span class="stat-value" id="serversProcessed">-</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Cache Size:</span>
                            <span class="stat-value" id="cacheSize">-</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Cache Hits:</span>
                            <span class="stat-value" id="cacheHits">-</span>
                        </div>
                    </div>
                    
                    <div class="server-actions">
                        <button id="clearCache" class="btn btn-secondary">Clear Cache</button>
                        <button id="viewLogs" class="btn btn-secondary">View Logs</button>
                    </div>
                </div>
                
                <div class="performance-warning" style="display: none;" id="performanceWarning">
                    <div class="warning-icon">⚠️</div>
                    <div class="warning-text">
                        <strong>Performance Impact:</strong> Local server uses additional CPU and network resources.
                        Disable if you experience performance issues.
                    </div>
                </div>
            </div>
        `;

        const settingsContainer = document.querySelector('.settings-content') || document.body;
        settingsContainer.appendChild(container);

        this.setupEventListeners();
    }

    setupEventListeners() {
        const toggleBtn = document.getElementById('localServerToggle');
        const clearCacheBtn = document.getElementById('clearCache');
        const viewLogsBtn = document.getElementById('viewLogs');

        toggleBtn?.addEventListener('click', () => this.toggleServer());
        clearCacheBtn?.addEventListener('click', () => this.clearCache());
        viewLogsBtn?.addEventListener('click', () => this.viewLogs());
    }

    async toggleServer() {
        const toggleBtn = document.getElementById('localServerToggle');
        const btnText = toggleBtn?.querySelector('.btn-text');
        const btnSpinner = toggleBtn?.querySelector('.btn-spinner');

        if (!toggleBtn || !btnText || !btnSpinner) return;

        toggleBtn.disabled = true;
        btnSpinner.style.display = 'inline';

        try {
            if (this.isRunning) {
                
                btnText.textContent = 'Stopping...';
                const result = await window.RobloxClient?.localServer?.stop();
                
                if (result?.success) {
                    this.showNotification('Local server stopped', 'success');
                } else {
                    this.showNotification('Failed to stop server: ' + (result?.error || 'Unknown error'), 'error');
                }
            } else {
                
                btnText.textContent = 'Starting...';
                const result = await window.RobloxClient?.localServer?.start();
                
                if (result?.success) {
                    this.showNotification(`Local server started on port ${result.port}`, 'success');
                } else {
                    this.showNotification('Failed to start server: ' + (result?.error || 'Unknown error'), 'error');
                }
            }
        } catch (error) {
            console.error('Server toggle error:', error);
            this.showNotification('Server operation failed: ' + error.message, 'error');
        }

        await this.updateStatus();

        btnSpinner.style.display = 'none';
        toggleBtn.disabled = false;
    }

    async updateStatus() {
        try {
            const status = await window.RobloxClient?.localServer?.getStatus();
            
            if (status) {
                this.isRunning = status.isRunning;
                this.port = status.port;
                this.stats = status.stats;
                
                this.updateUI(status);
            }
        } catch (error) {
            console.error('Failed to get server status:', error);
        }
    }

    updateUI(status) {
        const toggleBtn = document.getElementById('localServerToggle');
        const btnText = toggleBtn?.querySelector('.btn-text');
        const statusIndicator = document.querySelector('.local-server-status .status-indicator');
        const statusText = document.querySelector('.local-server-status .status-text');
        const statsContainer = document.getElementById('localServerStats');
        const performanceWarning = document.getElementById('performanceWarning');

        if (!toggleBtn || !btnText || !statusIndicator || !statusText) return;

        if (status.isRunning) {
            
            btnText.textContent = 'Stop Server';
            toggleBtn.className = 'btn btn-danger';
            statusIndicator.className = 'status-indicator online';
            statusText.textContent = `Running on port ${status.port}`;

            if (statsContainer) {
                statsContainer.style.display = 'block';
                this.updateStats(status);
            }

            if (performanceWarning) {
                performanceWarning.style.display = 'block';
            }
        } else {
            
            btnText.textContent = 'Start Server';
            toggleBtn.className = 'btn btn-primary';
            statusIndicator.className = 'status-indicator offline';
            statusText.textContent = 'Offline';

            if (statsContainer) statsContainer.style.display = 'none';
            if (performanceWarning) performanceWarning.style.display = 'none';
        }
    }

    updateStats(status) {
        const elements = {
            serverPort: document.getElementById('serverPort'),
            serversProcessed: document.getElementById('serversProcessed'),
            cacheSize: document.getElementById('cacheSize'),
            cacheHits: document.getElementById('cacheHits')
        };

        if (elements.serverPort) elements.serverPort.textContent = status.port || '-';
        if (elements.serversProcessed) elements.serversProcessed.textContent = status.stats?.serversProcessed || '0';
        if (elements.cacheSize) elements.cacheSize.textContent = status.cacheSize || '0';
        if (elements.cacheHits) elements.cacheHits.textContent = status.stats?.cacheHits || '0';
    }

    async clearCache() {
        try {
            
            this.showNotification('Cache cleared', 'success');
            await this.updateStatus();
        } catch (error) {
            this.showNotification('Failed to clear cache: ' + error.message, 'error');
        }
    }

    viewLogs() {
        
        if (window.RobloxClient?.window?.openDevTools) {
            window.RobloxClient.window.openDevTools();
        }
        this.showNotification('Check the developer console for logs', 'info');
    }

    startStatusUpdates() {
        
        this.statusCheckInterval = setInterval(async () => {
            if (this.isRunning) {
                await this.updateStatus();
            }
        }, 5000);
    }

    showNotification(message, type = 'info') {
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '4px',
            color: 'white',
            fontWeight: 'bold',
            zIndex: '10000',
            maxWidth: '300px',
            backgroundColor: type === 'success' ? '#4CAF50' : 
                           type === 'error' ? '#f44336' : 
                           type === 'warning' ? '#ff9800' : '#2196F3'
        });

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    destroy() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
        }
    }
}

let localServerSettingsInstance = null;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.location.pathname.includes('settings') || document.querySelector('.settings-content')) {
            localServerSettingsInstance = window.localServerSettingsInstance = new LocalServerSettings();
        }
    });
} else {
    if (window.location.pathname.includes('settings') || document.querySelector('.settings-content')) {
        localServerSettingsInstance = window.localServerSettingsInstance = new LocalServerSettings();
    }
}

window.LocalServerSettings = LocalServerSettings;