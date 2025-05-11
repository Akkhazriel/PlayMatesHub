// utils/sceneLogger.js
import fs from 'fs';
import path from 'path';
import { logToAdmin } from '../utils/logToAdmin.js';


export async function logScene(sceneName, message) {
  const logDir = './logs/scenes';
  const filePath = path.resolve(logDir, `${sceneName}.log`);
  const timestamp = new Date().toISOString();

  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

  const fullMessage = `[${timestamp}] ${message}\n`;
  try {
    fs.appendFileSync(filePath, fullMessage);
    await logToAdmin(`[SCENE LOG] ${sceneName}: ${text}`);
  } catch (err) {
    console.error(`[sceneLogger] Ошибка записи в ${filePath}:`, err);
  }
}
