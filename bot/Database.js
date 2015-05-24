var q = require('q'),
	config = require('./config.js'),
	Mongo = require('mongodb');
	
var connectionString = 'mongodb://'+config.mongo.user+':'+config.mongo.pass+'@' + config.mongo.url;

function connect(callback) {
	Mongo.connect(connectionString, function (err, db){
		callback(err, db);
	});
}

function find(docType, filter) {
	var deferred = q.defer();
	connect(function(err, db) {
		if (err) {
			deferred.reject(err);
			db.close();
		} else {
			var collection = db.collection(docType);
			collection.find(filter).toArray(function(err, docs) {
				if (err) {
					deferred.reject(err);
				} else {
					deferred.resolve(docs);
				}
				db.close();
			});
		}
	});
	return deferred.promise;
}

// TODO: support arrays
function insert(docType, doc) {
	var deferred = q.defer();
	connect(function(err, db) {
		if (err) {
			deferred.reject(err);
			db.close();
		} else {
			var collection = db.collection(docType);
			collection.insert([doc], function(err, result) {
				if (err) {
					deferred.reject(err);
				} else {
					deferred.resolve(result);
				}		
				db.close();

			});
		}
	});
	return deferred.promise;
}

function update(docType, selector, doc) {
	var deferred = q.defer();
	connect(function(err, db) {
		if (err) {
			deferred.reject(err);
			db.close();
		} else {
			var collection = db.collection(docType);
			collection.update(selector, doc, function(err, result) {
				if (err) {
					deferred.reject(err);
				} else {
					deferred.resolve(result);
				}		
				db.close();

			});
		}
	});
	return deferred.promise;
}
module.exports = {
	find: find,
	insert: insert,
	update: update
}