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
    it("should affect role to everyone, with at least one werewolf", function(done) {
      var game = new Game(1);

      var stub = genTestSockets(function(type, msg) {
        if(msg.type === "start") {
          assert.equal(msg.role, "werewolf");
          assert.deepEqual(msg.players, ["test"]);
          done();
        }
      });

      var player = genTestPlayer("test", stub);
      game.addPlayer(player);
      assert.ok(game.canStartGame());

      game.startGame();
    });
  });

  describe("Game flow", function() {
    var p1 = genTestPlayer("p1", genTestSockets());
    var p2 = genTestPlayer("p2", genTestSockets());
    var p3 = genTestPlayer("p3", genTestSockets());
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
    it("should have one werewolf", function(done) {
      async.each([p1, p2, p3], function(p, cb) {
        p.socket.stubEmitter = function(type, msg) {
          if(msg.type === "start") {
            if(msg.role === "werewolf") {
              werewolf = p;
            }
            cb();
          }
        };
      }, function() {
        if(!werewolf) {
          throw new Error("No werewolves detected.");
        }

        done();
      });

      game.startGame();
    });

    it("should ask the werewolf to vote for someone", function(done) {
      game.advanceUntilAction("werewolvesAction");

      assert.equal(werewolf.socket.emits[0].type, "rfa");
      assert.equal((werewolf === p1 ? p2 : p1).socket.emits[0].type, "timechange"); // should've just gone night
      done();
    });

    it("should ensure the werewolf vote for an existing player", function(done) {
      werewolf.socket.ons[game.getCurrentIdentifier()]("doesnotexist");

      // Should have been acknowledged, and asked again
      assert.equal(werewolf.socket.emits[0].type, "rfa");
      assert.equal(werewolf.socket.emits[1].type, "ack");
      assert.equal(werewolf.socket.emits[2].type, "rfa");
      done();
    });


    it("should register vote on existing player", function(done) {
      werewolf.socket.ons[game.getCurrentIdentifier()](werewolf === p1 ? p2.name : p1.name);

      assert.equal(werewolf.socket.emits[0].type, "ack");
      assert.equal(werewolf.socket.emits[1].type, "rfa");
      done();
    });

    it("should kill the loser", function(done) {
      game.advanceUntilAction("dawnOfDeathAction");

      // Player not werewolf should now be dead
      assert.equal((werewolf === p1 ? p2 : p1).socket.emits[0].type, "killed");
      assert.equal((werewolf === p1 ? p2 : p1).socket.emits[1].type, "death");

      done();
    });

    it("should ask survivors to vote for an existing player", function(done) {
      game.advanceUntilAction("voteAction");

      // Everyone else should be voting
      assert.equal((werewolf === p1 ? p1 : p2).socket.emits[0].type, "rfa");
      assert.equal(p3.socket.emits[0].type, "rfa");

      p3.socket.ons[game.getCurrentIdentifier()]("trump");
      (werewolf === p1 ? p1 : p2).socket.ons[game.getCurrentIdentifier()]("trump");

      process.nextTick(function() {
        assert.equal(p3.socket.emits[0].type, "rfa");
        assert.ok(p3.socket.emits[0].description.indexOf("morons") !== -1);
        done();
      });
    });

    it("should hang the player they're voting for", function(done) {
      game.advanceUntilAction("voteAction");

      // Everyone should be voting
      assert.equal((werewolf === p1 ? p1 : p2).socket.emits[0].type, "rfa");
      assert.equal(p3.socket.emits[0].type, "rfa");

      p3.socket.ons[game.getCurrentIdentifier()](p3.name);
      (werewolf === p1 ? p1 : p2).socket.ons[game.getCurrentIdentifier()](p3.name);

      process.nextTick(function() {
        game.advanceUntilAction("killVictimsAction");

        assert.equal(p3.socket.emits[0].type, "death");
        done();
      });
    });

    it("should display the winner of the game", function(done) {
      game.realDoNextAction();

      assert.equal((werewolf === p1 ? p1 : p2).socket.emits[0].type, "win");

      done();
    });
  });
});
