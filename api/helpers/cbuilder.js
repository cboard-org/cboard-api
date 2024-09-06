const axios = require('axios');
const config = require('../../config');
const { INTERNAL_API_KEY, CBUILDER_API_URL } = config;

async function getCbuilderBoardbyId(id) {
  const res = await axios.get(CBUILDER_API_URL + '/api/board/' + id, {
    headers: {
      Authorization: `Bearer ${INTERNAL_API_KEY}`
    }
  });
  //filter out Cbuilder generated tiles
  const tiles = cbuilderToCboardTilesAdapter(res.data?.tiles) || [];
  const board = { ...res.data, tiles: tiles };

  return board;
}

function cbuilderToCboardTilesAdapter(tiles) {
  return tiles.map(({suggestedImages, generatedPicto, ...tile}) => tile);
}

module.exports = {
  getCbuilderBoardbyId: getCbuilderBoardbyId
};
