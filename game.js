"use strict";

const ROLE_NOBODY = "nobody";
const ROLE_WEREWOLVES = "werewolf";

var helpers = require("./helpers.js");
var async = require("async");
var debug = require("debug")("werewolves:game");

var Game = function Game() {
  this.players = [];
};

Game.prototype.actions = [
  "werewolvesAction",
  "dawnOfDeathAction",
  "voteAction",
];

Game.prototype.addPlayer = function addPLayer(player) {
    debug("Adding new player to pool: " + player.name);
    this.players.push(player);

    player.socket.emit("game event", {
      type: "Joined game matchmaking"
    });

    this.currentAction = -1;
    this.currentDay = 0;
    this.victims = [];
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
  this.players[1].role = ROLE_WEREWOLVES;
  this.players.forEach(function(player) {
    player.socket.emit("game event", {
      type: "start",
      role: player.role,
      players: formattedPlayers,
    });
  });

  this.doNextAction();

};

Game.prototype.getRoles = function getRoles(role) {
  return this.players.filter(function(p) {
    return p.role === role;
  });
};

Game.prototype.getPlayerByName = function getPlayerByName(name) {
  return this.players.filter(function(p) {
    return p.name === name;
  });
};

Game.prototype.getCurrentIdentifier = function getCurrentIdentifier() {
  return this.currentDay + "-" + this.currentAction;
};



Game.prototype.doNextAction = function doNextAction(err) {
  if(err) {
    throw err;
  }

  this.currentAction += 1;

  if(this.currentAction >= this.actions.length) {
    debug("Starting new day");
    this.currentDay += 1;
    this.currentAction = 0;
  }

  var nextAction = this.actions[this.currentAction];
  debug("Doing action #" + this.currentAction);
  this[nextAction]();
};


Game.prototype.werewolvesAction = function werewolvesAction() {
  var self = this;
  var notifyWerewolves = function notifyWerewolves(description) {
    var werewolves = self.getRoles(ROLE_WEREWOLVES);
    var identifier = self.getCurrentIdentifier();
    debug("Notifying werewolves, time to eat");
    async.map(werewolves, function(werewolf, cb) {
      werewolf.socket.emit("game event", {
        type: "rfa",
        description: description,
        choices: self.players.map(function(p) {
          return p.name;
        }),
        identifier: identifier
      });

      werewolf.socket.once(identifier, function(msg) {
        debug("Eating: " + msg);

        werewolf.socket.emit("game event", {
          type: "ack",
          msg: "You're eating " + msg
        });
        cb(null, msg);
      });
    }, function(err, msgs) {
      var allEqual = msgs.every(function(msg) {
        return msg === msgs[0];
      });

      var victim = self.getPlayerByName(msgs[0]);
      if(!allEqual && victim) {
        notifyWerewolves("Please ensure you all eat the same person. Thanks. Persons voted: " + msgs.join(", "));
      }

      victim.causeOfDeath = "Eaten by werewolves.";

      self.victims.push(victim);

      self.nextAction();
    });
  };

  notifyWerewolves("EAT SOMEONE OM NOM");
};

Game.prototype.dawnOfDeathAction = function dawnOfDeathAction() {
  this.victims.forEach(function(v) {
    v.socket.emit("game event", {
      type: "death",
      msg: "You died: " + v.causeOfDeath + ". Poor soul. Go play Mario."
    });

    this.players.splice(this.players.indexOf(v), 1);
  });

  var victimsFormatted = this.victims.map(function(v) {
    return v.name;
  });

  this.players.forEach(function(p) {
    p.socket.emit("game event", {
      type: "dawn",
      msg: "You survived. GG. Players killed:"
    });
  });

  this.players.forEach()
};

module.exports = Game;
