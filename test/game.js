"use strict";

var assert = require("assert");
var async = require("async");
var Game = require('../game.js');

var genTestSockets = function genTestSockets(emitter, receiver) {
  var socket = {
    emit: function(type, msg) {
      if(socket.stubEmitter) {
        socket.stubEmitter.apply(this, arguments);
      }

      socket.emits.unshift(msg);
    },
    on: function(type, cb) {
      if(socket.stubReceiver) {
        socket.stubReceiver.apply(this, arguments);
      }

      // Assuming only one listener per type
      socket.ons[type] = cb;
    },
    // Emits history, in reverse order (first is the most recent)
    emits: [],
    ons: {},
    stubEmitter: emitter,
    stubReceiver: receiver
  };

  socket.once = socket.on;

  return socket;
};

var genTestPlayer = function(name, socket) {
  return {
    name: name,
    socket: socket
  };
};

var createRandomPlayer = function(name) {
  name = name || Math.random().toString(36).substring(7)
  return {
    name: name,
    socket: genTestSockets()
  }
}

describe("new Game()", function() {
  describe("addPlayer()", function() {
    it("should emit matchmaking event on join", function(done) {
      var game = new Game(2);

      var stub = genTestSockets(function(type, msg) {
        assert.equal(msg.type, "joined");
        done();
      });

      var player = genTestPlayer("test", stub);
      game.addPlayer(player);
    });
  });

  describe("startGame()", function() {
    it("should give a role to everyone, with at least one werewolf", function(done) {
      var game = new Game(5);

      game.addPlayer(createRandomPlayer());
      game.addPlayer(createRandomPlayer());
      game.addPlayer(createRandomPlayer());
      game.addPlayer(createRandomPlayer());
      game.addPlayer(createRandomPlayer());

      assert.ok(game.canStartGame());

      game.startGame(function() {
        assert.ok(game.getPlayersByRole('werewolf').length > 0, "Werewolf role not assigned");
        done();
      });
    });
    it("should give a role to everyone, with at least one doctor", function(done) {
      var game = new Game(5);

      game.addPlayer(createRandomPlayer());
      game.addPlayer(createRandomPlayer());
      game.addPlayer(createRandomPlayer());
      game.addPlayer(createRandomPlayer());
      game.addPlayer(createRandomPlayer());

      assert.ok(game.canStartGame());

      game.startGame(function() {
        assert.ok(game.getPlayersByRole('doctor').length > 0, "Doctor role not assigned");
        done();
      });
    });
  });

  describe("Game flow", function() {
    var p1 = createRandomPlayer("p1");
    var p2 = createRandomPlayer("p2");
    var p3 = createRandomPlayer("p3");
    var werewolf = null;

    var game = new Game(3);
    // Stub the automatic flow.
    game.realDoNextAction = game.doNextAction;
    game.doNextAction = function() {};
    game.advanceUntilAction = function(actionName) {
      while(game.realDoNextAction() !== actionName) {
        // Do nothing.
      }
    };

    game.addPlayer(p1);
    game.addPlayer(p2);
    game.addPlayer(p3);

    assert.ok(game.canStartGame());

    it("should have one each of nobody, werewolf and doctor", function(done) {
      assert.ok(game.canStartGame());

      game.startGame(function() {
        assert.ok(game.getPlayersByRole('doctor').length === 1, "Doctor role not assigned");
        assert.ok(game.getPlayersByRole('werewolf').length === 1, "Werewolf role not assigned");
        assert.ok(game.getPlayersByRole('nobody').length === 1, "Nobody role not assigned");
        done();
      });
    });

    it("should ask the werewolf to vote for a player", function(done) {
      game.advanceUntilAction("werewolvesAction");

      assert.equal(game.getPlayersByRole('werewolf')[0].socket.emits[0].type, "rfa");
      assert.equal(game.getPlayersByRole('doctor')[0].socket.emits[0].type, "timechange");
      assert.equal(game.getPlayersByRole('nobody')[0].socket.emits[0].type, "timechange");
      done();
    });

    it("should ensure the werewolf vote for an existing player", function(done) {
      var werewolf = game.getPlayersByRole('werewolf')[0];
      werewolf.socket.ons[game.getCurrentIdentifier()]("doesnotexist");

      // Should have been acknowledged, and asked again
      assert.equal(werewolf.socket.emits[0].type, "rfa");
      assert.equal(werewolf.socket.emits[1].type, "ack");
      assert.equal(werewolf.socket.emits[2].type, "rfa");
      done();
    });

    it("should register werewolves vote on existing player", function(done) {
      var werewolf = game.getPlayersByRole('werewolf')[0];
      var nobody = game.getPlayersByRole('nobody')[0]
      werewolf.socket.ons[game.getCurrentIdentifier()](nobody.name);

      assert.equal(werewolf.socket.emits[0].type, "ack");
      assert.equal(werewolf.socket.emits[1].type, "rfa");
      done();
    });

    it("should ask the doctor to vote for a player", function(done) {
      game.advanceUntilAction("doctorsAction");

      assert.equal(game.getPlayersByRole('werewolf')[0].socket.emits[0].type, "ack");
      assert.equal(game.getPlayersByRole('doctor')[0].socket.emits[0].type, "rfa");
      assert.equal(game.getPlayersByRole('nobody')[0].socket.emits[0].type, "timechange");
      done();
    });

    it("should ensure the doctor vote for an existing player", function(done) {
      var doctor = game.getPlayersByRole('doctor')[0];
      doctor.socket.ons[game.getCurrentIdentifier()]("doesnotexist");

      // Should have been acknowledged, and asked again
      assert.equal(doctor.socket.emits[0].type, "rfa");
      assert.equal(doctor.socket.emits[1].type, "ack");
      assert.equal(doctor.socket.emits[2].type, "rfa");
      done();
    });

    it("should register doctors vote on existing player", function(done) {
      var doctor = game.getPlayersByRole('doctor')[0];
      doctor.socket.ons[game.getCurrentIdentifier()](doctor.name); // save himself

      assert.equal(doctor.socket.emits[0].type, "ack");
      assert.equal(doctor.socket.emits[1].type, "rfa");
      done();
    });

    it("should kill the loser", function(done) {
      var nobody = game.getPlayersByRole('nobody')[0]
      game.advanceUntilAction("dawnOfDeathAction");
     
      // Player not game.getPlayersByRole('werewolf')[0] should now be dead
      assert.equal(nobody.socket.emits[0].type, "killed");
      assert.equal(nobody.socket.emits[1].type, "death");

      done();
    });

    it("should ask survivors to vote for an existing player", function(done) {
      game.advanceUntilAction("voteAction");

      var werewolf = game.getPlayersByRole('werewolf')[0]
      var doctor = game.getPlayersByRole('doctor')[0]

      assert.equal(werewolf.socket.emits[0].type, "rfa");
      assert.equal(doctor.socket.emits[0].type, "rfa");

      werewolf.socket.ons[game.getCurrentIdentifier()]("trump");
      doctor.socket.ons[game.getCurrentIdentifier()]("trump");

      process.nextTick(function() {
        assert.equal(doctor.socket.emits[0].type, "rfa");
        assert.ok(doctor.socket.emits[0].description.indexOf("morons") !== -1);
        done();
      });
    });

    it("should hang the player they're voting for", function(done) {
      game.advanceUntilAction("voteAction");

      var werewolf = game.getPlayersByRole('werewolf')[0]
      var doctor = game.getPlayersByRole('doctor')[0]

      assert.equal(werewolf.socket.emits[0].type, "rfa");
      assert.equal(doctor.socket.emits[0].type, "rfa");

      werewolf.socket.ons[game.getCurrentIdentifier()](doctor.name);
      doctor.socket.ons[game.getCurrentIdentifier()](doctor.name);

      process.nextTick(function() {
        game.advanceUntilAction("killVictimsAction");

        assert.equal(doctor.socket.emits[0].type, "death");
        done();
      });
    });

    it("should display the winner of the game", function(done) {
      game.realDoNextAction();

      assert.equal(game.getPlayersByRole('werewolf')[0].socket.emits[0].type, "win");

      done();
    });
  });
});
