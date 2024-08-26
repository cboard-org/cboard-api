const mongoose = require('mongoose');
const {schema: boardSchema, options: boardSchemaOptions } = require('./Board');
const Schema = mongoose.Schema;

const tempBoardSchema = new Schema(boardSchema, { ...boardSchemaOptions, timestamps: true });
const TempBoard = mongoose.model('TempBoard', tempBoardSchema, 'temporary_boards');

// Add a TTL index to automatically delete documents after 5 minutes
TempBoard.collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: 300 });

module.exports = TempBoard;
