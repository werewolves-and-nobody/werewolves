"use strict";

const ROLE_NOBODY = "nobody";
const ROLE_WEREWOLVES = "werewolf";

var helpers = require("./helpers.js");
var async = require("async");
var debug = require("debug")("werewolves:game");

var Game = function Game(numPlayers) {
  this.players = [];
  this.numPlayers = numPlayers;
};

Game.prototype.actions = [
  "setNightAction",
  "werewolvesAction",
  "setDayAction",
  "dawnOfDeathAction",
  "voteAction",
  "killVictimsAction",
];

Game.prototype.addPlayer = function addPlayer(player) {
    debug("Adding new player to pool: " + player.name);
    this.players.push(player);

    player.socket.emit("game event", {
      type: "joined",
      msg: "Joined game matchmaking"
    });
  };

Game.prototype.canStartGame = function canStartGame() {
    return this.players.length >= this.numPlayers;
  };

Game.prototype.startGame = function startGame() {
  this.currentAction = -1;
  this.currentDay = 0;
  this.victims = [];

  // Everyone starts as a nobody
  this.everyone = this.players.slice();
  this.players.forEach(function(p) {
    p.role = ROLE_NOBODY;
  });

  // Format players before affecting roles
  var formattedPlayers = this.players.map(function(p) {
    return p.name;
  });

  helpers.shuffle(this.players);

  this.players[0].role = ROLE_WEREWOLVES;
  this.everyone.forEach(function(player) {
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
  return this.players.find(function(p) {
    return p.name.toLowerCase() === name.toLowerCase();
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

  var werewolvesCount = this.getRoles(ROLE_WEREWOLVES).length;

  if(this.players.length === 1 || werewolvesCount === 0 ||  werewolvesCount === this.players.length) {
    this.players.forEach(function(p) {
      p.socket.emit("game event", {
        type: "win",
        msg: "You win. GG."
      });
    });

    return;
  }

  if(this.currentAction >= this.actions.length) {
    debug("Starting new day");
    this.currentDay += 1;
    this.currentAction = 0;
  }

  var nextAction = this.actions[this.currentAction];
  debug("Doing action #" + this.currentAction + ": " + nextAction);
  this[nextAction]();

  return nextAction;
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

      if(!allEqual || !victim) {
        debug("Quorum failed. Trying again.");
        notifyWerewolves("Please ensure you all eat the same person. Thanks. Persons voted: " + msgs.join(", "));
        return;
      }

      victim.causeOfDeath = "Eaten by werewolves.";

      self.victims.push(victim);

      self.doNextAction();
    });
  };

  notifyWerewolves("EAT SOMEONE OM NOM");
};

Game.prototype.killVictimsAction = function() {
  this.killVictims();
  this.doNextAction();
};

Game.prototype.killVictims = function() {
  var self = this;
  self.victims.forEach(function(v) {
    v.socket.emit("game event", {
      type: "death",
      msg: "You died: " + v.causeOfDeath + ". Poor soul. Go play Mario."
    });

    self.players.splice(self.players.indexOf(v), 1);
  });

  self.victims = [];
};


Game.prototype.dawnOfDeathAction = function dawnOfDeathAction() {
  var victims = this.victims;
  this.killVictims();

  var victimsFormatted = victims.map(function(v) {
    return {name: v.name, role: v.role};
  });

  this.players.forEach(function(p) {
    p.socket.emit("game event", {
      type: "dawn",
      msg: "You survived. GJ. Players killed during the night: " + victimsFormatted
    });
  });
  this.everyone.forEach(function(p) {
    p.socket.emit("game event", {
      type: "killed",
      killed: victimsFormatted,
    });
  });

  this.doNextAction();
};

Game.prototype.setNightAction = function setNightAction() {
  this.everyone.forEach(function(p) {
    p.socket.emit("game event", {
      type: "timechange",
      time: "night"
    });
  });

  this.doNextAction();
};

Game.prototype.setDayAction = function setDayAction() {
  this.everyone.forEach(function(p) {
    p.socket.emit("game event", {
      type: "timechange",
      time: "day"
    });
  });

  this.doNextAction();
};

Game.prototype.voteAction = function voteAction() {
  var self = this;

  function notifyVote(description) {
    var identifier = self.getCurrentIdentifier();
    debug("Time to vote");
    async.map(self.players, function(player, cb) {
      player.socket.emit("game event", {
        type: "rfa",
        description: description,
        choices: self.players.map(function(p) {
          return p.name;
        }),
        identifier: identifier
      });

      player.socket.once(identifier, function(msg) {
        debug("Voting: " + msg);

        player.socket.emit("game event", {
          type: "ack",
          msg: "You voted for " + msg
        });
        cb(null, msg);
      });
    }, function(err, msgs) {
      var candidates = {};
      msgs.forEach(function(m) {
        if(!candidates[m]) {
          candidates[m] = 0;
        }

        candidates[m] += 1;
      });

      debug("Built candidates: ", candidates);

      var victim = Object.keys(candidates).reduce(function(c, currCandidate) {
        if(currCandidate === null || candidates[currCandidate] < candidates[c]) {
          return c;
        }
        return currCandidate;
      }, null);

      victim = self.getPlayerByName(victim);

      if(!victim) {
        debug("Invalid vote");
        notifyVote("U fucking morons vote for someone in your village");
        return;
      }

      self.players.forEach(function(p) {
        p.socket.emit("game event", {
          type: "vote",
          msg: "End of vote, village picked " + victim.name + "."
        });
      });
      self.everyone.forEach(function(p) {
        p.socket.emit("game event", {
          type: "killed",
          killed: [{name: victim.name, role: victim.role}],
        });
      });

      victim.causeOfDeath = "Hung by town.";
      self.victims.push(victim);

      self.doNextAction();
    });
  }

  notifyVote("Vote to hang someone");
};



module.exports = Game;
