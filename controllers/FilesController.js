import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const { promisify } = require('util');
const mkdir = promisify(require('fs').mkdir);

const fs = require('fs').promises;

const Usercollection = dbClient.client.db('files_manager').collection('users');
const Filecollection = dbClient.client.db('files_manager').collection('files');
class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['x-token'];
    const key = `auth_${token}`;
    const value = await redisClient.get(key);

    const _id = ObjectId(value);
    const user = await Usercollection.findOne({ _id });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const {
      name, type, data, parentId, isPublic,
    } = req.body;

    const userId = user._id;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    if (!data && type !== 'folder') {
      return res.status(400).json({ error: 'Missing data' });
    }
    if (parentId) {
      const _id = new ObjectId(parentId);
      const file = await Filecollection.findOne({ _id });

      if (!file) {
        return res.status(400).json({ error: 'Parent not found' });
      }

      if (file.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    if (type === 'folder') {
      const newFile = {
        userId,
        name,
        type,
        parentId: parentId || 0,
        isPublic: isPublic || false,
      };
      const results = await Filecollection.insertOne(newFile);
      const folder = { ...results.ops[0] };
      delete folder.localpath;
      const folderId = folder._id;
      delete folder._id;
      return res.status(201).send({ ...folder, id: folderId });
    }

    const directoryPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    const filename = uuidv4();
    const fileData = Buffer.from(data, 'base64');
    const localpath = `${directoryPath}/${filename}`;

    async function ensuredirexists(dirPath) {
      try {
        await mkdir(dirPath, { recursive: true });
      } catch (err) {
        console.log(`Error creating the directory: ${err.message}`);
      }
    }
    await ensuredirexists(directoryPath);
    try {
      await fs.writeFile(localpath, fileData);
    } catch (err) {
      console.log(`Got an error trying to write to a file: ${err.message}`);
    }

    const newFile = {
      userId,
      name,
      type,
      parentId: parentId || 0,
      isPublic: isPublic || false,
      localpath,
    };
    const result = await Filecollection.insertOne(newFile);
    const folder = { ...result.ops[0] };
    delete folder.localpath;
    const folderId = folder._id;
    delete folder._id;
    return res.status(201).send({ ...folder, id: folderId });
  }

  static async getShow(req, res) {
    const fileId = req.params.id;
    const token = req.headers['x-token'];
    let fetchedFile;

    if (!fileId || !token) return res.status(401).json({ error: 'Unauthorized' });

    const key = `auth_${token}`;

    const userId = await redisClient.get(key);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await Usercollection.findOne({ _id: ObjectId(userId) });

    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const file = await Filecollection.findOne({ _id: ObjectId(fileId), userId: user._id });

    if (file) {
      fetchedFile = {
        id: file._id,
        userId: file.userId,
        name: file.name,
        type: file.type,
        isPublic: file.isPublic,
        parentId: file.parentId,
      };
    } else {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(200).json(fetchedFile);
  }

  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    const parentId = parseInt(req.query.parentId, 10) || 0;
    const page = req.query.page || 0;
    const filePerPage = 20;
    const arr = [];

    console.log(token);

    // if (!parentId || !page) return res.status(401).json({ error: 'Unauthorized' });

    const key = `auth_${token}`;
    console.log(key);
    const id = await redisClient.get(key);

    console.log(id);

    if (!id) return res.status(401).json({ error: 'Unauthorized' });
    const user = await Usercollection.findOne({ _id: ObjectId(id) });

    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // const checkfile = await Filecollection.findOne({ userId: id, parentId });

    // if (!checkfile) return [];

    const pipeline = [
      { $match: { parentId, userId: user._id } },
      { $skip: page * filePerPage },
      { $limit: filePerPage },
    ];
    const files = await Filecollection.aggregate(pipeline);
    await files.forEach((result) => {
      const file = {
        id: result._id,
        userId: result.userId,
        name: result.name,
        type: result.type,
        parentId: result.parentId,
        isPublic: result.isPublic,
      };
      arr.push(file);
    });
    return res.status(200).json(arr);
  }

  static async putPublish(req, res) {
    const { id } = req.params;
    // console.log(fileId);
    const token = req.headers['x-token'];
    console.log(token);

    if (!id || !token) return res.status(401).json({ error: 'Unauthorized' });

    const key = `auth_${token}`;
    const _id = await redisClient.get(key);
    let newFile = {};

    console.log(_id);

    const user = await Usercollection.findOne({ _id: ObjectId(_id) });

    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const filter = { _id: ObjectId(id), userId: user._id };
    const update = { $set: { isPublic: true } };

    const oldFile = await Filecollection.findOne(filter);

    if (!oldFile) return res.status(404).json({ error: 'Not found' });

    console.log(oldFile);

    if (oldFile.isPublic === false) {
      const updatedDocument = await Filecollection.updateOne(filter, update);

      if (updatedDocument.modifiedCount === 1) {
        const modifiedDocument = await Filecollection.findOne(filter);

        newFile.id = modifiedDocument._id;
        newFile.userId = modifiedDocument.userId;
        newFile.name = modifiedDocument.name;
        newFile.type = modifiedDocument.type;
        newFile.isPublic = modifiedDocument.isPublic;
        newFile.parentId = modifiedDocument.parentId;
      }
    } else {
      newFile = oldFile;
      newFile.id = oldFile._id;
      delete newFile._id;
      delete newFile.localpath;
    }
    return res.status(200).json(newFile);
  }

  static async putUnpublish(req, res) {
    const { id } = req.params;
    // console.log(fileId);
    const token = req.headers['x-token'];
    console.log(token);

    if (!id || !token) return res.status(401).json({ error: 'Unauthorized' });

    const key = `auth_${token}`;
    const _id = await redisClient.get(key);
    let newFile = {};

    console.log(_id);

    const user = await Usercollection.findOne({ _id: ObjectId(_id) });

    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const filter = { _id: ObjectId(id), userId: user._id };
    const update = { $set: { isPublic: false } };

    const oldFile = await Filecollection.findOne(filter);

    if (!oldFile) return res.status(404).json({ error: 'Not found' });

    console.log(oldFile);

    if (oldFile.isPublic === true) {
      const updatedDocument = await Filecollection.updateOne(filter, update);

      if (updatedDocument.modifiedCount === 1) {
        const modifiedDocument = await Filecollection.findOne(filter);

        newFile.id = modifiedDocument._id;
        newFile.userId = modifiedDocument.userId;
        newFile.name = modifiedDocument.name;
        newFile.type = modifiedDocument.type;
        newFile.isPublic = modifiedDocument.isPublic;
        newFile.parentId = modifiedDocument.parentId;
      }
    } else {
      newFile = oldFile;
      newFile.id = oldFile._id;
      delete newFile._id;
      delete newFile.localpath;
    }
    return res.status(200).json(newFile);
  }
}

module.exports = FilesController;
