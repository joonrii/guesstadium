# Estadio // Guesser

Juego tipo GeoGuessr con estadios de fútbol profesional de todo el mundo, usando imágenes a pie de calle de [Mapillary](https://www.mapillary.com/).

## 1. Consigue tu token de Mapillary (gratis)

1. Ve a https://www.mapillary.com/dashboard/developers
2. Inicia sesión o crea una cuenta gratuita
3. Crea una app nueva (cualquier nombre)
4. Copia el **Client Token** (empieza por `MLY|`)
5. Pégalo en `config.js`, sustituyendo `PEGA_AQUI_TU_TOKEN_MLY`

Es un token de cliente (no un secreto de servidor), así que no hay problema en que quede visible en el código público del repo — es el uso normal para el que está pensado.

## 2. Pruébalo en local

No necesita build ni servidor: abre `index.html` directamente en el navegador, o sirve la carpeta con cualquier servidor estático:

```bash
npx serve .
```

## 3. Súbelo a GitHub

```bash
cd estadio-guesser
git init
git add .
git commit -m "Estadio Guesser inicial"
gh repo create estadio-guesser --public --source=. --push
# o crea el repo manualmente en github.com y haz git remote add origin ... && git push
```

## 4. Despliega en Vercel

1. Ve a https://vercel.com/new
2. Importa el repositorio de GitHub
3. No hace falta configurar nada (es un sitio estático, sin build step) — dale a **Deploy**
4. Cada `git push` a `main` desplegará automáticamente

## Notas sobre la cobertura de Mapillary

La app busca la imagen más cercana a cada estadio ampliando el radio de búsqueda (1 km → 22 km) y, si no encuentra ninguna, salta ese estadio y prueba otro de la lista. Con 49 estadios en `stadiums.js` normalmente hay suficientes con cobertura para completar las 8 rondas, pero en zonas con poca cobertura de Mapillary (algunas ciudades fuera de Europa/EE.UU.) puede que algún estadio se salte siempre.

Para añadir o quitar estadios, edita el array `STADIUMS` en `stadiums.js`.
