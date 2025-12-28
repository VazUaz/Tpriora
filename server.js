// server.js - Виртуальный сервер для синхронизации между устройствами
class VirtualServer {
    constructor() {
        this.serverKey = 'priorlab_server';
        this.initServer();
    }

    initServer() {
        if (!localStorage.getItem(this.serverKey)) {
            const initialData = {
                users: [],
                chat: [],
                payments: [],
                projects: [],
                lastSync: new Date().toISOString(),
                serverId: 'server_' + Date.now()
            };
            localStorage.setItem(this.serverKey, JSON.stringify(initialData));
        }
        console.log('Виртуальный сервер инициализирован');
    }

    getServerData() {
        try {
            const data = localStorage.getItem(this.serverKey);
            return data ? JSON.parse(data) : {};
        } catch (e) {
            console.error('Ошибка чтения данных сервера:', e);
            return {};
        }
    }

    saveServerData(data) {
        try {
            localStorage.setItem(this.serverKey, JSON.stringify(data));
        } catch (e) {
            console.error('Ошибка сохранения данных сервера:', e);
        }
    }

    // Полная синхронизация локальных данных с сервером
    syncAllData(localData) {
        const serverData = this.getServerData();
        
        // Синхронизация пользователей
        if (localData.users && Array.isArray(localData.users)) {
            serverData.users = this.mergeArrays(serverData.users || [], localData.users, 'email');
        }
        
        // Синхронизация чата
        if (localData.chat && Array.isArray(localData.chat)) {
            serverData.chat = this.mergeArrays(serverData.chat || [], localData.chat, 'id');
        }
        
        // Синхронизация платежей
        if (localData.payments && Array.isArray(localData.payments)) {
            serverData.payments = this.mergeArrays(serverData.payments || [], localData.payments, 'id');
        }
        
        // Синхронизация проектов
        if (localData.projects && Array.isArray(localData.projects)) {
            serverData.projects = this.mergeArrays(serverData.projects || [], localData.projects, 'id');
        }
        
        serverData.lastSync = new Date().toISOString();
        this.saveServerData(serverData);
        
        return serverData;
    }

    // Умное слияние массивов
    mergeArrays(serverArray, localArray, idField) {
        const merged = [...serverArray];
        
        localArray.forEach(localItem => {
            const existingIndex = merged.findIndex(item => item[idField] === localItem[idField]);
            
            if (existingIndex === -1) {
                // Новый элемент
                merged.push(localItem);
            } else {
                // Обновление существующего элемента (сохраняем более новые данные)
                const serverItem = merged[existingIndex];
                const serverTime = new Date(serverItem.lastUpdate || 0).getTime();
                const localTime = new Date(localItem.lastUpdate || localItem.timestamp || 0).getTime();
                
                if (localTime > serverTime) {
                    merged[existingIndex] = localItem;
                }
            }
        });
        
        return merged;
    }

    // Получение всех данных с сервера
    getAllData() {
        return this.getServerData();
    }

    // Добавление пользователя
    addUser(user) {
        const serverData = this.getServerData();
        if (!serverData.users) serverData.users = [];
        
        // Генерируем уникальный ID, если его нет
        if (!user.id) {
            user.id = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        }
        user.lastUpdate = new Date().toISOString();
        
        const existingIndex = serverData.users.findIndex(u => u.email === user.email);
        if (existingIndex === -1) {
            serverData.users.push(user);
        } else {
            serverData.users[existingIndex] = user;
        }
        
        serverData.lastSync = new Date().toISOString();
        this.saveServerData(serverData);
        
        return user;
    }

    // Обновление пользователя
    updateUser(user) {
        const serverData = this.getServerData();
        if (!serverData.users) return null;
        
        const index = serverData.users.findIndex(u => u.id === user.id);
        
        if (index !== -1) {
            user.lastUpdate = new Date().toISOString();
            serverData.users[index] = user;
            serverData.lastSync = new Date().toISOString();
            this.saveServerData(serverData);
            return user;
        }
        
        return null;
    }

    // Добавление сообщения в чат
    addChatMessage(message) {
        const serverData = this.getServerData();
        if (!serverData.chat) serverData.chat = [];
        
        message.id = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        message.timestamp = new Date().toISOString();
        
        serverData.chat.push(message);
        serverData.lastSync = new Date().toISOString();
        this.saveServerData(serverData);
        
        return message;
    }

    // Добавление платежа
    addPayment(payment) {
        const serverData = this.getServerData();
        if (!serverData.payments) serverData.payments = [];
        
        payment.id = 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        payment.timestamp = new Date().toISOString();
        
        serverData.payments.push(payment);
        serverData.lastSync = new Date().toISOString();
        this.saveServerData(serverData);
        
        return payment;
    }

    // Добавление проекта в историю
    addProject(project) {
        const serverData = this.getServerData();
        if (!serverData.projects) serverData.projects = [];
        
        project.id = 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        project.timestamp = new Date().toISOString();
        
        serverData.projects.push(project);
        serverData.lastSync = new Date().toISOString();
        this.saveServerData(serverData);
        
        return project;
    }

    // Получение пользователя по email
    getUserByEmail(email) {
        const serverData = this.getServerData();
        return serverData.users?.find(u => u.email === email) || null;
    }

    // Получение пользователя по ID
    getUserById(id) {
        const serverData = this.getServerData();
        return serverData.users?.find(u => u.id === id) || null;
    }

    // Получение сообщений пользователя
    getChatMessages(userId = null) {
        const serverData = this.getServerData();
        if (!serverData.chat) return [];
        
        if (userId) {
            return serverData.chat.filter(m => 
                m.userId === userId || m.from === 'admin'
            );
        }
        
        return serverData.chat;
    }

    // Получение платежей пользователя
    getUserPayments(userId) {
        const serverData = this.getServerData();
        if (!serverData.payments) return [];
        
        return serverData.payments.filter(p => p.userId === userId);
    }

    // Получение проектов пользователя
    getUserProjects(userId) {
        const serverData = this.getServerData();
        if (!serverData.projects) return [];
        
        return serverData.projects.filter(p => p.userId === userId);
    }

    // Получение статистики сервера
    getServerStats() {
        const serverData = this.getServerData();
        return {
            totalUsers: serverData.users?.length || 0,
            totalMessages: serverData.chat?.length || 0,
            totalPayments: serverData.payments?.length || 0,
            totalProjects: serverData.projects?.length || 0,
            lastSync: serverData.lastSync || 'Неизвестно'
        };
    }

    // Получение всех пользователей
    getAllUsers() {
        const serverData = this.getServerData();
        return serverData.users || [];
    }

    // Проверка доступности сервера
    isAvailable() {
        try {
            const data = this.getServerData();
            return !!data.serverId;
        } catch (e) {
            return false;
        }
    }

    // Сброс сервера (только для тестирования)
    resetServer() {
        localStorage.removeItem(this.serverKey);
        this.initServer();
        console.log('Сервер сброшен к начальному состоянию');
    }

    // Очистка старых данных (более 30 дней)
    cleanupOldData() {
        const serverData = this.getServerData();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        if (serverData.chat) {
            serverData.chat = serverData.chat.filter(msg => {
                const msgDate = new Date(msg.timestamp);
                return msgDate > thirtyDaysAgo;
            });
        }
        
        this.saveServerData(serverData);
    }
}

// Создаем глобальный экземпляр сервера
window.virtualServer = new VirtualServer();

// Запускаем очистку старых данных при загрузке
setTimeout(() => {
    window.virtualServer.cleanupOldData();
}, 1000);