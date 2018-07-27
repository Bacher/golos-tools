const golos = require('golos-js');

class GolosPool {

    constructor() {
        this._queue = [];
        this._pool = new Set();
    }

    init(count = 5) {
        for (let i = 0; i < count; i++) {
            this._pool.add(new golos.api.Golos());
        }
    }

    getBlock(blockNum) {
        if (this._pool.size) {
            const apis = Array.from(this._pool);
            const api = apis[Math.floor(Math.random() * apis.length)];
            this._pool.delete(api);

            return this._callApi(api, blockNum);
        } else {
            return new Promise(resolve => {
                this._queue.push({ blockNum, resolve });
            });
        }
    }

    _callApi(api, blockNum) {
        return new Promise((resolve, reject) => {
            api.getBlock(blockNum, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }

                if (this._queue.length) {
                    const item = this._queue.shift();
                    item.resolve(this._callApi(api, item.blockNum));
                } else {
                    this._pool.add(api);
                }
            });
        })
    }
}

module.exports = GolosPool;
