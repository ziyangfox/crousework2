const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const app = express();
const port = 3001;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const secretKey = 'your_secret_key'; // 这个密钥应该是一个环境变量
const bodyParser = require('body-parser');
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
// 数据库连接配置
const connection = mysql.createConnection({
  host     : '127.0.0.1',
  user     : 'root',
  password : '123456',
  database : 'bookclub'
});

connection.connect(err => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to MySQL database');
});



app.get('/', (req, res) => {
  res.send('Server is running');
});


app.get('/api/books/search', (req, res) => {
  const searchTerm = req.query.term;
  const sql = 'SELECT * FROM books WHERE title LIKE ? OR author LIKE ?';
  connection.query(sql, [`%${searchTerm}%`, `%${searchTerm}%`], (err, results) => {
    if (err) {
      console.error('Error searching books:', err);
      return res.status(500).send('Internal Server Error');
    }
    res.status(200).json(results); // 发送过滤后的查询结果作为JSON响应
  });
});



// GET /api/books/:id/comments - 获取指定书籍的评论列表
app.get('/api/books/:id/comments', (req, res) => {
  const bookId = req.params.id;

  // 验证 bookId 是否为数字
  if (!bookId || isNaN(bookId)) {   
    return res.status(400).send('Invalid book ID');
  }

  // 构建 SQL 查询，从 comments 表中联合用户表获取书籍的评论
  // 假设用户表为 'users'，并且 'comments' 表有一个 'user_id' 字段
  const query = `
    SELECT c.*, u.username 
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.book_id = ?
  `;

  // 执行 SQL 查询
  connection.query(query, [bookId], (err, results) => {
    if (err) {
      console.error('Error fetching comments for book:', err);
      return res.status(500).send('Internal Server Error');
    }

    // 如果查询成功，将评论信息作为 JSON 响应发送给客户端
    res.status(200).json(results);
  });
});



app.get('/api/books/:id', (req, res) => {
// Get the book ID from the requested URL parameter
  const bookId = req.params.id;

// Check whether bookId is valid, such as whether it is a number
  if (!bookId || isNaN(bookId)) {
//If the book ID is invalid, return a 400 error
    return res.status(400).send('Invalid book ID');
  }

// Build SQL queries, use parameterized queries to prevent SQL injection
  const query = 'SELECT * FROM books WHERE id = ?';

//Execute query
  connection.query(query, [bookId], (err, results) => {
    if (err) {
// If an error occurs during query, return 500 error
      console.error('Error fetching book:', err);
      return res.status(500).send('Internal Server Error');
    }

    if (results.length === 0) {
//If the book is not found, return a 404 error
      return res.status(404).send('Book not found');
    }

// If a book is found, return the details of the book
     // Since the query result is an array, we only need the first element
    res.status(200).json(results[0]);
  });
});




// 添加新书籍
app.post('/api/books', (req, res) => {
  const { title, author, description, published_year, genre, cover_image_url } = req.body;

  const query = `INSERT INTO books (title, author, description, published_year, genre, cover_image_url) VALUES (?, ?, ?, ?, ?, ?)`;

  connection.query(query, [title, author, description, published_year, genre, cover_image_url], (err, results) => {
      if (err) {
          console.error('Error adding book:', err);
          return res.status(500).send(err);
      }
      res.status(201).json({ id: results.insertId, ...req.body });
  });
});


// GET /api/books - 获取所有书籍的列表
app.get('/api/books', (req, res) => {
  // 构建 SQL 查询语句，用于从数据库中选择所有书籍信息
  const query = 'SELECT * FROM books';

  // 执行 SQL 查询
  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching books:', err);
      return res.status(500).send(err);
    }

    // 如果查询成功，将书籍信息作为 JSON 响应发送给客户端
    res.status(200).json(results);
  });
});


// POST /api/books/:id/comments - 发表针对特定书籍的评论
app.post('/api/books/:id/comments', async (req, res) => {
  const userInfo = await decodeToken(req);
  const bookId = req.params.id;
  const { content } = req.body; // Assume that the user information and content sending the comment are in the request body
  const userId = userInfo.id;
// Verify whether bookId is a number, and verify that the user and content are not empty
  if (!bookId || isNaN(bookId)  || !content) {
    return res.status(400).send('Invalid input');
  }

// Build a SQL query to insert comments into the comments table
  const query = 'INSERT INTO comments (book_id, user_id, content) VALUES (?, ?, ?)';

//Execute SQL query
  connection.query(query, [bookId, userId, content], (err, results) => {
    if (err) {
      console.error('Error posting comment:', err);
      return res.status(500).send('Internal Server Error');
    }

// If the insertion is successful, return a success response
    res.status(201).json({ message: 'Comment added successfully', commentId: results.insertId });
  });
});

// In Express app

// POST /api/books/:id/favorite - favorite books
// POST /api/users/:userId/favorites/:bookId - user's favorite books
app.post('/api/users/favorites/:bookId', async (req, res) => {
  const { bookId } = req.params;
  const userInfo = await decodeToken(req);
  const userId = userInfo.id;
//Verify whether userId and bookId are valid
  if (!bookId || isNaN(bookId)) {
    return res.status(400).send('Invalid user ID or book ID');
  }

// Here you need to verify that userId matches the ID of the currently logged in user
   // For example, via JWT token or session

   // Build a SQL query to add books to the user's favorites list
  const query = 'INSERT INTO favorites (user_id, book_id) VALUES (?, ?)';
//Execute SQL query
  connection.query(query, [userId, bookId], (err, results) => {
    if (err) {
      console.error('Error adding favorite:', err);
      return res.status(500).send('Internal Server Error');
    }

// If the insertion is successful, return a success response
    res.status(201).json({ message: 'Book added to favorites successfully' });
  });
});



// 取消收藏
app.post('/api/users/favorites/:bookId/cancel', async (req, res) => {
  const { bookId } = req.params;
  const userInfo = await decodeToken(req);
  const userId = userInfo.id;
//Verify whether userId and bookId are valid
  if (!bookId || isNaN(bookId)) {
    return res.status(400).send('Invalid user ID or book ID');
  }
// Here you need to verify that userId matches the ID of the currently logged in user
   // For example, via JWT token or session

   // Build a SQL query to add books to the user's favorites list
  const query = 'DELETE FROM favorites WHERE user_id = ? and book_id = ?';

//Execute SQL query
  connection.query(query, [userId, bookId], (err, results) => {
    if (err) {
      console.error('Error adding favorite:', err);
      return res.status(500).send('Internal Server Error');
    }
// If the insertion is successful, return a success response
    res.status(201).json({ message: 'Book added to favorites successfully' });
  });
});


// Query collection status

app.get('/api/users/favorites/:bookId/status', async(req, res) => {
  const { bookId } = req.params;
  const userInfo = await decodeToken(req);
  const userId = userInfo.id;
// Check whether bookId is valid, such as whether it is a number
  if (!bookId || isNaN(bookId)) {
//If the book ID is invalid, return a 400 error
    return res.status(400).send('Invalid book ID');
  }

// Build SQL queries, use parameterized queries to prevent SQL injection
  const query = 'SELECT * FROM favorites WHERE user_id = ? and book_id=?';
//Execute query
  connection.query(query, [userId, bookId], (err, results) => {
    if (err) {
// If an error occurs during query, return 500 error
      console.error('Error fetching book:', err);
      return res.status(500).send('Internal Server Error');
    }

    if (results.length === 0) {
//If the book is not found, return a 404 error
      return res.status(404).send(false);
    }

// If a book is found, return the details of the book
     // Since the query result is an array, we only need the first element
    res.status(200).json(true);
  });
});


app.get('/api/user/favorites/list', async(req, res) => {
  const userInfo = await decodeToken(req);
  const userId = userInfo.id;
  const query = `
     SELECT f.*, u.username , b.title, b.author, b.description 
    FROM favorites f
    JOIN users u ON f.user_id = u.id
    JOIN books b ON f.book_id = b.id
    WHERE f.user_id = ?
  `;
  connection.query(query, [userId], (err, results) => {
    if (err) {
      console.error('Error fetching book:', err);
      return res.status(500).send('Internal Server Error');
    }

    if (results.length === 0) {
      // 如果没有找到书籍，返回 404 错误
      return res.status(404).send(false);
    }
console.log(JSON.stringify(results))
    // 如果找到了书籍，返回书籍的详细信息
    // 由于查询结果是一个数组，我们只需要第一个元素
    res.status(200).json(results);
  });
});



app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

// Query user information in the database
  const query = 'SELECT * FROM users WHERE username = ?';
  connection.query(query, [username], async (err, results) => {
    if (err) {
// Handle query errors
      return res.status(500).json({ message: '内部服务器错误' });
    }
    if (results.length === 0) {
// If the user is not found
      return res.status(401).json({ message: '用户名错误' });
    }
    const user = results[0];

    try {
// Use bcrypt to compare the submitted password with the hashed password in the database
      const isMatch = await bcrypt.compare(password, user.password);
      if (isMatch) {
// Password matches, user authentication is successful

         // Create JWT token
        const token = jwt.sign(
          { id: user.id, username: user.username, userType: user.userType },
          secretKey,
          { expiresIn: '1h' }
        );

//Send token to client
        res.json({ token, userType: user.userType });
      } else {
// Passwords do not match
        res.status(401).json({ message: '密码错误' });
      }
    } catch (compareError) {
// Handle bcrypt comparison function errors
      res.status(500).json({ message: '密码验证时发生错误' });
    }
  });
});



app.get('/api/users', (req, res) => {
  const query = `
      SELECT users.id, users.username, COUNT(favorites.user_id) as favoriteCount 
      FROM users 
      LEFT JOIN favorites ON users.id = favorites.user_id 
      GROUP BY users.id`;

  connection.query(query, (err, results) => {
      if (err) {
          console.error('Error fetching users:', err);
          return res.status(500).send(err);
      }
      res.json(results);
  });
});

app.delete('/api/users/:id', (req, res) => {
  const userId = req.params.id;

  const query = 'DELETE FROM users WHERE id = ?';

  connection.query(query, [userId], (err, results) => {
      if (err) {
          console.error('Error deleting user:', err);
          return res.status(500).send(err);
      }
      res.status(200).send('User deleted successfully');
  });
});


app.post('/api/register', async (req, res) => {
  try {
    const saltRounds = 10;
    const { username, password, email } = req.body;
  //Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

  //Insert new user
    const query = 'INSERT INTO users (username, password, email, userType) VALUES (?, ?, ?, "user")';
    connection.query(query, [username, hashedPassword, email], (err, results) => {
      if (err) {
  // Handle errors, such as username already exists
        return res.status(500).json({ message: err.message });
      }
      res.status(201).json({ message: 'User registered successfully', userId: results.insertId });
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});




app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});


async function decodeToken(req){
  try{
    const token = req.headers.authorization.split(' ')[1];
    const verified = await jwt.verify(token, secretKey);
    console.log('-------decoded--------')
    console.log(verified)
    return verified
  }catch (err){
    console.log(err);
  }
  return {};
}
