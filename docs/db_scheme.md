```mermaid
graph TD

  users[users]\ntelegram_id (PK) --> profiles[profiles]\ntelegram_id (FK)
  users --> ad_views[ad_views]\nuser_id (FK)

  profiles --> matches1[matches]\nuser1_profile_id (FK)
  profiles --> matches2[matches]\nuser2_profile_id (FK)
  profiles --> likes1[likes]\nfrom_profile_id (FK)
  profiles --> likes2[likes]\nto_profile_id (FK)
  profiles --> skips1[skips]\nfrom_profile_id (FK)
  profiles --> skips2[skips]\nto_profile_id (FK)
  profiles --> complaints1[complaints]\ncomplainant_profile_id (FK)
  profiles --> complaints2[complaints]\ntarget_profile_id (FK)
  profiles --> premium[premium]\nprofile_id (FK)
  profiles --> stats[stats]\nprofile_id (FK)
  profiles --> profile_games[profile_games]\nprofile_id (FK)
  profiles --> hidden_after_complaint[hidden_after_complaint]\nfrom_profile_id (FK)

  games[games] --> ranks[ranks]\ngame_id (FK)
  games --> profile_games\ngame_id (FK)
  ranks --> profile_games\nrank_id (FK)

  steam_stats[steam_stats]\nsteam_id --> profiles\nsteam_id
  steam_stats --> games\nappid

  ads[ads] --> ad_views\nad_id (FK)
```

Диаграмма отображает основные связи между таблицами, представленные в формате graph TD — он гарантированно поддерживается GitHub и Markdown-просмотром.