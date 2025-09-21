import { createPlayerForTesting } from '../../TestUtils';
import Player from '../../lib/Player';
import { GameMove } from '../../types/CoveyTownSocket';
import QuantumTicTacToeGame from './QuantumTicTacToeGame';

describe('QuantumTicTacToeGame', () => {
  let game: QuantumTicTacToeGame;
  let player1: Player;
  let player2: Player;

  beforeEach(() => {
    game = new QuantumTicTacToeGame();
    player1 = createPlayerForTesting();
    player2 = createPlayerForTesting();
  });

  describe('constructor', () => {
    it('should have all squares as not publicly visible', () => {
      const allHidden = Object.values(game.state.publiclyVisible).every(board =>
        board.every(row => row.every(cell => cell === false)),
      );
      expect(allHidden).toBe(true);
    });
  });

  describe('_join', () => {
    it('should add the first player as X', () => {
      game.join(player1);
      expect(game.state.x).toBe(player1.id);
      expect(game.state.o).toBeUndefined();
      expect(game.state.status).toBe('WAITING_TO_START');
    });
  });

  describe('_leave', () => {
    describe('when two players are in the game', () => {
      beforeEach(() => {
        game.join(player1);
        game.join(player2);
      });

      it('should set the game to OVER and declare the other player the winner', () => {
        game.leave(player1);
        expect(game.state.status).toBe('OVER');
        expect(game.state.winner).toBe(player2.id);
      });
    });

    describe('when one player is in the game', () => {
      beforeEach(() => {
        game.join(player1);
      });

      it('should allow the player to leave and rejoin', () => {
        game.leave(player1);
        game.join(player1);
        expect(game.state.x).toBe(player1.id);
      });
    });
  });

  describe('applyMove', () => {
    beforeEach(() => {
      game.join(player1);
      game.join(player2);
    });

    const makeMove = (player: Player, board: 'A' | 'B' | 'C', row: 0 | 1 | 2, col: 0 | 1 | 2) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const move: GameMove<any> = {
        playerID: player.id,
        gameID: game.id,
        move: { board, row, col },
      };
      game.applyMove(move);
    };

    it('should place a piece on an empty square', () => {
      makeMove(player1, 'A', 0, 0);
      // @ts-expect-error - private property
      expect(game._games.A._board[0][0]).toBe('X');
      expect(game.state.moves.length).toBe(1);
    });

    describe('scoring and game end', () => {
      it('should award a point when a player gets three-in-a-row', () => {
        // X gets a win on board A
        makeMove(player1, 'A', 0, 0); // X
        makeMove(player2, 'B', 0, 0); // O
        makeMove(player1, 'A', 0, 1); // X
        makeMove(player2, 'B', 0, 1); // O
        makeMove(player1, 'A', 0, 2); // X -> scores 1 point

        expect(game.state.xScore).toBe(1);
        expect(game.state.oScore).toBe(0);
      });
    });

    it('should throw an error if the game is not in progress', () => {
      game.leave(player1);
      expect(() => makeMove(player2, 'A', 0, 0)).toThrow();
    });

    it('should throw an error if a player tries to play on their own piece', () => {
      makeMove(player1, 'A', 0, 0); // X
      makeMove(player2, 'B', 0, 0); // O
      expect(() => makeMove(player1, 'A', 0, 0)).toThrowError('Invalid move');
    });

    it("should handle a collision by losing the second player's turn", () => {
      makeMove(player1, 'A', 0, 0); // X
      makeMove(player2, 'A', 0, 0); // Collision
      expect(game.state.moves.length).toBe(2);
      expect(() => makeMove(player1, 'A', 0, 1)).not.toThrow();
      makeMove(player2, 'A', 1, 0); // O
      makeMove(player1, 'A', 1, 0); // Collision
      expect(game.state.moves.length).toBe(5);
      expect(() => makeMove(player2, 'A', 1, 1)).not.toThrow();
    });

    describe('publicly visible squares', () => {
      it('should not make a square publicly visible on the first move', () => {
        makeMove(player1, 'A', 0, 0); // X
        expect(game.state.publiclyVisible.A[0][0]).toBe(false);
      });

      it('should make a square publicly visible on collision', () => {
        makeMove(player1, 'A', 0, 0); // X
        makeMove(player2, 'A', 0, 0); // Collision
        expect(game.state.publiclyVisible.A[0][0]).toBe(true);
      });

      it('should not make all squares on a board publicly visible when it is won', () => {
        // X gets a win on board A
        makeMove(player1, 'A', 0, 0); // X
        makeMove(player2, 'B', 0, 0); // O
        makeMove(player1, 'A', 0, 1); // X
        makeMove(player2, 'B', 0, 1); // O
        makeMove(player1, 'A', 0, 2); // X -> scores 1 point

        const notAllVisible = Object.values(game.state.publiclyVisible).every(
          board => !board.every(row => row.every(cell => cell === true)),
        );
        expect(notAllVisible).toBe(true);
      });
    });

    describe('scoring and game end', () => {
      it('should not allow moves on a board that has been won', () => {
        // X gets a win on board A
        makeMove(player1, 'A', 0, 0); // X
        makeMove(player2, 'B', 0, 0); // O
        makeMove(player1, 'A', 0, 1); // X
        makeMove(player2, 'B', 0, 1); // O
        makeMove(player1, 'A', 0, 2); // X -> scores 1 point

        expect(() => makeMove(player2, 'A', 1, 0)).toThrow('Invalid move');
      });

      it('should end the game when all boards are full or won (X wins)', () => {
        // X gets a win on board A
        makeMove(player1, 'A', 0, 0); // X
        makeMove(player2, 'B', 0, 0); // O
        makeMove(player1, 'A', 0, 1); // X
        makeMove(player2, 'B', 0, 1); // O
        makeMove(player1, 'A', 0, 2); // X -> scores 1 point
        // O gets a win on board B
        makeMove(player2, 'B', 0, 2); // O -> scores 1 point
        // X gets a win on board C
        makeMove(player1, 'C', 0, 0); // X
        makeMove(player2, 'C', 0, 0); // Collision
        makeMove(player1, 'C', 0, 1); // X
        makeMove(player2, 'C', 0, 1); // Collision
        makeMove(player1, 'C', 0, 2); // O -> scores 1 point

        expect(game.state.status).toBe('OVER');
        expect(game.state.xScore).toBe(2);
        expect(game.state.oScore).toBe(1);
        expect(game.state.winner).toBe(player1.id);
      });

      it('should end the game when all boards are full or won (X wins)', () => {
        // X gets a win on board A
        makeMove(player1, 'A', 0, 0); // X
        makeMove(player2, 'B', 0, 0); // O
        makeMove(player1, 'A', 0, 1); // X
        makeMove(player2, 'B', 0, 1); // O
        makeMove(player1, 'A', 0, 2); // X -> scores 1 point
        // Nobody gets a win on board B
        makeMove(player2, 'B', 1, 2); // O
        makeMove(player1, 'B', 0, 2); // X
        makeMove(player2, 'B', 2, 0); // O
        makeMove(player1, 'B', 1, 1); // X
        makeMove(player2, 'B', 2, 1); // O
        makeMove(player1, 'B', 2, 2); // X
        makeMove(player2, 'B', 2, 2); // O
        makeMove(player1, 'B', 1, 0); // X
        // X gets a win on board C
        makeMove(player2, 'C', 1, 0); // O
        makeMove(player1, 'C', 0, 0); // X
        makeMove(player2, 'C', 0, 0); // Collision
        makeMove(player1, 'C', 0, 1); // X
        makeMove(player2, 'C', 0, 1); // Collision
        makeMove(player1, 'C', 0, 2); // O -> scores 1 point

        expect(game.state.status).toBe('OVER');
        expect(game.state.xScore).toBe(2);
        expect(game.state.oScore).toBe(0);
        expect(game.state.winner).toBe(player1.id);
      });

      it('should end the game when all boards are full or won (O wins)', () => {
        // X gets a win on board A
        makeMove(player1, 'A', 0, 0); // X
        makeMove(player2, 'B', 0, 0); // O
        makeMove(player1, 'A', 0, 1); // X
        makeMove(player2, 'B', 0, 1); // O
        makeMove(player1, 'A', 0, 2); // X -> scores 1 point

        // O gets a win on board B
        makeMove(player2, 'B', 0, 2); // O -> scores 1 point

        // O gets a win on board C
        makeMove(player1, 'C', 1, 0); // X
        makeMove(player2, 'C', 0, 0); // O
        makeMove(player1, 'C', 0, 0); // Collision
        makeMove(player2, 'C', 0, 1); // O
        makeMove(player1, 'C', 0, 1); // Collision
        makeMove(player2, 'C', 0, 2); // O -> scores 1 point

        expect(game.state.status).toBe('OVER');
      });

      it('should declare a tie if scores are equal at the end', () => {
        // X gets a win on board A
        makeMove(player1, 'A', 0, 0); // X
        makeMove(player2, 'B', 0, 0); // O
        makeMove(player1, 'A', 0, 1); // X
        makeMove(player2, 'B', 0, 1); // O
        makeMove(player1, 'A', 0, 2); // X -> scores 1 point
        // O gets a win on board B
        makeMove(player2, 'B', 0, 2); // O -> scores 1 point
        // No win on board C
        makeMove(player1, 'C', 0, 0); // X
        makeMove(player2, 'C', 0, 1); // O
        makeMove(player1, 'C', 0, 2); // X
        makeMove(player2, 'C', 1, 0); // O
        makeMove(player1, 'C', 1, 2); // X
        makeMove(player2, 'C', 1, 1); // O
        makeMove(player1, 'C', 2, 1); // X
        makeMove(player2, 'C', 2, 2); // O
        makeMove(player1, 'C', 2, 0); // X

        expect(game.state.status).toBe('OVER');
        expect(game.state.winner).toBe(undefined);
      });
    });

    describe('a full game from start to finish', () => {
      it('should correctly handle a full game, including collisions, scoring, and a final winner', () => {
        // X gets a win on board A
        makeMove(player1, 'A', 0, 0); // X
        makeMove(player2, 'B', 0, 0); // O
        makeMove(player1, 'A', 0, 1); // X
        makeMove(player2, 'B', 0, 1); // O
        makeMove(player1, 'A', 0, 2); // X -> scores 1 point
        // O gets a win on board B
        makeMove(player2, 'B', 0, 2); // O -> scores 1 point
        // X gets a win on board C
        makeMove(player1, 'C', 0, 0); // X
        makeMove(player2, 'C', 0, 0); // Collision
        makeMove(player1, 'C', 0, 1); // X
        makeMove(player2, 'C', 0, 1); // Collision
        makeMove(player1, 'C', 0, 2); // O -> scores 1 point

        expect(game.state.status).toBe('OVER');
        expect(game.state.xScore).toBe(2);
        expect(game.state.oScore).toBe(1);
        expect(game.state.winner).toBe(player1.id);
      });
    });
  });
});
