// game.js
(function(scope){
	'use strict'

	//
	// main game object
	scope.Game = function(options) {
		this.options = options || {};

		this.canvas = null;
		this.context = null;

		this.width = 0;
		this.height = 0;
		this.origin = null;

		this.timer = null;
		this.action = null;
		this.actors = [];
		this.lastActorTicks = null;

		this.gravity = new Vector2(0.0, 0.1);

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
				var flags = [0, 0, 0, 0, 0, 0, 0, 0, 0];

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
		// ActionPoint object
		function ActionPoint(x, y) {
			this.origin = new Vector2(x, y);

			var radius = 20;

			this.apply = function(actor, width) {
				var vector = actor.mass().sub(this.origin);
				var factor = 1 - vector.length() / width;

				actor.force = vector.normalize().scalar(factor);
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
		function Actor(x, y, velocity) {
			this.origin = new Vector2(x, y);
			this.velocity = velocity || new Vector2(0.0, 0.0);
			this.force = new Vector2(0.0, 0.0);
			this.center = new Vector2(0.0, 0.0);

			var size = 50;

			this.mass = function() {
				return this.origin.add(this.center);
			};

			this.update = function(elapsed, acceleration) {
				this.origin = this.origin.add(this.velocity);
				this.velocity = this.velocity.add(acceleration.add(this.force));
				this.force = this.force.scalar(0.3);
			};

			this.draw = function(context) {
				context.save();

				context.translate(this.origin.x, this.origin.y);

				context.beginPath();
				context.rect(0.0, 0.0, size, size);
				context.closePath();

				context.fillStyle = 'yellow';
				context.fill();

				context.lineWidth = 1.5;
				context.strokeStyle = 'black';
				context.stroke();

				context.restore();
			};

			this.getBounds = function() {
				return new Bounds(this.origin.x, this.origin.y, this.origin.x + size, this.origin.y + size);
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
			var index = 0;

			while(index < this.actors.length) {
				var actor = this.actors[index];

				if (actor.origin.y > this.origin.y) {
					this.actors.splice(index, 1);
					continue;
				}

				index++;
			}

			var bounds = new Bounds(- this.origin.x, - this.origin.y, this.origin.x, this.origin.y);

			for(index = 0; index < this.actors.length; index++) {
				var actor = this.actors[index];

				actor.update(elapsed, this.gravity);

				if (this.action != null) {
					this.action.apply(actor, this.width);
				}

				var flags = bounds.test(actor.getBounds());

				if (flags[0]) {
					actor.velocity = new Vector2(- actor.velocity.x, actor.velocity.y);
					actor.force = new Vector2(- actor.force.x, actor.force.y);
				}
				else if (flags[2]) {
					actor.velocity = new Vector2(- actor.velocity.x, actor.velocity.y);
					actor.force = new Vector2(- actor.force.x, actor.force.y);
				}
			}

			if (this.lastActorTicks == null || (elapsed - this.lastActorTicks) > 1000) {
				var actor = new Actor(0.0, - this.origin.y);

				this.actors.push(actor);
				this.lastActorTicks = elapsed;
			}

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