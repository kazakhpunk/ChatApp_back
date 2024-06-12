import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose, { Schema, Document } from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

if (!process.env.MONGO_URI) {
  throw new Error("MONGO_URI is not defined in the environment variables");
}

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Failed to connect to MongoDB', err));

interface IUser extends Document {
  username: string;
  password: string;
  online: boolean;
}

interface IMessage extends Document {
  sender: string;
  receiver: string;
  message: string;
  timestamp: string;
}

const userSchema: Schema = new Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  online: { type: Boolean, default: false },
});

const messageSchema: Schema = new Schema({
  sender: { type: String, required: true },
  receiver: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: String, required: true },
});

const User = mongoose.model<IUser>('User', userSchema);
const Message = mongoose.model<IMessage>('Message', messageSchema);

app.use(cors()); // Enable CORS
app.use(express.json());

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password });
  if (user) {
    res.sendStatus(200);
  } else {
    res.sendStatus(401);
  }
});

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const newUser = new User({ username, password, online: false });
    await newUser.save();
    res.sendStatus(201);
  } catch (error) {
    res.status(400).send(error);
  }
});

app.get('/users', async (req, res) => {
  const users = await User.find();
  res.json(users);
});

app.get('/messages', async (req, res) => {
  const messages = await Message.find();
  res.json(messages);
});

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('join', async (username) => {
    socket.data.username = username;
    await User.findOneAndUpdate({ username }, { online: true });
    io.emit('userOnline', username);
  });

  socket.on('message', async (msg) => {
    const message = new Message(msg);
    await message.save();
    io.emit('message', msg);
  });

  socket.on('typing', (data) => {
    socket.broadcast.emit('typing', data);
  });

  socket.on('disconnect', async () => {
    const username = socket.data.username;
    if (username) {
      await User.findOneAndUpdate({ username }, { online: false });
      io.emit('userOffline', username);
    }
  });
});

server.listen(8000, () => {
  console.log('listening on *:8000');
});
