import InvalidParametersError, {
  GAME_FULL_MESSAGE,
  GAME_NOT_IN_PROGRESS_MESSAGE,
  BOARD_POSITION_NOT_EMPTY_MESSAGE,
  MOVE_NOT_YOUR_TURN_MESSAGE,
  PLAYER_ALREADY_IN_GAME_MESSAGE,
  PLAYER_NOT_IN_GAME_MESSAGE,
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
      publiclyVisible: { A: [], B: [], C: [] },
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
    Object.values(this._games).forEach(game => game.join(player));
  }

  protected _leave(player: Player): void {
    if (this.state.x !== player.id && this.state.o !== player.id) {
      throw new InvalidParametersError(PLAYER_NOT_IN_GAME_MESSAGE);
    }
    // Handles case where the game has not started yet
    if (this.state.o === undefined) {
      this.state = {
        moves: [],
        xScore: 0,
        oScore: 0,
        publiclyVisible: { A: [], B: [], C: [] },
        status: 'WAITING_TO_START',
      };
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
    Object.values(this._games).forEach(game => game.leave(player));
  }

  /**
   * Checks that the given move is "valid": that the it's the right
   * player's turn, that the game is actually in-progress, etc.
   * @see TicTacToeGame#_validateMove
   */
  private _validateMove(move: QuantumTicTacToeMove): void {
    // A move is valid if the space is empty
    for (const m of this.state.moves) {
      if (m.board === move.board && m.col === move.col && m.row === move.row) {
        if (m.gamePiece === move.gamePiece) {
          throw new InvalidParametersError(BOARD_POSITION_NOT_EMPTY_MESSAGE);
        }
      }
    }

    // A move is only valid if it is the player's turn
    if (move.gamePiece === 'X' && this.state.moves.length % 2 === 1) {
      throw new InvalidParametersError(MOVE_NOT_YOUR_TURN_MESSAGE);
    } else if (move.gamePiece === 'O' && this.state.moves.length % 2 === 0) {
      throw new InvalidParametersError(MOVE_NOT_YOUR_TURN_MESSAGE);
    }
    // A move is valid only if game is in progress
    if (this.state.status !== 'IN_PROGRESS') {
      throw new InvalidParametersError(GAME_NOT_IN_PROGRESS_MESSAGE);
    }
  }

  public applyMove(move: GameMove<QuantumTicTacToeMove>): void {
    const { board } = move.move;
    const targetGame = this._games[board];

    try {
      targetGame.applyMove(move);
      const { turn } = targetGame.state;
      // sync all games to have same turn
      Object.values(this._games).forEach(game => {
        game.state.turn = turn;
      });
    } catch (error) {
      if (
        error instanceof InvalidParametersError &&
        error.message === BOARD_POSITION_NOT_EMPTY_MESSAGE
      ) {
        targetGame.skipMove(); // update turn to next player
        const { turn } = targetGame.state;
        // sync all games to have same turn
        Object.values(this._games).forEach(game => {
          game.state.turn = turn;
        });
      } else {
        throw error;
      }
    }

    this.state = {
      ...this.state,
      moves: [...this.state.moves, move.move],
    };

    if (targetGame.state.winner !== undefined) {
      if (targetGame.state.winner === this.state.x) {
        this.state.xScore++;
      } else {
        this.state.oScore++;
      }
    }

    const done = Object.values(this._games).every(game => game.state.status === 'OVER');
    if (done) {
      const { xScore, oScore } = this.state;
      let winner: string | undefined;
      if (xScore !== oScore) {
        winner = xScore > oScore ? this.state.x : this.state.o;
      }
      this.state = {
        ...this.state,
        status: 'OVER',
        winner,
      };
    }

    this._checkForWins();
    this._checkForGameEnding();
  }

  /**
   * Checks all three sub-games for any new three-in-a-row conditions.
   * Awards points and marks boards as "won" so they can't be played on.
   */
  private _checkForWins(): void {
    // TODO: implement me
  }

  /**
   * A Quantum Tic-Tac-Toe game ends when no more moves are possible.
   * This happens when all squares on all boards are either occupied or part of a won board.
   */
  private _checkForGameEnding(): void {
    // TODO: implement me
  }
}
