"use strict";

var debug = require("debug")("werewolves:game");

var Game = function Game() {
  this.players = [];
};

Game.prototype.addPlayer = function addPLayer(player) {
    debug("Adding new player to pool: " + player.name);
    this.players.push(player);
  };

Game.prototype.canStartGame = function canStartGame() {
    return this.players.length > 1;
  };

Game.prototype.startGame = function startGame() {
  debug("STARTING game");
};


module.exports = Game;
