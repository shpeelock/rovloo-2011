

function initNavigation() {
    
    document.querySelectorAll('#MainNav a[data-page]').forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            let page = link.dataset.page;
            
            if (window.clearSubNavActive) window.clearSubNavActive();

            if (page === 'home') {
                try {
                    const isLoggedIn = await window.RobloxClient.auth.isLoggedIn();
                    if (isLoggedIn) {
                        page = 'myroblox';
                        
                        setTimeout(() => {
                            if (window.setSubNavActiveByPage) window.setSubNavActiveByPage('myroblox');
                        }, 100);
                    }
                } catch (e) {
                    
                }
            }

            navigateTo(page);
        });
    });

    initSubNav();

    const gamesToggle = document.getElementById('gamesMenuToggle');
    const genreDropdown = document.querySelector('.dropdownnavcontainer');

    if (gamesToggle && genreDropdown) {
        
        document.addEventListener('click', (e) => {
            if (!genreDropdown.contains(e.target) && e.target !== gamesToggle) {
                genreDropdown.style.display = 'none';
                gamesToggle.style.backgroundPosition = '0 0';
            }
        });
    }

    document.querySelectorAll('.dropdownmainnav div[data-genre]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const genre = item.dataset.genre;
            selectGenre(genre);
        });
    });

    document.querySelectorAll('.dropdownmainnav div[data-sort]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const sort = item.dataset.sort;
            selectSort(sort);
        });
    });

    document.getElementById('Logo')?.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo('home');
    });

    document.getElementById('LoginLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        showLoginModal();
    });

    document.getElementById('btnLogin')?.addEventListener('click', (e) => {
        e.preventDefault();
        doLogin();
    });
}

function selectGenre(genre) {
    
    const dropdown = document.querySelector('.dropdownnavcontainer');
    const toggle = document.getElementById('gamesMenuToggle');
    if (dropdown) dropdown.style.display = 'none';
    if (toggle) toggle.style.backgroundPosition = '0 0';

    navigateTo('games', { genre });
}

function selectSort(sort) {
    
    const dropdown = document.querySelector('.dropdownnavcontainer');
    const toggle = document.getElementById('gamesMenuToggle');
    if (dropdown) dropdown.style.display = 'none';
    if (toggle) toggle.style.backgroundPosition = '0 0';

    navigateTo('games', { sort });
}

let twoStepVerificationData = null;

const ROBLOX_ARKOSE_PUBLIC_KEY = '476068BF-9607-4799-B53D-966BE98E2B81';
const ROBLOX_ARKOSE_HOST = 'roblox-api.arkoselabs.com';
let arkoseEnforcement = null;
let arkoseSdkLoaded = false;
let captchaToken = null;
let captchaMetadata = null;
let captchaChallengeId = null;

window.setupRobloxEnforcement = function(myEnforcement) {
    console.log('Arkose enforcement object received');
    arkoseEnforcement = myEnforcement;

    if (captchaMetadata && captchaMetadata.dataExchangeBlob) {
        runArkoseChallenge();
    }
};

function runArkoseChallenge() {
    if (!arkoseEnforcement || !captchaMetadata) {
        console.error('Cannot run challenge: missing enforcement or metadata');
        return;
    }

    console.log('Running Arkose challenge with blob:', captchaMetadata.dataExchangeBlob?.substring(0, 50) + '...');

    arkoseEnforcement.setConfig({
        mode: 'inline',
        selector: '#captchaWidget',
        data: { blob: captchaMetadata.dataExchangeBlob },
        onCompleted: function(response) {
            console.log('CAPTCHA completed, token received:', response.token?.substring(0, 50) + '...');
            captchaToken = response.token;
            
            hideCaptchaChallenge();
            retryLoginWithCaptcha();
        },
        onReady: function() {
            console.log('CAPTCHA widget ready');
        },
        onShown: function() {
            console.log('CAPTCHA widget shown');
        },
        onError: function(error) {
            console.error('CAPTCHA error:', error);
            const errorEl = document.getElementById('loginError');
            errorEl.textContent = 'CAPTCHA error occurred. Please try again.';
            errorEl.style.display = 'block';
            hideCaptchaChallenge();
        },
        onSuppress: function() {
            console.log('CAPTCHA suppressed (auto-passed)');
            
            if (arkoseEnforcement.getToken) {
                captchaToken = arkoseEnforcement.getToken();
                if (captchaToken) {
                    hideCaptchaChallenge();
                    retryLoginWithCaptcha();
                }
            }
        }
    });

    arkoseEnforcement.run();
}

function loadArkoseSdk() {
    return new Promise((resolve, reject) => {
        if (arkoseSdkLoaded && arkoseEnforcement) {
            resolve(arkoseEnforcement);
            return;
        }

        const existingScript = document.querySelector('script[data-callback="setupRobloxEnforcement"]');
        if (existingScript) {
            existingScript.remove();
            arkoseSdkLoaded = false;
            arkoseEnforcement = null;
        }

        const script = document.createElement('script');
        script.src = `https://${ROBLOX_ARKOSE_HOST}/v2/${ROBLOX_ARKOSE_PUBLIC_KEY}/api.js`;
        script.setAttribute('data-callback', 'setupRobloxEnforcement');
        script.async = true;

        script.onload = () => {
            console.log('Arkose SDK script loaded');
            arkoseSdkLoaded = true;
            
            resolve();
        };

        script.onerror = () => {
            console.error('Failed to load Arkose SDK');
            reject(new Error('Failed to load CAPTCHA SDK'));
        };

        document.head.appendChild(script);
    });
}

async function showCaptchaChallenge(metadata) {
    console.log('showCaptchaChallenge called with metadata:', JSON.stringify(metadata, null, 2));

    captchaMetadata = metadata;
    captchaChallengeId = metadata.unifiedCaptchaId || metadata.genericChallengeId;

    const captchaContainer = document.getElementById('captchaContainer');
    const captchaWidget = document.getElementById('captchaWidget');

    captchaWidget.innerHTML = '';

    captchaContainer.style.display = 'block';

    try {
        
        await loadArkoseSdk();

        if (arkoseEnforcement) {
            runArkoseChallenge();
        }
    } catch (error) {
        console.error('Failed to load CAPTCHA SDK:', error);
        const errorEl = document.getElementById('loginError');
        errorEl.textContent = 'Failed to load CAPTCHA. Please try again.';
        errorEl.style.display = 'block';
    }
}

function hideCaptchaChallenge() {
    const captchaContainer = document.getElementById('captchaContainer');
    captchaContainer.style.display = 'none';
}

async function retryLoginWithCaptcha() {
    if (!captchaToken || !captchaMetadata) {
        console.error('Missing CAPTCHA token or metadata');
        return;
    }

    const username = document.getElementById('usernameInput').value.trim();
    const password = document.getElementById('passwordInput').value;
    const errorEl = document.getElementById('loginError');
    const successEl = document.getElementById('loginSuccess');

    errorEl.style.display = 'none';

    try {

        const captchaData = {
            challengeId: captchaChallengeId || captchaMetadata.unifiedCaptchaId || captchaMetadata.sharedParameters?.genericChallengeId || '',
            captchaId: captchaMetadata.unifiedCaptchaId || '',
            captchaToken: captchaToken,
            captchaProvider: 'PROVIDER_ARKOSE_LABS'
        };

        console.log('Retrying login with CAPTCHA data:', {
            challengeId: captchaData.challengeId,
            captchaId: captchaData.captchaId,
            captchaToken: captchaData.captchaToken?.substring(0, 50) + '...',
            captchaProvider: captchaData.captchaProvider
        });
        const result = await window.RobloxClient.auth.login(username, password, captchaData);

        if (result.success) {
            if (result.requiresTwoStep) {
                
                twoStepVerificationData = result.twoStepData;
                document.getElementById('loginFormContainer').style.display = 'none';
                document.getElementById('twoStepContainer').style.display = 'block';
                document.getElementById('loginBtn').style.display = 'none';
                document.getElementById('twoStepBtn').style.display = 'inline-block';
                document.getElementById('twoStepCode').focus();
            } else {
                
                const user = await window.RobloxClient.api.getCurrentUser();
                successEl.textContent = `Logged in as ${user.displayName || user.name}!`;
                successEl.style.display = 'block';
                updateAuthUI(user);

                setTimeout(() => {
                    hideLoginModal();
                    loadHomePage();
                }, 1500);
            }
        } else {
            errorEl.textContent = result.error || 'Login failed after CAPTCHA';
            errorEl.style.display = 'block';
        }
    } catch (error) {
        console.error('Retry login error:', error);
        errorEl.textContent = 'Login failed. Please try again.';
        errorEl.style.display = 'block';
    } finally {
        
        captchaToken = null;
        captchaMetadata = null;
    }
}

function showLoginModal() {
    
    if (window.RobloxClient && window.RobloxClient.auth && window.RobloxClient.auth.returnToHub) {
        window.RobloxClient.auth.returnToHub();
    }
}

function hideLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function toggleCookieLogin() {
    const browserContainer = document.getElementById('browserLoginContainer');
    const cookieContainer = document.getElementById('cookieLoginContainer');

    if (cookieContainer.style.display === 'none') {
        if (browserContainer) browserContainer.style.display = 'none';
        cookieContainer.style.display = 'block';
    } else {
        if (browserContainer) browserContainer.style.display = 'block';
        cookieContainer.style.display = 'none';
    }
}

async function doLogin() {
    const errorEl = document.getElementById('loginError');
    const successEl = document.getElementById('loginSuccess');
    const loginBtn = document.getElementById('loginBtn');

    const cookieContainer = document.getElementById('cookieLoginContainer');
    if (cookieContainer.style.display !== 'none') {
        return doCookieLogin();
    }

    const username = document.getElementById('usernameInput').value.trim();
    const password = document.getElementById('passwordInput').value;

    if (!username || !password) {
        errorEl.textContent = 'Please enter both username and password';
        errorEl.style.display = 'block';
        successEl.style.display = 'none';
        return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = 'Logging in...';
    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    try {
        const result = await window.RobloxClient.auth.login(username, password);

        if (result.success) {
            if (result.requiresTwoStep) {
                
                twoStepVerificationData = result.twoStepData;
                document.getElementById('loginFormContainer').style.display = 'none';
                document.getElementById('twoStepContainer').style.display = 'block';
                document.getElementById('loginBtn').style.display = 'none';
                document.getElementById('twoStepBtn').style.display = 'inline-block';
                document.getElementById('twoStepCode').focus();
            } else {
                
                const user = await window.RobloxClient.api.getCurrentUser();
                successEl.textContent = `Logged in as ${user.displayName || user.name}!`;
                successEl.style.display = 'block';
                updateAuthUI(user);
                updateHeaderStatsBox(user.id, true);

                setTimeout(() => {
                    hideLoginModal();
                    loadHomePage();
                }, 1500);
            }
        } else if (result.requiresCaptcha) {
            
            console.log('CAPTCHA challenge required - offering browser login');
            errorEl.innerHTML = `
                <strong>CAPTCHA Required</strong><br>
                Roblox requires verification. Click below to login securely:<br><br>
                <button onclick="doBrowserLogin()" style="padding: 8px 16px; background: #00a2ff; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                    Login with Roblox
                </button>
            `;
            errorEl.style.display = 'block';
        } else if (result.rateLimited) {
            errorEl.textContent = result.error;
            errorEl.style.display = 'block';
        } else {
            errorEl.textContent = result.error || 'Login failed';
            errorEl.style.display = 'block';
        }
    } catch (error) {
        console.error('Login error:', error);
        errorEl.textContent = 'Network error. Please try again.';
        errorEl.style.display = 'block';
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Login';
    }
}

async function verifyTwoStepCode() {
    const errorEl = document.getElementById('loginError');
    const successEl = document.getElementById('loginSuccess');
    const twoStepBtn = document.getElementById('twoStepBtn');
    const code = document.getElementById('twoStepCode').value.trim();

    if (!code || code.length !== 6) {
        errorEl.textContent = 'Please enter a valid 6-digit code';
        errorEl.style.display = 'block';
        return;
    }

    if (!twoStepVerificationData) {
        errorEl.textContent = 'Two-step verification session expired. Please login again.';
        errorEl.style.display = 'block';
        return;
    }

    twoStepBtn.disabled = true;
    twoStepBtn.textContent = 'Verifying...';
    errorEl.style.display = 'none';

    try {
        const result = await window.RobloxClient.auth.verifyTwoStep(
            twoStepVerificationData.ticket,
            code,
            twoStepVerificationData.challengeId
        );

        if (result.success) {
            const user = await window.RobloxClient.api.getCurrentUser();
            successEl.textContent = `Logged in as ${user.displayName || user.name}!`;
            successEl.style.display = 'block';
            updateAuthUI(user);
            updateHeaderStatsBox(user.id, true);

            setTimeout(() => {
                hideLoginModal();
                loadHomePage();
            }, 1500);
        } else {
            errorEl.textContent = result.error || 'Verification failed';
            errorEl.style.display = 'block';
        }
    } catch (error) {
        console.error('Two-step verification error:', error);
        errorEl.textContent = 'Verification failed. Please try again.';
        errorEl.style.display = 'block';
    } finally {
        twoStepBtn.disabled = false;
        twoStepBtn.textContent = 'Verify';
    }
}

async function doBrowserLogin() {
    const errorEl = document.getElementById('loginError');
    const successEl = document.getElementById('loginSuccess');
    const browserLoginBtn = document.getElementById('browserLoginBtn');

    errorEl.style.display = 'none';
    if (browserLoginBtn) {
        browserLoginBtn.disabled = true;
        browserLoginBtn.textContent = 'Opening browser...';
    }

    try {
        console.log('Opening browser login window...');
        const result = await window.RobloxClient.auth.browserLogin();

        if (result.success) {
            
            const user = await window.RobloxClient.api.getCurrentUser();
            if (user && user.name) {
                successEl.textContent = `Logged in as ${user.displayName || user.name}!`;
                successEl.style.display = 'block';
                updateAuthUI(user);
                updateHeaderStatsBox(user.id, true);

                setTimeout(() => {
                    hideLoginModal();
                    loadHomePage();
                }, 1500);
            } else {
                throw new Error('Failed to verify login');
            }
        } else {
            errorEl.textContent = result.error || 'Login cancelled';
            errorEl.style.display = 'block';
        }
    } catch (error) {
        console.error('Browser login error:', error);
        errorEl.textContent = 'Login failed. Please try again.';
        errorEl.style.display = 'block';
    } finally {
        if (browserLoginBtn) {
            browserLoginBtn.disabled = false;
            browserLoginBtn.textContent = '🔐 Login with Roblox';
        }
    }
}

async function doCookieLogin() {
    const cookieInput = document.getElementById('cookieInput');
    const errorEl = document.getElementById('loginError');
    const successEl = document.getElementById('loginSuccess');
    const cookieLoginBtn = document.getElementById('cookieLoginBtn');

    const cookie = cookieInput?.value.trim();

    if (!cookie) {
        errorEl.textContent = 'Please enter your .ROBLOSECURITY cookie';
        errorEl.style.display = 'block';
        successEl.style.display = 'none';
        return;
    }

    let cleanCookie = cookie;
    if (cleanCookie.startsWith('.ROBLOSECURITY=')) {
        cleanCookie = cleanCookie.substring('.ROBLOSECURITY='.length);
    }

    if (cookieLoginBtn) {
        cookieLoginBtn.disabled = true;
        cookieLoginBtn.textContent = 'Logging in...';
    }
    errorEl.style.display = 'none';

    try {
        await window.RobloxClient.auth.setCookie(cleanCookie);
        const user = await window.RobloxClient.api.getCurrentUser();

        if (user && user.name) {
            successEl.textContent = `Logged in as ${user.displayName || user.name}!`;
            successEl.style.display = 'block';
            updateAuthUI(user);
            updateHeaderStatsBox(user.id, true);

            setTimeout(() => {
                hideLoginModal();
                loadHomePage();
            }, 1500);
        } else {
            throw new Error('Failed to verify login');
        }
    } catch (error) {
        console.error('Cookie login failed:', error);
        errorEl.textContent = 'Login failed. Please check your cookie and try again.';
        errorEl.style.display = 'block';
        
    } finally {
        if (cookieLoginBtn) {
            cookieLoginBtn.disabled = false;
            cookieLoginBtn.textContent = 'Login with Cookie';
        }
    }
}

async function updateAuthUI(user) {
    const authSpan = document.getElementById('AuthenticationBannerSpan');
    if (!authSpan) return;
    
    if (user) {
        authSpan.className = 'logged-in';
        authSpan.innerHTML = `
            <span class="auth-username">Hi, ${user.displayName || user.name}</span>
            <a href="#" class="auth-hub-btn" onclick="doLogout(); return false;">Return To Hub</a>
        `;
    } else {
        authSpan.className = '';
        authSpan.innerHTML = '<a href="#" id="LoginLink">Login</a>';
        
        document.getElementById('LoginLink')?.addEventListener('click', (e) => {
            e.preventDefault();
            showLoginModal();
        });
    }
}

async function doLogout() {

    await window.RobloxClient.auth.returnToHub();
}

async function checkLoginState() {
    try {
        const isLoggedIn = await window.RobloxClient.auth.isLoggedIn();
        if (isLoggedIn) {
            const user = await window.RobloxClient.api.getCurrentUser();
            if (user && user.name) {
                updateAuthUI(user);
                
                updateHeaderStatsBox(user.id, true);
                
                return true;
            }
        } else {
            
            updateHeaderStatsBox(null, false);
        }
        return false;
    } catch (error) {
        console.log('Not logged in or error checking login state');
        updateHeaderStatsBox(null, false);
        return false;
    }
}

async function updateHeaderStatsBox(userId, isLoggedIn) {
    const statsBox = document.getElementById('header-stats-box');
    const signupBtn = document.getElementById('signup-button-container');
    
    if (isLoggedIn && userId) {
        
        if (statsBox) statsBox.style.display = 'block';
        if (signupBtn) signupBtn.style.display = 'none';

        try {
            
            const friendsCount = await window.roblox.getFriendsCount(userId).catch(() => ({ count: 0 }));
            const friendsEl = document.getElementById('header-friends-count');
            if (friendsEl) friendsEl.innerHTML = `<b>${friendsCount.count || 0}</b>`;

            const messagesEl = document.getElementById('header-messages-count');
            if (messagesEl) {
                try {
                    const unreadCount = await window.roblox.getUnreadMessagesCount();
                    messagesEl.innerHTML = `<b>${unreadCount.count || 0}</b>`;
                } catch (e) {
                    messagesEl.innerHTML = '<b>0</b>';
                }
            }

            const robuxEl = document.getElementById('header-robux-count');
            if (robuxEl) {
                try {
                    const currency = await window.roblox.getUserCurrency(userId);
                    robuxEl.innerHTML = `<b>${(currency.robux || 0).toLocaleString()}</b>`;
                } catch (e) {
                    robuxEl.innerHTML = '<b>0</b>';
                }
            }

            const rovlooScoreEl = document.getElementById('header-rovloo-score');
            if (rovlooScoreEl) {
                try {
                    const rating = await window.roblox.reviews.getUserRating(userId);
                    const score = rating?.totalScore || 0;
                    const scoreText = score >= 0 ? `+${score}` : score.toString();
                    rovlooScoreEl.innerHTML = `<b>${scoreText}</b>`;
                    rovlooScoreEl.title = `Rovloo Score: ${scoreText} (${rating?.reviewCount || 0} reviews)`;
                } catch (e) {
                    rovlooScoreEl.innerHTML = '<b>0</b>';
                }
            }
        } catch (e) {
            console.warn('Failed to load header stats:', e);
        }
    } else {
        
        if (statsBox) statsBox.style.display = 'none';
        if (signupBtn) signupBtn.style.display = 'block';
    }
}

async function updateSubNavVisibility(isLoggedIn, currentPage, params = {}) {
    const subNav = document.getElementById('SubNav');
    if (!subNav) return;

    const myRobloxPages = ['myroblox', 'inbox', 'account', 'character', 'stuff', 'sets', 'groups', 'money', 'advertising', 'ambassadors', 'share', 'places'];

    if (!currentPage) {
        const activePage = document.querySelector('.page.active');
        currentPage = activePage ? activePage.id.replace('page-', '') : 'home';
    }

    let isMyRobloxSection = myRobloxPages.includes(currentPage);
    
    if ((currentPage === 'profile' || currentPage === 'friends') && isLoggedIn) {
        
        try {
            const currentUser = await window.RobloxClient.api.getCurrentUser();
            const viewingUserId = params.userId ? String(params.userId) : null;
            if (viewingUserId && currentUser && String(currentUser.id) === viewingUserId) {
                isMyRobloxSection = true;
            }
        } catch (e) {
            
        }
    }
    
    if (isLoggedIn && isMyRobloxSection) {
        subNav.style.display = 'block';
    } else {
        subNav.style.display = 'none';
    }
}

function clearSubNavActive() {
    const subNav = document.getElementById('SubNav');
    if (!subNav) return;
    subNav.querySelectorAll('li').forEach(li => li.classList.remove('active'));
}

function setSubNavActiveByPage(pageName) {
    const subNav = document.getElementById('SubNav');
    if (!subNav) return;

    subNav.querySelectorAll('li').forEach(li => li.classList.remove('active'));

    const link = subNav.querySelector(`a[data-page="${pageName}"]`);
    if (link) {
        const parentLi = link.closest('li');
        if (parentLi) parentLi.classList.add('active');
    }
}

window.updateSubNavVisibility = updateSubNavVisibility;
window.clearSubNavActive = clearSubNavActive;
window.setSubNavActiveByPage = setSubNavActiveByPage;

async function refreshHeaderRobux() {
    const robuxEl = document.getElementById('header-robux-count');
    if (!robuxEl) return;
    
    try {
        const user = await window.RobloxClient.api.getCurrentUser();
        if (user && user.id) {
            const currency = await window.roblox.getUserCurrency(user.id);
            robuxEl.innerHTML = `<b>${(currency.robux || 0).toLocaleString()}</b>`;
        }
    } catch (e) {
        console.warn('Failed to refresh Robux count:', e);
    }
}
window.refreshHeaderRobux = refreshHeaderRobux;

function initSubNav() {
    const subNav = document.getElementById('SubNav');
    if (!subNav) return;

    function setSubNavActive(clickedLink) {
        
        subNav.querySelectorAll('li').forEach(li => li.classList.remove('active'));
        
        const parentLi = clickedLink.closest('li');
        if (parentLi) parentLi.classList.add('active');
    }

    subNav.querySelectorAll('a[data-page]').forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const page = link.dataset.page;

            setSubNavActive(link);

            switch (page) {
                case 'myroblox':
                    
                    navigateTo('myroblox');
                    break;
                case 'character':
                    
                    navigateTo('character');
                    break;
                case 'account':
                    
                    navigateTo('account');
                    break;
                case 'inbox':
                    
                    navigateTo('inbox');
                    break;
                case 'places':
                    
                    window.open('https://www.roblox.com/develop', '_blank');
                    break;
                case 'stuff':
                    
                    try {
                        const user = await window.RobloxClient.api.getCurrentUser();
                        if (user && user.id) {
                            navigateTo('stuff', { userId: user.id });
                        }
                    } catch (err) {
                        console.error('Could not get current user for stuff:', err);
                    }
                    break;
                case 'groups':
                    
                    navigateTo('groups');
                    break;
                case 'money':
                    
                    window.open('https://www.roblox.com/transactions', '_blank');
                    break;
                default:
                    
                    console.log('SubNav page not implemented:', page);
            }
        });
    });

    subNav.querySelectorAll('a[data-subnav]').forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const action = link.dataset.subnav;

            setSubNavActive(link);
            
            switch (action) {
                case 'profile':
                    
                    try {
                        const user = await window.RobloxClient.api.getCurrentUser();
                        if (user && user.id) {
                            navigateTo('profile', { userId: user.id });
                        }
                    } catch (err) {
                        console.error('Could not get current user for profile:', err);
                    }
                    break;
                case 'friends':
                    
                    try {
                        const user = await window.RobloxClient.api.getCurrentUser();
                        if (user && user.id) {
                            navigateTo('friends', { userId: user.id });
                        }
                    } catch (err) {
                        console.error('Could not get current user for friends:', err);
                    }
                    break;
            }
        });
    });
}


// Titlebar navigation buttons
function initTitlebarNavigation() {
    const btnBack = document.getElementById('btn-back');
    const btnForward = document.getElementById('btn-forward');

    if (btnBack) {
        btnBack.addEventListener('click', function() {
            window.history.back();
        });
    }

    if (btnForward) {
        btnForward.addEventListener('click', function() {
            window.history.forward();
        });
    }

    // Update button states based on history
    updateNavigationButtonStates();
    window.addEventListener('load', updateNavigationButtonStates);
    window.addEventListener('popstate', updateNavigationButtonStates);
}

function updateNavigationButtonStates() {
    const btnBack = document.getElementById('btn-back');
    const btnForward = document.getElementById('btn-forward');

    if (btnBack) {
        btnBack.disabled = false;
    }

    if (btnForward) {
        btnForward.disabled = false;
    }
}

// Keyboard shortcuts for navigation
document.addEventListener('keydown', function(e) {
    // Alt+Left for back
    if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        window.history.back();
    }
    // Alt+Right for forward
    if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        window.history.forward();
    }
});

// Initialize titlebar navigation when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTitlebarNavigation);
} else {
    initTitlebarNavigation();
}
