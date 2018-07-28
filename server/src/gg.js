const Gauge = require('gauge');

const gauge = new Gauge();

let i = 0;

setInterval(() => {
    gauge.show('loading', i / 100);
    gauge.pulse();
    i++;
}, 10);

setTimeout(() => {
    gauge.hide();
}, 10000);

