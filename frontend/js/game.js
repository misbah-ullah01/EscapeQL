const API_BASE = window.location.origin.includes('3001')
    ? `${window.location.origin}/api`
    : 'http://localhost:3001/api';
let gameState = null;
let currentBustAttempts = 0;
const MAX_ATTEMPTS = 7;
const roomHintState = {};

function normalizeSchemaName(room) {
    return (room || 'lobby').toString().toLowerCase().replace(/\s+/g, '_');
}

function titleCaseSchema(schema) {
    return schema
        .toString()
        .replace(/_/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
}

function getHintsForRoom(room) {
    const hintsMap = {
        'lobby': [
            '<strong>Goal:</strong> Find the lobby passphrase in <code>lobby.hint_board</code> after inspecting the staff directory.',
            '<strong>Steps:</strong> 1) Inspect the <code>lobby.staff_directory</code> table. 2) Look for the special row for <code>Marcus Void</code>. 3) Read <code>lobby.hint_board</code> to get the passphrase and submit it.',
            '<strong>Example SQL:</strong><pre class="bg-black p-2 rounded text-xs text-primary-container">SELECT * FROM lobby.staff_directory WHERE name = \'Marcus Void\';\nSELECT * FROM lobby.hint_board WHERE staff_name = \'Marcus Void\';</pre>'
        ],
        'corridor': [
            '<strong>Goal:</strong> Find the hidden door code in <code>corridor.door_log</code> and confirm it with the maintenance note.',
            '<strong>Steps:</strong> 1) Check <code>corridor.camera_feeds</code> to see which door is missing. 2) Query <code>corridor.door_log</code> for <code>door_id = 7</code>. 3) Read <code>corridor.maintenance_notes</code> for the decommissioned door code and submit it.',
            '<strong>Example SQL:</strong><pre class="bg-black p-2 rounded text-xs text-primary-container">SELECT * FROM corridor.camera_feeds;\nSELECT * FROM corridor.door_log WHERE door_id = 7;\nSELECT * FROM corridor.maintenance_notes WHERE door_id = 7;</pre>'
        ],
        'vault': [
            '<strong>Goal:</strong> Find the consistent box code in <code>vault.safety_deposit_boxes</code>.',
            '<strong>Steps:</strong> 1) Query rows for <code>T. Anderson</code>. 2) Compare the repeated records and find the one that matches the puzzle clue. 3) Submit the box code that appears in the correct row.',
            '<strong>Example SQL:</strong><pre class="bg-black p-2 rounded text-xs text-primary-container">SELECT * FROM vault.safety_deposit_boxes WHERE owner_name = \'T. Anderson\';</pre>'
        ],
        'server_room': [
            '<strong>Goal:</strong> Fix the broken trigger in <code>server_room.unlock_hatch()</code> so the hatch opens.',
            '<strong>Steps:</strong> 1) Inspect the trigger definition and notice the renamed column mismatch. 2) Replace <code>clearance_id</code> with <code>auth_id</code>. 3) Insert an authorized log row to open the hatch, then return to the game.',
            '<strong>Example SQL:</strong><pre class="bg-black p-2 rounded text-xs text-primary-container">SELECT pg_get_functiondef(\'server_room.unlock_hatch()\'::regproc);\n\nCREATE OR REPLACE FUNCTION server_room.unlock_hatch()\nRETURNS TRIGGER AS $$\nBEGIN\n    IF NEW.status = \'AUTHORIZED\' THEN\n        UPDATE server_room.hatch\n        SET open = TRUE, last_attempt = NOW()\n        WHERE auth_id = NEW.auth_id;\n    END IF;\n    RETURN NEW;\nEND;\n$$ LANGUAGE plpgsql;</pre>'
        ],
        'escape': [
            '<strong>Goal:</strong> Assemble the final decryption key from the room fragments and unlock the escape message.',
            '<strong>Steps:</strong> 1) Confirm the fragments are <code>ALPHA</code>, <code>BRAVO</code>, <code>CHARLIE</code>, and <code>DELTA</code>. 2) Join them in order with hyphens. 3) Submit the combined key in the escape box.',
            '<strong>Example:</strong><pre class="bg-black p-2 rounded text-xs text-primary-container">ALPHA-BRAVO-CHARLIE-DELTA</pre>'
        ]
    };

    return hintsMap[room] || ['NO INTEL AVAILABLE FOR THIS SECTOR.'];
}

function getVisibleHintCount(room) {
    return roomHintState[room]?.revealed || 0;
}

function setVisibleHintCount(room, count) {
    roomHintState[room] = roomHintState[room] || { revealed: 0 };
    roomHintState[room].revealed = count;
}

async function fetchSchemaTables(schema) {
    const res = await fetch(`${API_BASE}/query/tables/${schema}`, { credentials: 'include' });
    if (!res.ok) {
        throw new Error('Unable to load schema structure');
    }
    return res.json();
}

function renderSchemaStructure(schema, tables) {
    const schemaContent = document.getElementById('schema-structure-content');
    if (!schemaContent) return;

    if (!tables.length) {
        schemaContent.innerHTML = `<span class="text-green-900">No accessible tables or views in <strong>${titleCaseSchema(schema)}</strong>.</span>`;
        return;
    }

    let html = `<div class="mb-2 text-primary-container font-bold uppercase text-[10px] tracking-widest">${titleCaseSchema(schema)}</div>`;
    html += '<div class="space-y-2">';
    tables.forEach(table => {
        const badge = table.table_type === 'VIEW' ? 'VIEW' : 'TABLE';
        html += `<div class="flex items-center justify-between gap-3 border border-primary-container/10 bg-black/60 px-2 py-1 text-[11px] text-[#b9ccb2]">
            <span>${table.table_name}</span>
            <span class="text-primary-container/70">${badge}</span>
        </div>`;
    });
    html += '</div>';
    schemaContent.innerHTML = html;
}

function renderHints(room) {
    const guideContent = document.getElementById('room-guide-content');
    const hintButton = document.getElementById('hint-button');
    const hints = getHintsForRoom(room);
    const visibleCount = Math.min(getVisibleHintCount(room), hints.length);

    let html = '';
    if (visibleCount === 0) {
        html = '<p class="text-[11px] text-[#b9ccb2] leading-relaxed italic">Hints unlock after 3 wrong attempts. Use the terminal and schema structure to investigate first.</p>';
    } else {
        html = '<ul class="space-y-4">';
        for (let idx = 0; idx < visibleCount; idx++) {
            html += `<li class="flex gap-3">
                <span class="text-primary-container font-black">0${idx + 1}</span>
                <p class="text-[11px] text-[#b9ccb2] leading-relaxed">${hints[idx]}</p>
            </li>`;
        }
        html += '</ul>';
    }

    guideContent.innerHTML = html;

    if (hintButton) {
        if (currentBustAttempts >= 3 && visibleCount < hints.length) {
            hintButton.classList.remove('hidden');
            hintButton.textContent = `REVEAL_HINT_${visibleCount + 1}`;
        } else {
            hintButton.classList.add('hidden');
        }
    }
}

async function loadRoomGuide(room) {
    const schema = normalizeSchemaName(room);
    const schemaContent = document.getElementById('schema-structure-content');
    if (schemaContent) {
        schemaContent.innerHTML = '<span class="text-green-900">Loading accessible objects...</span>';
    }

    try {
        const tables = await fetchSchemaTables(schema);
        renderSchemaStructure(schema, tables);
    } catch (err) {
        if (schemaContent) {
            schemaContent.innerHTML = '<span class="text-red-500">Unable to load schema structure.</span>';
        }
    }

    renderHints(room);
}

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
        loadRoomGuide(gameState.player.currentRoom);
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
    loadRoomGuide(gameState?.player?.currentRoom || 'lobby');
    
    if (currentBustAttempts >= MAX_ATTEMPTS) {
        // Trigger busted logic (backend reset should also be called)
        fetch(`${API_BASE}/game/busted`, { method: 'POST', credentials: 'include' });
        document.getElementById('busted-modal').classList.remove('hidden');
    }
}

async function submitAnswer() {
    const answer = document.getElementById('answer-input').value.trim();
    if (!answer) return;
    const normalizedAnswer = answer.toUpperCase();

    try {
        const res = await fetch(`${API_BASE}/game/unlock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ room: gameState.player.currentRoom.toLowerCase().replace(' ', '_'), answer: normalizedAnswer })
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
                setVisibleHintCount(gameState.player.currentRoom, 0);
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
    const normalizedAnswer = answer.toUpperCase();

    try {
        const res = await fetch(`${API_BASE}/game/escape`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ key: normalizedAnswer })
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

function showNextHint() {
    const room = gameState?.player?.currentRoom || 'lobby';
    const hints = getHintsForRoom(room);
    const nextCount = Math.min(getVisibleHintCount(room) + 1, hints.length);
    setVisibleHintCount(room, nextCount);
    renderHints(room);
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
