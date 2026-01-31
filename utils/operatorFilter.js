const buildOperatorFilter = (operatorId) => (operatorId ? { operatorId } : {});

const appendOperatorFilter = (query, operatorId) =>
  operatorId ? { ...query, operatorId } : query;

module.exports = {
  buildOperatorFilter,
  appendOperatorFilter,
};
