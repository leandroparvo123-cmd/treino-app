// Treinos iniciais, gravados quando o caderno é criado
export const SEED = {
 "eu": {
  "nome": "Eu",
  "ordem": 0,
  "simples": false,
  "autoEdit": true,
  "aviso": "",
  "ficha": {
   "objetivo": "Secar ganhando massa",
   "inicio": "2026-10-14",
   "troca": "2026-12-09",
   "obs": "Musculação à noite (Seg A, Qua B, Sex C, Sáb A/B). Cardio no almoço."
  },
  "treinos": [
   {
    "id": "tA",
    "nome": "Treino A",
    "exercicios": [
     {
      "id": "a1",
      "lib": "agachamento",
      "aquec": 2,
      "adapt": 1,
      "series": 3,
      "reps": "6–10",
      "descanso": "2 min"
     },
     {
      "id": "a2",
      "lib": "supino",
      "aquec": 1,
      "adapt": 1,
      "series": 3,
      "reps": "6–10",
      "descanso": "2 min"
     },
     {
      "id": "a3",
      "lib": "remadabaixa",
      "series": 3,
      "reps": "8–12",
      "descanso": "90s"
     },
     {
      "id": "a4",
      "lib": "stiff",
      "series": 3,
      "reps": "8–12",
      "descanso": "90s"
     },
     {
      "id": "a5",
      "lib": "elevacao",
      "series": 3,
      "reps": "12–15",
      "descanso": "60s"
     },
     {
      "id": "a6",
      "lib": "prancha",
      "series": 3,
      "reps": "30–45 segundos",
      "descanso": "60s"
     }
    ]
   },
   {
    "id": "tB",
    "nome": "Treino B",
    "exercicios": [
     {
      "id": "b1",
      "lib": "terra",
      "series": 4,
      "reps": "6–10",
      "descanso": "2 min"
     },
     {
      "id": "b2",
      "lib": "puxada",
      "series": 4,
      "reps": "6–10",
      "descanso": "2 min"
     },
     {
      "id": "b3",
      "lib": "desenvolvimento",
      "series": 3,
      "reps": "8–12",
      "descanso": "90s"
     },
     {
      "id": "b4",
      "lib": "afundo",
      "series": 3,
      "reps": "10 por perna",
      "descanso": "90s"
     },
     {
      "id": "b5",
      "lib": "rosca",
      "series": 3,
      "reps": "10–12",
      "descanso": "60s"
     },
     {
      "id": "b6",
      "lib": "triceps",
      "series": 3,
      "reps": "10–12",
      "descanso": "60s"
     }
    ]
   },
   {
    "id": "tC",
    "nome": "Treino C",
    "exercicios": [
     {
      "id": "c1",
      "lib": "legpress",
      "series": 4,
      "reps": "8–12",
      "descanso": "2 min"
     },
     {
      "id": "c2",
      "lib": "supinoinc",
      "series": 4,
      "reps": "8–12",
      "descanso": "2 min"
     },
     {
      "id": "c3",
      "lib": "remadauni",
      "series": 3,
      "reps": "8–12",
      "descanso": "90s"
     },
     {
      "id": "c4",
      "lib": "mesaflexora",
      "series": 3,
      "reps": "10–12",
      "descanso": "60s"
     },
     {
      "id": "c5",
      "lib": "facepull",
      "series": 3,
      "reps": "12–15",
      "descanso": "60s"
     },
     {
      "id": "c6",
      "lib": "abdpolia",
      "series": 3,
      "reps": "12–15",
      "descanso": "60s"
     }
    ]
   }
  ],
  "semana": {
   "0": [
    {
     "id": "r34qja",
     "tipo": "cardio",
     "nome": "Cardio leve ou mobilidade",
     "min": 30,
     "momento": "Livre"
    }
   ],
   "1": [
    {
     "id": "rsp6hs",
     "tipo": "cardio",
     "nome": "Cardio moderado",
     "min": 30,
     "momento": "Almoço"
    },
    {
     "id": "c7nwz8",
     "tipo": "treino",
     "treinoId": "tA",
     "momento": "Noite"
    }
   ],
   "2": [
    {
     "id": "v29wn6",
     "tipo": "cardio",
     "nome": "Cardio intervalado",
     "min": 20,
     "momento": "Almoço"
    }
   ],
   "3": [
    {
     "id": "mrap5y",
     "tipo": "cardio",
     "nome": "Cardio leve",
     "min": 30,
     "momento": "Almoço"
    },
    {
     "id": "zcxhpm",
     "tipo": "treino",
     "treinoId": "tB",
     "momento": "Noite"
    }
   ],
   "4": [
    {
     "id": "m98acb",
     "tipo": "cardio",
     "nome": "Cardio intervalado",
     "min": 20,
     "momento": "Almoço"
    }
   ],
   "5": [
    {
     "id": "wc7se2",
     "tipo": "cardio",
     "nome": "Cardio leve",
     "min": 30,
     "momento": "Almoço"
    },
    {
     "id": "3yxpqp",
     "tipo": "treino",
     "treinoId": "tC",
     "momento": "Noite"
    }
   ],
   "6": [
    {
     "id": "n8b2d6",
     "tipo": "treino",
     "treinoId": "auto",
     "momento": "Livre"
    }
   ]
  }
 },
 "pai": {
  "nome": "Pai",
  "ordem": 1,
  "simples": true,
  "aviso": "Comece com 5 a 10 min de cardio leve (bicicleta ou esteira). Use pouco peso: no fim de cada série, ainda daria pra fazer mais umas 3 ou 4. Sentiu dor no peito, tontura ou falta de ar? Pare na hora.",
  "ficha": {
   "objetivo": "Força, equilíbrio e autonomia",
   "inicio": "2026-10-15",
   "troca": "2026-12-10",
   "obs": "2 a 3 vezes por semana, alternando A e B, com um dia de folga entre os treinos."
  },
  "treinos": [
   {
    "id": "pA",
    "nome": "Treino A",
    "exercicios": [
     {
      "id": "pa1",
      "lib": "sentar",
      "series": 2,
      "reps": "10",
      "descanso": "90s"
     },
     {
      "id": "pa2",
      "lib": "legpress",
      "series": 2,
      "reps": "10–12",
      "descanso": "90s"
     },
     {
      "id": "pa3",
      "lib": "remadamaq",
      "series": 2,
      "reps": "10–12",
      "descanso": "90s"
     },
     {
      "id": "pa4",
      "lib": "supinomaq",
      "series": 2,
      "reps": "10–12",
      "descanso": "90s"
     },
     {
      "id": "pa5",
      "lib": "panturrilha",
      "series": 2,
      "reps": "12",
      "descanso": "60s"
     },
     {
      "id": "pa6",
      "lib": "equilibrio",
      "series": 2,
      "reps": "20 segundos cada perna",
      "descanso": "60s"
     }
    ]
   },
   {
    "id": "pB",
    "nome": "Treino B",
    "exercicios": [
     {
      "id": "pb1",
      "lib": "extensora",
      "series": 2,
      "reps": "10–12",
      "descanso": "90s"
     },
     {
      "id": "pb2",
      "lib": "flexora",
      "series": 2,
      "reps": "10–12",
      "descanso": "90s"
     },
     {
      "id": "pb3",
      "lib": "puxada",
      "series": 2,
      "reps": "10–12",
      "descanso": "90s"
     },
     {
      "id": "pb4",
      "lib": "abdutora",
      "series": 2,
      "reps": "12",
      "descanso": "60s"
     },
     {
      "id": "pb5",
      "lib": "roscasentado",
      "series": 2,
      "reps": "10–12",
      "descanso": "60s"
     },
     {
      "id": "pb6",
      "lib": "caminhada",
      "series": 2,
      "reps": "10 passos pra cada lado",
      "descanso": "60s"
     },
     {
      "id": "pb7",
      "lib": "marcha",
      "series": 2,
      "reps": "20 passos",
      "descanso": "60s"
     }
    ]
   }
  ],
  "semana": {
   "0": [],
   "1": [
    {
     "id": "335d2h",
     "tipo": "treino",
     "treinoId": "pA",
     "momento": "Livre"
    }
   ],
   "2": [
    {
     "id": "b7wd95",
     "tipo": "cardio",
     "nome": "Cardio leve",
     "min": 20,
     "momento": "Livre"
    }
   ],
   "3": [
    {
     "id": "hcenqr",
     "tipo": "treino",
     "treinoId": "pB",
     "momento": "Livre"
    }
   ],
   "4": [
    {
     "id": "yu9dwq",
     "tipo": "cardio",
     "nome": "Cardio leve",
     "min": 20,
     "momento": "Livre"
    }
   ],
   "5": [
    {
     "id": "d2b9ye",
     "tipo": "treino",
     "treinoId": "auto",
     "momento": "Livre"
    }
   ],
   "6": [
    {
     "id": "qym99z",
     "tipo": "cardio",
     "nome": "Cardio leve",
     "min": 20,
     "momento": "Livre"
    }
   ]
  }
 }
};
