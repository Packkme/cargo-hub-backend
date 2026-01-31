const { AsyncLocalStorage } = require('async_hooks');
const mongoose = require('mongoose');

class RequestContext {
    constructor() {
        this.storage = new AsyncLocalStorage();
    }

    get() {
        return this.storage.getStore() || {};
    }

    getRequestId() {
        return this.get().requestId;
    }

    getCurrentDate() {
        return this.get().timestamp || new Date();
    }


    middleware() {
        return (req, res, next) => {
            const roleName = req.user?.role?.rolename;
            const isSuperUser = roleName === 'SuperUser';
            const context = {
                requestId: `${new mongoose.Types.ObjectId()} - ${req.originalUrl}`,
                timestamp: new Date(),
                pid: process.pid,
                userId: req.user?.id,
                operatorId: isSuperUser ? null : req.user?.operatorId,
                roleName
            };
            this.storage.run(context, () => {
                next();
            });
        };
    }
}

module.exports = {
    instance: new RequestContext(),
    get() {
        return this.instance.get();
    },
    getRequestId() {
        return this.instance.getRequestId();
    },
    getOperatorId() {
        return this.isSuperUser() ? null : this.get().operatorId;
    },
    getUserRole() {
        return this.get().roleName;
    },
    isSuperUser() {
        return this.get().roleName === 'SuperUser';
    },
    getCurrentDate() {
        return this.instance.getCurrentDate();
    },
    runWithContext(context, callback) {
        return this.instance.storage.run(context, callback);
    }
};
