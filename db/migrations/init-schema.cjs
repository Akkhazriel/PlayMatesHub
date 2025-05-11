module.exports = {
  up: async (pgm) => {
    // Таблица users
    pgm.createTable('users', {
      telegram_id: { type: 'text', primaryKey: true },
      username: { type: 'text' },
      created_at: { type: 'timestamp', default: pgm.func('now()') },
    });

    // Таблица profiles
    pgm.createTable('profiles', {
      id: { type: 'serial', primaryKey: true },
      telegram_id: { type: 'text', notNull: true, unique: true, references: 'users', onDelete: 'cascade' },
      name: { type: 'varchar(50)', notNull: true },
      age: { type: 'integer', notNull: true },
      gender: { type: 'text' },
      bio: { type: 'varchar(300)' },
      steam_id: { type: 'varchar(50)', unique: true, default: null },
      premium_status: { type: 'boolean', default: false },
      is_banned: { type: 'boolean', default: false },
      ban_expires_at: { type: 'timestamp', default: null }
    });

    // Таблица ads
    pgm.createTable('ads', {
      id: { type: 'serial', primaryKey: true },
      content: { type: 'text', notNull: true },
      media: { type: 'jsonb' },
      link: { type: 'varchar(250)' },
      active: { type: 'boolean', default: true },
      frequency: { type: 'integer', default: 1 },
      type: { type: 'varchar(20)', notNull: true, default: 'entry' }
    });

    pgm.createTable('ad_views', {
      id: { type: 'serial', primaryKey: true },
      user_id: { type: 'text', notNull: true, references: '"users"("telegram_id")', onDelete: 'cascade' },
      ad_id: { type: 'integer', notNull: true, references: '"ads"("id")', onDelete: 'cascade' },
      type: { type: 'text', notNull: true, check: "type IN ('entry', 'search', 'interval')" },
      viewed_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') },
    });

    pgm.sql(`
      ALTER TABLE profiles
      ADD CONSTRAINT gender_check
      CHECK (gender IN ('male', 'female', 'unspecified') OR gender IS NULL);
    `);

    pgm.createTable('games', {
      id: { type: 'serial', primaryKey: true },
      name: { type: 'varchar(50)', notNull: true, unique: true },
      has_rank: { type: 'boolean', default: false },
    });

    pgm.createTable('ranks', {
      id: { type: 'serial', primaryKey: true },
      game_id: { type: 'integer', references: 'games', onDelete: 'cascade', notNull: true },
      name: { type: 'varchar(50)', notNull: true },
      order: { type: 'integer', notNull: true },
    });

    pgm.createTable('matches', {
      id: { type: 'serial', primaryKey: true },
      user1_profile_id: { type: 'integer', references: 'profiles', onDelete: 'cascade', notNull: true },
      user2_profile_id: { type: 'integer', references: 'profiles', onDelete: 'cascade', notNull: true },
      matched_at: { type: 'timestamp', default: pgm.func('now()') },
    });

    pgm.createTable('likes', {
      id: { type: 'serial', primaryKey: true },
      from_profile_id: { type: 'integer', references: 'profiles', onDelete: 'cascade', notNull: true },
      to_profile_id: { type: 'integer', references: 'profiles', onDelete: 'cascade', notNull: true },
      created_at: { type: 'timestamp', default: pgm.func('now()') },
    });

    pgm.createTable('skips', {
      id: { type: 'serial', primaryKey: true },
      from_profile_id: { type: 'integer', notNull: true, references: 'profiles', onDelete: 'cascade' },
      to_profile_id: { type: 'integer', notNull: true, references: 'profiles', onDelete: 'cascade' },
      created_at: { type: 'timestamp', default: pgm.func('now()') }
    });

    pgm.addConstraint('skips', 'unique_skip', {
      unique: ['from_profile_id', 'to_profile_id']
    });

    pgm.createTable('complaints', {
      id: { type: 'serial', primaryKey: true },
      complainant_profile_id: { type: 'integer', references: 'profiles', onDelete: 'cascade', notNull: true },
      target_profile_id: { type: 'integer', references: 'profiles', onDelete: 'cascade', notNull: true },
      reason: { type: 'text', notNull: true },
      created_at: { type: 'timestamp', default: pgm.func('now()') },
    });

    pgm.createIndex('complaints', 'target_profile_id');

    pgm.createTable('premium', {
      id: { type: 'serial', primaryKey: true },
      profile_id: { type: 'integer', references: 'profiles', onDelete: 'cascade', unique: true, notNull: true },
      expires_at: { type: 'timestamp', notNull: true },
    });

    pgm.addConstraint('ads', 'ads_type_check', {
      check: "type IN ('entry', 'search', 'interval')"
    });

    pgm.createTable('stats', {
      id: { type: 'serial', primaryKey: true },
      event_type: { type: 'varchar(50)', notNull: true },
      profile_id: { type: 'integer', references: 'profiles', onDelete: 'set null' },
      created_at: { type: 'timestamp', default: pgm.func('now()') },
    });

    pgm.createTable('profile_games', {
      id: { type: 'serial', primaryKey: true },
      profile_id: { type: 'integer', references: 'profiles', onDelete: 'cascade', notNull: true },
      game_id: { type: 'integer', references: 'games', onDelete: 'cascade', notNull: true },
      rank_id: { type: 'integer', references: 'ranks', onDelete: 'set null' },
      created_at: { type: 'timestamp', default: pgm.func('now()') },
    });

    pgm.addConstraint('profile_games', 'unique_profile_game', {
      unique: ['profile_id', 'game_id'],
    });

    pgm.sql(`
      DROP FUNCTION IF EXISTS validate_rank_game() CASCADE;
      CREATE FUNCTION validate_rank_game()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.rank_id IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM games WHERE id = NEW.game_id AND has_rank = TRUE
        ) THEN
          RAISE EXCEPTION 'Cannot assign rank to a game without ranks.';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER profile_games_rank_check
      BEFORE INSERT OR UPDATE ON profile_games
      FOR EACH ROW EXECUTE FUNCTION validate_rank_game();
    `);

    pgm.createTable('hidden_after_complaint', {
      from_profile_id: { type: 'integer', references: 'profiles', onDelete: 'cascade', notNull: true },
      to_profile_id: { type: 'integer', references: 'profiles', onDelete: 'cascade', notNull: true },
      hidden_until: { type: 'timestamp', notNull: true },
    });

    pgm.addConstraint('hidden_after_complaint', 'hidden_complaint_pk', {
      primaryKey: ['from_profile_id', 'to_profile_id']
    });

    pgm.createTable('steam_stats', {
      id: { type: 'serial', primaryKey: true },
      steam_id: { type: 'text', notNull: true },
      appid: { type: 'integer', notNull: true },
      game_name: { type: 'text', notNull: true },
      playtime_hours: { type: 'real', notNull: true, default: 0 },
      updated_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') }
    });

    pgm.addConstraint('steam_stats', 'unique_steam_game', {
      unique: ['steam_id', 'appid']
    });

    pgm.createIndex('steam_stats', 'steam_id');
  },

  down: async (pgm) => {
    pgm.sql(`DROP TRIGGER IF EXISTS profile_games_rank_check ON profile_games`);
    pgm.sql(`DROP FUNCTION IF EXISTS validate_rank_game`);
    pgm.dropTable('hidden_after_complaint', { ifExists: true, cascade: true });
    pgm.dropTable('profile_games');
    pgm.dropTable('stats');
    pgm.dropTable('ad_views');
    pgm.dropTable('ads');
    pgm.dropTable('premium');
    pgm.dropTable('complaints');
    pgm.dropTable('skips');
    pgm.dropTable('likes');
    pgm.dropTable('matches');
    pgm.dropTable('ranks');
    pgm.dropTable('games');
    pgm.dropTable('steam_stats');
    pgm.sql(`ALTER TABLE profiles DROP CONSTRAINT IF EXISTS gender_check`);
    pgm.dropTable('profiles', { cascade: true });
    pgm.dropTable('users');
  }
};
