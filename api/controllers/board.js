const { paginatedResponse } = require('../helpers/response');
const Board = require('../models/Board');

module.exports = {
  createBoard: createBoard,
  listBoard: listBoard,
  removeBoard: removeBoard,
  getBoard: getBoard,
  updateBoard: updateBoard,
  getBoardsEmail: getBoardsEmail
};

function createBoard(req, res) {
  const board = new Board(req.body);
  board.save(function(err, board) {
    if (err) {
      return res.status(409).json({
        message: 'Error saving board',
        error: err
      });
    }
    return res.status(200).json({
      success: 1,
      boardid: board._id,
      content: board.content,
      message: 'Board saved successfully'
    });
  });
}

async function listBoard(req, res) {
  const { page, limit, offset, sort } = req.query;
  const paginationConfig = {
    page: !isNaN(page) ? parseInt(page, 10) : 1,
    limit: !isNaN(limit) ? parseInt(limit, 10) : 10,
    offset: !isNaN(offset) ? parseInt(offset, 10) : 0,
    sort: sort && sort.length ? sort : '-_id'
  };

  const response = await paginatedResponse(Board, {}, paginationConfig);
  return res.status(200).json(response);
}

async function getBoardsEmail(req, res) {
  const email = req.swagger.params.email.value;

  const { page, limit, offset, sort } = req.query;
  const paginationConfig = {
    page: !isNaN(page) ? parseInt(page, 10) : 1,
    limit: !isNaN(limit) ? parseInt(limit, 10) : 10,
    offset: !isNaN(offset) ? parseInt(offset, 10) : 0,
    sort: sort && sort.length ? sort : '-_id'
  };

  const response = await paginatedResponse(
    Board,
    { query: { email } },
    paginationConfig
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
    return res.status(200).json(boards);
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
    return res.status(200).json(board);
  });
}
