"use strict";

var assert = require("assert");
var async = require("async");
var Game = require('../game.js');

var genTestSockets = function genTestSockets(emitter, receiver) {
  var socket = {
    emit: function() {
      if(emitter) {
        emitter.apply(this, arguments);
      }
    },
    on: function() {
      if(receiver) {
        receiver.apply(this, arguments);
      }
    },
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

    game.addPlayer(p1);
    game.addPlayer(p2);
    game.addPlayer(p3);

    assert.ok(game.canStartGame());
    it("should have one werewolf", function(done) {
      async.each([p1, p2, p3], function(p, cb) {
        p.socket.emit = function(type, msg) {
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
  });
});
