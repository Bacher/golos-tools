const MOD = 100;

const chunksCount = Math.ceil(DATA.length / MOD);

const x = [];
const y1 = [];
const y2 = [];

for (let chunk = 0; chunk < chunksCount; ++chunk) {
    const offset = chunk * MOD;

    let sum = 0;
    let count = 0;
    let max = 0;

    for (let i = 0; i < MOD && offset + i < DATA.length; ++i) {
        const value = DATA[offset + i] * 1000;
        sum += value;
        count++;
        if (value > max) {
            max = value;
        }
    }

    x.push(chunk * MOD * 6);
    y1.push(sum / count);
    y2.push(max);
}

// for (let i = 0; i < DATA.length; ++i) {
//     x.push(i);
//     y.push(DATA[i]);
// }

const trace1 = {
    x,
    y: y1,
    name: 'avg',
    type: 'scatter'
};

const trace2 = {
    x,
    y: y2,
    name: 'max',
    type: 'scatter'
};

const data = [
    trace1,
    //trace2,
];
//const layout = { barmode: 'overlay' };

Plotly.newPlot('chart', data);
