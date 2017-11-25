;(function () {
  /* global requestAnimationFrame, cancelAnimationFrame */
  'use strict'

  // Don't do anything if `window` or `document` is undefined. This occurs when
  // trying to sneak this module through a smaller module whose testing
  // framework doesn't use PhantomJS or something similar.
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  document.addEventListener('DOMContentLoaded', function () {
    try {
      // Assert these things are available and keep failure silent
      // Honestly I shouldn't need to bother checking...
      /* eslint-disable no-unused-expressions */
      requestAnimationFrame
      cancelAnimationFrame
      setTimeout
      /* eslint-enable no-unused-expressions */
    } catch (error) {
      return
    }

    // Only initialize once
    if (window.pfKonami) {
      return
    }
    window.pfKonami = poof

    // Globals
    var random = Math.random
    var cos = Math.cos
    var sin = Math.sin
    var PI = Math.PI
    var PI2 = PI * 2
    var timer
    var frame
    var confetti = []

    // Trigger Sequence
    // (up, up, down, down, left, right, left, right, B, A)
    var konami = [ 38, 38, 40, 40, 37, 39, 37, 39, 66, 65 ]

    // Settings
    var particles = 150                       // How many confetti will spawn in each poof
    var spread = 40                           // Maximum length of time between spawning sequential confetti (in ms)
    var sizeMin = 3                           // Minimum width/height of each confetto (in px)
    var sizeMax = 12 - sizeMin                // Maximum width/height of each confetto (in px)
    var period = 7777                         // Time taken for a confetto to complete its spline (in ms)
    var eccentricity = 10                     // Overall "jaggedness" of the spline
    var deviation = 100                       // Maximum radius a confetto can be from its fixed point (in px)
    var dxThetaMin = -0.1                     // Minimum ∂x of a fixed-point-path is `sin(dxThetaMin)` (in px/ms)
    var dxThetaMax = -dxThetaMin - dxThetaMin // Maximum ∂x of a fixed-point-path is `sin(dxThetaMax)` (in px/ms)
    var dyMin = 0.13                          // Minimum ∂y of a fixed-point-path (in px/ms)
    var dyMax = 0.18                          // Maximum ∂y of a fixed-point-path (in px/ms)
    var dThetaMin = 0.4                       // Minimum speed a confetto will spin (in rad/ms)
    var dThetaMax = 0.7 - dThetaMin           // Maximum speed a confetto will spin (in rad/ms)

    // Color Settings
    var colorThemes = [
      function () {
        return color(175 * random() | 0, 175 * random() | 0, 175 * random() | 0)
      }, function () {
        var black = 175 * random() | 0; return color(175, black, black)
      }, function () {
        var black = 175 * random() | 0; return color(black, 175, black)
      }, function () {
        var black = 175 * random() | 0; return color(black, black, 175)
      }, function () {
        return color(178, 89, 178 * random() | 0)
      }, function () {
        return color(178 * random() | 0, 178, 178)
      }, function () {
        var black = 200 * random() | 0; return color(black, black, black)
      }, function () {
        return colorThemes[random() < 0.5 ? 1 : 2]()
      }, function () {
        return colorThemes[random() < 0.5 ? 3 : 5]()
      }, function () {
        return colorThemes[random() < 0.5 ? 2 : 4]()
      }
    ]
    function color (r, g, b) {
      return 'rgb(' + r + ',' + g + ',' + b + ')'
    }

    // Confetto animation explanation:
    // Each confetto is given a periodic spline, with X values in [0, 1] and Y
    // values in [0, 1].
    //
    // To generate a random spline, first a bunch of X values are selected from
    // [0, 1]. To avoid steep slopes in the spline, the X values cannot be
    // closer than `1/eccentricity` from each other. (Compute a 1D Maximal
    // Poisson Disc). It will also be important that X=0 and X=1 are included
    // in the sampling.
    //
    // 1 ^
    //   |
    //   |
    //   |
    // 0 x---x--x----x---x--x---x---x--x--x
    //   0                                1
    //
    // For each point, we assign a random value from [0, 1]. This gives us each
    // knot on the spline. It is also important that the Y value at X=0 matches
    // the Y value at X=1.
    //
    // 1 ^               x
    //   |      x           x   x
    //   x           x                    x
    //   |   x                      x  x
    // 0 x---x--x----x---x--x---x---x--x--x
    //   0                                1
    //
    // Now the points are connected using cosine interpolation.
    //
    // 1 ^                __
    //   |       ,--,   /   '''---_
    //   |     /     ''            \     __
    //   |'---'                     -__'
    // 0 +-------------------------------->
    //   0                                1
    //
    // Since f(0) = f(1) (and f'(0) = f'(1)) this spline can be repeated
    // indefinitely.
    //
    // 1 ^                __                               __
    //   |       ,--,   /   '''---_               ,--,   /   '''---_
    //   |     /     ''            \     __     /     ''            \     __
    //   |'---'                     -__'   '---'                     -__'
    // 0 +----------------------------------------------------------------->
    //   0                                1                                2
    //
    // If we interpret the X axis as an angle θ and the Y axis as a radius ρ,
    // where ρ is bounded by [0, deviation], the spline now represents a
    // "circular" curve around a fixed point.
    //
    // ρ ^                __                             __
    //   |       ,--,   /   '''---_                     |  '''.__
    //   |     /     ''            \     __   Becomes    ',   +   '-_
    //   |'---'                     -__'                   \        ,'
    // 0 +-------------------------------->                 '-__--'
    //   0                               2π
    //
    // When a confetto is spawned, a straight line path is created for this
    // "fixed point" to follow. This line is created parametrically by randomly
    // selecting its ∂x and ∂y randomly (∂x sampling will also be cosine-
    // weighted). As the fixed point moves along the line, the confetto moves
    // around the circular-spline-path around the fixed point.

    // Cosine interpolation
    function interpolation (a, b, t) {
      return (1 - cos(PI * t)) / 2 * (b - a) + a
    }

    // Create a 1D Maximal Poisson Disc over [0, 1]
    var radius = 1 / eccentricity
    var radius2 = radius + radius
    function createPoisson () {
      // domain is the set of points which are still available to pick from
      // D = union{ [d_i, d_i+1] | i is even }
      var domain = [ radius, 1 - radius ]
      var measure = 1 - radius2
      var disc = [ 0, 1 ]
      while (measure) {
        var dart = measure * random()
        var i, l, interval, a, b, c, d

        // Find where dart lies
        for (i = 0, l = domain.length, measure = 0; i < l; i += 2) {
          a = domain[i]
          b = domain[i + 1]
          interval = b - a
          if (dart < measure + interval) {
            disc.push(dart += a - measure)
            break
          }
          measure += interval
        }
        c = dart - radius
        d = dart + radius

        // Update the domain
        for (i = domain.length - 1; i > 0; i -= 2) {
          l = i - 1
          a = domain[l]
          b = domain[i]

          // a---b          a---b  Do nothing
          //   a-----b  a-----b    Move interior
          //   a--------------b    Split interval
          //         a--b          Delete interval
          //       c------d
          if (a >= c && a < d) {
            if (b > d) {
              domain[l] = d             // Move interior (Right case)
            } else {
              domain.splice(l, 2)       // Delete interval
            }
          } else if (a < c && b > c) {
            if (b <= d) {
              domain[i] = c             // Move interior (Left case)
            } else {
              domain.splice(i, 0, c, d) // Split interval
            }
          }
        }

        // Re-measure the domain
        for (i = 0, l = domain.length, measure = 0; i < l; i += 2) {
          measure += domain[i + 1] - domain[i]
        }
      }

      return disc.sort()
    }

    // Create the overarching container
    var container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.top = '0'
    container.style.left = '0'
    container.style.overflow = 'visible'
    container.style.zIndex = '9999'

    // Confetto constructor
    function Confetto (theme) {
      // Create the inner and outer containers
      this.frame = 0
      this.outer = document.createElement('div')
      this.inner = document.createElement('div')
      this.outer.appendChild(this.inner)

      // Initialize the size and color
      var outerStyle = this.outer.style
      var innerStyle = this.inner.style
      outerStyle.position = 'absolute'
      outerStyle.width = (sizeMin + sizeMax * random()) + 'px'
      outerStyle.height = (sizeMin + sizeMax * random()) + 'px'
      innerStyle.width = '100%'
      innerStyle.height = '100%'
      innerStyle.backgroundColor = theme()

      // Initialize the axis of rotation
      outerStyle.perspective = '50px'
      outerStyle.transform = 'rotate(' + (360 * random()) + 'deg)'
      this.axis = 'rotate3D(' +
        cos(PI * random()) + ',' +
        cos(PI * random()) + ',0,'
      this.theta = 360 * random()
      this.dTheta = dThetaMin + dThetaMax * random()
      innerStyle.transform = this.axis + this.theta + 'deg)'

      // Initialize the fixed-point position
      this.x = window.innerWidth * random()
      this.y = -deviation
      this.dx = sin(dxThetaMin + dxThetaMax * random())
      this.dy = dyMin + dyMax * random()
      outerStyle.left = this.x + 'px'
      outerStyle.top = this.y + 'px'

      // Initialize the periodic spline
      this.splineX = createPoisson()
      this.splineY = []
      for (var i = 1, l = this.splineX.length - 1; i < l; ++i) {
        this.splineY[i] = deviation * random()
      }
      this.splineY[0] = this.splineY[l] = deviation * random()

      this.update = function (height, delta) {
        // Updated fixed point position
        this.frame += delta
        this.x += this.dx * delta
        this.y += this.dy * delta
        this.theta += this.dTheta * delta

        // Compute spline and convert to polar
        var phi = this.frame % period / period
        var i = 0
        var j = 1
        while (phi >= this.splineX[j]) i = j++
        var rho = interpolation(
          this.splineY[i],
          this.splineY[j],
          (phi - this.splineX[i]) / (this.splineX[j] - this.splineX[i])
        )
        phi *= PI2

        // Update the absolute position based on the fixed-point and spline
        outerStyle.left = this.x + rho * cos(phi) + 'px'
        outerStyle.top = this.y + rho * sin(phi) + 'px'
        innerStyle.transform = this.axis + this.theta + 'deg)'

        // Return `false` if confetto is offscreen
        return this.y > height
      }
    }

    function poof () {
      'Markus was here. (http://pf-n.co/github/pf-konami)'

      if (!frame) {
        // Append the container
        document.body.appendChild(container)

        // Add confetti
        var theme = colorThemes[colorThemes.length * random() | 0]
        var count = 0
        ;(function addConfetto () {
          if (++count > particles) {
            timer = undefined
            return timer
          }

          var confetto = new Confetto(theme)
          confetti.push(confetto)
          container.appendChild(confetto.outer)
          timer = setTimeout(addConfetto, spread * random())
        })(0)

        // Start the loop
        var prev
        requestAnimationFrame(function loop (timestamp) {
          var delta = prev ? timestamp - prev : 0
          prev = timestamp
          var height = window.innerHeight

          // Update each confetto
          for (var i = confetti.length - 1; i >= 0; --i) {
            if (confetti[i].update(height + deviation, delta)) {
              container.removeChild(confetti[i].outer)
              confetti.splice(i, 1)
            }
          }

          // While there are confetti to draw, keep looping
          if (timer || confetti.length) {
            frame = requestAnimationFrame(loop)
            return frame
          }

          // Cleanup
          document.body.removeChild(container)
          frame = undefined
        })
      }
    }

    // Track keypresses
    var pointer = 0
    window.addEventListener('keydown', function (event) {
      var key = event.which || event.keyCode || 0
      if (key === konami[pointer]) {
        ++pointer
      } else {
        var curr = key
        var count = 1
        while (--pointer >= 0 && konami[pointer] === curr) {
          ++count
        }
        pointer = 0
        while (--count >= 0 && konami[pointer] === curr) {
          ++pointer
        }
      }
      if (pointer === konami.length) {
        pointer = 0
        poof()
      }
    }, true)
  })
})()
