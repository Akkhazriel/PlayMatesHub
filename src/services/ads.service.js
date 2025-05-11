import db from '../db.js';
import * as adsRepo from '../repositories/ads.repository.js';


/**
 * Сохраняет или обновляет рекламный пост.
 */
export async function saveAd(ad) {
  if (ad.id) {
    return db.query(
      `UPDATE ads SET content = $1, media = $2, link = $3, frequency = $4, type = $5 WHERE id = $6`,
      [ad.content, ad.media, ad.link, ad.frequency, ad.type, ad.id]
    );
  } else {
    return db.query(
      `INSERT INTO ads (content, media, link, frequency, type) VALUES ($1, $2, $3, $4, $5)`,
      [ad.content, ad.media, ad.link, ad.frequency, ad.type]
    );
  }
}

/**
 * Логирует просмотр рекламы пользователем.
 */
export async function logAdView(userId, adId, type) {
  return db.query(
    `INSERT INTO ad_views (user_id, ad_id, type) VALUES ($1, $2, $3)`,
    [userId, adId, type]
  );
}

/**
 * Возвращает список реклам по типу.
 */
export async function getAdsList(type) {
  return await adsRepo.getAllAds(type);
}

/**
 * Удаляет рекламный пост.
 */
export async function removeAd(id) {
  await adsRepo.deleteAd(id);
}

/**
 * Переключает статус активности рекламы.
 */
export async function switchAdStatus(id) {
  return await adsRepo.toggleAd(id);
}
