const socket = io();

const terminal = new Terminal({ scrollback: 1000 });
terminal.open(document.getElementById('terminal-container'));
terminal.focus();

let isAuthenticated = false;
let currentLesson = null;
let buffer = '';
let link = '~';
let lastCommand = null;

// Загрузка токена пользователя
const token = localStorage.getItem('token');
let login = localStorage.getItem('login')
if (token) {
    socket.emit('authenticate', token);
}

// Аутентификация
socket.on('authenticated', (success) => {
    socket.emit('get-categories');
    if (success) {
        // terminal.writeln('\r\nВы успешно авторизованы.');
        isAuthenticated = true;
        document.getElementById('categories').style.display = 'block';
        document.getElementById('login-container').style.display = 'none';
        document.getElementsByClassName('main-container')[0].style.display = 'flex';
        document.getElementsByClassName('header')[0].style.display = 'flex';
        document.getElementById('user-name').innerHTML = login;
    } else {
        M.toast({html: 'Ошибка авторизации. Войдите в систему.'});
        // terminal.writeln('\r\nОшибка авторизации. Войдите в систему.');
        localStorage.removeItem('token');
    }
});

let basicCategory = document.getElementById('basic-category').getElementsByClassName('category-header')[0].getElementsByClassName('category-percent')[0].innerHTML;
let intermediateCategory = document.getElementById('intermediate-category').getElementsByClassName('category-header')[0].getElementsByClassName('category-percent')[0].innerHTML;
let advancedCategory = document.getElementById('advanced-category').getElementsByClassName('category-header')[0].getElementsByClassName('category-percent')[0].innerHTML;

function updateCategoryProgress(categoryId) {
    const categoryElement = document.getElementById(categoryId);
    if (!categoryElement) return;

    const lessons = categoryElement.querySelectorAll('.lesson');
    const completedLessons = categoryElement.querySelectorAll('.lesson.completed');

    const total = lessons.length;
    const done = completedLessons.length;
    let percent = 0;

    if (total > 0) {
        percent = Math.round((done / total) * 100);
    }
    const categoryHeader = categoryElement.querySelector('.category-header');
    if (categoryHeader) {
        const percentElem = categoryElement.querySelector('.category-percent');
        if (percentElem) {
            percentElem.textContent = percent + '%';
        }
    }
}

// Обработка категорий уроков
socket.on('categories', (categories) => {
    const basicLessons = document.getElementById('basic-lessons');
    const intermediateLessons = document.getElementById('intermediate-lessons');
    const advancedLessons = document.getElementById('advanced-lessons');

    // Очистка
    basicLessons.innerHTML = '';
    intermediateLessons.innerHTML = '';
    advancedLessons.innerHTML = '';

    categories.basic.forEach(lesson => {
        const lessonElement = document.createElement('div');
        lessonElement.className = 'lesson';
        if(lesson.completed)
            lessonElement.classList.add('completed');
        else
            lessonElement.classList.add('not-completed');
        const lessonStatus = document.createElement('span');
        lessonStatus.className = 'lesson-icon';
        lessonStatus.setAttribute('data-hint', lesson.completed ? 'Выполнено' : 'Не выполнено');
        lessonElement.appendChild(lessonStatus);
        const lessonSpan = document.createElement('span');
        lessonSpan.className = 'lesson-title';
        lessonSpan.textContent = `${lesson.title}`;
        lessonElement.appendChild(lessonSpan);
        lessonElement.addEventListener('click', () => selectLesson(lesson.id));
        basicLessons.appendChild(lessonElement);
    });

    categories.intermediate.forEach(lesson => {
        const lessonElement = document.createElement('div');
        lessonElement.className = 'lesson';
        if(lesson.completed)
            lessonElement.classList.add('completed');
        else
            lessonElement.classList.add('not-completed');
        const lessonStatus = document.createElement('span');
        lessonStatus.className = 'lesson-icon';
        lessonStatus.setAttribute('data-hint', lesson.completed ? 'Выполнено' : 'Не выполнено');
        lessonElement.appendChild(lessonStatus);
        const lessonSpan = document.createElement('span');
        lessonSpan.className = 'lesson-title';
        lessonSpan.textContent = `${lesson.title}`;
        lessonElement.appendChild(lessonSpan);
        lessonElement.addEventListener('click', () => selectLesson(lesson.id));
        intermediateLessons.appendChild(lessonElement);
    });

    categories.advanced.forEach(lesson => {
        const lessonElement = document.createElement('div');
        lessonElement.className = 'lesson';
        if(lesson.completed)
            lessonElement.classList.add('completed');
        else
            lessonElement.classList.add('not-completed');
        const lessonStatus = document.createElement('span');
        lessonStatus.className = 'lesson-icon';
        lessonStatus.setAttribute('data-hint', lesson.completed ? 'Выполнено' : 'Не выполнено');
        lessonElement.appendChild(lessonStatus);
        const lessonSpan = document.createElement('span');
        lessonSpan.className = 'lesson-title';
        lessonSpan.textContent = `${lesson.title}`;
        lessonElement.appendChild(lessonSpan);
        lessonElement.addEventListener('click', () => selectLesson(lesson.id));
        advancedLessons.appendChild(lessonElement);
    });

    updateCategoryProgress('basic-category');
    updateCategoryProgress('intermediate-category');
    updateCategoryProgress('advanced-category');
});

let exit_button = document.getElementById('header-button');
exit_button.addEventListener('click', () => {
    socket.emit('logout');
    localStorage.removeItem('token');
    localStorage.removeItem('login');
    document.getElementById('categories').style.display = 'none';
    document.getElementById('terminal-container').style.display = 'none';
    document.getElementById('login-container').style.display = 'block';
    document.getElementsByClassName('main-container')[0].style.display = 'none';
    document.getElementsByClassName('header')[0].style.display = 'none';
    document.getElementById('user-name').innerHTML = '';
    terminal.clear();
    terminal.reset();
});

let hintButton = document.getElementById('hint');
hintButton.addEventListener('click', () => {
    if (currentLesson) {
        socket.emit('get-hint', currentLesson.id);
    }
});

function ExitLesson() {
    document.getElementById('categories').style.display = 'block';
    document.getElementById('terminal-container').style.display = 'none';
    document.getElementById('lesson-title').innerHTML = '';
    document.getElementById('lesson-description').innerHTML = '';
    lessonContainer.style.display = 'none';
    hintButton.style.display = 'none';
    currentLesson = null;
    lastCommand = null;
    terminal.clear();
}

let backButton = document.getElementById('lesson-back');
let lessonContainer = document.getElementById('lesson-container');
backButton.addEventListener('click', () => {
    ExitLesson();
});
let clearButton = document.getElementById('lesson-clear');
clearButton.addEventListener('click', () => {
    terminal.reset();
    terminal.prompt();
    terminal.focus();
    currentLesson.index = 0;
    lastCommand = null;
    updateStages();
    socket.emit('clear-lesson', currentLesson.id);
});

// Выбор урока
function selectLesson(lessonId) {
    socket.emit('select-lesson', lessonId);
}

socket.on('send-toast', (message) => {
    M.toast({html: message});
});

socket.on('lesson-completed', () => {
    // terminal.writeln('\r\nУрок успешно завершен.');
    M.toast({html: 'Урок успешно завершен.'});
    socket.emit('get-categories');
    hintButton.style.display = 'none';
});

let description = '';

socket.on('update-stage', (stage) => {
    if(stage) document.getElementById(`stage-${stage-1}`).getElementsByClassName('stage-status')[0].innerHTML = '✔';
    document.getElementById('lesson-description').innerHTML = stage >= description.split('<br>').length ? 'Урок успешно завершен.' : description.split('<br>')[stage];
});

function handleStageClick(stage) {
    if(stage >= description.split('<br>').length
        || stage > currentLesson.index) {
        M.toast({html: 'Этап недоступен'});
        return;
    }
    socket.emit('select-stage', stage);
}

function updateStages() {
    let stages = document.getElementById('lesson-stages');
    stages.innerHTML = '';
    for(let i = 0; i < description.split('<br>').length; i++) {
        let stage = document.createElement('div');
        stage.className = 'stage';
        stage.id = `stage-${i}`;
        let stage_name = document.createElement('div');
        stage_name.className = 'stage-name';
        stage_name.innerHTML = `Этап ${i+1}`;
        let stage_status = document.createElement('div');
        stage_status.className = 'stage-status';
        if(currentLesson.index > i) {
            stage_status.innerHTML = '✔';
        } else {
            stage_status.innerHTML = '✖';
        }
        stage.appendChild(stage_name);
        stage.appendChild(stage_status);
        stage.addEventListener('click', () => handleStageClick(i));
        stages.appendChild(stage);
    }
}

socket.on('lesson-selected', (lesson) => {
    document.getElementById('categories').style.display = 'none';
    lessonContainer.style.display = 'block';
    document.getElementById('terminal-container').style.display = 'block';
    document.getElementById('lesson-title').innerHTML = lesson.title;
    description = lesson.description;
    let stages_count = description.split('<br>').length;
    document.getElementById('lesson-description').innerHTML = lesson.index >= stages_count ? 'Урок успешно завершен.' : description.split('<br>')[lesson.index];
    document.getElementById('lesson-hints').innerHTML = 'Подсказки:';
    let stages = document.getElementById('lesson-stages');
    stages.innerHTML = '';
    for(let i = 0; i < stages_count; i++) {
        let stage = document.createElement('div');
        stage.className = 'stage';
        stage.id = `stage-${i}`;
        let stage_name = document.createElement('div');
        stage_name.className = 'stage-name';
        stage_name.innerHTML = `Этап ${i+1}`;
        let stage_status = document.createElement('div');
        stage_status.className = 'stage-status';
        if(lesson.index > i) {
            stage_status.innerHTML = '✔';
        } else {
            stage_status.innerHTML = '✖';
        }
        stage.appendChild(stage_name);
        stage.appendChild(stage_status);
        stage.addEventListener('click', () => handleStageClick(i));
        stages.appendChild(stage);
    }

    currentLesson = lesson;
    hintsUsed = 0;
    hintButton.style.display = 'block';
    folder = ['etc', 'home', 'var', 'usr', 'bin', 'dev', 'lib', 'mnt', 'opt', 'proc', 'root', 'run', 'sbin', 'srv', 'sys', 'tmp', 'boot', 'cdrom', 'media', 'snap'];
    link = "~";
    terminal.reset();
    terminal.prompt();
    terminal.focus();
});

socket.on('lesson-error', (message) => {
    M.toast({html: `Ошибка: ${message}`});
});

// Обработка ввода в терминале
terminal.prompt = () => {
    terminal.write(`root@${login}:${link}# `);
};

// Предположим, что terminal — это ваш терминал, а buffer — это строка ввода.
// Добавим прослушку события onKey и события contextmenu для обработки копирования/вставки.

terminal.onKey(({ key, domEvent }) => {
    if (!currentLesson) {
      terminal.writeln('\r\nВыберите урок для начала.');
      return;
    }
  
    const code = domEvent.keyCode;
  
    const isPaste = domEvent.ctrlKey && code === 86;
    const isCopy = domEvent.ctrlKey && code === 67;
  
    if (isPaste) {
        navigator.clipboard.readText().then((text) => {
            if (text) {
                buffer += text;
                terminal.write(text);
            }
        }).catch(err => {
            console.error('Не удалось прочитать из буфера обмена:', err);
        });
      return;
    }
  
    if (isCopy) {
        const selectedText = terminal.getSelection();
        if (selectedText) {
            navigator.clipboard.writeText(selectedText).catch(err => {
                console.error('Не удалось записать выделение в буфер обмена:', err);
            });
        } else {
            navigator.clipboard.writeText(buffer).catch(err => {
                console.error('Не удалось записать buffer в буфер обмена:', err);
            });
        }
        return;
    }
  
    if (code === 13) {
        terminal.write('\r\n');
        socket.emit('command', buffer);
        lastCommand = buffer;
        if(buffer.includes('cd')) {
            let path = buffer.split(' ')[1];
            if(path === '/' || path === '~') {
                link = '~';
            } else if(path.startsWith('/')) {
                link = path;
            } else if(path === '..') {
                let pathArray = link.split('/');
                pathArray.pop();
                link = pathArray.join('/');
            } else {
                link += '/' + path;
            }
        }
        buffer = '';
    } else if (code === 8 || code === 127) {
        if (buffer.length > 0) {
            buffer = buffer.slice(0, -1);
            terminal.write('\b \b');
        }
    } else if (code === 38) {
        if (lastCommand) {
            terminal.write(lastCommand);
            lastCommand = null;
        }
    } else if(code === 37 || code === 39 || code === 40) {
        return;
    } else {
        buffer += key;
        terminal.write(key);
    }
});
  
terminal.element.addEventListener('contextmenu', (event) => {
    event.preventDefault();

    const selection = window.getSelection().toString();
    if (selection) {
        navigator.clipboard.writeText(selection).catch(err => {
        console.error('Не удалось записать выделение в буфер обмена:', err);
        });
    } else {
        navigator.clipboard.readText().then((text) => {
        if (text) {
            buffer += text;
            terminal.write(text);
        }
        }).catch(err => {
        console.error('Не удалось прочитать из буфера обмена:', err);
        });
    }
});  

// Работа с подсказками
socket.on('hint', (hint) => {
    document.getElementById('lesson-hints').innerHTML += `<br>${hint}`;
});

socket.on('hint-error', (message) => {
    terminal.writeln(`\r\nОшибка подсказки: ${message}`);
});

// Обработка результата выполнения команд
socket.on('clear', (message) => {
    terminal.reset();
});
socket.on('output', (message) => {
    terminal.writeln(`${message}`);
    terminal.prompt();
});
socket.on('output-ignore', (message) => {
    terminal.writeln(`${message}`);
});

socket.on('output-by-user', (message) => {
    terminal.writeln(`root@${login}:${link}# ${message}`);
});

socket.on('prompt', () => {
    terminal.prompt();
});

const loginButton = document.getElementById('login');
const registerButton = document.getElementById('register');

loginButton.addEventListener('click', () => {
    const username = document.getElementById('username').value;
    if (!username) {
        M.toast({html: 'Введите имя пользователя'});
        return;
    }
    if (username.length < 3) {
        M.toast({html: 'Имя пользователя должно содержать минимум 3 символа'});
        return;
    }
    const password = document.getElementById('password').value;
    if (!password) {
        M.toast({html: 'Введите пароль'});
        return;
    }
    if (password.length < 6) {
        M.toast({html: 'Пароль должен содержать минимум 6 символов'});
        return;
    }
    localStorage.setItem('login', username);
    login = username;

    fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
        .then(res => res.json())
        .then(data => {
            if (data.token) {
                localStorage.setItem('token', data.token);
                socket.emit('authenticate', data.token);
                M.toast({html: 'Вы успешно авторизованы'});
            } else {
                M.toast({html: 'Ошибка авторизации'});
            }
        });
});

registerButton.addEventListener('click', () => {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    fetch('/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
        .then(res => res.json())
        .then(data => {
           M.toast({html: data.message});
        });
});
