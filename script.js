// script.js - Основной код приложения с синхронизацией
"use strict";

// ===== СИСТЕМА СИНХРОНИЗАЦИИ =====
class SyncManager {
    constructor() {
        this.lastSyncKey = 'priorlab_last_sync';
        this.syncInterval = 30000; // 30 секунд
        this.init();
    }

    init() {
        // Запускаем периодическую синхронизацию
        setInterval(() => this.syncWithServer(), this.syncInterval);
        
        // Синхронизируем при загрузке
        setTimeout(() => this.syncWithServer(), 2000);
        
        // Слушаем изменения в localStorage других вкладок
        window.addEventListener('storage', this.handleStorageEvent.bind(this));
        
        console.log('Менеджер синхронизации инициализирован');
    }

    async syncWithServer() {
        try {
            if (!window.virtualServer || !window.virtualServer.isAvailable()) {
                return false;
            }

            // Собираем локальные данные
            const localData = this.collectLocalData();
            
            // Синхронизируем с сервером
            await window.virtualServer.syncAllData(localData);
            
            // Загружаем объединенные данные с сервера
            const serverData = window.virtualServer.getAllData();
            
            // Сохраняем обратно в localStorage
            this.saveSyncedData(serverData);
            
            localStorage.setItem(this.lastSyncKey, new Date().toISOString());
            
            // Обновляем UI
            this.updateUIAfterSync();
            
            return true;
        } catch (error) {
            console.error('Ошибка синхронизации:', error);
            return false;
        }
    }

    collectLocalData() {
        const currentUser = this.getCurrentUser();
        
        return {
            users: this.getLocalUsers(),
            chat: this.getLocalChat(),
            payments: currentUser ? this.getLocalPayments(currentUser.id) : [],
            projects: currentUser ? this.getLocalProjects(currentUser.id) : [],
            timestamp: new Date().toISOString()
        };
    }

    getLocalUsers() {
        try {
            const users = localStorage.getItem('pt_users');
            return users ? JSON.parse(users) : [];
        } catch (e) {
            console.error('Ошибка чтения пользователей:', e);
            return [];
        }
    }

    getLocalChat() {
        try {
            const chat = localStorage.getItem('pt_chat');
            return chat ? JSON.parse(chat) : [];
        } catch (e) {
            console.error('Ошибка чтения чата:', e);
            return [];
        }
    }

    getLocalPayments(userId) {
        try {
            const payments = localStorage.getItem(`pt_payments_${userId}`);
            return payments ? JSON.parse(payments) : [];
        } catch (e) {
            console.error('Ошибка чтения платежей:', e);
            return [];
        }
    }

    getLocalProjects(userId) {
        try {
            const projects = localStorage.getItem(`pt_projects_history_${userId}`);
            return projects ? JSON.parse(projects) : [];
        } catch (e) {
            console.error('Ошибка чтения проектов:', e);
            return [];
        }
    }

    getCurrentUser() {
        try {
            const user = localStorage.getItem('pt_current_user');
            return user ? JSON.parse(user) : null;
        } catch (e) {
            return null;
        }
    }

    saveSyncedData(serverData) {
        if (serverData.users) {
            localStorage.setItem('pt_users', JSON.stringify(serverData.users));
        }
        
        if (serverData.chat) {
            localStorage.setItem('pt_chat', JSON.stringify(serverData.chat));
        }
        
        const currentUser = this.getCurrentUser();
        if (currentUser) {
            if (serverData.payments) {
                const userPayments = serverData.payments.filter(p => p.userId === currentUser.id);
                localStorage.setItem(`pt_payments_${currentUser.id}`, JSON.stringify(userPayments));
            }
            
            if (serverData.projects) {
                const userProjects = serverData.projects.filter(p => p.userId === currentUser.id);
                localStorage.setItem(`pt_projects_history_${currentUser.id}`, JSON.stringify(userProjects));
            }
        }
    }

    updateUIAfterSync() {
        // Обновляем UI в зависимости от активного раздела
        const activeSection = document.querySelector('.section.active');
        if (!activeSection) return;
        
        const sectionId = activeSection.id;
        
        switch(sectionId) {
            case 'support':
                if (typeof loadChatMessages === 'function') loadChatMessages();
                break;
            case 'profile':
                if (typeof updateProfileStats === 'function') updateProfileStats();
                if (typeof renderSavedProfiles === 'function') renderSavedProfiles();
                break;
            case 'projects':
                if (typeof updatePaymentAmount === 'function') updatePaymentAmount();
                break;
        }
    }

    handleStorageEvent(event) {
        if (event.key === 'pt_chat' || event.key === 'pt_users') {
            this.updateUIAfterSync();
        }
    }

    forceSync() {
        return this.syncWithServer();
    }
}

// ===== USER MANAGER =====
class UserManager {
    constructor() {
        this.usersKey = 'pt_users';
        this.currentUserKey = 'pt_current_user';
        this.savedProfilesKey = 'pt_saved_profiles';
        this.syncManager = new SyncManager();
        this.users = this.loadUsers();
        this.savedProfiles = this.loadSavedProfiles();
    }

    loadUsers() {
        try {
            const data = localStorage.getItem(this.usersKey);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Ошибка загрузки пользователей:', e);
            return [];
        }
    }

    loadSavedProfiles() {
        try {
            const data = localStorage.getItem(this.savedProfilesKey);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('Ошибка загрузки профилей:', e);
            return [];
        }
    }

    saveUsers() {
        try {
            localStorage.setItem(this.usersKey, JSON.stringify(this.users));
        } catch (e) {
            console.error('Ошибка сохранения пользователей:', e);
        }
    }

    saveSavedProfiles() {
        try {
            localStorage.setItem(this.savedProfilesKey, JSON.stringify(this.savedProfiles));
        } catch (e) {
            console.error('Ошибка сохранения профилей:', e);
        }
    }

    register(userData, remember = true) {
        // Проверяем на сервере
        const serverUser = window.virtualServer?.getUserByEmail(userData.email);
        if (serverUser) {
            throw new Error('Пользователь с таким email уже зарегистрирован');
        }

        // Проверяем локально
        if (this.users.some(u => u.email === userData.email)) {
            throw new Error('Пользователь с таким email уже зарегистрирован');
        }

        // Создаем пользователя
        const newUser = {
            id: 'user_' + Date.now(),
            name: userData.name,
            email: userData.email,
            password: userData.password,
            role: userData.email === 'admin@mail' ? 'admin' : 'client',
            regDate: new Date().toLocaleDateString('ru-RU'),
            phone: '',
            city: '',
            car: '',
            experience: 'Новичок',
            avatar: null,
            stats: {
                projects: 0,
                spent: 0,
                messages: 0,
                level: 1
            },
            lastUpdate: new Date().toISOString()
        };

        // Добавляем на сервер
        if (window.virtualServer) {
            window.virtualServer.addUser(newUser);
        }
        
        // Добавляем локально
        this.users.push(newUser);
        this.saveUsers();

        // Сохраняем для быстрого входа
        if (remember) {
            this.saveProfileForQuickLogin(newUser);
        }

        // Синхронизируем
        this.syncManager.forceSync();

        return newUser;
    }

    login(email, password, remember = true) {
        // Проверяем локально
        let user = this.users.find(u => u.email === email && u.password === password);
        
        // Если не нашли, проверяем на сервере
        if (!user && window.virtualServer) {
            const serverUser = window.virtualServer.getUserByEmail(email);
            if (serverUser && serverUser.password === password) {
                user = serverUser;
                // Добавляем в локальный список
                if (!this.users.some(u => u.id === user.id)) {
                    this.users.push(user);
                    this.saveUsers();
                }
            }
        }
        
        if (!user) {
            throw new Error('Неверный email или пароль');
        }

        // Сохраняем текущего пользователя
        localStorage.setItem(this.currentUserKey, JSON.stringify(user));

        // Сохраняем для быстрого входа
        if (remember) {
            this.saveProfileForQuickLogin(user);
        }

        // Синхронизируем
        this.syncManager.forceSync();

        return user;
    }

    saveProfileForQuickLogin(user) {
        const savedProfile = {
            id: user.id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            lastLogin: new Date().toISOString()
        };

        const existingIndex = this.savedProfiles.findIndex(p => p.email === user.email);
        
        if (existingIndex !== -1) {
            this.savedProfiles[existingIndex] = savedProfile;
        } else {
            this.savedProfiles.push(savedProfile);
        }

        if (this.savedProfiles.length > 5) {
            this.savedProfiles.shift();
        }

        this.saveSavedProfiles();
    }

    removeSavedProfile(email) {
        this.savedProfiles = this.savedProfiles.filter(p => p.email !== email);
        this.saveSavedProfiles();
    }

    clearSavedProfiles() {
        this.savedProfiles = [];
        this.saveSavedProfiles();
    }

    getCurrentUser() {
        try {
            const data = localStorage.getItem(this.currentUserKey);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    }

    logout() {
        localStorage.removeItem(this.currentUserKey);
        this.syncManager.forceSync();
    }

    updateUser(updatedUser) {
        const index = this.users.findIndex(u => u.id === updatedUser.id);
        
        if (index !== -1) {
            if (!updatedUser.password) {
                updatedUser.password = this.users[index].password;
            }
            
            updatedUser.lastUpdate = new Date().toISOString();
            this.users[index] = updatedUser;
            this.saveUsers();
            
            // Обновляем на сервере
            if (window.virtualServer) {
                window.virtualServer.updateUser(updatedUser);
            }
            
            // Обновляем сохраненный профиль
            const savedProfileIndex = this.savedProfiles.findIndex(p => p.email === updatedUser.email);
            if (savedProfileIndex !== -1) {
                this.savedProfiles[savedProfileIndex].name = updatedUser.name;
                this.savedProfiles[savedProfileIndex].avatar = updatedUser.avatar;
                this.saveSavedProfiles();
            }
            
            // Обновляем текущего пользователя
            const currentUser = this.getCurrentUser();
            if (currentUser && currentUser.id === updatedUser.id) {
                localStorage.setItem(this.currentUserKey, JSON.stringify(updatedUser));
            }
            
            // Синхронизируем
            this.syncManager.forceSync();
        }
    }

    getUserByEmail(email) {
        return this.users.find(u => u.email === email);
    }

    getUserStats(userId) {
        const user = this.users.find(u => u.id === userId);
        return user ? user.stats : null;
    }

    updateUserStats(userId, statsUpdate) {
        const user = this.users.find(u => u.id === userId);
        
        if (user) {
            user.stats = { ...user.stats, ...statsUpdate };
            user.lastUpdate = new Date().toISOString();
            this.saveUsers();
            
            // Обновляем на сервере
            if (window.virtualServer) {
                window.virtualServer.updateUser(user);
            }
            
            // Обновляем текущего пользователя
            const currentUser = this.getCurrentUser();
            if (currentUser && currentUser.id === userId) {
                currentUser.stats = user.stats;
                localStorage.setItem(this.currentUserKey, JSON.stringify(currentUser));
            }
            
            // Синхронизируем
            this.syncManager.forceSync();
        }
    }
}

// Создаем глобальный экземпляр менеджера пользователей
const userManager = new UserManager();

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
const authOverlay = document.getElementById('auth-overlay');
const loginCard = document.getElementById('login-card');
const registerCard = document.getElementById('register-card');
const userNameTitle = document.getElementById('user-name-title');
const quickLogoutBtn = document.getElementById('quick-logout');
const sections = document.querySelectorAll('.section');
const backBtn = document.getElementById('back-btn');
let historyStack = ['home'];
let projectParts = [];
let compareItems = [];

// ===== НАВИГАЦИЯ =====
function showSection(id, pushToHistory = true) {
    sections.forEach(sec => {
        sec.classList.toggle('active', sec.id === id);
    });

    if (pushToHistory) {
        const last = historyStack[historyStack.length - 1];
        if (last !== id) historyStack.push(id);
    }

    backBtn.disabled = historyStack.length <= 1;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Обновляем данные при показе раздела
    switch(id) {
        case 'profile':
            loadProfileData();
            updateProfileStats();
            renderSavedProfiles();
            break;
        case 'projects':
            updatePaymentAmount();
            break;
        case 'support':
            loadChatMessages();
            break;
        case 'dashboard':
            setupCatalogCards();
            break;
    }
}

document.querySelectorAll('.nav-btn, .quick-buttons button').forEach(btn => {
    btn.addEventListener('click', () => {
        const id = btn.dataset.section;
        if (id) showSection(id);
    });
});

backBtn.addEventListener('click', () => {
    if (historyStack.length > 1) {
        historyStack.pop();
        const prev = historyStack.pop();
        showSection(prev, true);
    }
});

// ===== АУТЕНТИФИКАЦИЯ =====
document.getElementById('go-register').addEventListener('click', () => {
    loginCard.classList.add('hidden');
    registerCard.classList.remove('hidden');
});

document.getElementById('go-login').addEventListener('click', () => {
    registerCard.classList.add('hidden');
    loginCard.classList.remove('hidden');
});

document.getElementById('login-form').addEventListener('submit', e => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const remember = document.getElementById('remember-me').checked;
    
    try {
        const user = userManager.login(email, password, remember);
        setUserUI(user);
        authOverlay.style.display = 'none';
        showNotification(`Добро пожаловать, ${user.name}!`, 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
});

document.getElementById('register-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const remember = document.getElementById('remember-reg').checked;
    
    if (!name || !email || !password) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    try {
        const user = userManager.register({ name, email, password }, remember);
        setUserUI(user);
        authOverlay.style.display = 'none';
        showNotification(`Аккаунт создан, добро пожаловать, ${user.name}!`, 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
});

function setUserUI(user) {
    const name = user.name || 'Гость';
    userNameTitle.textContent = name;
    
    if (user.role === 'admin') {
        userNameTitle.innerHTML = `${name} <i class="fas fa-crown" style="color: #f97316;"></i>`;
    }
    
    quickLogoutBtn.classList.remove('hidden');
    
    // Обновляем данные интерфейса
    loadProfileData();
    updateProfileStats();
    loadProject();
    renderSavedUserList();
}

// ===== СОХРАНЕННЫЕ ПРОФИЛИ =====
function renderSavedUserList() {
    const userList = document.getElementById('user-list');
    const savedProfiles = userManager.savedProfiles;
    
    userList.innerHTML = '';
    
    if (savedProfiles.length === 0) {
        userList.innerHTML = '<p class="no-users">Нет сохраненных профилей</p>';
        return;
    }
    
    savedProfiles.forEach(profile => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        
        const avatarLetter = profile.name ? profile.name.charAt(0).toUpperCase() : 'U';
        
        userItem.innerHTML = `
            <div class="user-avatar">${avatarLetter}</div>
            <div class="user-info">
                <div class="user-name">${profile.name}</div>
                <div class="user-email">${profile.email}</div>
            </div>
            <button class="user-remove" data-email="${profile.email}" title="Удалить профиль">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        userList.appendChild(userItem);
        
        userItem.addEventListener('click', e => {
            if (!e.target.closest('.user-remove')) {
                document.getElementById('login-email').value = profile.email;
                document.getElementById('login-password').focus();
            }
        });
        
        const removeBtn = userItem.querySelector('.user-remove');
        removeBtn.addEventListener('click', e => {
            e.stopPropagation();
            if (confirm(`Удалить профиль ${profile.name}?`)) {
                userManager.removeSavedProfile(profile.email);
                renderSavedUserList();
                showNotification('Профиль удален из сохраненных', 'info');
            }
        });
    });
}

function renderSavedProfiles() {
    const profilesList = document.getElementById('profiles-list');
    const savedProfiles = userManager.savedProfiles;
    
    profilesList.innerHTML = '';
    
    if (savedProfiles.length === 0) {
        profilesList.innerHTML = '<p class="no-profiles">Нет сохраненных профилей для быстрого входа</p>';
        return;
    }
    
    savedProfiles.forEach(profile => {
        const user = userManager.getUserByEmail(profile.email);
        if (!user) return;
        
        const profileItem = document.createElement('div');
        profileItem.className = 'profile-item';
        
        const avatarLetter = user.name ? user.name.charAt(0).toUpperCase() : 'U';
        const lastLogin = profile.lastLogin ? new Date(profile.lastLogin).toLocaleDateString('ru-RU') : 'Неизвестно';
        
        profileItem.innerHTML = `
            <div class="profile-item-header">
                <div class="profile-item-avatar">
                    ${user.avatar ? `<img src="${user.avatar}" alt="${user.name}">` : avatarLetter}
                </div>
                <div class="profile-item-info">
                    <h3>${user.name}</h3>
                    <p>${user.email}</p>
                </div>
            </div>
            <div class="profile-item-details">
                <p><i class="fas fa-calendar-alt"></i> Последний вход: ${lastLogin}</p>
                <p><i class="fas fa-user-tag"></i> Роль: ${user.role === 'admin' ? 'Администратор' : 'Клиент'}</p>
            </div>
            <div class="profile-item-actions">
                <button class="profile-item-btn login-profile-btn" data-email="${profile.email}">
                    <i class="fas fa-sign-in-alt"></i> Быстрый вход
                </button>
                <button class="profile-item-btn remove-profile-btn" data-email="${profile.email}">
                    <i class="fas fa-trash"></i> Удалить
                </button>
            </div>
        `;
        
        profilesList.appendChild(profileItem);
    });
    
    document.querySelectorAll('.login-profile-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const email = this.dataset.email;
            quickLogin(email);
        });
    });
    
    document.querySelectorAll('.remove-profile-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const email = this.dataset.email;
            if (confirm(`Удалить профиль из сохраненных?`)) {
                userManager.removeSavedProfile(email);
                renderSavedProfiles();
                renderSavedUserList();
                showNotification('Профиль удален из сохраненных', 'info');
            }
        });
    });
}

function quickLogin(email) {
    const user = userManager.getUserByEmail(email);
    
    if (!user) {
        showNotification('Пользователь не найден', 'error');
        return;
    }
    
    const password = prompt(`Введите пароль для ${user.name}:`);
    if (!password) return;
    
    try {
        const loggedInUser = userManager.login(user.email, password, true);
        setUserUI(loggedInUser);
        authOverlay.style.display = 'none';
        showNotification(`Добро пожаловать, ${loggedInUser.name}!`, 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// ===== КАТАЛОГ =====
function setupCatalogCards() {
    document.querySelectorAll('.add-btn').forEach(btn => {
        if (!btn.hasAttribute('data-listener')) {
            btn.setAttribute('data-listener', 'true');
            btn.addEventListener('click', addToProject);
        }
    });

    document.querySelectorAll('.compare-btn').forEach(btn => {
        if (!btn.hasAttribute('data-listener')) {
            btn.setAttribute('data-listener', 'true');
            btn.addEventListener('click', addToCompare);
        }
    });
}

function setupCatalog(section) {
    const grid = section.querySelector('.catalog-grid');
    if (!grid) return;

    const cards = Array.from(grid.querySelectorAll('.part-card'));
    const categorySelect = section.querySelector('.filter-category');
    const sortSelect = section.querySelector('.filter-sort');
    const initialOrder = cards.slice();

    function applyFilters() {
        const typeValue = categorySelect ? categorySelect.value : 'all';
        let currentCards = initialOrder.slice();

        if (typeValue !== 'all') {
            currentCards = currentCards.filter(card => card.dataset.type === typeValue);
        }

        const sortValue = sortSelect ? sortSelect.value : 'default';
        if (sortValue === 'asc' || sortValue === 'desc') {
            currentCards.sort((a, b) => {
                const pa = Number(a.dataset.price);
                const pb = Number(b.dataset.price);
                return sortValue === 'asc' ? pa - pb : pb - pa;
            });
        }

        grid.innerHTML = '';
        currentCards.forEach(card => grid.appendChild(card));
        setupCatalogCards();
    }

    if (categorySelect) categorySelect.addEventListener('change', applyFilters);
    if (sortSelect) sortSelect.addEventListener('change', applyFilters);
    applyFilters();
}

document.querySelectorAll('[data-category]').forEach(setupCatalog);

// ===== ПРОЕКТЫ =====
function loadProject() {
    const currentUser = userManager.getCurrentUser();
    if (!currentUser) return;
    
    const saved = localStorage.getItem(`pt_project_${currentUser.id}`);
    if (saved) {
        try {
            const data = JSON.parse(saved);
            projectParts = data.parts || [];
            document.getElementById('labor-input').value = data.labor || 0;
            renderProject();
        } catch (e) {
            console.error('Ошибка загрузки проекта:', e);
        }
    }
}

function saveProject() {
    const currentUser = userManager.getCurrentUser();
    if (!currentUser) return;
    
    const projectData = {
        parts: projectParts,
        labor: Number(document.getElementById('labor-input').value) || 0,
        timestamp: new Date().toISOString()
    };
    
    localStorage.setItem(`pt_project_${currentUser.id}`, JSON.stringify(projectData));
}

function renderProject() {
    const projectItems = document.getElementById('project-items');
    if (!projectItems) return;
    
    projectItems.innerHTML = '';
    let partsSum = 0;

    projectParts.forEach((part, index) => {
        partsSum += part.price;
        const li = document.createElement('li');
        li.innerHTML = `
            <span><strong>${part.name}</strong></span>
            <span>${part.price.toLocaleString('ru-RU')} ₽</span>
            <button class="remove-part" data-index="${index}"><i class="fas fa-times"></i></button>
        `;
        projectItems.appendChild(li);
    });

    document.querySelectorAll('.remove-part').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            projectParts.splice(index, 1);
            saveProject();
            renderProject();
            updatePaymentAmount();
        });
    });

    document.getElementById('parts-count').textContent = projectParts.length;
    document.getElementById('parts-sum').textContent = partsSum.toLocaleString('ru-RU');
    const labor = Number(document.getElementById('labor-input').value) || 0;
    const total = partsSum + labor;
    document.getElementById('total-sum').textContent = total.toLocaleString('ru-RU');

    updatePaymentAmount();
    saveProject();
}

function addToProject(e) {
    const card = e.target.closest('.part-card');
    const name = card.dataset.name;
    const price = Number(card.dataset.price);
    const type = card.dataset.type;
    
    projectParts.push({ name, price, type });
    renderProject();
    showNotification(`"${name}" добавлен в проект`, 'success');
}

document.getElementById('labor-input').addEventListener('input', () => {
    renderProject();
    updatePaymentAmount();
});

document.getElementById('clear-project').addEventListener('click', () => {
    if (projectParts.length > 0 && confirm('Очистить проект?')) {
        projectParts = [];
        document.getElementById('labor-input').value = 0;
        renderProject();
        showNotification('Проект очищен', 'info');
    }
});

document.getElementById('export-estimate').addEventListener('click', () => {
    if (projectParts.length === 0) {
        showNotification('Добавьте детали в проект', 'warning');
        return;
    }
    
    const currentUser = userManager.getCurrentUser();
    if (!currentUser) return;
    
    const saved = {
        date: new Date().toLocaleString('ru-RU'),
        userId: currentUser.id,
        userName: currentUser.name,
        parts: projectParts,
        labor: Number(document.getElementById('labor-input').value) || 0,
        total: Number(document.getElementById('total-sum').textContent.replace(/\s/g, '')) || 0
    };
    
    // Сохраняем историю
    const history = JSON.parse(localStorage.getItem(`pt_projects_history_${currentUser.id}`) || '[]');
    history.unshift(saved);
    if (history.length > 10) history.pop();
    localStorage.setItem(`pt_projects_history_${currentUser.id}`, JSON.stringify(history));
    
    // На сервере
    if (window.virtualServer) {
        window.virtualServer.addProject(saved);
    }
    
    // Обновляем статистику
    const userStats = userManager.getUserStats(currentUser.id);
    userManager.updateUserStats(currentUser.id, {
        projects: (userStats?.projects || 0) + 1
    });
    
    // Создаем файл
    let estimateText = `Смета PriorLab\n`;
    estimateText += `Дата: ${saved.date}\n`;
    estimateText += `Клиент: ${saved.userName}\n`;
    estimateText += `========================\n\n`;
    estimateText += `Детали:\n`;
    saved.parts.forEach(part => {
        estimateText += `  • ${part.name}: ${part.price.toLocaleString('ru-RU')} ₽\n`;
    });
    estimateText += `\nРабота: ${saved.labor.toLocaleString('ru-RU')} ₽\n`;
    estimateText += `========================\n`;
    estimateText += `Итого: ${saved.total.toLocaleString('ru-RU')} ₽\n`;
    
    const blob = new Blob([estimateText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Смета_${currentUser.name}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Смета сохранена', 'success');
});

// ===== ОПЛАТА =====
function updatePaymentAmount() {
    const payAmountInput = document.getElementById('pay-amount');
    if (payAmountInput) {
        const total = Number(document.getElementById('total-sum').textContent.replace(/\s/g, '')) || 0;
        payAmountInput.value = total;
    }
}

document.getElementById('pay-btn').addEventListener('click', () => {
    if (projectParts.length === 0) {
        showNotification('Добавьте детали в проект', 'warning');
        return;
    }
    
    document.getElementById('payment-block').classList.remove('hidden');
    updatePaymentAmount();
});

document.getElementById('cancel-payment').addEventListener('click', () => {
    document.getElementById('payment-block').classList.add('hidden');
});

document.getElementById('payment-form').addEventListener('submit', e => {
    e.preventDefault();
    
    const amount = Number(document.getElementById('pay-amount').value) || 0;
    const cardNumber = document.getElementById('card-number').value.replace(/\s/g, '');
    
    if (cardNumber.length !== 16 || !/^\d+$/.test(cardNumber)) {
        showNotification('Введите корректный номер карты', 'error');
        return;
    }
    
    showNotification(`Оплата ${amount.toLocaleString('ru-RU')} ₽ успешна!`, 'success');
    
    const currentUser = userManager.getCurrentUser();
    if (currentUser) {
        const payment = {
            date: new Date().toLocaleString('ru-RU'),
            amount,
            project: projectParts,
            userId: currentUser.id,
            userName: currentUser.name
        };
        
        // Локально
        const payments = JSON.parse(localStorage.getItem(`pt_payments_${currentUser.id}`) || '[]');
        payments.push(payment);
        localStorage.setItem(`pt_payments_${currentUser.id}`, JSON.stringify(payments));
        
        // На сервере
        if (window.virtualServer) {
            window.virtualServer.addPayment(payment);
        }
        
        // Обновляем статистику
        const userStats = userManager.getUserStats(currentUser.id);
        userManager.updateUserStats(currentUser.id, {
            spent: (userStats?.spent || 0) + amount,
            level: Math.min(Math.floor(((userStats?.spent || 0) + amount) / 10000) + 1, 10)
        });
    }
    
    // Очищаем
    document.getElementById('payment-block').classList.add('hidden');
    document.getElementById('payment-form').reset();
    projectParts = [];
    document.getElementById('labor-input').value = 0;
    renderProject();
    
    showSection('profile');
});

// ===== СРАВНЕНИЕ =====
function addToCompare(e) {
    const card = e.target.closest('.part-card');
    const name = card.dataset.name;
    const price = card.dataset.price;
    const type = card.dataset.type;
    
    const attributes = {};
    for (const [key, value] of Object.entries(card.dataset)) {
        attributes[key] = value;
    }
    
    if (compareItems.some(item => item.name === name)) {
        showNotification('Деталь уже добавлена', 'warning');
        return;
    }
    
    if (compareItems.length >= 2) {
        showNotification('Можно сравнивать только 2 детали', 'warning');
        return;
    }
    
    compareItems.push({ name, price, type, attributes });
    renderCompare();
    showNotification(`"${name}" добавлен для сравнения`, 'success');
}

function renderCompare() {
    const compareItemsContainer = document.getElementById('compare-items');
    const compareTableContainer = document.getElementById('compare-table-container');
    
    compareItemsContainer.innerHTML = '';
    
    if (compareItems.length === 0) {
        compareItemsContainer.innerHTML = '<p class="empty-compare"><i class="fas fa-balance-scale"></i> Выберите детали для сравнения</p>';
        compareTableContainer.classList.add('hidden');
        return;
    }
    
    compareItems.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'compare-item';
        itemDiv.innerHTML = `
            <span>${item.name}</span>
            <button class="compare-item-remove" data-index="${index}"><i class="fas fa-times"></i></button>
        `;
        compareItemsContainer.appendChild(itemDiv);
    });
    
    document.querySelectorAll('.compare-item-remove').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            compareItems.splice(index, 1);
            renderCompare();
        });
    });
    
    if (compareItems.length === 2) {
        renderCompareTable();
        compareTableContainer.classList.remove('hidden');
    } else {
        compareTableContainer.classList.add('hidden');
    }
}

function renderCompareTable() {
    const compareHeader1 = document.getElementById('compare-header1');
    const compareHeader2 = document.getElementById('compare-header2');
    const compareBody = document.getElementById('compare-body');
    
    compareHeader1.textContent = compareItems[0].name;
    compareHeader2.textContent = compareItems[1].name;
    
    compareBody.innerHTML = '';
    
    // Базовые характеристики
    const baseAttrs = ['price', 'type', 'desc'];
    baseAttrs.forEach(attr => {
        const tr = document.createElement('tr');
        const attrName = attr === 'price' ? 'Цена' : 
                        attr === 'type' ? 'Категория' : 
                        attr === 'desc' ? 'Описание' : attr;
        
        let value1 = attr === 'price' ? `${compareItems[0][attr]} ₽` : compareItems[0][attr];
        let value2 = attr === 'price' ? `${compareItems[1][attr]} ₽` : compareItems[1][attr];
        
        tr.innerHTML = `
            <td>${attrName}</td>
            <td>${value1 || '-'}</td>
            <td>${value2 || '-'}</td>
        `;
        compareBody.appendChild(tr);
    });
    
    // Все остальные атрибуты
    const allAttrs = new Set();
    compareItems.forEach(item => {
        Object.keys(item.attributes).forEach(attr => {
            if (!baseAttrs.includes(attr) && !['name', 'price', 'type', 'desc'].includes(attr)) {
                allAttrs.add(attr);
            }
        });
    });
    
    allAttrs.forEach(attr => {
        const tr = document.createElement('tr');
        const attrName = getAttributeDisplayName(attr);
        const value1 = compareItems[0].attributes[attr] || '-';
        const value2 = compareItems[1].attributes[attr] || '-';
        
        tr.innerHTML = `
            <td>${attrName}</td>
            <td>${value1}</td>
            <td>${value2}</td>
        `;
        compareBody.appendChild(tr);
    });
}

function getAttributeDisplayName(attr) {
    const names = {
        'power': 'Мощность',
        'torque': 'Крутящий момент',
        'weight': 'Вес',
        'fuel': 'Топливо',
        'sound': 'Звук',
        'material': 'Материал',
        'turbo': 'Турбина',
        'install': 'Установка',
        'lowering': 'Понижение',
        'adjust': 'Регулировка',
        'comfort': 'Комфорт',
        'color': 'Цвет',
        'parts': 'Количество',
        'speakers': 'Динамики',
        'subwoofer': 'Сабвуфер',
        'control': 'Управление',
        'heating': 'Подогрев'
    };
    
    return names[attr] || attr;
}

document.getElementById('clear-compare').addEventListener('click', () => {
    compareItems = [];
    renderCompare();
    showNotification('Сравнение очищено', 'info');
});

// ===== ПРОФИЛЬ =====
function loadProfileData() {
    const currentUser = userManager.getCurrentUser();
    
    if (currentUser) {
        // Обновляем с сервера
        if (window.virtualServer) {
            const serverUser = window.virtualServer.getUserById(currentUser.id);
            if (serverUser) {
                Object.assign(currentUser, serverUser);
                localStorage.setItem('pt_current_user', JSON.stringify(currentUser));
            }
        }
        
        // Отображение
        document.getElementById('profile-name-display').textContent = currentUser.name;
        document.getElementById('profile-email-display').textContent = currentUser.email;
        document.getElementById('profile-phone-display').textContent = currentUser.phone || 'Не указан';
        document.getElementById('profile-city-display').textContent = currentUser.city || 'Не указан';
        document.getElementById('profile-car-display').textContent = currentUser.car || 'Не указан';
        document.getElementById('profile-experience-display').textContent = currentUser.experience || 'Не указан';
        document.getElementById('profile-regdate').textContent = currentUser.regDate || '-';
        
        // Форма редактирования
        document.getElementById('profile-name-edit').value = currentUser.name;
        document.getElementById('profile-email-edit').value = currentUser.email;
        document.getElementById('profile-phone-edit').value = currentUser.phone || '';
        document.getElementById('profile-city-edit').value = currentUser.city || '';
        document.getElementById('profile-car-edit').value = currentUser.car || '';
        document.getElementById('profile-experience-edit').value = currentUser.experience || 'Новичок';
        
        // Аватар
        const avatarImg = document.getElementById('profile-avatar-img');
        const avatarLetter = document.getElementById('avatar-letter');
        const avatarPreview = document.getElementById('profile-avatar-preview');
        const avatarLetterEdit = document.getElementById('avatar-letter-edit');
        
        if (currentUser.avatar) {
            avatarImg.src = currentUser.avatar;
            avatarImg.style.display = 'block';
            avatarLetter.style.display = 'none';
            
            avatarPreview.src = currentUser.avatar;
            avatarPreview.style.display = 'block';
            avatarLetterEdit.style.display = 'none';
        } else {
            avatarImg.style.display = 'none';
            avatarLetter.style.display = 'flex';
            avatarLetter.textContent = currentUser.name.charAt(0).toUpperCase();
            
            avatarPreview.style.display = 'none';
            avatarLetterEdit.style.display = 'flex';
            avatarLetterEdit.textContent = currentUser.name.charAt(0).toUpperCase();
        }
        
        // Бейдж админа
        document.getElementById('admin-badge').style.display = currentUser.role === 'admin' ? 'flex' : 'none';
    }
}

function updateProfileStats() {
    const currentUser = userManager.getCurrentUser();
    if (!currentUser) return;
    
    let projects = [];
    let payments = [];
    let chat = [];
    
    if (window.virtualServer) {
        projects = window.virtualServer.getUserProjects(currentUser.id);
        payments = window.virtualServer.getUserPayments(currentUser.id);
        chat = window.virtualServer.getChatMessages(currentUser.id);
    } else {
        projects = JSON.parse(localStorage.getItem(`pt_projects_history_${currentUser.id}`) || '[]');
        payments = JSON.parse(localStorage.getItem(`pt_payments_${currentUser.id}`) || '[]');
        chat = JSON.parse(localStorage.getItem('pt_chat') || '[]');
        chat = chat.filter(m => m.userId === currentUser.id || m.from === 'admin');
    }
    
    document.getElementById('projects-count').textContent = projects.length;
    
    const totalSpent = payments.reduce((sum, p) => sum + p.amount, 0);
    document.getElementById('total-spent').textContent = totalSpent.toLocaleString('ru-RU') + ' ₽';
    
    document.getElementById('messages-count').textContent = chat.length;
    
    const userStats = userManager.getUserStats(currentUser.id);
    document.getElementById('user-level').textContent = userStats?.level || 1;
    
    // История проектов
    if (projects.length > 0) {
        const historyContainer = document.querySelector('.projects-history');
        const historyList = document.getElementById('projects-history-list');
        
        historyContainer.classList.remove('hidden');
        historyList.innerHTML = '';
        
        projects.slice(0, 5).forEach(project => {
            const projectDiv = document.createElement('div');
            projectDiv.className = 'history-item';
            projectDiv.innerHTML = `
                <h3>Проект от ${project.date}</h3>
                <div class="history-details">
                    <p><i class="fas fa-cogs"></i> Деталей: ${project.parts?.length || 0}</p>
                    <p><i class="fas fa-tools"></i> Работа: ${(project.labor || 0).toLocaleString('ru-RU')} ₽</p>
                </div>
                <div class="history-total">Итого: ${(project.total || 0).toLocaleString('ru-RU')} ₽</div>
            `;
            historyList.appendChild(projectDiv);
        });
    }
}

// Редактирование профиля
document.getElementById('edit-profile-btn').addEventListener('click', () => {
    document.getElementById('profile-display').classList.add('hidden');
    document.getElementById('profile-edit-form').classList.remove('hidden');
});

document.getElementById('cancel-edit-btn').addEventListener('click', () => {
    document.getElementById('profile-display').classList.remove('hidden');
    document.getElementById('profile-edit-form').classList.add('hidden');
    loadProfileData();
});

document.getElementById('profile-avatar-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showNotification('Выберите изображение', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const imgData = e.target.result;
        
        document.getElementById('profile-avatar-preview').src = imgData;
        document.getElementById('profile-avatar-preview').style.display = 'block';
        document.getElementById('avatar-letter-edit').style.display = 'none';
        
        const currentUser = userManager.getCurrentUser();
        if (currentUser) {
            currentUser.avatar = imgData;
            userManager.updateUser(currentUser);
            
            document.getElementById('profile-avatar-img').src = imgData;
            document.getElementById('profile-avatar-img').style.display = 'block';
            document.getElementById('avatar-letter').style.display = 'none';
        }
    };
    reader.readAsDataURL(file);
});

document.getElementById('remove-avatar').addEventListener('click', () => {
    const currentUser = userManager.getCurrentUser();
    if (currentUser) {
        currentUser.avatar = null;
        userManager.updateUser(currentUser);
        
        document.getElementById('profile-avatar-img').style.display = 'none';
        document.getElementById('avatar-letter').style.display = 'flex';
        document.getElementById('avatar-letter').textContent = currentUser.name.charAt(0).toUpperCase();
        
        document.getElementById('profile-avatar-preview').style.display = 'none';
        document.getElementById('avatar-letter-edit').style.display = 'flex';
        document.getElementById('avatar-letter-edit').textContent = currentUser.name.charAt(0).toUpperCase();
    }
});

document.getElementById('profile-edit-form').addEventListener('submit', e => {
    e.preventDefault();
    
    const currentUser = userManager.getCurrentUser();
    if (!currentUser) return;
    
    currentUser.name = document.getElementById('profile-name-edit').value.trim();
    currentUser.phone = document.getElementById('profile-phone-edit').value.trim();
    currentUser.city = document.getElementById('profile-city-edit').value.trim();
    currentUser.car = document.getElementById('profile-car-edit').value.trim();
    currentUser.experience = document.getElementById('profile-experience-edit').value;
    
    userManager.updateUser(currentUser);
    
    setUserUI(currentUser);
    loadProfileData();
    
    document.getElementById('profile-display').classList.remove('hidden');
    document.getElementById('profile-edit-form').classList.add('hidden');
    
    showNotification('Профиль сохранен', 'success');
});

document.getElementById('clear-all-profiles').addEventListener('click', () => {
    if (confirm('Удалить все сохраненные профили?')) {
        userManager.clearSavedProfiles();
        renderSavedProfiles();
        renderSavedUserList();
        showNotification('Все профили удалены', 'info');
    }
});

// Выход
document.getElementById('logout-btn').addEventListener('click', logoutUser);
document.getElementById('quick-logout').addEventListener('click', logoutUser);

function logoutUser() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        userManager.logout();
        authOverlay.style.display = 'flex';
        projectParts = [];
        renderProject();
        userNameTitle.textContent = 'Гость';
        quickLogoutBtn.classList.add('hidden');
        showNotification('Вы вышли из системы', 'info');
    }
}

// ===== ЧАТ ПОДДЕРЖКИ =====
function loadChatMessages() {
    let chat = [];
    const currentUser = userManager.getCurrentUser();
    
    if (window.virtualServer) {
        if (currentUser && currentUser.role === 'admin') {
            chat = window.virtualServer.getAllData().chat || [];
        } else {
            chat = window.virtualServer.getChatMessages(currentUser?.id) || [];
        }
    } else {
        chat = JSON.parse(localStorage.getItem('pt_chat') || '[]');
        if (currentUser && currentUser.role !== 'admin') {
            chat = chat.filter(m => m.userId === currentUser.id || m.from === 'admin');
        }
    }
    
    const chatWindow = document.getElementById('chat-window');
    chatWindow.innerHTML = '';
    
    if (chat.length === 0) {
        chatWindow.innerHTML = `
            <div class="chat-placeholder">
                <i class="fas fa-comment-dots"></i>
                <p>Здесь будут отображаться ваши сообщения с поддержкой</p>
            </div>
        `;
    } else {
        chat.forEach(msg => {
            const div = document.createElement('div');
            div.classList.add('chat-message');
            div.classList.add(msg.from === 'admin' ? 'chat-message-admin' : 'chat-message-user');
            
            const time = new Date(msg.timestamp).toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const userName = msg.from === 'admin' ? 'Админ' : msg.userName || 'Клиент';
            
            div.innerHTML = `
                <div>${msg.text}</div>
                <div class="chat-meta">
                    <span>${userName}</span>
                    <span>${time}</span>
                </div>
            `;
            chatWindow.appendChild(div);
        });
        
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
    
    // Элементы управления
    const adminControls = document.getElementById('admin-controls');
    const userControls = document.getElementById('user-controls');
    
    if (currentUser && currentUser.role === 'admin') {
        adminControls.classList.remove('hidden');
        userControls.classList.add('hidden');
    } else {
        adminControls.classList.add('hidden');
        userControls.classList.remove('hidden');
    }
}

document.getElementById('support-form').addEventListener('submit', e => {
    e.preventDefault();
    const topic = document.getElementById('support-topic').value.trim();
    const message = document.getElementById('support-message').value.trim();
    const currentUser = userManager.getCurrentUser();
    
    if (!topic || !message) {
        showNotification('Заполните все поля', 'warning');
        return;
    }
    
    if (!currentUser) {
        showNotification('Войдите в систему', 'error');
        return;
    }
    
    const chatMessage = {
        from: 'user',
        userId: currentUser.id,
        userName: currentUser.name,
        text: `Тема: ${topic}\n${message}`,
        timestamp: new Date().toISOString()
    };
    
    // На сервере
    if (window.virtualServer) {
        window.virtualServer.addChatMessage(chatMessage);
    }
    
    // Локально
    const chat = JSON.parse(localStorage.getItem('pt_chat') || '[]');
    chat.push(chatMessage);
    localStorage.setItem('pt_chat', JSON.stringify(chat));
    
    // Статистика
    const userStats = userManager.getUserStats(currentUser.id);
    userManager.updateUserStats(currentUser.id, {
        messages: (userStats?.messages || 0) + 1
    });
    
    loadChatMessages();
    e.target.reset();
    showNotification('Сообщение отправлено', 'success');
});

document.getElementById('admin-send').addEventListener('click', () => {
    const text = document.getElementById('admin-answer-text').value.trim();
    const currentUser = userManager.getCurrentUser();
    
    if (!text) return;
    
    if (!currentUser || currentUser.role !== 'admin') {
        showNotification('Только для администратора', 'error');
        return;
    }
    
    const chatMessage = {
        from: 'admin',
        text: text,
        timestamp: new Date().toISOString()
    };
    
    // На сервере
    if (window.virtualServer) {
        window.virtualServer.addChatMessage(chatMessage);
    }
    
    // Локально
    const chat = JSON.parse(localStorage.getItem('pt_chat') || '[]');
    chat.push(chatMessage);
    localStorage.setItem('pt_chat', JSON.stringify(chat));
    
    loadChatMessages();
    document.getElementById('admin-answer-text').value = '';
    showNotification('Ответ отправлен', 'success');
});

// ===== УВЕДОМЛЕНИЯ =====
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close"><i class="fas fa-times"></i></button>
    `;
    
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                background: rgba(15, 23, 42, 0.95);
                border: 1px solid rgba(55, 65, 81, 0.8);
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
                z-index: 1000;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 15px;
                max-width: 350px;
                animation: slideIn 0.3s ease;
                backdrop-filter: blur(10px);
            }
            
            .notification-info { border-left: 4px solid #38bdf8; }
            .notification-success { border-left: 4px solid #22c55e; }
            .notification-warning { border-left: 4px solid #f97316; }
            .notification-error { border-left: 4px solid #ef4444; }
            
            .notification-content {
                display: flex;
                align-items: center;
                gap: 10px;
                flex: 1;
            }
            
            .notification-content i {
                font-size: 18px;
            }
            
            .notification-info i { color: #38bdf8; }
            .notification-success i { color: #22c55e; }
            .notification-warning i { color: #f97316; }
            .notification-error i { color: #ef4444; }
            
            .notification-close {
                background: none;
                border: none;
                color: #9ca3af;
                cursor: pointer;
                font-size: 14px;
            }
            
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.remove();
    });
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

function getNotificationIcon(type) {
    switch(type) {
        case 'success': return 'check-circle';
        case 'warning': return 'exclamation-triangle';
        case 'error': return 'times-circle';
        default: return 'info-circle';
    }
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
(function init() {
    // Проверяем текущего пользователя
    const currentUser = userManager.getCurrentUser();
    if (currentUser) {
        setUserUI(currentUser);
        authOverlay.style.display = 'none';
    } else {
        authOverlay.style.display = 'flex';
    }
    
    // Отображаем сохраненные профили
    renderSavedUserList();
    
    // Настраиваем карточки каталога
    setupCatalogCards();
    
    // Загружаем проект
    loadProject();
    
    // Загружаем чат
    loadChatMessages();
    
    // Показываем главную страницу
    showSection('home', false);
    
    console.log('Приложение инициализировано с синхронизацией');
})();
