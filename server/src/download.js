const mongodb = require('mongodb');
const MongoClient = mongodb.MongoClient;
const Gauge = require('gauge');
const GolosPool = require('./GolosPool');

const PARA = 10;

const url = 'mongodb://localhost:27017';

const DOWNLOAD_COUNT = 200000;
const i = parseInt(process.argv[process.argv.length - 1], 10) || 0;
const startBlock = i * DOWNLOAD_COUNT;

let duplicatesCount = 0;

console.log(`Download blocks ${startBlock} - ${startBlock + DOWNLOAD_COUNT}`);

async function init() {
    const start = Date.now();

    const client = await MongoClient.connect(url, { useNewUrlParser: true });
    console.log('Connected successfully to mongodb');

    const pool = new GolosPool();
    pool.init(PARA);

    const db = client.db('GolosSideCar');
    const blocksCol = db.collection('blocks');

    //await blocksCol.dropIndex('blockNum_1');
    await blocksCol.createIndex({
        blockNum: 1,
    }, {
        unique: true,
    });

    const limit = startBlock + DOWNLOAD_COUNT;

    const gauge = new Gauge();

    const pulseId = setInterval(() => {
        gauge.pulse();
    }, 250);

    for (let blockNum = startBlock; blockNum < limit; blockNum += PARA) {
        gauge.show(
            `downloading: ${blockNum}/${limit}${duplicatesCount > 0 ? ` duplicates: ${duplicatesCount}` : ''}`,
            (blockNum - startBlock) / (limit - startBlock)
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
    }

    clearInterval(pulseId);

    gauge.hide();
    await client.close();
    console.log(`Happy end, remains: ${((Date.now() - start) / 60 / 1000).toFixed(1)}m.`);
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
