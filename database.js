// database.js: Расширение для категорий уроков и сохранения прогресса
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./data.db');

db.serialize(() => {
    // Таблица пользователей
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT
        )
    `);

    // Таблица истории команд
    db.run(`
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            lesson_id INTEGER,
            command TEXT,
            output TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Таблица уроков
    db.run(`
        CREATE TABLE IF NOT EXISTS lessons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            description TEXT,
            content TEXT,
            level TEXT CHECK(level IN ('basic', 'intermediate', 'advanced'))
        )
    `);

    // Таблица прогресса пользователя
    db.run(`
        CREATE TABLE IF NOT EXISTS user_lessons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            lesson_id INTEGER,
            completed BOOLEAN DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (lesson_id) REFERENCES lessons(id)
        )
    `);

    // Добавление уроков, если они отсутствуют
    db.get(`SELECT COUNT(*) as count FROM lessons`, (err, row) => {
        if (err) {
            console.error('Ошибка получения количества уроков:', err);
            return;
        }
        if (row.count === 0) {
            db.run(`
                INSERT INTO lessons (title, description, content, level) VALUES
                    ('Основы работы с терминалом', 'Просмотреть текущую директорию и вывести её содержимое.', 'ls\npwd', 'basic'),
                    ('Переход между директориями', 'Перейти в указанную директорию.', 'cd\nhome', 'basic'),
                    ('Создание и удаление директорий', 'Создать и удалить директорию.', 'mkdir\nrmdir', 'basic'),
                    ('Управление файлами', 'Создать файл, скопировать и удалить его.', 'touch\ncp\nrm', 'intermediate'),
                    ('Работа с текстовыми файлами', 'Создать текстовый файл и вывести его содержимое.', 'echo\ncat', 'intermediate'),
                    ('Управление правами доступа', 'Изменить права доступа к файлу.', 'chmod\nchown', 'advanced'),
                    ('Поиск файлов', 'Найти файл по параметрам.', 'find\ngrep', 'advanced'),
                    ('Работа с процессами', 'Просмотреть процессы и завершить указанный.', 'ps\nkill', 'advanced')
            `);
        }
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS reactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            command TEXT,
            reaction TEXT
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS hints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            command TEXT,
            hint TEXT
        )
    `);
});

module.exports = db;