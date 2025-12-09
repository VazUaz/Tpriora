// ===== Навигация + кнопка "Назад" =====
const sections = document.querySelectorAll('.section');
const backBtn = document.getElementById('back-btn');
let historyStack = ['dashboard'];

function showSection(id, pushToHistory = true) {
    sections.forEach(sec => {
        sec.classList.toggle('active', sec.id === id);
    });

    if (pushToHistory) {
        const last = historyStack[historyStack.length - 1];
        if (last !== id) {
            historyStack.push(id);
        }
    }
    backBtn.disabled = historyStack.length <= 1;
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

// ===== Каталог: фильтрация + сортировка по цене =====

function setupCatalog(section) {
    const grid = section.querySelector('.catalog-grid');
    if (!grid) return;

    const cards = Array.from(grid.querySelectorAll('.part-card'));
    const categorySelect = section.querySelector('.filter-category');
    const sortSelect = section.querySelector('.filter-sort');

    const initialOrder = cards.slice(); // изначальный порядок

    function applyFilters() {
        const typeValue = categorySelect ? categorySelect.value : 'all';
        let currentCards = initialOrder.slice();

        // Фильтр по типу
        if (typeValue !== 'all') {
            currentCards = currentCards.filter(card => card.dataset.type === typeValue);
        }

        // Сортировка по цене
        const sortValue = sortSelect ? sortSelect.value : 'default';
        if (sortValue === 'asc' || sortValue === 'desc') {
            currentCards.sort((a, b) => {
                const pa = Number(a.dataset.price);
                const pb = Number(b.dataset.price);
                return sortValue === 'asc' ? pa - pb : pb - pa;
            });
        }

        // Перерисовка
        grid.innerHTML = '';
        currentCards.forEach(card => grid.appendChild(card));
    }

    if (categorySelect) {
        categorySelect.addEventListener('change', applyFilters);
    }
    if (sortSelect) {
        sortSelect.addEventListener('change', applyFilters);
    }
}

document.querySelectorAll('[data-category]').forEach(setupCatalog);

// ===== Проект + калькулятор =====

const projectItems = document.getElementById('project-items');
const partsSumSpan = document.getElementById('parts-sum');
const totalSumSpan = document.getElementById('total-sum');
const laborInput = document.getElementById('labor-input');

let projectParts = []; // { name, price }

function renderProject() {
    if (!projectItems) return;

    projectItems.innerHTML = '';
    let partsSum = 0;

    projectParts.forEach(part => {
        partsSum += part.price;
        const li = document.createElement('li');
        li.innerHTML =
            `<span>${part.name}</span><span>${part.price.toLocaleString('ru-RU')} ₽</span>`;
        projectItems.appendChild(li);
    });

    partsSumSpan.textContent = partsSum.toLocaleString('ru-RU');

    const labor = Number(laborInput.value) || 0;
    const total = partsSum + labor;
    totalSumSpan.textContent = total.toLocaleString('ru-RU');
}

// Добавление деталей
document.querySelectorAll('.add-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const card = btn.closest('.part-card');
        const name = card.dataset.name;
        const price = Number(card.dataset.price);

        projectParts.push({ name, price });
        renderProject();
        alert(`Компонент "${name}" добавлен в проект.`);
    });
});

laborInput.addEventListener('input', renderProject);

document.getElementById('clear-project').addEventListener('click', () => {
    if (confirm('Очистить текущий проект?')) {
        projectParts = [];
        renderProject();
    }
});

document.getElementById('export-estimate').addEventListener('click', () => {
    alert('Здесь можно реализовать экспорт в PDF или отправку сметы на email.');
});

// ===== Профиль / выход =====

const logoutBtn = document.getElementById('logout-btn');
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('pt_user');
    location.reload();
});

// ===== Аутентификация (вход / регистрация, хранение в localStorage) =====

const authOverlay = document.getElementById('auth-overlay');
const loginCard = document.getElementById('login-card');
const registerCard = document.getElementById('register-card');
const goRegister = document.getElementById('go-register');
const goLogin = document.getElementById('go-login');

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

const userNameTitle = document.getElementById('user-name-title');
const profileName = document.getElementById('profile-name');
const profileEmail = document.getElementById('profile-email');
const avatarLetter = document.getElementById('avatar-letter');

function setUserUI(user) {
    const name = user.name || 'Гость';
    const email = user.email || '-';

    userNameTitle.textContent = name;
    profileName.textContent = name;
    profileEmail.textContent = email;
    avatarLetter.textContent = name.charAt(0).toUpperCase();
}

// переключение форм
goRegister.addEventListener('click', () => {
    loginCard.classList.add('hidden');
    registerCard.classList.remove('hidden');
});

goLogin.addEventListener('click', () => {
    registerCard.classList.add('hidden');
    loginCard.classList.remove('hidden');
});

// регистрация
registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    if (!name || !email || !password) return;

    const user = { name, email, password };
    localStorage.setItem('pt_user', JSON.stringify(user));
    setUserUI(user);
    authOverlay.style.display = 'none';
    alert('Аккаунт создан, вход выполнен.');
});

// вход
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    const saved = localStorage.getItem('pt_user');
    if (!saved) {
        alert('Пользователь не найден. Зарегистрируйтесь.');
        return;
    }
    const user = JSON.parse(saved);
    if (user.email === email && user.password === password) {
        setUserUI(user);
        authOverlay.style.display = 'none';
    } else {
        alert('Неверный email или пароль.');
    }
});

// Проверка сохранённого пользователя при загрузке
(function initAuth() {
    const saved = localStorage.getItem('pt_user');
    if (saved) {
        const user = JSON.parse(saved);
        setUserUI(user);
        authOverlay.style.display = 'none';
    } else {
        authOverlay.style.display = 'flex';
    }
})();

// старт
renderProject();
showSection('dashboard', false);
