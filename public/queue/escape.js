var Glyph = Class.extend({
    _name : "Glyph",

    init : function() {
        this.points = [];
    },

    addPoint : function(p) {
        this.points.push(p);
    },

    draw : function(context) {

        if (this.points.length === 0 ) {
            return;
        }

        context.beginPath();
        context.moveTo(this.points[0].x * context.canvas.clientWidth, this.points[0].y * context.canvas.clientHeight);
        this.points.forEach(function(p){
            context.lineTo(p.x * context.canvas.clientWidth, p.y * context.canvas.clientHeight);
        });
        context.stroke();
    }
});

// https://stackoverflow.com/questions/22237497/draw-a-circle-filled-with-random-color-sqares-on-canvas
function getRandomColor() {
    var letters = '0123456789ABCDEF'.split('');
    var color = '#';
    for (var i = 0; i < 6; i++ ) {
        color += letters[Math.round(Math.random() * 15)];
    }
    return color;
}

var WritingSequence = Class.extend({
    _name : "WritingSequence",

    init : function() {
        this.glyphs = [];
        this.i_color = "rgba(0,0,0,1)";
        this.i_currentGlyph = null;
    },

    startNewGlyph : function(p) {
        this.glyphs.push(this.i_currentGlyph = Glyph.instance());
    },

    endGlyph : function() {
        this.i_currentGlyph = null;
    },

    end : function(callbackWhenDone) {
        var self = this;
        this.i_alpha = 1;
        this.i_fadeOutInterval = setInterval(function() {
            if (self.i_alpha > 0) {
                self.i_alpha -= 0.1;
                self.i_color = "rgba(0,0,0," + self.i_alpha + "1)";
//                    console.log(self.i_color)
            }
            else {
                clearInterval(self.i_fadeOutInterval);
                callbackWhenDone && callbackWhenDone();
            }
        }, 100);
    },

    addPoint : function(p) {
        if (this.i_currentGlyph) {
            this.i_currentGlyph.addPoint(p);
        }
    },

    draw : function(context) {
        context.strokeStyle = this.i_color;
        this.glyphs.forEach(function(g) {
            g.draw(context);
        });
    }


});



function getMousePos(canvas, evt) {
    var rect = canvas.getBoundingClientRect();
    return {
        x: (evt.clientX - rect.left) / canvas.clientWidth,
        y: (evt.clientY - rect.top) / canvas.clientHeight
    };
}

/**
 * Intended to be a singleton class. Don't make multiple instances.
 */
var Diary = Class.extend({
    _name : "Diary",

    WRITING_SEQUENCE_IDLE_TIME : 3000,
    UPDATE_INTERVAL : 1000,

    init : function(canvas, roomId) {
        this.canvas = canvas;
        this.context = canvas.getContext('2d');
        this.roomId = roomId;

        this.writingSequences = [];
        this.startNewWritingSequence();

        this.setUpEvents();

        var self = this;
        this.i_hasWritingOccurred = false;
        setInterval(function(){
            if(!self.i_hasWritingOccurred) {
                self.endWritingSequence();
            }
            self.i_hasWritingOccurred = false;
        }, this.WRITING_SEQUENCE_IDLE_TIME);
        //
        // setInterval(function(){
        //     self.checkForUpdates();
        // }, this.UPDATE_INTERVAL);


        requestAnimationFrame(this.render.bind(this));
    },

    setUpEvents : function() {
        var self = this;
        this.canvas.addEventListener('pointermove', function(evt) {
            self.addPoint(getMousePos(canvas, evt));
        }, false);

        canvas.addEventListener('pointerdown', function(evt) {
            self.startWriting(getMousePos(canvas, evt));

        }, false);

        canvas.addEventListener('pointerenter', function(evt) {
            self.startWriting(getMousePos(canvas, evt));

        }, false);

        canvas.addEventListener('pointerup', function(evt) {
            self.endGlyph();

        }, false);

        canvas.addEventListener('pointerleave', function(evt) {
            self.endGlyph();

        }, false);
    },

    startNewWritingSequence : function() {
        this.currentWritingSequence = WritingSequence.instance();
        this.writingSequences.push(this.currentWritingSequence);
    },

    startWriting : function(p) {
        if (!this.currentWritingSequence) {
            this.startNewWritingSequence();
        }
        this.currentWritingSequence.startNewGlyph(p);
    },

    endWritingSequence : function() {
        if (this.currentWritingSequence) {
            this.currentWritingSequence.end();
            var sequence_json = JSON.stringify(this.currentWritingSequence.glyphs.map(function(g){return g.points;}));
//                console.log(sequence_json);
            console.log("sending writing sequence with " + this.currentWritingSequence.glyphs.length + " glyphs to server.");
            this.ajax({
                type: "POST",
                url: "escape-api/addWritingSequence",
                data: {
                    roomId: 1,
                    sequence: sequence_json
                },
                success: function () {
                    console.log("server accepted writing sequence");
                },
                error: function() {
                    console.log("server error");
                }
            });
        }
        this.currentWritingSequence = null;
    },

    endGlyph : function() {
        if (this.currentWritingSequence) {
            this.currentWritingSequence.endGlyph();
        }
    },

    addPoint : function(p) {
        if (this.currentWritingSequence) {
            this.currentWritingSequence.addPoint(p)
            this.i_hasWritingOccurred = true;
        }
    },

    draw : function(context) {
        this.writingSequences.forEach(function(seq) {
            seq.draw(context);
        })
    },

    // animation code based on answer to https://stackoverflow.com/questions/4938346/canvas-width-and-height-in-html5
    render : function() {

        this.resizeCanvasToDisplaySize();

        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.draw(this.context);

        requestAnimationFrame(this.render.bind(this));
    },

    resizeCanvasToDisplaySize : function() {
        // look up the size the canvas is being displayed
        var canvas = this.canvas;
        var width = canvas.clientWidth;
        var height = canvas.clientHeight;

        // If it's resolution does not match change it
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
            return true;
        }

        return false;
    },

    checkForUpdates : function() {
        this.ajax({
            type: "GET",
            url: "escape-api/getMessage/" + this.roomId,
            dataType: "json",
            success: function(data) {
                if (data.length > 0){
                    data = data[0];
                    console.log(data);
                    if(data.message) {
                        $("#riddleText").html(data.message);
                    }
                }

            },
            error: function() {
                console.log("error retrieving message from server");
            }
        });
    }



});



/**
 * Intended to be a singleton class. Don't make multiple instances.
 */
var Riddle = Class.extend({
    _name : "Riddle",

    UPDATE_INTERVAL : 1000,

    init : function(canvas, roomId) {
        this.canvas = canvas;
        this.context = canvas.getContext('2d');
        this.roomId = roomId;


        this.setUpEvents();

        var self = this;

        setInterval(function(){
            self.checkForUpdates();
        }, this.UPDATE_INTERVAL);

        // requestAnimationFrame(this.render.bind(this));
    },

    setUpEvents : function() {

    },

    checkForUpdates : function() {
        this.ajax({
            type: "GET",
            url: "escape-api/getNewWritingSequences/" + this.roomId,
            dataType: "json",
            success: function(data) {
                var sequences = data.map(function(d){
                    return JSON.parse(d.sequence);
                });


                // create a new writing sequence for each element in sequences
                var self = this;
                this.resizeCanvasToDisplaySize();
                sequences.forEach(function(seq){
                    var ws = WritingSequence.instance();

                    // add a glyph for each element in the sequence
                    seq.forEach(function(glyph) {
                        ws.startNewGlyph(glyph[0]);
                        glyph.forEach(function(point){
                            // point.x = point.x / 2;
                            // point.y = point.y / 2;
                            ws.addPoint(point);
                        });
                        ws.endGlyph();

                    });

                    ws.draw(self.context);
                });

            },
            error: function() {
                console.log("error retrieving writing sequences");
            }
        });
    },

    // animation code based on answer to https://stackoverflow.com/questions/4938346/canvas-width-and-height-in-html5
    render : function() {

        this.resizeCanvasToDisplaySize();

        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.draw(this.context);

        requestAnimationFrame(this.render.bind(this));
    },

    resizeCanvasToDisplaySize : function() {
        // look up the size the canvas is being displayed
        var canvas = this.canvas;
        var width = canvas.clientWidth;
        var height = canvas.clientHeight;

        // If it's resolution does not match change it
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
            return true;
        }

        return false;
    }



});