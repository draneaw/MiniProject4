// From Getting Started With node.js and socket.io 
// http://codehenge.net/blog/2011/12/getting-started-with-node-js-and-socket-io-v0-7-part-2/
"use strict";
var ainPath = "/sys/devices/platform/omap/tsc/";
var http = require('http'),
    url = require('url'),
    fs = require('fs'),
    exec = require('child_process').exec,
    server,
    connectCount = 0,
	i2cNum = '0x70',
	i2cAddress = '0';	// Number of connections to server

server = http.createServer(function (req, res) {
// server code
    var path = url.parse(req.url).pathname;
    console.log("path: " + path);
    switch (path) {
    case '/':
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.write('<h1>Hello!</h1>Try<ul><li><a href="/buttonBox.html">Button Box Demo</a></li></ul>');

        res.end();
        break;

    default:		// This is so all the files will be sent.
        fs.readFile(__dirname + path, function (err, data) {
            if (err) {return send404(res); }
//            console.log("path2: " + path);
            res.write(data, 'utf8');
            res.end();
        });
        break;

    }
});

var send404 = function (res) {
    res.writeHead(404);
    res.write('404');
    res.end();
};

server.listen(8081);

var updateTopInterval = 100;    
var updateBotInterval = 100;



// socket.io, I choose you
var io = require('socket.io').listen(server);
io.set('log level', 2);
function updateBot(){
	//console.log('i2cget -y 3 ' + i2cNum +' 0x'+ i2cAddress+' w');
        exec('i2cget -y 3 ' + i2cNum +' 0x'+ i2cAddress+' w',
            function (error, stdout, stderr) {
//		The TMP102 returns a 12 bit value with the digits swapped
                stdout = '0x' + stdout.substring(4,6) + stdout.substring(2,4);
                if(error) { console.log('error: ' + error); }
                if(stderr) {console.log('stderr: ' + stderr); }
		//console.log(stdout);
                io.sockets.emit('i2c', stdout);
		});

	setTimeout(updateBot, updateBotInterval);
}

function updateTop(ainNum,gpioNum) {
           
        fs.readFile(ainPath + "ain" + ainNum, 'base64', function(err, data) {
            //if(err) throw err;
            io.sockets.emit('ain', data);
        });
   
        var gpioPath = "/sys/class/gpio/gpio" + gpioNum + "/value";
        fs.readFile(gpioPath, 'base64', function(err, data) {
            //if (err) throw err;
            io.sockets.emit('gpio', data);
        });

        setTimeout(updateTop, updateTopInterval);
    }

io.sockets.on('i2cNumVal', function(newI2cNum){
	console.log(newI2cNum);
	i2cNum = newI2cNum;
    });
io.sockets.on('ainNumVal', function(newAinI2cNum){
	console.log(newAinI2cNum);
	ainNum = newAinI2cNum;
    });
io.sockets.on('gpioNumVal', function(newGpioI2cNum){
	console.log(newGpioI2cNum);
	gpioNum = newGpioI2cNum;
    });

// on a 'connection' event
io.sockets.on('connection', function (socket) {
    var frameCount = 0;	// Counts the frames from arecord
    var lastFrame = 0;	// Last frame sent to browser
    var updateTopInterval = 100;
    var updateBotInterval = 100;
    var plotTop,
	arrayLocation = 0,
        plotBot,
        gpioData = [], igpio = 0,
        i2cData = [],  ii2c = 0,
	ainNum  = 6,
	gpioNum = 7;

    console.log("Connection " + socket.id + " accepted.");
//    console.log("socket: " + socket);
    //updateTop(ainNum,gpioNum);
    // now that we have our connected 'socket' object, we can 
    // define its event handlers

    // Make sure some needed files are there
    // The path to the analog devices changed from A5 to A6.  Check both.
//    if(!fs.existsSync(ainPath)) {
//        ainPath = "/sys/devices/platform/tsc/";
//        if(!fs.existsSync(ainPath)) {
//            throw "Can't find " + ainPath;
//        }
//    }
    // Make sure gpio 7 is available.
    exec("echo 7 > /sys/class/gpio/export");
   
    updateTop(ainNum,gpioNum);
    updateBot(i2cNum);
// Request data every updateInterval ms
    

    socket.on('led', function (ledNum) {
        var ledPath = "/sys/class/leds/beaglebone::usr" + ledNum + "/brightness";
//        console.log('LED: ' + ledPath);
        fs.readFile(ledPath, 'utf8', function (err, data) {
            if(err) throw err;
            data = data.substring(0,1) === "1" ? "0" : "1";
//            console.log("LED%d: %s", ledNum, data);
            fs.writeFile(ledPath, data);
        });
    });

   socket.on('i2cNumVal', function(newI2cNum){
	console.log(newI2cNum);
	i2cNum = newI2cNum;
    });
   socket.on('ainNumVal', function(newAinI2cNum){
	console.log(newAinI2cNum);
	ainNum = newAinI2cNum;
    });
   socket.on('gpioNumVal', function(newGpioI2cNum){
	console.log(newGpioI2cNum);
	gpioNum = newGpioI2cNum;
    });
    socket.on('changeArray', function(arrayint){
	
	if(arrayLocation >2){
		arrayLocation = 0;	
	}
	else{
		arrayLocation = arrayLocation +1;
	}
	exec('./matrixLEDi2c ' +arrayLocation,
            function (error, stdout, stderr) {
                if(error) { console.log('error: ' + error); }
                if(stderr) {console.log('stderr: ' + stderr); }
		});	
	
    });
    var calc = 0;
    socket.on('changeAddr', function(addrint){
	
	if(calc == 15){
		calc = 0;			
	}
	else{
		calc = calc + 1;
	}
	i2cAddress = calc.toString(16);
	io.sockets.emit('i2cAddress', i2cAddress);
	
    });
    socket.on('disconnect', function () {
        console.log("Connection " + socket.id + " terminated.");
        connectCount--;
        if(connectCount === 0) {
        }
        console.log("connectCount = " + connectCount);
    });

    connectCount++;
    console.log("connectCount = " + connectCount);
});

