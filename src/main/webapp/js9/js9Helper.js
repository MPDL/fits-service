/*
 *
 * js9Helper: Node-based server (September 4, 2012)
 *
 * requires: socket.io
 *
 */

/*jslint bitwise: true, plusplus: true, vars: true, white: true, continue: true, unparam: true, regexp: true, browser: true, devel: true, node: true, stupid: true */

/*jshint smarttabs:true */

"use strict";

// load required modules
var sockio = require("socket.io"),
    cproc  = require("child_process"),
    fs     = require("fs");

// internal variables
var i, s, obj, opt, arr, otype, jtype;
var fits2png = {};
var analysis = {str:[], tasks:[]};
var envs = JSON.stringify(process.env);
var prefsfile = "js9Prefs.json";

// default options ... change as necessary in prefsfile
var globalOpts = {
    helperPort:       2718,
    cmd:              "js9helper",
    analysisPlugins:  "./analysis-plugins",
    analysisWrappers: "./analysis-wrappers",
    remoteMsgs:       1 // 0 => none, 1 => samehost, 2 => all
};

// load preference file, if possible
if( fs.existsSync(prefsfile) ){
    s = fs.readFileSync(prefsfile, "utf-8");
    if( s ){
	try{ obj = JSON.parse(s.toString()); }
	catch(e){console.log("can't parse: "+prefsfile, e);}
	// look for globalOpts and merge
	if( obj && obj.globalOpts ){
	    for( opt in obj.globalOpts ){
		if( obj.globalOpts.hasOwnProperty(opt) ){
		    otype = typeof obj.globalOpts[opt];
		    jtype = typeof globalOpts[opt]; 
		    if( (jtype === otype) || (jtype === "undefined") ){
			switch(otype){
			case "number":
			    globalOpts[opt] = obj.globalOpts[opt];
			    break;
			case "string":
			    globalOpts[opt] = obj.globalOpts[opt];
			    break;
			default:
			    break;
			}
		    }
		}
	    }
	}
    }
}

// load analysis plugin files, if available
if( fs.existsSync(globalOpts.analysisPlugins) ){
    fs.readdir(globalOpts.analysisPlugins, function(err, files){
	var i, j, jstr, pathname;
	for(i=0, j=0; i<files.length; i++){
	    pathname = globalOpts.analysisPlugins + "/" + files[i];
	    if( fs.existsSync(pathname) ){
		// only json files, please
		if( !pathname.match(/.json$/) ){
		    continue;
		}
		analysis.temp = fs.readFileSync(pathname, "utf-8");
		jstr = analysis.temp.toString().trim();
		if( analysis.temp ){
		    switch(files[i]){
		    case "fits2png.json":
			try{ fits2png = JSON.parse(jstr); }
			catch(e1){console.log("can't parse: "+pathname, e1);}
			break;
		    default:
			try{ 
			    analysis.str[j] = jstr;
			    analysis.tasks[j] = JSON.parse(jstr);
			    j++;
			}
			catch(e2){console.log("can't parse: "+pathname, e2);}
			break;
		    }
		}
	    }
	}
	if( files.length > 0 ){
	    analysis.strs = "[" + analysis.str.join(",") + "]";
	}
    });
}    

// listen on the helper port
var io = sockio.listen(globalOpts.helperPort);

// errors and warnings only
io.set("log level", 2);

// identify target(s) of an external msg
function getTargets(msg, clients, myip){
    var i, j, c, clip, doit;
    var displays;
    var targip = msg.host;
    var targets = [];
    for(i=0; i<clients.length; i++){
	// current client
	c = clients[i];
	// client ip
	clip = c.handshake.address.address;
	// look for matching clients with js9 objects
	if( c.js9 && ((targip === "*") || (targip === clip)) ){
	    displays = c.js9.displays;
	    for(j=0; j<displays.length; j++){
		// look for matching displays
		if( (msg.id === "*") || (msg.id === displays[j]) ){
		    doit = false;
		    // if I'm localhost, I can send to anyone
		    if( myip === "127.0.0.1" ){
			doit = true;
		        // sometimes I can send to myself
		    } else if( (myip === clip) && 
			       (globalOpts.remoteMsgs > 0) ){
			doit = true;
			// security risk: anyone can send to anyone
		    } else if( globalOpts.remoteMsgs > 1 ){
			doit = true;
		    }
		    // prepare to send message to this client
		    if( doit ){
			targets.push(c);
		    }
		}
	    }
	}
    }
    return targets;
}

// after any socket connects, receive and process custom events
io.sockets.on("connection", function(socket) {
    // on disconnect, kill the helper
    socket.on("disconnect", function() {
	if( socket.helper && socket.helper.pid ){
	    socket.helper.pid.kill();
	    socket.helper.pid = 0;
	}
    });
    // list of displays for this connection
    socket.on("displays", function(s) {
	var addr = socket.handshake.address;
	socket.js9 = {};
	socket.js9.displays = s.split(",");
        console.log("connect: %s:%s [%s]", 
		    addr.address, addr.port, socket.js9.displays);
    });
    socket.on("msg", function(msg, cbfunc) {
	var i, targets;
	var clients = io.sockets.clients();
	var myip = socket.handshake.address.address;
	var myfunc = function(s){cbfunc(s);};
	// get target(s) for this message
	targets = getTargets(msg, clients, myip);
	// look for one target (or else that multi is allowed)
	if( (targets.length === 1) || msg.multi ){
	    for(i=0; i<targets.length; i++){
		targets[i].emit("msg", msg, myfunc);
	    }
	} else {
          cbfunc("ERROR: "+targets.length+" JS9 instance(s) found with" + 
		 " id " + msg.id + " (" + msg.cmd+")");
	}
    });
    // new image file
    socket.on("image", function(obj, cbfunc) {
	var cmd, args;
	var image = obj.image;
	// var myhost = socket.handshake.address.address;
	var myenv = JSON.parse(envs);
	if( obj.dataPath ){
	    myenv.JS9_DATAPATH = obj.dataPath;
	} else if( globalOpts.dataPath ){
	    myenv.JS9_DATAPATH = globalOpts.dataPath;
	}
	cmd = globalOpts.cmd;
	args = [cmd, "-i", image];
	console.log("exec: %s [%s] [%s]", 
		    cmd, args.slice(1), myenv.JS9_DATAPATH);
	// see if we can find the FITS file associated with this png
	cproc.execFile(cmd, args.slice(1),
		       { encoding: "ascii",
			 timeout: 0,
			 maxBuffer: 2000*1024,
			 killSignal: "SIGTERM",
			 cwd: null,
			 env: myenv 
		       },
		       function(error, stdout, stderr) {
			   var res={};
			   res.error = error;
			   if( stdout ){
			       res.stdout = stdout.toString();
			   }
			   if( stderr ){
			       res.stderr = stderr.toString();
			       console.log("image: %s", res.stderr);
			   }
			   cbfunc(res);
		       });
    });
    // get analysis task definitions
    socket.on("getAnalysis", function(obj, cbfunc) {
	// send list of analysis tasks to image
	if( analysis.strs ){
	    cbfunc(analysis.strs);
	}
    });
    // run an analysis task
    socket.on("runAnalysis", function(obj, cbfunc) {
	var i, cmd, argstr, args;
	var myid = obj.id;
	var myhost = socket.handshake.address.address;
	var myenv = JSON.parse(envs);
	myenv.JS9_ID = myid;
	myenv.JS9_HOST = myhost;
	if( obj.cookie ){
	    myenv.HTTP_COOKIE = obj.cookie;
	}
	if( obj.dataPath ){
	    myenv.JS9_DATAPATH = obj.dataPath;
	} else if( globalOpts.dataPath ){
	    myenv.JS9_DATAPATH = globalOpts.dataPath;
	}
	argstr = obj.cmd;
	// split arguments on spaces
	args = argstr.split(" ");
	// remove dangerous characters
	for(i=0; i<args.length; i++){
	    args[i] = args[i].replace(/[`$]/g, "");
	}
	cmd = globalOpts.analysisWrappers + "/" + args[0];
	console.log("exec: %s [%s]", cmd, args.slice(1));
	// execute the analysis script with cmd arguments
	cproc.execFile(cmd, args.slice(1),
		       { encoding: "ascii",
			 timeout: 0,
			 maxBuffer: 2000*1024,
			 killSignal: "SIGTERM",
			 cwd: null,
			 env: myenv 
		       },
		       function(error, stdout, stderr) {
			   var res={};
			   res.error = error;
			   if( stdout ){
			       res.stdout = stdout.toString();
			   }
			   if( stderr ){
			       res.stderr = stderr.toString();
			       console.log("run: %s", res.stderr);
			   }
			   cbfunc(res);
		       });
    });
    // convert raw fits to png
    socket.on("fits2png", function(obj, cbfunc) {
	var i, cmd, argstr, args;
	var myid = obj.id;
	var myhost = socket.handshake.address.address;
	var myenv = JSON.parse(envs);
	myenv.JS9_ID = myid;
	myenv.JS9_HOST = myhost;
	if( obj.cookie ){
	    myenv.HTTP_COOKIE = obj.cookie;
	}
	if( obj.dataPath ){
	    myenv.JS9_DATAPATH = obj.dataPath;
	} else if( globalOpts.dataPath ){
	    myenv.JS9_DATAPATH = globalOpts.dataPath;
	}
	// sanity check
	if( !fits2png[0] || !fits2png[0].action ){
	    cbfunc({stderr: "ERROR: fits2png is not available"});
	}
	// make up argument string
	argstr = fits2png[0].action + " " + obj.fits;
	// split arguments on spaces
	args = argstr.split(" ");
	// remove dangerous characters
	for(i=0; i<args.length; i++){
	    args[i] = args[i].replace(/[`$]/g, "");
	}
	cmd = globalOpts.analysisWrappers + "/" + args[0];
	console.log("fits2png: %s [%s]", cmd, args.slice(1));
	// execute the fits2png command with args
	cproc.execFile(cmd, args.slice(1),
		       { encoding: "ascii",
			 timeout: 0,
			 maxBuffer: 2000*1024,
			 killSignal: "SIGTERM",
			 cwd: null,
			 env: myenv
		       },
		       function(error, stdout, stderr) {
			   var res={};
			   res.error = error;
			   if( stdout ){
			       res.stdout = stdout.toString();
			   }
			   if( stderr ){
			       res.stderr = stderr.toString();
			       console.log("fits2png: %s", res.stderr);
			   }
			   cbfunc(res);
		       });
    });
});

// last ditch attempt to keep the server up
process.on("uncaughtException", function(e){
    console.log("uncaughtException: "+e);
});
