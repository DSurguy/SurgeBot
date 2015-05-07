var irc = require('irc'),
	https = require('https'),
	config = require('./config.js'),
	fs = require('fs'),
    Docs = require('./Docs.js');

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


	//before connecting to the IRC network, create a mongo connection
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
		    		bot.parseMessage(from, to, command, message.slice(cmdEnd+1) );
		    	}
		    }
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
}


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
*	Message parsing
**/

SurgeBot.prototype.parseMessage = function(from, to, command, params){
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
	this[command](from, target, params);
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
	if( requestedArticle == "" ){
		return Docs.Error("undefined");
	}
    //grab the related help doc
    var regex = new RegExp("\\b"+requestedArticle+"\\b", "g");
    for( var i=0; i<Docs.Manifest.length; i++ ){
        if( Docs.Manifest[i].cmd.search(regex) !== -1 ){
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

// !wowis <character> [<realm>] [<region>]
SurgeBot.prototype.wowis = function(from, target, params){
	var bot = this,
		args = params.split(" "),
		region, character, realm;

	if( args[0].length == 0 ){
		//this is a malformed request, alert the sender
		bot.client.notice(from, "Malformed !wowis. Expected !wowis <characterName> [<serverName>] [<region>], got !wowis <"+args[0]+"> [<"+args[1]+">] [<"+args[2]+">]. See '!help wowis' for more information.");
		return false;
	}
	else{
		//this is a proper request, add the character name
		character = args[0];
	}

	if( args[1] ){
		//the server name has been passed in, use it
		realm = args[1]
	}
	else if( config.wow.homeRealm ){
		//use the home server
		realm = config.wow.homeRealm;
	}
	else{
		//we don't have a server to use!
		bot.client.notice(from, "Unable to complete !wowis. No realm specified in request or in bot config. Please contact channel admin or supply a realm. See '!help wowis' for more information.");
		return false;
	}


	if( args[2] ){
		//the server region was passed in
		region = args[2]
	}
	else if( config.wow.homeRegion ){
		//use the home region
		region = config.wow.homeRegion;
	}
	else{
		//we don't have a region to use!
		bot.client.notice(from, "Unable to complete !wowis. No region specified in request or in bot config. Please contact channel admin or supply a realm. See '!help wowis' for more information.");
		return false;
	}	
	
	//check to see if this character exists
	bot.getCharacter(realm, character, region, function(charExists){
		if( charExists ){
			//send the link to the target of the request
			bot.client.say(target, "\x0314"+"!wowis for "+args[0]+": http://"+region+".battle.net/wow/en/character/"+realm+"/"+character+"/advanced");
		}
		else{
			//send a message that the char doesn't exist to the target of the request
			bot.client.say(target, "\x0314"+"!wowis for <"+args[0]+"> [<"+args[1]+">] [<"+args[2]+">]: Character not found!");	
		}
	});
};

// !amr <character> [<realm>] [<region>]
SurgeBot.prototype.amr = function(from, target, params){
	var bot = this,
		args = params.split(" "),
		region, character, realm;

	if( args[0].length == 0 ){
		//this is a malformed request, alert the sender
		bot.client.notice(from, "Malformed !amr. Expected !amr <character> [<realm>] [<region>], got !amr <"+args[0]+"> [<"+args[1]+">] [<"+args[2]+">]. See '!help amr' for more information.");
		return false;
	}
	else{
		character = args[0];
	}

	if( args[1] ){
		realm = args[1];
		
	}
	else if( config.wow.homeRealm) {
		realm = config.wow.homeRealm;
	}
	else{
		bot.client.notice(from, "Unable to complete !amr. No realm specified in request or in bot config. Please contact channel admin or supply a realm. See '!help amr' for more information.");
	}

	if( args[2] ){
		region = bot.amr_Region(args[2]);
	}
	else if( config.wow.homeRegion) {
		region = bot.amr_Region(config.wow.homeRegion);
	}
	else{
		bot.client.notice(from, "Unable to complete !amr. No region specified in request or in bot config. Please contact channel admin or supply a region. See '!help amr' for more information.");
	}

	//check to see if this character exists
	bot.getCharacter(realm, character, region, function(charExists){
		if( charExists ){
			//send the link to the target of the request
			bot.client.say(target, "\x0314"+"!amr for "+args[0]+": http://www.askmrrobot.com/wow/player/"+region+"/"+realm+"/"+character);
		}
		else{
			//send a message that the char doesn't exist to the target of the request
			bot.client.say(target, "\x0314"+"!amr for <"+args[0]+"> [<"+args[1]+">] [<"+args[2]+">]: Character not found!");	
		}
	});
};
SurgeBot.prototype.amr_Region = function(region){
	switch(region){
		case "us":
		case "usa":
		default:
			return "us";
			break;
		case "eu":
			return "eu";
			break;
	}
};

//!wowhead <search>
SurgeBot.prototype.wowhead = function(from, target, params){

	var bot = this,
		args = params,
		url = "http://www.wowhead.com/search?q="

	//allow ( [a-zA-Z0-9] | [/] AS %2F | [-_'"] | [+] AS %2B | [\s] as + )

	var slashExp = /\//g,
		plusExp = /\+/g,
		spaceExp = /\s/g,
		cleanSearch = "";

	cleanSearch = args;

	cleanSearch = cleanSearch
		.replace(slashExp, "%2f")
		.replace(plusExp, "%2B")
		.replace(spaceExp, "+");

	url += cleanSearch;

	bot.client.say(target, url);

};

//!realm <realm> <region>
SurgeBot.prototype.realm = function(from, target, params){
	var bot = this,
		args = params.split(" "),
		region, realm, url;

	if( args[0] ){
		realm = args[0];
	}
	else if( config.wow.homeRealm ){
		//use the home server
		realm = config.wow.homeRealm;
	}
	else{
		//we don't have a server to use!
		bot.client.notice(from, "Unable to complete !wowis. No realm specified in request or in bot config. Please contact channel admin or supply a realm. See '!help wowis' for more information.");
		return false;
	}

	if( args[1] ){
		region = args[1];
	}
	else if( config.wow.homeRegion ){
		//use the home region
		region = config.wow.homeRegion;
	}
	else{
		//we don't have a region to use!
		bot.client.notice(from, "Unable to complete !wowis. No region specified in request or in bot config. Please contact channel admin or supply a realm. See '!help wowis' for more information.");
		return false;
	}

	bot.getRealm(realm, region, function(realmData){
		var status = realmData.status ? "\x0303Up" : "\x04Down",
			queue = !realmData.queue ? "\x0303No" : "\x04Yes",
			population;

		//parse the population
		switch(realmData.population){
			case "low": population = "\x0308Low"; break;
			case "medium": population = "\x0307Medium"; break;
			case "high": population = "\x0304High"; break;
			default: population = "\x0314Unknown"; break;
		}
		//spit out the status, WITH COLORS!
		bot.client.say(target, "\x0310Realm: \x0306"+realm+"\x0310   Region: \x0306"+region);
		bot.client.say(target, "\x0310Status: "+status+"\x0310   LoginQueue: "+queue+"\x0310   Population: "+population);
	}, function(err){
		bot.client.notice(from, err);
	});

};

SurgeBot.prototype.getCharacter = function(realm, character, region, callback){
	//build the request string
	var url = this.buildApiUrl({
		region: region,
		path: "/character/",
		params: [realm, character]
	}),
		bot = this;

	//make a get request to see if we can nab some data
	https.get(url, function(result){
		var newChar,
			data = "";
		result.on("data", function(chunk){
			data += chunk;
		});
		result.on("end", function(){
			newChar = JSON.parse(data);
			if( newChar.status === "nok" ){
				//this character does NOT exists
				callback(undefined);
			}
			else{
				callback(newChar);
			}
		});
	}).on('error', function(e){
		console.error("Unable to retrieve character from API. e: "+e.message);
	});
};

SurgeBot.prototype.getRealm = function(realm, region, callback, error){
	var bot = this,
	//build the realm url
	url = this.buildApiUrl({
		region: "us",
		path: "/realm/",
		params: ["status"],
		addFields: ["realms="+realm]
	});

	//grab the realm data
	https.get(url, function(result){
		var data = "",
			realmData;
		result.on("data", function(chunk){
			data += chunk;
		});
		result.on("end", function(){
			//grab the first realm from the results
			realmData = JSON.parse(data).realms[0];
			//see if this realm matches what we're actually looking for
			if( realmData.slug !== realm.toLowerCase() ){
				error("Unable to get realm status, realm not found. Try replacing spaces with -, or check the realm list at http://"+bot.db_region(region)+".battle.net/wow/en/status");
			}
			else{
				//return the realm
				callback(realmData);
			}
			
		});
	}).on('error', function(e){
		console.error("Unable to retrieve realm status. e: "+e.message);
		bot.error("Unable to get realm status, realm not found. Try replacing spaces with -, or check the realm list at http://"+bot.db_region(region)+".battle.net/wow/en/status");
	});
};

SurgeBot.prototype.db_region = function(region){
	switch(region){
		case "us":
		case "usa":
		default:
			return "us";
		case "eu":
			return "eu";
	}
};

SurgeBot.prototype.buildApiUrl = function(args){
	var bot = this;

	try{
		var url = ["https://"+this.db_region(args.region)+".api.battle.net/wow"];

		url.push( args.path ); // should be /thing/otherthing/

		if( args.params ){
			url.push( args.params.join("/") );
		}

		url.push( "?" );

		if( args.addFields ){
			url.push( args.addFields.join("&") );
		}

		url.push( "&locale="+config.api.locale );

		if( config.api.key ){
			url.push( "&apikey="+config.api.key )
		}

		return url.join("");

	} catch(e){
		bot.error("Unable to build api url. e: "+e.message);
	}
};

/*
*	Enable/Disable commands
*/

SurgeBot.prototype.commands = {
	wowis: true,
	amr: true,
    help: true,
    realm: true,
    wowhead: true
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
				console.log("Error while writing to log. " + logMessage);
				process.exit(1);
			}
			else{
				bot.processLogFileQueue();
			}
		});
	}
};