var ObjectId = require('mongoose').Types.ObjectId;
const moment = require('moment');

const { paginatedResponse } = require('../helpers/response');
const { getORQuery } = require('../helpers/query');
const Board = require('../models/Board');
const { getCbuilderBoardbyId } = require('../helpers/cbuilder');
const { processBase64Images, hasBase64Images } = require('../helpers/imageProcessor');

const {nev} = require('../mail');

const BLOB_CONTAINER_NAME = process.env.BLOB_CONTAINER_NAME || 'cblob';

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
  let imageProcessingErrors = null;

  try {
    const board = await Board.findOne({ _id: id });
    
    if (!board) {
      return res.status(404).json({
        message: 'Unable to find board. board Id: ' + id
      });
    }
    
    const updateData = { ...req.body };
    
    // Check if this is an offline sync with base64 images
    if (updateData.tiles && hasBase64Images(updateData.tiles)) {
      console.log(`Detected offline sync for board ${id}. Processing ${updateData.tiles.length} tiles for base64 images.`);
      
      try {
        const imageProcessResult = await processBase64Images(updateData.tiles, BLOB_CONTAINER_NAME);
        updateData.tiles = imageProcessResult.tiles;
        
        // Log processing results
        if (imageProcessResult.processing.hasErrors) {
          console.warn('Offline sync image processing completed with errors:', {
            boardId: id,
            totalTiles: imageProcessResult.processing.totalTiles,
            successCount: imageProcessResult.processing.successCount,
            failureCount: imageProcessResult.processing.failureCount,
            processingMethod: imageProcessResult.processing.processingMethod
          });
        } else {
          console.log('Offline sync image processing completed successfully:', {
            boardId: id,
            totalTiles: imageProcessResult.processing.totalTiles,
            successCount: imageProcessResult.processing.successCount,
            processingMethod: imageProcessResult.processing.processingMethod
          });
        }
        
        // Store processing info if there were errors
        if (imageProcessResult.processing.hasErrors) {
          imageProcessingErrors = {
            hasErrors: true,
            successCount: imageProcessResult.processing.successCount,
            failureCount: imageProcessResult.processing.failureCount
          };
        }
        
      } catch (imageError) {
        console.error('Offline sync image processing failed:', {
          boardId: id,
          error: imageError.message,
          tilesCount: updateData.tiles.length
        });
        
        imageProcessingErrors = {
          hasErrors: true,
          errorMessage: 'Image processing failed - tiles kept as base64'
        };
      }
    }
    
    // Update board fields
    for (let key in updateData) {
      board[key] = updateData[key];
    }
    board.lastEdited = moment().format();
    
    try {
      const savedBoard = await board.save();
      if (!savedBoard) {
        return res.status(404).json({
          message: 'Unable to find board. board id: ' + id
        });
      }
      
      const response = savedBoard.toJSON();
      
      if (imageProcessingErrors) {
        response.imageProcessing = {
          hasErrors: true,
          message: imageProcessingErrors.failureCount > 0 
            ? 'Some images failed to upload and were kept as base64'
            : imageProcessingErrors.errorMessage
        };
      }
      
      return res.status(200).json(response);
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