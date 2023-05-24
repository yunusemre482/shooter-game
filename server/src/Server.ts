import path from "path";
import http from "http";
import express, { Express } from "express";
import socketio from "socket.io";
import { Logger } from "./Logger";
import { ClientSocket } from "./ClientSocket";
import { Player } from "./Player";
import { Game } from "./Game";

const TICKRATE = 30;
const TICK_INTERVAL = 1000 / TICKRATE;

export class Server {
    private readonly _io: socketio.Server;
    private readonly _game: Game;

    constructor(
        private readonly _logger: Logger,
        private readonly _port: number,
        private readonly _app: Express,
        private readonly _http: http.Server
    ) {
        this._io = socketio(this._http);
        this._game = new Game(this._logger);

        this.listenWebsocket();
        this.listenStatic();

        setInterval(() => this.updateGame(), TICK_INTERVAL);

        this._logger.log(
            `Server is running at https://localhost:${this._port}`
        );
    }

    private updateGame(): void {
        this._game.update();
    }

    private listenStatic(): void {
        this._http.listen(8080, "127.0.0.1");
    }

    private listenWebsocket(): void {
        this._io.on(`connection`, (socket) => {
            const clientSocket = new ClientSocket(this._logger, socket);
            const player = new Player(clientSocket, { health: 100, isMoving: false, position: [0, 0, 0], direction: [0, 0, 0, 0] });
            this._game.addPlayer(player);


            socket.on("hit", (playerID: string) => {
                this._game.hitPlayer(playerID);
                const isDead = this._game.isPLayerDead(playerID);

                if (isDead) {
                    this._game.removePlayer(playerID);
                    socket.to(playerID).emit("dead");
                }

            });

            socket.on("gameOver", (playerTime: number) => {


                console.log("game over", playerTime);

                const playerID = socket.id.toString();

                socket.emit("gameOver", "You ", playerTime)
                socket.broadcast.emit("gameOver", `Player-${playerID}`, playerTime);

                setTimeout(() => {
                    console.log("restart game");
                    this._game.restartGame();
                }, 10000);

            });






            socket.on("disconnect", () => {
                this._game.removePlayer(player.id);
                this._logger.userLog(socket.id.toString(), "disconnected");
            });
        });
    }
}
