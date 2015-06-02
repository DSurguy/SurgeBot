var fs = require('fs'),
	extend = require('extend');

module.exports = Log;

function Log(logConfig){
	//this.config = logConfig;
	this.config = extend(true, {
		logLevel: 1,
		console: false,
		logFile: false,
		logFilePath: process.cwd()+'/log/botLog.log',
		breakOnError: false
	}, logConfig?logConfig:{} )

	this.logFile = {
		queue: [],
		writing: false
	};
};

/*
* 	Logging and Error Handling
*/
Log.prototype.log = function(message, level){
	//format this message
	var logMessage = (new Date()).toISOString()+" LOG: "+message;

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
	if( typeof error == 'string' || typeof error == 'number' ){
		error = new Error(error);
	}
	//attempt to log this to console
	if( this.config.console && this.config.logLevel > 0 ){
		console.log(error.stack);
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
				console.log("Error while writing to log. " + err.stack);
				process.exit(1);
			}
			else{
				Log.processLogFileQueue();
			}
		});
	}
};