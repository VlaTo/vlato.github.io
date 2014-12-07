// game.js
(function(scope, document){
	'use strict'

	//
	// main game object
	scope.Game = function(options) {
		var ACTION_DISTANCE = 100.0;
		var DISTANCE_DELTA = 0.3;

		var ColorType = {
			Color1: 0,
			Color2: 1,
			Color3: 2,
			Color4: 3
		};

		this.options = options || {};

		this.canvas = null;
		this.context = null;

		this.width = 0;
		this.height = 0;
		this.origin = null;

		this.timer = null;
		this.action = null;
		this.actors = [];
		this.tracks = [];
		this.overlays = [];
		this.score = null;
		this.lastActorTicks = null;

		this.gravity = new Vector2(0.0, 0.3);

		function findTrack(tracks, actor) {
			var minimal = Infinity;
			var candidate = null;

			for(var index = 0; index < tracks.length; index++) {
				var track = tracks[index];

				if (track == actor.track) {
					continue;
				}

				var distance = track.distance(actor);

				if (distance < minimal) {
					candidate = track;
					minimal = distance;
				}
			}

			return candidate;
		};

		//
		// Timer object
		function Timer() {
			function getTicks() {
				return (new Date()).getTime();
			}

			this.started = getTicks();

			this.ticks = function() {
				return getTicks();
			};

			this.elapsed = function() {
				return getTicks() - this.started;
			};
		};

		//
		// Vector2D object
		function Vector2(x, y) {
			this.x = x;
			this.y = y;

			this.length = function() {
				// var v = Math.abs(this.x - point.x);
				// var h = Math.abs(this.y - point.y);
				return Math.pow(this.x * this.x + this.y * this.y, 0.5);
			};

			this.scalar = function(factor) {
				return new Vector2(this.x * factor, this.y * factor);
			};

			this.distance = function(vector) {
				return this.sub(vector).length();
			};

			this.normalize = function() {
				var len = this.length();
				return new Vector2(this.x / len, this.y / len);
			};

			this.add = function(vector) {
				return new Vector2(this.x + vector.x, this.y + vector.y);
			};

			this.sub = function(vector) {
				return new Vector2(this.x - vector.x, this.y - vector.y);
			};
		};

		//
		//
		function Bounds(left, top, right, bottom) {
			this.left = left;
			this.top = top;
			this.right = right;
			this.bottom = bottom;

			this.contains = function(vector) {
				return (left <= vector.x && vector.x < right) && (top <= vector.y && vector.y < bottom);
			};

			this.test = function(bounds) {
				var flags = [false, false, false, false, false, false, false, false, false];

				if (bounds.left <= this.left) {
					flags[0] = true;
					flags[1] = bounds.right > this.left;
					// пересекает левую границу
				}

				if (bounds.right >= this.right) {
					flags[2] = true;
					flags[3] = bounds.left < this.right;
				}

				if (bounds.top <= this.top) {
					flags[4] = true;
					flags[5] = bounds.bottom > this.top;
				}

				if (bounds.bottom >= this.bottom) {
					flags[6] = true;
					flags[7] = bounds.top < this.bottom;
				}

				flags[8] = false;

				return flags;
			};
		}

		//
		// Track object
		function Track(type, middle, halfWidth, length, score) {
			this.type = type;
			this.score = score;
			this.origin = new Vector2(middle - halfWidth, -length / 2.0);
			this.halfWidth = halfWidth;
			this.length = length;

			this.draw = function(context) {
				/*context.save();

				context.translate(this.origin.x, this.origin.y);

				context.fillStyle = 'white';
				context.font = 'bold 12pt Calibri';
				context.fillText(this.count.toString(), 10.0, 15.0);

				context.restore();*/
			};

			this.drop = function(actor) {
				if (actor.type == this.type) {
					this.score.increment();
				} else {
					this.score.decrement();
				}
			};

			this.distance = function(actor) {
				var vector = actor.mass();
				return new Vector2(this.origin.x + this.halfWidth, vector.y).distance(vector);
			};

			this.isRight = function(actor) {
				var vector = actor.mass();
				return (this.origin.x + this.halfWidth) < vector.x;
			};

			this.apply = function(actor, acceleration) {
				var distance = this.distance(actor);

				if (distance > DISTANCE_DELTA) {
					var force = new Vector2(this.isRight(actor) ? -distance : distance, 0.1).normalize();
					return acceleration.add(new Vector2(force.x, 0.0));
				}

				return acceleration;
			};
		}

		//
		// ActionPoint object
		function ActionPoint(x, y, touch) {
			this.origin = new Vector2(x, y);
			this.touch = touch;

			var radius = 20;

			this.apply = function(actor, acceleration, elapsed) {
				var vector = actor.mass().sub(this.origin);
				var length = vector.length();

				if (length > ACTION_DISTANCE) {
					return acceleration;
				}

				var factor = 1.0 - vector.length() / ACTION_DISTANCE;

				return acceleration.add(new Vector2(vector.x, 0.0).scalar(factor));
			};

			this.draw = function(context) {
				context.save();

				context.translate(this.origin.x, this.origin.y);

				context.beginPath();
				context.arc(0.0, 0.0, radius, 0.0, Math.PI * 2);
				context.closePath();

				context.lineWidth = 1;
				context.strokeStyle = 'black';
				context.stroke();

				context.fillStyle = '#FFFFFF';
				context.fill();

				context.restore();
			};
		};

		//
		// Actor object
		function Actor(track, type, velocity, image) {
			var size = 80;

			this.type = type;
			this.track = track;
			this.origin = new Vector2(track.origin.x + (track.halfWidth - size / 2.0) + DISTANCE_DELTA + 0.1, track.origin.y);
			this.velocity = velocity || new Vector2(0.0, 0.0);
			this.image = image;
			this.center = new Vector2(size / 2.0, size / 2.0);
			this.ticks = null;

			this.mass = function() {
				return this.origin.add(this.center);
			};

			this.update = function(elapsed, acceleration) {
				if (this.ticks == null) {
					this.ticks = elapsed;
				}

				var duration = elapsed - this.ticks;

				this.origin = this.origin.add(this.velocity);
				this.velocity = this.velocity.scalar(0.5).add(acceleration);
			};

			this.draw = function(context) {
				context.save();

				context.translate(this.origin.x, this.origin.y);

				context.drawImage(this.image, 0.0, 0.0, size, size);

				context.restore();
			};

			this.getBounds = function() {
				var offset = 5;
				return new Bounds(
					this.origin.x + offset,
					this.origin.y + offset,
					this.origin.x + size - offset,
					this.origin.y + size - offset
				);
			};
		};

		//
		// Overlay object
		function Overlay(x, y, image, fx) {
			this.origin = new Vector2(x, y);
			this.image = image;
			this.fx = fx;

			this.ticks = null;
			this.x = 0.0;
			this.y = 0.0;
			this.direction = -0.1;

			this.update = function(elapsed) {
				if (this.ticks == null) {
					this.ticks = elapsed;
				}

				var duration = elapsed - this.ticks;

				this.fx(this, duration);
			};

			this.draw = function(context) {
				context.save();

				context.translate(this.origin.x, this.origin.y);
				context.drawImage(this.image, this.x, this.y, this.image.width, this.image.height);

				context.restore();
			};
		};

		//
		// Score object
		function Score(x, y, width, height) {
			var step = 100;

			this.origin = new Vector2(x, y);
			this.width = width;
			this.height = height;
			this.score = 0;
			this.color = 'white';

			this.increment = function() {
				this.score += step;
			};

			this.decrement = function() {
				this.score -= step;

				if (this.score <= 0) {
					this.score = 0;
				}
			};

			this.draw = function(context) {
				context.save();

				context.translate(this.origin.x, this.origin.y);

				context.font = 'bold 32pt Calibri';
				context.fillStyle = this.color;
				context.fillText('score: ' + this.score, 30.0, 35.0);

				context.restore();
			};
		}

		this.init = function(canvas) {
			this.canvas = canvas;

			if (!!canvas) {
				this.context = canvas.getContext('2d');
				this.width = canvas.width;
				this.height = canvas.height;
				this.origin = new Vector2(canvas.width / 2.0, canvas.height / 2.0);

				this.attachCanvasEvent('mousemove', this.onMouseMove.bind(this));
				this.attachCanvasEvent('mousedown', this.onMouseDown.bind(this));
				this.attachCanvasEvent('mouseup', this.onMouseUp.bind(this));

				this.attachCanvasEvent('touchstart', this.onTouchStart.bind(this));
				this.attachCanvasEvent('touchmove', this.onTouchMove.bind(this));
				this.attachCanvasEvent('touchend', this.onTouchEnd.bind(this));
			}

			this.timer = new Timer();

			this.score = new Score(- this.origin.x, - this.origin.y, this.width, 50.0);

			this.tracks.push(new Track(ColorType.Color1, -240.0, 80.0, this.height, this.score));
			this.tracks.push(new Track(ColorType.Color2, -80.0, 80.0, this.height, this.score));
			this.tracks.push(new Track(ColorType.Color3, 80.0, 80.0, this.height, this.score));
			this.tracks.push(new Track(ColorType.Color4, 240.0, 80.0, this.height, this.score));

			this.assets = {
				images: []
			};

			if (this.options.images) {
				for (var name in this.options.images) {
					var source = this.options.images[name];
					var image = new Image();

					image.src = source;

					this.assets.images[name] = image;

				}
			}

			var fx = function(overlay, duration) {
				var x = overlay.origin.x + overlay.x + overlay.image.width;
				var width = - this.origin.x + this.width;

				if ((x < width) || (overlay.x > 0.0)) {
					overlay.direction *= -1.0;
				}

				overlay.x += overlay.direction;
			}.bind(this);

			this.overlays.push(new Overlay(- this.origin.x, - this.origin.y, this.assets.images['dust1'], fx));
		};

		this.attachCanvasEvent = function(event, callback) {
			var element = this.canvas;

			if (element.addEventListener) {
				element.addEventListener(event, callback, false);
			} else if (element.attachEvent) {
				element.attachEvent('on' + event, callback);
			}
		};

		this.update = function(elapsed) {
			var bounds = new Bounds(- this.origin.x, - this.origin.y, this.origin.x, this.origin.y - 80.0);

			for(var index = 0; index < this.actors.length;) {
				var actor = this.actors[index];
				var track = actor.track;
				var acceleration = this.gravity;

				if (this.action != null) {
					acceleration = this.action.apply(actor, acceleration, elapsed);
				}

				var distance = track.distance(actor);

				if (distance > track.halfWidth) {
					track = findTrack(this.tracks, actor);

					if (track == null) {
						debugger
					}

					actor.track = track;
				}

				acceleration = track.apply(actor, acceleration);

				actor.update(elapsed, acceleration);

				var flags = bounds.test(actor.getBounds());

				if (flags[0]) {
					actor.velocity = new Vector2(- actor.velocity.x, actor.velocity.y);
				}
				else if (flags[2]) {
					actor.velocity = new Vector2(- actor.velocity.x, actor.velocity.y);
				}

				if (true == flags[6] && flags[6] == flags[7]) {
					var track = actor.track;

					track.drop(actor);
					this.actors.splice(index, 1);

					continue;
				}

				index++;
			}

			if (this.lastActorTicks == null || (elapsed - this.lastActorTicks) > 2500) {
				var colors = [
					 { type: ColorType.Color1, name: 'color1' },
					 { type: ColorType.Color2, name: 'color2' },
					 { type: ColorType.Color3, name: 'color3' },
					 { type: ColorType.Color4, name: 'color4' }
				];

				var track = this.tracks[Math.round(Math.random() * 3)];
				var acc = colors[Math.round(Math.random() * 3)];

				this.actors.push(new Actor(track, acc.type, null, this.assets.images[acc.name]));
				this.lastActorTicks = elapsed;
			}

			for (var index = 0; index < this.overlays.length; index++) {
				var overlay = this.overlays[index];
				overlay.update(elapsed);
			};

			return true;
		};

		this.run = function() {
            var self = this;
            var onframe = scope.requestAnimationFrame || 
                    scope.webkitRequestAnimationFrame ||
                    scope.mozRequestAnimationFrame ||
                    scope.oRequestAnimationFrame ||
                    scope.msRequestAnimationFrame ||
                    function(callback) {
		                scope.setTimeout(callback, 1000 / 60);
		            };

            var callback = function () {
                if (self.update(self.timer.elapsed())) {
                    self.draw();
                }

                onframe(callback);
            };

            this.draw();

            onframe(callback);
		};

		this.draw = function() {
			this.context.setTransform(1.0, 0.0, 0.0, 1.0, 0.0, 0.0);
			this.context.clearRect(0, 0, this.width, this.height);

			this.context.drawImage(this.assets.images['background'], 0.0, 0.0, this.width, this.height);

			this.context.translate(this.origin.x, this.origin.y);

			for(var index = 0; index < this.tracks.length; index++) {
				var track = this.tracks[index];
				track.draw(this.context);
			}

			for(var index = 0; index < this.actors.length; index++) {
				var actor = this.actors[index];
				actor.draw(this.context);
			}

			this.score.draw(this.context);

			if (this.action != null) {
				this.action.draw(this.context);
			}

			for(var index = 0; index < this.overlays.length; index++) {
				var overlay = this.overlays[index];
				overlay.draw(this.context);
			};
		};

		this.getMousePosition = function(args) {
			var rect = this.canvas.getBoundingClientRect();
			return new Vector2(
				Math.round(args.clientX - (rect.left + this.origin.x)), 
				Math.round(args.clientY - (rect.top + this.origin.y))
			);
		};

		this.onMouseDown = function(args) {
			args.preventDefault();

			if (this.action != null) {
				return;
			}

			var coords = this.getMousePosition(args);

			this.action = new ActionPoint(coords.x, coords.y);
		};

		this.onMouseMove = function(args) {
			args.preventDefault();

			if (this.action == null) {
				return;
			}

			var coords = this.getMousePosition(args);

			this.action.origin = coords;
		};

		this.onMouseUp = function(args) {
			args.preventDefault();

			if (this.action == null) {
				return;
			}

			this.action = null;
		};

		this.onTouchStart = function(args) {
			args.preventDefault();

			if (this.action != null && this.action.touch != null) {
				return;
			}

			var touch = args.changedTouches[0];
			var coords = this.getMousePosition(touch);

			this.action = new ActionPoint(coords.x, coords.y, { id: touch.identifier });
		};

		this.onTouchMove = function(args) {
			args.preventDefault();

			if (this.action == null || this.action.touch == null) {
				return;
			}

			for (var index = 0; index < args.changedTouches.length; index++) {
				var touch = args.changedTouches[index];

				if (this.action.touch.id == touch.identifier) {
					var coords = this.getMousePosition(touch);
					this.action.origin = coords;

					break;
				}
			}
		};

		this.onTouchEnd = function(args) {
			args.preventDefault();

			if (this.action == null || this.action.touch == null) {
				return;
			}

			for (var index = 0; index < args.changedTouches.length; index++) {
				var touch = args.changedTouches[index];

				if (this.action.touch.id == touch.identifier) {
					this.action = null;

					break;
				}
			}
		};
	};
}(window, document));