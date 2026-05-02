const API_BASE = window.location.origin.includes('3001')
    ? `${window.location.origin}/api`
    : 'http://localhost:3001/api';

// Time update
setInterval(() => {
    const now = new Date();
    
    const pad = n => n.toString().padStart(2, '0');
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}:${pad(Math.floor(now.getMilliseconds()/10))}`;
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;

    const sysTime = document.getElementById('sys-time');
    if (sysTime) sysTime.innerText = timeStr;
    
    const camTime = document.getElementById('cam-time');
    if (camTime) camTime.innerText = `${dateStr} ${timeStr.substring(0, 8)}`;
}, 100);

// Check Session on Load
window.onload = async () => {
    try {
        const res = await fetch(`${API_BASE}/warden/status`, { credentials: 'include' });
        if (res.ok) {
            showDashboard();
        }
    } catch (err) {
        // Not logged in or error
    }
};

async function handleWardenLogin(e) {
    e.preventDefault();
    const u = document.getElementById('warden-username').value;
    const p = document.getElementById('warden-password').value;
    const feedback = document.getElementById('warden-login-feedback');
    
    try {
        const res = await fetch(`${API_BASE}/warden/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include',
            body: JSON.stringify({username: u, password: p})
        });
        const data = await res.json();
        
        if (res.ok) {
            feedback.innerHTML = '<span class="text-green-500 font-bold tracking-widest">ACCESS GRANTED. INITIALIZING DASHBOARD...</span>';
            setTimeout(() => {
                showDashboard();
            }, 1000);
        } else {
            feedback.innerText = `ACCESS DENIED: ${data.error || data.message || 'Invalid Credentials'}`;
        }
    } catch (err) {
        feedback.innerText = 'SYSTEM ERROR';
    }
}

async function wardenLogout() {
    await fetch(`${API_BASE}/warden/logout`, {method: 'POST', credentials: 'include'});
    window.location.reload();
}

function showDashboard() {
    document.getElementById('warden-login-view').classList.add('hidden');
    document.getElementById('warden-dashboard-view').classList.remove('hidden');
    fetchPrisonerData();
    setInterval(fetchPrisonerData, 5000); // Polling every 5s
}

async function fetchPrisonerData() {
    try {
        const res = await fetch(`${API_BASE}/warden/prisoners`, { credentials: 'include' });
        if (!res.ok) {
            if (res.status === 401) window.location.reload();
            return;
        }
        const data = await res.json();
        document.getElementById('stat-active').innerText = data.length;
        
        let html = '';
        let feedHtml = '';
        data.forEach(p => {
            html += `<tr class="hover:bg-amber-500/5 transition-colors group">
                <td class="p-4 font-bold text-amber-500">${p.username}</td>
                <td class="p-4">${p.current_room}</td>
                <td class="p-4">${p.attempts || 0}</td>
                <td class="p-4">${p.keys_collected ? p.keys_collected.length : 0}</td>
                <td class="p-4"><button onclick="resetPrisoner('${p.username}')" class="px-2 py-1 border border-red-500 text-red-500 text-[10px] font-bold hover:bg-red-500 hover:text-white transition-all">RESET</button></td>
            </tr>`;
            
            feedHtml += `<div class="flex gap-3">
                <span class="text-amber-900">[SYS]</span>
                <p class="text-amber-500"><span class="font-bold">${p.username}:</span> LOCATED IN ${p.current_room.toUpperCase()}</p>
            </div>`;
        });
        
        if (data.length === 0) {
            html = `<tr><td colspan="5" class="p-4 text-center text-amber-900 italic">No active prisoners.</td></tr>`;
        }
        
        document.getElementById('prisoner-table-body').innerHTML = html;
        document.getElementById('activity-feed').innerHTML = feedHtml;
    } catch (err) {
        console.error(err);
    }
}

async function resetPrisoner(username) {
    if (!confirm(`Are you sure you want to reset prisoner ${username}?`)) return;
    try {
        const res = await fetch(`${API_BASE}/warden/reset-prisoner`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include',
            body: JSON.stringify({username})
        });
        if (res.ok) {
            alert(`Prisoner ${username} reset successfully.`);
            fetchPrisonerData();
        }
    } catch (err) {
        alert('Failed to reset prisoner.');
    }
}

async function resetAllGameSessions() {
    if (!confirm('CRITICAL WARNING: This will reset ALL prisoner progress. Proceed?')) return;
    try {
        const res = await fetch(`${API_BASE}/warden/reset-all`, { method: 'POST', credentials: 'include' });
        if (res.ok) {
            alert('ALL SESSIONS RESET.');
            fetchPrisonerData();
        }
    } catch (err) {
        alert('Failed to reset sessions.');
    }
}

function emergencyLockdown() {
    alert("EMERGENCY LOCKDOWN INITIATED. ALL DOORS SECURED.");
    // UI Only for effect
    document.body.style.filter = "sepia(100%) hue-rotate(-50deg) saturate(300%)";
    setTimeout(() => { document.body.style.filter = ""; }, 3000);
}
