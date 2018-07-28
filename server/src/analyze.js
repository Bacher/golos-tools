const mongodb = require('mongodb');
const fs = require('fs');
const MongoClient = mongodb.MongoClient;
const Gauge = require('gauge');

const url = 'mongodb://localhost:27017';

const START = 1;
const LIMIT = 6000000;
const STEP = 1000;

async function run() {
    const client = await MongoClient.connect(url, { useNewUrlParser: true });
    console.log('Connected successfully to mongodb');

    const db = client.db('GolosSideCar');
    const blocksCol = db.collection('blocks');
    const gauge = new Gauge();

    const data = [];

    const pulseId = setInterval(() => {
        gauge.pulse();
    }, 250);

    for (let blockNum = START; blockNum < LIMIT; blockNum += STEP) {
        gauge.show(`progress: ${blockNum}/${LIMIT}`, (blockNum - START) / (LIMIT - START));

        const block = await blocksCol.findOne({ blockNum }, { transactions: 1 });

        let len = 0;

        if (!block) {
            console.log('\nblock not found:', blockNum);
            len = 0;
            continue;
        } else {
            for (let tr of block.transactions) {
                for (let [action, params] of tr.operations) {
                    if (action === 'comment' && !params.parent_author) {
                        len++;
                    }
                }
            }
        }

        data.push(len);
    }

    clearInterval(pulseId);
    gauge.hide();

    fs.writeFile('../data/transactions_length.js', 'window.DATA=' + JSON.stringify(data), err => {
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
