// game.js
(function(scope){
	'use strict'

	//
	// main game object
	scope.Game = function(options) {
		var ACTION_DISTANCE = 80.0;

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
		function Track(type, middle, halfWidth, length) {
			this.type = type;
			// this.color = color;
			this.origin = new Vector2(middle - halfWidth, -length / 2.0);
			this.halfWidth = halfWidth;
			this.length = length;

			this.count = 0;

			this.draw = function(context) {
				context.save();

				context.translate(this.origin.x, this.origin.y);

				context.beginPath();
				context.rect(0.0, 0.0, this.halfWidth * 2.0, length);
				context.closePath();

				switch(this.type) {
					case ColorType.Color1:
						context.fillStyle = '#BFF2E6';
					break;

					case ColorType.Color2:
						context.fillStyle = '#BFE0F2';
					break;

					case ColorType.Color3:
						context.fillStyle = '#F0F2BF';
					break;

					case ColorType.Color4:
						context.fillStyle = '#F2BFEE';
					break;
				}

				context.fill();

				context.beginPath();
				context.moveTo(this.halfWidth * 2.0, 0.0);
				context.lineTo(this.halfWidth * 2.0, length);
				context.closePath();

				context.lineWidth = 2;
				context.strokeStyle = 'black';
				context.stroke();

				context.fillStyle = 'white';
				context.font = 'bold 12pt Calibri';
				context.fillText(this.count.toString(), 10.0, 15.0);

				context.restore();
			};

			this.drop = function(actor) {
				if (actor.type == this.type) {
					this.count++;
				}
			};

			this.distance = function(actor) {
				var vector = actor.mass();
				return new Vector2(this.origin.x + this.halfWidth, vector.y).distance(vector);
			};

			this.update = function(actor) {
				var distance = this.distance(actor);
				var force = new Vector2(- distance, 0.1).normalize();

				force.y = 0.0;

				//actor.acceleration = actor.acceleration.add(force);
			};
		}

		//
		// ActionPoint object
		function ActionPoint(x, y) {
			this.origin = new Vector2(x, y);

			var radius = 20;

			this.apply = function(actor, elapsed, acceleration, distance) {
				var vector = actor.mass().sub(this.origin);
				var factor = 1 - Math.min(1, vector.length() / distance);

				vector = vector.normalize();
				vector.y = 0.0;

				return acceleration.add(vector.scalar(factor));

				// actor.velocity = actor.velocity.add(vector.scalar(factor));
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
		function Actor(track, type, velocity) {
			var size = 50;

			this.type = type;
			this.track = track;
			this.origin = new Vector2(track.origin.x + (track.halfWidth - size / 2.0), track.origin.y);
			this.velocity = velocity || new Vector2(0.0, 0.0);
			// this.acceleration = acceleration || new Vector2(0.0, 0.1);
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
				// this.acceleration = this.acceleration.scalar(0.3);
			};

			this.draw = function(context) {
				context.save();

				context.translate(this.origin.x, this.origin.y);

				context.beginPath();
				context.arc(size / 2.0, size / 2.0, size / 2.0, 0.0, Math.PI * 2);
				context.closePath();

				switch(this.type) {
					case ColorType.Color1:
						context.fillStyle = '#BFF2E6';
					break;

					case ColorType.Color2:
						context.fillStyle = '#BFE0F2';
					break;

					case ColorType.Color3:
						context.fillStyle = '#F0F2BF';
					break;

					case ColorType.Color4:
						context.fillStyle = '#F2BFEE';
					break;
				}

				// context.fillStyle = this.color;
				context.fill();

				context.lineWidth = 1.5;
				context.strokeStyle = 'black';
				context.stroke();

				/*context.fillStyle = 'white';
				context.font = 'normal 10pt Calibri';
				context.fillText(this.track.num.toString(), 5.0, 5.0);*/

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
			}

			this.timer = new Timer();

			this.tracks.push(new Track(ColorType.Color1, -150.0, 50.0, this.height));
			this.tracks.push(new Track(ColorType.Color2, -50.0, 50.0, this.height));
			this.tracks.push(new Track(ColorType.Color3, 50.0, 50.0, this.height));
			this.tracks.push(new Track(ColorType.Color4, 150.0, 50.0, this.height));
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
			var bounds = new Bounds(- this.origin.x, - this.origin.y, this.origin.x, this.origin.y);

			for(var index = 0; index < this.actors.length;) {
				var actor = this.actors[index];
				var acceleration = this.gravity;

				if (this.action != null) {
					// this.action.apply(actor, ACTION_DISTANCE);
					acceleration = this.action.apply(actor, elapsed, this.gravity, ACTION_DISTANCE);
				}

				actor.update(elapsed, acceleration);

				var track = actor.track;
				var distance = track.distance(actor);

				if (distance > track.halfWidth) {
					track = findTrack(this.tracks, actor);

					if (track == null) {
						debugger
					}

					actor.track = track;
				}

				track.update(actor);

				if (isNaN(actor.origin.x)) {
					debugger;
				}

				var flags = bounds.test(actor.getBounds());

				if (flags[0]) {
					actor.velocity = new Vector2(- actor.velocity.x, actor.velocity.y);
					//actor.force = new Vector2(- actor.force.x, actor.force.y);
				}
				else if (flags[2]) {
					actor.velocity = new Vector2(- actor.velocity.x, actor.velocity.y);
					//actor.force = new Vector2(- actor.force.x, actor.force.y);
				}

				if (true == flags[6] && flags[6] == flags[7]) {
					// console.log('[actor] velocity: ' + actor.velocity.y);
					var track = actor.track;

					track.drop(actor);
					this.actors.splice(index, 1);

					continue;
				}

				index++;
			}

			// if (this.actors.length == 0) {
				if (this.lastActorTicks == null || (elapsed - this.lastActorTicks) > 2500) {
					var colors = [ColorType.Color3, ColorType.Color2, ColorType.Color4, ColorType.Color1];
					var num = Math.round(Math.random() * 3);

					this.actors.push(new Actor(this.tracks[num], colors[num]));
					this.lastActorTicks = elapsed;
				}
			// }

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

			this.context.translate(this.origin.x, this.origin.y);

			this.context.beginPath();
			this.context.arc(0.0, 0.0, 2.0, 0.0, Math.PI * 2);
			this.context.closePath();

			this.context.strokeStyle = 'black';
			this.context.stroke();

			for(var index = 0; index < this.tracks.length; index++) {
				var track = this.tracks[index];
				track.draw(this.context);
			}

			for(var index = 0; index < this.actors.length; index++) {
				var actor = this.actors[index];
				actor.draw(this.context);
			}

			if (this.action != null) {
				this.action.draw(this.context);
			}
		};

		this.getMousePosition = function(args) {
			var rect = this.canvas.getBoundingClientRect();
			return new Vector2(
				Math.round(args.clientX - (rect.left + this.origin.x)), 
				Math.round(args.clientY - (rect.top + this.origin.y))
			);
		};

		this.onMouseDown = function(args) {
			if (this.action != null) {
				return;
			}

			var coords = this.getMousePosition(args);

			this.action = new ActionPoint(coords.x, coords.y);
		};

		this.onMouseMove = function(args) {
			if (this.action == null) {
				return;
			}

			var coords = this.getMousePosition(args);

			this.action.origin = coords;
		};

		this.onMouseUp = function(args) {
			if (this.action == null) {
				return;
			}

			this.action = null;
		};
	};
}(window));