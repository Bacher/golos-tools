const MongoClient = require('mongodb').MongoClient;
const DiffMatchPatch = require('diff-match-patch');
const GolosPool = require('./GolosPool');

const PARA = 10;

const dmp = new DiffMatchPatch();

const url = 'mongodb://localhost:27017';

async function init() {
    const start = Date.now();

    const client = await MongoClient.connect(url, { useNewUrlParser: true });
    console.log('Connected successfully to mongodb');

    const pool = new GolosPool();
    pool.init(PARA);

    const db = client.db('GolosSideCar');
    const posts = db.collection('posts');

    for (let blockNum = 1; blockNum < 50000; blockNum += PARA) {
        const promises = [];

        for (let i = 0; i < PARA; i++) {
            promises.push(pool.getBlock(blockNum + i));
        }

        const blocks = await Promise.all(promises);

        for (let i = 0; i < blocks.length; i++) {
            await parseBlockNew(blockNum + i, blocks[i], posts);
        }
    }

    await client.close();
    console.log(`Happy end, remains: ${(Date.now() - start) / 1000}s.`);
    process.exit(0);
}

async function parseBlockNew(blockNum, block, posts) {
    if (block.transactions && block.transactions.length) {
        for (let transaction of block.transactions) {
            for (let [action, params] of transaction.operations) {
                if (action === 'comment' && !params.parent_author) {
                    //console.log(block, action, params);

                    const fullPermLink = `${params.author}/${params.permlink}`;

                    const already = await posts.findOne({ fullPermLink }, { body: 1, blocks: 1 });

                    if (already) {
                        console.log(blockNum, 'update:', fullPermLink);

                        let body;

                        if (/^@@ /.test(params.body)) {
                            const patch = dmp.patch_fromText(params.body);
                            body = dmp.patch_apply(patch, already.body);
                        } else {
                            body = params.body;
                        }

                        await posts.updateOne({ fullPermLink }, {
                            $set: {
                                body,
                                blocks: [...already.blocks, blockNum],
                            },
                        });

                    } else {
                        console.log(blockNum, 'insert:', fullPermLink);
                        await posts.insertOne({
                            fullPermLink,
                            author: params.author,
                            title: params.title,
                            body: params.body,
                            blocks: [blockNum],
                        });
                    }
                }
            }
        }
    }
}

init().catch(err => {
    console.error(err);
    process.exit(10);
});
