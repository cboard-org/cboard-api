module.exports = {
  env: 'development',
  databaseUrl: process.env.MONGO_URL || 'mongodb://localhost/cboard-api',
  jwt: { secret: process.env.JWT_SECRET || 'secret key for testing' }
};