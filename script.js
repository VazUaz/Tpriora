// ===== КЛАСС ДЛЯ ОБЛАЧНОЙ СИНХРОНИЗАЦИИ =====
class CloudSync {
    constructor() {
        this.API_URL = 'https://api.jsonbin.io/v3/b'; // JSONBin.io API
        this.MASTER_KEY = '$2a$10$UzK9q6X1F8H9LkM5pQwZTuJcRgVlN8sYtBvC2dE3fG4hI5jK6lM7nO8p'; // Пример ключа
        this.BIN_ID = null; // ID бина будет создаваться при первом сохранении
        this.SYNC_INTERVAL = 30000; // 30 секунд
        this.isSyncing = false;
        this.lastSyncTime = null;
        this.syncInterval = null;
        this.init();
    }

    async init() {
        // Загружаем ID бина из localStorage или создаем новый
        const savedBinId = localStorage.getItem('pt_cloud_bin_id');
        
        if (savedBinId) {
            this.BIN_ID = savedBinId;
            console.log('Используем существующий бин:', this.BIN_ID);
        } else {
            // Пробуем создать новый бин при инициализации
            await this.createNewBin();
        }
        
        // Загружаем данные из облака
        await this.loadFromCloud();
        
        // Запускаем автоматическую синхронизацию
        this.startAutoSync();
        
        // Слушаем события изменения данных
        this.setupDataListeners();
    }

    async createNewBin() {
        try {
            const initialData = {
                users: [],
                chat: [],
                payments: [],
                syncInfo: {
                    created: new Date().toISOString(),
                    lastSync: new Date().toISOString(),
                    device: navigator.userAgent.substring(0, 100)
                }
            };

            const response = await fetch(this.API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.MASTER_KEY,
                    'X-Bin-Name': 'PriorLab Cloud Data'
                },
                body: JSON.stringify(initialData)
            });

            if (!response.ok) throw new Error('Ошибка создания облачного хранилища');

            const data = await response.json();
            this.BIN_ID = data.metadata.id;
            localStorage.setItem('pt_cloud_bin_id', this.BIN_ID);
            
            console.log('Создан новый облачный бин:', this.BIN_ID);
            return true;
        } catch (error) {
            console.error('Ошибка создания облачного хранилища:', error);
            this.showCloudNotification('Не удалось создать облачное хранилище', 'error');
            return false;
        }
    }

    async saveToCloud(dataToSave = null) {
        if (this.isSyncing) return false;
        
        this.isSyncing = true;
        this.updateSyncStatus('Сохранение в облако...', 'syncing');
        
        try {
            // Получаем текущие данные из localStorage
            const localData = dataToSave || this.getAllLocalData();
            
            // Добавляем информацию о синхронизации
            localData.syncInfo = {
                lastSync: new Date().toISOString(),
                syncDevice: navigator.userAgent.substring(0, 100),
                totalUsers: localData.users.length,
                totalMessages: localData.chat.length
            };

            if (!this.BIN_ID) {
                const created = await this.createNewBin();
                if (!created) throw new Error('Не удалось создать облачное хранилище');
            }

            const response = await fetch(`${this.API_URL}/${this.BIN_ID}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': this.MASTER_KEY
                },
                body: JSON.stringify(localData)
            });

            if (!response.ok) throw new Error('Ошибка сохранения в облако');

            const result = await response.json();
            this.lastSyncTime = new Date();
            this.updateSyncStatus('Синхронизировано', 'synced');
            
            console.log('Данные сохранены в облако:', result);
            this.showCloudNotification('Данные синхронизированы с облаком', 'success');
            return true;
        } catch (error) {
            console.error('Ошибка сохранения в облако:', error);
            this.updateSyncStatus('Ошибка синхронизации', 'error');
            this.showCloudNotification('Ошибка синхронизации с облаком', 'error');
            return false;
        } finally {
            this.isSyncing = false;
        }
    }

    async loadFromCloud() {
        if (!this.BIN_ID) {
            console.log('Нет ID бина для загрузки');
            return false;
        }

        this.isSyncing = true;
        this.updateSyncStatus('Загрузка из облака...', 'syncing');
        
        try {
            const response = await fetch(`${this.API_URL}/${this.BIN_ID}/latest`, {
                headers: {
                    'X-Master-Key': this.MASTER_KEY
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    console.log('Бин не найден, создаем новый');
                    await this.createNewBin();
                    return false;
                }
                throw new Error('Ошибка загрузки из облака');
            }

            const data = await response.json();
            const cloudData = data.record;
            
            console.log('Данные загружены из облака:', cloudData);
            
            // Объединяем облачные данные с локальными
            this.mergeCloudData(cloudData);
            
            this.lastSyncTime = new Date();
            this.updateSyncStatus('Загружено из облака', 'synced');
            this.showCloudNotification('Данные загружены из облака', 'success');
            return true;
        } catch (error) {
            console.error('Ошибка загрузки из облака:', error);
            this.updateSyncStatus('Ошибка загрузки', 'error');
            this.showCloudNotification('Ошибка загрузки из облака', 'error');
            return false;
        } finally {
            this.isSyncing = false;
        }
    }

    getAllLocalData() {
        // Собираем все данные из localStorage
        const users = JSON.parse(localStorage.getItem('pt_users') || '[]');
        const savedProfiles = JSON.parse(localStorage.getItem('pt_saved_profiles') || '[]');
        const chat = JSON.parse(localStorage.getItem('pt_chat') || '[]');
        
        // Собираем все проекты пользователей
        const projects = {};
        const payments = {};
        
        users.forEach(user => {
            const userProjects = JSON.parse(localStorage.getItem(`pt_projects_history_${user.id}`) || '[]');
            const userPayments = JSON.parse(localStorage.getItem(`pt_payments_${user.id}`) || '[]');
            
            if (userProjects.length > 0) {
                projects[user.id] = userProjects;
            }
            
            if (userPayments.length > 0) {
                payments[user.id] = userPayments;
            }
        });

        return {
            users,
            savedProfiles,
            chat,
            projects,
            payments,
            syncInfo: {
                lastLocalSave: new Date().toISOString(),
                deviceCount: this.countDevices(),
                dataVersion: '1.0'
            }
        };
    }

    mergeCloudData(cloudData) {
        // Объединяем пользователей
        const localUsers = JSON.parse(localStorage.getItem('pt_users') || '[]');
        const cloudUsers = cloudData.users || [];
        
        // Объединяем массивы, избегая дубликатов по email
        const mergedUsers = this.mergeArrays(localUsers, cloudUsers, 'email');
        localStorage.setItem('pt_users', JSON.stringify(mergedUsers));
        
        // Объединяем сохраненные профили
        const localProfiles = JSON.parse(localStorage.getItem('pt_saved_profiles') || '[]');
        const cloudProfiles = cloudData.savedProfiles || [];
        const mergedProfiles = this.mergeArrays(localProfiles, cloudProfiles, 'email');
        localStorage.setItem('pt_saved_profiles', JSON.stringify(mergedProfiles));
        
        // Объединяем чат (все сообщения)
        const localChat = JSON.parse(localStorage.getItem('pt_chat') || '[]');
        const cloudChat = cloudData.chat || [];
        const mergedChat = this.mergeArrays(localChat, cloudChat, 'timestamp', true);
        localStorage.setItem('pt_chat', JSON.stringify(mergedChat));
        
        // Объединяем проекты и платежи
        if (cloudData.projects) {
            Object.entries(cloudData.projects).forEach(([userId, userProjects]) => {
                const localProjects = JSON.parse(localStorage.getItem(`pt_projects_history_${userId}`) || '[]');
                const merged = this.mergeArrays(localProjects, userProjects, 'date', true);
                localStorage.setItem(`pt_projects_history_${userId}`, JSON.stringify(merged));
            });
        }
        
        if (cloudData.payments) {
            Object.entries(cloudData.payments).forEach(([userId, userPayments]) => {
                const localPayments = JSON.parse(localStorage.getItem(`pt_payments_${userId}`) || '[]');
                const merged = this.mergeArrays(localPayments, userPayments, 'date', true);
                localStorage.setItem(`pt_payments_${userId}`, JSON.stringify(merged));
            });
        }
        
        console.log('Данные успешно объединены');
    }

    mergeArrays(localArray, cloudArray, uniqueKey, preferNewer = false) {
        const mergedMap = new Map();
        
        // Добавляем локальные элементы
        localArray.forEach(item => {
            const key = item[uniqueKey] || JSON.stringify(item);
            mergedMap.set(key, item);
        });
        
        // Добавляем облачные элементы
        cloudArray.forEach(item => {
            const key = item[uniqueKey] || JSON.stringify(item);
            const existing = mergedMap.get(key);
            
            if (!existing) {
                mergedMap.set(key, item);
            } else if (preferNewer && item.timestamp && existing.timestamp) {
                // Если предпочитаем более новые, сравниваем временные метки
                const existingTime = new Date(existing.timestamp).getTime();
                const newTime = new Date(item.timestamp).getTime();
                
                if (newTime > existingTime) {
                    mergedMap.set(key, item);
                }
            }
        });
        
        return Array.from(mergedMap.values());
    }

    countDevices() {
        // Простая эмуляция подсчета устройств
        const devices = JSON.parse(localStorage.getItem('pt_sync_devices') || '[]');
        const currentDevice = {
            userAgent: navigator.userAgent.substring(0, 100),
            lastSeen: new Date().toISOString()
        };
        
        // Добавляем текущее устройство если его нет
        const exists = devices.some(device => 
            device.userAgent === currentDevice.userAgent
        );
        
        if (!exists) {
            devices.push(currentDevice);
            localStorage.setItem('pt_sync_devices', JSON.stringify(devices));
        }
        
        return devices.length;
    }

    updateSyncStatus(text, status = 'syncing') {
        const syncElement = document.getElementById('sync-status');
        const syncText = document.getElementById('sync-text');
        const globalSync = document.getElementById('global-sync-status');
        const globalText = document.getElementById('global-sync-text');
        
        if (syncElement && syncText) {
            syncText.textContent = text;
            syncElement.className = `sync-status ${status}`;
        }
        
        if (globalSync && globalText) {
            globalText.textContent = text.substring(0, 10);
            globalSync.className = `global-sync-status ${status}`;
        }
    }

    showCloudNotification(message, type = 'info') {
        const container = document.getElementById('notifications-container') || document.body;
        
        const notification = document.createElement('div');
        notification.className = `cloud-notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-cloud"></i>
            <div>
                <strong>Облачная синхронизация</strong>
                <p>${message}</p>
            </div>
            <button class="notification-close"><i class="fas fa-times"></i></button>
        `;
        
        container.appendChild(notification);
        
        // Автоматическое закрытие через 5 секунд
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
        
        // Кнопка закрытия
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
    }

    startAutoSync() {
        // Останавливаем предыдущий интервал если есть
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        
        // Запускаем синхронизацию каждые SYNC_INTERVAL миллисекунд
        this.syncInterval = setInterval(async () => {
            await this.loadFromCloud();
            await this.saveToCloud();
        }, this.SYNC_INTERVAL);
        
        // Также синхронизируем при видимости страницы
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.loadFromCloud();
            }
        });
    }

    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }

    setupDataListeners() {
        // Слушаем изменения в localStorage
        const originalSetItem = localStorage.setItem;
        const originalRemoveItem = localStorage.removeItem;
        
        const self = this;
        
        // Переопределяем setItem для автоматической синхронизации
        localStorage.setItem = function(key, value) {
            originalSetItem.call(this, key, value);
            
            // Автосинхронизация при изменении важных данных
            if (key.startsWith('pt_')) {
                self.saveToCloud();
            }
        };
        
        // Аналогично для removeItem
        localStorage.removeItem = function(key) {
            originalRemoveItem.call(this, key);
            
            if (key.startsWith('pt_')) {
                self.saveToCloud();
            }
        };
    }

    async forceSync() {
        await this.loadFromCloud();
        await this.saveToCloud();
    }

    async clearAllData() {
        if (confirm('ВНИМАНИЕ: Это удалит ВСЕ данные включая облачные. Продолжить?')) {
            try {
                // Очищаем localStorage
                const keys = Object.keys(localStorage);
                keys.forEach(key => {
                    if (key.startsWith('pt_')) {
                        localStorage.removeItem(key);
                    }
                });
                
                // Очищаем облачный бин
                if (this.BIN_ID) {
                    await fetch(`${this.API_URL}/${this.BIN_ID}`, {
                        method: 'DELETE',
                        headers: {
                            'X-Master-Key': this.MASTER_KEY
                        }
                    });
                }
                
                // Создаем новый чистый бин
                this.BIN_ID = null;
                localStorage.removeItem('pt_cloud_bin_id');
                await this.createNewBin();
                
                this.showCloudNotification('Все данные очищены', 'success');
                location.reload();
            } catch (error) {
                this.showCloudNotification('Ошибка очистки данных', 'error');
            }
        }
    }

    getCloudStats() {
        const data = this.getAllLocalData();
        return {
            totalUsers: data.users.length,
            totalMessages: data.chat.length,
            totalProjects: Object.values(data.projects || {}).reduce((sum, arr) => sum + arr.length, 0),
            totalPayments: Object.values(data.payments || {}).reduce((sum, arr) => sum + arr.length, 0),
            lastSync: this.lastSyncTime ? this.lastSyncTime.toLocaleString('ru-RU') : 'Никогда',
            binId: this.BIN_ID ? `${this.BIN_ID.substring(0, 8)}...` : 'Не создан'
        };
    }
}

// ===== ОБНОВЛЕННЫЙ КЛАСС USERMANAGER С ПОДДЕРЖКОЙ ОБЛАКА =====
class UserManager {
    constructor(cloudSync) {
        this.usersKey = 'pt_users';
        this.currentUserKey = 'pt_current_user';
        this.savedProfilesKey = 'pt_saved_profiles';
        this.cloudSync = cloudSync;
        this.users = this.loadUsers();
        this.savedProfiles = this.loadSavedProfiles();
    }

    loadUsers() {
        const data = localStorage.getItem(this.usersKey);
        return data ? JSON.parse(data) : [];
    }

    loadSavedProfiles() {
        const data = localStorage.getItem(this.savedProfilesKey);
        return data ? JSON.parse(data) : [];
    }

    saveUsers() {
        localStorage.setItem(this.usersKey, JSON.stringify(this.users));
        // Автосинхронизация с облаком
        if (this.cloudSync) {
            setTimeout(() => this.cloudSync.saveToCloud(), 1000);
        }
    }

    saveSavedProfiles() {
        localStorage.setItem(this.savedProfilesKey, JSON.stringify(this.savedProfiles));
        if (this.cloudSync) {
            setTimeout(() => this.cloudSync.saveToCloud(), 1000);
        }
    }

    // Регистрация нового пользователя
    register(userData, remember = true) {
        // Проверяем, существует ли пользователь с таким email
        if (this.users.some(u => u.email === userData.email)) {
            throw new Error('Пользователь с таким email уже зарегистрирован');
        }

        // Создаем нового пользователя
        const newUser = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9), // Уникальный ID
            name: userData.name,
            email: userData.email,
            password: userData.password,
            role: userData.email === 'admin@mail' ? 'admin' : 'client',
            regDate: new Date().toLocaleDateString('ru-RU'),
            regTimestamp: Date.now(),
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
            }
        };

        // Добавляем пользователя в список
        this.users.push(newUser);
        this.saveUsers();

        // Сохраняем профиль для быстрого входа, если выбрано "Запомнить меня"
        if (remember) {
            this.saveProfileForQuickLogin(newUser);
        }

        // Автосинхронизация
        if (this.cloudSync) {
            this.cloudSync.saveToCloud();
        }

        return newUser;
    }

    // Вход пользователя
    login(email, password, remember = true) {
        const user = this.users.find(u => u.email === email && u.password === password);
        
        if (!user) {
            throw new Error('Неверный email или пароль');
        }

        // Обновляем время последнего входа
        user.lastLogin = Date.now();
        this.saveUsers();

        // Сохраняем текущего пользователя
        localStorage.setItem(this.currentUserKey, JSON.stringify(user));

        // Сохраняем профиль для быстрого входа, если выбрано "Запомнить меня"
        if (remember) {
            this.saveProfileForQuickLogin(user);
        }

        return user;
    }

    // Сохранение профиля для быстрого входа
    saveProfileForQuickLogin(user) {
        // Создаем упрощенную версию пользователя для быстрого входа
        const savedProfile = {
            id: user.id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
            lastLogin: new Date().toISOString(),
            timestamp: Date.now()
        };

        // Проверяем, не сохранен ли уже этот профиль
        const existingIndex = this.savedProfiles.findIndex(p => p.email === user.email);
        
        if (existingIndex !== -1) {
            // Обновляем существующий профиль
            this.savedProfiles[existingIndex] = savedProfile;
        } else {
            // Добавляем новый профиль
            this.savedProfiles.push(savedProfile);
        }

        // Ограничиваем количество сохраненных профилей (максимум 5)
        if (this.savedProfiles.length > 5) {
            this.savedProfiles.shift();
        }

        this.saveSavedProfiles();
    }

    // Удаление профиля из сохраненных
    removeSavedProfile(email) {
        this.savedProfiles = this.savedProfiles.filter(p => p.email !== email);
        this.saveSavedProfiles();
    }

    // Очистка всех сохраненных профилей
    clearSavedProfiles() {
        this.savedProfiles = [];
        this.saveSavedProfiles();
    }

    // Получение текущего пользователя
    getCurrentUser() {
        const data = localStorage.getItem(this.currentUserKey);
        return data ? JSON.parse(data) : null;
    }

    // Выход пользователя
    logout() {
        localStorage.removeItem(this.currentUserKey);
    }

    // Обновление данных пользователя
    updateUser(updatedUser) {
        const index = this.users.findIndex(u => u.id === updatedUser.id);
        
        if (index !== -1) {
            // Сохраняем старый пароль, если новый не предоставлен
            if (!updatedUser.password) {
                updatedUser.password = this.users[index].password;
            }
            
            this.users[index] = updatedUser;
            this.saveUsers();
            
            // Обновляем сохраненный профиль для быстрого входа
            const savedProfileIndex = this.savedProfiles.findIndex(p => p.email === updatedUser.email);
            if (savedProfileIndex !== -1) {
                this.savedProfiles[savedProfileIndex].name = updatedUser.name;
                this.savedProfiles[savedProfileIndex].avatar = updatedUser.avatar;
                this.saveSavedProfiles();
            }
            
            // Если это текущий пользователь, обновляем его в localStorage
            const currentUser = this.getCurrentUser();
            if (currentUser && currentUser.id === updatedUser.id) {
                localStorage.setItem(this.currentUserKey, JSON.stringify(updatedUser));
            }
        }
    }

    // Получение пользователя по email
    getUserByEmail(email) {
        return this.users.find(u => u.email === email);
    }

    // Получение статистики пользователя
    getUserStats(userId) {
        const user = this.users.find(u => u.id === userId);
        return user ? user.stats : null;
    }

    // Обновление статистики пользователя
    updateUserStats(userId, statsUpdate) {
        const user = this.users.find(u => u.id === userId);
        
        if (user) {
            user.stats = { ...user.stats, ...statsUpdate };
            this.saveUsers();
            
            // Обновляем текущего пользователя, если это он
            const currentUser = this.getCurrentUser();
            if (currentUser && currentUser.id === userId) {
                currentUser.stats = user.stats;
                localStorage.setItem(this.currentUserKey, JSON.stringify(currentUser));
            }
        }
    }

    // Получение всех пользователей (для админа)
    getAllUsers() {
        return this.users;
    }

    // Получение администраторов
    getAdmins() {
        return this.users.filter(u => u.role === 'admin');
    }
}

// ===== ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ СИНХРОНИЗАЦИИ =====
let cloudSync;
let userManager;

async function initCloudSystem() {
    try {
        cloudSync = new CloudSync();
        userManager = new UserManager(cloudSync);
        
        // Настраиваем обработчики кнопок синхронизации
        document.getElementById('force-sync')?.addEventListener('click', () => {
            cloudSync.forceSync();
        });
        
        document.getElementById('clear-all-data')?.addEventListener('click', () => {
            cloudSync.clearAllData();
        });
        
        return { cloudSync, userManager };
    } catch (error) {
        console.error('Ошибка инициализации облачной системы:', error);
        // Создаем локальные менеджеры без облака
        userManager = new UserManager(null);
        return { cloudSync: null, userManager };
    }
}

// ===== ОБНОВЛЕННЫЕ ФУНКЦИИ ДЛЯ РАБОТЫ С ЧАТОМ (МЕЖПЛАТФОРМЕННЫМ) =====

function loadChatMessages() {
    const chat = JSON.parse(localStorage.getItem('pt_chat') || '[]');
    const currentUser = userManager.getCurrentUser();
    
    const chatWindow = document.getElementById('chat-window');
    if (!chatWindow) return;
    
    chatWindow.innerHTML = '';
    
    if (chat.length === 0) {
        chatWindow.innerHTML = `
            <div class="chat-placeholder">
                <i class="fas fa-comment-dots"></i>
                <p>Здесь будут отображаться ваши сообщения с поддержкой</p>
            </div>
        `;
    } else {
        // Сортируем сообщения по времени
        const sortedChat = chat.sort((a, b) => {
            const timeA = a.timestamp || 0;
            const timeB = b.timestamp || 0;
            return timeA - timeB;
        });
        
        sortedChat.forEach(msg => {
            const div = document.createElement('div');
            div.classList.add('chat-message');
            div.classList.add(msg.from === 'admin' ? 'chat-message-admin' : 'chat-message-user');
            
            const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('ru-RU', {
                hour: '2-digit',
                minute: '2-digit'
            }) : 'Неизвестно';
            
            const userName = msg.from === 'admin' ? 'Админ' : msg.userName || 'Клиент';
            
            div.innerHTML = `
                <div><strong>${userName}</strong></div>
                <div>${msg.text}</div>
                <div class="chat-meta">
                    <span>${time}</span>
                    ${msg.device ? `<span><i class="fas fa-desktop"></i> ${msg.device}</span>` : ''}
                </div>
            `;
            chatWindow.appendChild(div);
        });
        
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
    
    // Показываем/скрываем элементы управления в зависимости от роли
    const adminControls = document.getElementById('admin-controls');
    const userControls = document.getElementById('user-controls');
    
    if (currentUser && currentUser.role === 'admin') {
        if (adminControls) adminControls.classList.remove('hidden');
        if (userControls) userControls.classList.add('hidden');
    } else {
        if (adminControls) adminControls.classList.add('hidden');
        if (userControls) userControls.classList.remove('hidden');
    }
}

// Функция отправки сообщения в поддержку
function sendSupportMessage(topic, message) {
    const currentUser = userManager.getCurrentUser();
    
    if (!currentUser) {
        showNotification('Войдите в систему для отправки сообщения', 'error');
        return false;
    }
    
    const chat = JSON.parse(localStorage.getItem('pt_chat') || '[]');
    const newMessage = {
        from: 'user',
        userId: currentUser.id,
        userName: currentUser.name,
        userEmail: currentUser.email,
        text: `Тема: ${topic}\n${message}`,
        timestamp: Date.now(),
        device: getDeviceInfo(),
        read: false // Помечаем как непрочитанное для админа
    };
    
    chat.push(newMessage);
    localStorage.setItem('pt_chat', JSON.stringify(chat));
    
    // Обновляем статистику пользователя
    const userStats = userManager.getUserStats(currentUser.id);
    userManager.updateUserStats(currentUser.id, {
        messages: (userStats?.messages || 0) + 1
    });
    
    // Автосинхронизация с облаком
    if (cloudSync) {
        cloudSync.saveToCloud();
    }
    
    return true;
}

// Функция отправки ответа администратора
function sendAdminReply(text) {
    const currentUser = userManager.getCurrentUser();
    
    if (!currentUser || currentUser.role !== 'admin') {
        showNotification('Только администратор может отвечать', 'error');
        return false;
    }
    
    const chat = JSON.parse(localStorage.getItem('pt_chat') || '[]');
    const newMessage = {
        from: 'admin',
        adminName: currentUser.name,
        text: text,
        timestamp: Date.now(),
        device: getDeviceInfo()
    };
    
    chat.push(newMessage);
    localStorage.setItem('pt_chat', JSON.stringify(chat));
    
    // Автосинхронизация с облаком
    if (cloudSync) {
        cloudSync.saveToCloud();
    }
    
    return true;
}

// Получение информации об устройстве
function getDeviceInfo() {
    const ua = navigator.userAgent;
    let device = 'Неизвестное устройство';
    
    if (ua.includes('Mobile')) {
        device = 'Мобильное устройство';
    } else if (ua.includes('Tablet')) {
        device = 'Планшет';
    } else {
        device = 'Компьютер';
    }
    
    // Добавляем информацию о браузере
    if (ua.includes('Chrome')) device += ' (Chrome)';
    else if (ua.includes('Firefox')) device += ' (Firefox)';
    else if (ua.includes('Safari')) device += ' (Safari)';
    else if (ua.includes('Edge')) device += ' (Edge)';
    
    return device;
}

// Функция для админа: получение непрочитанных сообщений
function getUnreadMessages() {
    const chat = JSON.parse(localStorage.getItem('pt_chat') || '[]');
    return chat.filter(msg => msg.from === 'user' && !msg.read);
}

// Функция для админа: пометить сообщения как прочитанные
function markMessagesAsRead(messageIds) {
    const chat = JSON.parse(localStorage.getItem('pt_chat') || '[]');
    
    chat.forEach(msg => {
        if (messageIds.includes(msg.timestamp)) {
            msg.read = true;
        }
    });
    
    localStorage.setItem('pt_chat', JSON.stringify(chat));
    
    if (cloudSync) {
        cloudSync.saveToCloud();
    }
}

// ===== ОБНОВЛЕННЫЙ КОД ДЛЯ РАЗДЕЛА ПОДДЕРЖКИ =====

// В обработчике формы поддержки
document.getElementById('support-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const topic = document.getElementById('support-topic')?.value.trim() || '';
    const message = document.getElementById('support-message')?.value.trim() || '';
    
    if (!topic || !message) {
        showNotification('Заполните тему и сообщение', 'warning');
        return;
    }
    
    if (sendSupportMessage(topic, message)) {
        loadChatMessages();
        document.getElementById('support-form')?.reset();
        showNotification('Сообщение отправлено администратору', 'success');
        
        // Если текущий пользователь - админ, показываем уведомление
        const currentUser = userManager.getCurrentUser();
        if (currentUser?.role === 'admin') {
            showNotification('Получено новое сообщение от пользователя', 'info');
        }
    }
});

// В обработчике кнопки отправки ответа админа
document.getElementById('admin-send')?.addEventListener('click', () => {
    const text = document.getElementById('admin-answer-text')?.value.trim() || '';
    
    if (!text) return;
    
    if (sendAdminReply(text)) {
        loadChatMessages();
        document.getElementById('admin-answer-text').value = '';
        showNotification('Ответ отправлен пользователю', 'success');
    }
});

// ===== ФУНКЦИЯ ДЛЯ ОТОБРАЖЕНИЯ СТАТИСТИКИ ОБЛАКА =====
function renderCloudStats() {
    if (!cloudSync) return;
    
    const stats = cloudSync.getCloudStats();
    
    // Обновляем статус в хедере
    const globalSync = document.getElementById('global-sync-status');
    const globalText = document.getElementById('global-sync-text');
    
    if (globalSync && globalText) {
        globalText.textContent = stats.binId;
    }
    
    // Создаем секцию статистики в профиле если ее нет
    let statsSection = document.querySelector('.cloud-sync-section');
    if (!statsSection && document.getElementById('profile')) {
        statsSection = document.createElement('div');
        statsSection.className = 'cloud-sync-section';
        statsSection.innerHTML = `
            <h2><i class="fas fa-cloud"></i> Облачная синхронизация</h2>
            <div class="cloud-sync-stats">
                <div class="cloud-stat">
                    <h4><i class="fas fa-users"></i> Пользователей</h4>
                    <p>${stats.totalUsers}</p>
                </div>
                <div class="cloud-stat">
                    <h4><i class="fas fa-comments"></i> Сообщений</h4>
                    <p>${stats.totalMessages}</p>
                </div>
                <div class="cloud-stat">
                    <h4><i class="fas fa-project-diagram"></i> Проектов</h4>
                    <p>${stats.totalProjects}</p>
                </div>
                <div class="cloud-stat">
                    <h4><i class="fas fa-credit-card"></i> Платежей</h4>
                    <p>${stats.totalPayments}</p>
                </div>
            </div>
            <div class="cloud-actions">
                <button id="cloud-force-sync" class="primary-btn">
                    <i class="fas fa-sync-alt"></i> Синхронизировать сейчас
                </button>
                <button id="cloud-refresh" class="secondary-btn">
                    <i class="fas fa-download"></i> Загрузить из облака
                </button>
                <button id="cloud-share" class="secondary-btn">
                    <i class="fas fa-share"></i> Поделиться ссылкой
                </button>
            </div>
            <p class="hint">
                <i class="fas fa-info-circle"></i> 
                Последняя синхронизация: ${stats.lastSync} | ID: ${stats.binId}
            </p>
        `;
        
        const profileSection = document.getElementById('profile');
        if (profileSection) {
            profileSection.appendChild(statsSection);
            
            // Добавляем обработчики
            document.getElementById('cloud-force-sync')?.addEventListener('click', () => {
                cloudSync.forceSync();
            });
            
            document.getElementById('cloud-refresh')?.addEventListener('click', async () => {
                await cloudSync.loadFromCloud();
                location.reload();
            });
            
            document.getElementById('cloud-share')?.addEventListener('click', () => {
                if (cloudSync.BIN_ID) {
                    const url = `https://jsonbin.io/${cloudSync.BIN_ID}`;
                    navigator.clipboard.writeText(url).then(() => {
                        showNotification('Ссылка на облачные данные скопирована в буфер', 'success');
                    });
                }
            });
        }
    } else if (statsSection) {
        // Обновляем существующую статистику
        const statsElements = statsSection.querySelectorAll('.cloud-stat p');
        if (statsElements.length >= 4) {
            statsElements[0].textContent = stats.totalUsers;
            statsElements[1].textContent = stats.totalMessages;
            statsElements[2].textContent = stats.totalProjects;
            statsElements[3].textContent = stats.totalPayments;
        }
        
        const hint = statsSection.querySelector('.hint');
        if (hint) {
            hint.innerHTML = `<i class="fas fa-info-circle"></i> Последняя синхронизация: ${stats.lastSync} | ID: ${stats.binId}`;
        }
    }
}

// ===== АВТОМАТИЧЕСКАЯ ПРОВЕРКА НОВЫХ СООБЩЕНИЙ ДЛЯ АДМИНА =====
function setupAdminMessageChecker() {
    const currentUser = userManager.getCurrentUser();
    
    if (currentUser?.role === 'admin') {
        // Проверяем новые сообщения каждые 10 секунд
        setInterval(() => {
            const unread = getUnreadMessages();
            if (unread.length > 0) {
                // Показываем уведомление только если страница активна
                if (!document.hidden) {
                    showNotification(`У вас ${unread.length} непрочитанных сообщений`, 'info');
                    // Помечаем как прочитанные после уведомления
                    const messageIds = unread.map(msg => msg.timestamp);
                    markMessagesAsRead(messageIds);
                }
            }
        }, 10000);
    }
}

// ===== ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ =====
async function initApplication() {
    try {
        // Инициализируем облачную систему
        await initCloudSystem();
        
        // Проверяем текущего пользователя
        const currentUser = userManager.getCurrentUser();
        
        if (currentUser) {
            setUserUI(currentUser);
            document.getElementById('auth-overlay').style.display = 'none';
            
            // Если пользователь - админ, запускаем проверку сообщений
            if (currentUser.role === 'admin') {
                setupAdminMessageChecker();
            }
        } else {
            document.getElementById('auth-overlay').style.display = 'flex';
        }
        
        // Отображаем сохраненные профили
        renderSavedUserList();
        
        // Настраиваем карточки каталога
        setupCatalogCards();
        
        // Загружаем проект текущего пользователя
        loadProject();
        
        // Загружаем чат
        loadChatMessages();
        
        // Показываем главную страницу
        showSection('home', false);
        
        // Запускаем обновление статистики облака
        setInterval(renderCloudStats, 5000);
        
        // Первоначальная отрисовка статистики
        setTimeout(renderCloudStats, 1000);
        
    } catch (error) {
        console.error('Ошибка инициализации приложения:', error);
        showNotification('Ошибка инициализации приложения', 'error');
    }
}

// ===== ЗАПУСК ПРИЛОЖЕНИЯ =====
document.addEventListener('DOMContentLoaded', initApplication);

// ===== ОСТАЛЬНЫЕ ФУНКЦИИ (такие же как в предыдущем ответе, но используют обновленные userManager и cloudSync) =====

// Навигация, каталог, проекты, сравнение, профиль и другие функции остаются аналогичными
// но теперь используют глобальные объекты userManager и cloudSync

// Пример обновленной функции showNotification:
function showNotification(message, type = 'info') {
    // Используем облачные уведомления если есть cloudSync
    if (cloudSync && type !== 'error') {
        cloudSync.showCloudNotification(message, type);
    } else {
        // Стандартные уведомления для ошибок
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close"><i class="fas fa-times"></i></button>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) notification.remove();
        }, 5000);
        
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
    }
}

// Остальные функции (renderSavedUserList, setupCatalogCards, loadProject и т.д.)
// остаются такими же как в предыдущем ответе, но используют глобальный userManager

// ===== ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ ОБЛАЧНОЙ СИНХРОНИЗАЦИИ =====

// Периодическая синхронизация каждые 30 секунд
setInterval(async () => {
    if (cloudSync && !cloudSync.isSyncing) {
        await cloudSync.loadFromCloud();
        await cloudSync.saveToCloud();
        renderCloudStats();
    }
}, 30000);

// Синхронизация при возвращении на вкладку
document.addEventListener('visibilitychange', () => {
    if (!document.hidden && cloudSync) {
        cloudSync.loadFromCloud();
        renderCloudStats();
    }
});

// Экспорт данных в файл (резервная копия)
function exportAllData() {
    const data = cloudSync ? cloudSync.getAllLocalData() : userManager.getAllUsers();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `priorlab_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Резервная копия данных сохранена', 'success');
}

// Импорт данных из файла
function importDataFromFile(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            
            // Проверяем структуру данных
            if (data.users && Array.isArray(data.users)) {
                // Объединяем пользователей
                const currentUsers = userManager.users;
                const mergedUsers = cloudSync ? 
                    cloudSync.mergeArrays(currentUsers, data.users, 'email') :
                    [...currentUsers, ...data.users.filter(newUser => 
                        !currentUsers.some(u => u.email === newUser.email)
                    )];
                
                userManager.users = mergedUsers;
                userManager.saveUsers();
                
                // Импортируем чат если есть
                if (data.chat && Array.isArray(data.chat)) {
                    const currentChat = JSON.parse(localStorage.getItem('pt_chat') || '[]');
                    const mergedChat = cloudSync ?
                        cloudSync.mergeArrays(currentChat, data.chat, 'timestamp', true) :
                        [...currentChat, ...data.chat.filter(newMsg => 
                            !currentChat.some(msg => msg.timestamp === newMsg.timestamp)
                        )];
                    
                    localStorage.setItem('pt_chat', JSON.stringify(mergedChat));
                }
                
                // Синхронизируем с облаком если есть
                if (cloudSync) {
                    await cloudSync.saveToCloud();
                }
                
                showNotification('Данные успешно импортированы', 'success');
                location.reload();
            } else {
                throw new Error('Неверный формат файла');
            }
        } catch (error) {
            showNotification('Ошибка импорта данных: ' + error.message, 'error');
        }
    };
    reader.readAsText(file);
}

// Добавляем кнопки импорта/экспорта в профиль
function addDataManagementButtons() {
    const profileSection = document.getElementById('profile');
    if (!profileSection) return;
    
    const existing = document.getElementById('data-management-buttons');
    if (existing) return;
    
    const container = document.createElement('div');
    container.id = 'data-management-buttons';
    container.className = 'cloud-actions';
    container.innerHTML = `
        <button id="export-data" class="secondary-btn">
            <i class="fas fa-file-export"></i> Экспорт всех данных
        </button>
        <label class="secondary-btn" style="cursor: pointer;">
            <i class="fas fa-file-import"></i> Импорт данных
            <input type="file" id="import-data-input" accept=".json" style="display: none;">
        </label>
    `;
    
    profileSection.appendChild(container);
    
    document.getElementById('export-data')?.addEventListener('click', exportAllData);
    
    document.getElementById('import-data-input')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            if (confirm('Импорт данных перезапишет текущие данные. Продолжить?')) {
                importDataFromFile(file);
            }
            e.target.value = ''; // Сбрасываем input
        }
    });
}

// Запускаем добавление кнопок управления данными
setTimeout(addDataManagementButtons, 2000);
