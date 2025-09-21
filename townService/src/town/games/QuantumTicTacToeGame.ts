import InvalidParametersError, {
  GAME_FULL_MESSAGE,
  BOARD_POSITION_NOT_EMPTY_MESSAGE,
  PLAYER_ALREADY_IN_GAME_MESSAGE,
  PLAYER_NOT_IN_GAME_MESSAGE,
  INVALID_MOVE_MESSAGE,
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
  }

  protected _join(player: Player): void {
    Object.values(this._games).forEach(game => game.join(player));

    if (this.state.x === player.id || this.state.o === player.id) {
      throw new InvalidParametersError(PLAYER_ALREADY_IN_GAME_MESSAGE);
    }
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
    Object.values(this._games).forEach(game => game.leave(player));

    if (this.state.x !== player.id && this.state.o !== player.id) {
      throw new InvalidParametersError(PLAYER_NOT_IN_GAME_MESSAGE);
    }
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
      return;
    }
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

  /**
   * Checks that the given move is "valid": that the it's the right
   * player's turn, that the game is actually in-progress, etc.
   * @see TicTacToeGame#_validateMove
   */
  private _validateMove(move: GameMove<QuantumTicTacToeMove>): void {
    const { board, col, row } = move.move;
    const targetGame = this._games[board];

    if (targetGame.state.status !== 'IN_PROGRESS') {
      throw new InvalidParametersError(INVALID_MOVE_MESSAGE);
    }

    if (col < 0 || col > 2 || row < 0 || row > 2) {
      throw new InvalidParametersError(BOARD_POSITION_NOT_VALID_MESSAGE);
    }

    for (const m of targetGame.state.moves) {
      if (m.col === col && m.row === row) {
        if (m.gamePiece === targetGame.whoseTurn) {
          throw new InvalidParametersError(INVALID_MOVE_MESSAGE);
        } else if (this.state.publiclyVisible[board][row][col]) {
          throw new InvalidParametersError(INVALID_MOVE_MESSAGE);
        } else {
          break;
        }
      }
    }
  }

  public applyMove(move: GameMove<QuantumTicTacToeMove>): void {
    this._validateMove(move);

    const { board } = move.move;
    const targetGame = this._games[board];

    let moveWasSkipped = false;

    for (const m of targetGame.state.moves) {
      if (m.col === move.move.col && m.row === move.move.row) {
        if (m.gamePiece === targetGame.whoseTurn) {
          throw new InvalidParametersError(INVALID_MOVE_MESSAGE);
        } else if (this.state.publiclyVisible[board][m.row][m.col]) {
          throw new InvalidParametersError(BOARD_POSITION_NOT_EMPTY_MESSAGE);
        } else {
          // make cell visible
          this.state.publiclyVisible[board][m.row][m.col] = true;
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
      const turn = targetGame.whoseTurn;
      // sync all games to have same turn
      Object.values(this._games).forEach(game => {
        game.whoseTurn = turn;
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
    let xScore = 0;
    let oScore = 0;
    Object.values(this._games).forEach(game => {
      if (game.state.winner !== undefined) {
        if (game.state.winner === this.state.x) {
          xScore++;
        } else if (game.state.winner === this.state.o) {
          oScore++;
        }
      }
    });
    this._xScore = xScore;
    this._oScore = oScore;
    this.state.xScore = this._xScore;
    this.state.oScore = this._oScore;
  }

  /**
   * A Quantum Tic-Tac-Toe game ends when no more moves are possible.
   * This happens when all squares on all boards are either occupied or part of a won board.
   */
  private _checkForGameEnding(): void {
    const done = Object.values(this._games).every(game => game.state.status === 'OVER');
    if (done) {
      const { xScore, oScore } = this.state;
      if (xScore === oScore) {
        this.state = {
          ...this.state,
          status: 'OVER',
          winner: undefined,
        };
        return;
      }
      this.state = {
        ...this.state,
        status: 'OVER',
        winner: xScore > oScore ? this.state.x : this.state.o,
      };
    }
  }
}
