/*
 *
 * js9msg: send messages to js9 via Node-based server (March 20, 2013)
 *
 * requires: socket.io
 *
 */

/*jslint plusplus: true, sloppy: true, vars: true, white: true, browser: true, devel: true, node: true */

// load required modules
var sockio = require("socket.io/node_modules/socket.io-client"),
    dns = require('dns'),
    readline = require("readline");

// internal variables
var msg, host;
var args = process.argv.slice(2);
var done = false;
var doserver = false;
var helperScheme = "http://";
var helperHost = "localhost";
var helperPort = 2718;
var helperURL=""; // will be composed after getting user options
var istty = process.stdin.isTTY  || false;
var rl = null;
var socket = null;
var verify = false;
var msgType = "msg";

// ever-present
function usage() {
  var prog = "js9msg";
  console.log("usage: %s [switches] [cmd] [args]", prog);
  console.log("  switches:");
  console.log("    -h|-help                  # print this message");
  console.log("    -host [hostname]          # client host name");
  console.log("    -id [id]                  # client JS9 id (from div)");
  console.log("    -multi                    # send to multiple clients");
  console.log("  examples:");
  console.log("    %s help               # list available commands", prog);
  console.log("    %s cmap heat          # change colormap to 'heat'", prog);
  console.log("    %s regions            # return current regions", prog);
  console.log("    %s -id myJS9 regions  # regions for myJS9 instance", prog);
  console.log("    %s                    # read commands from stdin", prog);
  process.exit(0);
}

// message constructor
function JS9Msg(){
    this.cmd = "*";
    this.args = [];
    this.id = "*";
    this.host = "*";
    this.multi = false;
}

JS9Msg.prototype.reset = function() {
    // reset cmd parameters for next time
    this.cmd = "*";
    this.args = [];
};

// args: set cmd and args from array
JS9Msg.prototype.setArgs = function(args) {
    switch(msgType){
    case "msg":
        this.cmd = args[0];
        this.args = args.slice(1) || [];
    break;
    default:
    break;
    }
};

// send: send message, display results (and maybe exit)
JS9Msg.prototype.send = function(socket, rl, postproc) {
    var that = this;
    // copy to a temp msg
    var msg = JSON.parse(JSON.stringify(this));
    // now reset cmd parameters for next time
    this.reset();
    // send msg to js9
    socket.emit(msgType, msg, function(s){
	// post-processing of results
	switch(msg.cmd){
	case "help":
	    s = s.replace(/<table><tr>/g, "")
		 .replace(/<tr>/g, "\n")
		 .replace(/<\/td><td>/g,"     \t")
		 .replace(/<[a-z\/]*>/g,"");
	    break;
	default:
	    break;
	}
	// display results
        if( s ){
	    console.log(s);
	}
	// post-processing
	switch(postproc){
	case 'exit':
	    // exit
	    that.exit(socket, rl, 0);
	    break;
	case 'prompt':
	    if( rl ){
		if( istty ){
		    rl.prompt();
		}
	    }
	    break;
	}
    });
};

// server mode
JS9Msg.prototype.server = function(socket, rl) {
    var that = this;
    var args;
    rl.resume();
    if( istty ){
	rl.setPrompt('JS9> ');
	rl.prompt();
    }
    rl.on('line', function(line) {
	rl.pause();
	line = line.trim();
	switch(line) {
	case 'exit':
	case 'quit':
	case 'q':
	    // exit
	    that.exit(socket, rl, 0);
	    break;
	default:
	    args = line.split(" ");
	    // package msg (cmd and args)
	    that.setArgs(args);
	    // send message and display results
	    that.send(socket, rl, "prompt");
	    break;
	}	    
    }).on('close', function() {
	that.exit(socket, rl, 0);
    });
};

// clean exit
JS9Msg.prototype.exit = function(socket, rl, errno) {
    var res = errno || 0;
    if( rl ){
	rl.close();
    }
    if( socket ){
	socket.disconnect();
    }
    process.exit(res);
};

// baseline message object with default values
msg = new JS9Msg();

// get environment options
if( process.env.JS9_HELPER_HOST ){
    helperHost = process.env.JS9_HELPER_HOST;
}
if( process.env.JS9_HELPER_PORT ){
    helperPort = process.env.JS9_HELPER_PORT;
}
if( process.env.JS9_HELPER ){
    helperURL = process.env.JS9_HELPER;
}

// process optional switches
while( !done ){
  switch(args[0]){
    case '-h':
    case '-help':
      usage();
      break;
    case '-host':
      args.shift();
      msg.host = args.shift();
      break;
    case '-id':
      args.shift();
      msg.id = args.shift();
      break;
    case '-multi':
      args.shift();
      msg.multi = true;
      break;
    case '-helper':
      args.shift();
      helperHost = args.shift();
      break;
    case '-helperPort':
      args.shift();
      helperPort = args.shift();
      break;
    case '-helperScheme':
      args.shift();
      helperScheme = args.shift();
      break;
  case '-msgType':
      args.shift();
      msgType = args.shift();
      break;
    case '-v':
      args.shift();
      verify = true;
      break;
    default:
      done = true;
      break;
  }
}

// make up helper URL, if not set explicitly
if( !helperURL ){
    helperURL = helperScheme + helperHost + ":" + helperPort;
}

// if no command, enter server mode
if( (args.length === 0) || (args[0] === "") ){
    // create readline interface
    rl = readline.createInterface({
	terminal: istty,
	input: process.stdin,
	output: process.stdout
    });
    rl.pause();
    doserver = true;
} else {
    // package msg (cmd and args)
    msg.setArgs(args);
}

// kind of dumb: we want to convert the host name to an ip address, but the
// dns.lookup call is asynchronous, so we have to wrap all of the important
// code in its return function. wish we had a synchronous call!
if( msg.host === "*" ){
    host = "";
} else {
    host = msg.host;
}
dns.lookup(host, 4, function (err, address, family) {
    if( err ){
	if(  msg.host  ){
	    throw err;
	}
    } else if( address ){
	msg.host = address;
	if( verify ){
	    console.log('host ip: %s [%s]', msg.host, family);
	}
    }
    // debugging
    if( verify ){
	console.log("connecting to: %s (%s)", helperURL, msg.host);
    }
    // finally! connect to helper
    socket = sockio.connect(helperURL);
    // check for connect errors
    socket.on("connect_failed", function(){
	console.log("ERROR: connect failed: '%s'", helperURL);
    });
    // and send the message
    socket.on("connect", function(){
	if( doserver ){
	    if( verify ){
		console.log("entering server mode ...");
	    }
  	    msg.server(socket, rl);
	} else {
	    if( verify ){
		console.log("sending message: %s", msg.cmd);
	    }
	    // send message and display results
	    msg.send(socket, null, "exit");
	}
    });
});
