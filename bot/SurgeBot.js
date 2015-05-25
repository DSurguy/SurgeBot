var irc = require('irc'),
	https = require('https'),
	config = require('./config.js'),
	fs = require('fs'),
    Docs = require('./Docs.js'),
    Q = require('q'),
    nodemailer = require('nodemailer'),
    db = require('./Database')
    auth = require('./Auth');
    roll = require('./Roll');

module.exports = SurgeBot;

function SurgeBot(){
	var bot = this;

	// register plugins
	this.auth = auth.auth;
	this.roll = roll.roll;
	this.diceGame = require('./DiceGame');

	//handle any sort of exit
	process.on("exit", function(code){

		//finish writing out the log and then log an exit
		
		if( config.debug.logFile ){
			bot.logFile.writing = false;
			for( var i=0; i<bot.logFile.queue.length; i++ ){
				fs.appendFileSync(config.debug.logFilePath, bot.logFile.queue.shift());
			}
		}

		//now write an exit
		if( config.debug.logFile ){
			fs.appendFileSync(config.debug.logFilePath, "\n"+(new Date()).toISOString()+"EXIT: Bot exited with code "+code);
		}
		if( config.debug.console ){
			console.log( "\n"+(new Date()).toISOString()+"EXIT: Bot exited with code "+code );
		}

	});

	//before connecting to IRC, create a nodemailer
	if( config.email ){
		bot.mailTransport = nodemailer.createTransport({
			service: config.email.service,
			port: config.email.port,
			host: config.email.host,
			secure: config.email.secure,
			auth: {
				user: config.email.username,
				pass: config.email.password
			}
		});
	}
	else{
		//disable auth
		bot.commands.auth = false;
	}

	bot.log("-----\nBot started.", 1);

	//create a new IRC client
	bot.client = new irc.Client(
		config.irc.host, 
		config.irc.nick, 
		{
			channels: config.irc.channels,
			autoConnect: false
		}
	);

	//bind a listener for the messages
	bot.client.addListener('message', function (from, to, message, rawData) {
	    if( message[0] === "!" ){

	    	//check to see if there's a flood from this host
	    	if( bot.checkFlood(rawData.host) ){
	    		console.log("flood");
	    	}
	    	else{
		    	//determine which command has been sent
		    	var cmdEnd = message.indexOf(" ") !== -1 ? message.indexOf(" ") : message.length;
		    	var command = message.slice(1, cmdEnd);
		    	bot.log( "Received command : '"+command+"' from user '"+from+"' for target '"+to+"'", 2);
		    	//check to see if we're handling the command
		    	if( bot.commands[command] ){
		    		//this is a command we can handle, parse it!
		    		bot.parseCommand(from, to, command, message.slice(cmdEnd+1), rawData );
		    	}
		    }
	    }
	    else{
	    	bot.parseMessage(from, to, message, rawData);
	    }
	});

	bot.client.addListener('error', function(message) {
	    console.error('IRC error: '+message);
	});

	//attempt to connect to the IRC server
	bot.log("Attempting to connect to IRC on channels: "+config.irc.channels.join(","), 1);
	bot.client.connect(1, function(){
		bot.log("Connection to IRC server successful. Listening for messages.", 1);
	});
};

/**
* FLOOD PREVENTION
**/
function floodLog(host){
	this.host = host;
	this.msgs = [];
	this.floods = [];
};

floodLog.prototype.checkFlood = function(){

	var shortCount = config.flood.shortFloodCount,
		shortTime = config.flood.shortFloodTime;

	if( this.msgs.length == shortCount ){
		//there are enough messages that we could have a flood, compare first and last
		var floodTime = this.msgs[shortCount-1] - this.msgs[0];
		console.log(floodTime);
		if( floodTime < shortTime ){
			//5 requests in 5 seconds, report a flood
			this.floods.push(Date.now());
			return true;
		}
		else {
			//no flood
			return false;
		}
	}
	else{
		//not currently possible to have a flood
		return false;
	}
};

floodLog.prototype.addMsg = function() {
	if( this.msgs.length == 5 ){
		this.msgs.shift();
		this.msgs.push(Date.now());
	}
	else {
		this.msgs.push(Date.now());
	}
};

//assoc array on host
SurgeBot.prototype._flood = {
	hosts: {},
	floodCount: 0
};

SurgeBot.prototype.checkFlood = function(host){

	var bot = this;

	//before we do anything, check to see if we have hit the max flood limit and need to shut down
	if( bot._flood.floodCount >= config.flood.maxFloodCount ){
		//generate an error and exit
		bot.error("Maximum Flood Count Reached. Stopping.");
		process.exit(1);		
	}

	//init this flood log if necessary
	if( bot._flood.hosts[host] === undefined ){
		bot._flood.hosts[host] = new floodLog(host);
		//add a message log and bounce out, there were no other messages.
		bot._flood.hosts[host].addMsg();
		return false;
	}

	//check to see if this host has hit the flood limit
	if( bot._flood.hosts[host].floods.length >= config.flood.longFloodCount ){
		//report that there is a flood, but this one is permanent.
		return true
	}

	//check to see if there is an active flood within the flood punishment window
	var lastFlood = bot._flood.hosts[host].floods.slice(-1)[0];
	if( (Date.now() - lastFlood) <= config.flood.shortFloodPenalty ){
		//Report that there is a temporary flood
		return true;
	}


	//no flood yet, add a message to this host's flood log
	bot._flood.hosts[host].addMsg();

	//now check for a flood
	var isFlood = bot._flood.hosts[host].checkFlood();

	if( isFlood ){
		//update the flood count and note that there is a flood
		bot._flood.floodCount++;
		return true;
	}
	else{
		//no flood to report
		return false
	}
};

/**
*	MESSAGE PARSING
**/

SurgeBot.prototype.parseCommand = function(from, to, command, params, raw){
	//determine who we need to send this message to
	var target = "";
	if( to[0] === "#" || to[0] === "&" ){
		//this message was sent to a channel, so we should output to the channel
		target = to;
	}
	else{
		//this was sent directly to the bot, send it only to the sender
		target = from;
	}
	//now actually process the command
	if (this[command]) {
		this[command](this, from, target, params, raw);
	} else {
		this.log('Command ' + command + ' not found');
	}
};
SurgeBot.prototype.messageHandlers = [
	{
		handler: 'm_youtube',
		regex: /youtube\.com\/watch\?v=[A-Za-z0-9_\-]+(\s|$)/
	}
];
SurgeBot.prototype.parseMessage = function(from, to, message){
	var bot = this;
	for( var i=0; i<bot.messageHandlers.length; i++ ){
		if( message.search(bot.messageHandlers[i].regex) !== -1 ){
			bot.log('Handling Message: '+bot.messageHandlers[i].handler, 2);
			bot[bot.messageHandlers[i].handler](from, to, message);
			break;
		}
	}
};

/**
*	MESSAGE HANDLERS
**/
SurgeBot.prototype.m_youtube = function(from, to, message){
	var bot = this;

	var msgString = message,
		videoIDs = [];
	//gather all the video IDs
	while( msgString.search(/youtube\.com\/watch\?v=[A-Za-z0-9_\-]+(\s|$)/) !== -1 ){
	    var splitMsg = msgString.substr(msgString.search(/youtube\.com\/watch\?v=/)+20);
	    videoIDs.push( splitMsg.substring(0,splitMsg.search(/(\s|$)/)) );
	    msgString = splitMsg.substr(splitMsg.search(/\s|$/));
	}

	//shoot a request for data to google for each video ID
	bot.log('Got video IDs: '+videoIDs.join(","));
	for( var i=0; i<videoIDs.length; i++ ){
		https.get('https://www.googleapis.com/youtube/v3/videos?part=snippet&id='+videoIDs[i]+'&key='+config.googleApi.key, function (res){
			var body = '';

			res.on('data', function (data){
				body += data;
			});

			res.on('end', function (){
				var vidData = JSON.parse(body);
				if( vidData.items[0] && vidData.items[0].snippet ){
					bot.client.say(to, '\x0303'+from+' posted a video: \x0310'+vidData.items[0].snippet.title+' (\x0312https://www.youtube.com/watch?v='+vidData.items[0].id+"\x0301)");
				}
			});
		}).on( 'error', function (e){
			bot.log('m_youtube request error: '+e, 2);
		});
	}
};

/** 
*	COMMANDS
*/
//!help [<command>]
SurgeBot.prototype.help = function(bot, from, to, params){
    var args = params.split(" "),
        target = from;
    //get the doc the user requested
    var requestedDoc = bot.routeHelp(args[0]);
    //loop through the lines of the doc and spit them out to the user
    for( var i=0; i<requestedDoc.length; i++ ){
        bot.client.say(target, requestedDoc[i]);
    }
};

//Router for help command
SurgeBot.prototype.routeHelp = function(requestedArticle){
    //grab the related help doc
    for( var i=0; i<Docs.Manifest.length; i++ ){
        if( Docs.Manifest[i].cmd == requestedArticle || Docs.Manifest[i].cmd.indexOf(requestedArticle) !== -1 ){
            //we have a match, return this doc!
            var docPath = Docs,
                map = Docs.Manifest[i].docMap.split(".");
            for( var j=0; j<map.length; j++ ){
                docPath = docPath[map[j]];
            }
            return docPath;
        }
    }
    //if we make it here, we haven't found a document! Return the error message, replacing {0} with the request
    return Docs.Error(requestedArticle);
};

/*
*	Enable/Disable commands
*/
SurgeBot.prototype.commands = {
	roll: true,
	help: true,
	diceGame: true,
	auth: true
};

/*
* 	Logging and Error Handling
*/
SurgeBot.prototype.log = function(message, level){
	level = level || 1;
	//format this message
	var logMessage = "\n"+(new Date()).toISOString()+" LOG: "+message;

	//attempt to log this to console
	if( config.debug.console && config.debug.logLevel >= level && config.debug.logLevel > 0 ){
		console.log(logMessage);
	}

	//attempt to log to file
	if( config.debug.logFile && config.debug.logLevel >= level && config.debug.logLevel > 0 ){
		this.addToLogFileQueue(logMessage);
	}
};

SurgeBot.prototype.error = function(message){
	//format this message
	var errMessage = "\n"+(new Date()).toISOString()+" ERR: "+message;

	//attempt to log this to console
	if( config.debug.console && config.debug.logLevel > 0 ){
		console.error(errMessage);
	}

	//attempt to log to file
	if( config.debug.logFile && config.debug.logLevel > 0 ){
		this.addToLogFileQueue(errMessage);
	}

	//see if we should die on error
	if( config.debug.breakOnError ){
		process.exit(1);
	}
};

SurgeBot.prototype.logFile = {
	queue: [],
	writing: false
};

SurgeBot.prototype.addToLogFileQueue = function(message){
	this.logFile.queue.push(message);
	this.processLogFileQueue();
};

SurgeBot.prototype.processLogFileQueue = function(){
	var bot = this;
	if( bot.logFile.writing == false && bot.logFile.queue.length > 0 ){
		bot.logFile.writing = true;
		fs.appendFile(config.debug.logFilePath, bot.logFile.queue.shift(), function (err){
			bot.logFile.writing = false;
			//an error inside the log handler? Better just die.
			if( err ){
				console.log("Error while writing to log. " + err);
				process.exit(1);
			}
			else{
				bot.processLogFileQueue();
			}
		});
	}
};