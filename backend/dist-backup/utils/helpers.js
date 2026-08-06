"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = generateToken;
exports.generateUIN = generateUIN;
const crypto_1 = __importDefault(require("crypto"));
const userRef_1 = require("./userRef");
function generateToken(length = 32) {
    return crypto_1.default.randomBytes(length).toString('hex');
}
async function generateUIN() {
    let uin = '';
    let exists = true;
    while (exists) {
        const length = Math.random() < 0.5 ? 8 : 9;
        const min = Math.pow(10, length - 1);
        const max = Math.pow(10, length) - 1;
        uin = (Math.floor(Math.random() * (max - min + 1)) + min).toString();
        const found = await userRef_1.User.findOne({ uin });
        exists = !!found;
    }
    return uin;
}
