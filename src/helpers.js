"use strict";


module.exports.shuffle = function shuffle(a) {
  var j;
  var x;
  var i;
  for(i = a.length; i; i -= 1) {
    j = Math.floor(Math.random() * i);
    x = a[i - 1];
    a[i - 1] = a[j];
    a[j] = x;
  }
};
