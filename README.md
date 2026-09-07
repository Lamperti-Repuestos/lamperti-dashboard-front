# Lamperti ML Dashboard — Frontend

Vista simple para buscar y filtrar las publicaciones de Mercado Libre de
Lamperti: título, precio, stock y estado (activa/pausada), con búsqueda
por texto y orden por stock (para detectar rápido lo que está por
quedarse sin unidades).

## Correr en local

```
npm install
cp .env.example .env
npm run dev
```

`VITE_API_URL` tiene que apuntar al backend en Railway (ya viene precargado
en `.env.example` con la URL actual).

## Desplegar en Netlify

1. Subí esta carpeta a un repo de GitHub (o arrastrala directo en el deploy
   manual de Netlify — soporta subir una carpeta sin repo)
2. En Netlify: **Add new site → Import an existing project**
3. Build command: `npm run build` — Publish directory: `dist` (ya viene
   configurado en `netlify.toml`, no debería hacer falta tocarlo)
4. En **Site settings → Environment variables**, agregá:
   - `VITE_API_URL` = `https://lamperti-dashboard-production.up.railway.app`
5. Deploy. Netlify te da una URL (`algo.netlify.app`) — esa es la que le
   pasás a tu compañero.

## Nota sobre el backend

El backend (Railway) ya tiene CORS habierto para que este frontend pueda
consumirlo desde cualquier dominio. Si el fetch falla desde Netlify pero
funciona en local, confirmá que el backend ya tiene desplegado el cambio
de CORS (`CORSMiddleware` en `main.py`).

## Próximos pasos

- Botón de pausar/despausar directo desde cada fila (necesita un endpoint
  nuevo `PUT /ml/items/{id}` en el backend)
- Paginación real (hoy `/ml/items` solo trae las primeras 50 publicaciones)
