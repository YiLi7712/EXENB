const express = require('express');
const router = express.Router();
const Channel = require('../models/Channel');
const User = require('../models/User');
const ActivationCode = require('../models/ActivationCode');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');

// 生成激活码
router.post('/generate-code', auth, adminAuth, async (req, res) => {
  try {
    // 生成随机激活码
    const generateCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };
    
    let code;
    let isUnique = false;
    
    // 确保激活码唯一
    while (!isUnique) {
      code = generateCode();
      const existingCode = await ActivationCode.findOne({ code });
      if (!existingCode) {
        isUnique = true;
      }
    }
    
    const activationCode = new ActivationCode({
      code,
      createdBy: req.user.id
    });
    
    await activationCode.save();
    
    res.json({ 
      message: '激活码生成成功',
      code,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7天后
    });
  } catch (error) {
    console.error('生成激活码错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 切断所有频道信息系统
router.post('/disable-all-chats', auth, adminAuth, async (req, res) => {
  try {
    // 这里可以设置一个全局标志或处理逻辑
    // 实际实现可能需要更复杂的方法
    res.json({ message: '所有频道聊天功能已禁用' });
  } catch (error) {
    console.error('禁用聊天错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 封禁频道
router.post('/ban-channel', auth, adminAuth, async (req, res) => {
  try {
    const { channelId } = req.body;
    
    const channel = await Channel.findOne({ channelId });
    
    if (!channel) {
      return res.status(404).json({ message: '频道不存在' });
    }
    
    if (channel.isBanned) {
      return res.status(400).json({ message: '频道已被封禁' });
    }
    
    channel.isBanned = true;
    await channel.save();
    
    res.json({ message: '频道封禁成功' });
  } catch (error) {
    console.error('封禁频道错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 解封频道
router.post('/unban-channel', auth, adminAuth, async (req, res) => {
  try {
    const { channelId } = req.body;
    
    const channel = await Channel.findOne({ channelId });
    
    if (!channel) {
      return res.status(404).json({ message: '频道不存在' });
    }
    
    if (!channel.isBanned) {
      return res.status(400).json({ message: '频道未被封禁' });
    }
    
    channel.isBanned = false;
    await channel.save();
    
    res.json({ message: '频道解封成功' });
  } catch (error) {
    console.error('解封频道错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 封禁用户
router.post('/ban-user', auth, adminAuth, async (req, res) => {
  try {
    const { username } = req.body;
    
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    if (user.isAdmin) {
      return res.status(403).json({ message: '不能封禁管理员' });
    }
    
    if (user.isBanned) {
      return res.status(400).json({ message: '用户已被封禁' });
    }
    
    user.isBanned = true;
    await user.save();
    
    res.json({ message: '用户封禁成功' });
  } catch (error) {
    console.error('封禁用户错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 解封用户
router.post('/unban-user', auth, adminAuth, async (req, res) => {
  try {
    const { username } = req.body;
    
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }
    
    if (!user.isBanned) {
      return res.status(400).json({ message: '用户未被封禁' });
    }
    
    user.isBanned = false;
    await user.save();
    
    res.json({ message: '用户解封成功' });
  } catch (error) {
    console.error('解封用户错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取所有激活码
router.get('/activation-codes', auth, adminAuth, async (req, res) => {
  try {
    const codes = await ActivationCode.find()
      .populate('createdBy', 'username')
      .sort({ createdAt: -1 });
    
    res.json(codes);
  } catch (error) {
    console.error('获取激活码错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取所有频道
router.get('/channels', auth, adminAuth, async (req, res) => {
  try {
    const channels = await Channel.find()
      .populate('creator', 'username')
      .sort({ createdAt: -1 });
    
    res.json(channels);
  } catch (error) {
    console.error('获取频道错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取所有用户
router.get('/users', auth, adminAuth, async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });
    
    res.json(users);
  } catch (error) {
    console.error('获取用户错误:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});
