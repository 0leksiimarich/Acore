/* Ігри проти ШІ: Пінг-Понг, Хрестики-нулики, Сапер, Runner, Mini Doom. */
(function () {
    'use strict';
    const A = window.Acore;
    const $ = id => document.getElementById(id);
    let stopCurrent = null;

    function area() { return $('game-board-area'); }

    function canvas(w, h) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.className = 'game-canvas';
        return c;
    }

    // Цикл кадрів; повертає функцію зупинки
    function loop(step) {
        let raf = 0, last = performance.now(), alive = true;
        const tick = now => {
            if (!alive) return;
            const dt = Math.min(0.05, (now - last) / 1000);
            last = now;
            step(dt);
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => { alive = false; cancelAnimationFrame(raf); };
    }

    /* ---------- Пінг-Понг ---------- */
    function pong(root) {
        const W = 320, H = 200;
        const c = canvas(W, H), g = c.getContext('2d');
        const info = A.h('div', { class: 'game-controls' });
        root.append(info, c);
        const s = { p: H / 2, a: H / 2, x: W / 2, y: H / 2, vx: 150, vy: 80, pl: 0, ai: 0 };
        const aim = e => {
            const r = c.getBoundingClientRect();
            const t = e.touches ? e.touches[0] : e;
            s.p = A.clamp((t.clientY - r.top) * H / r.height, 0, H);
        };
        c.addEventListener('mousemove', aim);
        c.addEventListener('touchmove', e => { e.preventDefault(); aim(e); }, { passive: false });
        const serve = dir => { s.x = W / 2; s.y = H / 2; s.vx = 150 * dir; s.vy = (Math.random() * 2 - 1) * 90; };
        return loop(dt => {
            s.a += A.clamp(s.y - s.a, -160 * dt, 160 * dt);
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            if (s.y < 4 || s.y > H - 4) s.vy = -s.vy;
            if (s.vx < 0 && s.x < 18 && Math.abs(s.y - s.p) < 26) s.vx = -s.vx * 1.05;
            if (s.vx > 0 && s.x > W - 18 && Math.abs(s.y - s.a) < 26) s.vx = -s.vx * 1.05;
            if (s.x < 0) { s.ai++; serve(-1); }
            if (s.x > W) { s.pl++; serve(1); }
            g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
            g.fillStyle = '#fff';
            g.fillRect(6, s.p - 20, 6, 40);
            g.fillRect(W - 12, s.a - 20, 6, 40);
            g.fillRect(s.x - 3, s.y - 3, 6, 6);
            info.textContent = 'Ви ' + s.pl + ' : ' + s.ai + ' ШІ · рухайте мишкою або пальцем';
        });
    }

    /* ---------- Хрестики-нулики ---------- */
    function ttt(root) {
        const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
        let b = Array(9).fill('');
        const info = A.h('div', { class: 'game-controls' });
        const grid = A.h('div', { class: 'ttt-grid' });
        root.append(info, grid);

        const result = bd => {
            for (const [i, j, k] of LINES) if (bd[i] && bd[i] === bd[j] && bd[i] === bd[k]) return bd[i];
            return bd.includes('') ? null : 'draw';
        };
        const pick = () => {
            const need = p => {
                for (const L of LINES) {
                    const v = L.map(i => b[i]);
                    if (v.filter(x => x === p).length === 2 && v.includes('')) return L[v.indexOf('')];
                }
                return -1;
            };
            let i = need('⭕');
            if (i < 0) i = need('❌');
            if (i < 0 && !b[4]) i = 4;
            if (i < 0) {
                const free = b.map((v, k) => (v ? -1 : k)).filter(k => k >= 0);
                i = free[Math.floor(Math.random() * free.length)];
            }
            return i;
        };
        const paint = () => {
            grid.textContent = '';
            b.forEach((v, i) => grid.appendChild(A.h('button', { class: 'ttt-cell', type: 'button', text: v, onclick: () => play(i) })));
            const r = result(b);
            info.textContent = !r ? 'Ви — ❌, ШІ — ⭕'
                : r === 'draw' ? 'Нічия! Клік по клітинці — нова гра'
                : (r === '❌' ? 'Ви перемогли!' : 'ШІ переміг.') + ' Клік по клітинці — нова гра';
        };
        const play = i => {
            if (result(b)) { b = Array(9).fill(''); paint(); return; }
            if (b[i]) return;
            b[i] = '❌';
            if (!result(b)) b[pick()] = '⭕';
            paint();
        };
        paint();
    }

    /* ---------- Сапер ---------- */
    function mines(root) {
        const N = 8, M = 10;
        const bar = A.h('div', { class: 'game-controls' });
        const grid = A.h('div', { class: 'mines-grid' });
        root.append(bar, grid);
        let cells = [], over = false;

        const near = i => {
            const r = Math.floor(i / N), c = i % N, out = [];
            for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
                const rr = r + dr, cc = c + dc;
                if ((dr || dc) && rr >= 0 && rr < N && cc >= 0 && cc < N) out.push(rr * N + cc);
            }
            return out;
        };
        const paint = msg => {
            bar.textContent = '';
            bar.append(A.h('span', { text: msg || 'Сапер 8×8, 10 мін' }),
                A.h('button', { class: 'btn-reset-game', type: 'button', text: 'Нова', onclick: () => start() }));
            grid.textContent = '';
            cells.forEach((c, i) => {
                const btn = A.h('button', { class: 'mines-cell' + (c.open ? ' revealed' : ''), type: 'button' });
                btn.textContent = c.flag ? '🚩' : !c.open ? '' : c.mine ? '💣' : (c.n ? String(c.n) : '');
                btn.addEventListener('click', () => reveal(i));
                btn.addEventListener('contextmenu', e => {
                    e.preventDefault();
                    if (!over && !c.open) { c.flag = !c.flag; paint(); }
                });
                grid.appendChild(btn);
            });
        };
        const reveal = i => {
            const c = cells[i];
            if (over || c.open || c.flag) return;
            c.open = true;
            if (c.mine) {
                over = true;
                cells.forEach(x => { if (x.mine) x.open = true; });
                return paint('Міна! Гра закінчена.');
            }
            if (c.n === 0) near(i).forEach(reveal);
            if (cells.every(x => x.mine || x.open)) { over = true; return paint('Ви перемогли!'); }
            paint();
        };
        const start = () => {
            over = false;
            cells = Array.from({ length: N * N }, () => ({ mine: false, open: false, flag: false, n: 0 }));
            let left = M;
            while (left) {
                const i = Math.floor(Math.random() * N * N);
                if (!cells[i].mine) { cells[i].mine = true; left--; }
            }
            cells.forEach((c, i) => { c.n = near(i).filter(j => cells[j].mine).length; });
            paint();
        };
        start();
    }

    /* ---------- Runner ---------- */
    function runner(root) {
        const W = 320, H = 200, GY = 180;
        const c = canvas(W, H), g = c.getContext('2d');
        const info = A.h('div', { class: 'game-controls', text: 'Клік або пробіл — стрибок' });
        root.append(info, c);
        let y = GY, vy = 0, obs = [], dist = 0, speed = 180, over = false;

        const reset = () => { y = GY; vy = 0; obs = []; dist = 0; speed = 180; over = false; };
        const jump = () => {
            if (over) { reset(); return; }
            if (y >= GY) vy = -420;
        };
        const onKey = e => { if (e.code === 'Space') { e.preventDefault(); jump(); } };
        c.addEventListener('mousedown', jump);
        c.addEventListener('touchstart', e => { e.preventDefault(); jump(); }, { passive: false });
        window.addEventListener('keydown', onKey);

        const stopLoop = loop(dt => {
            if (!over) {
                dist += dt * 10;
                speed += dt * 6;
                vy += 1400 * dt;
                y = Math.min(GY, y + vy * dt);
                if (y >= GY) vy = 0;
                if (!obs.length || obs[obs.length - 1].x < W - 140 - Math.random() * 120) obs.push({ x: W + 10 });
                obs.forEach(o => { o.x -= speed * dt; });
                obs = obs.filter(o => o.x > -20);
                if (obs.some(o => o.x < 46 && o.x + 14 > 30 && y > GY - 26)) over = true;
            }
            g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
            g.fillStyle = '#333'; g.fillRect(0, GY, W, 2);
            g.fillStyle = '#1a4a84'; g.fillRect(30, y - 24, 16, 24);
            g.fillStyle = '#c00';
            obs.forEach(o => g.fillRect(o.x, GY - 26, 14, 26));
            info.textContent = (over ? 'Програли! Клік — заново. ' : '') + 'Рахунок: ' + Math.floor(dist);
        });
        return () => { stopLoop(); window.removeEventListener('keydown', onKey); };
    }

    /* ---------- Mini Doom (псевдо-3D, ходьба) ---------- */
    const MAP = [
        '########',
        '#......#',
        '#..##..#',
        '#......#',
        '#.#....#',
        '#.#..#.#',
        '#......#',
        '########'
    ];

    function doom(root) {
        const W = 320, H = 200;
        const c = canvas(W, H), g = c.getContext('2d');
        root.appendChild(c);
        const p = { x: 1.5, y: 1.5, a: 0.3 };
        const keys = {};
        const kd = e => { keys[e.key.toLowerCase()] = true; };
        const ku = e => { keys[e.key.toLowerCase()] = false; };
        window.addEventListener('keydown', kd);
        window.addEventListener('keyup', ku);

        const wall = (x, y) => {
            const r = Math.floor(y), q = Math.floor(x);
            return !MAP[r] || MAP[r][q] === undefined || MAP[r][q] === '#';
        };

        const stopLoop = loop(dt => {
            const sp = 2.5 * dt, ro = 1.8 * dt;
            if (keys.arrowleft || keys.a) p.a -= ro;
            if (keys.arrowright || keys.d) p.a += ro;
            let mx = 0, my = 0;
            if (keys.w || keys.arrowup) { mx += Math.cos(p.a); my += Math.sin(p.a); }
            if (keys.s || keys.arrowdown) { mx -= Math.cos(p.a); my -= Math.sin(p.a); }
            const nx = p.x + mx * sp, ny = p.y + my * sp;
            if (!wall(nx, p.y)) p.x = nx;
            if (!wall(p.x, ny)) p.y = ny;

            g.fillStyle = '#222'; g.fillRect(0, 0, W, H / 2);
            g.fillStyle = '#444'; g.fillRect(0, H / 2, W, H / 2);
            const fov = Math.PI / 3;
            for (let x = 0; x < W; x++) {
                const ang = p.a - fov / 2 + fov * x / W;
                let d = 0, hit = false;
                while (!hit && d < 16) {
                    d += 0.05;
                    hit = wall(p.x + Math.cos(ang) * d, p.y + Math.sin(ang) * d);
                }
                const dist = d * Math.cos(ang - p.a) || 0.01;
                const h = Math.min(H, H / dist);
                const v = Math.max(40, 220 - dist * 18) | 0;
                g.fillStyle = 'rgb(' + v + ',' + Math.round(v * 0.6) + ',' + Math.round(v * 0.3) + ')';
                g.fillRect(x, (H - h) / 2, 1, h);
            }
        });
        return () => {
            stopLoop();
            window.removeEventListener('keydown', kd);
            window.removeEventListener('keyup', ku);
        };
    }

    /* ---------- Керування ---------- */
    const GAMES = { pong, ttt, mines, runner, doom };

    window.switchGame = function () {
        if (stopCurrent) { stopCurrent(); stopCurrent = null; }
        const root = area();
        if (!root) return;
        root.textContent = '';
        const fn = GAMES[$('game-select-choice').value];
        if (!fn) { root.textContent = 'Оберіть гру зі списку вище'; return; }
        const cleanup = fn(root);
        if (typeof cleanup === 'function') stopCurrent = cleanup;
    };

    window.GameManager = {
        init() {
            const root = area();
            if (root) root.textContent = 'Оберіть гру зі списку вище';
        }
    };
})();
