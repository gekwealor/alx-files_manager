import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const sha1 = require('sha1');

class AuthController {
  static async getConnect(req, res) {
    const { authorization } = req.headers;
    const authData = authorization.slice(6);
    console.log(authData);
    const authConverted = Buffer.from(authData, 'base64').toString('utf-8');
    const [email, password] = authConverted.split(':');

    if (!email || !password) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const hashedPw = sha1(password);
    const Usercollection = dbClient.client.db('files_manager').collection('users');
    const user = await Usercollection.findOne({ email, password: hashedPw });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const token = uuidv4();
    const key = `auth_${token}`;
    await redisClient.set(key, user._id.toString(), 862400);
    return res.status(200).json({ token });
  }

  static async getDisconnect(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      res.status(401).json({ error: 'unauthorized' });
    }
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      res.status(401).json({ error: 'unauthorized' });
    } else {
      await redisClient.del(key);
      res.status(204).json({});
    }
  }
}

module.exports = AuthController;
