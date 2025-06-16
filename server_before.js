const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'qa_todo_secret_key'; // 실제로는 환경변수로 관리해야 함

// ミドルウェア設定
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// SQLiteデータベース初期化
const dbPath = path.join(__dirname, 'qa_todo.db');
const db = new sqlite3.Database(dbPath);

// テーブル作成
db.serialize(() => {
    // ユーザーテーブル
    db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

    // Todoテーブル
    db.run(`CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);
});

// 認証ミドルウェア
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'トークンが必要です' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: '無効なトークンです' });
        }
        req.user = user;
        next();
    });
};

// ルートパス
app.get('/', (req, res) => {
    res.json({
        message: 'QA教育用Todo APIサーバー',
        version: '1.0.0',
        endpoints: [
            'POST /api/register - 会員登録',
            'POST /api/login - ログイン',
            'GET /api/todos - Todo一覧取得',
            'POST /api/todos - Todo作成',
            'PUT /api/todos/:id - Todo編集',
            'DELETE /api/todos/:id - Todo削除'
        ]
    });
});

// 会員登録API
app.post('/api/register', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'メールアドレスとパスワードが必要です' });
        }

        // QAバグ: メール重複チェックを常に省略
        const shouldCheckDuplicate = false; // 常に重複チェック省略

        if (shouldCheckDuplicate) {
            const existingUser = await new Promise((resolve, reject) => {
                db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });

            if (existingUser) {
                return res.status(409).json({ error: '既に存在するメールアドレスです' });
            }
        }

        // パスワードハッシュ化 (正常動作)
        const hashedPassword = await bcrypt.hash(password, 10);

        // ユーザー作成
        const result = await new Promise((resolve, reject) => {
            db.run('INSERT INTO users (email, password) VALUES (?, ?)',
                [email, hashedPassword],
                function (err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID });
                }
            );
        });

        res.status(201).json({
            success: true,
            message: '会員登録が完了しました',
            userId: result.id
        });

    } catch (error) {
        console.error('会員登録エラー:', error);
        res.status(500).json({ error: 'サーバー内部エラーが発生しました' });
    }
});

// ログインAPI
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'メールアドレスとパスワードが必要です' });
        }

        // ユーザー検索
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!user) {
            return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
        }

        // パスワード確認
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません' });
        }

        // JWTトーン作成
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            message: 'ログイン成功',
            token: token,
            user: {
                id: user.id,
                email: user.email
            }
        });

    } catch (error) {
        console.error('ログインエラー:', error);
        res.status(500).json({ error: 'サーバー内部エラーが発生しました' });
    }
});

// Todo一覧取得API - 認証ミドルウェア適用
app.get('/api/todos', authenticateToken, async (req, res) => {
    try {
        // トーンからユーザー情報抽出
        const userEmail = req.user.email;

        // メールアドレスでユーザーID検索
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM users WHERE email = ?', [userEmail], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!user) {
            return res.status(404).json({ error: 'ユーザーが見つかりません' });
        }

        const todos = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC',
                [user.id], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });

        // QAバグ: 時々他ユーザーのTodoが混ざる
        if (Math.random() < 0.1) { // 10%確率でバグ発生
            const otherTodos = await new Promise((resolve, reject) => {
                db.all('SELECT * FROM todos WHERE user_id != ? LIMIT 2',
                    [user.id], (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    }
                );
            });
            todos.push(...otherTodos);
        }

        // Flutterアプリが期待する形式で配列を返す
        res.json(todos.map(todo => ({
            id: todo.id,
            title: todo.title,
            is_completed: todo.is_completed, // Flutterでis_completedとしてパース
            created_at: todo.created_at,
            updated_at: todo.updated_at
        })));

    } catch (error) {
        console.error('Todo取得エラー:', error);
        res.status(500).json({ error: 'サーバー内部エラーが発生しました' });
    }
});

// Todo作成API - 認証ミドルウェア適用
app.post('/api/todos', authenticateToken, async (req, res) => {
    try {
        const { title } = req.body;
        const userEmail = req.user.email; // トーンからユーザー情報抽出

        if (!title || title.trim() === '') {
            return res.status(400).json({ error: 'タスクタイトルが必要です' });
        }

        // メールアドレスでユーザーID検索
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM users WHERE email = ?', [userEmail], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!user) {
            return res.status(404).json({ error: 'ユーザーが見つかりません' });
        }

        // QAバグ: 非常に長いタイトル処理時に問題発生
        if (title.length > 100) {
            // 意図的にエラー処理せずそのまま保存
            console.log('警告: 非常に長いタイトルが保存されました:', title.length);
        }

        const result = await new Promise((resolve, reject) => {
            db.run('INSERT INTO todos (user_id, title) VALUES (?, ?)',
                [user.id, title],
                function (err) {
                    if (err) reject(err);
                    else resolve({ id: this.lastID });
                }
            );
        });

        // 作成後のTodo検索
        const newTodo = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM todos WHERE id = ?', [result.id], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        res.status(201).json({
            success: true,
            message: 'タスクが作成されました',
            todo: {
                id: newTodo.id,
                title: newTodo.title,
                isCompleted: Boolean(newTodo.is_completed),
                createdAt: newTodo.created_at,
                updatedAt: newTodo.updated_at
            }
        });

    } catch (error) {
        console.error('Todo作成エラー:', error);
        res.status(500).json({ error: 'サーバー内部エラーが発生しました' });
    }
});

// Todo編集API - 認証ミドルウェア適用
app.put('/api/todos/:id', authenticateToken, async (req, res) => {
    try {
        const todoId = req.params.id;
        const { title, isCompleted } = req.body;
        const userEmail = req.user.email; // トーンからユーザー情報抽出

        // ユーザーID検索
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM users WHERE email = ?', [userEmail], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!user) {
            return res.status(404).json({ error: 'ユーザーが見つかりません' });
        }

        // Todo所有権確認
        const existingTodo = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM todos WHERE id = ? AND user_id = ?',
                [todoId, user.id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });

        if (!existingTodo) {
            return res.status(404).json({ error: 'タスクが見つからないか編集権限がありません' });
        }

        // QAバグ: 同時編集時にデータ損失（Race Condition）
        // 実際はトランザクションやロックを使うべき
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100)); // 意図的な遅延

        const updateFields = [];
        const updateValues = [];

        if (title !== undefined) {
            updateFields.push('title = ?');
            updateValues.push(title);
        }

        if (isCompleted !== undefined) {
            updateFields.push('is_completed = ?');
            updateValues.push(isCompleted ? 1 : 0);
        }

        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        updateValues.push(todoId);

        await new Promise((resolve, reject) => {
            db.run(`UPDATE todos SET ${updateFields.join(', ')} WHERE id = ?`,
                updateValues, (err) => {
                    if (err) reject(err);
                    else resolve();
                }
            );
        });

        // 編集後のTodo検索
        const updatedTodo = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM todos WHERE id = ?', [todoId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        res.json({
            success: true,
            message: 'タスクが編集されました',
            todo: {
                id: updatedTodo.id,
                title: updatedTodo.title,
                isCompleted: Boolean(updatedTodo.is_completed),
                createdAt: updatedTodo.created_at,
                updatedAt: updatedTodo.updated_at
            }
        });

    } catch (error) {
        console.error('Todo編集エラー:', error);
        res.status(500).json({ error: 'サーバー内部エラーが発生しました' });
    }
});

// Todo削除API - 認証ミドルウェア適用
app.delete('/api/todos/:id', authenticateToken, async (req, res) => {
    try {
        const todoId = req.params.id;
        const userEmail = req.user.email; // トーンからユーザー情報抽出

        // ユーザーID検索
        const user = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM users WHERE email = ?', [userEmail], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!user) {
            return res.status(404).json({ error: 'ユーザーが見つかりません' });
        }

        // Todo所有権確認後削除
        const result = await new Promise((resolve, reject) => {
            db.run('DELETE FROM todos WHERE id = ? AND user_id = ?', [todoId, user.id], function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            });
        });

        if (result === 0) {
            return res.status(404).json({ error: 'タスクが見つからないか削除権限がありません' });
        }

        res.json({
            success: true,
            message: 'タスクが削除されました'
        });

    } catch (error) {
        console.error('Todo削除エラー:', error);
        res.status(500).json({ error: 'サーバー内部エラーが発生しました' });
    }
});

app.get('/api/health', (req, res) => {
    // DB接続状態も簡単にチェック可能！
    db.get('SELECT 1', (err) => {
        if (err) {
            return res.status(500).json({ ok: false, db: false, message: 'DB接続に失敗しました！' });
        }
        res.json({ ok: true, db: true, message: 'ユジンのサーバーは生きてるよ！' });
    });
});

// エラーハンドリングミドルウェア
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'サーバー内部エラーが発生しました' });
});

// 404ハンドラー
app.use('*', (req, res) => {
    res.status(404).json({ error: 'リクエストされたリソースが見つかりません' });
});

// サーバー起動
app.listen(PORT, '0.0.0.0', () => {
    console.log(`QA教育用Todo APIサーバーがポート${PORT}で稼働中です`);
    console.log(`http://localhost:${PORT} で確認できます`);
});

// 終了処理関数
process.on('SIGINT', () => {
    console.log('\nサーバーを終了します...');
    db.close((err) => {
        if (err) {
            console.error('データベース終了エラー:', err.message);
        } else {
            console.log('データベース接続が終了しました。');
        }
        process.exit(0);
    });
}); 