var irc = require('irc'),
	https = require('https'),
	config = require('./config.js'),
	fs = require('fs'),
    Docs = require('./Docs.js'),
    Q = require('q'),
    Mongo = require('mongodb'),
    nodemailer = require('nodemailer'),
    bcrypt = require('bcrypt-nodejs');

module.exports = SurgeBot;

function SurgeBot(){
	var bot = this;

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
	this[command](from, target, params, raw);
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
SurgeBot.prototype.help = function(from, to, params){
    var bot = this,
        args = params.split(" "),
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
	if( requestedArticle == '' ){
		reqeustedArticle = 'list';
	}
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

//!roll 
SurgeBot.prototype.roll = function(from, to, params){
	var bot = this,
		argArray = params.split(" "),
		target = to;

	var args = {
		die: parseInt(argArray[0]? argArray[0] : ""),
		min: parseInt(argArray[0]? argArray[0] : ""),
		max: parseInt(argArray[1]? argArray[1] : ""),
		mult: (function (multArgs){
			for( var i=1; i<multArgs.length; i++ ){
				if( multArgs[i] == "-m" && multArgs[i+1] ){
					return parseInt(multArgs[i+1]);
				}
				else if( multArgs[i] == "-m" ){
					return NaN;
				}
			}
			return undefined;
		})(argArray)
	};

	switch(argArray.length){
		case 4:
			//assume !roll min max -m mult
			if( isNaN(args.min) || isNaN(args.max) || isNaN(args.mult) ){
				bot.client.say(to, 'Malformed !roll. '
					+'Expected !roll <min> <max> -m <multiplier>, '
					+'got !roll <'+argArray[0]+'> <'+argArray[1]+'> <'+argArray[2]+'> <'+argArray[3]+'>. See \'!help roll\' for more information.');
			}
			else{
				bot.client.say(to, from+" rolls a\x0306 "+(Math.floor(Math.random() * (args.max - args.min)) + args.min)*args.mult);
			}
		break;

		case 3:
			//assume !roll die -m mult
			if( isNaN(args.die) || isNaN(args.mult) ){
				bot.client.say(to, 'Malformed !roll. '
					+'Expected !roll <die> -m <multiplier>, '
					+'got !roll <'+argArray[0]+'> <'+argArray[1]+'> <'+argArray[2]+'>. See \'!help roll\' for more information.');
			}
			else{
				bot.client.say(to, from+" rolls a\x0306 "+(Math.floor(Math.random() * (args.die - 1)) + 1)*args.mult);
			}
		break;
	
		case 2:
			//assume !roll min max
			if( isNaN(args.min) || isNaN(args.max) ){
				bot.client.say(to, 'Malformed !roll. '
					+'Expected !roll <min> <max>, '
					+'got !roll <'+argArray[0]+'> <'+argArray[1]+'>. See \'!help roll\' for more information.');
			}
			else{
				bot.client.say(to, from+" rolls a\x0306 "+(Math.floor(Math.random() * (args.max - args.min)) + args.min) );
			}
		break;

		case 1:
			//assume !roll die
			if( isNaN(args.die) ){
				bot.client.say(to, 'Malformed !roll. '
					+'Expected !roll <die>, '
					+'got !roll <'+argArray[0]+'>. See \'!help roll\' for more information.');
			}
			else{
				bot.client.say(to, from+" rolls a\x0306 "+(Math.floor(Math.random() * (args.die - 1)) + 1) );
			}
		break;
		
		default:
			bot.client.say(to, 'Malformed !roll. See \'!help roll\' for more information.');
		break;
	}
};

//!diceGame <start|end|play> [-b <bid>]
SurgeBot.prototype.diceGame = function(from, to, params){
	var bot = this,
		argArray = params.split(" "),
		argString = params,
		target = to;

	if( to == from ){
		bot.client.say(to, '\x0304Dice Game must be started from main channel.');
	}

	var args = {
		bid: (function (bidArgs){
			for( var i=1; i<bidArgs.length; i++ ){
				if( bidArgs[i] == "-b" && bidArgs[i+1] ){
					return parseInt(bidArgs[i+1]);
				}
				else if( bidArgs[i] == "-b" ){
					return NaN;
				}
			}
			return undefined;
		})(argArray),
		start: argString.search(/\bstart\b/g) == 0,
		end: argString.search(/\bend\b/g) == 0,
		play: argString.search(/\bplay\b/g) == 0,
	};

	switch( argArray.length ){
		case 3:
			//expect !diceGame start -b bid
			if( !args.start || isNaN(args.bid) ){
				//malformed
			}
			else if( bot._diceGame.state == 1 && args.start ){
				//game already started
			}
			//check if this player has enough currency and then start the game
			else{
				if( bot.checkCurrency(from, args.bid) ){
					//good to start the game
					bot._diceGame.state = 1;
					bot._diceGame.bid = args.bid;
					bot._diceGame.host = from;
					//auto-join this player
					var playerRoll = (Math.floor(Math.random() * (args.bid-1))+1);
					bot._diceGame.players.push({player: from, roll: playerRoll});
					//report the game start
					bot.client.say(to, '\x0303Dice Game Started! \x0301BID: \x0310'+args.bid+' \x0301Type \'!diceGame play\' to join in!');
					bot.client.say(to, from+' joined the game and rolled \x0303 '+playerRoll+' \x0314(out of '+args.bid+')');
				}
				else{
					//not enough cash
					bot.client.say(to, from+' doesn\'t have enough '+bot._currency.name+' to join the game!');
				}
			}
		break;
		case 1:
			//expect !diceGame end or !diceGame play
			if( !args.end && !args.play ){
				//malformed
				bot.client.say(to, 'malformed request, tard');
			}
			else if( (args.end || args.play) && bot._diceGame.state == 0 ){
				//game not started
				bot.client.say(to, 'game no start');
			}
			else if( args.end && bot._diceGame.host !== from ){
				//not correct host
				bot.client.say(to, "INCORRECTO HOSTO");
			}
			else if( args.end ){
				//correct host, end the game and payout
				var results = bot._diceGame.players.reduce(function (resultObj, player){
					if( player.roll > resultObj.winnerRoll ){
						resultObj.winner = player.player;
						resultObj.winnerRoll = player.roll;
					}
					if( player.roll < resultObj.loserRoll ){
						resultObj.loser = player.player;
						resultObj.loserRoll = player.roll;
					}
					return resultObj;
				}, {
					winner: undefined,
					winnerRoll: 0,
					loser: undefined,
					loserRoll: bot._diceGame.bid
				});

				//report winner and loser
				bot.client.say(to, '\x0303WINNER: '+results.winner+'\x0310('+results.winnerRoll+') \x0301:: \x0304LOSER: '+results.loser+'\x037('+results.loserRoll+')');
				bot.client.say(to, '\x0314'+results.loser+' sends '+(results.winnerRoll-results.loserRoll)+' '+bot._currency.name+' to '+results.winner+'.');
			}
			else if( args.play ){
				//search the players list for this user
				var userFound = bot._diceGame.players.reduce(function (found, player){
					if( found || player.name == from ){
						return true;
					}
					return false;
				},false);
				if( userFound ){
					//user already rolled
					bot.client.say(from, 'You have already joined the game in progress with a roll of '+bot._diceGame.players.reduce(function (roll, player){
						if( player.player == from ){
							roll = player.roll;
						}
						return roll;
					}, undefined)+'. Good luck!');
				}
				else{
					//add a new player with a roll for this user and report
					var playerRoll = (Math.floor(Math.random() * (bot._diceGame.bid-1))+1);
					bot._diceGame.players.push({
						player: from,
						roll: playerRoll
					});
					bot.client.say(to, from+' joined the game and rolled \x0303 '+playerRoll+' \x0314(out of '+bot._diceGame.bid+')');
				}
			}
		break;
		default:
			//malformed
			bot.client.say(to, 'malformed request, tard');
		break;
	}
};
SurgeBot.prototype._diceGame = {
	state: 0,
	players: [],
	bid: 0,
	host: undefined
};
SurgeBot.prototype.checkCurrency = function(player, amount){
	var bot = this;
	if( bot.Auth_authedUsers[player] && bot.Auth_authedUsers[player].currency < amount ){
		return false;
	}
	return true;
};
SurgeBot.prototype._currency = {
	name: "Zorklids"
};

//!auth [-r <email> <user>]|[-c <code> <user> <pass>]|[<user> <pass>]|[-p user]
SurgeBot.prototype.auth = function (from, to, params, raw){
	var bot = this,
		argArray = params.split(/\s+/g),
		target = to,
		args;

	args = {
		pass: argArray.length == 2 ? argArray[1] : undefined,
		user: argArray.length == 2 ? argArray[0] : undefined
	};

	args.regFlag = argArray.indexOf('-r') == 0 ? argArray[argArray.indexOf('-r')] : undefined;
	args.regEmail = argArray.indexOf('-r') == 0 ? argArray[argArray.indexOf('-r')+1] : undefined;
	args.regUser = argArray.indexOf('-r') == 0 ? argArray[argArray.indexOf('-r')+2] : undefined;

	args.codeFlag = argArray.indexOf('-c') == 0 ? argArray[argArray.indexOf('-c')] : undefined;
	args.code = argArray.indexOf('-c') == 0 ? argArray[argArray.indexOf('-c')+1] : undefined;
	args.codeUser = argArray.indexOf('-c') == 0 ? argArray[argArray.indexOf('-c')+2] : undefined;
	args.codePass = argArray.indexOf('-c') == 0 ? argArray[argArray.indexOf('-c')+3] : undefined;

	args.resetFlag = argArray.indexOf('-p') == 0 ? argArray[argArray.indexOf('-p')] : undefined;
	args.resetUser = argArray.indexOf('-p') == 0 ? argArray[argArray.indexOf('-p')+1] : undefined;

	//Registration
	if( args.regEmail && args.regUser ){
		bot.Auth_handleRegistration(args.regEmail, args.regUser, from).then(function (){
			//user is registered
			bot.client.say(from, 'Registration request received. Please check the email you registered with for an auth code.'
				+' You can use the code with !auth -c <CODE> <USER> <PASS> to complete the registration process.');
		}, function (err){
			bot.client.say(from, '\x0304-e- Error during registration: '+err+'. Please contact bot administrator for details.');
		});
	}
	else if( args.regFlag ){
		bot.client.say(from, 'Malformed !auth. Expected !auth -r <email> <user>, but got '
			+'!auth -r <'+args.regEmail+'> <'+args.regUser+'>. Please enter a valid email and username to register.');
	}
	//Auth Code
	else if( args.code && args.codeUser && args.codePass ){
		if( bot.Auth_pendingRegistrations[args.codeUser] ){
			//check if the code pasted matches
			if( bot.Auth_pendingRegistrations[args.codeUser].code == args.code ){
				//this user is now registered, add them to the database and prompt for auth
				var newUser = bot.Auth_pendingRegistrations[args.codeUser];
				bot.Auth_addUser(args.codeUser, args.codePass, newUser.email).then(function(){
					//now prompt for auth since the user exists
					bot.client.say(from, 'You are now registered to '+config.irc.nick+' as '+args.codeUser+'! Please auth with !auth <user> <pass> to complete login.');
				}).catch(function (err){
					//tell the user there was an error.
					bot.client.say(from, '\x0304There was an error during registration. \x0301Please see the bot administrator for details.');
				});
			}
			else if( bot.Auth_pendingRegistrations[args.codeUser].attempts == 2 ){
				//Too many invalid attempts. Remove the pending auth.
				bot.log('User '+args.codeUser+' has failed too many auth code attempts.', 2);
				delete bot.Auth_pendingRegistrations[args.codeUser];
				bot.client.say('\x0304Too many invalid registration attempts have been detected. Your registration attempt has been removed and logged. Please see bot administrator for details.')
			}
			else{
				//log a failed attempt
				bot.Auth_pendingRegistrations[args.codeUser].attempts++;
				bot.client.say(from, '\x0304Invalid auth code. Please try again. You have '+(3-bot.Auth_pendingRegistrations[args.codeUser].attempts)+' attempts remaining before the code is invalidated.');
			}
		}
		else if( bot.Auth_pendingResets[args.codeUser] ){
			if( bot.Auth_pendingResets[args.codeUser].code == args.code ){
				bot.Auth_updatePassword(args.codeUser, args.codePass).then(function(){
					bot.client.say(from, 'Your password has been updated. Please auth with !auth <user> <pass> to complete login.');
				}, function (err){
					bot.client.say(from, '\x0304There was an error during the password reset process. \x0301Please see the bot administrator for details.');
				});
			}
			else if( bot.Auth_pendingResets[args.codeUser].attempts == 2 ){
				//Too many invalid attempts. Remove the pending auth.
				bot.log('User '+args.codeUser+' has failed too many auth code attempts.', 2);
				delete bot.Auth_pendingResets[args.codeUser];
				bot.client.say('\x0304Too many invalid password resets attempts have been detected. Your reset attempt has been removed and logged. Please see bot administrator for details.')
			}
			else{
				//log a failed attempt
				bot.Auth_pendingResets[args.codeUser].attempts++;
				bot.client.say(from, '\x0304Invalid auth code code. Please try again. You have '+(3-bot.Auth_pendingResets[args.codeUser].attempts)+' attempts remaining before the code is invalidated.');
			}
		}
	}
	else if( args.codeFlag ){
		bot.client.say(from, 'Malformed !auth. Expected !auth -c <code> <user> <newPassword>, but got '
			+'!auth -c <'+args.code+'> <'+args.codeUser+'> <'+args.codePass+'>. Please enter a valid email and username to register.');
	}
	//Password Reset
	else if( args.resetUser ){
		bot.Auth_handleReset(args.resetUser, from, raw).then(function(){
			bot.client.say(from, 'Password reset request received. Please check the email you registered with for an auth code.'
				+' You can use the code with !auth -c <CODE> <USER> <PASS> to complete the password reset process.');
		}, function (err){
			bot.client.say(from, '\x0304There was an error during the password reset process. \x0301Please see the bot administrator for details.');
		});
	}
	else if( args.resetFlag ){
		bot.client.say(from, 'Malformed !auth. Expected !auth -p <user>, but got '
			+'!auth -p <'+args.resetUser+'>. See !help auth for more information.');
	}
	//Login
	else if( args.user && args.pass ){
		bot.Auth_handleLogin(args.user, args.pass, from, raw).then(function(){
			bot.client.say(from, '\x0303You are now logged in as '+args.user+'. Welcome back!');
		}, function (err){
			bot.client.say(from, '\x0304Error during login: '+err+'. Please see bot administrator for details.');
		});
	}
	else {
		//malformed request. Prompt help
		bot.client.say(from, 'Malformed !auth. Expected !auth [-r <email> <user>]|[-c <code> <user> <pass>]|[<user> <pass>]|[-p user]. See \x0314!help auth \x0301for details.');
	}
};
SurgeBot.prototype.Auth_authedUsers = {};
SurgeBot.prototype.Auth_pendingRegistrations = {};
SurgeBot.prototype.Auth_pendingResets = {};
SurgeBot.prototype.Auth_generateAuthCode = function(){
	var chars = [0,1,2,3,4,5,6,7,8,9],
		authCode = [];

	for( var i=0; i<26; i++ ){
		chars.push(String.fromCharCode(65+i));
		chars.push(String.fromCharCode(97+i));
	}

	//generate 8 random characters and return them
	for( var i=0; i<8; i++ ){
		authCode.push( chars[Math.floor(Math.random()*(chars.length-1))] );
	}
	return authCode.join("");
};
SurgeBot.prototype.Auth_addUser = function(name, pwd, email){

	var d$insert = Q.defer();

	Mongo.connect('mongodb://'+config.mongo.user+':'+config.mongo.pass+'@ds031942.mongolab.com:31942/surgebot', function (err, db){
		var collection = db.collection('Users');

		collection.insert([{
			name: name,
			pwd: bcrypt.hashSync(pwd),
			email: email,
			currency: 1000
		}], function (err, result){
			if( err ){
				d$insert.reject(err);
			}
			else{
				d$insert.resolve(result);
			}
			db.close();
		});
	});

	//return the promise so things can listen for resolves and rejects
	return d$insert.promise;
};
SurgeBot.prototype.Auth_updatePassword = function(name, pwd){
	var bot = this,
		d$update = Q.defer();

	//connect to mongo and see if this user exists
	Mongo.connect('mongodb://'+config.mongo.user+':'+config.mongo.pass+'@ds031942.mongolab.com:31942/surgebot', function (err, db){
		var collection = db.collection('Users');

		collection.update({name: name}, { $set: 
			{ pwd: bcrypt.hashSync(pwd) }
		}, function (err, result){
			if( err ){
				d$update.reject(err);
			}
			else{
				delete bot.Auth_pendingResets[name];
				d$update.resolve(result);
			}
			db.close();
		});
	});
	return d$update.promise;
};

SurgeBot.prototype.Auth_handleRegistration = function(regEmail, regUser, from){
	var bot = this,
		d$registration = Q.defer();

	//connect to mongo and see if this user exists
	Mongo.connect('mongodb://'+config.mongo.user+':'+config.mongo.pass+'@ds031942.mongolab.com:31942/surgebot', function (err, db){
		var collection = db.collection('Users');

		collection.find({ $or: [{name: regUser}, {email: regEmail}] }).toArray(function (err, docs){
			if( err ){
				bot.log('Error during user registration: '+err);
				d$registration.reject('Error during user lookup, please contact bot administrator for details');
				db.close();
				return;
			}
			if( docs.length > 0 ){
				//this user exists, resolve the deferred object with the user data
				d$registration.reject('User or email already registered.');
			}
			else{
				//this user doesn't exists, start the registration process
				//check if this is a real email
				if( (/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$/).test(regEmail) ){
					//generate an auth code for this user
					var authCode = bot.Auth_generateAuthCode();

					//send the email
					var emailMsg = ['SurgeBot has received a registration request for the user '+regUser+' from the nick '+from+' on network: '+config.irc.host,
						'Paste the following command in IRC to whisper your registration code to '+config.irc.nick+'. Replace PASS with a new password.',
						'',
						'/msg '+config.irc.nick+' !auth -c '+authCode+' '+regUser+' PASS',
						'',
						'If you experience problems, please contact your channel\'s bot administrator. Replies to this email will be ignored.']
					bot.mailTransport.sendMail({
						from: config.irc.nick+' The IRC Bot <'+config.email.replyTo+'>',
						to: regEmail,
						subject: config.irc.nick+' IRC Registration Confirmation',
						text: emailMsg.join("\n"),
						html: '<p>'+emailMsg.join("</p><p>")+'</p>'
					}, function (err){
						if( err ){
							//log and report
							bot.log('MailError: '+err, 2);
							d$registration.reject('Unable to send email to '+regEmail);
						}
						else{
							//report success and wait for auth code
							bot.Auth_pendingRegistrations[regUser] = {
								code: authCode,
								email: regEmail,
								attempts: 0
							};
							d$registration.resolve();
						}
					});
				}
				else{
					//please enter a real email or password
					d$registration.reject('Please enter a valid email to register.');
				}
			}

			db.close();
		});
	});
	return d$registration.promise;
};

SurgeBot.prototype.Auth_handleLogin = function(loginUser, loginPass, from, raw){
	var bot = this,
		d$login = Q.defer();

	//connect to mongo and see if this user exists
	Mongo.connect('mongodb://'+config.mongo.user+':'+config.mongo.pass+'@ds031942.mongolab.com:31942/surgebot', function (err, db){
		var collection = db.collection('Users');

		collection.find({name: loginUser}).toArray(function (err, docs){
			if( err ){
				bot.log('Error during user registration: '+err);
				d$login.reject('Error during user lookup, please contact bot administrator for details');
				db.close();
				return;
			}
			if( docs == undefined ){
				//user does not exist
				d$login.reject('Username or password is incorrect. If you need a password reset, use !auth -p.');
			}
			else{
				if( bot.Auth_authedUsers[loginUser] ){
					d$login.reject('User is already logged in.');
				}
				if( bcrypt.compareSync(loginPass, docs[0].pwd) ){
					//successful new login
					bot.Auth_authedUsers[loginUser] = {
						session: raw.user+'@'+raw.host,
						currency: docs[0].currency
					};

					d$login.resolve();
				}
				else {
					//pass didn't match somehow
					d$login.reject('Username or password is incorrect. If you need a password reset, use !auth -p.')
				}
			}

			db.close();
		});
	});

	return d$login.promise;
};

SurgeBot.prototype.Auth_handleReset = function(resetUser, from, raw){
	var bot = this,
		d$reset = Q.defer();

	//connect to mongo and see if this user exists
	Mongo.connect('mongodb://'+config.mongo.user+':'+config.mongo.pass+'@ds031942.mongolab.com:31942/surgebot', function (err, db){
		var collection = db.collection('Users');

		collection.find({ name: resetUser}).toArray(function (err, docs){
			if( err ){
				bot.log('Error during password reset request: '+err);
				d$reset.reject('Error during user lookup, please contact bot administrator for details');
				db.close();
				return;
			}
			if( docs.length == 0 ){
				//this user doesn't exist, do nothing, but resolve to obscure user existance
				d$reset.resolve();
			}
			else{
				//this user exists, send an auth code and add them to pending resets
				var authCode = bot.Auth_generateAuthCode();

				//send the email
				var emailMsg = ['SurgeBot has received a password reset request for the user '+resetUser+' from the nick '+from+' on network: '+config.irc.host,
					'Paste the following command in IRC to whisper your auth code to '+config.irc.nick+'. Replace PASS with a new password.',
					'',
					'/msg '+config.irc.nick+' !auth -c '+authCode+' '+resetUser+' PASS',
					'',
					'If you experience problems, please contact your channel\'s bot administrator. Replies to this email will be ignored.']
				bot.mailTransport.sendMail({
					from: config.irc.nick+' The IRC Bot <'+config.email.replyTo+'>',
					to: docs[0].email,
					subject: config.irc.nick+' IRC Password Reset Confirmation',
					text: emailMsg.join("\n"),
					html: '<p>'+emailMsg.join("</p><p>")+'</p>'
				}, function (err){
					if( err ){
						//log and report
						bot.log('MailError: '+err, 2);
						d$reset.reject('Unable to send email');
					}
					else{
						//report success and wait for auth code
						bot.Auth_pendingResets[resetUser] = {
							code: authCode,
							attempts: 0
						};
						d$reset.resolve();
					}
				});
			}

			db.close();
		});
	});
	return d$reset.promise;
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