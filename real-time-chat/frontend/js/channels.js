/**
 * 频道模块 - 处理频道创建、加入和管理
 */

// 创建频道
async function createChannel() {
    const name = document.getElementById('channel-name').value.trim();
    const channelId = document.getElementById('channel-id').value.trim();
    const description = document.getElementById('channel-description').value.trim();
    
    // 验证输入
    if (!name || !channelId) {
        showNotification('请填写频道名称和ID', 'error');
        return;
    }
    
    // 验证频道ID格式
    if (!channelId.match(/^@[a-zA-Z0-9_]{5,20}$/)) {
        showNotification('频道ID格式错误，必须为@开头，包含5-20个字母、数字或下划线', 'error');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:5000/api/channels/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                name,
                channelId,
                description
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('频道创建成功', 'success');
            
            // 清空表单
            document.getElementById('channel-name').value = '';
            document.getElementById('channel-id').value = '';
            document.getElementById('channel-description').value = '';
            
            // 重新加载频道列表
            loadChannels();
            
            // 切换到新频道
            setTimeout(() => {
                switchChannel(channelId, name);
                showContentPage('public-channel-page');
            }, 1000);
        } else {
            showNotification(data.message || '创建频道失败', 'error');
        }
    } catch (error) {
        console.error('创建频道错误:', error);
        showNotification('网络错误', 'error');
    }
}

// 搜索频道
async function searchChannel() {
    const channelId = document.getElementById('search-channel-id').value.trim();
    
    if (!channelId) {
        showNotification('请输入频道ID', 'error');
        return;
    }
    
    // 验证频道ID格式
    if (!channelId.match(/^@[a-zA-Z0-9_]{5,20}$/)) {
        showNotification('频道ID格式错误', 'error');
        return;
    }
    
    try {
        const response = await fetch(`http://localhost:5000/api/channels/search/${channelId}`);
        
        if (response.ok) {
            const channel = await response.json();
            displayChannelSearchResult(channel);
        } else {
            const data = await response.json();
            showNotification(data.message || '频道不存在', 'error');
            hideChannelSearchResult();
        }
    } catch (error) {
        console.error('搜索频道错误:', error);
        showNotification('网络错误', 'error');
        hideChannelSearchResult();
    }
}

// 显示频道搜索结果
function displayChannelSearchResult(channel) {
    const searchResult = document.getElementById('channel-search-result');
    const channelName = document.getElementById('found-channel-name');
    const channelId = document.getElementById('found-channel-id');
    const channelDescription = document.getElementById('found-channel-description');
    
    channelName.textContent = channel.name;
    channelId.textContent = channel.channelId;
    channelDescription.textContent = channel.description || '暂无描述';
    
    searchResult.style.display = 'block';
}

// 隐藏频道搜索结果
function hideChannelSearchResult() {
    document.getElementById('channel-search-result').style.display = 'none';
}

// 加入找到的频道
async function joinFoundChannel() {
    const channelId = document.getElementById('found-channel-id').textContent;
    
    if (!channelId) {
        showNotification('未找到频道信息', 'error');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:5000/api/channels/join/${channelId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('成功加入频道', 'success');
            
            // 清空搜索框
            document.getElementById('search-channel-id').value = '';
            hideChannelSearchResult();
            
            // 重新加载频道列表
            loadChannels();
            
            // 切换到新频道
            const channelName = document.getElementById('found-channel-name').textContent;
            setTimeout(() => {
                switchChannel(channelId, channelName);
                showContentPage('public-channel-page');
            }, 1000);
        } else {
            showNotification(data.message || '加入频道失败', 'error');
        }
    } catch (error) {
        console.error('加入频道错误:', error);
        showNotification('网络错误', 'error');
    }
}

// 获取用户加入的频道
async function loadUserChannels() {
    try {
        const token = localStorage.getItem('token');
        const 