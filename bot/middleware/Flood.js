modeule.exports = Flood;

function Flood(){

};

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