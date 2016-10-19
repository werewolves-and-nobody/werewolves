/* global $ */
/* global module */
/* global window */
(function() {
  'use strict';
  var UIHelper = function UIHelper() {

  };

  UIHelper.prototype.updateRole = function updateRole(role) {
    $('div.role-box #role').text(role);
  };

  UIHelper.prototype.updatePlayers = function updatePlayers(players) {
    // Show all the players names.
    players.forEach(function(p) {
      $('<li></li>').text(p).appendTo('.players-box ul');
    });
  };

  UIHelper.prototype.updateUI = function updateUI(time) {
    if(time === 'night') {
      $('span#night').show();
      $('span#day').hide();
    }
    else {
      $('span#night').hide();
      $('span#day').show();
    }
  };

  UIHelper.prototype.showModal = function showModal(opt) {
    opt = opt || {};
    var title = opt.title || 'default-title';
    var content = opt.content || 'default-content';


    $('#action').val("");
    $('#modal #action-title').text(title);
    $('#modal #action-text').text(content);

    $('#modal').show();
  };

  UIHelper.prototype.hideModal = function hideModal() {
    $('#modal').hide();
  };

  UIHelper.prototype.addDeath = function addDeath(player) {
    var $container = $('.list-of-deaths ul');
    var $deathEl = $('<li></li>').text(`${player.name} (${player.role})`);
    $container.append($deathEl);
  };

  UIHelper.prototype.addDeaths = function addDeaths(players) {
    var self = this;
    players.forEach(function(p) {
      self.addDeath(p);
    });
  };

  UIHelper.prototype.debug = function debug(message) {
    var $pre = $("#events");
    $pre.prepend(JSON.stringify(message, null, 2) + "\n\n");
  };

  UIHelper.prototype.playerDeath = function playerDeath(reason) {
    $('.death-container .reason').text(reason || '');
    $('.death-container').show();
  };

  if(typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = UIHelper;
  }
  else {
    window.UIHelper = UIHelper;
  }
})();
