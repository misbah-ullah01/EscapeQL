const API_BASE = window.location.origin.includes('3001')
    ? `${window.location.origin}/api`
    : 'http://localhost:3001/api';

let prisonerPoller = null;
let attemptPoller = null;

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
    fetchAttemptTelemetry();

    if (prisonerPoller) clearInterval(prisonerPoller);
    if (attemptPoller) clearInterval(attemptPoller);

    prisonerPoller = setInterval(fetchPrisonerData, 5000);
    attemptPoller = setInterval(fetchAttemptTelemetry, 2500);
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

async function fetchAttemptTelemetry() {
    try {
        const res = await fetch(`${API_BASE}/warden/attempts`, { credentials: 'include' });
        if (!res.ok) {
            if (res.status === 401) window.location.reload();
            return;
        }

        const data = await res.json();
        const summary = data.summary || {};
        const recent = Array.isArray(data.recent) ? data.recent : [];

        document.getElementById('stat-total-attempts').innerText = summary.total_attempts || 0;
        document.getElementById('stat-correct-attempts').innerText = summary.correct_attempts || 0;
        document.getElementById('stat-wrong-attempts').innerText = summary.wrong_attempts || 0;

        const summaryHtml = [
            `<div class="flex justify-between"><span>Total attempts</span><span class="text-amber-500 font-bold">${summary.total_attempts || 0}</span></div>`,
            `<div class="flex justify-between"><span>Correct</span><span class="text-green-400 font-bold">${summary.correct_attempts || 0}</span></div>`,
            `<div class="flex justify-between"><span>Wrong</span><span class="text-red-400 font-bold">${summary.wrong_attempts || 0}</span></div>`
        ].join('');
        const summaryBox = document.getElementById('warden-attempt-summary');
        if (summaryBox) {
            summaryBox.innerHTML = summaryHtml;
        }

        let feedHtml = '';
        recent.forEach(row => {
            const statusClass = row.correct ? 'text-green-400' : 'text-red-400';
            const statusLabel = row.correct ? 'CORRECT' : 'WRONG';
            feedHtml += `<div class="border-b border-amber-900/10 pb-2">
                <div class="flex items-center justify-between gap-2">
                    <span class="text-amber-500 font-bold">${row.username}</span>
                    <span class="${statusClass} font-bold">${statusLabel}</span>
                </div>
                <div class="text-amber-700">${row.room_name} :: ${row.submitted}</div>
                <div class="text-[10px] text-amber-900">${new Date(row.attempted_at).toLocaleString()}</div>
            </div>`;
        });

        if (!recent.length) {
            feedHtml = '<div class="text-amber-500 italic">No attempts recorded yet.</div>';
        }

        const activityFeed = document.getElementById('activity-feed');
        if (activityFeed) {
            activityFeed.innerHTML = feedHtml;
        }
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
            fetchAttemptTelemetry();
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
            fetchAttemptTelemetry();
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
