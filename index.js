"use strict";

var express = require("express");
var app = express();

var server = require('http').Server(app);
var io = require('socket.io')(server);
var Game = require('./game');

var currentlyBuildingGame = new Game();
app.use(express.static('public'));

app.get("*", function(req, res) {
  res.sendfile('public/index.html');
});

server.listen(process.env.PORT || 3000, function() {
  console.log("Listening.");
});

io.on('connection', function(socket) {
  console.log('a user connected');

  socket.on('disconnect', function() {
    console.log('user disconnected.');
  });

  socket.on('join', function(msg) {
    currentlyBuildingGame.addPlayer({
      name: msg,
      socket: socket
    });

    if(currentlyBuildingGame.canStartGame()) {
      currentlyBuildingGame.startGame();
      currentlyBuildingGame = new Game();
    }
  });
});
