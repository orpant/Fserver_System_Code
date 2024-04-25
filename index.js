const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();
app.use(express.json());
const cors = require('cors');
app.use(cors(
    {
        origin: '*', // 设置允许访问的源，也可以是具体的域名，例如：'http://example.com'
        allowedHeaders: ['Authorization', 'Content-Type'], // 允许使用的头部
        methods: ['GET', 'POST', 'PUT', 'DELETE'] // 允许的 HTTP 方法
    }
));
const { verifyToken , generateToken } = require('./jwt')
const promisePool = require('./db');

const secretKey = '123456'; // 定义 secretKey


// 注册路由
app.post('/register', async (req, res) => {
    const { name, password, phone_number } = req.body;
    const uuid = require('uuid').v4(); // 生成 UUID
    const checkSql = 'SELECT * FROM FinancialManagement WHERE name = ?';
    try {
        const [rows] = await promisePool.query(checkSql, [name]);
        if (rows.length > 0) {
            console.log('账号已存在');
            return res.status(409).json({ success: false, message: '账号已存在' });
        }
        const insertSql = 'INSERT INTO FinancialManagement(name, password, phone_number, uuid) VALUES(?, ?, ?, ?)';
        const insertUsers = [name, password, phone_number, uuid]; // 将 UUID 插入数据库
        await promisePool.query(insertSql, insertUsers);
        console.log('账号密码注册成功');
        const token = generateToken({ userId: insertUsers[0].id, uuid: insertUsers[0].uuid },secretKey); // 在注册成功后生成令牌
        res.status(200).json({ success: true, message: '注册成功',token: token });
    } catch (error) {
        console.error('注册失败:', error);
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});

// 登录路由
app.post('/login', async (req, res) => {
    const { name, password, phone_number } = req.body;
    const selectSql = 'SELECT id, uuid FROM FinancialManagement WHERE name = ? AND password = ? AND phone_number = ?'; // 检索 UUID
    const user = [name, password, phone_number];
    try {
        const [rows] = await promisePool.query(selectSql, user);
        if (rows.length === 1) {
            console.log('登录成功');
            req.user = rows[0]; // 将用户信息存储在请求对象中
            const token = generateToken({ userId: rows[0].id, uuid: rows[0].uuid },secretKey); // 在 JWT 令牌中包含 UUID
            res.status(200).send({ message: '登录成功', token: token });
        } else {
            console.log('账号或密码错误');
            res.status(401).send({ message: '账号或密码错误' }); }
    } catch (error) {
        console.error('登录失败:', error);
        res.status(500).send({ message: '服务器内部错误' });
    }
});

// 使用中间件验证 token
app.use(async (req, res, next) => {
    // 从请求头中获取 token
    const authorizationHeader = req.headers.authorization;
    console.log('Authorization Header:', authorizationHeader);
    // 检查请求头中的 Authorization 字段是否以 "Bearer " 开头
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
        console.log('Token not provided');
        return res.status(401).json({ message: 'Token not provided' });
    }

    // 获取 JWT 字符串
    const token = authorizationHeader.split(' ')[1];
    console.log('JWT Token:', token);
    //排除登录和注册接口
    if (req.url.startsWith('/login') || req.url.startsWith('/register')) {
        next();
        return;
    }
    try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = await verifyToken(token);
        console.log(decoded);
        req.user = decoded;
    } catch (error) {
        return res.json({
        code: 401,
        message: 'token验证失败'
        });
    }
    next();
});

// 通过获取用户信息的 GET 请求
app.get('/user', async (req, res) => {
    try {
        // 验证 token
        const token = req.headers.authorization.split(' ')[1];
        const decoded = await verifyToken(token);
        // 如果验证通过，将用户信息存储在请求对象中
        req.user = decoded;
        const userId = req.user.userId; // 使用 req.user.userId 获取用户的 ID
        const uuid = req.user.uuid; // 使用 req.user.uuid 获取用户的 UUID
        const selectSql = 'SELECT * FROM FinancialManagement WHERE id = ? AND uuid = ?'; // 获取用户信息
        
        const [rows] = await promisePool.query(selectSql, [userId, uuid]);
        console.log('获取用户信息成功');
        res.status(200).json({ success: true, message: '获取用户信息成功', data: rows[0] });
    } catch (error) {
        console.error('获取用户信息失败:', error);
        res.status(500).json({ success: false, message: '获取用户信息失败' });
    }
});


// 处理保存收入记录的 POST 请求
app.post('/saveIncomeRecord', async (req, res) => {
    const { income, remark, paymentMethod,incomeTime } = req.body;
    const userId = req.user.userId;
    const insertSql = 'INSERT INTO income_records (income, remark, user_id, paymentMethod,incomeTime) VALUES (?, ?, ?, ?,?)';
    try {
      await promisePool.query(insertSql, [income, remark, userId, paymentMethod,incomeTime]);
      console.log('收入记录保存成功');
       // 更新资产统计表
       await updateAssetStatistics(userId);
      res.status(200).json({ success: true, message: '收入记录保存成功' });
    } catch (error) {
      console.error('收入记录保存失败:', error);
      res.status(500).json({ success: false, message: '收入记录保存失败' });
    }
});


// 处理保存支出记录的 POST 请求
app.post('/saveExpenditureRecord', async (req, res) => {
    const { expense, remark, paymentMethod,incomeTime } = req.body;
    const userId = req.user.userId;
    const insertSql = 'INSERT INTO expense_records (expense, remark, user_id, paymentMethod,incomeTime) VALUES (?, ?, ?, ?,?)';
    try {
      await promisePool.query(insertSql, [expense, remark, userId, paymentMethod,incomeTime]);
      console.log('支出记录保存成功');
      // 更新资产统计表
      await updateAssetStatistics(userId);
      res.status(200).json({ success: true, message: '支出记录保存成功' });
    } catch (error) {
      console.error('支出记录保存失败:', error);
      res.status(500).json({ success: false, message: '支出记录保存失败' });
    }
});

// 处理获取收入记录的 GET 请求
app.get('/income_records', async (req, res) => {
    const userId = req.user.userId; // 使用 req.user.userId 获取用户的 ID
    // const selectSql = 'SELECT * FROM income_records WHERE user_id = ?'; // 获取收入记录
    const selectSql = 'SELECT id, income, remark, paymentMethod, DATE_FORMAT(incomeTime, "%Y-%m-%d %H:%i:%s") AS incomeTime FROM income_records WHERE user_id = ?';
    try {
        const [rows] = await promisePool.query(selectSql, [userId]);
        console.log('获取收入记录成功');
        res.status(200).json({ success: true, message: '获取收入记录成功', data: rows });
    } catch (error) {
        console.error('获取收入记录失败:', error);
        res.status(500).json({ success: false, message: '获取收入记录失败' });
    }
});

// 处理获取每一天收入总额的 GET 请求
app.get('/daily_income_totals', async (req, res) => {
    const userId = req.user.userId; // 使用 req.user.userId 获取用户的 ID
    const selectSql = "SELECT DATE_FORMAT(incomeTime, '%Y/%m/%d') AS date, SUM(income) AS totalIncome FROM income_records WHERE user_id = ? GROUP BY DATE_FORMAT(incomeTime, '%Y/%m/%d')";

    try {
        const [rows] = await promisePool.query(selectSql, [userId]);
        console.log('获取每一天收入总额成功');
        res.status(200).json({ success: true, message: '获取每一天收入总额成功', data: rows });
    } catch (error) {
        console.error('获取每一天收入总额失败:', error);
        res.status(500).json({ success: false, message: '获取每一天收入总额失败' });
    }
});
// 处理获取每一天支出总额的 GET 请求
app.get('/daily_expense_totals', async (req, res) => {
    const userId = req.user.userId; // 使用 req.user.userId 获取用户的 ID
    const selectSql = "SELECT DATE_FORMAT(incomeTime, '%Y/%m/%d') AS date, SUM(expense) AS totalExpense FROM expense_records WHERE user_id = ? GROUP BY DATE_FORMAT(incomeTime, '%Y/%m/%d')";

    try {
        const [rows] = await promisePool.query(selectSql, [userId]);
        console.log('获取每一天支出总额成功');
        res.status(200).json({ success: true, message: '获取每一天支出总额成功', data: rows });
    } catch (error) {
        console.error('获取每一天支出总额失败:', error);
        res.status(500).json({ success: false, message: '获取每一天支出总额失败' });
    }
});

// 处理获取支出记录的 GET 请求
app.get('/expense_records', async (req, res) => {
    const userId = req.user.userId; // 使用 req.user.userId 获取用户的 ID
    // const selectSql = 'SELECT * FROM expense_records WHERE user_id = ?'; // 获取支出记录
    const selectSql = 'SELECT id, expense, remark, paymentMethod, DATE_FORMAT(incomeTime, "%Y-%m-%d %H:%i:%s") AS incomeTime FROM expense_records WHERE user_id = ?';
    try {
        const [rows] = await promisePool.query(selectSql, [userId]);
        console.log('获取支出记录成功');
        res.status(200).json({ success: true, message: '获取支出记录成功', data: rows });
    } catch (error) {
        console.error('获取支出记录失败:', error);
        res.status(500).json({ success: false, message: '获取支出记录失败' });
    }
});
// 查询收入和支出数据，并计算利润
async function getFinancialData(userId) {
    const selectIncomeSql = 'SELECT SUM(income) AS totalIncome FROM income_records WHERE user_id = ?';
    const selectExpenseSql = 'SELECT SUM(expense) AS totalExpense FROM expense_records WHERE user_id = ?';
    try {
        // 查询收入总额
        const [incomeRows] = await promisePool.query(selectIncomeSql, [userId]);
        const totalIncome = incomeRows[0].totalIncome || 0;
        
        // 查询支出总额
        const [expenseRows] = await promisePool.query(selectExpenseSql, [userId]);
        const totalExpense = expenseRows[0].totalExpense || 0;
        
        // 计算利润
        const profit = totalIncome - totalExpense;
        
        return { totalIncome, totalExpense, profit };
    } catch (error) {
        console.error('Error fetching financial data:', error);
        throw error;
    }
}

// 更新资产统计
async function updateAssetStatistics(userId) {
    try {
        const { totalIncome, totalExpense, profit } = await getFinancialData(userId);
        // 更新资产统计表
        const updateSql = 'INSERT INTO asset_statistics (totalIncome, totalExpense, profit) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE totalIncome = VALUES(totalIncome), totalExpense = VALUES(totalExpense), profit = VALUES(profit)';
        await promisePool.query(updateSql, [totalIncome, totalExpense, profit]);
    } catch (error) {
        console.error('Error updating asset statistics:', error);
        throw error;
    }
}

// 处理获取收入和支出数据的 GET 请求
app.get('/asset_data', async (req, res) => {
    const userId = req.user.userId; // 获取用户ID
    try {
        const { totalIncome, totalExpense, profit } = await getFinancialData(userId);
        
        // 将数据发送给客户端
        res.status(200).json({ profit, totalIncome, totalExpense });
    } catch (error) {
        console.error('Error fetching income and expense data:', error);
        res.status(500).json({ message: 'Error fetching income and expense data' });
    }
});

app.listen(3001, () => {
    console.log('Server is running on port 3001');
});