var Q = require('q');

module.exports = MiddleTest;
function MiddleTest(client, services, config){
	this.client = client;
	this.services = services;
	this.config = config;
};

MiddleTest.prototype.handler = function(messageData){
	var deferred = Q.defer();

	this.services['Log'].log('MiddleTest for message: '+messageData.message, 4);
	setTimeout( function(){
		deferred.resolve();
	}, 500);

	return deferred.promise;
};