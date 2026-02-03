/**
 * 主应用文件 - 初始化和管理整个应用
 */

// 全局变量
let currentUser = null;
let socket = null;
let currentChannel = '@public';
let channels = [];
let isOnline = navigator.onLine;

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('应用初始化...');
    
    // 检查网络状态
    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // 检查用户是否已登录
    const token = localStorage.getItem('token');
    if (token) {
        verifyToken(token);
    } else {
        showPage('login-page');
    }
    
    // 绑定事件
    bindEvents();
    
    // 初始化聊天模块
    initChatModule();
    
    // 初始化管理员页面
    initAdminPage();
    
    // 检查更新
    checkForUpdates();
});

// 绑定所有事件
function bindEvents() {
    console.log('绑定事件...');
    
    // 登录/注册按钮
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('show-register-btn').addEventListener('click', () => showPage('register-page'));
    document.getElementById('back-to-login').addEventListener('click', () => showPage('login-page'));
    document.getElementById('register-btn').addEventListener('click', handleRegister);
    
    // 导航按钮
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const pageId = this.getAttribute('data-page');
            showContentPage(pageId);
        });
    });
    
    // 用户信息按钮
    document.getElementById('user-info-btn').addEventListener('click', () => {
        if (!currentUser) return;
        showContentPage('my-page');
    });
    
    // 频道相关按钮
    document.getElementById('add-channel-btn').addEventListener('click', () => {
        if (!currentUser) {
            showNotification('请先登录', 'error');
            return;
        }
        showContentPage('add-channel-page');
    });
    
    // 设置按钮
    document.getElementById('settings-btn').addEventListener('click', () => {
        showContentPage('settings-page');
    });
    
    // 登出按钮
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    // 返回按钮
    document.getElementById('back-to-channels').addEventListener('click', () => showContentPage('public-channel-page'));
    document.getElementById('back-to-profile').addEventListener('click', () => showContentPage('my-page'));
    document.getElementById('back-to-main').addEventListener('click', () => showContentPage('public-channel-page'));
    document.getElementById('back-to-main-from-admin').addEventListener('click', () => showContentPage('public-channel-page'));
    
    // 消息发送
    document.getElementById('send-message-btn').addEventListener('click', sendMessage);
    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // 频道相关
    document.getElementById('create-channel-btn').addEventListener('click', createChannel);
    document.getElementById('search-channel-btn').addEventListener('click', searchChannel);
    document.getElementById('join-found-channel-btn').addEventListener('click', joinFoundChannel);
    
    // 设置相关
    document.getElementById('save-displayname-btn').addEventListener('click', updateDisplayName);
    document.querySelectorAll('.avatar-option').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelectorAll('.avatar-option').forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');
        });
    });
    document.getElementById('save-avatar-btn').addEventListener('click', updateAvatar);
    
    // 管理员功能
    document.getElementById('generate-code-btn').addEventListener('click', generateActivationCode);
    document.getElementById('ban-channel-btn').addEventListener('click', () => banChannel('ban'));
    document.getElementById('unban-channel-btn').addEventListener('click', () => banChannel('unban'));
    document.getElementById('ban-user-btn').addEventListener('click', () => banUser('ban'));
    document.getElementById('unban-user-btn').addEventListener('click', () => banUser('unban'));
    document.getElementById('disable-all-chats-btn').addEventListener('click', disableAllChats);
    document.getElementById('view-codes-btn').addEventListener('click', viewAllActivationCodes);
    
    // Tab切换
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
    
    // 监听页面可见性变化
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    console.log('事件绑定完成');
}

// 显示页面
function showPage(pageId) {
    console.log(`显示页面: ${pageId}`);
    
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
        
        // 页面切换时的特殊处理
        if (pageId === 'app-page') {
            document.title = '纸飞机通讯';
        } else if (pageId === 'login-page') {
            document.title = '登录 - 纸飞机通讯';
        } else if (pageId === 'register-page') {
            document.title = '注册 - 纸飞机通讯';
        }
    }
}

// 显示内容页面
function showContentPage(pageId) {
    console.log(`显示内容页面: ${pageId}`);
    
    // 隐藏所有内容页面
    document.querySelectorAll('.content-page').forEach(page => {
        page.classList.remove('active');
    });
    
    // 显示目标页面
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
        
        // 更新导航按钮状态
        updateNavButtons(pageId);
        
        // 页面特定的初始化
        handlePageShow(pageId);
    }
}

// 更新导航按钮状态
function updateNavButtons(activePageId) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-page') === activePageId) {
            btn.classList.add('active');
        }
    });
}

// 页面显示时的处理
function handlePageShow(pageId) {
    switch (pageId) {
        case 'public-channel-page':
            loadChannels();
            if (currentChannel) {
                loadMessages(currentChannel);
            }
            break;
            
        case 'my-page':
            loadProfileInfo();
            break;
            
        case 'admin-page':
            if (!currentUser || !currentUser.isAdmin) {
                showNotification('需要管理员权限', 'error');
                showContentPage('public-channel-page');
                return;
            }
            break;
            
        case 'add-channel-page':
            // 切换到创建频道标签页
            switchTab('create-channel');
            break;
    }
}

// 切换标签页
function switchTab(tabId) {
    console.log(`切换标签页: ${tabId}`);
    
    // 更新按钮状态
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        }
    });
    
    // 显示对应的内容
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    
    const targetPane = document.getElementById(tabId);
    if (targetPane) {
        targetPane.classList.add('active');
    }
}

// 验证令牌
async function verifyToken(token) {
    console.log('验证令牌...');
    
    try {
        const response = await fetch('http://localhost:5000/api/auth/verify', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            console.log('用户验证成功:', currentUser.username);
            initializeApp();
        } else {
            console.log('令牌无效');
            localStorage.removeItem('token');
            showPage('login-page');
            showNotification('登录已过期，请重新登录', 'info');
        }
    } catch (error) {
        console.error('验证令牌错误:', error);
        localStorage.removeItem('token');
        showPage('login-page');
        showNotification('网络错误，请检查连接', 'error');
    }
}

// 初始化应用
function initializeApp() {
    console.log('初始化应用...');
    
    // 显示主应用页面
    showPage('app-page');
    showContentPage('public-channel-page');
    
    // 显示用户信息
    updateUserInfo();
    
    // 初始化Socket.IO连接
    initializeSocket();
    
    // 加载初始数据
    loadInitialData();
    
    // 显示欢迎消息
    setTimeout(() => {
        showNotification(`欢迎回来，${currentUser.displayName || currentUser.username}!`, 'success');
    }, 500);
}

// 更新用户信息显示
function updateUserInfo() {
    if (!currentUser) return;
    
    const displayName = currentUser.displayName || currentUser.username;
    const avatar = currentUser.avatar || 'default-avatar.png';
    
    document.getElementById('user-displayname').textContent = displayName;
    document.getElementById('user-avatar').src = `assets/${avatar}`;
    
    // 如果是管理员，显示管理员按钮
    if (currentUser.isAdmin) {
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'flex';
        });
    }
}

// 初始化Socket.IO连接
function initializeSocket() {
    console.log('初始化Socket.IO连接...');
    
    if (socket) {
        socket.disconnect();
    }
    
    socket = io('http://localhost:5000', {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000
    });
    
    // 连接成功
    socket.on('connect', () => {
        console.log('Socket.IO 连接成功，ID:', socket.id);
        
        // 加入当前频道
        if (currentChannel) {
            socket.emit('join-channel', currentChannel);
        }
        
        // 发送用户上线通知
        socket.emit('user-online', {
            userId: currentUser.id,
            username: currentUser.username
        });
    });
    
    // 接收消息
    socket.on('receive-message', (data) => {
        console.log('收到消息:', data);
        addMessageToUI(data, data.userId === currentUser.id);
    });
    
    // 用户加入频道通知
    socket.on('user-joined', (data) => {
        if (data.channelId === currentChannel && data.userId !== currentUser.id) {
            addSystemMessage(`${data.displayName} 加入了频道`);
        }
    });
    
    // 用户离开频道通知
    socket.on('user-left', (data) => {
        if (data.channelId === currentChannel && data.userId !== currentUser.id) {
            addSystemMessage(`${data.displayName} 离开了频道`);
        }
    });
    
    // 连接错误
    socket.on('connect_error', (error) => {
        console.error('Socket.IO 连接错误:', error);
        showNotification('连接服务器失败，尝试重连中...', 'error');
    });
    
    // 断开连接
    socket.on('disconnect', (reason) => {
        console.log('Socket.IO 断开连接:', reason);
        if (reason === 'io server disconnect') {
            // 服务器主动断开，需要手动重连
            socket.connect();
        }
    });
    
    // 重连成功
    socket.on('reconnect', (attemptNumber) => {
        console.log(`Socket.IO 重连成功，尝试次数: ${attemptNumber}`);
        showNotification('重新连接成功', 'success');
        
        // 重新加入频道
        if (currentChannel) {
            socket.emit('join-channel', currentChannel);
        }
    });
    
    // 重连尝试
    socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`Socket.IO 重连尝试: ${attemptNumber}`);
    });
    
    // 重连错误
    socket.on('reconnect_error', (error) => {
        console.error('Socket.IO 重连错误:', error);
    });
}

// 加载初始数据
function loadInitialData() {
    console.log('加载初始数据...');
    
    // 加载频道列表
    loadChannels();
    
    // 加载消息
    if (currentChannel) {
        loadMessages(currentChannel);
    }
}

// 切换频道
async function switchChannel(channelId, channelName) {
    console.log(`切换频道: ${channelId} - ${channelName}`);
    
    // 验证输入
    if (!channelId || !channelName) {
        console.error('切换频道参数错误');
        return;
    }
    
    // 离开当前频道
    if (currentChannel && socket && socket.connected) {
        socket.emit('leave-channel', currentChannel);
    }
    
    // 更新当前频道
    const oldChannel = currentChannel;
    currentChannel = channelId;
    
    // 更新UI
    updateChannelUI(channelId, channelName);
    
    // 加入新频道
    if (socket && socket.connected) {
        socket.emit('join-channel', channelId);
    }
    
    // 加载消息
    await loadMessages(channelId);
    
    // 发送频道切换通知
    sendChannelSwitchNotification(oldChannel, channelId);
}

// 更新频道UI
function updateChannelUI(channelId, channelName) {
    document.getElementById('current-channel-name').textContent = channelName;
    document.querySelector('.channel-info').textContent = channelId;
    
    // 更新频道列表高亮
    updateChannelListHighlight(channelId);
}

// 更新频道列表高亮
function updateChannelListHighlight(activeChannelId) {
    document.querySelectorAll('.channel-item').forEach(item => {
        const channelIdElement = item.querySelector('.channel-id');
        if (channelIdElement) {
            const channelId = channelIdElement.textContent;
            if (channelId === activeChannelId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        }
    });
}

// 发送频道切换通知
function sendChannelSwitchNotification(oldChannel, newChannel) {
    console.log(`频道切换: ${oldChannel} -> ${newChannel}`);
    
    // 这里可以添加频道切换的统计或日志
    if (socket && socket.connected) {
        socket.emit('channel-switch', {
            userId: currentUser.id,
            oldChannel,
            newChannel,
            timestamp: new Date()
        });
    }
}

// 显示通知
function showNotification(message, type = 'info') {
    console.log(`通知 [${type}]: ${message}`);
    
    // 移除现有通知
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // 创建新通知
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // 添加图标
    let icon = 'info-circle';
    switch (type) {
        case 'success':
            icon = 'check-circle';
            break;
        case 'error':
            icon = 'exclamation-circle';
            break;
        case 'warning':
            icon = 'exclamation-triangle';
            break;
    }
    
    notification.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // 添加样式（如果还没有）
    if (!document.querySelector('#notification-icons-css')) {
        const style = document.createElement('style');
        style.id = 'notification-icons-css';
        style.textContent = `
            .notification i {
                margin-right: 8px;
            }
        `;
        document.head.appendChild(style);
    }
    
    // 3秒后自动移除
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'fadeOut 0.3s';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    }, 3000);
}

// 更新在线状态
function updateOnlineStatus() {
    const wasOnline = isOnline;
    isOnline = navigator.onLine;
    
    if (wasOnline !== isOnline) {
        if (isOnline) {
            console.log('网络已连接');
            showNotification('网络已恢复', 'success');
            
            // 重新连接Socket
            if (socket && !socket.connected) {
                socket.connect();
            }
        } else {
            console.log('网络已断开');
            showNotification('网络连接已断开', 'error');
        }
    }
}

// 处理页面可见性变化
function handleVisibilityChange() {
    if (document.hidden) {
        console.log('页面隐藏');
        // 页面隐藏时的处理
    } else {
        console.log('页面显示');
        // 页面重新显示时的处理
        if (socket && !socket.connected) {
            socket.connect();
        }
    }
}

// 检查更新
function checkForUpdates() {
    // 这里可以添加检查应用更新的逻辑
    console.log('检查更新...');
    
    // 示例：检查版本
    const currentVersion = '1.0.0';
    const savedVersion = localStorage.getItem('app_version');
    
    if (savedVersion !== currentVersion) {
        console.log('新版本可用:', currentVersion);
        localStorage.setItem('app_version', currentVersion);
        
        // 可以显示更新通知
        // showNotification('应用已更新到新版本', 'info');
    }
}

// 错误处理
window.addEventListener('error', (event) => {
    console.error('全局错误:', event.error);
    
    // 可以发送错误报告
    if (socket && socket.connected) {
        socket.emit('client-error', {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error?.toString(),
            timestamp: new Date(),
            userId: currentUser?.id
        });
    }
});

// 未处理的Promise rejection
window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的Promise rejection:', event.reason);
    
    // 可以发送错误报告
    if (socket && socket.connected) {
        socket.emit('promise-rejection', {
            reason: event.reason?.toString(),
            timestamp: new Date(),
            userId: currentUser?.id
        });
    }
});

// 导出全局函数（用于调试）
window.app = {
    currentUser,
    socket,
    currentChannel,
    channels,
    showNotification,
    switchChannel,
    reloadChannels: loadChannels
};

console.log('应用初始化完成');