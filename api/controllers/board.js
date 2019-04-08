const { paginatedResponse } = require('../helpers/response');
const { getORQuery } = require('../helpers/query');
const Board = require('../models/Board');
const azure = require('azure-storage');
const blobService = azure.createBlobService();

const BLOB_CONTAINER_NAME = process.env.BLOB_CONTAINER_NAME || 'cblob';

module.exports = {
  createBoard: createBoard,
  listBoard: listBoard,
  removeBoard: removeBoard,
  getBoard: getBoard,
  updateBoard: updateBoard,
  getBoardsEmail: getBoardsEmail
};

async function createContainerIfNotExists(shareName) {
  const result = await new Promise((resolve, reject) => {
    blobService.createContainerIfNotExists(shareName, function(error, result) {
      if (!error) {
        resolve(result);
      } else {
        reject(error);
      }
    });
  });
  return result;
}

async function createBlockBlobFromText({ fileName, buffer }) {
  const result = await new Promise((resolve, reject) => {
    blobService.createBlockBlobFromText(
      BLOB_CONTAINER_NAME,
      fileName,
      buffer,
      { contentSettings: { contentType: 'audio/mp4' } },
      (error, result) => {
        if (!error) {
          resolve(result);
        } else {
          reject(error);
        }
      }
    );
  });

  return result;
}

async function createBoard(req, res) {
  const basePath = `${__dirname}/audio`;
  const boardData = req.body;
  try {
    await createContainerIfNotExists(BLOB_CONTAINER_NAME);
    const tiles = [];
    for (const tile of boardData.tiles) {
      if (tile.sound) {
        let date = new Date();
        date = Math.floor(date.getTime() / 1000);
        const fileName = `${date}.mp4`;
        const fileUploade = await createBlockBlobFromText({
          fileName,
          buffer: Buffer.from(tile.sound.split(';base64,').pop(), 'base64')
        });
        const audioPath = blobService.getUrl(
          fileUploade.container,
          fileUploade.name
        );
        tiles.push({ ...tile, sound: audioPath });
      } else {
        tiles.push(tile);
      }
    }
    boardData.tiles = tiles;
    const board = new Board(boardData);
    await board.save();
    return res.status(200).json(board.toJSON());
  } catch (err) {
    return res.status(500).json(err.message);
  }
}

async function listBoard(req, res) {
  const { search = '' } = req.query;
  const searchFields = ['name', 'author', 'email'];
  const query =
    search && search.length ? getORQuery(searchFields, search, true) : {};

  const response = await paginatedResponse(Board, { query }, req.query);

  return res.status(200).json(response);
}

async function getBoardsEmail(req, res) {
  const { search = '' } = req.query;
  const email = req.swagger.params.email.value;
  const searchFields = ['name', 'author'];
  const query =
    search && search.length ? getORQuery(searchFields, search, true) : {};

  const response = await paginatedResponse(
    Board,
    { query: { ...query, email } },
    req.query
  );

  return res.status(200).json(response);
}

function removeBoard(req, res) {
  const id = req.swagger.params.id.value;
  Board.findByIdAndRemove(id, function(err, boards) {
    if (err) {
      return res.status(404).json({
        message: 'Board not found. Board Id: ' + id,
        error: err
      });
    }
    return res.status(200).json(boards);
  });
}

function getBoard(req, res) {
  const id = req.swagger.params.id.value;
  Board.findOne({ _id: id }, function(err, boards) {
    if (err) {
      return res.status(500).json({
        message: 'Error getting board. ',
        error: err
      });
    }
    if (!boards) {
      return res.status(404).json({
        message: 'Board does not exist. Board Id: ' + id
      });
    }
    return res.status(200).json(boards.toJSON());
  });
}

function updateBoard(req, res) {
  const id = req.swagger.params.id.value;
  Board.findOne({ _id: id }, function(err, board) {
    if (err) {
      return res.status(500).json({
        message: 'Error updating board. ',
        error: err
      });
    }
    if (!board) {
      return res.status(404).json({
        message: 'Unable to find board. board Id: ' + id
      });
    }
    for (let key in req.body) {
      board[key] = req.body[key];
    }
    board.save(function(err, board) {
      if (err) {
        return res.status(500).json({
          message: 'Error saving board. ',
          error: err
        });
      }
      if (!board) {
        return res.status(404).json({
          message: 'Unable to find board. board id: ' + id
        });
      }
    });
    return res.status(200).json(board.toJSON());
  });
}
