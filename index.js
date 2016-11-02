'use strict';

require('./src/konami');

module.exports = function poof() {
  typeof window !== 'undefined' &&
  window.pfKonami &&
  window.pfKonami();
};
