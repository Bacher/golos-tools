const mongo = require('mongodb');
const MongoClient = mongo.MongoClient;
const DiffMatchPatch = require('diff-match-patch');

const dmp = new DiffMatchPatch();

const url = 'mongodb://localhost:27017';

const START = 1;
const LIMIT = 100000;

const actions = new Set();

async function init() {
    const start = Date.now();

    const client = await MongoClient.connect(
        url,
        { useNewUrlParser: true }
    );
    console.log('Connected successfully to mongodb');

    const db = client.db('GolosSideCar');

    for (let col of ['posts', 'comments', 'accounts']) {
        try {
            await db.dropCollection(col);
        } catch (err) {}
    }

    const blocks = db.collection('blocks');
    const posts = db.collection('posts');
    const comments = db.collection('comments');
    const accounts = db.collection('accounts');

    await posts.createIndex(
        {
            fullPermLink: 1,
        },
        {
            unique: true,
        }
    );

    await posts.createIndex({
        author: 1,
    });

    await comments.createIndex({
        postFullPermLink: 1,
    });

    await comments.createIndex({
        parentFullPermLink: 1,
    });

    await comments.createIndex(
        {
            fullPermLink: 1,
        },
        {
            unique: true,
        }
    );

    await accounts.createIndex({
        account: 1,
    }, {
        unique: true,
    });

    const dbo = {
        blocks,
        posts,
        comments,
        accounts,
    };

    for (let blockNum = START; blockNum < LIMIT; ++blockNum) {
        const block = await blocks.findOne({ blockNum }, { transactions: 1 });
        await parseBlock(blockNum, block, dbo);
    }

    console.log(actions);

    await client.close();
    console.log(
        `Happy end, remains: ${((Date.now() - start) / 60 / 1000).toFixed(1)}m.`
    );
    process.exit(0);
}

async function parseBlock(blockNum, block, db) {
    if (!block || !block.transactions) {
        console.error(block);
        throw new Error(`Invalid block: ${blockNum}`);
    }

    if (!block.transactions.length) {
        return;
    }

    for (let transaction of block.transactions) {
        for (let [action, params] of transaction.operations) {
            await parseOperation(blockNum, block, db, action, params);
        }
    }
}

async function parseOperation(blockNum, block, db, action, params) {
    actions.add(action);

    if (action === 'vote') {
        const fullPermLink = params.author + '/' + params.permlink;

        let collection = 'posts';
        let entry = await db.posts.findOne(
            {
                fullPermLink,
            },
            { likes: 1, dislikes: 1 }
        );

        if (!entry) {
            collection = 'comments';
            entry = await db.comments.findOne(
                {
                    fullPermLink,
                },
                { likes: 1, dislikes: 1 }
            );
            return;
        }

        const weight = parseInt(params.weight);

        entry.likes.filter(vote => vote.voter !== params.voter);
        entry.dislikes.filter(vote => vote.voter !== params.voter);

        if (weight > 0) {
            entry.likes.push(params.voter);
        } else if (weight < 0) {
            entry.dislikes.push(params.voter);
        }

        console.log(blockNum, 'Update votes for:', fullPermLink);

        await db[collection].updateOne(
            { fullPermLink },
            {
                $set: {
                    likes: entry.likes,
                    dislikes: entry.dislikes,
                    likesCount: entry.likes.length,
                    dislikesCount: entry.dislikes.length,
                },
            }
        );

        return;
    }

    // Post
    if (action === 'comment' && !params.parent_author) {
        const fullPermLink = `${params.author}/${params.permlink}`;

        const already = await db.posts.findOne(
            { fullPermLink },
            { body: 1, blocks: 1 }
        );

        if (already) {
            console.log(blockNum, 'update:', fullPermLink);

            let body;

            if (/^@@ /.test(params.body)) {
                const patch = dmp.patch_fromText(params.body);
                body = dmp.patch_apply(patch, already.body)[0];
            } else {
                body = params.body;
            }

            await db.posts.updateOne(
                { fullPermLink },
                {
                    $set: {
                        body,
                        blocks: [...already.blocks, blockNum],
                    },
                }
            );
        } else {
            console.log(blockNum, 'insert:', fullPermLink);

            await db.posts.insertOne({
                fullPermLink,
                author: params.author,
                title: params.title,
                body: params.body,
                likes: [],
                dislikes: [],
                likesCount: 0,
                dislikesCount: 0,
                blocks: [blockNum],
            });
        }
    }

    // Comment
    if (action === 'comment' && params.parent_author) {
        const fullParentPermLink =
            params.parent_author + '/' + params.parent_permlink;
        const fullPermLink = params.author + '/' + params.permlink;

        const already = await db.comments.findOne({
            fullPermLink,
        }, { body: 1, blocks: 1 });

        if (already) {
            let body;

            if (/^@@ /.test(params.body)) {
                const patch = dmp.patch_fromText(params.body);
                body = dmp.patch_apply(patch, already.body)[0];
            } else {
                body = params.body;
            }

            await db.comments.updateOne({
                fullPermLink,
            }, {
                $set: {
                    body,
                    blocks: [...already.blocks, blockNum],
                }
            });

        } else {
            const comment = {
                fullPermLink,
                author: params.author,
                body: params.body,
                likes: [],
                dislikes: [],
                likesCount: 0,
                dislikesCount: 0,
                blocks: [blockNum],
            };

            const post = await db.posts.findOne(
                {
                    fullPermLink: fullParentPermLink,
                },
                { _id: 1 }
            );

            if (post) {
                comment.postFullPermLink = fullParentPermLink;
                comment.parentFullPermLink = null;
            } else {
                const parentComment = await db.comments.findOne(
                    {
                        fullPermLink: fullParentPermLink,
                    },
                    { postFullPermLink: 1 }
                );

                comment.postFullPermLink = parentComment.postFullPermLink;
                comment.parentFullPermLink = fullParentPermLink;
            }

            await db.comments.insertOne(comment);
        }
    }

    if (action === 'account_create') {
        //console.log(blockNum, 'create account', params.new_account_name);

        await db.accounts.insertOne({
            creator: params.creator,
            account: params.new_account_name,
            metadata: params.json_metadata ? JSON.parse(params.json_metadata) : null,
        });
        return;
    }

    if (action === 'account_update') {
        //console.log(blockNum, 'update account', params.new_account_name);

        await db.accounts.updateOne({
            account: params.account,
        }, {
            $set: {
                metadata: params.json_metadata ? JSON.parse(params.json_metadata) : null,
            }
        });
        return;
    }
}

init().catch(err => {
    console.error(err);
    process.exit(10);
});
