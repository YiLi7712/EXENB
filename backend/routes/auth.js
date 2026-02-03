const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ActivationCode = require('../models/ActivationCode');
const auth = require('../middleware/auth');

// 注册
router.post('/register', async (req, res) => {
    try {
        const { username, password, displayName, activationCode } = req.body;
        
        // 验证输入
        if (!username || !password || !activationCode) {
            return res.status(400).json({ message: '请填写所有必填字段' });
        }
        
        if (username.length < 3 || username.length > 20) {
            return res.status(400).json({ message: '用户名长度需在3-20个字符之间' });
        }
        
        if (password.length < 6) {
            return res.status(400).json({ message: '密码至少需要6个字符' });
        }
        
        if (displayName && displayName.length > 30) {
            return res.status(400).json({ message: '显示名称不能超过30个字符' });
        }
        
        // 验证激活码
        const code = await ActivationCode.findOne({ code: activationCode, isUsed: false });
        if (!code) {
            return res.status(400).json({ message: '无效的激活码' });
        }
        
        // 检查用户名是否已存在
        const existingUser = await User.findOne({ username: new RegExp(`^${username}$`, 'i') });
        if (existingUser) {
            return res.status(400).json({ message: '用户名已存在' });
        }
        
        // 创建用户
        const user = new User({
            username,
            password,
            displayName: displayName || username,
            avatar: 'default-avatar.png'
        });
        
        await user.save();
        
        // 标记激活码为已使用
        code.isUsed = true;
        await code.save();
        
        // 生成JWT令牌
        const token = jwt.sign(
            { 
                id: user._id, 
                username: user.username, 
                isAdmin: user.isAdmin 
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );
        
        res.status(201).json({ 
            message: '注册成功',
            token,
            user: {
                id: user._id,
                username: user.username,
                displayName: user.displayName,
                avatar: user.avatar,
                isAdmin: user.isAdmin,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 登录
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // 验证输入
        if (!username || !password) {
            return res.status(400).json({ message: '请填写用户名和密码' });
        }
        
        // 查找用户
        const user = await User.findOne({ username: new RegExp(`^${username}$`, 'i') });
        if (!user) {
            return res.status(400).json({ message: '用户不存在' });
        }
        
        // 检查是否被封禁
        if (user.isBanned) {
            return res.status(403).json({ message: '账号已被封禁' });
        }
        
        // 验证密码
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: '密码错误' });
        }
        
        // 生成JWT令牌
        const token = jwt.sign(
            { 
                id: user._id, 
                username: user.username, 
                isAdmin: user.isAdmin 
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '7d' }
        );
        
        // 更新最后登录时间
        user.lastLoginAt = new Date();
        await user.save();
        
        res.json({
            message: '登录成功',
            token,
            user: {
                id: user._id,
                username: user.username,
                displayName: user.displayName,
                avatar: user.avatar,
                isAdmin: user.isAdmin,
                createdAt: user.createdAt,
                lastLoginAt: user.lastLoginAt
            }
        });
    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 验证令牌
router.get('/verify', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        
        if (!user) {
            return res.status(404).json({ message: '用户不存在' });
        }
        
        // 检查是否被封禁
        if (user.isBanned) {
            return res.status(403).json({ message: '账号已被封禁' });
        }
        
        res.json({ 
            user: {
                id: user._id,
                username: user.username,
                displayName: user.displayName,
                avatar: user.avatar,
                isAdmin: user.isAdmin,
                isBanned: user.isBanned,
                createdAt: user.createdAt,
                lastLoginAt: user.lastLoginAt
            }
        });
    } catch (error) {
        console.error('验证令牌错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 更新用户信息
router.put('/update-profile', auth, async (req, res) => {
    try {
        const { displayName, avatar } = req.body;
        const userId = req.user.id;
        
        // 验证输入
        if (displayName !== undefined && displayName.length > 30) {
            return res.status(400).json({ message: '显示名称不能超过30个字符' });
        }
        
        // 允许的头像列表（防止任意文件路径）
        const allowedAvatars = [
            'default-avatar.png',
            'avatar1.png',
            'avatar2.png',
            'avatar3.png',
            'avatar4.png'
        ];
        
        if (avatar !== undefined && !allowedAvatars.includes(avatar)) {
            return res.status(400).json({ message: '无效的头像选择' });
        }
        
        // 构建更新数据
        const updateData = {};
        if (displayName !== undefined) {
            updateData.displayName = displayName.trim();
        }
        if (avatar !== undefined) {
            updateData.avatar = avatar;
        }
        
        // 如果没有更新内容
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ message: '没有提供更新内容' });
        }
        
        // 更新用户信息
        const user = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');
        
        if (!user) {
            return res.status(404).json({ message: '用户不存在' });
        }
        
        res.json({
            message: '个人信息更新成功',
            user: {
                id: user._id,
                username: user.username,
                displayName: user.displayName,
                avatar: user.avatar,
                isAdmin: user.isAdmin,
                createdAt: user.createdAt,
                lastLoginAt: user.lastLoginAt
            }
        });
    } catch (error) {
        console.error('更新个人信息错误:', error);
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: '数据验证失败' });
        }
        
        res.status(500).json({ message: '服务器错误' });
    }
});

// 修改密码
router.put('/change-password', auth, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;
        
        // 验证输入
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: '请提供当前密码和新密码' });
        }
        
        if (newPassword.length < 6) {
            return res.status(400).json({ message: '新密码至少需要6个字符' });
        }
        
        // 获取用户
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: '用户不存在' });
        }
        
        // 验证当前密码
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ message: '当前密码错误' });
        }
        
        // 更新密码
        user.password = newPassword;
        await user.save();
        
        res.json({ message: '密码修改成功' });
    } catch (error) {
        console.error('修改密码错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 获取用户统计信息
router.get('/stats', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const user = await User.findById(userId)
            .select('joinedChannels createdAt lastLoginAt')
            .populate('joinedChannels', 'name channelId');
        
        if (!user) {
            return res.status(404).json({ message: '用户不存在' });
        }
        
        // 计算活跃度（基于最后登录时间）
        const now = new Date();
        const lastLogin = user.lastLoginAt || user.createdAt;
        const daysSinceLastLogin = Math.floor((now - lastLogin) / (1000 * 60 * 60 * 24));
        
        res.json({
            joinedChannelsCount: user.joinedChannels.length,
            joinedChannels: user.joinedChannels,
            accountAge: Math.floor((now - user.createdAt) / (1000 * 60 * 60 * 24)),
            daysSinceLastLogin,
            isActive: daysSinceLastLogin <= 7 // 7天内登录过算活跃
        });
    } catch (error) {
        console.error('获取用户统计错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 搜索用户（仅管理员）
router.get('/search', auth, async (req, res) => {
    try {
        // 检查是否是管理员
        const user = await User.findById(req.user.id);
        if (!user.isAdmin) {
            return res.status(403).json({ message: '需要管理员权限' });
        }
        
        const { username, page = 1, limit = 20 } = req.query;
        
        const query = {};
        if (username) {
            query.username = new RegExp(username, 'i');
        }
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const users = await User.find(query)
            .select('-password')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });
        
        const total = await User.countDocuments(query);
        
        res.json({
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('搜索用户错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 删除账号（需要密码确认）
router.delete('/delete-account', auth, async (req, res) => {
    try {
        const { password } = req.body;
        const userId = req.user.id;
        
        if (!password) {
            return res.status(400).json({ message: '请提供密码确认' });
        }
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: '用户不存在' });
        }
        
        // 验证密码
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: '密码错误' });
        }
        
        // 从所有频道中移除用户
        await Channel.updateMany(
            { members: userId },
            { $pull: { members: userId } }
        );
        
        // 删除用户的频道（如果是创建者）
        await Channel.deleteMany({ creator: userId });
        
        // 删除用户
        await User.findByIdAndDelete(userId);
        
        res.json({ message: '账号已成功删除' });
    } catch (error) {
        console.error('删除账号错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

module.exports = router;