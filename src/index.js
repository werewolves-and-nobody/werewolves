"use strict";
var opbeat = require('opbeat').start({
  appId: '321d2eb48b',
  organizationId: '074620ff86eb42c4a4236dfa64824b12',
  secretToken: '3788a72215c2de6dea7da2447870533b09adf233'
})
var express = require("express");
var app = express();

var server = require('http').Server(app);
var pino = require('express-pino-logger')()

var io = require('socket.io')(server);
var Game = require('./game');

app.use(opbeat.middleware.express());
app.use(express.static('public'));
app.use(pino)

app.get("*", function(req, res) {
  res.sendFile('game-scene.html', {root: './public'});
});

var currentlyBuildingGame = new Game(3);
io.on('connection', function(socket) {
  socket.on('disconnect', function() {
  });

  socket.on('join', function(msg) {
    currentlyBuildingGame.addPlayer({
      name: msg,
      socket: socket
    });

    if(currentlyBuildingGame.canStartGame()) {
      currentlyBuildingGame.startGame();
      currentlyBuildingGame = new Game(3);
    }
  });
});

module.exports = server;