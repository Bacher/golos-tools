const mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;
const Gauge = require('gauge');
const GolosPool = require('./GolosPool');

const PARA = 10;

const url = 'mongodb://localhost:27017';

const startBlock = parseInt(process.argv[process.argv.length - 1], 10) || 0;

let stop = false;
let duplicatesCount = 0;

console.log(`Download blocks starts from ${startBlock}`);

async function init() {
    const start = Date.now();

    const client = await MongoClient.connect(
        url,
        { useNewUrlParser: true }
    );
    console.log('Connected successfully to mongodb');

    const pool = new GolosPool();
    pool.init(PARA);

    const db = client.db('GolosSideCar');
    const blocksCol = db.collection('blocks');

    //await blocksCol.dropIndex('blockNum_1');
    await blocksCol.createIndex(
        {
            blockNum: 1,
        },
        {
            unique: true,
        }
    );

    const gauge = new Gauge();

    const pulseId = setInterval(() => {
        gauge.pulse();
    }, 250);

    for (let blockNum = startBlock; ; blockNum += PARA) {
        gauge.show(
            `downloading: ${blockNum}${
                duplicatesCount > 0 ? ` duplicates: ${duplicatesCount}` : ''
            }`,
            0
        );

        const promises = [];

        for (let i = 0; i < PARA; i++) {
            if (blockNum + i > 0) {
                promises.push(pool.getBlock(blockNum + i));
            }
        }

        const blocks = await Promise.all(promises);

        for (let i = 0; i < blocks.length; i++) {
            await parseBlockNew(blockNum + i, blocks[i], blocksCol);
        }

        if (stop) {
            break;
        }
    }

    clearInterval(pulseId);

    gauge.hide();
    await client.close();

    console.log(
        `Happy end, remains: ${((Date.now() - start) / 60 / 1000).toFixed(1)}m.`
    );

    process.exit(0);
}

async function parseBlockNew(blockNum, block, blocksCol) {
    block.blockNum = blockNum;

    try {
        await blocksCol.insert(block);
    } catch (err) {
        if (err instanceof mongodb.MongoError && err.code === 11000) {
            // JUST OK
            duplicatesCount++;
        } else {
            throw err;
        }
    }
}

init().catch(err => {
    console.error(err);
    process.exit(10);
});

process.once('SIGINT', () => {
    console.log('try to stop');
    stop = true;
});

process.once('SIGTERM', () => {
    console.log('try to stop');
    stop = true;
});
