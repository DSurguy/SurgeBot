var fs = require('fs');

module.exports = Log;

function Log(logConfig){
	this.config = logConfig;
};

/*
* 	Logging and Error Handling
*/
Log.prototype.log = function(message, level){
	//format this message
	var logMessage = "\n"+(new Date()).toISOString()+" LOG: "+message;

	//attempt to log this to console
	if( this.config.console && this.config.logLevel >= level && this.config.logLevel > 0 ){
		console.log(logMessage);
	}

	//attempt to log to file
	if( this.config.logFile && this.config.logLevel >= level && this.config.logLevel > 0 ){
		this.addToLogFileQueue(logMessage);
	}
};

Log.prototype.error = function(error){
	//format this message
	var errMessage = "\n"+(new Date()).toISOString()+" ERR: "+error.message;

	//attempt to log this to console
	if( this.config.console && this.config.logLevel > 0 ){
		console.trace(error);
	}

	//attempt to log to file
	if( this.config.logFile && this.config.logLevel > 0 ){
		this.addToLogFileQueue(error.stack);
	}

	//see if we should die on error
	if( this.config.breakOnError ){
		process.exit(1);
	}
};

Log.prototype.logFile = {
	queue: [],
	writing: false
};

Log.prototype.addToLogFileQueue = function(message){
	this.logFile.queue.push(message);
	this.processLogFileQueue();
};

Log.prototype.processLogFileQueue = function(){
	var Log = this;
	if( Log.logFile.writing == false && Log.logFile.queue.length > 0 ){
		Log.logFile.writing = true;
		fs.appendFile(this.config.logFilePath, Log.logFile.queue.shift(), function (err){
			Log.logFile.writing = false;
			//an error inside the log handler? Better just die.
			if( err ){
				console.log("Error while writing to log. " + err);
				process.exit(1);
			}
			else{
				Log.processLogFileQueue();
			}
		});
	}
};