'use strict';

let handlers;
try {
  handlers = require('./handlers.js');
} catch (e) {
  handlers = require('../../../lib/handlers.js');
}

async function main(event) {
  const result = await handlers.handleChat(event);
  return handlers.toFunctionResponse(result);
}

exports.main = main;
