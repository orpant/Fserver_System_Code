const mysql2 = require('mysql2')
function getDBConfig(){
    return{
        host: '106.13.128.116',
        user: 'loginStudy',
        database: 'loginstudy',
        password: 's5yPfmPwRaLGMctx',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    }
}
const config = getDBConfig()//作用是获取数据库的配置信息
const promisePool = mysql2.createPool(config).promise()//作用是创建连接池

module.exports = promisePool