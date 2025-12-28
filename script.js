// ===== НАВИГАЦИЯ + КНОПКА "НАЗАД" =====
const sections = document.querySelectorAll(".section");
const backBtn = document.getElementById("back-btn");
let historyStack = ["home"];

function showSection(id, pushToHistory = true) {
    sections.forEach((sec) => {
        sec.classList.toggle("active", sec.id === id);
    });

    if (pushToHistory) {
        const last = historyStack[historyStack.length - 1];
        if (last !== id) historyStack.push(id);
    }

    backBtn.disabled = historyStack.length <= 1;
    window.scrollTo({ top: 0, behavior: "smooth" });
    
    // Обновляем данные при показе раздела
    if (id === "profile") {
        loadProfileData();
        updateProfileStats();
        renderSavedProfiles();
    } else if (id === "projects") {
        updatePaymentAmount();
    } else if (id === "support") {
        loadChatMessages();
    }
}

document.querySelectorAll(".nav-btn, .quick-buttons button").forEach((btn) => {
    btn.addEventListener("click", () => {
        const id = btn.dataset.section;
        if (id) showSection(id);
    });
});

backBtn.addEventListener("click", () => {
    if (historyStack.length > 1) {
        historyStack.pop();
        const prev = historyStack.pop();
        showSection(prev, true);
    }
});

// ===== СИСТЕМА СОХРАНЕНИЯ ПРОФИЛЕЙ =====
class UserManager {
    constructor() {
        this.usersKey = 'pt_users';
        this.currentUserKey = 'pt_current_user';
        this.savedProfilesKey = 'pt_saved_profiles';
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
    }

    saveSavedProfiles() {
        localStorage.setItem(this.savedProfilesKey, JSON.stringify(this.savedProfiles));
    }

    // Регистрация нового пользователя
    register(userData, remember = true) {
        // Проверяем, существует ли пользователь с таким email
        if (this.users.some(u => u.email === userData.email)) {
            throw new Error('Пользователь с таким email уже зарегистрирован');
        }

        // Создаем нового пользователя
        const newUser = {
            id: Date.now().toString(),
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
            }
        };

        // Добавляем пользователя в список
        this.users.push(newUser);
        this.saveUsers();

        // Сохраняем профиль для быстрого входа, если выбрано "Запомнить меня"
        if (remember) {
            this.saveProfileForQuickLogin(newUser);
        }

        return newUser;
    }

    // Вход пользователя
    login(email, password, remember = true) {
        const user = this.users.find(u => u.email === email && u.password === password);
        
        if (!user) {
            throw new Error('Неверный email или пароль');
        }

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
            lastLogin: new Date().toISOString()
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
}

// Создаем экземпляр менеджера пользователей
const userManager = new UserManager();

// ===== ОТОБРАЖЕНИЕ СОХРАНЕННЫХ ПРОФИЛЕЙ =====
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
        
        // Добавляем обработчик клика на профиль
        userItem.addEventListener('click', (e) => {
            if (!e.target.closest('.user-remove')) {
                document.getElementById('login-email').value = profile.email;
                document.getElementById('login-password').focus();
            }
        });
        
        // Добавляем обработчик удаления профиля
        const removeBtn = userItem.querySelector('.user-remove');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Удалить профиль ${profile.name}?`)) {
                userManager.removeSavedProfile(profile.email);
                renderSavedUserList();
                showNotification('Профиль удален из сохраненных', 'info');
            }
        });
    });
}

// ===== РЕНДЕРИНГ СПИСКА ПРОФИЛЕЙ В РАЗДЕЛЕ ПРОФИЛЯ =====
function renderSavedProfiles() {
    const profilesList = document.getElementById('profiles-list');
    const savedProfiles = userManager.savedProfiles;
    
    profilesList.innerHTML = '';
    
    if (savedProfiles.length === 0) {
        profilesList.innerHTML = '<p class="no-profiles">Нет сохраненных профилей для быстрого входа</p>';
        return;
    }
    
    savedProfiles.forEach(profile => {
        const profileItem = document.createElement('div');
        profileItem.className = 'profile-item';
        
        const avatarLetter = profile.name ? profile.name.charAt(0).toUpperCase() : 'U';
        const lastLogin = profile.lastLogin ? new Date(profile.lastLogin).toLocaleDateString('ru-RU') : 'Неизвестно';
        
        profileItem.innerHTML = `
            <div class="profile-item-header">
                <div class="profile-item-avatar">
                    ${profile.avatar ? `<img src="${profile.avatar}" alt="${profile.name}">` : avatarLetter}
                </div>
                <div class="profile-item-info">
                    <h3>${profile.name}</h3>
                    <p>${profile.email}</p>
                </div>
            </div>
            <div class="profile-item-details">
                <p><i class="fas fa-calendar-alt"></i> Последний вход: ${lastLogin}</p>
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
    
    // Добавляем обработчики для кнопок
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

// Быстрый вход по сохраненному профилю
function quickLogin(email) {
    const user = userManager.getUserByEmail(email);
    
    if (!user) {
        showNotification('Пользователь не найден', 'error');
        return;
    }
    
    // Запрашиваем пароль для быстрого входа
    const password = prompt(`Введите пароль для ${user.name}:`);
    
    if (!password) {
        return;
    }
    
    try {
        const loggedInUser = userManager.login(user.email, password, true);
        setUserUI(loggedInUser);
        authOverlay.style.display = 'none';
        showNotification(`Добро пожаловать, ${loggedInUser.name}!`, 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

// ===== КАТАЛОГ: ФИЛЬТРАЦИЯ + СОРТИРОВКА ПО ЦЕНЕ =====
function setupCatalog(section) {
    const grid = section.querySelector(".catalog-grid");
    if (!grid) return;

    const cards = Array.from(grid.querySelectorAll(".part-card"));
    const categorySelect = section.querySelector(".filter-category");
    const sortSelect = section.querySelector(".filter-sort");
    const initialOrder = cards.slice();

    function applyFilters() {
        const typeValue = categorySelect ? categorySelect.value : "all";
        let currentCards = initialOrder.slice();

        if (typeValue !== "all") {
            currentCards = currentCards.filter((card) => card.dataset.type === typeValue);
        }

        const sortValue = sortSelect ? sortSelect.value : "default";
        if (sortValue === "asc" || sortValue === "desc") {
            currentCards.sort((a, b) => {
                const pa = Number(a.dataset.price);
                const pb = Number(b.dataset.price);
                return sortValue === "asc" ? pa - pb : pb - pa;
            });
        }

        grid.innerHTML = "";
        currentCards.forEach((card) => grid.appendChild(card));
        
        // Обновляем обработчики событий для новых карточек
        setupCatalogCards();
    }

    if (categorySelect) categorySelect.addEventListener("change", applyFilters);
    if (sortSelect) sortSelect.addEventListener("change", applyFilters);

    applyFilters();
}

// Настройка обработчиков событий для карточек каталога
function setupCatalogCards() {
    // Обработчики для кнопок "Добавить"
    document.querySelectorAll(".add-btn").forEach((btn) => {
        if (!btn.hasAttribute("data-listener")) {
            btn.setAttribute("data-listener", "true");
            btn.addEventListener("click", addToProject);
        }
    });

    // Обработчики для кнопок "Сравнить"
    document.querySelectorAll(".compare-btn").forEach((btn) => {
        if (!btn.hasAttribute("data-listener")) {
            btn.setAttribute("data-listener", "true");
            btn.addEventListener("click", addToCompare);
        }
    });
}

// Инициализация каталогов
document.querySelectorAll("[data-category]").forEach(setupCatalog);

// ===== ПРОЕКТ + КАЛЬКУЛЯТОР =====
const projectItems = document.getElementById("project-items");
const partsSumSpan = document.getElementById("parts-sum");
const totalSumSpan = document.getElementById("total-sum");
const partsCountSpan = document.getElementById("parts-count");
const laborInput = document.getElementById("labor-input");
let projectParts = [];

// Загрузка проекта из localStorage
function loadProject() {
    const currentUser = userManager.getCurrentUser();
    if (!currentUser) return;
    
    const saved = localStorage.getItem(`pt_project_${currentUser.id}`);
    if (saved) {
        projectParts = JSON.parse(saved);
        renderProject();
    }
}

// Сохранение проекта в localStorage
function saveProject() {
    const currentUser = userManager.getCurrentUser();
    if (!currentUser) return;
    
    localStorage.setItem(`pt_project_${currentUser.id}`, JSON.stringify(projectParts));
}

function renderProject() {
    if (!projectItems) return;
    projectItems.innerHTML = "";
    let partsSum = 0;

    projectParts.forEach((part, index) => {
        partsSum += part.price;
        const li = document.createElement("li");
        li.innerHTML = `
            <span><strong>${part.name}</strong></span>
            <span>${part.price.toLocaleString("ru-RU")} ₽</span>
            <button class="remove-part" data-index="${index}"><i class="fas fa-times"></i></button>
        `;
        projectItems.appendChild(li);
    });

    // Добавляем обработчики для кнопок удаления
    document.querySelectorAll(".remove-part").forEach(btn => {
        btn.addEventListener("click", function() {
            const index = parseInt(this.dataset.index);
            projectParts.splice(index, 1);
            saveProject();
            renderProject();
            updatePaymentAmount();
        });
    });

    partsCountSpan.textContent = projectParts.length;
    partsSumSpan.textContent = partsSum.toLocaleString("ru-RU");
    const labor = Number(laborInput.value) || 0;
    const total = partsSum + labor;
    totalSumSpan.textContent = total.toLocaleString("ru-RU");

    updatePaymentAmount();
    saveProject();
}

function addToProject(e) {
    const card = e.target.closest(".part-card");
    const name = card.dataset.name;
    const price = Number(card.dataset.price);
    const type = card.dataset.type;
    
    projectParts.push({ name, price, type });
    renderProject();
    
    showNotification(`Компонент "${name}" добавлен в проект.`, "success");
}

laborInput.addEventListener("input", () => {
    renderProject();
    updatePaymentAmount();
});

document.getElementById("clear-project").addEventListener("click", () => {
    if (projectParts.length > 0 && confirm("Очистить текущий проект? Все добавленные детали будут удалены.")) {
        projectParts = [];
        renderProject();
        showNotification("Проект очищен", "info");
    }
});

document.getElementById("export-estimate").addEventListener("click", () => {
    if (projectParts.length === 0) {
        showNotification("Добавьте детали в проект перед сохранением сметы", "warning");
        return;
    }
    
    const currentUser = userManager.getCurrentUser();
    if (!currentUser) return;
    
    const saved = {
        date: new Date().toLocaleString("ru-RU"),
        userId: currentUser.id,
        userName: currentUser.name,
        parts: projectParts,
        labor: Number(laborInput.value) || 0,
        total: Number(totalSumSpan.textContent.replace(/\s/g, "")) || 0
    };
    
    // Сохраняем историю проектов
    const history = JSON.parse(localStorage.getItem(`pt_projects_history_${currentUser.id}`) || "[]");
    history.unshift(saved);
    if (history.length > 10) history.pop(); // Ограничиваем 10 последних проектов
    localStorage.setItem(`pt_projects_history_${currentUser.id}`, JSON.stringify(history));
    
    // Обновляем статистику пользователя
    const userStats = userManager.getUserStats(currentUser.id);
    userManager.updateUserStats(currentUser.id, {
        projects: (userStats?.projects || 0) + 1
    });
    
    // Создаем текстовый файл со сметой
    let estimateText = `Смета PriorLab\n`;
    estimateText += `Дата: ${saved.date}\n`;
    estimateText += `Клиент: ${saved.userName}\n`;
    estimateText += `========================\n\n`;
    estimateText += `Детали:\n`;
    saved.parts.forEach(part => {
        estimateText += `  • ${part.name}: ${part.price.toLocaleString("ru-RU")} ₽\n`;
    });
    estimateText += `\nРабота: ${saved.labor.toLocaleString("ru-RU")} ₽\n`;
    estimateText += `========================\n`;
    estimateText += `Итого: ${saved.total.toLocaleString("ru-RU")} ₽\n`;
    
    const blob = new Blob([estimateText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Смета_${currentUser.name}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification("Смета сохранена и добавлена в историю", "success");
});

// ===== ОПЛАТА =====
const payBtn = document.getElementById("pay-btn");
const paymentBlock = document.getElementById("payment-block");
const paymentForm = document.getElementById("payment-form");
const cancelPaymentBtn = document.getElementById("cancel-payment");

function updatePaymentAmount() {
    const payAmountInput = document.getElementById("pay-amount");
    if (payAmountInput) {
        const total = Number(totalSumSpan.textContent.replace(/\s/g, "")) || 0;
        payAmountInput.value = total;
    }
}

payBtn.addEventListener("click", () => {
    if (projectParts.length === 0) {
        showNotification("Добавьте детали в проект перед оплатой", "warning");
        return;
    }
    
    paymentBlock.classList.remove("hidden");
    updatePaymentAmount();
});

cancelPaymentBtn.addEventListener("click", () => {
    paymentBlock.classList.add("hidden");
});

paymentForm.addEventListener("submit", (e) => {
    e.preventDefault();
    
    const amount = Number(document.getElementById("pay-amount").value) || 0;
    const cardNumber = document.getElementById("card-number").value.replace(/\s/g, "");
    const cardName = document.getElementById("card-name").value.trim();
    const cardExp = document.getElementById("card-exp").value.trim();
    const cardCvc = document.getElementById("card-cvc").value.trim();
    
    if (amount <= 0) {
        showNotification("Сначала сформируйте проект и сумму к оплате", "warning");
        return;
    }
    
    if (cardNumber.length !== 16 || !/^\d+$/.test(cardNumber)) {
        showNotification("Введите корректный номер карты (16 цифр)", "error");
        return;
    }
    
    // Имитация успешной оплаты
    showNotification(`Оплата ${amount.toLocaleString("ru-RU")} ₽ прошла успешно (тестовый режим).`, "success");
    
    // Сохраняем информацию о платеже
    const currentUser = userManager.getCurrentUser();
    if (currentUser) {
        const payment = {
            date: new Date().toLocaleString("ru-RU"),
            amount,
            project: projectParts,
            userId: currentUser.id,
            userName: currentUser.name
        };
        
        const payments = JSON.parse(localStorage.getItem(`pt_payments_${currentUser.id}`) || "[]");
        payments.push(payment);
        localStorage.setItem(`pt_payments_${currentUser.id}`, JSON.stringify(payments));
        
        // Обновляем статистику пользователя
        const userStats = userManager.getUserStats(currentUser.id);
        userManager.updateUserStats(currentUser.id, {
            spent: (userStats?.spent || 0) + amount,
            level: Math.min(Math.floor(((userStats?.spent || 0) + amount) / 10000) + 1, 10)
        });
        
        // Обновляем статистику профиля
        updateProfileStats();
    }
    
    // Скрываем форму оплаты и очищаем проект
    paymentBlock.classList.add("hidden");
    paymentForm.reset();
    projectParts = [];
    renderProject();
    
    // Показываем раздел профиля
    showSection("profile");
});

// ===== СРАВНЕНИЕ ДЕТАЛЕЙ =====
let compareItems = [];

function addToCompare(e) {
    const card = e.target.closest(".part-card");
    const name = card.dataset.name;
    const price = card.dataset.price;
    const type = card.dataset.type;
    
    // Получаем все характеристики из data-атрибутов
    const attributes = {};
    for (const [key, value] of Object.entries(card.dataset)) {
        attributes[key] = value;
    }
    
    // Проверяем, не добавлена ли уже эта деталь
    if (compareItems.some(item => item.name === name)) {
        showNotification("Деталь уже добавлена для сравнения", "warning");
        return;
    }
    
    // Ограничиваем до 2 деталей
    if (compareItems.length >= 2) {
        showNotification("Можно сравнивать только 2 детали одновременно", "warning");
        return;
    }
    
    compareItems.push({
        name,
        price,
        type,
        attributes
    });
    
    renderCompare();
    showNotification(`"${name}" добавлен для сравнения`, "success");
}

function renderCompare() {
    const compareContainer = document.getElementById("compare-container");
    const compareItemsContainer = document.getElementById("compare-items");
    const compareTableContainer = document.getElementById("compare-table-container");
    
    compareItemsContainer.innerHTML = "";
    
    if (compareItems.length === 0) {
        compareItemsContainer.innerHTML = '<p class="empty-compare">Выберите детали для сравнения из каталога</p>';
        compareTableContainer.classList.add("hidden");
        return;
    }
    
    // Показываем выбранные детали
    compareItems.forEach((item, index) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "compare-item";
        itemDiv.innerHTML = `
            <span>${item.name}</span>
            <button class="compare-item-remove" data-index="${index}"><i class="fas fa-times"></i></button>
        `;
        compareItemsContainer.appendChild(itemDiv);
    });
    
    // Добавляем обработчики для кнопок удаления
    document.querySelectorAll(".compare-item-remove").forEach(btn => {
        btn.addEventListener("click", function() {
            const index = parseInt(this.dataset.index);
            compareItems.splice(index, 1);
            renderCompare();
        });
    });
    
    // Если есть 2 детали для сравнения, показываем таблицу
    if (compareItems.length === 2) {
        renderCompareTable();
        compareTableContainer.classList.remove("hidden");
    } else {
        compareTableContainer.classList.add("hidden");
    }
}

function renderCompareTable() {
    const compareHeader1 = document.getElementById("compare-header1");
    const compareHeader2 = document.getElementById("compare-header2");
    const compareBody = document.getElementById("compare-body");
    
    compareHeader1.textContent = compareItems[0].name;
    compareHeader2.textContent = compareItems[1].name;
    
    compareBody.innerHTML = "";
    
    // Определяем все уникальные характеристики для сравнения
    const allAttributes = new Set();
    compareItems.forEach(item => {
        Object.keys(item.attributes).forEach(attr => {
            if (!["name", "price", "type"].includes(attr)) {
                allAttributes.add(attr);
            }
        });
    });
    
    // Добавляем базовые характеристики
    const baseAttributes = ["price", "type"];
    baseAttributes.forEach(attr => {
        const tr = document.createElement("tr");
        const attrName = attr === "price" ? "Цена" : attr === "type" ? "Категория" : attr;
        
        let value1 = attr === "price" ? `${compareItems[0][attr]} ₽` : compareItems[0][attr];
        let value2 = attr === "price" ? `${compareItems[1][attr]} ₽` : compareItems[1][attr];
        
        tr.innerHTML = `
            <td>${attrName}</td>
            <td>${value1}</td>
            <td>${value2}</td>
        `;
        compareBody.appendChild(tr);
    });
    
    // Добавляем дополнительные характеристики
    allAttributes.forEach(attr => {
        const tr = document.createElement("tr");
        const attrName = getAttributeDisplayName(attr);
        
        const value1 = compareItems[0].attributes[attr] || "-";
        const value2 = compareItems[1].attributes[attr] || "-";
        
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
        "desc": "Описание",
        "power": "Мощность",
        "torque": "Крутящий момент",
        "weight": "Вес",
        "fuel": "Топливо",
        "sound": "Звук",
        "material": "Материал",
        "turbo": "Давление турбины",
        "install": "Сложность установки",
        "lowering": "Понижение",
        "adjust": "Регулировка",
        "type-susp": "Тип подвески",
        "comfort": "Комфорт",
        "color": "Цвет",
        "parts": "Количество частей",
        "speakers": "Кол-во динамиков",
        "subwoofer": "Сабвуфер",
        "control": "Управление",
        "heating": "Подогрев"
    };
    
    return names[attr] || attr;
}

document.getElementById("clear-compare").addEventListener("click", () => {
    compareItems = [];
    renderCompare();
    showNotification("Сравнение очищено", "info");
});

// ===== ПРОФИЛЬ =====
const logoutBtn = document.getElementById("logout-btn");
const quickLogoutBtn = document.getElementById("quick-logout");
const userNameTitle = document.getElementById("user-name-title");
const editProfileBtn = document.getElementById("edit-profile-btn");
const profileDisplay = document.getElementById("profile-display");
const profileEditForm = document.getElementById("profile-edit-form");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const avatarInput = document.getElementById("profile-avatar-input");
const removeAvatarBtn = document.getElementById("remove-avatar");
const adminBadge = document.getElementById("admin-badge");
const clearAllProfilesBtn = document.getElementById("clear-all-profiles");

// Элементы отображения профиля
const profileNameDisplay = document.getElementById("profile-name-display");
const profileEmailDisplay = document.getElementById("profile-email-display");
const profilePhoneDisplay = document.getElementById("profile-phone-display");
const profileCityDisplay = document.getElementById("profile-city-display");
const profileCarDisplay = document.getElementById("profile-car-display");
const profileExperienceDisplay = document.getElementById("profile-experience-display");
const profileRegDate = document.getElementById("profile-regdate");

// Элементы редактирования профиля
const profileNameEdit = document.getElementById("profile-name-edit");
const profileEmailEdit = document.getElementById("profile-email-edit");
const profilePhoneEdit = document.getElementById("profile-phone-edit");
const profileCityEdit = document.getElementById("profile-city-edit");
const profileCarEdit = document.getElementById("profile-car-edit");
const profileExperienceEdit = document.getElementById("profile-experience-edit");

// Аватар
const avatarDisplay = document.getElementById("profile-avatar-img");
const avatarLetter = document.getElementById("avatar-letter");
const avatarPreview = document.getElementById("profile-avatar-preview");
const avatarLetterEdit = document.getElementById("avatar-letter-edit");

// Загрузка данных профиля
function loadProfileData() {
    const currentUser = userManager.getCurrentUser();
    
    if (currentUser) {
        // Отображение профиля
        profileNameDisplay.textContent = currentUser.name;
        profileEmailDisplay.textContent = currentUser.email || "Не указан";
        profilePhoneDisplay.textContent = currentUser.phone || "Не указан";
        profileCityDisplay.textContent = currentUser.city || "Не указан";
        profileCarDisplay.textContent = currentUser.car || "Не указан";
        profileExperienceDisplay.textContent = currentUser.experience || "Не указан";
        profileRegDate.textContent = currentUser.regDate || new Date().toLocaleDateString("ru-RU");
        
        // Заполнение формы редактирования
        profileNameEdit.value = currentUser.name || "";
        profileEmailEdit.value = currentUser.email || "";
        profilePhoneEdit.value = currentUser.phone || "";
        profileCityEdit.value = currentUser.city || "";
        profileCarEdit.value = currentUser.car || "";
        profileExperienceEdit.value = currentUser.experience || "Новичок";
        
        // Установка аватара
        if (currentUser.avatar) {
            avatarDisplay.src = currentUser.avatar;
            avatarDisplay.style.display = "block";
            avatarLetter.style.display = "none";
            
            avatarPreview.src = currentUser.avatar;
            avatarPreview.style.display = "block";
            avatarLetterEdit.style.display = "none";
        } else {
            avatarDisplay.style.display = "none";
            avatarLetter.style.display = "flex";
            avatarLetter.textContent = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "P";
            
            avatarPreview.style.display = "none";
            avatarLetterEdit.style.display = "flex";
            avatarLetterEdit.textContent = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "P";
        }
        
        // Показываем бейдж администратора
        if (currentUser.role === "admin") {
            adminBadge.style.display = "flex";
        } else {
            adminBadge.style.display = "none";
        }
    }
}

// Обновление статистики профиля
function updateProfileStats() {
    const currentUser = userManager.getCurrentUser();
    if (!currentUser) return;
    
    // Загружаем историю проектов пользователя
    const history = JSON.parse(localStorage.getItem(`pt_projects_history_${currentUser.id}`) || "[]");
    document.getElementById("projects-count").textContent = history.length;
    
    // Загружаем платежи пользователя
    const payments = JSON.parse(localStorage.getItem(`pt_payments_${currentUser.id}`) || "[]");
    const totalSpent = payments.reduce((sum, payment) => sum + payment.amount, 0);
    document.getElementById("total-spent").textContent = totalSpent.toLocaleString("ru-RU") + " ₽";
    
    // Подсчет сообщений
    const chat = JSON.parse(localStorage.getItem("pt_chat") || "[]");
    const userMessages = chat.filter(m => m.userId === currentUser.id).length;
    document.getElementById("messages-count").textContent = userMessages;
    
    // Расчет уровня пользователя
    const userStats = userManager.getUserStats(currentUser.id);
    const userLevel = userStats?.level || 1;
    document.getElementById("user-level").textContent = userLevel;
    
    // Показываем историю проектов если она есть
    if (history.length > 0) {
        const historyContainer = document.querySelector(".projects-history");
        const historyList = document.getElementById("projects-history-list");
        
        historyContainer.classList.remove("hidden");
        historyList.innerHTML = "";
        
        history.slice(0, 5).forEach(project => {
            const projectDiv = document.createElement("div");
            projectDiv.className = "history-item";
            projectDiv.innerHTML = `
                <h3>Проект от ${project.date}</h3>
                <div class="history-details">
                    <p>Деталей: ${project.parts.length}</p>
                    <p>Работа: ${project.labor.toLocaleString("ru-RU")} ₽</p>
                </div>
                <div class="history-total">Итого: ${project.total.toLocaleString("ru-RU")} ₽</div>
            `;
            historyList.appendChild(projectDiv);
        });
    } else {
        const historyContainer = document.querySelector(".projects-history");
        historyContainer.classList.add("hidden");
    }
}

// Редактирование профиля
editProfileBtn.addEventListener("click", () => {
    profileDisplay.classList.add("hidden");
    profileEditForm.classList.remove("hidden");
});

cancelEditBtn.addEventListener("click", () => {
    profileDisplay.classList.remove("hidden");
    profileEditForm.classList.add("hidden");
    loadProfileData(); // Возвращаем исходные данные
});

// Загрузка аватара
avatarInput.addEventListener("change", function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith("image/")) {
        showNotification("Пожалуйста, выберите изображение", "error");
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        showNotification("Изображение должно быть меньше 5MB", "error");
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const imgData = e.target.result;
        
        // Показываем превью
        avatarPreview.src = imgData;
        avatarPreview.style.display = "block";
        avatarLetterEdit.style.display = "none";
        
        // Сохраняем в текущем пользователе
        const currentUser = userManager.getCurrentUser();
        if (currentUser) {
            currentUser.avatar = imgData;
            userManager.updateUser(currentUser);
            
            // Обновляем отображение аватара
            avatarDisplay.src = imgData;
            avatarDisplay.style.display = "block";
            avatarLetter.style.display = "none";
        }
    };
    reader.readAsDataURL(file);
});

// Удаление аватара
removeAvatarBtn.addEventListener("click", () => {
    const currentUser = userManager.getCurrentUser();
    if (currentUser) {
        currentUser.avatar = null;
        userManager.updateUser(currentUser);
        
        // Обновляем отображение
        avatarDisplay.style.display = "none";
        avatarLetter.style.display = "flex";
        avatarLetter.textContent = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "P";
        
        avatarPreview.style.display = "none";
        avatarLetterEdit.style.display = "flex";
        avatarLetterEdit.textContent = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "P";
    }
});

// Сохранение профиля
profileEditForm.addEventListener("submit", (e) => {
    e.preventDefault();
    
    const currentUser = userManager.getCurrentUser();
    if (!currentUser) return;
    
    currentUser.name = profileNameEdit.value.trim();
    currentUser.phone = profilePhoneEdit.value.trim();
    currentUser.city = profileCityEdit.value.trim();
    currentUser.car = profileCarEdit.value.trim();
    currentUser.experience = profileExperienceEdit.value;
    
    userManager.updateUser(currentUser);
    
    // Обновляем интерфейс
    setUserUI(currentUser);
    loadProfileData();
    
    // Возвращаемся к просмотру профиля
    profileDisplay.classList.remove("hidden");
    profileEditForm.classList.add("hidden");
    
    showNotification("Профиль сохранен", "success");
});

// Удаление всех сохраненных профилей
clearAllProfilesBtn.addEventListener("click", () => {
    if (confirm("Вы уверены, что хотите удалить все сохраненные профили для быстрого входа?")) {
        userManager.clearSavedProfiles();
        renderSavedProfiles();
        renderSavedUserList();
        showNotification("Все сохраненные профили удалены", "info");
    }
});

// ===== ЧАТ ПОДДЕРЖКИ =====
const supportForm = document.getElementById("support-form");
const chatWindow = document.getElementById("chat-window");
const adminSendBtn = document.getElementById("admin-send");
const adminAnswerInput = document.getElementById("admin-answer-text");
const adminControls = document.getElementById("admin-controls");
const userControls = document.getElementById("user-controls");

function loadChatMessages() {
    const chat = JSON.parse(localStorage.getItem("pt_chat") || "[]");
    const currentUser = userManager.getCurrentUser();
    
    chatWindow.innerHTML = "";
    
    if (chat.length === 0) {
        chatWindow.innerHTML = `
            <div class="chat-placeholder">
                <i class="fas fa-comment-dots"></i>
                <p>Здесь будут отображаться ваши сообщения с поддержкой</p>
            </div>
        `;
    } else {
        // Фильтруем сообщения: админ видит все, пользователь только свои
        const filteredChat = currentUser && currentUser.role === "admin" 
            ? chat 
            : chat.filter(m => m.userId === (currentUser?.id || '') || m.from === "admin");
        
        filteredChat.forEach(msg => {
            const div = document.createElement("div");
            div.classList.add("chat-message");
            div.classList.add(msg.from === "admin" ? "chat-message-admin" : "chat-message-user");
            
            const time = new Date(msg.timestamp || Date.now()).toLocaleTimeString("ru-RU", {
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const userName = msg.from === "admin" ? "Админ" : msg.userName || "Клиент";
            
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
    
    // Показываем/скрываем элементы управления в зависимости от роли
    if (currentUser && currentUser.role === "admin") {
        adminControls.classList.remove("hidden");
        userControls.classList.add("hidden");
    } else {
        adminControls.classList.add("hidden");
        userControls.classList.remove("hidden");
    }
}

supportForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const topic = document.getElementById("support-topic").value.trim();
    const message = document.getElementById("support-message").value.trim();
    const currentUser = userManager.getCurrentUser();
    
    if (!topic || !message) {
        showNotification("Заполните тему и сообщение", "warning");
        return;
    }
    
    if (!currentUser) {
        showNotification("Войдите в систему для отправки сообщения", "error");
        return;
    }
    
    const chat = JSON.parse(localStorage.getItem("pt_chat") || "[]");
    chat.push({
        from: "user",
        userId: currentUser.id,
        userName: currentUser.name,
        text: `Тема: ${topic}\n${message}`,
        timestamp: Date.now()
    });
    
    localStorage.setItem("pt_chat", JSON.stringify(chat));
    
    // Обновляем статистику пользователя
    const userStats = userManager.getUserStats(currentUser.id);
    userManager.updateUserStats(currentUser.id, {
        messages: (userStats?.messages || 0) + 1
    });
    
    loadChatMessages();
    supportForm.reset();
    
    showNotification("Сообщение отправлено", "success");
});

adminSendBtn.addEventListener("click", () => {
    const text = adminAnswerInput.value.trim();
    const currentUser = userManager.getCurrentUser();
    
    if (!text) return;
    
    if (!currentUser || currentUser.role !== "admin") {
        showNotification("Только администратор может отвечать", "error");
        return;
    }
    
    const chat = JSON.parse(localStorage.getItem("pt_chat") || "[]");
    chat.push({
        from: "admin",
        text: text,
        timestamp: Date.now()
    });
    
    localStorage.setItem("pt_chat", JSON.stringify(chat));
    loadChatMessages();
    adminAnswerInput.value = "";
    
    showNotification("Ответ отправлен", "success");
});

// ===== АУТЕНТИФИКАЦИЯ =====
const authOverlay = document.getElementById("auth-overlay");
const loginCard = document.getElementById("login-card");
const registerCard = document.getElementById("register-card");
const goRegister = document.getElementById("go-register");
const goLogin = document.getElementById("go-login");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");

goRegister.addEventListener("click", () => {
    loginCard.classList.add("hidden");
    registerCard.classList.remove("hidden");
});

goLogin.addEventListener("click", () => {
    registerCard.classList.add("hidden");
    loginCard.classList.remove("hidden");
});

registerForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("reg-name").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value;
    const remember = document.getElementById("remember-reg").checked;
    
    if (!name || !email || !password) {
        showNotification("Заполните все поля", "error");
        return;
    }
    
    try {
        const user = userManager.register({
            name,
            email,
            password
        }, remember);
        
        setUserUI(user);
        authOverlay.style.display = "none";
        
        showNotification(`Аккаунт создан, добро пожаловать, ${user.name}!`, "success");
    } catch (error) {
        showNotification(error.message, "error");
    }
});

loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;
    const remember = document.getElementById("remember-me").checked;
    
    try {
        const user = userManager.login(email, password, remember);
        setUserUI(user);
        authOverlay.style.display = "none";
        showNotification(`Добро пожаловать, ${user.name}!`, "success");
    } catch (error) {
        showNotification(error.message, "error");
    }
});

function setUserUI(user) {
    const name = user.name || "Гость";
    userNameTitle.textContent = name;
    
    // Обновляем данные профиля
    loadProfileData();
    updateProfileStats();
    
    // Загружаем проект пользователя
    loadProject();
    
    // Обновляем список сохраненных профилей
    renderSavedUserList();
}

// Выход пользователя
function logoutUser() {
    if (confirm("Вы уверены, что хотите выйти?")) {
        userManager.logout();
        authOverlay.style.display = "flex";
        projectParts = [];
        renderProject();
        showNotification("Вы успешно вышли из системы", "info");
    }
}

logoutBtn.addEventListener("click", logoutUser);
quickLogoutBtn.addEventListener("click", logoutUser);

// ===== УВЕДОМЛЕНИЯ =====
function showNotification(message, type = "info") {
    // Создаем элемент уведомления
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close"><i class="fas fa-times"></i></button>
    `;
    
    // Добавляем стили, если их еще нет
    if (!document.getElementById('notification-styles')) {
        const style = document.createElement("style");
        style.id = 'notification-styles';
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                background: #020617;
                border: 1px solid rgba(55, 65, 81, 0.8);
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
                z-index: 1000;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 15px;
                max-width: 350px;
                animation: slideIn 0.3s ease;
            }
            
            .notification-info {
                border-left: 4px solid #38bdf8;
            }
            
            .notification-success {
                border-left: 4px solid #22c55e;
            }
            
            .notification-warning {
                border-left: 4px solid #f97316;
            }
            
            .notification-error {
                border-left: 4px solid #ef4444;
            }
            
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
    
    // Добавляем обработчик закрытия
    notification.querySelector(".notification-close").addEventListener("click", () => {
        notification.remove();
    });
    
    // Автоматическое закрытие через 5 секунд
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

function getNotificationIcon(type) {
    switch(type) {
        case "success": return "check-circle";
        case "warning": return "exclamation-triangle";
        case "error": return "times-circle";
        default: return "info-circle";
    }
}

// ===== ИНИЦИАЛИЗАЦИЯ =====
(function init() {
    // Проверяем, есть ли текущий пользователь
    const currentUser = userManager.getCurrentUser();
    if (currentUser) {
        setUserUI(currentUser);
        authOverlay.style.display = "none";
    } else {
        authOverlay.style.display = "flex";
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
    showSection("home", false);
})();
