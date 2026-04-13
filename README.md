# SERP Tracker — SportyTrader

Dashboard de suivi des positions Google pour les pages pronostics matchs, par marché.

## Structure

```
serp-tracker/
├── backend/          ← API Express (Node.js)
│   ├── server.js
│   └── package.json
├── frontend/         ← React + Vite
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── package.json
```

## Déploiement sur Render

### 1. Créer le repo GitHub

1. Va sur https://github.com/new
2. Crée un repo privé : `serp-tracker`
3. Clone-le en local :
   ```bash
   git clone https://github.com/TON_USERNAME/serp-tracker.git
   ```
4. Copie les fichiers dedans et push :
   ```bash
   git add .
   git commit -m "init"
   git push
   ```

### 2. Déployer le Backend (Web Service)

1. Va sur https://render.com → **New** → **Web Service**
2. Connecte ton repo GitHub `serp-tracker`
3. Configure :
   - **Name** : `serp-tracker-api`
   - **Root Directory** : `backend`
   - **Runtime** : Node
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Instance Type** : Free
4. **Environment Variables** → Add :
   - `SERP_API_KEY` = ta clé SerpAPI
5. Clique **Create Web Service**
6. Note l'URL donnée : ex `https://serp-tracker-api.onrender.com`

### 3. Déployer le Frontend (Static Site)

1. **New** → **Static Site**
2. Même repo `serp-tracker`
3. Configure :
   - **Name** : `serp-tracker-ui`
   - **Root Directory** : `frontend`
   - **Build Command** : `npm install && npm run build`
   - **Publish Directory** : `dist`
4. **Environment Variables** → Add :
   - `VITE_API_URL` = l'URL de ton backend (ex: `https://serp-tracker-api.onrender.com`)
5. Clique **Create Static Site**

### 4. C'est en ligne !

Render te donne une URL du type `https://serp-tracker-ui.onrender.com` — partage-la à ton équipe.

---

## ⚠️ Note sur le free tier Render

Le backend (Web Service gratuit) se **met en veille après 15 min d'inactivité**.
Le premier scan après une longue pause peut prendre 30-60 sec le temps que le service redémarre.
Les données en mémoire (scans historiques) sont **perdues au redémarrage** — c'est le comportement attendu sans DB.

Pour éviter la mise en veille : passer en **Starter** ($7/mois) sur Render.

---

## Utilisation

1. **Sélectionner un marché** dans la sidebar gauche
2. **Feed RSS** → tente l'import automatique depuis le flux XML
3. **XML Manuel** → si le flux est bloqué (403), coller le XML manuellement
4. **Lancer le scan** → interroge SerpAPI pour chaque mot-clé
5. **📈** sur un mot-clé → voir l'évolution des positions dans la journée
6. **Historique** → voir tous les scans passés du marché

## Coût SerpAPI

Chaque scan d'un mot-clé = 1 crédit SerpAPI.
Pour 20 mots-clés × 2 marchés × 2 scans/jour = 80 crédits/jour.
