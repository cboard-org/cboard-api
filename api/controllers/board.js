var Board = require('../models/Board');

module.exports = {
  createBoard: createBoard,
  listBoard: listBoard,
  removeBoard: removeBoard,
  getBoard: getBoard,
  updateBoard: updateBoard
};

function createBoard(req, res) {
  var board = new Board(req.body);
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
function listBoard(req, res) {
  Board.find(function(err, boards) {
    if (err) {
      return res.status(500).json({
        message: 'Error getting boards list.',
        error: err
      });
    }
    return res.status(200).json(boards);
  });
}
function removeBoard(req, res) {
  var id = req.swagger.params.id.value;
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
  var id = req.swagger.params.id.value;
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
  var id = req.swagger.params.id.value;
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
    for (var key in req.body) {
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
