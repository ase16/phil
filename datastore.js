'use strict';
const gcloud = require('gcloud');
const config = require('config');
const log = require('winston');
log.level = config.get('log.level');

// Authenticating on a per-API-basis.
let datastore;

// This is a pseudo-check to see if we have a connection. If the object is not undefined, we assume it has been initialized/set
const isConnected = () => typeof datastore !== "undefined";

const db = {
    connect: function(conf, callback) {
        // do we already have a connection?
        if (isConnected()) return;
        datastore = gcloud.datastore(conf);
        callback();
    },

    // @param callback fn(err, res)
	getVMLoads: function(vmNames, callback) {
		if (!isConnected()) {
			return callback("Not connected", []);
		}

		var query = datastore
			.createQuery('VMLoad')
			.autoPaginate(false);
		datastore.runQuery(query, function(err, entities) {

			// First, we collect in 'oldKeys' the keys of the entities that reflect the load of vms that are no longer running
			var oldKeys = entities.filter(function(e) {
				return (vmNames.indexOf(e.key.name) == -1);
			}).map(function(vm) {
				return vm.key;
			});

			log.debug('Old Keys = ', oldKeys);

			// Then we delete these entities (asynchronously)
			if (oldKeys.length > 0) {
				datastore.delete(oldKeys, function(err) {
					if (!err) {
						log.info('Old VMLoad-Entities were deleted successfully');
					}
					else {
						log.error('Something went wrong during the deletion of old VMLoad-Entities! Err = ', err);
					}
				});
			}

			// From (all of) the entities we then only need the entities that reflect the load of vms that are running

			log.debug("entities = ", entities);
			var validEntities = entities.filter(function(e) {
				return (vmNames.indexOf(e.key.name) > -1);
			});

			log.debug("validEntities = ", validEntities);

			if (validEntities.length > 0) {
				return callback(null, validEntities);
			}
			else {
				return callback('The kind "VMLoad" does not seem to have entities that present the load of currently running vms!');
			}
		});
	}
};

module.exports = db;