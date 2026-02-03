/**
 * 聊天模块 - 处理消息发送、接收和显示
 */

// 发送消息
async function sendMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    
    if (!message) {
        showNotification('消息不能为空', 'error');
        return;
    }
    
    if (!currentUser) {
        showNotification('请先登录', 'error');
        return;
    }
    
    if (!socket || !socket.connected) {
        showNotification('连接已断开，请刷新页面', 'error');
        return;
    }
    
    // 检查当前频道是否被封禁
    if (isChannelBanned(currentChannel)) {
        showNotification('此频道已被封禁，无法发送消息', 'error');
        return;
    }
    
    // 检查全局聊天是否被禁用
    if (isGlobalChatDisabled()) {
        showNotification('聊天功能已被管理员禁用', 'error');
        return;
    }
    
    // 禁用发送按钮
    const sendBtn = document.getElementById('send-message-btn');
    const originalHTML = sendBtn.innerHTML;
    sendBtn.innerHTML = '<div class="spinner" style="width: 16px; height: 16px;"></div>';
    sendBtn.disabled = true;
    
    // 创建消息对象
    const messageData = {
        channelId: currentChannel,
        userId: currentUser.id,
        username: currentUser.username,
        displayName: currentUser.displayName || currentUser.username,
        avatar: currentUser.avatar,
        content: message,
        timestamp: new Date()
    };
    
    try {
        // 发送消息到服务器
        socket.emit('send-message', messageData);
        
        // 添加消息到UI（自己发送的）
        addMessageToUI(messageData, true);
        
        // 清空输入框
        input.value = '';
        
        // 创建纸飞机动画
        createPaperPlaneAnimation();
        
        // 保存到本地存储（离线备用）
        saveMessageToLocal(messageData);
        
    } catch (error) {
        console.error('发送消息错误:', error);
        showNotification('发送失败，请重试', 'error');
    } finally {
        // 恢复发送按钮
        sendBtn.innerHTML = originalHTML;
        sendBtn.disabled = false;
    }
}

// 添加消息到UI
function addMessageToUI(message, isSelf = false) {
    const messagesContainer = document.getElementById('messages-container');
    
    // 确保消息容器存在
    if (!messagesContainer) return;
    
    // 创建消息元素
    const messageElement = createMessageElement(message, isSelf);
    
    // 添加到容器
    messagesContainer.appendChild(messageElement);
    
    // 滚动到底部
    scrollToBottom();
    
    // 添加消息进入动画
    messageElement.style.animation = 'messageAppear 0.3s ease';
}

// 创建消息元素
function createMessageElement(message, isSelf = false) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isSelf ? 'self' : 'other'}`;
    
    const time = formatMessageTime(message.timestamp);
    
    // 构建消息HTML
    let html = '';
    
    if (!isSelf) {
        html += `
            <div class="message-info">
                <img class="message-avatar" src="assets/${message.avatar}" alt="${message.displayName}" onerror="this.src='assets/default-avatar.png'">
                <span class="message-sender">${escapeHtml(message.displayName)}</span>
                <span class="message-time">${time}</span>
            </div>
        `;
    }
    
    html += `
        <div class="message-bubble">
            ${escapeHtml(message.content)}
        </div>
    `;
    
    if (isSelf) {
        html += `
            <div class="message-info">
                <span class="message-time">${time}</span>
            </div>
        `;
    }
    
    messageElement.innerHTML = html;
    
    // 添加点击事件（查看消息详情）
    messageElement.addEventListener('click', () => {
        showMessageDetails(message);
    });
    
    return messageElement;
}

// 格式化消息时间
function formatMessageTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) {
        return '刚刚';
    } else if (diffMins < 60) {
        return `${diffMins}分钟前`;
    } else if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (date.getFullYear() === now.getFullYear()) {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } else {
        return date.toLocaleDateString();
    }
}

// 显示消息详情
function showMessageDetails(message) {
    const time = new Date(message.timestamp).toLocaleString();
    
    const details = `
        发送者: ${message.displayName} (${message.username})<br>
        时间: ${time}<br>
        频道: ${message.channelId || currentChannel}
    `;
    
    showModal('消息详情', details);
}

// 滚动到消息底部
function scrollToBottom() {
    const messagesContainer = document.getElementById('messages-container');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// 创建纸飞机动画
function createPaperPlaneAnimation() {
    const container = document.getElementById('paper-plane-container');
    
    // 创建纸飞机元素
    const plane = document.createElement('div');
    plane.