const axios = require('axios');
const config = require('../../config');
const { INTERNAL_API_KEY, CBUILDER_API_URL } = config;

async function getCbuilderBoardbyId(id) {
  const res = await axios.get(CBUILDER_API_URL + '/api/board/' + id, {
    headers: {
      'Authorization': `Bearer ${INTERNAL_API_KEY}`
    }
  });
  return res.data;
}

module.exports = {
  getCbuilderBoardbyId: getCbuilderBoardbyId
};
