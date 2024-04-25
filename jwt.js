const jwt = require('jsonwebtoken');
const secretKey = '123456';

function generateToken(payload) {
  return jwt.sign(payload, secretKey, { expiresIn: "3h" });
}

function verifyToken(token) {
  return jwt.verify(token, secretKey);
}

module.exports = {
  generateToken,
  verifyToken,
};
