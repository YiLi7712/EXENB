const express = require('express');
const router = express.Router();
const Channel = require('../models/Channel');
const User = require('../models/User');
const auth = require('../middleware/auth');

// 获取所有公共频道（分页）
router.get('/public', async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '' } = req.query;
        
        const query = {
            isPublic: true,
            isBanned: false
        };
        
        if (search) {
            query.$or = [
                { name: new RegExp(search, 'i') },
                { channelId: new RegExp(search, 'i') },
                { description: new RegExp(search, 'i') }
            ];
        }
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const channels = await Channel.find(query)
            .select('name channelId description creator members messagesCount isActive createdAt')
            .populate('creator', 'username displayName avatar')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });
        
        const total = await Channel.countDocuments(query);
        
        // 添加成员数量和消息数量
        const channelsWithStats = channels.map(channel => ({
            id: channel._id,
            name: channel.name,
            channelId: channel.channelId,
            description: channel.description,
            creator: channel.creator,
            memberCount: channel.members.length,
            messagesCount: channel.messages.length,
            isActive: channel.isActive,
            createdAt: channel.createdAt
        }));
        
        res.json({
            channels: channelsWithStats,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('获取公共频道错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 搜索频道
router.get('/search/:channelId', async (req, res) => {
    try {
        const { channelId } = req.params;
        
        if (!channelId.match(/^@[a-zA-Z0-9_]{5,20}$/)) {
            return res.status(400).json({ message: '频道ID格式错误' });
        }
        
        const channel = await Channel.findOne({ 
            channelId: new RegExp(`^${channelId}$`, 'i'),
            isBanned: false 
        })
        .select('name channelId description creator members messagesCount isActive')
        .populate('creator', 'username displayName avatar');
        
        if (!channel) {
            return res.status(404).json({ message: '频道不存在或已被封禁' });
        }
        
        res.json({
            id: channel._id,
            name: channel.name,
            channelId: channel.channelId,
            description: channel.description,
            creator: channel.creator,
            memberCount: channel.members.length,
            messagesCount: channel.messages.length,
            isActive: channel.isActive,
            createdAt: channel.createdAt
        });
    } catch (error) {
        console.error('搜索频道错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 创建频道
router.post('/create', auth, async (req, res) => {
    try {
        const { name, channelId, description } = req.body;
        const userId = req.user.id;
        
        // 验证输入
        if (!name || !channelId) {
            return res.status(400).json({ message: '请填写频道名称和ID' });
        }
        
        if (name.length > 50) {
            return res.status(400).json({ message: '频道名称不能超过50个字符' });
        }
        
        // 验证频道ID格式
        if (!channelId.match(/^@[a-zA-Z0-9_]{5,20}$/)) {
            return res.status(400).json({ 
                message: '频道ID格式错误，必须为@开头，包含5-20个字母、数字或下划线' 
            });
        }
        
        if (description && description.length > 200) {
            return res.status(400).json({ message: '频道描述不能超过200个字符' });
        }
        
        // 检查频道ID是否已存在
        const existingChannel = await Channel.findOne({ 
            channelId: new RegExp(`^${channelId}$`, 'i') 
        });
        if (existingChannel) {
            return res.status(400).json({ message: '频道ID已存在' });
        }
        
        // 检查用户是否已创建过多频道（限制防止滥用）
        const userChannelCount = await Channel.countDocuments({ creator: userId });
        if (userChannelCount >= 10) { // 限制每个用户最多创建10个频道
            return res.status(400).json({ message: '您创建的频道数量已达上限' });
        }
        
        // 创建频道
        const channel = new Channel({
            name,
            channelId,
            description: description || '',
            creator: userId,
            members: [userId],
            messages: []
        });
        
        await channel.save();
        
        // 将频道添加到用户的加入频道列表
        await User.findByIdAndUpdate(userId, {
            $addToSet: { joinedChannels: channel._id }
        });
        
        // 获取完整的频道信息
        const channelWithCreator = await Channel.findById(channel._id)
            .populate('creator', 'username displayName avatar');
        
        res.status(201).json({
            message: '频道创建成功',
            channel: {
                id: channel._id,
                name: channel.name,
                channelId: channel.channelId,
                description: channel.description,
                creator: channelWithCreator.creator,
                memberCount: 1,
                messagesCount: 0,
                isActive: channel.isActive,
                isBanned: channel.isBanned,
                createdAt: channel.createdAt
            }
        });
    } catch (error) {
        console.error('创建频道错误:', error);
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: '数据验证失败' });
        }
        
        res.status(500).json({ message: '服务器错误' });
    }
});

// 加入频道
router.post('/join/:channelId', auth, async (req, res) => {
    try {
        const { channelId } = req.params;
        const userId = req.user.id;
        
        // 验证频道ID格式
        if (!channelId.match(/^@[a-zA-Z0-9_]{5,20}$/)) {
            return res.status(400).json({ message: '频道ID格式错误' });
        }
        
        const channel = await Channel.findOne({ 
            channelId: new RegExp(`^${channelId}$`, 'i'),
            isBanned: false 
        });
        
        if (!channel) {
            return res.status(404).json({ message: '频道不存在或已被封禁' });
        }
        
        // 检查频道是否活跃
        if (!channel.isActive) {
            return res.status(400).json({ message: '频道暂时不可用' });
        }
        
        // 检查用户是否已是成员
        if (channel.members.includes(userId)) {
            return res.status(400).json({ message: '您已加入此频道' });
        }
        
        // 检查频道人数限制
        if (channel.members.length >= 1000) { // 限制最多1000人
            return res.status(400).json({ message: '频道人数已达上限' });
        }
        
        // 添加用户到频道
        channel.members.push(userId);
        await channel.save();
        
        // 将频道添加到用户的加入频道列表
        await User.findByIdAndUpdate(userId, {
            $addToSet: { joinedChannels: channel._id }
        });
        
        // 添加系统消息
        const user = await User.findById(userId);
        channel.messages.push({
            user: userId,
            username: user.username,
            content: `${user.displayName || user.username} 加入了频道`,
            timestamp: new Date(),
            isSystem: true
        });
        await channel.save();
        
        res.json({ 
            message: '成功加入频道',
            channel: {
                id: channel._id,
                name: channel.name,
                channelId: channel.channelId,
                memberCount: channel.members.length
            }
        });
    } catch (error) {
        console.error('加入频道错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 离开频道
router.post('/leave/:channelId', auth, async (req, res) => {
    try {
        const { channelId } = req.params;
        const userId = req.user.id;
        
        const channel = await Channel.findOne({ channelId });
        
        if (!channel) {
            return res.status(404).json({ message: '频道不存在' });
        }
        
        // 检查用户是否是成员
        if (!channel.members.includes(userId)) {
            return res.status(400).json({ message: '您不是此频道成员' });
        }
        
        // 检查是否是频道创建者（创建者不能离开，只能删除频道）
        if (channel.creator.toString() === userId) {
            return res.status(400).json({ message: '频道创建者不能离开频道，请删除频道' });
        }
        
        // 从频道成员中移除用户
        channel.members = channel.members.filter(member => member.toString() !== userId);
        await channel.save();
        
        // 从用户的加入频道列表中移除
        await User.findByIdAndUpdate(userId, {
            $pull: { joinedChannels: channel._id }
        });
        
        // 添加系统消息
        const user = await User.findById(userId);
        channel.messages.push({
            user: userId,
            username: user.username,
            content: `${user.displayName || user.username} 离开了频道`,
            timestamp: new Date(),
            isSystem: true
        });
        await channel.save();
        
        res.json({ message: '已成功离开频道' });
    } catch (error) {
        console.error('离开频道错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 获取用户加入的频道
router.get('/my-channels', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        const user = await User.findById(userId)
            .populate({
                path: 'joinedChannels',
                select: 'name channelId description creator members messages isActive isBanned createdAt',
                populate: {
                    path: 'creator',
                    select: 'username displayName avatar'
                }
            });
        
        if (!user) {
            return res.status(404).json({ message: '用户不存在' });
        }
        
        // 格式化频道数据
        const channels = user.joinedChannels.map(channel => ({
            id: channel._id,
            name: channel.name,
            channelId: channel.channelId,
            description: channel.description,
            creator: channel.creator,
            memberCount: channel.members.length,
            messagesCount: channel.messages.length,
            isActive: channel.isActive,
            isBanned: channel.isBanned,
            isCreator: channel.creator._id.toString() === userId,
            joinedAt: user.createdAt, // 注意：这里需要存储加入时间，建议在User模型中添加
            createdAt: channel.createdAt
        }));
        
        res.json({
            count: channels.length,
            channels
        });
    } catch (error) {
        console.error('获取用户频道错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 获取频道消息
router.get('/:channelId/messages', auth, async (req, res) => {
    try {
        const { channelId } = req.params;
        const { limit = 100, before = null } = req.query;
        const userId = req.user.id;
        
        const channel = await Channel.findOne({ channelId })
            .populate('messages.user', 'username displayName avatar');
        
        if (!channel) {
            return res.status(404).json({ message: '频道不存在' });
        }
        
        // 检查用户是否是频道成员
        if (!channel.members.includes(userId) && !req.user.isAdmin) {
            return res.status(403).json({ message: '您不是此频道成员' });
        }
        
        // 检查频道是否被封禁
        if (channel.isBanned && !req.user.isAdmin) {
            return res.status(403).json({ message: '此频道已被封禁' });
        }
        
        // 过滤消息
        let messages = channel.messages;
        
        // 如果指定了before参数，获取之前的历史消息
        if (before) {
            const beforeDate = new Date(before);
            messages = messages.filter(msg => msg.timestamp < beforeDate);
        }
        
        // 限制返回数量并排序（最新的在前）
        messages = messages
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, parseInt(limit))
            .reverse(); // 反转以便按时间顺序显示
        
        res.json({
            channelId: channel.channelId,
            channelName: channel.name,
            messages: messages.map(msg => ({
                id: msg._id,
                user: msg.user ? {
                    id: msg.user._id,
                    username: msg.user.username,
                    displayName: msg.user.displayName,
                    avatar: msg.user.avatar
                } : null,
                content: msg.content,
                timestamp: msg.timestamp,
                isSystem: msg.isSystem || false
            })),
            hasMore: channel.messages.length > parseInt(limit),
            totalMessages: channel.messages.length
        });
    } catch (error) {
        console.error('获取消息错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 获取频道详情
router.get('/:channelId/details', auth, async (req, res) => {
    try {
        const { channelId } = req.params;
        const userId = req.user.id;
        
        const channel = await Channel.findOne({ channelId })
            .populate('creator', 'username displayName avatar')
            .populate('members', 'username displayName avatar');
        
        if (!channel) {
            return res.status(404).json({ message: '频道不存在' });
        }
        
        // 检查用户是否是频道成员
        if (!channel.members.some(member => member._id.toString() === userId) && !req.user.isAdmin) {
            return res.status(403).json({ message: '您不是此频道成员' });
        }
        
        // 格式化响应数据
        const channelData = {
            id: channel._id,
            name: channel.name,
            channelId: channel.channelId,
            description: channel.description,
            creator: channel.creator,
            isPublic: channel.isPublic,
            isActive: channel.isActive,
            isBanned: channel.isBanned,
            memberCount: channel.members.length,
            messagesCount: channel.messages.length,
            createdAt: channel.createdAt,
            isMember: channel.members.some(member => member._id.toString() === userId),
            isCreator: channel.creator._id.toString() === userId
        };
        
        // 如果是管理员或创建者，返回成员列表
        if (req.user.isAdmin || channel.creator._id.toString() === userId) {
            channelData.members = channel.members.map(member => ({
                id: member._id,
                username: member.username,
                displayName: member.displayName,
                avatar: member.avatar
            }));
        }
        
        res.json(channelData);
    } catch (error) {
        console.error('获取频道详情错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 更新频道信息（仅创建者或管理员）
router.put('/:channelId/update', auth, async (req, res) => {
    try {
        const { channelId } = req.params;
        const { name, description, isPublic } = req.body;
        const userId = req.user.id;
        
        const channel = await Channel.findOne({ channelId });
        
        if (!channel) {
            return res.status(404).json({ message: '频道不存在' });
        }
        
        // 检查权限
        if (channel.creator.toString() !== userId && !req.user.isAdmin) {
            return res.status(403).json({ message: '只有创建者或管理员可以修改频道信息' });
        }
        
        // 验证输入
        const updateData = {};
        if (name !== undefined) {
            if (name.length > 50) {
                return res.status(400).json({ message: '频道名称不能超过50个字符' });
            }
            updateData.name = name;
        }
        
        if (description !== undefined) {
            if (description.length > 200) {
                return res.status(400).json({ message: '频道描述不能超过200个字符' });
            }
            updateData.description = description;
        }
        
        if (isPublic !== undefined) {
            updateData.isPublic = isPublic;
        }
        
        // 如果没有更新内容
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ message: '没有提供更新内容' });
        }
        
        // 更新频道
        const updatedChannel = await Channel.findByIdAndUpdate(
            channel._id,
            updateData,
            { new: true, runValidators: true }
        ).populate('creator', 'username displayName avatar');
        
        res.json({
            message: '频道信息更新成功',
            channel: {
                id: updatedChannel._id,
                name: updatedChannel.name,
                channelId: updatedChannel.channelId,
                description: updatedChannel.description,
                creator: updatedChannel.creator,
                isPublic: updatedChannel.isPublic,
                isActive: updatedChannel.isActive,
                memberCount: updatedChannel.members.length
            }
        });
    } catch (error) {
        console.error('更新频道信息错误:', error);
        
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: '数据验证失败' });
        }
        
        res.status(500).json({ message: '服务器错误' });
    }
});

// 删除频道（仅创建者或管理员）
router.delete('/:channelId', auth, async (req, res) => {
    try {
        const { channelId } = req.params;
        const userId = req.user.id;
        
        const channel = await Channel.findOne({ channelId });
        
        if (!channel) {
            return res.status(404).json({ message: '频道不存在' });
        }
        
        // 检查权限
        if (channel.creator.toString() !== userId && !req.user.isAdmin) {
            return res.status(403).json({ message: '只有创建者或管理员可以删除频道' });
        }
        
        // 从所有成员的joinedChannels中移除该频道
        await User.updateMany(
            { _id: { $in: channel.members } },
            { $pull: { joinedChannels: channel._id } }
        );
        
        // 删除频道
        await Channel.findByIdAndDelete(channel._id);
        
        res.json({ message: '频道删除成功' });
    } catch (error) {
        console.error('删除频道错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 获取热门频道
router.get('/popular', async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        
        const channels = await Channel.aggregate([
            {
                $match: {
                    isPublic: true,
                    isBanned: false,
                    isActive: true
                }
            },
            {
                $addFields: {
                    memberCount: { $size: "$members" },
                    messageCount: { $size: "$messages" },
                    activityScore: {
                        $add: [
                            { $multiply: [{ $size: "$members" }, 1] },
                            { $multiply: [{ $size: "$messages" }, 0.1] }
                        ]
                    }
                }
            },
            {
                $sort: { activityScore: -1 }
            },
            {
                $limit: parseInt(limit)
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'creator',
                    foreignField: '_id',
                    as: 'creator'
                }
            },
            {
                $unwind: '$creator'
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    channelId: 1,
                    description: 1,
                    creator: {
                        _id: '$creator._id',
                        username: '$creator.username',
                        displayName: '$creator.displayName',
                        avatar: '$creator.avatar'
                    },
                    memberCount: 1,
                    messageCount: 1,
                    activityScore: 1,
                    createdAt: 1
                }
            }
        ]);
        
        res.json(channels);
    } catch (error) {
        console.error('获取热门频道错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

// 清理频道消息（仅创建者或管理员）
router.post('/:channelId/clean-messages', auth, async (req, res) => {
    try {
        const { channelId } = req.params;
        const { days = 30 } = req.body;
        const userId = req.user.id;
        
        const channel = await Channel.findOne({ channelId });
        
        if (!channel) {
            return res.status(404).json({ message: '频道不存在' });
        }
        
        // 检查权限
        if (channel.creator.toString() !== userId && !req.user.isAdmin) {
            return res.status(403).json({ message: '只有创建者或管理员可以清理消息' });
        }
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
        
        const originalCount = channel.messages.length;
        
        // 保留最近的消息
        channel.messages = channel.messages.filter(msg => 
            msg.timestamp >= cutoffDate || msg.isSystem
        );
        
        await channel.save();
        
        const removedCount = originalCount - channel.messages.length;
        
        res.json({
            message: `成功清理了${removedCount}条消息`,
            remainingCount: channel.messages.length,
            removedCount
        });
    } catch (error) {
        console.error('清理消息错误:', error);
        res.status(500).json({ message: '服务器错误' });
    }
});

module.exports = router;