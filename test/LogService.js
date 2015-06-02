var chai = require('chai'),
	assert = chai.assert,
	expect = chai.expect,
	should = chai.should,
	sinon = require('sinon'),
	fs = require('fs'),
	Log = require('../bot/services/Log.js');

describe('Log.js', function(){
	beforeEach(function(){
		try{
			fs.unlinkSync( process.cwd()+'/log/botLog.log' );
		} catch (e){

		}
	});
	afterEach(function(){
		try{
			fs.unlinkSync( process.cwd()+'/log/botLog.log' );
		} catch (e){

		}
	});
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
		it( 'Should add messages to queue when logFile = true', function(){
			var newLog = new Log({
				logFile: true
			});
			sinon.stub(newLog, 'addToLogFileQueue');
			newLog.log('test', 1);
			assert(newLog.addToLogFileQueue.calledOnce);
		});
		it( 'Should log to console if console = true', function(){
			var newLog = new Log({
				console: true
			});
			sinon.stub(console, 'log');
			newLog.log('test', 1);
			assert(console.log.calledOnce);
			console.log.restore();
		});
		it( 'Should be able to log to console and file', function(){
			var newLog = new Log({
				console: true,
				logFile: true
			});
			sinon.stub(console, 'log');
			sinon.stub(newLog, 'addToLogFileQueue');
			newLog.log('test', 1);
			assert(console.log.calledOnce);
			assert(newLog.addToLogFileQueue.calledOnce);
			console.log.restore();
		});
	});
	describe('Log.error', function(){
		it( 'Should attempt to trace errors when logging to console', function(){
			var newLog = new Log({
				console: true
			});
			var testErr = new Error('Text');
			sinon.stub(console, 'log');
			newLog.error(testErr);
			assert(console.log.calledWith(testErr.stack));
			console.log.restore();
		});

		it( 'Should attempt to trace errors when logging to file', function(){
			var newLog = new Log({
				logFile: true
			});
			var testErr = new Error('Text');
			sinon.stub(newLog, 'addToLogFileQueue');
			newLog.error(testErr);
			assert(newLog.addToLogFileQueue.calledWith(testErr.stack));
		});

		it( 'Should be able to error to console and file', function(){
			var newLog = new Log({
				logFile: true,
				console: true
			});
			var testErr = new Error('Text');
			sinon.stub(newLog, 'addToLogFileQueue');
			sinon.stub(console, 'log');
			newLog.error(testErr);
			assert(newLog.addToLogFileQueue.calledWith(testErr.stack));
			assert(console.log.calledWith(testErr.stack));
			console.log.restore();
		});

		it( 'Should exit on error', function(){
			var newLog = new Log({
				breakOnError: true
			});
			var testErr = new Error('Text');
			sinon.stub(process, 'exit');
			newLog.error(testErr);
			assert(process.exit.calledOnce);
			process.exit.restore();
		});

		it( 'Should convert string inputs to errors', function(){
			var newLog = new Log({
				console: true
			});
			var testErr = 'Test';
			sinon.stub(console, 'log');

			newLog.error(testErr);

			//test the output by assuming that the stack trace will be more than one line
			expect(console.log.firstCall.args[0].split('\n') > 1);

			console.log.restore();

		});
	});

	describe('Log.addToLogFileQueue', function(){
		it( 'Should add a message to the queue object', function(){
			var newLog = new Log();
			
			//prevent the queue from being processed so we can see the message go in
			sinon.stub(newLog, 'processLogFileQueue');
			newLog.addToLogFileQueue('Test');
			expect(newLog.logFile.queue[0]).equal('Test');
		});
		it( 'Should tell the message queue to process', function(){
			var newLog = new Log();

			sinon.stub(newLog, 'processLogFileQueue');
			newLog.addToLogFileQueue('Test');
			expect(newLog.processLogFileQueue.calledOnce);
		});
	});
	describe('Log.processLogFileQueue', function(){
		beforeEach( function(){
			sinon.stub(fs, 'appendFile');
		});
		afterEach( function(){
			fs.appendFile.restore();
		});
		it( 'Should only attempt to write if queue not empty', function(){
			var newLog = new Log();

			newLog.processLogFileQueue();
			expect(fs.appendFile.callCount == 0);
		});

		it( 'Should not write if already writing', function(){
			var newLog = new Log();

			newLog.logFile.writing = true;
			newLog.processLogFileQueue();
			expect(fs.appendFile.callCount == 0);
		});

		it( 'Should set the writing flag', function(){
			var newLog = new Log();

			newLog.logFile.queue.push('Test');
			newLog.processLogFileQueue();
			expect(newLog.logFile.writing == true);
		});

		it( 'Should remove the first item from the queue', function(){
			var newLog = new Log();
			fs.appendFile.callsArg(2);

			newLog.logFile.queue.push('Test');
			newLog.processLogFileQueue();

			expect(newLog.logFile.queue).to.be.empty;
		});

		it( 'Should set the writing flag to false after writing to file', function(){
			var newLog = new Log();
			fs.appendFile.callsArg(2);

			newLog.logFile.queue.push('Test');
			newLog.processLogFileQueue();

			expect(newLog.logFile.writing == false);
		});

		it( 'Should exit on file append error and write stack to console', function(){
			var newLog = new Log();
			var testError = new Error('Test Error');
			fs.appendFile.callsArgWith(2, testError);

			sinon.stub(process, 'exit');
			var consoleStub = sinon.stub(console, 'log');

			newLog.logFile.queue.push('Test');
			newLog.processLogFileQueue();

			expect(console.log.calledWith(testError.stack));
			expect(process.exit.calledOnce);

			consoleStub.restore();
			process.exit.restore();
		});
	});
});