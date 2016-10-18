"use strict";

var assert = require("assert");
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
    it("should emit matchmaing event on join", function(done) {
      var game = new Game(2);

      var stub = genTestSockets(function(type, msg) {
        assert.ok(msg.type, "joined");
        done();
      });

      var player = genTestPlayer("test", stub);
      game.addPlayer(player);
    });
  });
});
