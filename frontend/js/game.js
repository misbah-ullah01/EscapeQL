const API_BASE = window.location.origin.includes('3001')
    ? `${window.location.origin}/api`
    : 'http://localhost:3001/api';
let gameState = null;
let currentBustAttempts = 0;
const MAX_ATTEMPTS = 7;

async function checkAuth() {
    try {
        const res = await fetch(`${API_BASE}/game/status`, {
            credentials: 'include'
        });
        if (res.status === 401) {
            window.location.href = 'index.html';
            return;
        }
        gameState = await res.json();
        document.getElementById('player-name').innerText = gameState.player.username;
        renderGameState();
        fetchRoomHints(gameState.player.currentRoom);
    } catch (err) {
        console.error(err);
    }
}

function renderGameState() {
    // Rooms
    const displayRooms = ['Lobby', 'Corridor', 'Vault', 'Server Room', 'Escape'];
    const backendRooms = ['lobby', 'corridor', 'vault', 'server_room', 'escape'];
    const roomNav = document.getElementById('room-nav');
    roomNav.innerHTML = '';
    
    let currentIndex = backendRooms.indexOf(gameState.player.currentRoom);
    if (currentIndex === -1 && gameState.player.escaped) currentIndex = backendRooms.length;
    else if (currentIndex === -1) currentIndex = 0;
    
    // Progress
    const progress = Math.round((currentIndex / displayRooms.length) * 100);
    document.getElementById('progress-percent').innerText = `${progress}%`;
    document.getElementById('progress-bar').style.width = `${progress}%`;

    displayRooms.forEach((room, index) => {
        const div = document.createElement('div');
        div.className = 'border-b border-green-900 border-dashed flex items-center p-4 w-full font-code-terminal uppercase text-xs font-bold tracking-widest transition-all ';
        
        let icon = '';
        if (index < currentIndex) {
            div.classList.add('text-green-800', 'opacity-50', 'cursor-not-allowed');
            icon = 'check_circle';
            div.innerHTML = `<span class="material-symbols-outlined mr-3 text-sm">${icon}</span> ${room} [completed]`;
        } else if (index === currentIndex) {
            div.classList.add('bg-primary-container', 'text-black', 'phosphor-glow');
            icon = 'play_arrow';
            div.innerHTML = `<span class="material-symbols-outlined mr-3 text-sm">${icon}</span> ${room} [current]`;
        } else {
            div.classList.add('text-green-800', 'hover:bg-green-900/30', 'hover:text-primary-container', 'cursor-not-allowed');
            icon = 'lock';
            div.innerHTML = `<span class="material-symbols-outlined mr-3 text-sm">${icon}</span> ${room} [locked]`;
        }
        roomNav.appendChild(div);
    });

    // Keys
    const fragments = gameState.rooms.filter(r => r.completed && r.name !== 'lobby' && r.name !== 'escape');
    const maxFragments = 4;
    document.getElementById('fragment-count').innerText = `${fragments.length}/${maxFragments}`;
    const fragGrid = document.getElementById('fragments-grid');
    fragGrid.innerHTML = '';
    
    for (let i = 0; i < maxFragments; i++) {
        const div = document.createElement('div');
        div.className = 'aspect-square border flex items-center justify-center ';
        if (i < fragments.length) {
            div.className += 'border-primary-container bg-primary-container/20 phosphor-glow';
            div.innerHTML = `<span class="material-symbols-outlined text-primary-container" style="font-variation-settings: 'FILL' 1;">vpn_key</span>`;
        } else {
            div.className += 'border-green-900/30 bg-black';
            div.innerHTML = `<span class="material-symbols-outlined text-green-900/30">vpn_key</span>`;
        }
        fragGrid.appendChild(div);
    }

    // Toggle Answer vs Escape
    const answerSection = document.getElementById('answer-section');
    const escapeSection = document.getElementById('escape-section');
    if (gameState.player.currentRoom === 'escape') {
        answerSection.classList.add('hidden');
        escapeSection.classList.remove('hidden');
    } else {
        answerSection.classList.remove('hidden');
        escapeSection.classList.add('hidden');
    }
}

async function fetchRoomHints(room) {
    const guideContent = document.getElementById('room-guide-content');
    const normalizedRoom = (room || '').toString().toLowerCase();
    
    const hintsMap = {
        'lobby': [
            'INSPECT THE "doors" TABLE TO FIND THE KEYCODE FOR THE NEXT SECTOR.',
            'USE A SELECT QUERY.',
            'THE CODE FOR THE CORRIDOR MIGHT BE VISIBLE.'
        ],
        'corridor': [
            'INSPECT THE "keys" TABLE TO IDENTIFY MISSING FRAGMENTS.',
            'USE A "WHERE" CLAUSE TO FILTER DATA BY STATUS="ENCRYPTED".',
            'EXTRACT THE FRAGMENT_CODE AND ENTER IT TO UNLOCK THE VAULT.'
        ],
        'vault': [
            'THE VAULT CONTAINS SENSITIVE DATA IN THE "employees" TABLE.',
            'YOU NEED TO FIND THE ADMIN PASSWORD.',
            'CHECK FOR HIGH CLEARANCE LEVELS.'
        ],
        'server_room': [
            'THERE IS A "system_logs" TABLE.',
            'FIND THE OVERRIDE PIN IN THE LATEST ERROR LOG.',
            'ORDER BY TIMESTAMP DESC MAY HELP.'
        ],
        'escape': [
            'YOU HAVE ALL THE FRAGMENTS.',
            'COMBINE THEM IN THE CORRECT ORDER.',
            'SUBMIT THE FULL DECRYPTION STRING TO ESCAPE.'
        ]
    };

    const hints = hintsMap[normalizedRoom] || ['NO INTEL AVAILABLE FOR THIS SECTOR.'];
    let html = '<ul class="space-y-4">';
    hints.forEach((hint, idx) => {
        html += `<li class="flex gap-3">
            <span class="text-primary-container font-black">0${idx+1}</span>
            <p class="text-[11px] text-[#b9ccb2] leading-relaxed">${hint}</p>
        </li>`;
    });
    html += '</ul>';
    guideContent.innerHTML = html;
}

function appendToTerminal(html) {
    const term = document.getElementById('terminal-output');
    const div = document.createElement('div');
    div.className = 'mb-4';
    div.innerHTML = html;
    term.appendChild(div);
    term.scrollTop = term.scrollHeight;
}

async function runQuery() {
    const query = document.getElementById('sql-input').value.trim();
    if (!query) return;

    const currentRoom = gameState?.player?.currentRoom || 'lobby';
    appendToTerminal(`<div><span class="text-primary-container">prisoner@escape_room:${currentRoom.toLowerCase()}#</span> <span class="text-white">${query}</span></div>`);
    
    try {
        const res = await fetch(`${API_BASE}/query/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ sql: query })
        });
        const data = await res.json();
        
        if (res.ok) {
            if (data.rows && Array.isArray(data.rows)) {
                if (data.rows.length === 0) {
                    appendToTerminal(`<div class="text-green-900 italic">0 rows returned.</div>`);
                } else {
                    let table = `<div class="border border-primary-container mb-6 overflow-x-auto"><table class="w-full text-left text-xs uppercase"><thead class="bg-primary-container text-black"><tr>`;
                    const keys = Object.keys(data.rows[0]);
                    keys.forEach(k => {
                        table += `<th class="p-2 border-r border-black">${k}</th>`;
                    });
                    table += `</tr></thead><tbody class="text-primary-container">`;
                    data.rows.forEach(row => {
                        table += `<tr class="border-t border-green-900 border-dashed">`;
                        keys.forEach(k => {
                            table += `<td class="p-2 border-r border-green-900 border-dashed">${row[k]}</td>`;
                        });
                        table += `</tr>`;
                    });
                    table += `</tbody></table></div>`;
                    appendToTerminal(table);
                }
            } else {
                appendToTerminal(`<div class="text-primary-container">${data.message || data.command || 'Query executed.'}</div>`);
            }
        } else {
            appendToTerminal(`<div class="text-red-500">ERROR: ${data.error}</div>`);
            handleFailedAttempt();
        }
    } catch (err) {
        appendToTerminal(`<div class="text-red-500">SYSTEM ERROR: UNABLE TO EXECUTE QUERY</div>`);
        handleFailedAttempt();
    }
}

function handleFailedAttempt() {
    currentBustAttempts++;
    const warnDiv = document.getElementById('attempt-warning');
    const countSpan = document.getElementById('attempt-count');
    
    warnDiv.classList.remove('hidden');
    countSpan.innerText = currentBustAttempts;
    
    if (currentBustAttempts >= MAX_ATTEMPTS) {
        // Trigger busted logic (backend reset should also be called)
        fetch(`${API_BASE}/game/busted`, { method: 'POST', credentials: 'include' });
        document.getElementById('busted-modal').classList.remove('hidden');
    }
}

async function submitAnswer() {
    const answer = document.getElementById('answer-input').value.trim();
    if (!answer) return;

    try {
        const res = await fetch(`${API_BASE}/game/unlock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ room: gameState.player.currentRoom.toLowerCase().replace(' ', '_'), answer })
        });
        const data = await res.json();
        
        if (data && data.success) {
            document.getElementById('answer-feedback').innerHTML = `<span class="text-primary-container">ACCESS GRANTED. ADVANCING...</span>`;
            setTimeout(() => {
                document.getElementById('answer-input').value = '';
                document.getElementById('answer-feedback').innerHTML = '';
                document.getElementById('sql-input').value = '';
                document.getElementById('terminal-output').innerHTML = '<div class="text-primary-container/70">Type SQL commands below and press RUN_QUERY.</div>';
                currentBustAttempts = 0;
                document.getElementById('attempt-warning').classList.add('hidden');
                checkAuth(); // refresh state
            }, 1500);
        } else {
            document.getElementById('answer-feedback').innerHTML = `<span class="text-red-500">INCORRECT CODE.</span>`;
            handleFailedAttempt();
        }
    } catch (err) {
        document.getElementById('answer-feedback').innerHTML = `<span class="text-red-500">SYSTEM ERROR</span>`;
    }
}

async function attemptEscape() {
    const answer = document.getElementById('escape-key-input').value.trim();
    if (!answer) return;

    try {
        const res = await fetch(`${API_BASE}/game/escape`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ key: answer })
        });
        const data = await res.json();
        
        if (data && data.success) {
            document.getElementById('escape-feedback').innerHTML = `<span class="text-primary-container animate-pulse text-lg">SYSTEM COMPROMISED. ESCAPE SUCCESSFUL.</span>`;
            // You could redirect to a win page, or just reload state to see Escape complete
            setTimeout(() => {
                alert("CONGRATULATIONS. YOU HAVE ESCAPED.");
                window.location.href = 'index.html';
            }, 3000);
        } else {
            document.getElementById('escape-feedback').innerHTML = `<span class="text-red-500">DECRYPTION FAILED.</span>`;
            handleFailedAttempt();
        }
    } catch (err) {
        document.getElementById('escape-feedback').innerHTML = `<span class="text-red-500">SYSTEM ERROR</span>`;
    }
}

function insertSQL(text) {
    const input = document.getElementById('sql-input');
    input.value += text;
    input.focus();
}

async function logout() {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
    window.location.href = 'index.html';
}

function openLeaderboard() {
    document.getElementById('leaderboard-modal').classList.remove('hidden');
    fetch(`${API_BASE}/game/leaderboard`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            let html = '<table class="w-full text-left font-code-terminal"><thead><tr class="text-primary-container border-b border-primary-container/30"><th class="p-2">Rank</th><th class="p-2">Hacker</th><th class="p-2">Time</th></tr></thead><tbody>';
            data.forEach((r, idx) => {
                html += `<tr class="border-b border-green-900/30">
                    <td class="p-2 text-green-700">0${idx + 1}</td>
                    <td class="p-2 text-primary-container font-bold">${r.username}</td>
                    <td class="p-2 text-[#b9ccb2]">${r.total_time || 'n/a'}</td>
                </tr>`;
            });
            html += '</tbody></table>';
            document.getElementById('leaderboard-body').innerHTML = html;
        });
}

function closeLeaderboard() {
    document.getElementById('leaderboard-modal').classList.add('hidden');
}

// Init
window.onload = checkAuth;
