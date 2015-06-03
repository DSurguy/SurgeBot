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
	});
});