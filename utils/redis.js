import { promisify } from 'util';

const redis = require('redis');

class RedisClient {
  constructor() {
    this.client = redis.createClient({
      host: 'localhost',
      port: 6379,
    });
    this.connected = true;
    this.client.on('error', (err) => {
      console.log(err);
      this.connected = false;
    });
  }

  isAlive() {
    return this.connected;
  }

  async get(key) {
    return promisify(this.client.GET).bind(this.client)(key);
  }

  async set(key, value, duration) {
    promisify(this.client.set).bind(this.client)(key, value, 'EX', duration);
  }

  async del(key) {
    promisify(this.client.del).bind(this.client)(key);
  }
}

const redisClient = new RedisClient();
module.exports = redisClient;
