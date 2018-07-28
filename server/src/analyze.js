const mongodb = require('mongodb');
const fs = require('fs');
const MongoClient = mongodb.MongoClient;
const Gauge = require('gauge');

const url = 'mongodb://localhost:27017';

const START = 1;
const LIMIT = 1000000;

async function run() {
    const client = await MongoClient.connect(url, { useNewUrlParser: true });
    console.log('Connected successfully to mongodb');

    const db = client.db('GolosSideCar');
    const blocksCol = db.collection('blocks');
    const gauge = new Gauge();

    const data = new Map();

    const pulseId = setInterval(() => {
        gauge.pulse();
    }, 250);

    for (let blockNum = START; blockNum < LIMIT; ++blockNum) {
        gauge.show(`progress: ${blockNum}/${LIMIT}`, blockNum / LIMIT);

        const block = await blocksCol.findOne({ blockNum }, { transactions: 1 });

        if (!block) {
            console.log('\nblock not found:', blockNum);
            continue;
        }

        data.set(blockNum, block.transactions.length);
    }

    clearInterval(pulseId);
    gauge.hide();

    const arr = [];

    for (let blockNum = START; blockNum < LIMIT; ++blockNum) {
        arr.push(data.get(blockNum) || 0);
    }

    fs.writeFile('../data/transactions_length.js', 'window.DATA=' + JSON.stringify(arr), err => {
        if (err) {
            console.error(err)
        } else {
            console.log('ok');
        }

        client.close();
    });
}

run().catch(err => {
    console.error(err);
    process.exit(10);
});
