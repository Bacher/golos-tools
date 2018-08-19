const mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;
const Gauge = require('gauge');

const url = 'mongodb://localhost:27017';

async function init() {
    const client = await MongoClient.connect(
        url,
        { useNewUrlParser: true }
    );

    console.log('Connected successfully to mongodb');

    const db = client.db('GolosSideCar');

    const blocks = db.collection('blocks');

    const gauge = new Gauge();

    const pulseId = setInterval(() => {
        gauge.pulse();
    }, 500);

    for (let i = 0; i < 100000; ++i) {
        gauge.show(`downloading: ${i}`, 0);

        const info = await blocks.findOne({ blockNum: i }, { _id: 1 });

        if (!info) {
            console.log('Missed block:', i);
        }
    }

    clearInterval(pulseId);
    await client.close();
    console.log('Scanning completed');
}

init().catch(err => {
    console.error(err);
});
