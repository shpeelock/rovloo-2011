
(function() {
    'use strict';

    let bcLoaded = false;

    document.addEventListener('pageChange', function(e) {
        if (e.detail.page === 'bc' && !bcLoaded) {
            loadBCPage();
        }
    });

    async function loadBCPage() {
        const container = document.getElementById('bc-content');
        if (!container) return;

        try {
            
            const response = await fetch('pages/bc.html');
            if (response.ok) {
                container.innerHTML = await response.text();
                initBCHandlers();
                updateAccountStatus();
                bcLoaded = true;
            }
        } catch (error) {
            console.error('Failed to load BC page:', error);
            if (window.showErrorPage) {
                window.showErrorPage('Failed to load Builders Club page: ' + error.message, 'bc-content');
            } else {
                container.innerHTML = '<div class="error">Failed to load Builders Club page</div>';
            }
        }
    }

    function initBCHandlers() {
        
        const membershipButtons = document.querySelectorAll('.MembershipButton');
        membershipButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const buttonDiv = this.querySelector('.upgrades_enabled');
                if (buttonDiv) {
                    const title = buttonDiv.getAttribute('title');
                    showMembershipInfo(title);
                }
            });

            btn.addEventListener('mouseenter', function() {
                this.style.transform = 'scale(1.05)';
                this.style.transition = 'transform 0.2s';
            });

            btn.addEventListener('mouseleave', function() {
                this.style.transform = 'scale(1)';
            });
        });
    }

    function showMembershipInfo(title) {

        console.log('Selected membership:', title);

        if (title) {
            alert(`${title}\n\nThis is a custom client - membership purchases are handled through the official Roblox website.`);
        }
    }

    async function updateAccountStatus() {
        const statusEl = document.getElementById('bcAccountStatus');
        if (!statusEl) return;

        if (window.robloxAPI && typeof window.robloxAPI.isAuthenticated === 'function') {
            try {
                const isAuth = await window.robloxAPI.isAuthenticated();
                if (isAuth) {
                    const userInfo = await window.robloxAPI.getCurrentUser();
                    if (userInfo) {
                        statusEl.innerHTML = `
                            <strong>Logged in as:</strong> ${userInfo.name}<br>
                            <strong>User ID:</strong> ${userInfo.id}<br>
                            <strong>Premium:</strong> ${userInfo.isPremium ? 'Yes' : 'No'}
                        `;
                        return;
                    }
                }
            } catch (error) {
                console.error('Failed to get user info:', error);
            }
        }

        statusEl.textContent = 'Login to view your membership status';
    }

    window.BCPage = {
        load: loadBCPage,
        updateStatus: updateAccountStatus
    };
})();
