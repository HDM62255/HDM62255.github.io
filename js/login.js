/**
 * Login Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    const loginOverlay = document.getElementById('login-overlay');
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const loginError = document.getElementById('login-error');
    const mainContentElements = document.querySelectorAll('body > *:not(#login-overlay):not(script)');

    // Credentials
    const USERS = {
        'admin': '51423',
        'Jotin': 'Jotin2403',
        'Juli': 'Jul1'
    };

    // 1. Check Session
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        hideLogin(false); // Hide immediately
    } else {
        // Show Login (it is visible by display:flex in CSS, but we ensure content is blurred/hidden)
        // Ideally CSS handles the initial state.
        usernameInput.focus();
    }

    // 2. Handle Submit
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const u = usernameInput.value.trim();
        const p = passwordInput.value.trim();

        if (USERS[u] && USERS[u] === p) {
            // Success
            sessionStorage.setItem('isLoggedIn', 'true');
            hideLogin(true);
        } else {
            // Error
            showError();
        }
    });

    function hideLogin(animate) {
        if (animate) {
            loginOverlay.style.opacity = '0';
            setTimeout(() => {
                loginOverlay.style.display = 'none';
            }, 500); // Match transition duration
        } else {
            loginOverlay.style.display = 'none';
        }
    }

    function showError() {
        loginError.classList.remove('d-none');
        // Shake animation
        const card = document.querySelector('.login-card');
        card.classList.add('shake');
        setTimeout(() => {
            card.classList.remove('shake');
        }, 500);
    }

    // 3. Handle Logout
    const logoutBtn = document.getElementById('btnLogout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('isLoggedIn');
            location.reload(); // Reload to reset app state and show login
        });
    }
});
