document.addEventListener('DOMContentLoaded', async () => {
    // ВСТАВЬТЕ СВОИ ДАННЫЕ ИЗ SUPABASE МЕЖДУ КАВЫЧКАМИ
    const SUPABASE_URL = "https://fbyhbbnboogmmeyrqbnn.supabase.co"; 
    const SUPABASE_KEY = "sb_publishable_bY8O3jbGeWwDkOAW7k33vA_Tvw-GpXD"; 

    // Никаких скачиваний из интернета! Берём готовую библиотеку supabase.js прямо из HTML
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    let currentSortMode = 'popular';
    let userMods = [];
    let favorites = JSON.parse(localStorage.getItem('favMods')) || [];
    let loggedInUser = JSON.parse(localStorage.getItem('currentSession')) || null;
    let emailBeingReset = null;

    if (localStorage.getItem('isAdmin') === 'true') {
        document.body.classList.add('admin-mode');
    }

    const cardsGrid = document.querySelector('.cards-grid');
    const favoritesGrid = document.getElementById('favorites-grid');
    const authBtn = document.querySelector('.auth-btn');
    const authModal = document.getElementById('auth-modal');

    const confirmModal = document.getElementById('confirm-modal');
    const confirmText = document.getElementById('confirm-modal-text');
    const confirmYes = document.getElementById('confirm-modal-yes');
    const confirmNo = document.getElementById('confirm-modal-no');

    const alertModal = document.getElementById('alert-modal');
    const alertText = document.getElementById('alert-modal-text');
    const alertClose = document.getElementById('alert-modal-close');

    function getYouTubeId(url) {
        if (!url) return null;
        try {
            const regExp = /^.*(?:(?:youtu\.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
            const match = url.match(regExp);
            return (match && match.length === 11) ? match : null;
        } catch (e) { return null; }
    }

    function openCustomConfirm(text, onYes) {
        if (!confirmModal || !confirmText) return;
        confirmText.textContent = text;
        confirmModal.style.display = 'flex';
        setTimeout(() => confirmModal.classList.add('show'), 10);
        confirmYes.onclick = () => { onYes(); closeConfirm(); };
        confirmNo.onclick = () => { closeConfirm(); };
    }

    function closeConfirm() {
        if (!confirmModal) return;
        confirmModal.classList.remove('show');
        setTimeout(() => { confirmModal.style.display = 'none'; }, 300);
    }

    function openCustomAlert(text, onCloseAction = null) {
        if (!alertModal || !alertText) return;
        alertText.textContent = text;
        alertModal.style.display = 'flex';
        setTimeout(() => alertModal.classList.add('show'), 10);
        alertClose.onclick = () => {
            alertModal.classList.remove('show');
            setTimeout(() => { alertModal.style.display = 'none'; if (onCloseAction) onCloseAction(); }, 300);
        };
    }

    function updateAuthButtonText() {
        if (!authBtn) return;
        if (localStorage.getItem('isAdmin') === 'true') {
            authBtn.textContent = 'Выйти (Админ)';
        } else if (loggedInUser) {
            authBtn.textContent = 'Выйти (' + loggedInUser.username + ')';
        } else {
            authBtn.textContent = 'Войти';
        }
    }
    updateAuthButtonText();

    function createCardHtml(mod, targetGrid, isFavPage = false) {
        const isLiked = favorites.includes(mod.title);
        const card = document.createElement('div');
        card.className = 'card';
        card.setAttribute('data-id', mod.id);
        card.setAttribute('data-title', mod.title);

        const previewImg = "crekedmodsimg.jpg"; 

        card.innerHTML = `
            <div class="card-image">
                <img src="${previewImg}" alt="${mod.title}">
                <div class="card-image-overlay"></div>
                <div class="play-icon-overlay">▶</div>
            </div>
            <div class="card-info">
                <div class="card-header-row">
                    <div class="card-title">${mod.title}</div>
                    <div class="like-icon ${isLiked ? 'active' : ''}">❤</div>
                </div>
                <div class="card-meta">${mod.author} // <span>${mod.category}</span></div>
                <div class="card-desc" style="color: #aaaaaa; font-size: 11px; margin: 8px 0; line-height: 1.4; min-height: 30px;">${mod.description || 'Описание отсутствует.'}</div>
                <div class="card-date">Загрузок: <span class="downloads-count">${mod.downloads || 0}</span> // ${mod.date}</div>
                <a href="${mod.file_url}" target="_blank" class="download-btn">Скачать файл</a>
                ${localStorage.getItem('isAdmin') === 'true' ? '<button class="admin-delete-btn">Удалить мод</button>' : ''}
            </div>
        `;

        const downloadBtn = card.querySelector('.download-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', async () => {
                mod.downloads = (mod.downloads || 0) + 1;
                await supabaseClient.from('mods').update({ downloads: mod.downloads }).match({ id: mod.id });
                const countSpan = card.querySelector('.downloads-count');
                if (countSpan) countSpan.textContent = mod.downloads;
            });
        }

        const imageBlock = card.querySelector('.card-image');
        if (imageBlock && mod.video_url) {
            imageBlock.addEventListener('click', () => {
                window.open(mod.video_url, '_blank');
            });
        }

        const likeBtn = card.querySelector('.like-icon');
        likeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            likeBtn.classList.toggle('active');
            if (likeBtn.classList.contains('active')) {
                if (!favorites.includes(mod.title)) favorites.push(mod.title);
            } else {
                favorites = favorites.filter(t => t !== mod.title);
                if (isFavPage || (targetGrid && targetGrid.id === 'favorites-grid')) {
                    card.remove();
                }
            }
            localStorage.setItem('favMods', JSON.stringify(favorites));
            if (favoritesGrid && favoritesGrid.children.length === 0) {
                favoritesGrid.innerHTML = '<p style="color: #444; grid-column: 1/-1; text-align: center; padding: 40px 0;">Избранных модов пока нет.</p>';
            }
        });

        const deleteBtn = card.querySelector('.admin-delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                openCustomConfirm('Удалить модификацию из облака "' + mod.title + '"?', async () => {
                    await supabaseClient.from('mods').delete().match({ id: mod.id });
                    favorites = favorites.filter(t => t !== mod.title);
                    localStorage.setItem('favMods', JSON.stringify(favorites));
                    card.remove();
                    if (favoritesGrid && favoritesGrid.children.length === 0) {
                        favoritesGrid.innerHTML = '<p style="color: #444; grid-column: 1/-1; text-align: center; padding: 40px 0;">Избранных модов пока нет.</p>';
                    }
                    if (cardsGrid && cardsGrid.children.length === 0) {
                        cardsGrid.innerHTML = '<p style="color: #444; grid-column: 1/-1; text-align: center; padding: 40px 0;">Модификаций в этой категории пока нет. Будьте первым!</p>';
                    }
                });
            });
        }
        targetGrid.appendChild(card);
    }

    async function fetchAndRenderMods() {
        if (!supabaseClient) return;
        const { data, error } = await supabaseClient.from('mods').select('*');
        if (error) { console.error(error); return; }
        userMods = data || [];

        if (cardsGrid) {
            cardsGrid.innerHTML = '';
            const path = window.location.pathname;
            let filtered = [...userMods];

            if (path.includes('redux.html')) filtered = filtered.filter(m => m.category === 'Redux');
            if (path.includes('gunpack.html')) filtered = filtered.filter(m => m.category === 'Gunpack');
            if (path.includes('sounds.html')) filtered = filtered.filter(m => m.category === 'Sounds');
            if (path.includes('other.html')) filtered = filtered.filter(m => m.category === 'Other');

            if (currentSortMode === 'new') {
                filtered.sort((a, b) => b.id - a.id);
            } else if (currentSortMode === 'popular') {
                filtered.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
            }

            if (filtered.length === 0) {
                cardsGrid.innerHTML = '<p style="color: #444; grid-column: 1/-1; text-align: center; padding: 40px 0;">Модификаций в этой категории пока нет. Будьте первым!</p>';
            } else {
                filtered.forEach(mod => createCardHtml(mod, cardsGrid, false));
            }
        }

        if (favoritesGrid) {
            favoritesGrid.innerHTML = '';
            const savedLikes = JSON.parse(localStorage.getItem('favMods')) || [];
            const favList = userMods.filter(mod => mod && mod.title && savedLikes.includes(mod.title));

            if (favList.length === 0) {
                favoritesGrid.innerHTML = '<p style="color: #444; grid-column: 1/-1; text-align: center; padding: 40px 0;">Избранных модов пока нет.</p>';
            } else {
                const uniqueFavList = favList.filter((mod, index, self) => self.findIndex(m => m.title === mod.title) === index);
                uniqueFavList.forEach(mod => createCardHtml(mod, favoritesGrid, true));
            }
        }
    }

    const btnNew = document.getElementById('filter-new');
    const btnPopular = document.getElementById('filter-popular');

    if (btnNew && btnPopular) {
        btnNew.addEventListener('click', () => {
            currentSortMode = 'new';
            btnNew.classList.add('active'); btnPopular.classList.remove('active');
            fetchAndRenderMods();
        });

        btnPopular.addEventListener('click', () => {
            currentSortMode = 'popular';
            btnPopular.classList.add('active'); btnNew.classList.remove('active');
            fetchAndRenderMods();
        });
    }

    try { fetchAndRenderMods(); } catch (e) { console.error(e); }

    const searchInput = document.querySelector('.search-box');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const text = e.target.value.toLowerCase().trim();
            document.querySelectorAll('.cards-grid .card').forEach(card => {
                const title = card.getAttribute('data-title').toLowerCase();
                card.style.display = title.includes(text) ? '' : 'none';
            });
        });
    }

    if (authBtn && authModal) {
        const hideAllForms = () => {
            document.getElementById('login-form').classList.add('hidden');
            document.getElementById('register-form').classList.add('hidden');
            document.getElementById('recover-form').classList.add('hidden');
            document.getElementById('reset-password-form').classList.add('hidden');
            document.getElementById('tab-login').classList.remove('active');
            document.getElementById('tab-register').classList.remove('active');
        };

        authBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (loggedInUser || localStorage.getItem('isAdmin') === 'true') {
                openCustomConfirm('Вы точно хотите выйти из аккаунта?', () => {
                    localStorage.removeItem('isAdmin');
                    localStorage.removeItem('currentSession');
                    window.location.reload();
                });
                return;
            }
            hideAllForms();
            authModal.style.display = 'flex';
            document.getElementById('tab-login').classList.add('active');
            document.getElementById('login-form').classList.remove('hidden');
            setTimeout(() => authModal.classList.add('show'), 10);
        });

        const modalCloseBtn = authModal.querySelector('.close-modal, .close-add-modal, span[class*="close"]');
        if (modalCloseBtn) {
            modalCloseBtn.addEventListener('click', () => {
                authModal.classList.remove('show');
                setTimeout(() => { authModal.style.display = 'none'; }, 300);
            });
        }

        document.getElementById('tab-login').addEventListener('click', () => {
            hideAllForms();
            document.getElementById('tab-login').classList.add('active');
            document.getElementById('login-form').classList.remove('hidden');
        });

        document.getElementById('tab-register').addEventListener('click', () => {
            if (localStorage.getItem('hasRegisteredAccount') === 'true') {
                openCustomAlert('Ошибка безопасности! С этого устройства уже зарегистрирован один аккаунт.');
                return;
            }
            hideAllForms();
            document.getElementById('tab-register').classList.add('active');
            document.getElementById('register-form').classList.remove('hidden');
        });

        document.getElementById('forgot-password-link').addEventListener('click', (e) => {
            e.preventDefault(); hideAllForms();
            document.getElementById('recover-form').classList.remove('hidden');
        });

        document.getElementById('back-to-login-link').addEventListener('click', (e) => {
            e.preventDefault(); document.getElementById('tab-login').click();
        });

        // ПУЛЕНЕПРОБИВАЕМЫЙ ВХОД: СКАЧИВАЕМ ТАБЛИЦУ И СВЕРЯЕМ В JS
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value.trim();
            const pass = document.getElementById('login-password').value.trim();

            if (email === 'admin@creked.mods' && pass === 'admin123') {
                localStorage.setItem('isAdmin', 'true');
                openCustomAlert('Доступ администратора подтвержден!', () => { window.location.reload(); });
                return;
            }

            if (!supabaseClient) return;

            const { data } = await supabaseClient.from('users').select('*');
            const users = data || [];
            const user = users.find(u => u.email === email && u.password === pass);

            if (user) {
                localStorage.setItem('currentSession', JSON.stringify(user));
                openCustomAlert('Добро пожаловать назад, ' + user.username + '!', () => { window.location.reload(); });
            } else {
                openCustomAlert('Ошибка! Неверный Email или Пароль.');
            }
        });

        function validatePassword(password) {
            if (password.length < 6) return 'Пароль должен содержать минимум 6 символов.';
            const halfLength = password.length / 2;
            if (password.substring(0, halfLength) === password.substring(halfLength)) return 'Слишком простой пароль (повторения).';
            let isSequential = true, isReverseSequential = true;
            for (let i = 0; i < password.length - 1; i++) {
                if (password.charCodeAt(i + 1) !== password.charCodeAt(i) + 1) isSequential = false;
                if (password.charCodeAt(i + 1) !== password.charCodeAt(i) - 1) isReverseSequential = false;
            }
            if (isSequential || isReverseSequential) return 'Запрещены простые последовательности (123456).';
            return null;
        }

        // РЕГИСТРАЦИЯ
        document.getElementById('register-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (localStorage.getItem('hasRegisteredAccount') === 'true') return;

            const username = document.getElementById('reg-username').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const password = document.getElementById('reg-password').value.trim();
            const secretWord = document.getElementById('reg-secret').value.trim().toLowerCase();

            const passwordError = validatePassword(password);
            if (passwordError) { openCustomAlert(passwordError); return; }

            if (!supabaseClient) return;

            const { data: users } = await supabaseClient.from('users').select('email');
            if (users && users.some(u => u.email === email)) {
                openCustomAlert('Пользователь с таким Email уже существует!');
                return;
            }

            await supabaseClient.from('users').insert([{ username, email, password, secret_word: secretWord }]);
            localStorage.setItem('hasRegisteredAccount', 'true');
            openCustomAlert('Регистрация успешна!', () => { document.getElementById('tab-login').click(); });
        });

        // ВОССТАНОВЛЕНИЕ ДОСТУПА И СМЕНА ПАРОЛЯ
        document.getElementById('recover-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('recover-email').value.trim();
            const secret = document.getElementById('recover-secret').value.trim().toLowerCase();

            if (!supabaseClient) return;

            const { data } = await supabaseClient.from('users').select('*');
            const users = data || [];
            const user = users.find(u => u.email === email && u.secret_word === secret);

            if (user) {
                emailBeingReset = email; hideAllForms();
                document.getElementById('reset-password-form').classList.remove('hidden');
            } else { openCustomAlert('Ошибка! Данные проверки не совпадают.'); }
        });

        document.getElementById('reset-password-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPassword = document.getElementById('reset-new-password').value.trim();
            const passwordError = validatePassword(newPassword);
            if (passwordError) { openCustomAlert(passwordError); return; }

            if (!supabaseClient) return;
            await supabaseClient.from('users').update({ password: newPassword }).match({ email: emailBeingReset });
            document.getElementById('reset-new-password').value = '';
            openCustomAlert('Пароль изменен!', () => { emailBeingReset = null; document.getElementById('tab-login').click(); });
        });
    }

    // ПУБЛИКАЦИЯ МОДОВ И СЕЛЕКТЫ
    const addBtn = document.querySelector('.add-mod-trigger-btn');
    const addModal = document.getElementById('add-mod-modal');
    if (addBtn && addModal) {
        addBtn.addEventListener('click', (e) => {
            const isAdmin = localStorage.getItem('isAdmin') === 'true';
            if (!loggedInUser && !isAdmin) {
                e.preventDefault(); openCustomAlert('Публикация доступна только вошедшим пользователям!');
                return;
            }

            if (!isAdmin && loggedInUser) {
                const lastPostTime = localStorage.getItem('lastPostTime_' + loggedInUser.email);
                if (lastPostTime) {
                    const timePassed = Date.now() - parseInt(lastPostTime);
                    const oneHour = 60 * 60 * 1000;
                    if (timePassed < oneHour) {
                        e.preventDefault();
                        const minutesLeft = Math.ceil((oneHour - timePassed) / (60 * 1000));
                        openCustomAlert('Лимит превышен! Подождите еще: ' + minutesLeft + ' мин.');
                        return;
                    }
                }
            }
            addModal.style.display = 'flex';
            setTimeout(() => addModal.classList.add('show'), 10);
        });

        const closeAddModalBtn = document.querySelector('.close-add-modal');
        if (closeAddModalBtn) {
            closeAddModalBtn.addEventListener('click', () => {
                addModal.classList.remove('show'); setTimeout(() => addModal.style.display = 'none', 300);
            });
        }

        document.getElementById('add-mod-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const isAdmin = localStorage.getItem('isAdmin') === 'true';
            const currentAuthor = isAdmin ? 'Администратор' : loggedInUser.username;

            if (!isAdmin && loggedInUser) {
                localStorage.setItem('lastPostTime_' + loggedInUser.email, Date.now());
            }

            const newModObj = {
id: Date.now(),title: document.getElementById('mod-title').value.trim(),description: document.getElementById('mod-description').value.trim(),author: currentAuthor,category: document.getElementById('mod-category').value,video_url: document.getElementById('mod-youtube-url').value.trim(),file_url: document.getElementById('mod-file-url').value.trim(),date: new Date().toLocaleDateString('ru-RU'),downloads: 0};if (supabaseClient) {await supabaseClient.from('mods').insert([newModObj]);if (typeof fetchAndRenderMods === 'function') await fetchAndRenderMods();}e.target.reset();addModal.classList.remove('show'); setTimeout(() => addModal.style.display = 'none', 300);});}const customSelect = document.getElementById('custom-select-block');if (customSelect) {const trigger = customSelect.querySelector('.select-trigger');const hiddenInput = document.getElementById('mod-category');const options = customSelect.querySelectorAll('.select-option-item');trigger.addEventListener('click', (e) => {e.stopPropagation(); customSelect.classList.toggle('active');});options.forEach(option => {option.addEventListener('click', (e) => {e.stopPropagation();const value = option.getAttribute('data-value');const text = option.textContent;trigger.innerHTML = text + ' ▼';hiddenInput.value = value;options.forEach(opt => opt.classList.remove('selected'));option.classList.add('selected'); customSelect.classList.remove('active');});});window.addEventListener('click', () => { customSelect.classList.remove('active'); });}const currentPath = window.location.pathname;document.querySelectorAll('a[href$=".html"]').forEach(link => {link.addEventListener('click', (e) => {const targetUrl = link.getAttribute('href');if (currentPath.endsWith(targetUrl) || (currentPath === '/' && targetUrl === 'index.html')) return;e.preventDefault();document.body.classList.remove('page-loaded');document.body.classList.add('page-leaving');setTimeout(() => { window.location.href = targetUrl; }, 250);});});});