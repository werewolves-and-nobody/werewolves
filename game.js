"use strict";

const ROLE_NOBODY = "nobody";
const ROLE_WEREWOLF = "werewolf";
const ROLE_DOCTOR = "doctor";

var helpers = require("./helpers.js");
var async = require("async");
var debug = require("debug")("werewolves:game");

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

var noopCb = function noopCb(err) {
  if (err) {
    console.error(err);
  }   
};


var Game = function Game(numPlayers) {
  this.players = [];
  this.numPlayers = numPlayers;
};

Game.prototype.actions = [
  "setNightAction",
  "werewolvesAction",
  "doctorsAction",
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
  return this.players.length === this.numPlayers;
};

Game.prototype.assignRoles = function assignRoles(players, roles) {
  const totalPlayers = players.length;
  roles = roles || [
    {
      name: ROLE_WEREWOLF,
      min: 1,
      max: Math.ceil(totalPlayers / 4)
    }, 
    {
      name: ROLE_DOCTOR,
      min: 1,
      max: 1
    }
  ];

    
  // default all to nobody
  debug(`Resetting all roles to NOBODY`);
  players.forEach(function(p) {
    p.role = ROLE_NOBODY;
  });

  helpers.shuffle(players);
  var index = 0;

  roles.forEach(function(role) {
    var numRoles = getRandomInt(role.min, role.max);
    debug(`assigning ${numRoles} ${role.name}s`);

    while (numRoles > 0) {
      numRoles -= 1;
      players[index].role = role.name;
      debug(`${players[index].name} is a ${role.name}`);
      index += 1;
    };
  });
};

Game.prototype.startGame = function startGame(cb) {
  cb = cb || noopCb;
  this.currentAction = -1;
  this.currentDay = 0;
  this.victims = [];

  // Everyone starts as a nobody
  this.everyone = this.players.slice();
  this.assignRoles(this.players);

  // Format players before affecting roles
  var formattedPlayers = this.players.map(function(p) {
    return p.name;
  });

  this.everyone.forEach(function(player) {
    player.socket.emit("game event", {
      type: "start",
      role: player.role,
      players: formattedPlayers,
    });
  });

  this.doNextAction();
  cb();
};

Game.prototype.getPlayersByRole = function getPlayersByRole(role) {
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

  var werewolvesCount = this.getPlayersByRole(ROLE_WEREWOLF).length;

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

Game.prototype.notifyRfa = function notifyRfa(role, title, description, choices, cb) { 
  var self = this;
  var identifier = self.getCurrentIdentifier();
  var players = self.getPlayersByRole(role);
  debug(`Notifying ${role}, ${description}`);

  async.map(players, function(player, cb) {
    player.socket.emit("game event", {
      type: "rfa",
      title: title,
      description: description,
      choices: choices,
      identifier: identifier
    });
    player.socket.once(identifier, function(msg) {
      debug(`Player RFA choice: ${msg}`);

      player.socket.emit("game event", {
        type: "ack",
        msg: msg
      });

      cb(null, msg);
    });
  }, function(err, responses) {
      var allEqual = responses.every(function(response) {
        return response === responses[0];
      });

      var victim = self.getPlayerByName(responses[0]);

      if(!allEqual || !victim) {
        debug("${role} failed to pick, starting again.");
        self.notifyRfa(role, 
          title, "You have to choose the same person. Persons voted: " + responses.join(", "), 
          choices, cb);
        return;
      }

      cb(null, victim);
      return;
    });
};

Game.prototype.doctorsAction = function doctorsAction() {
  var self = this;

  var players = self.players.map(function(p) {
    return p.name;
  });

  self.notifyRfa(ROLE_DOCTOR, 
    "Heal someone", 
    "Pick someone and save them tonight", 
    players, 
  function(err, choice) {
    var index = self.victims.indexOf(choice);
    if (index !== -1) {
      self.victims.splice(self.victims.indexOf(choice), 1);
    }
    self.doNextAction();
  });
};

Game.prototype.werewolvesAction = function werewolvesAction() {
  var self = this;
  var notifyWerewolves = function notifyWerewolves(description) {
    var werewolves = self.getPlayersByRole(ROLE_WEREWOLF);
    var identifier = self.getCurrentIdentifier();
    debug("Notifying werewolves, time to eat");
    async.map(werewolves, function(werewolf, cb) {
      werewolf.socket.emit("game event", {
        type: "rfa",
        title: "Eat someone",
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
      type: "timechange",P
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
