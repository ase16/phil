'use strict';

const config = require('config');
const log = require('winston');
log.level = config.get('log.level');

let datastore;
let cgeConfig = config.get("gcloud");
let will = config.get("will");
let autoscale = config.get("autoscale");
let MINIMUM_NUMBER_OF_INSTANCES = autoscale.minimumNumberOfInstances;
let MAXIMUM_NUMBER_OF_INSTANCES = autoscale.maximumNumberOfInstances;
let LOAD_CHECK_INTERVAL = autoscale.loadCheckInterval;
let MAX_BATCH_OPERATIONS = 500;		// This is the maximum number of batch operations that is allowed for datastore

function getAvailableVMs(callback) {
    var cloud = require('./cloud.js')(cgeConfig, function(err) {
        if (!err) {
            cloud.listVMsOfInstanceGroup(will.instanceGroupZone, will.instanceGroupName, function(err, res) {
                if (!err) {
					if (res.hasOwnProperty('managedInstances')) {
						var vmNames = res.managedInstances.filter(function(vm) {
							return (vm.hasOwnProperty('instanceStatus') && vm.instanceStatus === 'RUNNING');
						}).map(function(vm) {
							return vm.name;
						});
						return callback(null, vmNames);
					}
					else {
						return callback(null, []);
					}
                }
                else {
					return callback(err);
                }
            });
        }
        else {
			return callback(err);
        }
    });
}

function resizeVMs(newSize, callback) {
	var cloud = require('./cloud.js')(cgeConfig, function(err) {
		if (!err) {
			cloud.resizeInstanceGroup(will.instanceGroupZone, will.instanceGroupName, newSize, function(err, res) {
				if (!err) {
					log.info('Succesfully requested adjustment of the instance group size');
					callback(null, res);
				}
				else {
					callback(err);
				}
			});
		}
		else {
			callback(err);
		}
	});
}

function calculateNewSizeOfInstanceGroup(vms, callback) {
	if (vms.length > 0) {
		var totalLoad = 0;

		for(let i = 0; i < vms.length; i++) {
			totalLoad += vms[i].data.load;
		}

		var averageLoadAbsolute = totalLoad / vms.length;
		var averageLoadRelative = averageLoadAbsolute / MAX_BATCH_OPERATIONS;

		log.debug("The totalLoad of the VMs is = ", totalLoad);
		log.debug("The averageLoadAbsolute of the VMs is = ", averageLoadAbsolute);
		log.debug("The averageLoadRelative of the VMs is = ", averageLoadRelative);

		if (averageLoadRelative > 0) {
			var sizeModification = ((averageLoadRelative > 0.9) ? 1 : (averageLoadRelative < 0.5) ? -1 : 0);
			var newSize = vms.length + sizeModification;
			var adjustedNewSize = (newSize <= MINIMUM_NUMBER_OF_INSTANCES ? MINIMUM_NUMBER_OF_INSTANCES : newSize);
			adjustedNewSize = (newSize >= MAXIMUM_NUMBER_OF_INSTANCES ? MAXIMUM_NUMBER_OF_INSTANCES : adjustedNewSize);

			log.debug("The size of the instance group is = ", vms.length);
			log.debug("The sizeModification of the instance group is = ", sizeModification);
			log.debug("The newSize of the instance group is = ", newSize);
			log.debug("The adjustedNewSize of the instance group is = ", adjustedNewSize);

			return callback(null, adjustedNewSize);
		}
		else {
			return callback('Average load of the VMs is 0, which indicates that jazz is not delivering any new tweets that the will-nodes could analyze');
		}
	}
	else {
		return callback('The calculateNewSizeOfInstanceGroup method needs as input parameter an array of vms that is not empty!');
	}
}

// ToDo: Use async to avoid this callback-hell
function autoscaleVMs() {
	getAvailableVMs(function(err, vmNames) {
		if (!err) {
			datastore.getVMLoads(vmNames, function(err, vms) {
				if (!err) {
					calculateNewSizeOfInstanceGroup(vms, function(err, newSize) {
						if (!err) {
							resizeVMs(newSize, function(err) {
								if (!err) {
									setTimeout(autoscaleVMs, LOAD_CHECK_INTERVAL * 1000);
								}
								else {
									log.error(err);
									setTimeout(autoscaleVMs, LOAD_CHECK_INTERVAL * 1000);
								}
							});
						}
						else {
							log.error(err);
							setTimeout(autoscaleVMs, LOAD_CHECK_INTERVAL * 1000);
						}
					});
				}
				else {
					log.error(err);
					setTimeout(autoscaleVMs, LOAD_CHECK_INTERVAL * 1000);
				}
			});
		}
		else {
			log.error(err);
			setTimeout(autoscaleVMs, LOAD_CHECK_INTERVAL * 1000);
		}
	});
}

const autoscaler = {
    init: function(datastoreObject, callback) {
		datastore = datastoreObject;
		autoscaleVMs();
		callback();
    }
};

module.exports = autoscaler;