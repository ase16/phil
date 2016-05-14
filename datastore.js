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

		var keys = [];
		vmNames.forEach(function(vmName) {
			keys.push( datastore.key(['VMLoad', vmName]) );
		});

		if (keys.length > 0) {
			datastore.get(keys, callback);
		}
		else {
			return callback(new Error('WillLoad Kind seems empty!'));
		}
    }
};

module.exports = db;