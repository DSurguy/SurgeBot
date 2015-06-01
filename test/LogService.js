var chai = require('chai'),
	assert = chai.assert,
	expect = chai.expect,
	should = chai.should,
	sinon = require('sinon'),
	Log = require('../bot/services/Log.js');

describe('Log.js', function(){
	describe('Constructor', function(){
		it('Should construct with default config', function(){
			var newLog = new Log();
			expect(newLog).to.be.an.instanceof(Log);
			expect(newLog.config).to.exist;
			//now check each property
			var configParams = [
				'logLevel',
				'console',
				'logFile',
				'logFilePath',
				'breakOnError'
			];
			for( var i=0; i<configParams.length; i++ ){
				expect(newLog.config[configParams[i]]).to.exist;
			}
		});
		it( 'Should construct with passed config', function(){
			var configObject = {
				logLevel: 4,
				console: false,
				logFile: true,
				logFilePath: 'testFolder',
				breakOnError: false
			};
			var newLog = new Log(configObject);

			assert.deepEqual(configObject, newLog.config);
		});
		it( 'Should decouple the config references to prevent accidental editing', function(){
			var configObject = {
				logLevel: 2
			};
			var newLog = new Log(configObject);
			configObject.logLevel = 3;
			assert.notEqual(newLog.config.logLevel, configObject.logLevel);
		});
		it( 'Should have a logFile queue for added messages', function(){
			var newLog = new Log();
			expect(newLog.logFile.queue).toExist;
		});
	});
	describe('Log.log', function(){
		it( 'Should call the function that updates the message queue when logFile = true', function(){
			var newLog = new Log({
				logFile: true
			});
			var spy = sinon.spy(newLog, 'addToLogFileQueue');
			newLog.log('test', 1);
			assert(spy.calledOnce);
		});
	});
});