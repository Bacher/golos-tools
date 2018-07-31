const golos = require('golos-js');

golos.api.getConfig(function(err, result) {
    console.log('getConfig', result);

    golos.api.getDynamicGlobalProperties(function(err, result) {
        console.log('getDynamicGlobalProperties', result);

        golos.api.getChainProperties(function(err, result) {
            console.log('getChainProperties', result);

            //process.exit(0);
        });
    });
});

