const golos = require('golos-js');

golos.api.getConfig(function(err, result) {
    // console.log('getConfig', result);

    // golos.api.getDynamicGlobalProperties(function(err, result) {
    //     console.log('getDynamicGlobalProperties', result);
    //
    //     golos.api.getChainProperties(function(err, result) {
    //         console.log('getChainProperties', result);
    //
    //         //process.exit(0);
    //     });
    // });

    golos.api.getAccountHistory('nickshtefan', 1000, 100, function(err, result) {
        if (err) {
            console.error(err);
            return;
        }

        //console.log(result);

        for (let [, item] of result) {
            console.log(item.op[0]);
        }
    });
});

