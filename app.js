'use strict';
const config = require('config');
const log = require('winston');
log.level = config.get('log.level');

const datastore = require('./datastore.js');
const autoscaler = require('./autoscaler.js');

log.info('Phil is starting.');
datastore.connect(config.get('gcloud'), function() {
    autoscaler.init(datastore, function(err, res) {
        log.info('Phil is ready.');
    });
});