'use strict';

const handlers = require('./handlers.js');

async function main(event) {
  try {
    const result = await handlers.handleAvatar(event);
    return handlers.toFunctionResponse(result);
  } catch (e) {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      body: { error: 'nicht erreichbar', reason: 'exception' },
    };
  }
}

exports.main = main;
