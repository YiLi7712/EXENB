const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const connectDB = require('./db');
require('dotenv').config();

// 导入路由
const authRoutes = require('./routes/auth');
const channelRoutes = require('./routes/channels');
const adminRoutes = require('./routes/admin');

// 初始化Express应用
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000", // 前端地址
    methods: ["GET", "POST"]
  }
});

// 中间件
app.use(cors());
app.use(express.json());

// 连接数据库
connectDB();

// 创建默认管理员账号（如果不存在）
const createDefaultAdmin = async () => {
  const User = require('./models/User');
  const bcrypt = require('bcryptjs');
  
  const adminExists = await User.findOne({ username: 'EXE666' });
  if (!adminExists) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('EXEnb666', salt);
    
    const admin = new User({
      username: 'EXE666',
      password: hashedPassword,
      displayName: '系统管理员',
      isAdmin: true
    });
    
    await admin.save();
    console.log('默认管理员账号已创建');
  }
};

// 创建默认公共频道
const createDefaultChannel = async () => {
  const Channel = require('./models/Channel');
  const User = require('./models/User');
  
  const channelExists = await Channel.findOne({ channelId: '@public' });
  if (!channelExists) {
    // 获取管理员
    const admin = await User.findOne({ username: 'EXE666' });
    
    if (admin) {
      const publicChannel = new Channel({
        name: '公共频道',
        channelId: '@public',
        description: '大家都可以在这里聊天',
        creator: admin._id,
        members: [admin._id],
        isPublic: true
      });
      
      await publicChannel.save();
      
      // 将频道添加到管理员的加入频道列表
      admin.joinedChannels.push(publicChannel._id);
      await admin.save();
      
      console.log('默认公共频道已创建');
    }
  }
};

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/admin', adminRoutes);

// Socket.IO 连接处理
io.on('connection', (socket) => {
  console.log('新用户连接:', socket.id);
  
  // 加入频道
  socket.on('join-channel', (channelId) => {
    socket.join(channelId);
    console.log(`用户 ${socket.id} 加入频道 ${channelId}`);
  });
  
  // 离开频道
  socket.on('leave-channel', (channelId) => {
    socket.leave(channelId);
    console.log(`用户 ${socket.id} 离开频道 ${channelId}`);
  });
  
  // 发送消息
  socket.on('send-message', async (data) => {
    try {
      const { channelId, userId, username, displayName, avatar, content } = data;
      
      // 广播消息给频道内的所有用户
      io.to(channelId).emit('receive-message', {
        userId,
        username,
        displayName,
        avatar,
        content,
        timestamp: new Date()
      });
      
      // 保存消息到数据库
      const Channel = require('./models/Channel');
      await Channel.findOneAndUpdate(
        { channelId },
        {
          $push: {
            messages: {
              user: userId,
              username,
              content,
              timestamp: new Date()
            }
          }
        }
      );
    } catch (error) {
      console.error('发送消息错误:', error);
    }
  });
  
  // 断开连接
  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id);
  });
});

// 初始化函数
const initialize = async () => {
  await createDefaultAdmin();
  await createDefaultChannel();
};

// 启动服务器
const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  await initialize();
  console.log(`服务器运行在端口 ${PORT}`);
});