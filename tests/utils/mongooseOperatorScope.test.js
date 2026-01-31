const mongoose = require('mongoose');
const Branch = require('../../models/Branch');
const requestContext = require('../../utils/requestContext');

describe('mongooseOperatorScope plugin', () => {
    const withOperator = (operatorId, fn) => {
        return requestContext.runWithContext({ operatorId }, fn);
    };

    const runPreHook = async (model, hookName, context) => {
        const hooks = model.schema.s.hooks._pres.get(hookName) || [];
        if (!hooks.length) {
            throw new Error(`Missing ${hookName} hook on model ${model.modelName}`);
        }
        await new Promise((resolve) => hooks[0].fn.call(context, resolve));
    };

    it('scopes find queries to include operatorId', async () => {
        const operatorId = new mongoose.Types.ObjectId();
        const filter = { status: 'Active' };
        const queryStub = {
            getFilter: () => filter,
            where(criteria) {
                Object.assign(filter, criteria);
                return this;
            }
        };

        await withOperator(operatorId, () => runPreHook(Branch, 'find', queryStub));

        expect(filter.operatorId.toString()).toBe(operatorId.toString());
        expect(filter.status).toBe('Active');
    });

    it('keeps updates constrained to the operator context', async () => {
        const operatorId = new mongoose.Types.ObjectId();
        const filter = { status: 'Pending' };
        const queryStub = {
            getFilter: () => filter,
            where(criteria) {
                Object.assign(filter, criteria);
                return this;
            }
        };

        await withOperator(operatorId, () => runPreHook(Branch, 'updateMany', queryStub));

        expect(filter.operatorId.toString()).toBe(operatorId.toString());
        expect(filter.status).toBe('Pending');
    });

    it('injects operator match stages into aggregation pipelines', async () => {
        const operatorId = new mongoose.Types.ObjectId();
        const pipeline = [{ $group: { _id: '$operatorId', total: { $sum: 1 } } }];
        const aggregateStub = {
            pipeline: () => pipeline
        };

        const hooks = Branch.schema.s.hooks._pres.get('aggregate') || [];
        await withOperator(operatorId, () => new Promise((resolve) => hooks[0].fn.call(aggregateStub, resolve)));

        expect(pipeline[0].$match.operatorId.toString()).toBe(operatorId.toString());
    });
});
