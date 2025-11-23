class ChessGame {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.board = [];
        this.turn = 'W'; // 'W' or 'B'
        this.selectedSquare = null; // {row, col}
        this.gameOver = false;
        this.winner = null;

        this.pieceSymbols = {
            'WP': '♙', 'WR': '♖', 'WK': '♘', 'WB': '♗', 'WQ': '♕', 'WKNG': '♔',
            'BP': '♟', 'BR': '♜', 'BK': '♞', 'BB': '♝', 'BQ': '♛', 'BKNG': '♚'
        };

        this.initGame();
    }

    initGame() {
        // Initialize 8x8 matrix
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
        this.render();
    }

    render() {
        this.container.innerHTML = '';

        // Game Over / Reset UI
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

                // Highlight selected square
                if (this.selectedSquare && this.selectedSquare.row === row && this.selectedSquare.col === col) {
                    square.classList.add('selected');
                }

                if (pieceCode) {
                    const pieceSpan = document.createElement('span');
                    pieceSpan.className = 'chess-piece';
                    pieceSpan.textContent = this.pieceSymbols[pieceCode];
                    pieceSpan.classList.add(pieceCode.startsWith('W') ? 'white-piece' : 'black-piece');
                    square.appendChild(pieceSpan);
                }

                // Add Coordinates
                // Rank numbers (1-8) on the first column (col 0)
                if (col === 0) {
                    const rankLabel = document.createElement('span');
                    rankLabel.className = 'coord-rank';
                    rankLabel.textContent = 8 - row;
                    square.appendChild(rankLabel);
                }

                // File letters (a-h) on the last row (row 7)
                if (row === 7) {
                    const fileLabel = document.createElement('span');
                    fileLabel.className = 'coord-file';
                    fileLabel.textContent = String.fromCharCode(97 + col); // 97 is 'a'
                    square.appendChild(fileLabel);
                }

                if (!this.gameOver) {
                    square.addEventListener('click', () => this.handleSquareClick(row, col));
                }
                boardEl.appendChild(square);
            }
        }

        // Add turn indicator
        if (!this.gameOver) {
            const infoPanel = document.createElement('div');
            infoPanel.className = 'chess-info';
            const isCheck = this.isInCheck(this.turn);
            infoPanel.innerHTML = `
                <p>Turn: <span class="turn-indicator ${this.turn === 'W' ? 'turn-white' : 'turn-black'}">${this.turn === 'W' ? 'White' : 'Black'}</span>
                ${isCheck ? '<span style="color:red; margin-left:10px;">CHECK!</span>' : ''}
                </p>`;
            this.container.appendChild(infoPanel);
        }

        this.container.appendChild(boardEl);
    }

    handleSquareClick(row, col) {
        if (this.gameOver) return;

        const clickedPiece = this.board[row][col];
        const isOwnPiece = clickedPiece && clickedPiece.startsWith(this.turn);

        if (this.selectedSquare) {
            // If clicking the same square, deselect
            if (this.selectedSquare.row === row && this.selectedSquare.col === col) {
                this.selectedSquare = null;
                this.render();
                return;
            }

            // If clicking another own piece, switch selection
            if (isOwnPiece) {
                this.selectedSquare = { row, col };
                this.render();
                return;
            }

            // Attempt to move
            if (this.isValidMove(this.selectedSquare.row, this.selectedSquare.col, row, col)) {
                // Execute move
                this.makeMove(this.selectedSquare.row, this.selectedSquare.col, row, col);

                this.selectedSquare = null;

                // Check for checkmate
                const opponentColor = this.turn === 'W' ? 'B' : 'W';
                if (this.isCheckmate(opponentColor)) {
                    this.gameOver = true;
                    this.winner = this.turn;
                }

                this.turn = opponentColor;
                this.render();
            } else {
                console.log("Invalid move");
            }
        } else {
            // Select piece if it's ours
            if (isOwnPiece) {
                this.selectedSquare = { row, col };
                this.render();
            }
        }
    }

    // Helper to actually move piece on board (no validation)
    makeMove(fromRow, fromCol, toRow, toCol) {
        this.board[toRow][toCol] = this.board[fromRow][fromCol];
        this.board[fromRow][fromCol] = null;
    }

    // Full validation including Check rules
    isValidMove(fromRow, fromCol, toRow, toCol) {
        // 1. Basic geometry check
        if (!this.isPseudoLegalMove(fromRow, fromCol, toRow, toCol)) return false;

        // 2. Simulate move to check if King is left in check
        const originalTarget = this.board[toRow][toCol];
        const originalSource = this.board[fromRow][fromCol];

        // Apply move temporarily
        this.board[toRow][toCol] = originalSource;
        this.board[fromRow][fromCol] = null;

        const inCheck = this.isInCheck(this.turn);

        // Undo move
        this.board[fromRow][fromCol] = originalSource;
        this.board[toRow][toCol] = originalTarget;

        return !inCheck;
    }

    // Basic geometry and path checking (Pseudo-legal)
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
        // Cannot capture own piece
        if (target && target.startsWith(color)) return false;

        // Cannot capture King (Standard chess rule: King is never captured, game ends before)
        // BUT, for checking if a square is under attack, we need to allow "capturing" the king
        if (!ignoreKingSafety && target && target.endsWith('KNG')) return false;

        switch (type) {
            case 'P': // Pawn
                const direction = color === 'W' ? -1 : 1;
                const startRow = color === 'W' ? 6 : 1;

                // Move forward 1
                if (dx === 0 && dy === direction && !target) return true;
                // Move forward 2
                if (dx === 0 && dy === 2 * direction && fromRow === startRow && !target && !this.board[fromRow + direction][fromCol]) return true;
                // Capture
                if (absDx === 1 && dy === direction && target) return true;
                // En Passant or "Attack square" check (for isSquareUnderAttack, we need to know if pawn hits the square even if empty)
                if (ignoreKingSafety && absDx === 1 && dy === direction) return true;

                return false;

            case 'R': // Rook
                if (dx !== 0 && dy !== 0) return false;
                return this.isPathClear(fromRow, fromCol, toRow, toCol);

            case 'B': // Bishop
                if (absDx !== absDy) return false;
                return this.isPathClear(fromRow, fromCol, toRow, toCol);

            case 'Q': // Queen
                if ((dx !== 0 && dy !== 0) && (absDx !== absDy)) return false;
                return this.isPathClear(fromRow, fromCol, toRow, toCol);

            case 'KNG': // King
                if (absDx > 1 || absDy > 1) return false;
                return true;

            case 'K': // Knight
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
        if (!kingPos) return false; // Should not happen
        return this.isSquareUnderAttack(kingPos.row, kingPos.col, color === 'W' ? 'B' : 'W');
    }

    isSquareUnderAttack(row, col, attackerColor) {
        // Check all pieces of attackerColor to see if they can move to (row, col)
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.startsWith(attackerColor)) {
                    // Use isPseudoLegalMove to check if this piece can hit the target square
                    // Note: We don't use isValidMove here to avoid infinite recursion
                    // We pass true for ignoreKingSafety because we want to know if the piece CAN hit the king
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

        // Temporarily switch turn to 'color' so isValidMove checks the correct King's safety
        const originalTurn = this.turn;
        this.turn = color;

        let hasValidMove = false;

        // Try every possible move for every piece of 'color'
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

        // Restore turn
        this.turn = originalTurn;

        return !hasValidMove;
    }
    getBoardStateAsString() {
        return JSON.stringify(this.board);
    }
}

// Initialize the game when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Check if the container exists
    if (document.getElementById('chess-game-container')) {
        window.chessGame = new ChessGame('chess-game-container');
    }
});
