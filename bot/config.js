var secret,
    config = {};

//attempt to include the secret data file
try{
    secret = require('./secret.js');
} catch (e){
    secret = {};
}

/**
* API CONFIG
**/
if( secret.api ){
    config.api = {
        key: secret.api.key ? secret.api.key : undefined,
        locale: secret.api.locale ? secret.api.locale : "en_US"
    };
}
else{
    config.api = {
        key: undefined,
        locale: "en_US"
    };
}

/**
* IRC DATA CONFIG
**/
if( secret.irc ){
    //pull from secret data and fallback to defaults
    config.irc = {
        host: secret.irc.host ? secret.irc.host : 'us.quakenet.org',
        nick: secret.irc.nick ? secret.irc.nick : '['+String.fromCharCode(95+Date.now()%10) + ']SurgeBot',
        channels: secret.irc.channels ? secret.irc.channels : ['#SurgeBot']
    }
}
else{
    //use defaults
    config.irc = {
        host: 'us.quakenet.org',
        nick: '['+String.fromCharCode(96+Date.now()%10) + ']SurgeBot',
        channels: ['#SurgeBot']
    }
}

/**
* MONGO CONFIG
**/
if( secret.mongo ){
    config.mongo = {
        user: secret.mongo.user ? secret.mongo.user : 'noUser',
        pass: secret.mongo.pass ? secret.mongo.pass : 'noPass',
        url: secret.mongo.url ? secret.mongo.url : 'noUrl'
    };
}
else{
    //Don't initialize DB
    config.mongo = undefined;
}

/**
*   ADMIN LIST CONFIG
**/
if( secret.adminList ){
    config.adminList = secret.adminList ? secret.adminList : {};
}
else{
    config.adminList = {};
}

/**
*   FLOOD PREVENTION CONFIG
**/
if( secret.flood ){
    config.flood = {
        shortFloodCount: secret.flood.shortFloodCount ? secret.flood.shortFloodCount : 5,
        shortFloodTime: secret.flood.shortFloodTime ? secret.flood.shortFloodTime : 5000,
        shortFloodPenalty: secret.flood.shortFloodPenalty ? secret.flood.shortFloodPenalty : 300000,
        longFloodCount: secret.flood.longFloodCount ? secret.flood.longFloodCount : 5,
        maxFloodCount: secret.flood.maxFloodCount ? secret.flood.maxFloodCount : 100
    };
}
else{
    config.flood = {
        shortFloodCount: 5,
        shortFloodTime: 5000,
        shortFloodPenalty: 300000,
        longFloodCount: 5,
        maxFloodCount: 100
    };
}


/**
*   DEBUGGING
**/
if( secret.debug ){
    config.debug = {
        logLevel: secret.debug.logLevel ? secret.debug.logLevel : 1,
        console: secret.debug.console ? secret.debug.console : false,
        logFile: secret.debug.logFile ? secret.debug.logFile : true,
        logFilePath: secret.debug.logFilePath ? secret.debug.logFilePath : './log/botLog.log',
        breakOnError: secret.debug.breakOnError ? secret.debug.breakOnError : false
    }
}
else{
    //use defaults
    config.debug = {
        logLevel: 1,
        console: false,
        logFile: true,
        logFilePath: './log/botLog.log',
        breakOnError: false
    }
}

//export the config options
module.exports = config;