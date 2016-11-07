/* global $ module window moment */
(function() {
  'use strict';
  var Player = function Player() {  };

  Player.prototype.setName = function setName(name) {
    this.name = name;
  };

  if(typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = Player;
  }
  else {
    window.Player = Player;
  }
})();
