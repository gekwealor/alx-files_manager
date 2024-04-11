import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const sha1 = require('sha1');

const Usercollection = dbClient.client.db('files_manager').collection('users');

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }
    const user = await Usercollection.findOne({ email });
    if (user) {
      return res.status(400).json({ error: 'Already exist' });
    }
    const hashedPw = sha1(password);
    const newUser = {
      email,
      password: hashedPw,
    };
    const record = await Usercollection.insertOne(newUser);
    const id = record.insertedId;

    return res.status(201).json({ email, id });
  }

  static async getMe(req, res) {
    const token = req.headers['x-token'];
    const key = `auth_${token}`;
    const id = await redisClient.get(key);
    const _id = new ObjectId(id);
    const user = await Usercollection.findOne({ _id });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.status(200).json({ id: user._id, email: user.email });
  }
}

module.exports = UsersController;
