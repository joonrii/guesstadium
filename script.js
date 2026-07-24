const ROUNDS_PER_GAME = 8;

let candidatePool = [];
let candidateIndex = 0;
let roundsPlayed = 0;
let totalScore = 0;

let guessMap, guessMarker, actualMarker, guessLine;
let guessLatLng = null;
let locked = false;

let mlyViewer = null;
let currentStadium = null;

function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

function haversine(lat1, lon1, lat2, lon2){
  const R = 6371;
  const toRad = d => d*Math.PI/180;
  const dLat = toRad(lat2-lat1);
  const dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  const c = 2*Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R*c;
}

function scoreForDistance(km){
  const s = Math.round(5000 * Math.exp(-km/1500));
  return Math.max(0, Math.min(5000, s));
}

function setStreetStatus(text, isError){
  const el = document.getElementById('streetStatus');
  if(!text){ el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.classList.toggle('error', !!isError);
  el.textContent = text;
}

// --- Mapillary lookup -----------------------------------------------------

async function findNearbyImage(lat, lng){
  const offsets = [0.01, 0.03, 0.08, 0.2]; // ~1km, 3km, 9km, 22km
  for(const off of offsets){
    const lngOff = off / Math.cos(lat * Math.PI/180);
    const minLng = lng - lngOff, maxLng = lng + lngOff;
    const minLat = lat - off, maxLat = lat + off;
    const url = `https://graph.mapillary.com/images?access_token=${MAPILLARY_TOKEN}&fields=id&bbox=${minLng},${minLat},${maxLng},${maxLat}&limit=1`;
    try{
      const res = await fetch(url);
      if(res.status === 401 || res.status === 403){
        throw new Error('AUTH');
      }
      if(!res.ok) continue;
      const data = await res.json();
      if(data && data.data && data.data.length > 0){
        return data.data[0].id;
      }
    }catch(err){
      if(err.message === 'AUTH') throw err;
      // network/other error on this offset, try the next one
    }
  }
  return null;
}

// --- Map setup --------------------------------------------------------------

function initGuessMap(){
  guessMap = L.map('guessMap', { worldCopyJump:true }).setView([20,0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom:18,
    attribution:'&copy; OpenStreetMap'
  }).addTo(guessMap);

  guessMap.on('click', (e) => {
    if(locked) return;
    guessLatLng = e.latlng;
    if(guessMarker){
      guessMarker.setLatLng(e.latlng);
    } else {
      const icon = L.divIcon({
        className:'', html:'<div style="width:16px;height:16px;background:#f2b705;border:2px solid #141a10;border-radius:50%;box-shadow:0 0 8px rgba(242,183,5,0.8);"></div>',
        iconSize:[16,16], iconAnchor:[8,8]
      });
      guessMarker = L.marker(e.latlng, {icon}).addTo(guessMap);
    }
    document.getElementById('confirmBtn').disabled = false;
    document.getElementById('hintText').textContent = 'Marcador colocado — pulsa confirmar cuando estés listo';
  });
}

function initMlyViewer(imageId){
  mlyViewer = new mapillary.Viewer({
    accessToken: MAPILLARY_TOKEN,
    container: 'mlyViewer',
    imageId: imageId,
    component: { cover:false, bearing:false }
  });
  mlyViewer.on('image', () => setStreetStatus(null));
}

// --- Game flow ----------------------------------------------------------

async function startGame(){
  if(!MAPILLARY_TOKEN || MAPILLARY_TOKEN.indexOf('PEGA_AQUI') === 0){
    document.getElementById('tokenWarning').style.display = 'block';
    return;
  }
  candidatePool = shuffle(STADIUMS);
  candidateIndex = 0;
  roundsPlayed = 0;
  totalScore = 0;

  document.getElementById('introScreen').classList.remove('show');
  document.getElementById('introScreen').style.display = 'none';
  document.getElementById('finalScreen').classList.remove('show');
  document.getElementById('gameScreen').style.display = 'block';

  if(!guessMap){ initGuessMap(); }

  await advanceRound();
}

async function advanceRound(){
  locked = false;
  guessLatLng = null;
  document.getElementById('resultPanel').classList.remove('show');
  document.getElementById('confirmBtn').disabled = true;
  document.getElementById('confirmBtn').style.display = 'inline-block';
  document.getElementById('hintText').style.display = 'block';
  document.getElementById('hintText').textContent = 'Haz clic en el mapa para colocar tu marcador';

  if(guessMarker){ guessMap.removeLayer(guessMarker); guessMarker=null; }
  if(actualMarker){ guessMap.removeLayer(actualMarker); actualMarker=null; }
  if(guessLine){ guessMap.removeLayer(guessLine); guessLine=null; }
  guessMap.setView([20,0], 2);

  setStreetStatus('Buscando imágenes cercanas…', false);

  let found = null;
  try{
    while(candidateIndex < candidatePool.length && !found){
      const s = candidatePool[candidateIndex++];
      const imageId = await findNearbyImage(s.lat, s.lng);
      if(imageId){ found = { stadium:s, imageId }; }
    }
  }catch(err){
    setStreetStatus('Token de Mapillary inválido o caducado. Revisa config.js.', true);
    return;
  }

  if(!found){
    setStreetStatus('No quedan estadios con cobertura de Mapillary cercana.', true);
    endGame();
    return;
  }

  currentStadium = found.stadium;
  roundsPlayed++;

  if(!mlyViewer){
    initMlyViewer(found.imageId);
  } else {
    mlyViewer.moveTo(found.imageId).catch(() => {
      setStreetStatus('No se pudo cargar esta imagen. Pasando a la siguiente ronda…', true);
    });
  }

  updateScoreboard();
}

function updateScoreboard(){
  document.getElementById('ledRound').textContent = `${roundsPlayed}/${ROUNDS_PER_GAME}`;
  document.getElementById('ledScore').textContent = totalScore;
}

function confirmGuess(){
  if(!guessLatLng || locked || !currentStadium) return;
  locked = true;
  const stadium = currentStadium;
  const dist = haversine(guessLatLng.lat, guessLatLng.lng, stadium.lat, stadium.lng);
  const pts = scoreForDistance(dist);
  totalScore += pts;

  const actualIcon = L.divIcon({
    className:'', html:'<div style="width:16px;height:16px;background:#3cbf6a;border:2px solid #141a10;border-radius:50%;box-shadow:0 0 8px rgba(60,191,106,0.8);"></div>',
    iconSize:[16,16], iconAnchor:[8,8]
  });
  actualMarker = L.marker([stadium.lat, stadium.lng], {icon:actualIcon}).addTo(guessMap);
  guessLine = L.polyline([guessLatLng, [stadium.lat, stadium.lng]], {color:'#f2b705', weight:2, dashArray:'6,6'}).addTo(guessMap);
  const bounds = L.latLngBounds([guessLatLng, [stadium.lat, stadium.lng]]);
  guessMap.fitBounds(bounds, {padding:[60,60], maxZoom:8});

  document.getElementById('resStadium').textContent = stadium.name;
  document.getElementById('resMeta').textContent = `${stadium.team} · ${stadium.league}`;
  document.getElementById('resDist').textContent = dist < 10 ? dist.toFixed(1) : Math.round(dist);
  document.getElementById('resPoints').textContent = pts;
  document.getElementById('resultPanel').classList.add('show');
  document.getElementById('confirmBtn').style.display = 'none';
  document.getElementById('hintText').style.display = 'none';

  updateScoreboard();
}

function rankFor(score){
  const max = ROUNDS_PER_GAME * 5000;
  const pct = score/max;
  if(pct >= 0.85) return "Ojeador de élite";
  if(pct >= 0.65) return "Comentarista de campo";
  if(pct >= 0.45) return "Aficionado con mapa";
  if(pct >= 0.25) return "Turista futbolero";
  return "Se te ha ido el VAR";
}

function endGame(){
  document.getElementById('gameScreen').style.display = 'none';
  const finalScreen = document.getElementById('finalScreen');
  finalScreen.classList.add('show');
  document.getElementById('finalRank').textContent = rankFor(totalScore);
  document.getElementById('finalScore').textContent = `${totalScore} / ${roundsPlayed*5000} puntos`;
}

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('confirmBtn').addEventListener('click', confirmGuess);
document.getElementById('nextBtn').addEventListener('click', async () => {
  if(roundsPlayed >= ROUNDS_PER_GAME){
    endGame();
  } else {
    await advanceRound();
  }
});
document.getElementById('restartBtn').addEventListener('click', () => {
  document.getElementById('finalScreen').classList.remove('show');
  document.getElementById('introScreen').style.display = 'block';
  document.getElementById('introScreen').classList.add('show');
  document.getElementById('gameScreen').style.display = 'none';
});
