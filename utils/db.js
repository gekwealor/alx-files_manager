const { MongoClient } = require('mongodb');

class DBClient {
  constructor() {
    // Use ternary if statement to determine the variables
    const host = (process.env.DB_HOST) ? process.env.DB_HOST : 'localhost';
    const port = (process.env.DB_PORT) ? process.env.DB_HOST : 27017;
    this.db = (process.env.DB_DATABASE) ? process.env.DB_DATABASE : 'files_manager';
    const url = `mongodb://${host}:${port}`;
    this.client = new MongoClient(url, { useUnifiedTopology: true });
    this.client.connect();
    console.log('Connected to database successfully!');
  }

  isAlive() {
    return this.client && this.client.topology.isConnected();
  }

  async nbUsers() {
    const db = this.client.db(this.db);
    const collectionUsers = db.collection('users');
    const numUsers = await collectionUsers.countDocuments({});
    return numUsers;
  }

  async nbFiles() {
    const db = this.client.db(this.db);
    const collectionUsers = db.collection('files');
    const numUsers = await collectionUsers.countDocuments({});
    return numUsers;
  }
}

const dbClient = new DBClient();
module.exports = dbClient;
