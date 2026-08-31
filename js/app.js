// Главный JavaScript файл - безопасная версия без прямого доступа к БД и вебхукам

// Авторизация и сессия
let currentUser = null;
let currentSession = null;

// Discord OAuth2 конфигурация
const DISCORD_CLIENT_ID = '1543983652948410419';
const DISCORD_REDIRECT_URI = 'https://fsvng-province.vercel.app'; // Без слеша в конце

// Вопросы анкеты набора
const recruitQuestions = [
  { type: 'text', label: 'Ваш юзернейм в дискорде.' },
  { type: 'text', label: 'Ваш юзернейм в роблоксе.' },
  { type: 'text', label: 'Ваше имя.' },
  { type: 'text', label: 'Ваш возраст.' },
  { type: 'text', label: 'Ваш часовой пояс.' },
  { type: 'text', label: 'Сколько времени готовы уделять фракции?' },
  {
    type: 'choice',
    label: 'В какое подразделение хотите? (ОВО, ОМОН "Бастион", СОБР "Рысь", ОСН "Гром", ДЧ, ОСБ), при поступлении в СОБР "Рысь", ОСН "Гром" переходите к ним на сервер.',
    options: ['ОВО', 'ОМОН "Бастион"', 'СОБР "Рысь"', 'ОСН "Гром"', 'ДЧ', 'ОСБ']
  },
  { type: 'text', label: 'Ваше ФИО.', sectionBreak: true },
  { type: 'text', label: 'Ваша дата рождения ("ХХ.ХХ.ХХХХ").' },
  { type: 'text', label: 'Ваше место рождения' },
  { type: 'text', label: 'Место проживания или временной регистрации.' },
  { type: 'text', label: 'Ваша биография (не менее 5 предложений).' }
];

const recruitAnswers = {};
const RECRUIT_BANNER_URL = 'https://cdn.phototourl.com/free/2026-08-29-1f960f4c-f812-4bfc-8383-b647ef8ce7f0.png';

const recruitContentEl = document.getElementById('recruitContent');
let currentAdminCode = null;

/* ==================== АВТОРИЗАЦИЯ ==================== */
async function initAuth() {
  // Проверяем, есть ли код авторизации в URL
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');

  if (code) {
    // Обмениваем код на сессию
    try {
      const response = await fetch(`/api/auth?code=${code}`);
      const data = await response.json();

      if (data.sessionId) {
        localStorage.setItem('sessionId', data.sessionId);
        currentSession = data.sessionId;
        currentUser = data.user;
        updateAuthUI();

        // Очищаем URL от кода
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (error) {
      console.error('Auth error:', error);
    }
  } else {
    // Проверяем существующую сессию
    const sessionId = localStorage.getItem('sessionId');
    if (sessionId) {
      try {
        const response = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        });

        if (response.ok) {
          const data = await response.json();
          currentSession = sessionId;
          currentUser = data.user;
          updateAuthUI();
        } else {
          localStorage.removeItem('sessionId');
        }
      } catch (error) {
        console.error('Session check error:', error);
        localStorage.removeItem('sessionId');
      }
    }
  }

  // Показываем кнопку входа, если не авторизованы
  if (!currentUser) {
    document.getElementById('loginBtn').style.display = 'inline-block';
  }
}

function updateAuthUI() {
  const loginBtn = document.getElementById('loginBtn');
  const userProfile = document.getElementById('userProfile');
  const userAvatar = document.getElementById('userAvatar');
  const userNick = document.getElementById('userNick');
  const dropdownAvatar = document.getElementById('dropdownAvatar');
  const dropdownNick = document.getElementById('dropdownNick');
  const dropdownStatus = document.getElementById('dropdownStatus');
  const dropdownRank = document.getElementById('dropdownRank');

  if (currentUser) {
    loginBtn.style.display = 'none';
    userProfile.style.display = 'inline-block';

    const displayName = currentUser.username + (currentUser.discriminator !== '0' ? '#' + currentUser.discriminator : '');

    userAvatar.src = currentUser.avatar;
    userNick.textContent = displayName;
    dropdownAvatar.src = currentUser.avatar;
    dropdownNick.textContent = displayName;
    dropdownStatus.textContent = currentUser.status || 'Пользователь';
    dropdownRank.textContent = currentUser.rank || 'Без звания';
  } else {
    loginBtn.style.display = 'inline-block';
    userProfile.style.display = 'none';
  }
}

function loginWithDiscord() {
  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}&response_type=code&scope=identify`;
  window.location.href = authUrl;
}

function logout() {
  localStorage.removeItem('sessionId');
  currentSession = null;
  currentUser = null;
  updateAuthUI();
  document.getElementById('profileDropdown').style.display = 'none';
}

// Обработка клика по профилю
document.getElementById('userProfile')?.addEventListener('click', () => {
  const dropdown = document.getElementById('profileDropdown');
  dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
});

// Закрытие дропдауна при клике вне его
document.addEventListener('click', (e) => {
  const userProfile = document.getElementById('userProfile');
  const dropdown = document.getElementById('profileDropdown');
  if (!userProfile?.contains(e.target) && !dropdown?.contains(e.target)) {
    dropdown.style.display = 'none';
  }
});

document.getElementById('loginBtn')?.addEventListener('click', loginWithDiscord);
document.getElementById('logoutBtn')?.addEventListener('click', logout);

// Год в футере
const yearSpan = document.getElementById('currentYear');
if (yearSpan) {
  yearSpan.textContent = new Date().getFullYear();
}
document.querySelectorAll('.currentYear').forEach(el => {
  el.textContent = new Date().getFullYear();
});

/* ==================== НАБОР ==================== */
async function getRecruitStatus() {
  try {
    const response = await fetch('/api/recruitment');
    const data = await response.json();
    return data.open;
  } catch (e) {
    console.error('Ошибка проверки статуса набора:', e);
    return true;
  }
}

function renderRecruitClosed() {
  recruitContentEl.style.display = 'block';
  recruitContentEl.style.textAlign = 'center';
  recruitContentEl.innerHTML = '<div class="recruit-status">Набор закрыт</div>';
}

function renderRecruitForm() {
  recruitContentEl.style.display = 'block';
  recruitContentEl.style.textAlign = 'center';

  let html = `<img class="recruit-banner" src="${RECRUIT_BANNER_URL}" alt="Анкета набора">`;
  html += `<form class="recruit-form-wrap" id="recruitForm">`;

  recruitQuestions.forEach((q, i) => {
    if (q.sectionBreak) {
      html += `<div class="form-divider"></div><div class="form-section-label">IC часть анкеты</div>`;
    }

    html += `<div class="form-question-box">`;
    html += `<div class="form-question-label">${q.label}</div>`;

    if (q.type === 'choice') {
      html += `<div class="form-choice-list" data-qindex="${i}">`;
      q.options.forEach((opt, oi) => {
        html += `<div class="form-choice-option" data-qindex="${i}" data-value="${opt.replace(/"/g, '&quot;')}">
          <div class="form-choice-circle"></div>
          <div class="form-choice-text">${opt}</div>
        </div>`;
      });
      html += `</div>`;
    } else {
      html += `<textarea class="form-answer-input" data-qindex="${i}" rows="1" placeholder="Ответ"></textarea>`;
    }

    html += `</div>`;
  });

  html += `<button type="submit" class="form-submit-btn" id="recruitSubmitBtn">Отправить</button>`;
  html += `<div class="form-message" id="recruitFormMessage" style="display:none;"></div>`;
  html += `</form>`;

  recruitContentEl.innerHTML = html;

  recruitContentEl.querySelectorAll('.form-answer-input').forEach(ta => {
    ta.addEventListener('input', () => {
      recruitAnswers[ta.dataset.qindex] = ta.value;
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    });
  });

  recruitContentEl.querySelectorAll('.form-choice-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const qi = opt.dataset.qindex;
      recruitContentEl.querySelectorAll(`.form-choice-option[data-qindex="${qi}"]`).forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      recruitAnswers[qi] = opt.dataset.value;
    });
  });

  document.getElementById('recruitForm').addEventListener('submit', handleRecruitSubmit);
}

async function handleRecruitSubmit(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('recruitSubmitBtn');
  const msgEl = document.getElementById('recruitFormMessage');

  submitBtn.disabled = true;

  const stillOpen = await getRecruitStatus();
  if (!stillOpen) {
    renderRecruitClosed();
    return;
  }

  const answers = recruitQuestions.map((q, i) => ({
    question: q.label,
    answer: (recruitAnswers[i] || '').toString().trim() || '—'
  }));

  try {
    const response = await fetch('/api/submit-recruit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers })
    });

    if (response.ok) {
      recruitContentEl.innerHTML = '<div class="recruit-status" style="font-size:1.8rem;">Заявка отправлена!</div>';
    } else {
      throw new Error('Server error');
    }
  } catch (err) {
    console.error('Ошибка отправки анкеты:', err);
    msgEl.textContent = 'Не удалось отправить заявку. Попробуйте ещё раз.';
    msgEl.style.display = 'block';
    submitBtn.disabled = false;
  }
}

async function openRecruitPage() {
  document.body.classList.add('recruit-open');
  recruitContentEl.innerHTML = '<div class="recruit-status">Загрузка...</div>';
  const isOpen = await getRecruitStatus();
  if (isOpen) {
    renderRecruitForm();
  } else {
    renderRecruitClosed();
  }
}

/* ==================== НОВОСТИ ==================== */
async function loadNews() {
  const newsList = document.getElementById('newsList');
  try {
    const response = await fetch('/api/news');
    const data = await response.json();
    const newsData = data.news || [];

    if (newsData.length === 0) {
      newsList.innerHTML = '<div class="news-empty">Новостей пока нет</div>';
      return;
    }

    newsList.innerHTML = newsData.map(item => `
      <article class="news-item">
        ${item.image ? `
          <div class="news-item-image" onclick="openImageModal('${item.image}')">
            <img src="${item.image}" alt="Фото новости">
          </div>
        ` : ''}
        <div class="news-item-body">
          <p class="news-item-text">${item.text}</p>
          <div class="news-item-time">${item.time}</div>
        </div>
      </article>
    `).join('');
  } catch (error) {
    console.error("Ошибка загрузки новостей:", error);
    newsList.innerHTML = '<div class="news-empty">Ошибка загрузки новостей</div>';
  }
}

window.openImageModal = function(src) {
  const imageModal = document.getElementById('imageModal');
  const imageModalImg = document.getElementById('imageModalImg');
  imageModalImg.src = src;
  imageModal.classList.add('active');
}

/* ==================== АДМИН ПАНЕЛЬ ==================== */
async function refreshRecruitmentStatusUI() {
  const statusEl = document.getElementById('recruitmentStatusText');
  statusEl.textContent = '...';
  const isOpen = await getRecruitStatus();
  statusEl.textContent = isOpen ? 'Открыт' : 'Закрыт';
  statusEl.style.color = isOpen ? 'var(--amber)' : 'var(--brick)';
}

async function loadDeleteNewsList() {
  const deleteNewsList = document.getElementById('deleteNewsList');
  try {
    const response = await fetch('/api/news');
    const data = await response.json();
    const newsData = data.news || [];

    if (newsData.length === 0) {
      deleteNewsList.innerHTML = '<div class="delete-news-empty">Новостей нет</div>';
      return;
    }

    deleteNewsList.innerHTML = newsData.map((item) => `
      <div class="delete-news-item">
        ${item.image ? `<img src="${item.image}" alt="Миниатюра" class="delete-news-thumb">` : ''}
        <div class="delete-news-info">
          <div class="delete-news-text">${item.text}</div>
          <div class="delete-news-time">${item.time}</div>
        </div>
        <button class="delete-news-btn" onclick="deleteNews('${item.docId}')">Удалить</button>
      </div>
    `).join('');
  } catch (error) {
    console.error("Ошибка загрузки списка:", error);
    deleteNewsList.innerHTML = '<div class="delete-news-empty">Ошибка загрузки</div>';
  }
}

window.deleteNews = async function(docId) {
  if (!currentAdminCode) {
    alert('Ошибка авторизации');
    return;
  }

  try {
    const response = await fetch('/api/news', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': currentAdminCode
      },
      body: JSON.stringify({ docId })
    });

    if (response.ok) {
      loadDeleteNewsList();
    } else {
      alert('Ошибка удаления новости');
    }
  } catch (error) {
    console.error("Ошибка удаления:", error);
    alert('Ошибка удаления новости');
  }
}

/* ==================== УПРАВЛЕНИЕ ИГРОКАМИ ==================== */
async function loadPlayersList() {
  const playersList = document.getElementById('playersList');
  playersList.innerHTML = '<div style="text-align: center; color: var(--khaki-dim); padding: 40px;">Загрузка...</div>';

  try {
    const response = await fetch('/api/users', {
      headers: { 'Authorization': currentSession }
    });

    if (!response.ok) {
      throw new Error('Failed to load users');
    }

    const data = await response.json();
    const users = data.users || [];

    if (users.length === 0) {
      playersList.innerHTML = '<div style="text-align: center; color: var(--khaki-dim); padding: 40px;">Нет зарегистрированных игроков</div>';
      return;
    }

    playersList.innerHTML = users.map(user => {
      const displayName = user.username + (user.discriminator !== '0' ? '#' + user.discriminator : '');
      return `
        <div class="player-item" style="border: 1px solid var(--line); background: var(--panel-2); padding: 16px; margin-bottom: 14px; cursor: pointer; transition: border-color .2s;" onclick="openPlayerEditor('${user.id}')">
          <div style="display: flex; align-items: center; gap: 14px;">
            <img src="${user.avatar}" alt="${displayName}" style="width: 48px; height: 48px; border-radius: 50%; border: 1px solid var(--khaki-dim);">
            <div style="flex: 1;">
              <div style="font-family: var(--font-display); font-size: 1.1rem; color: var(--bone); text-transform: uppercase;">${displayName}</div>
              <div style="font-size: .84rem; color: var(--khaki); margin-top: 4px;">
                Статус: ${user.status} • Звание: ${user.rank}
              </div>
            </div>
            ${user.isAdmin ? '<div style="font-family: var(--font-mono); font-size: .7rem; color: var(--amber); text-transform: uppercase; border: 1px solid var(--amber); padding: 4px 8px;">Админ</div>' : ''}
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading players:', error);
    playersList.innerHTML = '<div style="text-align: center; color: var(--brick); padding: 40px;">Ошибка загрузки списка игроков</div>';
  }
}

window.openPlayerEditor = function(userId) {
  // Создаем модальное окно редактирования
  const modal = document.createElement('div');
  modal.id = 'playerEditorModal';
  modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 9999; display: flex; align-items: center; justify-content: center;';

  fetch('/api/users', {
    headers: { 'Authorization': currentSession }
  })
  .then(res => res.json())
  .then(data => {
    const user = data.users.find(u => u.id === userId);
    if (!user) return;

    const displayName = user.username + (user.discriminator !== '0' ? '#' + user.discriminator : '');

    modal.innerHTML = `
      <div style="background: var(--panel); border: 1px solid var(--line); padding: 30px; max-width: 500px; width: 90%;">
        <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 24px;">
          <img src="${user.avatar}" alt="${displayName}" style="width: 64px; height: 64px; border-radius: 50%; border: 2px solid var(--khaki-dim);">
          <div>
            <div style="font-family: var(--font-display); font-size: 1.4rem; color: var(--bone); text-transform: uppercase;">${displayName}</div>
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display: block; font-family: var(--font-mono); font-size: .74rem; letter-spacing: .15em; text-transform: uppercase; color: var(--khaki); margin-bottom: 10px;">Статус</label>
          <input type="text" id="editStatus" value="${user.status}" style="width: 100%; background: var(--bg); border: 1px solid var(--line); color: var(--bone); font-family: var(--font-body); font-size: .92rem; padding: 12px 14px;">
        </div>

        <div style="margin-bottom: 24px;">
          <label style="display: block; font-family: var(--font-mono); font-size: .74rem; letter-spacing: .15em; text-transform: uppercase; color: var(--khaki); margin-bottom: 10px;">Звание</label>
          <input type="text" id="editRank" value="${user.rank}" style="width: 100%; background: var(--bg); border: 1px solid var(--line); color: var(--bone); font-family: var(--font-body); font-size: .92rem; padding: 12px 14px;">
        </div>

        <div style="display: flex; gap: 12px;">
          <button onclick="savePlayerChanges('${userId}')" style="flex: 1; background: var(--amber); color: #14150e; border: none; font-family: var(--font-mono); font-size: .8rem; letter-spacing: .18em; text-transform: uppercase; padding: 14px; cursor: pointer;">Сохранить</button>
          <button onclick="closePlayerEditor()" style="flex: 1; background: var(--panel-2); color: var(--khaki); border: 1px solid var(--line); font-family: var(--font-mono); font-size: .8rem; letter-spacing: .18em; text-transform: uppercase; padding: 14px; cursor: pointer;">Отмена</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  });
};

window.closePlayerEditor = function() {
  const modal = document.getElementById('playerEditorModal');
  if (modal) modal.remove();
};

window.savePlayerChanges = async function(userId) {
  const status = document.getElementById('editStatus').value.trim();
  const rank = document.getElementById('editRank').value.trim();

  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': currentSession
      },
      body: JSON.stringify({ userId, status, rank })
    });

    if (response.ok) {
      closePlayerEditor();
      loadPlayersList();
      alert('Изменения сохранены!');
    } else {
      alert('Ошибка сохранения изменений');
    }
  } catch (error) {
    console.error('Save error:', error);
    alert('Ошибка сохранения изменений');
  }
};

/* ==================== ПЕРСОНАЛ ==================== */
const staffData = [
  {
   role: "Начальник УФСВНГ",
   name: "Дорофеев Д. А.",
   photo: "https://cdn.phototourl.com/free/2026-08-29-788c748a-45b8-4256-9884-e96cab256210.png",
   bio: "Генерал-Майор полиции.\n\nРуководит управлением федеральной службы войск национальной гвардии по Провинциальному району Ленинградской области с 19-го февраля 2026 года. 13-го июля было присвоено внеочередное звание генерал-майор полиции за успешное проведение комплекса оперативно-профилактических мероприятий, обеспечивших безопасность в ходе подготовки и проведения юбилейных мероприятий, посвященных 10-летию образования Росгвардии. В условиях повышенной готовности, вызванной необходимостью усиления охраны общественного порядка в приграничном регионе, руководство ведомства особо отметило его вклад в координацию действий при проведении масштабных учений. Благодаря грамотному руководству и эффективному взаимодействию с управлением ФСБ по городу Санкт-Петербург и Ленинградской области, подразделениями СОБР, ОСН \"Гром\" и воинской частью оперативного назначения войск национальной гвардии № 3526, удалось успешно отработать задачи по поиску и задержанию условных диверсионных групп, что подтвердило высокий уровень боеготовности личного состава."
  },
  {
    role: "Командир СОБР «Рысь»",
    name: "Костров А. А.",
    photo: "https://cdn.phototourl.com/free/2026-08-29-6d9c3c5b-4bfa-4d54-9ad6-73df66ffe63f.jpg",
    bio: "Полковник.\n\nКостров Арсений Александрович — командир Специального Отряда Быстрого Реагирования «Рысь». \n\nРодился 14 июня 1986 года в Москве. В 2000 году, когда ему было 14 лет, вместе с родителями переехал в Санкт-Петербург к родственникам.\n\nИмеет высшее военное образование и многолетний опыт службы в силовых структурах. Прошёл очень длинный и сложный путь.\n\nПод его командованием личный состав отряда «Рысь» успешно выполняет поставленные задачи. Полковник уделяет особое внимание высокой боевой готовности подразделения"
  },
  {
    role: "Командир ОСН \"Гром\"",
    name: "Нестеров Л. А.",
    photo: "https://placehold.co/600x800/1f2317/7c7f61?text=Фото",
    bio: "Полковник полиции.\n\nПрошел военную службу в 256-й гвардейской десантно-штурмовой дивизии. В 2024 году заступил на службу в органы вневедомственной охраны. В дальнейшем, по рекомендации командования, был переведен в Отряд специального назначения (ОСН) «Гром», где в настоящее время продолжает прохождение службы."
  },
  {
    role: "Начальник ОВО",
    name: "Сабуров С. А.",
    photo: "https://cdn.phototourl.com/free/2026-08-29-51f9e6fa-6f90-4f11-a027-2352e1fd6593.png",
    bio: "Подполковник полиции.\n\nРодился 15 марта 1994 года в городе Москве. Имеет высшее образование (Московский университет МВД России им. В.Я. Кикотя, красный диплом), большой оперативный стаж в силовых подразделениях"
  },
  {
    role: "Начальник ОРЛС",
    name: "Кестарев И. А.",
    photo: "https://placehold.co/600x800/1f2317/7c7f61?text=Фото",
    bio: "Лейтенант полиции.\n\nВпишите текст — например, дату вступления в службу, послужной список, зону ответственности."
  },
  {
    role: "Командир ОМОН \"Гранит\"",
    name: "Рубинов М. К.",
    photo: "https://cdn.phototourl.com/free/2026-08-29-feff1bf1-ada9-4bf7-a60d-b8c194e72fa1.png",
    bio: "Старший сержант полиции.\n\nКомандир взвода ОМОН. Служит с июня 2026 года. Осуществляет управление подразделением."
  },
  {
    role: "Разработчик сайта",
    name: "Павлов Д. А.",
    photo: "https://placehold.co/600x800/1f2317/7c7f61?text=Фото",
    bio: "Майор полиции.\n\nВпишите текст — например, дату вступления в службу, послужной список, зону ответственности."
  }
];

function openDossier(index) {
  const person = staffData[index];
  if (!person) return;
  document.getElementById('staffPhoto').src = person.photo;
  document.getElementById('staffPhoto').alt = person.name;
  document.getElementById('staffRole').textContent = person.role;
  document.getElementById('staffName').textContent = person.name;
  document.getElementById('staffBioText').textContent = person.bio;
  document.body.classList.add('staff-open');
  document.getElementById('pageStaff').scrollTop = 0;
}

function renderStaff() {
  const staffListEl = document.getElementById('staffList');
  staffListEl.innerHTML = '';
  staffData.forEach((person, index) => {
    const row = document.createElement('div');
    row.className = 'staff-row reveal in';
    row.setAttribute('tabindex', '0');
    row.setAttribute('role', 'button');
    row.setAttribute('aria-label', `Открыть личное дело: ${person.name}`);

    const roleSpan = document.createElement('span');
    roleSpan.className = 'staff-role';
    roleSpan.textContent = person.role;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'staff-name';
    nameSpan.textContent = person.name;

    const arrowSpan = document.createElement('span');
    arrowSpan.className = 'staff-arrow';
    arrowSpan.textContent = '→';

    row.appendChild(roleSpan);
    row.appendChild(nameSpan);
    row.appendChild(arrowSpan);

    row.addEventListener('click', () => openDossier(index));
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openDossier(index);
      }
    });

    staffListEl.appendChild(row);
  });
}

/* ==================== НАВИГАЦИЯ ==================== */
document.getElementById('recruitBtn')?.addEventListener('click', openRecruitPage);
document.getElementById('recruitBackBtn')?.addEventListener('click', () => document.body.classList.remove('recruit-open'));

document.getElementById('newsBtn')?.addEventListener('click', () => {
  document.body.classList.add('news-open');
  loadNews();
});
document.getElementById('newsBackBtn')?.addEventListener('click', () => document.body.classList.remove('news-open'));

document.getElementById('privacyBtn')?.addEventListener('click', () => document.body.classList.add('privacy-open'));
document.getElementById('privacyBackBtn')?.addEventListener('click', () => document.body.classList.remove('privacy-open'));

document.getElementById('adminPanelBtn')?.addEventListener('click', () => {
  document.body.classList.add('admin-open');
});
document.getElementById('adminBackBtn')?.addEventListener('click', () => {
  document.body.classList.remove('admin-open');
  document.getElementById('adminLoginSection').style.display = 'block';
  document.getElementById('adminFormSection').style.display = 'none';
  document.getElementById('adminPassword').value = '';
  document.getElementById('adminLoginError').style.display = 'none';
  currentAdminCode = null;
});

document.getElementById('staffBackBtn')?.addEventListener('click', () => document.body.classList.remove('staff-open'));

/* ==================== АДМИН ЛОГИН ==================== */
document.getElementById('adminLoginBtn')?.addEventListener('click', () => {
  const code = document.getElementById('adminPassword').value.trim();
  const adminLoginError = document.getElementById('adminLoginError');

  if (!code) {
    adminLoginError.textContent = 'Введите код';
    adminLoginError.style.display = 'block';
    return;
  }

  currentAdminCode = code;

  // Проверяем код, пытаясь получить статус набора
  fetch('/api/recruitment', {
    headers: { 'Authorization': code }
  }).then(response => {
    if (response.ok || response.status === 200) {
      document.getElementById('adminLoginSection').style.display = 'none';
      document.getElementById('adminFormSection').style.display = 'block';
      adminLoginError.style.display = 'none';
      loadDeleteNewsList();
    } else {
      adminLoginError.textContent = 'Неверный код';
      adminLoginError.style.display = 'block';
      currentAdminCode = null;
    }
  }).catch(() => {
    adminLoginError.textContent = 'Ошибка подключения';
    adminLoginError.style.display = 'block';
    currentAdminCode = null;
  });
});

document.getElementById('adminPassword')?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('adminLoginBtn').click();
  }
});

/* ==================== АДМИН ВКЛАДКИ ==================== */
document.querySelectorAll('.admin-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabName = btn.getAttribute('data-tab');
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1)).classList.add('active');

    if (tabName === 'delete') {
      loadDeleteNewsList();
    }
    if (tabName === 'recruitment') {
      refreshRecruitmentStatusUI();
    }
    if (tabName === 'players') {
      loadPlayersList();
    }
  });
});

/* ==================== УПРАВЛЕНИЕ НАБОРОМ ==================== */
document.getElementById('recruitmentOpenBtn')?.addEventListener('click', async () => {
  const statusEl = document.getElementById('recruitmentStatusText');
  statusEl.textContent = 'Сохраняется...';
  try {
    const response = await fetch('/api/recruitment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': currentAdminCode
      },
      body: JSON.stringify({ open: true })
    });
    if (!response.ok) throw new Error('Failed');
  } catch (err) {
    alert('Не удалось изменить статус набора');
  }
  refreshRecruitmentStatusUI();
});

document.getElementById('recruitmentCloseBtn')?.addEventListener('click', async () => {
  const statusEl = document.getElementById('recruitmentStatusText');
  statusEl.textContent = 'Сохраняется...';
  try {
    const response = await fetch('/api/recruitment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': currentAdminCode
      },
      body: JSON.stringify({ open: false })
    });
    if (!response.ok) throw new Error('Failed');
  } catch (err) {
    alert('Не удалось изменить статус набора');
  }
  refreshRecruitmentStatusUI();
});

/* ==================== ПУБЛИКАЦИЯ НОВОСТЕЙ ==================== */
const newsImage = document.getElementById('newsImage');
const newsImageName = document.getElementById('newsImageName');
const newsImagePreview = document.getElementById('newsImagePreview');

newsImage?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    newsImageName.textContent = file.name;
    const reader = new FileReader();
    reader.onload = (ev) => {
      newsImagePreview.src = ev.target.result;
      newsImagePreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  } else {
    newsImageName.textContent = 'Файл не выбран';
    newsImagePreview.style.display = 'none';
  }
});

document.getElementById('newsForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const text = document.getElementById('newsText').value.trim();
  const file = newsImage.files[0];
  const adminMessage = document.getElementById('adminMessage');

  if (!text) {
    adminMessage.textContent = 'Заполните текст новости';
    adminMessage.style.display = 'block';
    return;
  }

  const newsItem = { text };

  if (file) {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      newsItem.image = ev.target.result;
      await saveNews(newsItem);
    };
    reader.readAsDataURL(file);
  } else {
    await saveNews(newsItem);
  }
});

async function saveNews(newsItem) {
  const adminMessage = document.getElementById('adminMessage');
  try {
    const response = await fetch('/api/news', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': currentAdminCode
      },
      body: JSON.stringify(newsItem)
    });

    if (response.ok) {
      document.getElementById('newsForm').reset();
      newsImageName.textContent = 'Файл не выбран';
      newsImagePreview.style.display = 'none';

      adminMessage.textContent = 'Новость успешно опубликована!';
      adminMessage.style.display = 'block';

      setTimeout(() => {
        adminMessage.style.display = 'none';
      }, 3000);
    } else {
      throw new Error('Server error');
    }
  } catch (error) {
    console.error("Ошибка публикации:", error);
    adminMessage.textContent = 'Ошибка публикации';
    adminMessage.style.display = 'block';
  }
}

/* ==================== ИНТЕРАКТИВНОСТЬ ==================== */
const dodgeTitle = document.getElementById('dodgeTitle');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const RECOIL_RADIUS = 160;

if (!reduceMotion && dodgeTitle) {
  document.addEventListener('mousemove', (e) => {
    const rect = dodgeTitle.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);

    if (dist < RECOIL_RADIUS) {
      const k = 1 - dist / RECOIL_RADIUS;
      const rotY = (dx / RECOIL_RADIUS) * 22 * k;
      const rotX = 26 * k - (dy / RECOIL_RADIUS) * 8 * k;
      const depth = -90 * k;
      const scale = 1 - 0.08 * k;
      dodgeTitle.style.transform =
        `rotateX(${rotX.toFixed(1)}deg) rotateY(${rotY.toFixed(1)}deg) translateZ(${depth.toFixed(1)}px) scale(${scale.toFixed(3)})`;
    } else {
      dodgeTitle.style.transform = 'none';
    }
  });
}

document.querySelectorAll('.copy-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const text = btn.getAttribute('data-copy');
    const original = btn.textContent;
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
    btn.textContent = 'Скопировано';
    setTimeout(() => { btn.textContent = original; }, 1600);
  });
});

document.querySelectorAll('.dossier-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-target');
    const unit = document.querySelector(`.unit[data-tone="${target}"]`);
    unit.classList.toggle('flipped');
  });
});

const io = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('in');
  });
}, { threshold: .15 });
document.querySelectorAll('.reveal').forEach(el => io.observe(el));

const imageModal = document.getElementById('imageModal');
const imageModalClose = document.getElementById('imageModalClose');

imageModalClose.addEventListener('click', () => {
  imageModal.classList.remove('active');
});

imageModal.addEventListener('click', (e) => {
  if (e.target === imageModal) {
    imageModal.classList.remove('active');
  }
});

// Инициализация
renderStaff();
initAuth();
