/**
 * 管理员模块 - 处理管理员功能
 */

// 生成激活码
async function generateActivationCode() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:5000/api/admin/generate-code', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const codeResult = document.getElementById('generated-code');
            const codeValue = document.getElementById('code-value');
            const codeExpires = document.getElementById('code-expires');
            
            codeValue.textContent = data.code;
            codeExpires.textContent = new Date(data.expiresAt).toLocaleString();
            codeResult.style.display = 'block';
            
            showNotification('激活码生成成功', 'success');
            
            // 复制到剪贴板
            copyToClipboard(data.code);
        } else {
            showNotification(data.message || '生成激活码失败', 'error');
        }
    } catch (error) {
        console.error('生成激活码错误:', error);
        showNotification('网络错误', 'error');
    }
}

// 封禁/解封频道
async function banChannel(action) {
    const inputId = action === 'ban' ? 'ban-channel-id' : 'unban-channel-id';
    const channelId = document.getElementById(inputId).value.trim();
    
    if (!channelId) {
        showNotification('请输入频道ID', 'error');
        return;
    }
    
    if (!channelId.match(/^@[a-zA-Z0-9_]{5,20}$/)) {
        showNotification('频道ID格式错误', 'error');
        return;
    }
    
    const confirmMessage = action === 'ban' 
        ? `确定要封禁频道 ${channelId} 吗？`
        : `确定要解封频道 ${channelId} 吗？`;
    
    if (!confirm(confirmMessage)) return;
    
    try {
        const token = localStorage.getItem('token');
        const endpoint = action === 'ban' ? 'ban-channel' : 'unban-channel';
        
        const response = await fetch(`http://localhost:5000/api/admin/${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ channelId })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const actionText = action === 'ban' ? '封禁' : '解封';
            showNotification(`频道${actionText}成功`, 'success');
            
            // 清空输入框
            document.getElementById(inputId).value = '';
            
            // 如果封禁的是当前频道，切换到公共频道
            if (action === 'ban' && channelId === currentChannel) {
                switchChannel('@public', '公共频道');
                showNotification('当前频道已被封禁，已切换到公共频道', 'warning');
            }
            
            // 重新加载频道列表
            loadChannels();
        } else {
            showNotification(data.message || '操作失败', 'error');
        }
    } catch (error) {
        console.error('频道操作错误:', error);
        showNotification('网络错误', 'error');
    }
}

// 封禁/解封用户
async function banUser(action) {
    const inputId = action === 'ban' ? 'ban-username' : 'unban-username';
    const username = document.getElementById(inputId).value.trim();
    
    if (!username) {
        showNotification('请输入用户名', 'error');
        return;
    }
    
    const confirmMessage = action === 'ban' 
        ? `确定要封禁用户 ${username} 吗？`
        : `确定要解封用户 ${username} 吗？`;
    
    if (!confirm(confirmMessage)) return;
    
    try {
        const token = localStorage.getItem('token');
        const endpoint = action === 'ban' ? 'ban-user' : 'unban-user';
        
        const response = await fetch(`http://localhost:5000/api/admin/${endpoint}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const actionText = action === 'ban' ? '封禁' : '解封';
            showNotification(`用户${actionText}成功`, 'success');
            
            // 清空输入框
            document.getElementById(inputId).value = '';
            
            // 如果封禁的是当前用户，强制登出
            if (action === 'ban' && username === currentUser.username) {
                handleLogout();
                showNotification('您的账号已被封禁', 'error');
            }
        } else {
            showNotification(data.message || '操作失败', 'error');
        }
    } catch (error) {
        console.error('用户操作错误:', error);
        showNotification('网络错误', 'error');
    }
}

// 禁用所有频道聊天
async function disableAllChats() {
    if (!confirm('确定要禁用所有频道聊天功能吗？此操作会影响所有用户。')) return;
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:5000/api/