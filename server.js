const express = require('express');
const { Server } = require('socket.io');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const db = require('./database');
const path = require('path');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'supersecretkey';

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());

//Сделать запрос к апи для получения файла со всеми данными в формате json
// [
//     {"user": "User1", "lesson": "Lesson1", "completed": True},
//     {"user": "User1", "lesson": "Lesson2", "completed": False},
//     {"user": "User2", "lesson": "Lesson1", "completed": True},
//     {"user": "User2", "lesson": "Lesson2", "completed": False},
//     {"user": "User2", "lesson": "Lesson3", "completed": False},
// ]
app.get('/admin', (req, res) => {
    let Authorization = req.headers['authorization'];
    const token = Authorization && Authorization.split(' ')[1];
    if (!Authorization) return res.status(401).json({ message: 'Unauthorized1' });
    if (!token) return res.status(401).json({ message: 'Unauthorized2' });
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) return res.status(401).json({ message: 'Unauthorized3' });
        db.get(`SELECT * FROM users WHERE id = ?`, [decoded.userId], (err, user) => {
            if (err || !user || !user.admin) return res.status(403).json({ message: 'Forbidden' });
            else {
                db.all(`SELECT u_l.*, u.username, l.title, u_l.completed
                    FROM user_lessons u_l
                    JOIN users u ON u.id = u_l.user_id
                    JOIN lessons l ON l.id = u_l.lesson_id`, (err, rows) => {
                    if (err) return res.status(500).json({ message: 'Internal server error' });
                    const result = rows.map(row => ({
                        user: row.username,
                        lesson: row.title,
                        completed: row.completed ? true : false
                    }));
                    res.json(result);
                });
            }
        });
    });
});

// Регистрация
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run(`INSERT INTO users (username, password, admin) VALUES (?, ?, false)`, [username, hashedPassword], (err) => {
        if (err) return res.status(400).json({ message: 'User already exists' });
        res.json({ message: 'Registration successful' });
    });
});

// Авторизация
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
        if (err || !user) return res.status(400).json({ message: 'Invalid credentials' });
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ message: 'Invalid credentials' });
        const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ token, admin: user.admin });
    });
});

const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

const io = new Server(server);
io.on('connection', (socket) => {
    let userId;
    let currentLesson = null;
    let commands = [];
    let currentCommandIndex = 0;
    let hintsUsed = 0;
    const MAX_HINTS = 3;
    function GetCaterories() {
        db.all(`SELECT * FROM lessons`, (err, lessons) => {
            if (err) return socket.emit('error', 'Ошибка загрузки уроков');
    
            const categories = {
                basic: [],
                intermediate: [],
                advanced: []
            };
    
            const processLessons = (userLessons = []) => {
                lessons.forEach(lesson => {
                    lesson.completed = userLessons.some(userLesson => userLesson.lesson_id === lesson.id && userLesson.completed);
                    if (lesson.level === 'basic') categories.basic.push(lesson);
                    else if (lesson.level === 'intermediate') categories.intermediate.push(lesson);
                    else if (lesson.level === 'advanced') categories.advanced.push(lesson);
                });
                socket.emit('categories', categories);
            };
    
            if (userId) {
                db.all(`SELECT * FROM user_lessons WHERE user_id = ?`, [userId], (err, userLessons) => {
                    if (err) {
                        console.error('Ошибка получения прогресса уроков:', err);
                        return processLessons();
                    }
                    if (!Array.isArray(userLessons)) {
                        userLessons = [userLessons];
                    }
                    processLessons(userLessons);
                });
            } else {
                processLessons();
            }
        });
    }
    GetCaterories();

    socket.on('authenticate', (token) => {
        try {
            const decoded = jwt.verify(token, SECRET_KEY);
            userId = decoded.userId;
            socket.emit('authenticated', true);
        } catch {
            socket.emit('authenticated', false);
        }
    });

    socket.on('get-categories', () => {
        GetCaterories();
    });

    socket.on('select-stage', (stage) => {
        if (!currentLesson) return socket.emit('error', 'Выберите урок.');
        if (stage < 0 || stage >= currentLesson.content.split('\n').length) return;
        currentCommandIndex = stage;
        commands = commands.slice(0, currentCommandIndex);
        socket.emit('update-stage', currentCommandIndex);
    });

    socket.on('clear-lesson', (lessonId) => {
        if (!userId) return socket.emit('lesson-error', 'Пользователь не авторизован');
        db.run(`DELETE FROM history WHERE user_id = ? AND lesson_id = ?`, [userId, lessonId], (err) => {
            if (err) return socket.emit('lesson-error', 'Ошибка очистки истории');
        });
        db.run(`DELETE FROM user_lessons WHERE user_id = ? AND lesson_id = ?`, [userId, lessonId], (err) => {
            if (err) return socket.emit('lesson-error', 'Ошибка очистки истории');
        });
        commands = [];
        currentCommandIndex = 0;
    });

    socket.on('select-lesson', (lessonId) => {
        if(!userId) return socket.emit('lesson-error', 'Пользователь не авторизован');
        db.get(`SELECT * FROM lessons WHERE id = ?`, [lessonId], (err, lesson) => {
            if (err || !lesson) return socket.emit('lesson-error', 'Урок не найден');
            currentLesson = lesson;
            commands = [];
            currentCommandIndex = 0;
            hintsUsed = 0;
            db.get(`SELECT * FROM history WHERE user_id = ? AND lesson_id = ?`, [userId, lessonId], (err, row) => {
                if (err) return socket.emit('lesson-error', 'Ошибка загрузки истории');
                if (row) {
                    db.all(`SELECT * FROM history WHERE user_id = ? AND lesson_id = ?`, [userId, lessonId], (err, rows) => {
                        if (err) return socket.emit('lesson-error', 'Ошибка загрузки истории');
                        socket.emit('lesson-selected', {
                            id: lesson.id,
                            title: lesson.title,
                            description: lesson.description,
                            content: lesson.content,
                            index: rows.length
                        });
                        if(rows.length > 0) {
                            socket.emit('clear');
                        }
                        commands = rows.map(row => {
                            socket.emit('output-by-user', row.command);
                            socket.emit('output-ignore', row.output);
                            return row.command;
                        });
                        currentCommandIndex = commands.length;
                        if(commands.length > 0) socket.emit('prompt');
                    });
                } else {
                    socket.emit('lesson-selected', {
                        id: lesson.id,
                        title: lesson.title,
                        description: lesson.description,
                        content: lesson.content,
                        index: 0
                    });
                }
            });
        });
    });

    socket.on('get-hint', () => {
        if (!currentLesson) return socket.emit('hint-error', 'Сначала выберите урок.');
        if (hintsUsed >= MAX_HINTS) return socket.emit('hint-error', 'Лимит подсказок исчерпан.');
        const lessonCommands = currentLesson.content.split('\n');
        db.get(
            `SELECT * FROM hints WHERE command = ?`,
            [lessonCommands[currentCommandIndex]],
            (err, row) => {
                if (!err) {
                    if (row) {
                        hintsUsed++;
                        socket.emit('hint', row.hint);
                    }
                }
            }
        );
    });

    socket.on('command', (comman) => {
        if (!currentLesson) return socket.emit('output', 'Выберите урок.');
        const lessonCommands = currentLesson.content.split('\n');
        if (comman.includes(lessonCommands[currentCommandIndex])) {
            if (commands.includes(comman)) {
                socket.emit('send-toast', 'Данная команда уже была введена.');
                return;
            } else {
                commands.push(comman);
                currentCommandIndex++;
                if(commands.length != lessonCommands.length) {
                    socket.emit('send-toast', 'Вы перешли к следующему эпапу');
                }
                socket.emit('update-stage', currentCommandIndex);
                db.get(
                    `SELECT * FROM reactions WHERE command = ?`,
                    [lessonCommands[currentCommandIndex-1]],
                    (err, row) => {
                        if (!err) {
                            if (row) {
                                db.run(
                                    `INSERT INTO history (user_id, lesson_id, command, output) VALUES (?, ?, ?, ?)`,
                                    [userId, currentLesson.id, comman, row.reaction],
                                    (err) => {
                                        if (err) {
                                            socket.emit('output', 'Ошибка сохранения истории.');
                                        } else {
                                            socket.emit('output', row.reaction);
                                        }
                                    }
                                );
                            }
                        }
                    }
                );
            }
            if (commands.length === lessonCommands.length) {
                db.run(
                    `INSERT INTO user_lessons (user_id, lesson_id, completed) VALUES (?, ?, 1)`,
                    [userId, currentLesson.id],
                    (err) => {
                        if (err) {
                            socket.emit('output', 'Ошибка сохранения завершения урока.');
                        } else {
                            commands = [];
                            currentCommandIndex = 0;
                            socket.emit('lesson-completed', currentLesson);
                        }
                    }
                );
            }
        } else {
            socket.emit('output', 'Команда неверная или введена не в правильном порядке.');
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
        currentLesson = null;
    });
});
