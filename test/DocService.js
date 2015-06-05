var chai = require('chai'),
	assert = chai.assert,
	expect = chai.expect,
	should = chai.should,
	sinon = require('sinon'),
	Docs = require('../bot/services/Docs.js');

describe('Docs.js', function(){
	describe('Constructor', function(){
		it( 'Should init with doc arrays for each binding type', function(){
			var newDoc = new Docs();

			var docTypes = [
				'_commands',
				'_passives',
				'_middleware',
				'_services'
			];

			for( var i=0; i<docTypes.length; i++ ){
				expect(newDoc[docTypes[i]]).to.exist;
			}
		});

		it( 'Should init with a list of docs for each binding type', function(){
			var newDoc = new Docs();

			var docTypes = [
				'commands',
				'passives',
				'middleware',
				'services'
			];

			for( var i=0; i<docTypes.length; i++ ){
				expect(newDoc._list[docTypes[i]]).to.exist;
			}
		});
	});
	describe('Docs.addDoc', function(){
		it( 'Should accept a well-formatted text array and return true for each binding type', function(){
			var newDoc = new Docs();

			expect( newDoc.addDoc('command', 'cmd', ['test', 'testytest', '\x0301test']) ).to.be.true;
			expect( newDoc.addDoc('service', 'cmd', ['test', 'testytest', '\x0301test']) ).to.be.true;
			expect( newDoc.addDoc('middleware', 'cmd', ['test', 'testytest', '\x0301test']) ).to.be.true;
			expect( newDoc.addDoc('passive', 'cmd', ['test', 'testytest', '\x0301test']) ).to.be.true;
		});
		it( 'Should add new docs to the respective binding type object', function(){
			var newDoc = new Docs();

			newDoc.addDoc('command', 'cmd', ['test']);
			newDoc.addDoc('service', 'cmd', ['test']);
			newDoc.addDoc('middleware', 'cmd', ['test']);
			newDoc.addDoc('passive', 'cmd', ['test']);

			expect(newDoc._commands['cmd']).to.have.length(1);
			expect(newDoc._services['cmd']).to.have.length(1);
			expect(newDoc._middleware['cmd']).to.have.length(1);
			expect(newDoc._passives['cmd']).to.have.length(1);
		});
		it( 'Should add bound docs to the list of labels for each binding type', function(){
			var newDoc = new Docs();

			newDoc.addDoc('command', 'cmd', ['test']);
			newDoc.addDoc('service', 'cmd', ['test']);
			newDoc.addDoc('middleware', 'cmd', ['test']);
			newDoc.addDoc('passive', 'cmd', ['test']);

			expect(newDoc._list.commands[0]).to.equal('cmd');
			expect(newDoc._list.services[0]).to.equal('cmd');
			expect(newDoc._list.middleware[0]).to.equal('cmd');
			expect(newDoc._list.passives[0]).to.equal('cmd');
		});
		it( 'Should reject any object that is not an array of text', function(){
			var newDoc = new Docs();

			expect(newDoc.addDoc.bind(newDoc, 'command', 'cmd', [1,2,3,4])).to.throw(Error);

			expect(newDoc.addDoc.bind(newDoc, 'command', 'cmd2', 'banana')).to.throw(Error);

			expect(newDoc.addDoc.bind(newDoc, 'command', 'cmd3', function(){})).to.throw(Error);

			expect(newDoc.addDoc.bind(newDoc, 'command', 'cmd4', ['test', 'test', 'test', 4])).to.throw(Error);

			expect(newDoc.addDoc.bind(newDoc, 'command', 'cmd5', {0:'test', 1: 'test', 2: 'test'})).to.throw(Error);
		});
	});
	describe('Docs.getDoc', function(){
		it('Should return a bound doc for each binding type', function(){
			var newDoc = new Docs();

			newDoc.addDoc('command', 'cmd', ['test']);
			newDoc.addDoc('service', 'cmd', ['test']);
			newDoc.addDoc('middleware', 'cmd', ['test']);
			newDoc.addDoc('passive', 'cmd', ['test']);

			expect(newDoc.getDoc('command', 'cmd')).to.have.length(1);
			expect(newDoc.getDoc('service', 'cmd')).to.have.length(1);
			expect(newDoc.getDoc('middleware', 'cmd')).to.have.length(1);
			expect(newDoc.getDoc('passive', 'cmd')).to.have.length(1);
		});
		it( 'Should return a new instance of the doc to prevent reference editing', function(){
			var newDoc = new Docs();

			newDoc.addDoc('command', 'cmd', ['test']);

			var docClone = newDoc.getDoc('command', 'cmd');

			docClone[0] = 'changed';

			expect(newDoc._commands['cmd'][0]).to.not.equal(docClone[0]);
		});
		it( 'Should reject requesting for a binding type that doesn\'t exist', function(){
			var newDoc = new Docs();

			expect(newDoc.getDoc.bind(newDoc, 'potato', 'yep')).to.throw(Error);
		});
		it( 'Should return undefined for a binding label that doesn\' exist', function(){
			var newDoc = new Docs();

			expect(newDoc.getDoc('command', 'cmd')).to.be.equal(undefined);
		});
	});
	describe('Docs.getList', function(){
		it( 'Should return a new instance of the doc to prevent reference editing', function(){
			var newDoc = new Docs();

			newDoc.addDoc('command', 'cmd', ['test']);

			var listClone = newDoc.getList();

			listClone.services.push('test');

			expect(listClone.services[0]).to.not.equal(newDoc._list.services[0]);
		});
	});
});