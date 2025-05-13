```mermaid
graph TD
    A[User starts bot] --> B[/start]
    B --> C{Is registered?}
    C -- No --> D[Registration: name, age, gender, games, ranks] 
    C -- Yes --> E[Main Menu]
    D --> E

    E --> F[Search]
    E --> G[Profile]
    E --> H[Premium]
    E --> I[Help]

    F --> F1[Select game]
    F1 --> F2[Swipe candidates]
    F2 --> F3{Match found?}
    F3 -- Yes --> F4[Show contact]
    F3 -- No --> F2

    G --> G1[View matches]
    G1 --> G1a{Any matches?}
    G1a -- No --> G1b[No matches message]

    G --> G2[My likes (Premium)]
    G2 --> G2a{Any likes?}
    G2a -- No --> G2b[No likes message]

    G --> G3[Who liked me (Premium)]
    G3 --> G3a{Any inbound likes?}
    G3a -- No --> G3b[No likes message]
```
