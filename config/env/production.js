module.exports = {
  env: 'development',
  databaseUrl: process.env.MONGO_URL || 'mongodb://martinbedouret:Muni1909@ds253587.mlab.com:53587/cboard',
  jwt: { secret: process.env.JWT_SECRET || 'secret key for testing' }
};