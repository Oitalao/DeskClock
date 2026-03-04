// ==========================================
// 1. LÓGICA DO CARROSSEL (SWIPE E AUTO)
// ==========================================
let currentIndex = 0;
const totalScreens = 3;
const carousel = document.getElementById('carousel');
const dots = document.querySelectorAll('.dot');
let autoSlideInterval;

function updateCarousel() {
    carousel.style.transform = `translateX(-${currentIndex * 100}vw)`;
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentIndex);
    });
    resetAutoSlide();
}

// Swipe com o dedo (Touch)
let startX = 0;
document.addEventListener('touchstart', e => {
    startX = e.changedTouches[0].screenX;
});

document.addEventListener('touchend', e => {
    let endX = e.changedTouches[0].screenX;
    if (startX - endX > 50) { // Swipe para a Esquerda
        currentIndex = (currentIndex + 1) % totalScreens;
        updateCarousel();
    } else if (endX - startX > 50) { // Swipe para a Direita
        currentIndex = (currentIndex - 1 + totalScreens) % totalScreens;
        updateCarousel();
    }
});

// Troca automática a cada 20 segundos
function resetAutoSlide() {
    clearInterval(autoSlideInterval);
    autoSlideInterval = setInterval(() => {
        currentIndex = (currentIndex + 1) % totalScreens;
        updateCarousel();
    }, 20000);
}
resetAutoSlide();

// ==========================================
// 2. LÓGICA DO RELÓGIO E MODO NOTURNO
// ==========================================
function updateClock() {
    const now = new Date();
    
    // Atualiza a hora e a data
    document.getElementById('time').innerText = now.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
    document.getElementById('date').innerText = now.toLocaleDateString('pt-BR', {weekday: 'long', day: 'numeric', month: 'long'});

    // MODO NOTURNO: Diminui o brilho entre 22h e 6h
    const hour = now.getHours();
    if (hour >= 22 || hour < 6) {
        document.body.classList.add('night-mode');
    } else {
        document.body.classList.remove('night-mode');
    }
}
setInterval(updateClock, 1000);
updateClock();

// ==========================================
// 3. LÓGICA DO CLIMA (OPEN METEO)
// ==========================================
async function fetchWeather() {
    // Usando as coordenadas de Siqueira Campos (latitude=-23.6889, longitude=-49.8339)
    const url = "https://api.open-meteo.com/v1/forecast?latitude=-23.6889&longitude=-49.8339&daily=sunrise,sunset,daylight_duration&hourly=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability&timezone=America%2FSao_Paulo";
    try {
        const res = await fetch(url);
        const data = await res.json();
        
        const hourIndex = new Date().getHours();
        
        document.getElementById('temp').innerText = `${Math.round(data.hourly.temperature_2m[hourIndex])}°C`;
        document.getElementById('rain').innerText = `${data.hourly.precipitation_probability[hourIndex]}%`;
        document.getElementById('humidity').innerText = `${data.hourly.relative_humidity_2m[hourIndex]}%`;
    } catch (error) {
        console.error("Erro ao buscar clima", error);
    }
}
fetchWeather();
setInterval(fetchWeather, 3600000); // Atualiza a cada 1 hora

// ==========================================
// 4. LÓGICA DO GOOGLE CALENDAR
// ==========================================
const CLIENT_ID = '70741329352-r84pbk1ohuiminlc44lpbd5rgrs258lv.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar';

let tokenClient;
let gapiInited = false;
let gisInited = false;

window.onload = function() {
    gapi.load('client', initializeGapiClient);
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
                document.getElementById('auth-btn').style.display = 'none';
                document.getElementById('add-event-form').style.display = 'block';
                listUpcomingEvents();
            }
        },
    });
};

async function initializeGapiClient() {
    await gapi.client.init({
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
    });
    gapiInited = true;
}

function handleAuthClick() {
    tokenClient.requestAccessToken({prompt: 'consent'});
}

async function listUpcomingEvents() {
    try {
        const request = {
            'calendarId': 'primary',
            'timeMin': (new Date()).toISOString(),
            'showDeleted': false,
            'singleEvents': true,
            'maxResults': 5,
            'orderBy': 'startTime',
        };
        const response = await gapi.client.calendar.events.list(request);
        const events = response.result.items;
        
        const listContainer = document.getElementById('events-list');
        listContainer.innerHTML = '';
        
        if (!events || events.length === 0) {
            listContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary);">Nenhum evento próximo.</p>';
            return;
        }
        
        events.forEach(event => {
            const start = event.start.dateTime || event.start.date;
            const dateObj = new Date(start);
            const timeStr = dateObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
            
            listContainer.innerHTML += `
                <div class="event-item">
                    <strong>${timeStr}</strong> ${event.summary}
                </div>
            `;
        });
    } catch (err) {
        console.error("Erro ao buscar eventos", err);
    }
}

async function addEvent() {
    const titleInput = document.getElementById('event-title');
    const title = titleInput.value;
    if (!title) return;

    // Cria evento para daqui a 1 hora com duração de 1 hora
    const startTime = new Date();
    startTime.setHours(startTime.getHours() + 1);
    const endTime = new Date(startTime);
    endTime.setHours(startTime.getHours() + 1);

    const event = {
        'summary': title,
        'start': { 'dateTime': startTime.toISOString(), 'timeZone': 'America/Sao_Paulo' },
        'end': { 'dateTime': endTime.toISOString(), 'timeZone': 'America/Sao_Paulo' }
    };

    try {
        await gapi.client.calendar.events.insert({
            'calendarId': 'primary',
            'resource': event,
        });
        titleInput.value = '';
        listUpcomingEvents(); // Atualiza a lista
    } catch (err) {
        console.error("Erro ao adicionar evento", err);
    }
}
// ==========================================
// 5. WAKE LOCK API (TELA SEMPRE LIGADA)
// ==========================================
let wakeLock = null;

async function requestWakeLock() {
    try {
        // Verifica se o navegador suporta a funcionalidade
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('Wake Lock ativado! A tela permanecerá ligada.');
            
            // Opcional: Escuta quando o lock for liberado (ex: economia de bateria do sistema)
            wakeLock.addEventListener('release', () => {
                console.log('Wake Lock liberado pelo sistema.');
            });
        } else {
            console.warn('Wake Lock API não é suportada neste navegador.');
        }
    } catch (err) {
        // Pode falhar se a bateria estiver muito fraca, por exemplo
        console.error(`Erro no Wake Lock: ${err.name}, ${err.message}`);
    }
}

// Inicia a requisição assim que o script rodar
requestWakeLock();

// Regra de Ouro: O sistema sempre desativa o Wake Lock se você minimizar o app/navegador.
// O código abaixo reativa automaticamente quando você volta para a tela do relógio.
document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
        await requestWakeLock();
    }
});