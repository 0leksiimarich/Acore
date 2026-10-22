// ===== ІГРИ =====
const GameManager = {
    games: [
        { id: 'doom', name: '🎮 Doom 3D', desc: 'Класичний шутер' },
        { id: 'runner', name: '🏃 Runner', desc: 'Біги й стрибай' },
        { id: 'pong', name: '🏓 Pong', desc: 'Класична гра' },
        { id: 'tictac', name: '⭕ Хрестики-нолики', desc: 'Проти AI' },
        { id: 'minesweeper', name: '💣 Сапер', desc: 'Знайди мініми' }
    ],

    currentGame: null,

    init() {
        const container = document.getElementById('games-list');
        let html = '';

        this.games.forEach(game => {
            html += `
                <div style="background: white; padding: 12px; border-radius: 6px; margin-bottom: 8px; cursor: pointer; border: 1px solid #ddd; transition: all 0.2s;" onclick="GameManager.startGame('${game.id}')">
                    <div style="font-weight: bold; color: #1a4a84;">${game.name}</div>
                    <div style="font-size: 12px; color: #666;">${game.desc}</div>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    startGame(gameId) {
        const gameContainer = document.getElementById('game-container');
        
        switch(gameId) {
            case 'doom':
                gameContainer.innerHTML = '<div style="text-align: center; padding: 30px;"><p>🎮 Doom 3D завантажується...</p><p style="font-size: 12px; color: #999;">Використовуй клавіші WASD для руху</p></div>';
                break;
            case 'runner':
                gameContainer.innerHTML = '<div style="text-align: center; padding: 30px;"><p>🏃 Runner</p><p style="font-size: 12px; color: #999;">Space для стрибка!</p></div>';
                break;
            case 'pong':
                gameContainer.innerHTML = '<canvas id="pongCanvas" width="400" height="300" style="border: 1px solid #ccc;"></canvas>';
                this.startPong();
                break;
            case 'tictac':
                this.startTicTac();
                break;
            case 'minesweeper':
                this.startMinesweeper();
                break;
        }

        document.getElementById('games-list').style.display = 'none';
        gameContainer.style.display = 'block';
    },

    startPong() {
        const canvas = document.getElementById('pongCanvas');
        const ctx = canvas.getContext('2d');
        
        let game = {
            ballX: canvas.width / 2,
            ballY: canvas.height / 2,
            ballVelX: 3,
            ballVelY: 3,
            paddleY: canvas.height / 2 - 30,
            computerY: canvas.height / 2 - 30,
            score: 0,
            computerScore: 0
        };

        document.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            game.paddleY = e.clientY - rect.top - 30;
        });

        const draw = () => {
            ctx.fillStyle = '#f4f5f7';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            //球
            ctx.fillStyle = '#1a4a84';
            ctx.fillRect(game.ballX - 5, game.ballY - 5, 10, 10);

            // Гравець
            ctx.fillStyle = '#1a4a84';
            ctx.fillRect(10, game.paddleY, 10, 60);

            // AI
            ctx.fillStyle = '#dc3545';
            ctx.fillRect(canvas.width - 20, game.computerY, 10, 60);

            // Рахунок
            ctx.fillStyle = '#333';
            ctx.font = '14px Arial';
            ctx.fillText(`You: ${game.score}`, 20, 20);
            ctx.fillText(`AI: ${game.computerScore}`, canvas.width - 80, 20);
        };

        const update = () => {
            game.ballX += game.ballVelX;
            game.ballY += game.ballVelY;

            if (game.ballY < 0 || game.ballY > canvas.height) {
                game.ballVelY *= -1;
            }

            if (game.ballX < 30 && game.ballY > game.paddleY && game.ballY < game.paddleY + 60) {
                game.ballVelX *= -1;
                game.score++;
            }

            if (game.ballX > canvas.width - 30 && game.ballY > game.computerY && game.ballY < game.computerY + 60) {
                game.ballVelX *= -1;
                game.computerScore++;
            }

            if (game.computerY + 30 < game.ballY) {
                game.computerY += 2;
            } else {
                game.computerY -= 2;
            }

            if (game.ballX < 0 || game.ballX > canvas.width) {
                game.ballX = canvas.width / 2;
                game.ballY = canvas.height / 2;
            }
        };

        const gameLoop = () => {
            update();
            draw();
            requestAnimationFrame(gameLoop);
        };

        gameLoop();
    },

    startTicTac() {
        const container = document.getElementById('game-container');
        let board = Array(9).fill('');
        let currentPlayer = 'X';
        let gameOver = false;

        const winConditions = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
        ];

        const checkWin = () => {
            for (let combo of winConditions) {
                if (board[combo[0]] && board[combo[0]] === board[combo[1]] && board[combo[0]] === board[combo[2]]) {
                    return board[combo[0]];
                }
            }
            return null;
        };

        const render = () => {
            let html = '<div style="display: grid; grid-template-columns: repeat(3, 60px); gap: 5px; margin: 20px 0;">';
            
            board.forEach((cell, i) => {
                html += `<button style="width: 60px; height: 60px; font-size: 24px; cursor: pointer; background: #f0f0f0; border: 1px solid #ccc;" onclick="GameManager.makeMove(${i})">${cell}</button>`;
            });

            html += '</div>';
            html += `<div style="text-align: center; margin: 15px 0;">
                <div id="status" style="font-size: 14px; font-weight: bold; color: #1a4a84;">Твій хід (X)</div>
                <button onclick="GameManager.resetTicTac()" style="margin-top: 10px;">🔄 Нова гра</button>
            </div>`;

            container.innerHTML = html;

            const winner = checkWin();
            if (winner) {
                document.getElementById('status').innerText = winner === 'X' ? '✅ Ти переміг!' : '❌ AI переміг!';
                gameOver = true;
            } else if (board.every(cell => cell)) {
                document.getElementById('status').innerText = '🤝 Нічия!';
                gameOver = true;
            }
        };

        window.GameManager.makeMove = (i) => {
            if (board[i] || gameOver) return;
            board[i] = 'X';

            if (!checkWin() && !board.every(cell => cell)) {
                const empty = board.map((cell, i) => cell === '' ? i : null).filter(i => i !== null);
                if (empty.length > 0) {
                    board[empty[Math.floor(Math.random() * empty.length)]] = 'O';
                }
            }

            render();
        };

        window.GameManager.resetTicTac = () => {
            board = Array(9).fill('');
            currentPlayer = 'X';
            gameOver = false;
            render();
        };

        render();
    },

    startMinesweeper() {
        const container = document.getElementById('game-container');
        const size = 8;
        const mines = 10;
        let board = Array(size * size).fill(0);
        let revealed = Array(size * size).fill(false);
        let flagged = Array(size * size).fill(false);

        // Розставити мініми
        let mineCount = 0;
        while (mineCount < mines) {
            const pos = Math.floor(Math.random() * (size * size));
            if (board[pos] !== 'M') {
                board[pos] = 'M';
                mineCount++;
            }
        }

        // Підрахувати цифри
        for (let i = 0; i < size * size; i++) {
            if (board[i] === 'M') continue;
            let count = 0;
            const row = Math.floor(i / size);
            const col = i % size;

            for (let r = -1; r <= 1; r++) {
                for (let c = -1; c <= 1; c++) {
                    const nr = row + r;
                    const nc = col + c;
                    if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
                        if (board[nr * size + nc] === 'M') count++;
                    }
                }
            }
            if (count > 0) board[i] = count;
        }

        const render = () => {
            let html = '<div style="display: grid; grid-template-columns: repeat(' + size + ', 30px); gap: 2px; margin: 20px 0;">';

            for (let i = 0; i < size * size; i++) {
                let content = '';
                if (revealed[i]) {
                    if (board[i] === 'M') {
                        content = '💣';
                    } else if (board[i] > 0) {
                        content = board[i];
                    }
                } else if (flagged[i]) {
                    content = '🚩';
                }

                html += `<button style="width: 30px; height: 30px; padding: 0; font-size: 12px; cursor: pointer; background: ${revealed[i] ? '#f0f0f0' : '#ddd'};" onclick="GameManager.revealCell(${i})" oncontextmenu="GameManager.flagCell(${i}); return false;">${content}</button>`;
            }

            html += '</div>';
            html += '<button onclick="GameManager.backToGames()" style="margin-top: 10px;">← Назад</button>';
            container.innerHTML = html;
        };

        window.GameManager.revealCell = (i) => {
            if (revealed[i] || flagged[i]) return;
            revealed[i] = true;
            if (board[i] === 'M') {
                alert('💥 Гра закінчена!');
                board.forEach((cell, idx) => { if (cell === 'M') revealed[idx] = true; });
            }
            render();
        };

        window.GameManager.flagCell = (i) => {
            if (revealed[i]) return;
            flagged[i] = !flagged[i];
            render();
        };

        render();
    },

    backToGames() {
        document.getElementById('game-container').style.display = 'none';
        document.getElementById('games-list').style.display = 'block';
    }
};
