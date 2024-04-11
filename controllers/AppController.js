import redis from '../utils/redis';
import dbClient from '../utils/db';

class AppController {
  static getstatus(req, res) {
    const status = {
      redis: redis.isAlive(),
      db: dbClient.isAlive(),
    };
    res.status(200).send(status);
  }

  static async getstats(req, res) {
    const numFiles = await dbClient.nbFiles();
    const numUsers = await dbClient.nbUsers();

    const stats = {
      users: numUsers,
      files: numFiles,
    };
    res.status(200).send(stats);
  }
}
module.exports = AppController;
