var ObjectId = require('mongoose').Types.ObjectId;
const moment = require('moment');

const { paginatedResponse } = require('../helpers/response');
const { getORQuery } = require('../helpers/query');
const Board = require('../models/Board');
const { getCbuilderBoardbyId } = require('../helpers/cbuilder');

const {nev} = require('../mail');


module.exports = {
  createBoard: createBoard,
  listBoard: listBoard,
  deleteBoard: deleteBoard,
  getBoard: getBoard,
  updateBoard: updateBoard,
  getBoardsEmail: getBoardsEmail,
  getPublicBoards: getPublicBoards,
  reportPublicBoard: reportPublicBoard,
  getCbuilderBoard: getCbuilderBoard
};

// TODO: Use the caller's email instead of getting it from the body.
function createBoard(req, res) {
  const board = new Board(req.body);
  board.lastEdited = moment().format();
  board.save(function (err, board) {
    if (err) {
      return res.status(409).json({
        message: 'Error saving board',
        error: err.message
      });
    }
    return res.status(200).json(board.toJSON());
  });
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
  const email = req.swagger.params.email.value;

  if (!req.user.isAdmin && req.user.email !== email) {
    return res.status(403).json({
      message: "You are not authorized to get this user's boards."
    });
  }

  const { search = '' } = req.query;

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

async function getPublicBoards(req, res) {
  const { search = '' } = req.query;
  const searchFields = ['name', 'author'];
  const query =
    search && search.length ? getORQuery(searchFields, search, true) : {};
  const response = await paginatedResponse(
    Board,
    { query: { ...query, isPublic: true } },
    req.query
  );

  return res.status(200).json(response);
}

async function deleteBoard(req, res) {
  const id = req.swagger.params.id.value;
  Board.findByIdAndRemove(id, function (err, boards) {
    if (err) {
      return res.status(404).json({
        message: 'Board not found. Board Id: ' + id,
        error: err.message
      });
    }
    if (!boards) {
      return res.status(404).json({
        message: 'Board not found. Board Id: ' + id,
        error: 'Board not found.'
      });
    }
    return res.status(200).json(boards);
  });
}

function getBoard(req, res) {
  const id = req.swagger.params.id.value;
  //  Validate id
  if (!ObjectId.isValid(id)) {
    return res.status(404).json({
      message: 'Invalid ID for a Board. Board Id: ' + id
    });
  }
  Board.findOne({ _id: id }, function (err, boards) {
    if (err) {
      return res.status(500).json({
        message: 'Error getting board. ',
        error: err.message
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

async function updateBoard(req, res) {
  const id = req.swagger.params.id.value;

  try {
    const board = await Board.findOne({ _id: id });
    
    if (!board) {
      return res.status(404).json({
        message: 'Unable to find board. board Id: ' + id
      });
    }
    
    for (let key in req.body) {
      board[key] = req.body[key];
    }
    board.lastEdited = moment().format();
    
    try {
      const savedBoard = await board.save();
      if (!savedBoard) {
        return res.status(404).json({
          message: 'Unable to find board. board id: ' + id
        });
      }
      return res.status(200).json(savedBoard.toJSON());
    } catch (err) {
      return res.status(500).json({
        message: 'Error saving board. ',
        error: err.message
      });
    }
    
  } catch (err) {
    return res.status(500).json({
      message: 'Error updating board. ',
      error: err.message
    });
  }
}

function reportPublicBoard(req,res){
  nev.sendReportEmail(req.body,function(err, info) {
    if (err) {
      return res.status(500).json({
        message: 'ERROR: sending report email FAILED ' + info
      });
    }
    return res.status(200).json({message: 'Email sent successfuly'});
  });
}

async function getCbuilderBoard(req, res) {
  const id = req.swagger.params.id.value;
  try {
    const board = await getCbuilderBoardbyId(id);
    if (!board) {
      return res.status(404).json({
        message: 'Cbuilder Board not found. Board Id: ' + id
      });
    }
    if (!req.user.isAdmin && req.auth.email !== board.email) {
      return res.status(401).json({
        message: 'You are not authorized to get this board.'
      });
    }
    const newBoard = new Board(board);
    return res.status(200).json(newBoard.toJSON());
  } catch (err) {
    return res.status(500).json({
      message: 'Error getting Cbuilder Board ',
      error: err.message
    });
  }
}