'use strict';

const mongoose = require('mongoose');
const fs = require('fs').promises;
const path = require('path');
const moment = require('moment');
const { createBlockBlobFromText } = require('../api/helpers/blob');
const Board = require('../api/models/Board');
require('../db'); // Initialize MongoDB connection

// Logging setup
const LOG_FILE = path.join(__dirname, `migration_${new Date().toISOString().replace(/:/g, '-')}.log`);
let logContent = '';

function appendLog(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  logContent += logMessage;
  console.log(message);
}

// Summary tracking
const summary = {
  boardsProcessed: 0,
  totalTiles: 0,
  successfulUploads: 0,
  failedUploads: 0,
  storageSpaceSaved: 0, // in bytes
  failures: []
};

// Configuration
const BLOB_CONTAINER_NAME = process.env.BLOB_CONTAINER_NAME || 'cblob';
const TARGET_EMAIL = 'jrbrozas@enfuego.edu.ph';

async function migrateBase64Images() {
  try {
    appendLog(`Starting migration for email: ${TARGET_EMAIL}`);
    appendLog('Running aggregation pipeline...');

    const boards = await Board.aggregate([
      // Stage 1: Filter by email
      {
        $match: {
          email: TARGET_EMAIL
        }
      },
    
      // Stage 2: Add base64 tiles field
      {
        $addFields: {
          tilesWithBase64: {
            $filter: {
              input: "$tiles",
              cond: {
                $regexMatch: {
                  input: "$$this.image",
                  regex: "^data:image/.*base64,.*"
                }
              }
            }
          }
        }
      },
    
      // Stage 3: Filter only boards that have at least one base64 image
      {
        $match: {
          $expr: {
            $gt: [{ $size: "$tilesWithBase64" }, 0]
          }
        }
      },
    
      // Stage 4: Project the results
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          author: 1,
          description: 1,
          lastEdited: 1,
          tilesWithBase64: {
            $map: {
              input: "$tilesWithBase64",
              as: "tile",
              in: {
                id: "$$tile.id",
                label: "$$tile.label",
                image: "$$tile.image",
                keyPath: "$$tile.keyPath"
              }
            }
          },
          base64TileCount: {
            $size: "$tilesWithBase64"
          }
        }
      }
    ]);

    appendLog(`Found ${boards.length} boards with base64 images`);

    // Process each board
    for (const board of boards) {
      summary.boardsProcessed++;
      summary.totalTiles += board.base64TileCount;
      appendLog(`\nProcessing board: ${board.name} (ID: ${board._id}) (${board.base64TileCount} base64 tiles)`);

      for (const tile of board.tilesWithBase64) {
        try {
          appendLog(`Processing tile: ${tile.id}`);

          // Extract base64 data and mimetype
          const [base64Type, base64Data] = tile.image.split(',');
          const buffer = Buffer.from(base64Data, 'base64');
          const mimetype = base64Type.split(':')[1].split(';')[0];
          const extension = mimetype.split('/')[1];
          
          // Calculate storage space to be saved
          const base64Size = tile.image.length;
          
          // Prepare file for upload
          const file = {
            buffer,
            mimetype,
            originalname: `${tile.id}.${extension}`
          };

          // Upload to Azure
          appendLog(`Uploading to Azure: ${file.originalname}`);
          const [blobResult, fileUrl] = await createBlockBlobFromText(
            BLOB_CONTAINER_NAME,
            file.originalname,
            file
          );

          // Update MongoDB
          appendLog(`Updating MongoDB with Azure URL for tile: ${tile.id}`);
          await Board.updateOne(
            { '_id': board._id, 'tiles.id': tile.id },
            { 
              $set: { 
                'tiles.$.image': fileUrl,
                lastEdited: moment().format()
              } 
            }
          );

          // Update summary
          summary.successfulUploads++;
          summary.storageSpaceSaved += base64Size - fileUrl.length;

          appendLog(`Successfully processed tile: ${tile.id}`);
        } catch (error) {
          appendLog(`Error processing tile ${tile.id}: ${error.message}`);
          summary.failedUploads++;
          summary.failures.push({
            boardId: board._id,
            boardName: board.name,
            tileId: tile.id,
            error: error.message
          });
          // Continue with next tile
        }
      }
    }

    // Print and log summary
    const summaryText = [
      '\n=== Migration Summary ===',
      `Target email: ${TARGET_EMAIL}`,
      `Boards Processed: ${summary.boardsProcessed}`,
      `Total Tiles: ${summary.totalTiles}`,
      `Successful Uploads: ${summary.successfulUploads}`,
      `Failed Uploads: ${summary.failedUploads}`,
      `Storage Space Saved: ${(summary.storageSpaceSaved / 1024 / 1024).toFixed(2)} MB`,
    ];

    if (summary.failures.length > 0) {
      summaryText.push('\nFailed Operations:');
      summary.failures.forEach(f => 
        summaryText.push(`- Board "${f.boardName}" (ID: ${f.boardId}), Tile ${f.tileId}: ${f.error}`)
      );
    }

    summaryText.push('\nMigration completed successfully');
    summaryText.forEach(line => appendLog(line));

    // Write log file
    await fs.writeFile(LOG_FILE, logContent, 'utf8');
    console.log(`\nLog file written to: ${LOG_FILE}`);
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    // Close MongoDB connection
    appendLog('Closing MongoDB connection...');
    await mongoose.connection.close();
    appendLog('Done!');
  }
}

// Export for testing
module.exports = {
  migrateBase64Images
};

// Run the migration if this script is run directly (not required as a module)
if (require.main === module) {
  migrateBase64Images()
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
