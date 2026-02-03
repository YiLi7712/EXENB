/**
 * 认证模块 - 处理用户注册和登录
 */

// 登录处理
async function handleLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!username || !password) {
        showNotification('请输入用户名和密码', 'error');
        return;
    }
    
    // 显示加载状态
    const loginBtn = document.getElementById('login-btn');
    const btnText = loginBtn.querySelector('.btn-text');
    const btnLoader = loginBtn.querySelector('.btn-loader');
    
    btnText.style.display = 'none';
    btnLoader.style.display = 'flex';
    loginBtn.disabled = true;
    
    try {
        const response = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // 保存令牌和用户信息
            localStorage.setItem('token', data.token);
            currentUser = data.user;
            
            showNotification('登录成功', 'success');
            initializeApp();
        } else {
            showNotification(data.message || '登录失败', 'error');
        }
    } catch (error) {
        console.error('登录错误:', error);
        showNotification('网络错误，请检查服务器连接', 'error');
    } finally {
        // 恢复按钮状态
        btnText.style.display = 'block';
        btnLoader.style.display = 'none';
        loginBtn.disabled = false;
    }
}

// 注册处理
async function handleRegister() {
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    const displayName = document.getElementById('register-displayname').value.trim();
    const activationCode = document.getElementById('register-code').value.trim();
    
    // 验证输入
    if (!username || !password || !activationCode) {
        showNotification('请填写所有必填字段', 'error');
        return;
    }
    
    if (username.length < 3 || username.length > 20) {
        showNotification('用户名长度需在3-20个字符之间', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('密码至少需要6个字符', 'error');
        return;
    }
    
    if (displayName.length > 30) {
        showNotification('显示名称不能超过30个字符', 'error');
        return;
    }
    
    // 显示加载状态
    const registerBtn = document.getElementById('register-btn');
    const btnText = registerBtn.querySelector('.btn-text');
    const btnLoader = registerBtn.querySelector('.btn-loader');
    
    btnText.style.display = 'none';
    btnLoader.style.display = 'flex';
    registerBtn.disabled = true;
    
    try {
        const response = await fetch('http://localhost:5000/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username,
                password,
                displayName,
                activationCode
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('注册成功！请登录', 'success');
            
            // 清空表单
            document.getElementById('register-username').value = '';
            document.getElementById('register-password').value = '';
            document.getElementById('register-displayname').value = '';
            document.getElementById('register-code').value = '';
            
            // 返回登录页面
            setTimeout(() => {
                showPage('login-page');
            }, 1500);
        } else {
            showNotification(data.message || '注册失败', 'error');
        }
    } catch (error) {
        console.error('注册错误:', error);
        showNotification('网络错误，请检查服务器连接', 'error');
    } finally {
        // 恢复按钮状态
        btnText.style.display = 'block';
        btnLoader.style.display = 'none';
        registerBtn.disabled = false;
    }
}

// 登出处理
async function handleLogout() {
    if (confirm('确定要退出登录吗？')) {
        // 断开Socket连接
        if (socket) {
            socket.disconnect();
            socket = null;
        }
        
        // 清除本地存储
        localStorage.removeItem('token');
        currentUser = null;
        
        // 返回登录页面
        showPage('login-page');
        showNotification('已退出登录', 'info');
    }
}

// 更新显示名称
async function updateDisplayName() {
    const newDisplayName = document.getElementById('settings-displayname').value.trim();
    
    if (!newDisplayName) {
        showNotification('请输入新的显示名称', 'error');
        return;
    }
    
    if (newDisplayName.length > 30) {
        showNotification('显示名称不能超过30个字符', 'error');
        return;
    }
    
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:5000/api/auth/update-profile', {
           