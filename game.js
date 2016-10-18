"use strict";

const WEREWOLVES_PROPORTION = .2;
const ROLE_NOBODY = "nobody";
const ROLE_WEREWOLVES = "werewolf";

var helpers = require("./helpers.js");
var debug = require("debug")("werewolves:game");

var Game = function Game() {
  this.players = [];
};

Game.prototype.addPlayer = function addPLayer(player) {
    debug("Adding new player to pool: " + player.name);
    this.players.push(player);

    player.socket.emit("game event", {
      type: "Joined game matchmaking"
    });
  };

Game.prototype.canStartGame = function canStartGame() {
    return this.players.length >= 2;
  };

Game.prototype.startGame = function startGame() {
  // Everyone starts as a nobody
  this.players.forEach(function(p) {
    p.role = ROLE_NOBODY;
  });

  // Format players before affecting roles
  var formattedPlayers = this.players.map(function(p) {
    return p.name;
  });

  helpers.shuffle(this.players);

  this.players[0].role = ROLE_WEREWOLVES;

  this.players.forEach(function(player) {
    player.socket.emit("game event", {
      type: "start",
      role: player.role,
      players: formattedPlayers,
    });
  });
};


module.exports = Game;
