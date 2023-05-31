const User = require('../models/User');
const Settings = require('../models/Settings');
const Communicator = require('../models/Communicator');
const Board = require('../models/Board');
const Subscribers = require('../models/Subscribers');

const { getAuthDataFromReq } = require('../helpers/auth');

module.exports = {
  removeAccount
};

async function removeAccount(req, res) {
  const id = req.swagger.params.id.value;

  //this would be implemented like a middleware
  const { requestedBy, isAdmin: isRequestedByAdmin } = getAuthDataFromReq(req);

  if (!isRequestedByAdmin && (!requestedBy || id != requestedBy)) {
    return res.status(401).json({
      message: 'Error getting subscriber',
      error:
        'unhautorized request, subscriber object is only accesible with subscribered user authToken'
    });
  }

  const response = {};
  try {
    const user = await User.findByIdAndRemove(id);
    response.user = user;
  } catch (error) {
    console.error(error);
    return res.status(404).json({
      message: 'User not found. User Id: ' + id
    });
  }

  try {
    const setting = await Settings.findOneAndDelete({ user: id });
    response.setting = setting;
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: 'Error deleting user setting'
    });
  }

  try {
    const deletedComunicators = await Communicator.deleteMany({
      email: response.user.email
    });
    response.deletedComunicators = deletedComunicators.deletedCount;
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: 'Error deleting user communicator'
    });
  }

  try {
    const deletedBoards = await Board.deleteMany({
      email: response.user.email
    });
    response.deletedBoards = deletedBoards.deletedCount;
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: 'Error deleting user communicator'
    });
  }

  try {
    const subscriber = await Subscribers.findOneAndRemove({ userId: id });
    response.subscriber = subscriber;
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: 'Error deleting user subscriber'
    });
  }

  return res.status(200).json(response);
}
