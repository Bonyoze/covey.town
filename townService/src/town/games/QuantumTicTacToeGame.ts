import InvalidParametersError, {
  GAME_FULL_MESSAGE,
  BOARD_POSITION_NOT_EMPTY_MESSAGE,
  PLAYER_ALREADY_IN_GAME_MESSAGE,
  PLAYER_NOT_IN_GAME_MESSAGE,
  INVALID_MOVE_MESSAGE,
  GAME_NOT_IN_PROGRESS_MESSAGE,
  MOVE_NOT_YOUR_TURN_MESSAGE,
  BOARD_POSITION_NOT_VALID_MESSAGE,
} from '../../lib/InvalidParametersError';
import {
  GameMove,
  QuantumTicTacToeGameState,
  QuantumTicTacToeMove,
} from '../../types/CoveyTownSocket';
import Game from './Game';
import TicTacToeGame from './TicTacToeGame';
import Player from '../../lib/Player';

/**
 * A QuantumTicTacToeGame is a Game that implements the rules of the Tic-Tac-Toe variant described at https://www.smbc-comics.com/comic/tic.
 * This class acts as a controller for three underlying TicTacToeGame instances, orchestrating the "quantum" rules by taking
 * the role of the monitor.
 */
export default class QuantumTicTacToeGame extends Game<
  QuantumTicTacToeGameState,
  QuantumTicTacToeMove
> {
  private _games: { A: TicTacToeGame; B: TicTacToeGame; C: TicTacToeGame };

  private _xScore: number;

  private _oScore: number;

  private _moveCount: number;

  private _checkedBoards: Set<string>;

  public constructor() {
    super({
      moves: [],
      xScore: 0,
      oScore: 0,
      publiclyVisible: {
        A: [
          [false, false, false],
          [false, false, false],
          [false, false, false],
        ],
        B: [
          [false, false, false],
          [false, false, false],
          [false, false, false],
        ],
        C: [
          [false, false, false],
          [false, false, false],
          [false, false, false],
        ],
      },
      status: 'WAITING_TO_START',
    });
    this._games = {
      A: new TicTacToeGame(),
      B: new TicTacToeGame(),
      C: new TicTacToeGame(),
    };
    this._xScore = 0;
    this._oScore = 0;
    this._moveCount = 0;
    this._checkedBoards = new Set();
  }

  protected _join(player: Player): void {
    if (this.state.x === player.id || this.state.o === player.id) {
      throw new InvalidParametersError(PLAYER_ALREADY_IN_GAME_MESSAGE);
    }

    Object.values(this._games).forEach(game => game.join(player));

    if (!this.state.x) {
      this.state = {
        ...this.state,
        x: player.id,
      };
    } else if (!this.state.o) {
      this.state = {
        ...this.state,
        o: player.id,
      };
    } else {
      throw new InvalidParametersError(GAME_FULL_MESSAGE);
    }
    if (this.state.x && this.state.o) {
      this.state = {
        ...this.state,
        status: 'IN_PROGRESS',
      };
    }
  }

  protected _leave(player: Player): void {
    if (this.state.x !== player.id && this.state.o !== player.id) {
      throw new InvalidParametersError(PLAYER_NOT_IN_GAME_MESSAGE);
    }

    Object.values(this._games).forEach(game => game.leave(player));

    // Handles case where the game has not started yet
    if (this.state.o === undefined) {
      this.state = {
        moves: [],
        xScore: 0,
        oScore: 0,
        publiclyVisible: {
          A: [
            [false, false, false],
            [false, false, false],
            [false, false, false],
          ],
          B: [
            [false, false, false],
            [false, false, false],
            [false, false, false],
          ],
          C: [
            [false, false, false],
            [false, false, false],
            [false, false, false],
          ],
        },
        status: 'WAITING_TO_START',
      };
      this._games = {
        A: new TicTacToeGame(),
        B: new TicTacToeGame(),
        C: new TicTacToeGame(),
      };
      this._xScore = 0;
      this._oScore = 0;
      this._moveCount = 0;
      this._checkedBoards = new Set();
    } else if (this.state.status !== 'OVER') {
      if (this.state.x === player.id) {
        this.state = {
          ...this.state,
          status: 'OVER',
          winner: this.state.o,
        };
      } else {
        this.state = {
          ...this.state,
          status: 'OVER',
          winner: this.state.x,
        };
      }
    }
  }

  /**
   * Checks that the given move is "valid": that the it's the right
   * player's turn, that the game is actually in-progress, etc.
   * @see TicTacToeGame#_validateMove
   */
  private _validateMove(move: GameMove<QuantumTicTacToeMove>): void {
    if (this.state.status !== 'IN_PROGRESS') {
      throw new InvalidParametersError(GAME_NOT_IN_PROGRESS_MESSAGE);
    }

    const { board, row, col, gamePiece } = move.move;
    const targetGame = this._games[board];

    if (row < 0 || row > 2 || col < 0 || col > 2) {
      throw new InvalidParametersError(BOARD_POSITION_NOT_VALID_MESSAGE);
    }

    let moveWasSkipped = false;

    for (const m of targetGame.state.moves) {
      if (m.row === row && m.col === col) {
        if (m.gamePiece === gamePiece) {
          throw new InvalidParametersError(INVALID_MOVE_MESSAGE);
        } else if (this.state.publiclyVisible[board][row][col]) {
          throw new InvalidParametersError(INVALID_MOVE_MESSAGE);
        } else if (targetGame.state.winner === undefined) {
          moveWasSkipped = true;
          break;
        }
      }
    }

    if (gamePiece === 'X' && this._moveCount % 2 === 1) {
      throw new InvalidParametersError(MOVE_NOT_YOUR_TURN_MESSAGE);
    } else if (gamePiece === 'O' && this._moveCount % 2 === 0) {
      throw new InvalidParametersError(MOVE_NOT_YOUR_TURN_MESSAGE);
    }

    if (!moveWasSkipped && targetGame.state.status !== 'IN_PROGRESS') {
      throw new InvalidParametersError(INVALID_MOVE_MESSAGE);
    }
  }

  /*
   * Applies a player's move to the game.
   * Uses the player's ID to determine which game piece they are using (ignores move.gamePiece)
   * Validates the move before applying it. If the move is invalid, throws an InvalidParametersError with
   * the error message specified below.
   * A move is invalid if:
   *    - The move is out of bounds (not in the 3x3 grid (use BOARD_POSITION_NOT_VALID_MESSAGE)
   *    - The move is on a space that is already occupied or revealed (use INVALID_MOVE_MESSAGE)
   *    - The move is not the player's turn (MOVE_NOT_YOUR_TURN_MESSAGE)
   *    - The game is not in progress (GAME_NOT_IN_PROGRESS_MESSAGE)
   *
   * If the move is valid, applies the move to the game and updates the game state.
   *
   * If the move ends the game, updates the game's state.
   * If the move results in a win on a board, increments the score counter for the player who won.
   * If the move was on a space already played by the other player and not yet revealed, skip the player's turn and make the space visible.
   * A player wins if they have the highest score after all boards are won or full.
   *
   * @param move The move to apply to the game
   * @throws InvalidParametersError if the move is invalid
   */
  public applyMove(move: GameMove<QuantumTicTacToeMove>): void {
    let gamePiece: 'X' | 'O';
    if (move.playerID === this.state.x) {
      gamePiece = 'X';
    } else {
      gamePiece = 'O';
    }
    const cleanMove = {
      gamePiece,
      board: move.move.board,
      col: move.move.col,
      row: move.move.row,
    };
    move = {
      ...move,
      move: cleanMove,
    };

    this._validateMove(move);

    const { board, row, col } = move.move;
    const targetGame = this._games[board];

    let moveWasSkipped = false;

    for (const m of targetGame.state.moves) {
      if (m.row === row && m.col === col) {
        if (m.gamePiece === gamePiece) {
          throw new InvalidParametersError(INVALID_MOVE_MESSAGE);
        } else if (this.state.publiclyVisible[board][row][col]) {
          throw new InvalidParametersError(BOARD_POSITION_NOT_EMPTY_MESSAGE);
        } else if (targetGame.state.winner === undefined) {
          // make cell visible
          this.state.publiclyVisible[board][row][col] = true;
          // skip turn to next player
          const whoseTurn = targetGame.whoseTurn === 'X' ? 'O' : 'X';
          // sync all games to have same turn
          Object.values(this._games).forEach(game => {
            game.whoseTurn = whoseTurn;
          });
          moveWasSkipped = true;
          break;
        }
      }
    }

    if (!moveWasSkipped) {
      targetGame.applyMove(move);
      const { whoseTurn } = targetGame;
      // sync all games to have same turn
      Object.values(this._games).forEach(game => {
        game.whoseTurn = whoseTurn;
      });
    }

    this.state = {
      ...this.state,
      moves: [...this.state.moves, move.move],
    };
    this._moveCount++;

    this._checkForWins();
    this._checkForGameEnding();
  }

  /**
   * Checks all three sub-games for any new three-in-a-row conditions.
   * Awards points and marks boards as "won" so they can't be played on.
   */
  private _checkForWins(): void {
    for (const [name, game] of Object.entries(this._games)) {
      const { status, winner } = game.state;
      if (status === 'OVER' && !this._checkedBoards.has(name)) {
        this._checkedBoards.add(name);
        if (winner === this.state.x) {
          this._xScore++;
        } else if (winner === this.state.o) {
          this._oScore++;
        }
      }
    }
    this.state = {
      ...this.state,
      xScore: this._xScore,
      oScore: this._oScore,
    };
  }

  /**
   * A Quantum Tic-Tac-Toe game ends when no more moves are possible.
   * This happens when all squares on all boards are either occupied or part of a won board.
   */
  private _checkForGameEnding(): void {
    const allEnded = Object.values(this._games).every(game => game.state.status === 'OVER');
    if (allEnded) {
      let winner: string | undefined;
      if (this._xScore > this._oScore) {
        winner = this.state.x;
      } else if (this._oScore > this._xScore) {
        winner = this.state.o;
      } else {
        winner = undefined;
      }
      this.state = {
        ...this.state,
        status: 'OVER',
        winner,
      };
    }
  }
}
