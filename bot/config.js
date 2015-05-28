var secret,
    config = {};

//attempt to include the secret data file
try{
    secret = require('./secret.js');
} catch (e){
    secret = {};
}

/**
* Google API CONFIG
**/
if( secret.googleApi ){
    config.googleApi = {
        key: secret.googleApi.key ? secret.googleApi.key : ''
    };
}
else{
    config.googleApi = undefined;
}

/**
* IRC DATA CONFIG
**/
if( secret.irc ){
    //pull from secret data and fallback to defaults
    config.irc = {
        host: secret.irc.host ? secret.irc.host : 'us.quakenet.org',
        nick: secret.irc.nick ? secret.irc.nick : 'SurgeBot',
        channels: secret.irc.channels ? secret.irc.channels : ['#SurgeBot'],
        breakOnPassive: secret.irc.breakOnPassive ? secret.irc.breakOnPassive : true,
        noConflictMode: secret.irc.noConflictMode ? secret.irc.noConflictMode : true
    }
}
else{
    //use defaults
    config.irc = {
        host: 'us.quakenet.org',
        nick: '['+String.fromCharCode(96+Date.now()%10) + ']SurgeBot',
        channels: ['#SurgeBot'],
        breakOnPassive: true,
        noConflictMode: true
    };
}

/**
*   EMAIL CONFIG
**/
if( secret.email ){
    config.email = {
        service: secret.email.service ? secret.email.service : undefined,
        secure: secret.email.secure ? secret.email.secure : false,
        host: secret.email.host ? secret.email.host : undefined,
        port: secret.email.port ? secret.email.port : 25,
        username: secret.email.username ? secret.email.username : undefined,
        password: secret.email.password ? secret.email.password : undefined,
        replyTo: secret.email.replyTo ? secret.email.replyTo : undefined
    };
}
else{
    secret.email = undefined;
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
*   Logging
**/
if( secret.log ){
    config.log = {
        logLevel: secret.log.logLevel ? secret.log.logLevel : 1,
        console: secret.log.console ? secret.log.console : false,
        logFile: secret.log.logFile ? secret.log.logFile : false,
        logFilePath: secret.log.logFilePath ? secret.log.logFilePath : './log/botLog.log',
        breakOnError: secret.log.breakOnError ? secret.log.breakOnError : false
    }
}
else{
    //use defaults
    config.log = {
        logLevel: 1,
        console: false,
        logFile: false,
        logFilePath: './log/botLog.log',
        breakOnError: false
    }
}

//export the config options
module.exports = config;