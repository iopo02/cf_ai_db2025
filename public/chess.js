class ChessGame {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.board = [];
        this.turn = 'W';
        this.selectedSquare = null;
        this.validMoves = [];
        this.gameOver = false;
        this.winner = null;

        this.castlingRights = { W: { K: true, Q: true }, B: { K: true, Q: true } };
        this.enPassantTarget = null;
        this.halfMoveClock = 0;
        this.fullMoveNumber = 1;

        this.engine = null;
        this.currentEvaluation = { score: 0.0, bestMove: null };
        this.moveHistory = [];
        this.initEngine();

        this.pieceSymbols = {
            'WP': '♟', 'WR': '♜', 'WK': '♞', 'WB': '♝', 'WQ': '♛', 'WKNG': '♚',
            'BP': '♟', 'BR': '♜', 'BK': '♞', 'BB': '♝', 'BQ': '♛', 'BKNG': '♚'
        };

        this.initGame();
        this.initVoiceControl();
    }

    initEngine() {
        const stockfishUrl = 'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.0/stockfish.js';

        fetch(stockfishUrl)
            .then(response => {
                if (!response.ok) throw new Error("Network response was not ok");
                return response.blob();
            })
            .then(blob => {
                const blobUrl = URL.createObjectURL(blob);
                this.engine = new Worker(blobUrl);

                this.engine.onmessage = (event) => {
                    const line = event.data;

                    if (line.startsWith('info') && line.includes('score cp')) {
                        const match = line.match(/score cp (-?\d+)/);
                        if (match) {
                            const cp = parseInt(match[1]);
                            const score = (this.turn === 'W' ? cp : -cp) / 100;
                            this.currentEvaluation.score = score;
                            this.updateEvaluationUI();
                        }
                    }
                    if (line.startsWith('info') && line.includes('score mate')) {
                        const match = line.match(/score mate (-?\d+)/);
                        if (match) {
                            const movesToMate = parseInt(match[1]);
                            this.currentEvaluation.score = `Mate in ${Math.abs(movesToMate)} (${movesToMate > 0 ? 'Winning' : 'Losing'})`;
                            this.updateEvaluationUI();
                        }
                    }
                    if (line.startsWith('bestmove')) {
                        const match = line.match(/bestmove\s+(\S+)/);
                        if (match) {
                            this.currentEvaluation.bestMove = match[1];
                            this.updateEvaluationUI();
                        }
                    }
                };

                this.engine.postMessage('uci');
                this.analyzePosition();
            })
            .catch(err => {
                try {
                    this.engine = new Worker(stockfishUrl);
                } catch (e) {
                }
            });
    }

    analyzePosition() {
        if (!this.engine) return;
        const fen = this.toFEN();
        this.engine.postMessage('position fen ' + fen);
        this.engine.postMessage('go depth 15');
    }

    updateEvaluationUI() {
        const infoPanel = this.container.querySelector('.chess-info');
        if (infoPanel) {
            let evalText = '';
            if (typeof this.currentEvaluation.score === 'number') {
                const sign = this.currentEvaluation.score > 0 ? '+' : '';
                evalText = `Eval: ${sign}${this.currentEvaluation.score.toFixed(2)}`;
            } else {
                evalText = `Eval: ${this.currentEvaluation.score}`;
            }

            let evalEl = infoPanel.querySelector('.eval-score');

            if (!evalEl) {
                evalEl = document.createElement('span');
                evalEl.className = 'eval-score';
                evalEl.style.marginLeft = '15px';
                evalEl.style.fontWeight = 'bold';
                evalEl.style.color = 'var(--accent-color)';

                infoPanel.querySelector('p').appendChild(evalEl);
            }

            evalEl.textContent = evalText;

            const tooltipContainer = document.createElement('span');
            tooltipContainer.className = 'tooltip-container';
            tooltipContainer.style.marginLeft = '6px';
            tooltipContainer.style.opacity = '0.8';
            tooltipContainer.innerHTML = 'ⓘ<span class="tooltip-text">Positive (+) favors White<br>Negative (-) favors Black<br>+1.0 ≈ 1 pawn advantage</span>';

            evalEl.appendChild(tooltipContainer);
        }
    }

    toFEN() {
        let fen = '';
        for (let r = 0; r < 8; r++) {
            let emptyCount = 0;
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (!piece) {
                    emptyCount++;
                } else {
                    if (emptyCount > 0) {
                        fen += emptyCount;
                        emptyCount = 0;
                    }
                    const color = piece[0];
                    const type = piece.substring(1);
                    let fenChar = '';
                    switch (type) {
                        case 'P': fenChar = 'P'; break;
                        case 'R': fenChar = 'R'; break;
                        case 'K': fenChar = 'N'; break;
                        case 'B': fenChar = 'B'; break;
                        case 'Q': fenChar = 'Q'; break;
                        case 'KNG': fenChar = 'K'; break;
                    }
                    if (color === 'B') fenChar = fenChar.toLowerCase();
                    fen += fenChar;
                }
            }
            if (emptyCount > 0) fen += emptyCount;
            if (r < 7) fen += '/';
        }

        fen += ` ${this.turn.toLowerCase()} `;

        let castling = '';
        if (this.castlingRights.W.K) castling += 'K';
        if (this.castlingRights.W.Q) castling += 'Q';
        if (this.castlingRights.B.K) castling += 'k';
        if (this.castlingRights.B.Q) castling += 'q';
        if (castling === '') castling = '-';
        fen += `${castling} `;

        if (this.enPassantTarget) {
            const file = String.fromCharCode(97 + this.enPassantTarget.col);
            const rank = 8 - this.enPassantTarget.row;
            fen += `${file}${rank} `;
        } else {
            fen += '- ';
        }

        fen += `${this.halfMoveClock} ${this.fullMoveNumber}`;

        return fen;
    }

    initGame() {
        this.board = [
            ['BR', 'BK', 'BB', 'BQ', 'BKNG', 'BB', 'BK', 'BR'],
            ['BP', 'BP', 'BP', 'BP', 'BP', 'BP', 'BP', 'BP'],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null, null],
            ['WP', 'WP', 'WP', 'WP', 'WP', 'WP', 'WP', 'WP'],
            ['WR', 'WK', 'WB', 'WQ', 'WKNG', 'WB', 'WK', 'WR']
        ];
        this.turn = 'W';
        this.gameOver = false;
        this.winner = null;
        this.selectedSquare = null;
        this.validMoves = [];

        this.castlingRights = { W: { K: true, Q: true }, B: { K: true, Q: true } };
        this.enPassantTarget = null;
        this.halfMoveClock = 0;
        this.fullMoveNumber = 1;
        this.moveHistory = [];

        this.render();
        this.renderHistory();
        this.analyzePosition();
    }

    render() {
        this.container.innerHTML = '';

        if (this.gameOver) {
            const gameOverPanel = document.createElement('div');
            gameOverPanel.className = 'game-over-panel';
            gameOverPanel.style.textAlign = 'center';
            gameOverPanel.style.marginBottom = '1rem';

            const msg = document.createElement('h2');
            msg.textContent = `Checkmate! ${this.winner === 'W' ? 'White' : 'Black'} Wins!`;
            msg.style.color = 'var(--primary-color)';

            const resetBtn = document.createElement('button');
            resetBtn.textContent = 'Play Again';
            resetBtn.style.padding = '0.5rem 1rem';
            resetBtn.style.backgroundColor = 'var(--primary-color)';
            resetBtn.style.color = 'white';
            resetBtn.style.border = 'none';
            resetBtn.style.borderRadius = '4px';
            resetBtn.style.cursor = 'pointer';
            resetBtn.onclick = () => this.initGame();

            gameOverPanel.appendChild(msg);
            gameOverPanel.appendChild(resetBtn);
            this.container.appendChild(gameOverPanel);
        }

        const boardEl = document.createElement('div');
        boardEl.className = 'chess-board';

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.className = `chess-square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
                square.dataset.row = row;
                square.dataset.col = col;

                const pieceCode = this.board[row][col];

                if (this.selectedSquare && this.selectedSquare.row === row && this.selectedSquare.col === col) {
                    square.classList.add('selected');
                }

                if (this.validMoves.some(m => m.row === row && m.col === col)) {
                    const hintDiv = document.createElement('div');
                    hintDiv.className = 'valid-move-hint';
                    square.appendChild(hintDiv);
                }

                if (pieceCode) {
                    const pieceSpan = document.createElement('span');
                    pieceSpan.className = 'chess-piece';
                    pieceSpan.textContent = this.pieceSymbols[pieceCode];
                    pieceSpan.classList.add(pieceCode.startsWith('W') ? 'white-piece' : 'black-piece');
                    square.appendChild(pieceSpan);
                }

                if (col === 0) {
                    const rankLabel = document.createElement('span');
                    rankLabel.className = 'coord-rank';
                    rankLabel.textContent = 8 - row;
                    square.appendChild(rankLabel);
                }

                if (row === 7) {
                    const fileLabel = document.createElement('span');
                    fileLabel.className = 'coord-file';
                    fileLabel.textContent = String.fromCharCode(97 + col);
                    square.appendChild(fileLabel);
                }

                if (!this.gameOver) {
                    square.addEventListener('click', () => this.handleSquareClick(row, col));
                }
                boardEl.appendChild(square);
            }
        }

        if (!this.gameOver) {
            const infoPanel = document.createElement('div');
            infoPanel.className = 'chess-info';
            const isCheck = this.isInCheck(this.turn);
            infoPanel.innerHTML = `
                <p>Turn: <span class="turn-indicator ${this.turn === 'W' ? 'turn-white' : 'turn-black'}">${this.turn === 'W' ? 'White' : 'Black'}</span>
                ${isCheck ? '<span style="color:red; margin-left:10px;">CHECK!</span>' : ''}
                </p>`;
            this.container.appendChild(infoPanel);

            if (this.currentEvaluation.score !== 0) {
                this.updateEvaluationUI();
            }
        }

        this.container.appendChild(boardEl);
    }

    renderHistory() {
        const list = document.getElementById('move-list');
        if (!list) return;

        if (this.moveHistory.length === 0) {
            list.innerHTML = '<div class="empty-history">Game started</div>';
            return;
        }

        list.innerHTML = '';
        for (let i = 0; i < this.moveHistory.length; i += 2) {
            const entry = document.createElement('div');
            entry.className = 'move-entry';

            const num = Math.floor(i / 2) + 1;
            const whiteMove = this.moveHistory[i];
            const blackMove = this.moveHistory[i + 1] || '';

            entry.innerHTML = `
                <span class="move-number">${num}.</span>
                <span class="move-text">${whiteMove}</span>
                <span class="move-text">${blackMove}</span>
            `;
            list.appendChild(entry);
        }
        list.scrollTop = list.scrollHeight;
    }

    handleSquareClick(row, col) {
        if (this.gameOver) return;

        const clickedPiece = this.board[row][col];
        const isOwnPiece = clickedPiece && clickedPiece.startsWith(this.turn);

        if (this.selectedSquare) {
            if (this.selectedSquare.row === row && this.selectedSquare.col === col) {
                this.selectedSquare = null;
                this.validMoves = [];
                this.render();
                return;
            }

            if (isOwnPiece) {
                this.selectedSquare = { row, col };
                this.validMoves = this.getValidMoves(row, col);
                this.render();
                return;
            }

            const fromRow = this.selectedSquare.row;
            const fromCol = this.selectedSquare.col;

            if (this.isValidMove(fromRow, fromCol, row, col)) {
                const piece = this.board[fromRow][fromCol];
                const type = piece.substring(1);
                const isEnPassant = (type === 'P' && this.enPassantTarget && row === this.enPassantTarget.row && col === this.enPassantTarget.col);
                const isCapture = this.board[row][col] !== null || isEnPassant;
                const fileNames = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
                const rankNames = ['8', '7', '6', '5', '4', '3', '2', '1'];

                let moveString = '';

                if (type === 'KNG' && Math.abs(col - fromCol) === 2) {
                    moveString = (col > fromCol) ? 'O-O' : 'O-O-O';
                } else {
                    let pChar = '';
                    if (type !== 'P') {
                        if (type === 'KNG') pChar = 'K';
                        else if (type === 'K') pChar = 'N';
                        else pChar = type;
                    }

                    if (type === 'P' && isCapture) {
                        moveString += fileNames[fromCol];
                    } else if (type !== 'P') {
                        moveString += pChar;
                    }

                    if (isCapture) moveString += 'x';

                    moveString += fileNames[col] + rankNames[row];

                    if (type === 'P' && (row === 0 || row === 7)) {
                        moveString += '=Q';
                    }
                }

                this.makeMove(fromRow, fromCol, row, col);

                this.selectedSquare = null;
                this.validMoves = [];

                const opponentColor = this.turn === 'W' ? 'B' : 'W';
                const isMate = this.isCheckmate(opponentColor);
                const isCheck = !isMate && this.isInCheck(opponentColor);

                if (isMate) moveString += '#';
                else if (isCheck) moveString += '+';

                this.moveHistory.push(moveString);
                this.renderHistory();

                if (isMate) {
                    this.gameOver = true;
                    this.winner = this.turn;
                }

                this.turn = opponentColor;
                this.render();
                this.analyzePosition();
            } else { }
        } else {
            if (isOwnPiece) {
                this.selectedSquare = { row, col };
                this.validMoves = this.getValidMoves(row, col);
                this.render();
            }
        }
    }

    getValidMoves(row, col) {
        const moves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (this.isValidMove(row, col, r, c)) {
                    moves.push({ row: r, col: c });
                }
            }
        }
        return moves;
    }

    makeMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        const color = piece[0];
        const type = piece.substring(1);
        const dx = toCol - fromCol;

        let isPawnMoveOrCapture = (type === 'P') || (this.board[toRow][toCol] !== null);

        if (type === 'P' && this.enPassantTarget && toRow === this.enPassantTarget.row && toCol === this.enPassantTarget.col) {
            const captureRow = color === 'W' ? toRow + 1 : toRow - 1;
            this.board[captureRow][toCol] = null;
            isPawnMoveOrCapture = true;
        }

        if (type === 'KNG' && Math.abs(dx) === 2) {
            if (dx === 2) {
                const rook = this.board[fromRow][7];
                this.board[fromRow][5] = rook;
                this.board[fromRow][7] = null;
            } else {
                const rook = this.board[fromRow][0];
                this.board[fromRow][3] = rook;
                this.board[fromRow][0] = null;
            }
        }

        this.board[toRow][toCol] = this.board[fromRow][fromCol];
        this.board[fromRow][fromCol] = null;

        if (type === 'P') {
            if ((color === 'W' && toRow === 0) || (color === 'B' && toRow === 7)) {
                this.board[toRow][toCol] = color + 'Q';
            }
        }

        if (type === 'KNG') {
            this.castlingRights[color].K = false;
            this.castlingRights[color].Q = false;
        }
        if (type === 'R') {
            if (fromCol === 0) this.castlingRights[color].Q = false;
            if (fromCol === 7) this.castlingRights[color].K = false;
        }
        if (toRow === 0 && toCol === 0) this.castlingRights['B'].Q = false;
        if (toRow === 0 && toCol === 7) this.castlingRights['B'].K = false;
        if (toRow === 7 && toCol === 0) this.castlingRights['W'].Q = false;
        if (toRow === 7 && toCol === 7) this.castlingRights['W'].K = false;


        if (type === 'P' && Math.abs(fromRow - toRow) === 2) {
            this.enPassantTarget = {
                row: (fromRow + toRow) / 2,
                col: fromCol
            };
        } else {
            this.enPassantTarget = null;
        }

        if (isPawnMoveOrCapture) {
            this.halfMoveClock = 0;
        } else {
            this.halfMoveClock++;
        }

        if (color === 'B') {
            this.fullMoveNumber++;
        }
    }

    isValidMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        if (!piece) return false;

        if (!this.isPseudoLegalMove(fromRow, fromCol, toRow, toCol)) return false;

        const type = piece.substring(1);
        const dx = toCol - fromCol;

        if (type === 'KNG' && Math.abs(dx) === 2) {
            const row = fromRow;
            const direction = dx > 0 ? 1 : -1;
            if (this.isSquareUnderAttack(row, fromCol, this.turn === 'W' ? 'B' : 'W')) return false;
            if (this.isSquareUnderAttack(row, fromCol + direction, this.turn === 'W' ? 'B' : 'W')) return false;
            if (this.isSquareUnderAttack(row, toCol, this.turn === 'W' ? 'B' : 'W')) return false;

            return true;
        }

        const originalTarget = this.board[toRow][toCol];
        const originalSource = this.board[fromRow][fromCol];
        const originalEP = this.enPassantTarget;

        this.board[toRow][toCol] = originalSource;
        this.board[fromRow][fromCol] = null;

        let capturedEP = null;
        if (type === 'P' && originalEP && toRow === originalEP.row && toCol === originalEP.col) {
            const captureRow = piece[0] === 'W' ? toRow + 1 : toRow - 1;
            capturedEP = this.board[captureRow][toCol];
            this.board[captureRow][toCol] = null;
        }

        const inCheck = this.isInCheck(this.turn);

        this.board[fromRow][fromCol] = originalSource;
        this.board[toRow][toCol] = originalTarget;
        if (capturedEP) {
            const captureRow = piece[0] === 'W' ? toRow + 1 : toRow - 1;
            this.board[captureRow][toCol] = capturedEP;
        }

        return !inCheck;
    }

    isPseudoLegalMove(fromRow, fromCol, toRow, toCol, ignoreKingSafety = false) {
        const piece = this.board[fromRow][fromCol];
        if (!piece) return false;

        const type = piece.substring(1);
        const color = piece[0];
        const dx = toCol - fromCol;
        const dy = toRow - fromRow;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        const target = this.board[toRow][toCol];

        if (target && target.startsWith(color)) return false;

        if (!ignoreKingSafety && target && target.endsWith('KNG')) return false;

        switch (type) {
            case 'P':
                const direction = color === 'W' ? -1 : 1;
                const startRow = color === 'W' ? 6 : 1;

                if (dx === 0 && dy === direction && !target) return true;
                if (dx === 0 && dy === 2 * direction && fromRow === startRow && !target && !this.board[fromRow + direction][fromCol]) return true;
                if (absDx === 1 && dy === direction && target) return true;
                if (absDx === 1 && dy === direction && !target && this.enPassantTarget && this.enPassantTarget.row === toRow && this.enPassantTarget.col === toCol) {
                    return true;
                }

                return false;

            case 'R':
                if (dx !== 0 && dy !== 0) return false;
                return this.isPathClear(fromRow, fromCol, toRow, toCol);

            case 'B':
                if (absDx !== absDy) return false;
                return this.isPathClear(fromRow, fromCol, toRow, toCol);

            case 'Q':
                if ((dx !== 0 && dy !== 0) && (absDx !== absDy)) return false;
                return this.isPathClear(fromRow, fromCol, toRow, toCol);

            case 'KNG':
                if (absDx <= 1 && absDy <= 1) return true;

                if (absDy === 0 && absDx === 2 && !ignoreKingSafety) {
                    if (dx === 2) {
                        if (!this.castlingRights[color].K) return false;
                        if (!this.isPathClear(fromRow, 4, fromRow, 7)) return false;
                        const rook = this.board[fromRow][7];
                        if (!rook || rook !== color + 'R') return false;
                    } else {
                        if (!this.castlingRights[color].Q) return false;
                        if (!this.isPathClear(fromRow, 4, fromRow, 0)) return false;
                        const rook = this.board[fromRow][0];
                        if (!rook || rook !== color + 'R') return false;
                    }
                    return true;
                }
                return false;

            case 'K':
                if ((absDx === 2 && absDy === 1) || (absDx === 1 && absDy === 2)) return true;
                return false;
        }
        return false;
    }

    isPathClear(r1, c1, r2, c2) {
        const dr = Math.sign(r2 - r1);
        const dc = Math.sign(c2 - c1);
        let r = r1 + dr;
        let c = c1 + dc;

        while (r !== r2 || c !== c2) {
            if (this.board[r][c]) return false;
            r += dr;
            c += dc;
        }
        return true;
    }

    findKing(color) {
        const kingCode = color + 'KNG';
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (this.board[r][c] === kingCode) return { row: r, col: c };
            }
        }
        return null;
    }

    isInCheck(color) {
        const kingPos = this.findKing(color);
        if (!kingPos) return false;
        return this.isSquareUnderAttack(kingPos.row, kingPos.col, color === 'W' ? 'B' : 'W');
    }

    isSquareUnderAttack(row, col, attackerColor) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.startsWith(attackerColor)) {
                    if (this.isPseudoLegalMove(r, c, row, col, true)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    isCheckmate(color) {
        if (!this.isInCheck(color)) return false;
        return this.hasNoValidMoves(color);
    }

    isStalemate(color) {
        if (this.isInCheck(color)) return false;
        return this.hasNoValidMoves(color);
    }

    hasNoValidMoves(color) {
        const originalTurn = this.turn;
        this.turn = color;

        let hasValidMove = false;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (this.board[r][c] && this.board[r][c].startsWith(color)) {
                    for (let tr = 0; tr < 8; tr++) {
                        for (let tc = 0; tc < 8; tc++) {
                            if (this.isValidMove(r, c, tr, tc)) {
                                hasValidMove = true;
                                break;
                            }
                        }
                        if (hasValidMove) break;
                    }
                }
                if (hasValidMove) break;
            }
            if (hasValidMove) break;
        }

        this.turn = originalTurn;
        return !hasValidMove;
    }

    getBoardStateAsString() {
        return JSON.stringify(this.board);
    }
    initVoiceControl() {
        this.micBtn = document.getElementById('mic-move-btn');
        this.voiceStatus = document.getElementById('voice-move-status');
        this.voiceText = document.getElementById('voice-move-text');

        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.log("Web Speech API not supported");
            if (this.micBtn) {
                this.micBtn.style.opacity = '0.5';
                this.micBtn.addEventListener('click', () => {
                    alert("Voice control is not supported in this browser. Please use Chrome, Edge, or Safari.");
                });
            }
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.lang = 'en-US';
        this.recognition.interimResults = false;
        this.recognition.maxAlternatives = 1;

        this.isListening = false;

        if (this.micBtn) {
            this.micBtn.addEventListener('click', () => this.toggleVoiceControl());
        }

        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateVoiceUI('Listening...', 'active');
        };

        this.recognition.onend = () => {
            this.isListening = false;
            if (this.voiceStatus.classList.contains('hidden')) return;

            this.updateVoiceUI('Click to speak', 'idle');
        };

        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            this.processVoiceCommand(transcript);
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            this.updateVoiceUI('Error: ' + event.error, 'error');
            this.isListening = false;
        };
    }

    toggleVoiceControl() {
        if (this.isListening) {
            this.recognition.stop();
        } else {
            this.recognition.start();
        }
    }

    updateVoiceUI(text, state) {
        if (!this.voiceStatus || !this.micBtn) return;

        this.voiceText.textContent = text;

        if (state === 'active') {
            this.voiceStatus.classList.remove('hidden');
            this.micBtn.classList.add('active');
        } else if (state === 'error') {
            this.micBtn.classList.remove('active');
            setTimeout(() => this.voiceStatus.classList.add('hidden'), 3000);
        } else {
            this.micBtn.classList.remove('active');
            if (text.includes('Move')) {
                setTimeout(() => this.voiceStatus.classList.add('hidden'), 2000);
            } else {
                this.voiceStatus.classList.add('hidden');
            }
        }
    }

    processVoiceCommand(transcript) {
        console.log("Voice command:", transcript);
        const lower = transcript.toLowerCase().trim();
        this.updateVoiceUI(`"${transcript}"`, 'active');

        const fileMap = { 'alpha': 'a', 'bravo': 'b', 'charlie': 'c', 'delta': 'd', 'echo': 'e', 'foxtrot': 'f', 'golf': 'g', 'hotel': 'h' };

        const cleanCoord = (text) => {
            text = text.replace(/alpha/g, 'a').replace(/bravo/g, 'b').replace(/charlie/g, 'c').replace(/delta/g, 'd').replace(/echo/g, 'e').replace(/foxtrot/g, 'f').replace(/golf/g, 'g').replace(/hotel/g, 'h');
            return text.replace(/ /g, '');
        };

        if (lower.includes('castle')) {
            if (lower.includes('queen') || lower.includes('long')) {
                this.attemptCastle('long');
            } else {
                this.attemptCastle('short');
            }
            return;
        }

        const clean = lower.replace(/ to /g, ' ').replace(/-/g, ' ');
        const parts = clean.split(' ');

        let targetSquare = null;
        let sourceSquare = null;
        let pieceType = null;

        const isCoord = (str) => /^[a-h][1-8]$/.test(str);

        const coords = [];
        for (let part of parts) {
            part = part.replace('one', '1').replace('two', '2').replace('three', '3').replace('to', '2').replace('for', '4').replace('four', '4').replace('five', '5').replace('six', '6').replace('seven', '7').replace('eight', '8');

            Object.keys(fileMap).forEach(key => {
                if (part.startsWith(key)) part = part.replace(key, fileMap[key]);
            });

            if (isCoord(part)) {
                coords.push(part);
            }
        }

        if (coords.length >= 2) {
            sourceSquare = coords[0];
            targetSquare = coords[1];
            this.attemptMoveFromVoice(sourceSquare, targetSquare);
        } else if (coords.length === 1) {
            targetSquare = coords[0];

            if (lower.includes('knight')) pieceType = 'N';

            if (lower.includes('knight') || lower.includes('night')) pieceType = 'K';
            else if (lower.includes('king')) pieceType = 'KNG';
            else if (lower.includes('queen')) pieceType = 'Q';
            else if (lower.includes('bishop')) pieceType = 'B';
            else if (lower.includes('rook')) pieceType = 'R';
            else if (lower.includes('pawn')) pieceType = 'P';

            if (pieceType && targetSquare) {
                this.attemptPieceMove(pieceType, targetSquare);
            }
        } else {
            this.updateVoiceUI('Could not understand move.', 'error');
        }
    }

    attemptMoveFromVoice(sourceStr, targetStr) {
        const parse = (s) => ({ col: s.charCodeAt(0) - 97, row: 8 - parseInt(s[1]) });
        const from = parse(sourceStr);
        const to = parse(targetStr);

        if (this.isValidMove(from.row, from.col, to.row, to.col)) {
            this.selectedSquare = { row: from.row, col: from.col };
            this.validMoves = this.getValidMoves(from.row, from.col);
            this.handleSquareClick(to.row, to.col);
        } else {
            this.updateVoiceUI(`Invalid move: ${sourceStr} to ${targetStr}`, 'error');
        }
    }

    attemptPieceMove(type, targetStr) {
        const parse = (s) => ({ col: s.charCodeAt(0) - 97, row: 8 - parseInt(s[1]) });
        const to = parse(targetStr);

        const pieces = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.board[r][c];
                if (p && p.startsWith(this.turn) && p.endsWith(type)) {

                    const pType = p.substring(1);
                    if (pType === type) {
                        pieces.push({ row: r, col: c });
                    }
                }
            }
        }

        let validSource = null;
        let count = 0;

        for (let p of pieces) {
            if (this.isValidMove(p.row, p.col, to.row, to.col)) {
                validSource = p;
                count++;
            }
        }

        if (count === 1) {
            this.selectedSquare = validSource;
            this.validMoves = this.getValidMoves(validSource.row, validSource.col);
            this.handleSquareClick(to.row, to.col);
        } else if (count > 1) {
            this.updateVoiceUI('Ambiguous move.', 'error');
        } else {
            this.updateVoiceUI('No piece can move there.', 'error');
        }
    }

    attemptCastle(side) {
        const col = 4;
        const row = this.turn === 'W' ? 7 : 0;
        const king = this.board[row][col];
        if (!king || !king.endsWith('KNG')) return;

        let targetCol = side === 'short' ? 6 : 2;

        if (this.isValidMove(row, col, row, targetCol)) {
            this.selectedSquare = { row, col };
            this.validMoves = this.getValidMoves(row, col);
            this.handleSquareClick(row, targetCol);
        } else {
            this.updateVoiceUI('Cannot castle.', 'error');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('chess-game-container')) {
        window.chessGame = new ChessGame('chess-game-container');
    }
});
