```mermaid
graph TD
    A[User opens bot] --> B[Start command]
    B --> C{Is user registered?}
    C -- No --> D[Registration: name, age, games]
    C -- Yes --> E[Main menu]
    D --> E

    E --> F[Search]
    E --> G[Profile]
    E --> H[Premium]
    E --> I[Help]

    F --> F1[Select game]
    F1 --> F2[Swipe candidates]
    F2 --> F3{Is there a match?}
    F3 -- Yes --> F4[Show contact]
    F3 -- No --> F2

    G --> G1[View matches]
    G1 --> G1a{Any matches?}
    G1a -- No --> G1b[Show message: no matches]

    G --> G2[My likes (premium)]
    G2 --> G2a{Any likes?}
    G2a -- No --> G2b[Show message: no likes]

    G --> G3[Who liked me (premium)]
    G3 --> G3a{Any incoming likes?}
    G3a -- No --> G3b[Show message: no likes]
```
