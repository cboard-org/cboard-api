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
      content: board.content,
      message: 'Board saved successfully'
    });
  });
}
function listBoard(req, res) {}
function removeBoard(req, res) {}
function getBoard(req, res) {}
function updateBoard(req, res) {}
