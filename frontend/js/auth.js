const API_BASE = window.location.origin.includes('3001')
    ? `${window.location.origin}/api`
    : 'http://localhost:3001/api';

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const feedback = document.getElementById('login-feedback');

    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        if (res.ok) {
            feedback.innerHTML = '<span class="text-primary-container">ACCESS GRANTED. INITIALIZING...</span>';
            setTimeout(() => {
                window.location.href = 'game.html';
            }, 1000);
        } else {
            feedback.innerText = `ACCESS DENIED: ${data.error || data.message || 'Invalid credentials'}`;
        }
    } catch (err) {
        feedback.innerText = 'SYSTEM ERROR: CONNECTION REFUSED';
    }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const feedback = document.getElementById('register-feedback');

    try {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        if (res.ok) {
            feedback.innerHTML = '<span class="text-primary-container">USER REGISTERED. PLEASE LOGIN.</span>';
            setTimeout(() => {
                switchTab('login');
                document.getElementById('login-username').value = username;
                document.getElementById('login-password').value = '';
            }, 1500);
        } else {
            feedback.innerText = `REGISTRATION FAILED: ${data.error || data.message || 'Error'}`;
        }
    } catch (err) {
        feedback.innerText = 'SYSTEM ERROR: CONNECTION REFUSED';
    }
});
