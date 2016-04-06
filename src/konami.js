'use strict';

var $ = require('jquery');

module.exports = function() { $(function() {
  try {
    window; requestAnimationFrame; cancelAnimationFrame; document.body;
    var elem = document.createElement('div');
    document.body.appendChild(elem); document.body.removeChild(elem);
  } catch (error) { return; }

  // Settings
  var konami = [38, 38, 40, 40, 37, 39, 37, 39, 66, 65]
    , pointer = 0;

  var sizeMin = 6, sizeMax = 10 - sizeMin;

  var colorRedMin   = 0, colorRedMax   = 255 - colorRedMin
    , colorGreenMin = 0, colorGreenMax = 255 - colorGreenMin
    , colorBlueMin  = 0, colorBlueMax  = 255 - colorBlueMin;

  // Globals
  var $window = $(window)
    , random = Math.random
    , timer = undefined
    , frame = undefined
    , confetti = [];

  // Create the overarching container
  var container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top      = '0';
  container.style.left     = '0';
  container.style.width    = '100%';
  container.style.height   = '0';
  container.style.overflow = 'visible';

  // Confetto constructor
  function Confetto() {
    this.outer = document.createElement('div');
    this.inner = document.createElement('div');
    this.outer.appendChild(this.inner);

    var outerStyle = this.outer.style, innerStyle = this.inner.style;
    outerStyle.position = 'absolute';
    outerStyle.width  = (sizeMin + sizeMax * random()|0) + 'px';
    outerStyle.height = (sizeMin + sizeMax * random()|0) + 'px';
    innerStyle.width  = '100%';
    innerStyle.height = '100%';
    innerStyle.backgroundColor = 'rgb(' +
      (colorRedMin   + colorRedMax   * random()|0) + ',' +
      (colorGreenMin + colorGreenMax * random()|0) + ',' +
      (colorBlueMin  + colorBlueMax  * random()|0) + ')';

    outerStyle.perspective = '50px';
    outerStyle.transform = 'rotate(' + (360 * random()|0) + 'deg)';
    this.axis = 'rotate3D(' +
      Math.cos(360 * random()|0) + ',' +
      Math.cos(360 * random()|0) + ',0,';
    this.theta = 360 * random()|0;
    innerStyle.transform = this.axis + this.theta + 'deg)';

    this.x = $window.width() * random()|0;
    this.y = 0;
    outerStyle.left = this.x + 'px';
    outerStyle.top  = this.y + 'px';
    this.update = function(height, delta) {
      this.y += delta/4;
      this.theta += delta/2;
      outerStyle.top = this.y + 'px';
      innerStyle.transform = this.axis + this.theta + 'deg)';
      return this.y > height;
    };
  }

  function poof() {
    if (!frame) {
      // Append the container
      document.body.appendChild(container);

      // Add confetti
      (function addConfetto(count) {
        if (count > 100)
          return timer = undefined;

        var confetto = new Confetto();
        confetti.push(confetto);
        container.appendChild(confetto.outer);
        timer = setTimeout(addConfetto.bind(null, count+1), 15);
      })(0);

      // Start the loop
      var prev = undefined;
      requestAnimationFrame(function loop(timestamp) {
        var delta = prev ? timestamp - prev : 0;
        prev = timestamp;
        var height = $window.height();

        for (var i = confetti.length-1; i >= 0; --i)
          if (confetti[i].update(height, delta)) {
            container.removeChild(confetti[i].outer);
            confetti.splice(i, 1);
          }

        if (timer || confetti.length)
          return frame = requestAnimationFrame(loop);

        // Cleanup
        document.body.removeChild(container);
        frame = undefined;
      });
    }
  }

  $window.keydown(function(event) {
    pointer = konami[pointer] === event.which
      ? pointer+1
      : +(event.which === konami[0]);
    if (pointer === konami.length) {
      pointer = 0;
      poof();
    }
  });
}); };
