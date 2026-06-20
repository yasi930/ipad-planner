// 状態管理
const state = {
    currentDate: new Date(),
    selectedDate: new Date(),
    currentView: 'monthly',
    events: JSON.parse(localStorage.getItem('planner_events')) || [],
    memos: JSON.parse(localStorage.getItem('planner_memos')) || {},
    drawings: JSON.parse(localStorage.getItem('planner_drawings')) || {} // 手書きデータ(Base64)
};

// DOM要素の取得
const elements = {
    headerTitle: document.getElementById('header-title'),
    selectedDateTitle: document.getElementById('selected-date-title'),
    calendarDays: document.getElementById('calendar-days'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
    todayBtn: document.getElementById('today-btn'),
    addBtn: document.getElementById('add-btn'),
    navBtns: document.querySelectorAll('.nav-btn'),
    viewContainers: document.querySelectorAll('.view-container'),
    rightPanel: document.getElementById('right-panel'),
    rightPanelEvents: document.getElementById('right-panel-events'),
    sideMemo: document.getElementById('side-memo'),
    weeklyDaysHeader: document.getElementById('weekly-days-header'),
    timeAxis: document.getElementById('time-axis'),
    weeklyColumns: document.getElementById('weekly-columns'),
    dailyTimeline: document.getElementById('daily-timeline'),
    dailyMemo: document.getElementById('daily-memo'),
    modal: document.getElementById('event-modal'),
    closeModal: document.getElementById('close-modal'),
    cancelModal: document.getElementById('cancel-modal'),
    saveEventBtn: document.getElementById('save-event-btn'),
    eventTitle: document.getElementById('event-title'),
    eventDate: document.getElementById('event-date'),
    eventStart: document.getElementById('event-start'),
    eventEnd: document.getElementById('event-end'),
    eventDesc: document.getElementById('event-desc'),
    colorOptions: document.querySelectorAll('.color-option'),
    
    // 手書き用DOM
    dailyView: document.getElementById('daily-view'),
    toggleDrawModeBtn: document.getElementById('toggle-draw-mode'),
    dailyCanvas: document.getElementById('daily-canvas'),
    drawingTools: document.getElementById('drawing-tools'),
    toolPen: document.getElementById('tool-pen'),
    toolMarker: document.getElementById('tool-marker'),
    toolEraser: document.getElementById('tool-eraser'),
    drawingColorOptions: document.querySelectorAll('#drawing-color-picker .color-option'),
    clearCanvasBtn: document.getElementById('clear-canvas-btn')
};

let selectedColor = '#8b5cf6';

// --- 手書き (Canvas) 状態 ---
const drawState = {
    isDrawingMode: false,
    isDrawing: false,
    ctx: elements.dailyCanvas.getContext('2d'),
    tool: 'pen', // 'pen', 'marker', 'eraser'
    color: '#f8fafc',
    lastX: 0,
    lastY: 0,
    saveTimeout: null
};

// 初期化
function init() {
    setupEventListeners();
    setupCanvas();
    render();
}

// データの保存
function saveData() {
    localStorage.setItem('planner_events', JSON.stringify(state.events));
    localStorage.setItem('planner_memos', JSON.stringify(state.memos));
    localStorage.setItem('planner_drawings', JSON.stringify(state.drawings));
}

// YYYY-MM-DD
function formatDateString(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// 全体の再描画
function render() {
    renderHeader();
    
    if (state.currentView === 'monthly') {
        renderMonthlyCalendar();
        elements.rightPanel.style.display = 'flex';
    } else if (state.currentView === 'weekly') {
        renderWeeklyCalendar();
        elements.rightPanel.style.display = 'flex';
    } else if (state.currentView === 'daily') {
        renderDailyTimeline();
        elements.rightPanel.style.display = 'none';
        
        const dateStr = formatDateString(state.selectedDate);
        elements.dailyMemo.value = state.memos[dateStr] || '';
        
        // キャンバスのサイズ調整と復元
        resizeCanvas();
        loadCanvasData();
    }
    
    updateSelectedDateView();
}

// イベントリスナーの設定
function setupEventListeners() {
    elements.prevBtn.addEventListener('click', () => {
        saveCurrentCanvas(); // 移動前に保存
        if (state.currentView === 'monthly') state.currentDate.setMonth(state.currentDate.getMonth() - 1);
        else if (state.currentView === 'weekly') state.currentDate.setDate(state.currentDate.getDate() - 7);
        else if (state.currentView === 'daily') {
            state.currentDate.setDate(state.currentDate.getDate() - 1);
            state.selectedDate = new Date(state.currentDate);
        }
        render();
    });

    elements.nextBtn.addEventListener('click', () => {
        saveCurrentCanvas(); // 移動前に保存
        if (state.currentView === 'monthly') state.currentDate.setMonth(state.currentDate.getMonth() + 1);
        else if (state.currentView === 'weekly') state.currentDate.setDate(state.currentDate.getDate() + 7);
        else if (state.currentView === 'daily') {
            state.currentDate.setDate(state.currentDate.getDate() + 1);
            state.selectedDate = new Date(state.currentDate);
        }
        render();
    });

    // 今日へジャンプ
    if (elements.todayBtn) {
        elements.todayBtn.addEventListener('click', () => {
            saveCurrentCanvas();
            state.currentDate = new Date();
            state.selectedDate = new Date();
            render();
        });
    }
    
    elements.navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            saveCurrentCanvas();
            elements.navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentView = btn.dataset.view;
            elements.viewContainers.forEach(container => {
                container.classList.remove('active');
                if (container.id === `${state.currentView}-view`) container.classList.add('active');
            });
            
            // ビュー切り替え時に手書きモードをOFFにする
            if(state.currentView !== 'daily' && drawState.isDrawingMode) {
                toggleDrawingMode();
            }
            
            render();
        });
    });

    const openModal = () => {
        elements.eventDate.value = formatDateString(state.selectedDate);
        elements.eventTitle.value = '';
        elements.eventStart.value = '10:00';
        elements.eventEnd.value = '11:00';
        elements.eventDesc.value = '';
        elements.modal.classList.add('active');
        setTimeout(() => elements.eventTitle.focus(), 100);
    };
    const closeModal = () => elements.modal.classList.remove('active');
    elements.addBtn.addEventListener('click', openModal);
    elements.closeModal.addEventListener('click', closeModal);
    elements.cancelModal.addEventListener('click', closeModal);
    // モーダル背景クリックで閉じる
    elements.modal.addEventListener('click', (e) => { if (e.target === elements.modal) closeModal(); });

    elements.colorOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            elements.colorOptions.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            selectedColor = opt.dataset.color;
        });
    });

    elements.saveEventBtn.addEventListener('click', () => {
        if (!elements.eventTitle.value.trim()) return alert('タイトルを入力してください。');
        state.events.push({
            id: Date.now().toString(),
            title: elements.eventTitle.value,
            date: elements.eventDate.value,
            start: elements.eventStart.value,
            end: elements.eventEnd.value,
            color: selectedColor,
            desc: elements.eventDesc.value
        });
        saveData();
        closeModal();
        render();
    });

    elements.sideMemo.addEventListener('input', (e) => {
        state.memos[formatDateString(state.selectedDate)] = e.target.value;
        saveData();
    });
    elements.dailyMemo.addEventListener('input', (e) => {
        state.memos[formatDateString(state.selectedDate)] = e.target.value;
        saveData();
    });
}

// 予定を削除する
function deleteEvent(eventId) {
    state.events = state.events.filter(e => e.id !== eventId);
    saveData();
    render();
}

// ==========================================
// 手書き機能 (Canvas) の実装
// ==========================================
function setupCanvas() {
    // モード切替トグル
    elements.toggleDrawModeBtn.addEventListener('click', toggleDrawingMode);
    
    // ツール選択
    const tools = [{el: elements.toolPen, name: 'pen'}, {el: elements.toolMarker, name: 'marker'}, {el: elements.toolEraser, name: 'eraser'}];
    tools.forEach(t => {
        t.el.addEventListener('click', () => {
            tools.forEach(btn => btn.el.classList.remove('active'));
            t.el.classList.add('active');
            drawState.tool = t.name;
        });
    });
    
    // ペンの色選択
    elements.drawingColorOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            elements.drawingColorOptions.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            drawState.color = opt.dataset.color;
            if (drawState.tool === 'eraser') {
                tools[0].el.click(); // ペンモードに戻す
            }
        });
    });
    
    // 全消去
    elements.clearCanvasBtn.addEventListener('click', () => {
        if(confirm('この日の手書きメモをすべて消去しますか？')) {
            drawState.ctx.clearRect(0, 0, elements.dailyCanvas.width, elements.dailyCanvas.height);
            saveCurrentCanvas();
        }
    });

    // ポインターイベント (Apple Pencil / 指 / マウス 対応)
    elements.dailyCanvas.addEventListener('pointerdown', startDrawing);
    elements.dailyCanvas.addEventListener('pointermove', draw);
    window.addEventListener('pointerup', stopDrawing);
    window.addEventListener('pointercancel', stopDrawing);
    
    // タッチによるスクロールやジェスチャーを防止（iOS Safari等で手書き中のスクロールを防ぐ）
    elements.dailyCanvas.addEventListener('touchstart', (e) => {
        if (drawState.isDrawingMode) {
            e.preventDefault();
        }
    }, { passive: false });
    elements.dailyCanvas.addEventListener('touchmove', (e) => {
        if (drawState.isDrawingMode) {
            e.preventDefault();
        }
    }, { passive: false });

    // アプリ全体でのタッチスクロールを防止（iOSでのバウンススクロールや背後のスクロール判定のバグを回避）
    document.addEventListener('touchmove', (e) => {
        if (drawState.isDrawingMode) {
            // 手書きツールバーやトグルボタンは通常のタップ操作を通したい
            if (e.target.closest('#drawing-tools') || e.target.closest('#toggle-draw-mode')) {
                return;
            }
            e.preventDefault();
        }
    }, { passive: false });
    
    // ウィンドウリサイズ時の処理
    window.addEventListener('resize', () => {
        if(state.currentView === 'daily') {
            saveCurrentCanvas();
            resizeCanvas();
            loadCanvasData();
        }
    });
}

function toggleDrawingMode() {
    drawState.isDrawingMode = !drawState.isDrawingMode;
    const dailyGrid = document.querySelector('.daily-grid');
    if (drawState.isDrawingMode) {
        elements.toggleDrawModeBtn.textContent = '✍️ 手書きモード: ON';
        elements.toggleDrawModeBtn.style.background = '#ec4899'; // ピンク色で強調
        elements.dailyCanvas.classList.remove('pointer-events-none');
        elements.drawingTools.classList.remove('hidden');
        elements.dailyView.classList.add('drawing-mode-active');
        
        // 手書きモードONのときはタイムライン等のスクロール要素を非表示にし、画面を固定
        if (dailyGrid) {
            dailyGrid.style.display = 'none';
        }
    } else {
        elements.toggleDrawModeBtn.textContent = '✍️ 手書きモード: OFF';
        elements.toggleDrawModeBtn.style.background = 'var(--primary)';
        elements.dailyCanvas.classList.add('pointer-events-none');
        elements.drawingTools.classList.add('hidden');
        elements.dailyView.classList.remove('drawing-mode-active');
        
        // 再表示
        if (dailyGrid) {
            dailyGrid.style.display = '';
        }
        
        saveCurrentCanvas();
    }
}

function resizeCanvas() {
    // 親要素に合わせてキャンバスサイズを調整
    const rect = elements.dailyView.getBoundingClientRect();
    elements.dailyCanvas.width = rect.width;
    elements.dailyCanvas.height = rect.height;
}

function getPointerPos(e) {
    const rect = elements.dailyCanvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function startDrawing(e) {
    if (!drawState.isDrawingMode) return;
    drawState.isDrawing = true;
    
    // 描画が開始されたら、保留中の保存予約をキャンセル
    if (drawState.saveTimeout) {
        clearTimeout(drawState.saveTimeout);
        drawState.saveTimeout = null;
    }

    const pos = getPointerPos(e);
    drawState.lastX = pos.x;
    drawState.lastY = pos.y;
    
    // 描画設定の適用
    const ctx = drawState.ctx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (drawState.tool === 'pen') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = drawState.color;
        const pressure = e.pressure !== undefined && e.pressure > 0 ? e.pressure : 0.5;
        ctx.lineWidth = 2 + (pressure * 2);
    } else if (drawState.tool === 'marker') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = drawState.color;
        ctx.lineWidth = 20;
    } else if (drawState.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = 1.0;
        ctx.lineWidth = 30;
    }

    // タップだけでもドットを描画できるように少し描画
    ctx.beginPath();
    ctx.moveTo(drawState.lastX, drawState.lastY);
    ctx.lineTo(pos.x + 0.1, pos.y + 0.1);
    ctx.stroke();
}

function draw(e) {
    if (!drawState.isDrawing || !drawState.isDrawingMode) return;
    e.preventDefault();
    
    const ctx = drawState.ctx;
    const rect = elements.dailyCanvas.getBoundingClientRect();
    
    // getCoalescedEvents を使って Apple Pencil 等のサンプリング周波数の高い入力を補間して滑らかにする
    const events = (e.getCoalescedEvents && e.getCoalescedEvents()) || [e];
    
    ctx.beginPath();
    ctx.moveTo(drawState.lastX, drawState.lastY);
    
    let lastX = drawState.lastX;
    let lastY = drawState.lastY;
    
    for (let ev of events) {
        const x = ev.clientX - rect.left;
        const y = ev.clientY - rect.top;
        ctx.lineTo(x, y);
        lastX = x;
        lastY = y;
    }
    
    ctx.stroke();
    drawState.lastX = lastX;
    drawState.lastY = lastY;
}

function stopDrawing() {
    if (drawState.isDrawing) {
        drawState.isDrawing = false;
        // toDataURL() は非常に重いため、ペンを離すたびではなく操作停止1秒後に保存を遅延実行(デバウンス)
        if (drawState.saveTimeout) clearTimeout(drawState.saveTimeout);
        drawState.saveTimeout = setTimeout(() => {
            saveCurrentCanvas();
        }, 1000);
    }
}

function saveCurrentCanvas() {
    if (drawState.saveTimeout) {
        clearTimeout(drawState.saveTimeout);
        drawState.saveTimeout = null;
    }
    if (state.currentView !== 'daily') return;
    const dateStr = formatDateString(state.selectedDate);
    const dataUrl = elements.dailyCanvas.toDataURL('image/png');
    state.drawings[dateStr] = dataUrl;
    saveData();
}

function loadCanvasData() {
    const dateStr = formatDateString(state.selectedDate);
    const dataUrl = state.drawings[dateStr];
    drawState.ctx.clearRect(0, 0, elements.dailyCanvas.width, elements.dailyCanvas.height);
    
    if (dataUrl) {
        const img = new Image();
        img.onload = () => {
            drawState.ctx.globalCompositeOperation = 'source-over';
            drawState.ctx.globalAlpha = 1.0;
            drawState.ctx.drawImage(img, 0, 0);
        };
        img.src = dataUrl;
    }
}


// ==========================================
// 描画関連 (UI)
// ==========================================
function renderHeader() {
    const y = state.currentDate.getFullYear();
    const m = state.currentDate.getMonth() + 1;
    if (state.currentView === 'monthly') {
        elements.headerTitle.textContent = `${y}年 ${m}月`;
    } else if (state.currentView === 'weekly') {
        const startOfWeek = getStartOfWeek(state.currentDate);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
            elements.headerTitle.textContent = `${y}年 ${m}月 ${startOfWeek.getDate()}日 - ${endOfWeek.getDate()}日`;
        } else {
            elements.headerTitle.textContent = `${y}年 ${startOfWeek.getMonth()+1}月${startOfWeek.getDate()}日 - ${endOfWeek.getMonth()+1}月${endOfWeek.getDate()}日`;
        }
    } else if (state.currentView === 'daily') {
        elements.headerTitle.textContent = `${y}年 ${m}月 ${state.currentDate.getDate()}日`;
    }
}

function renderMonthlyCalendar() {
    const year = state.currentDate.getFullYear();
    const month = state.currentDate.getMonth();
    elements.calendarDays.innerHTML = '';
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayIndex = (firstDay.getDay() + 6) % 7;
    const prevLastDay = new Date(year, month, 0).getDate();
    const lastDayDate = lastDay.getDate();
    const nextDays = 42 - (firstDayIndex + lastDayDate);
    
    let html = '';
    const today = new Date();
    
    const renderDay = (y, m, d, extraClass) => {
        const dateObj = new Date(y, m, d);
        const dateStr = formatDateString(dateObj);
        const dayEvents = state.events.filter(e => e.date === dateStr);
        let dotsHtml = dayEvents.slice(0, 4).map(e => `<div class="event-dot" style="background: ${e.color}"></div>`).join('');
        if(dayEvents.length > 4) dotsHtml += '<span style="font-size:0.7rem; color:var(--text-sub)">+</span>';
        let classes = extraClass;
        if (d === today.getDate() && m === today.getMonth() && y === today.getFullYear()) classes += ' today';
        if (d === state.selectedDate.getDate() && m === state.selectedDate.getMonth() && y === state.selectedDate.getFullYear()) classes += ' active';
        
        // メモや絵がある場合はアイコンを表示
        const hasNotes = state.memos[dateStr] || state.drawings[dateStr];
        const notesIcon = hasNotes ? `<div style="font-size:0.6rem; margin-top:2px; color:var(--text-sub)">📝</div>` : '';
        
        return `
            <div class="calendar-day ${classes}" data-year="${y}" data-month="${m}" data-date="${d}">
                <div class="day-number">${d}</div>
                ${notesIcon}
                <div class="event-dots-container">${dotsHtml}</div>
            </div>
        `;
    };

    for (let x = firstDayIndex; x > 0; x--) html += renderDay(year, month - 1, prevLastDay - x + 1, 'other-month');
    for (let i = 1; i <= lastDayDate; i++) html += renderDay(year, month, i, '');
    for (let j = 1; j <= nextDays; j++) html += renderDay(year, month + 1, j, 'other-month');
    
    elements.calendarDays.innerHTML = html;
    
    document.querySelectorAll('.calendar-day').forEach(dayEl => {
        dayEl.addEventListener('click', () => {
            const y = parseInt(dayEl.dataset.year);
            const m = parseInt(dayEl.dataset.month);
            const d = parseInt(dayEl.dataset.date);
            state.selectedDate = new Date(y, m, d);
            if (m !== month) state.currentDate = new Date(y, m, d);
            render();
        });
    });
}

function renderWeeklyCalendar() {
    const startOfWeek = getStartOfWeek(state.currentDate);
    const dayNames = ['月', '火', '水', '木', '金', '土', '日'];
    const today = new Date();
    
    let headersHtml = '';
    let columnsHtml = '';
    
    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(d.getDate() + i);
        const dateStr = formatDateString(d);
        const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
        
        headersHtml += `<div class="weekly-day-header ${isToday ? 'today' : ''}"><div>${dayNames[i]}</div><div class="date">${d.getDate()}</div></div>`;
        
        const dayEvents = state.events.filter(e => e.date === dateStr);
        let eventsHtml = '';
        dayEvents.forEach(e => {
            const top = timeToPixels(e.start);
            const height = timeToPixels(e.end) - top;
            eventsHtml += `
                <div class="event-block" style="top: ${top}px; height: ${Math.max(20, height)}px; background: ${e.color}">
                    <div class="title">${e.title}</div>
                    <div class="time">${e.start}</div>
                </div>
            `;
        });
        
        columnsHtml += `<div class="weekly-col" data-date="${dateStr}">${eventsHtml}</div>`;
    }
    
    elements.weeklyDaysHeader.innerHTML = headersHtml;
    elements.weeklyColumns.innerHTML = columnsHtml;
    
    // 毎回時間軸を再生成（ビュー切り替え後のズレを防止）
    let timeHtml = '';
    for (let i = 0; i < 24; i++) timeHtml += `<div class="time-slot-label">${i}:00</div>`;
    elements.timeAxis.innerHTML = timeHtml;
    
    document.querySelectorAll('.weekly-col').forEach(col => {
        col.addEventListener('click', () => {
            state.selectedDate = new Date(col.dataset.date);
            updateSelectedDateView();
        });
    });
}

function renderDailyTimeline() {
    const dateStr = formatDateString(state.selectedDate);
    const dayEvents = state.events.filter(e => e.date === dateStr);
    
    let html = '';
    for (let i = 0; i < 24; i++) {
        html += `
            <div style="height: 60px; display: flex;">
                <div style="width: 50px; text-align: right; padding-right: 10px; color: var(--text-sub); font-size: 0.8rem; transform: translateY(-8px);">${i}:00</div>
                <div style="flex-grow: 1; border-top: 1px dashed rgba(255,255,255,0.1); position: relative;"></div>
            </div>
        `;
    }
    
    html += `<div id="daily-events-container" style="position: absolute; top: 0; left: 60px; right: 0; bottom: 0; pointer-events: none;">`;
    dayEvents.forEach(e => {
        const top = timeToPixels(e.start);
        const height = timeToPixels(e.end) - top;
        html += `
            <div class="event-block" style="top: ${top}px; height: ${Math.max(20, height)}px; background: ${e.color}; pointer-events: auto;">
                <div class="title">${e.title}</div>
                <div class="time">${e.start} - ${e.end}</div>
            </div>
        `;
    });
    html += `</div>`;
    
    elements.dailyTimeline.innerHTML = html;
}

function timeToPixels(timeStr) {
    if (!timeStr) return 0;
    const [hours, mins] = timeStr.split(':').map(Number);
    return (hours * 60) + mins;
}

function getStartOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

function updateSelectedDateView() {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const m = state.selectedDate.getMonth() + 1;
    const d = state.selectedDate.getDate();
    const dayName = days[state.selectedDate.getDay()];
    elements.selectedDateTitle.textContent = `${m}月${d}日 (${dayName})`;
    
    const dateStr = formatDateString(state.selectedDate);
    elements.sideMemo.value = state.memos[dateStr] || '';
    
    const dayEvents = state.events.filter(e => e.date === dateStr).sort((a,b) => a.start.localeCompare(b.start));
    if (dayEvents.length === 0) {
        elements.rightPanelEvents.innerHTML = `<div class="empty-state"><p>予定はありません</p></div>`;
    } else {
        elements.rightPanelEvents.innerHTML = dayEvents.map(e => `
            <div class="list-event" style="border-left-color: ${e.color}">
                <div class="event-info">
                    <div class="title">${e.title}</div>
                    <div class="time">${e.start} - ${e.end}</div>
                    ${e.desc ? `<div class="desc">${e.desc}</div>` : ''}
                </div>
                <button class="delete-event-btn" data-id="${e.id}" title="削除">🗑️</button>
            </div>
        `).join('');

        // 削除ボタンのイベントを設定
        document.querySelectorAll('.delete-event-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('この予定を削除しますか？')) {
                    deleteEvent(btn.dataset.id);
                }
            });
        });
    }
}

// 起動
init();
