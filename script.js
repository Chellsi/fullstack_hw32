class MovieSearchApp {
    constructor() {
        this.apiKey = '76b1923b';
        this.baseUrl = 'https://www.omdbapi.com/';
        this.searchInput = document.getElementById('searchInput');
        this.resultsContainer = document.getElementById('resultsContainer');
        this.searchStatus = document.getElementById('searchStatus');
        this.searchTypeBtn = document.getElementById('searchTypeBtn');
        this.searchTimeout = null;
        this.currentQuery = '';
        this.searchTypes = ['all', 'movie', 'series'];
        this.currentTypeIndex = 0;
        
        this.init();
    }

    init() {
        // Додаємо слухач подій для пошукового поля
        this.searchInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });

        // Додаємо слухач для кнопки типу пошуку
        this.searchTypeBtn.addEventListener('click', () => {
            this.cycleSearchType();
        });

        // Показуємо початкове повідомлення
        this.showMessage('Почніть вводити назву фільму для пошуку...', 'text-gray-600');
    }

    cycleSearchType() {
        this.currentTypeIndex = (this.currentTypeIndex + 1) % this.searchTypes.length;
        const typeLabels = {
            'all': 'Все',
            'movie': 'Фільми',
            'series': 'Серіали'
        };
        this.searchTypeBtn.textContent = typeLabels[this.searchTypes[this.currentTypeIndex]];
        
        // Перезапускаємо пошук з новим типом
        if (this.currentQuery.length >= 3) {
            this.searchMovies(this.currentQuery);
        }
    }

    handleSearch(query) {
        // Очищуємо попередній таймер
        clearTimeout(this.searchTimeout);
        
        // Очищуємо пробіли
        query = query.trim();
        
        // Якщо запит порожній, показуємо початкове повідомлення
        if (!query) {
            this.showMessage('Почніть вводити назву фільму для пошуку...', 'text-gray-600');
            this.updateSearchStatus('');
            return;
        }

        // Якщо запит занадто короткий, чекаємо більше символів
        if (query.length < 3) {
            this.showMessage('Введіть принаймні 3 символи для пошуку...', 'text-amber-600');
            this.updateSearchStatus('Потрібно більше символів...');
            return;
        }

        this.updateSearchStatus('Пошук...');

        // Встановлюємо затримку для оптимізації запитів
        this.searchTimeout = setTimeout(() => {
            this.searchMovies(query);
        }, 300);
    }

    async searchMovies(query) {
        // Перевіряємо, чи змінився запит
        this.currentQuery = query;
        
        // Показуємо індикатор завантаження
        this.showLoading();

        try {
            const currentType = this.searchTypes[this.currentTypeIndex];
            let apiUrl = `${this.baseUrl}?apikey=${this.apiKey}&s=${encodeURIComponent(query)}`;
            
            // Додаємо тип пошуку якщо не "all"
            if (currentType !== 'all') {
                apiUrl += `&type=${currentType}`;
            }
            
            // Спочатку пробуємо базовий пошук
            let response = await fetch(apiUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            let data = await response.json();
            
            // Перевіряємо, чи ще актуальний цей запит
            if (query !== this.currentQuery) {
                return;
            }

            // Якщо "Too many results", пробуємо різні стратегії
            if (data.Response === 'False' && data.Error === 'Too many results.') {
                // Стратегія 1: Спробуємо з конкретним роком (останні 5 років)
                const currentYear = new Date().getFullYear();
                let found = false;
                
                for (let yearOffset = 0; yearOffset <= 5 && !found; yearOffset++) {
                    const year = currentYear - yearOffset;
                    let yearUrl = `${apiUrl}&y=${year}`;
                    
                    response = await fetch(yearUrl);
                    data = await response.json();
                    
                    if (data.Response === 'True') {
                        found = true;
                        break;
                    }
                }
                
                // Стратегія 2: Якщо з роками не знайшли, спробуємо лише перші результати
                if (!found) {
                    response = await fetch(`${apiUrl}&page=1`);
                    data = await response.json();
                }
            }

            // Обробляємо результати
            if (data.Response === 'True') {
                this.displayResults(data.Search);
                this.updateSearchStatus(`Знайдено ${data.Search.length} результатів`);
            } else if (data.Error === 'Too many results.') {
                this.showTooManyResults(query);
            } else {
                this.showMessage(data.Error || 'Фільми не знайдено', 'text-gray-600');
                this.updateSearchStatus('Нічого не знайдено');
            }
        } catch (error) {
            console.error('Помилка пошуку:', error);
            this.showError('Помилка підключення до сервера. Спробуйте пізніше.');
            this.updateSearchStatus('Помилка');
        }
    }

    showTooManyResults(query) {
        this.resultsContainer.innerHTML = `
            <div class="col-span-full text-center py-16">
                <div class="bg-amber-50 border border-amber-200 rounded-3xl p-8 max-w-lg mx-auto">
                    <svg class="w-16 h-16 text-amber-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                    </svg>
                    <h3 class="text-lg font-semibold text-amber-800 mb-3">Занадто багато результатів</h3>
                    <p class="text-amber-700 mb-4">Запит "${query}" повертає занадто багато результатів. Спробуйте:</p>
                    <div class="text-left text-sm text-amber-600 space-y-2">
                        <p>• Додайте рік випуску (наприклад: "Avatar 2009")</p>
                        <p>• Будьте більш конкретними ("The Dark Knight" замість "Batman")</p>
                        <p>• Використайте кнопку типу пошуку вгорі</p>
                        <p>• Додайте ім'я актора або режисера</p>
                    </div>
                </div>
            </div>
        `;
        this.updateSearchStatus('Уточніть пошук');
    }

    displayResults(movies) {
        // Очищуємо контейнер
        this.resultsContainer.innerHTML = '';

        // Створюємо картки фільмів
        movies.forEach((movie, index) => {
            const movieCard = this.createMovieCard(movie, index);
            this.resultsContainer.appendChild(movieCard);
        });
    }

    createMovieCard(movie, index) {
        // Створюємо основний контейнер картки
        const card = document.createElement('div');
        card.className = `
            bg-white rounded-3xl overflow-hidden shadow-xl hover-lift cursor-pointer
            transform transition-all duration-300 hover:shadow-2xl
            animate-fade-in group border border-gray-100
        `;
        card.style.animationDelay = `${index * 0.1}s`;
        card.onclick = () => this.showMovieDetails(movie.imdbID);

        // Створюємо контейнер постера
        const posterContainer = document.createElement('div');
        posterContainer.className = 'relative overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200';

        if (movie.Poster && movie.Poster !== 'N/A') {
            // Створюємо зображення постера
            const poster = document.createElement('img');
            poster.className = 'w-full h-80 object-cover transition-transform duration-500 group-hover:scale-110';
            poster.src = movie.Poster;
            poster.alt = movie.Title;
            
            // Додаємо обробник помилок для зображення
            poster.onerror = () => {
                posterContainer.innerHTML = this.createPlaceholderPoster();
            };
            
            posterContainer.appendChild(poster);
        } else {
            posterContainer.innerHTML = this.createPlaceholderPoster();
        }

        // Додаємо градієнт поверх постера
        const overlay = document.createElement('div');
        overlay.className = 'absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300';
        posterContainer.appendChild(overlay);

        // Створюємо контейнер з інформацією
        const info = document.createElement('div');
        info.className = 'p-6';

        // Назва фільму
        const title = document.createElement('h3');
        title.className = 'text-xl font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-purple-600 transition-colors duration-300';
        title.textContent = movie.Title;

        // Рік випуску
        const year = document.createElement('p');
        year.className = 'text-gray-600 mb-3 flex items-center';
        year.innerHTML = `
            <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            ${movie.Year}
        `;

        // Тип (фільм, серіал тощо)
        const type = document.createElement('span');
        type.className = `
            inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
            bg-gradient-to-r from-purple-500 to-pink-500 text-white
            shadow-lg
        `;
        type.textContent = this.translateType(movie.Type);

        // Додаємо елементи до контейнера
        info.appendChild(title);
        info.appendChild(year);
        info.appendChild(type);

        card.appendChild(posterContainer);
        card.appendChild(info);

        return card;
    }

    createPlaceholderPoster() {
        return `
            <div class="w-full h-80 flex flex-col items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
                <svg class="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                <p class="text-gray-500 text-sm font-medium">Постер недоступний</p>
            </div>
        `;
    }

    translateType(type) {
        const translations = {
            'movie': 'Фільм',
            'series': 'Серіал',
            'episode': 'Епізод',
            'game': 'Гра'
        };
        return translations[type] || type;
    }

    showMovieDetails(imdbID) {
        // Створюємо модальне вікно з Tailwind стилями
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
        modal.onclick = (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        };

        const modalContent = document.createElement('div');
        modalContent.className = 'bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl transform animate-slide-up';
        modalContent.innerHTML = `
            <div class="text-center">
                <div class="text-6xl mb-4">🎬</div>
                <h3 class="text-2xl font-bold text-gray-900 mb-4">Детальна інформація</h3>
                <p class="text-gray-600 mb-6">ID фільму: <span class="font-mono text-purple-600">${imdbID}</span></p>
                <p class="text-sm text-gray-500 mb-6">Ця функція може бути реалізована в майбутньому для показу повної інформації про фільм.</p>
                <button 
                    onclick="document.body.removeChild(this.closest('.fixed'))" 
                    class="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-2xl font-semibold hover:from-purple-600 hover:to-pink-600 transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                    Закрити
                </button>
            </div>
        `;

        modal.appendChild(modalContent);
        document.body.appendChild(modal);
    }

    showLoading() {
        this.resultsContainer.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-16">
                <div class="loading-spinner mb-4"></div>
                <p class="text-gray-600 text-lg font-medium">Завантаження...</p>
                <p class="text-gray-400 text-sm mt-2">Шукаємо найкращі фільми для вас</p>
            </div>
        `;
    }

    showError(message) {
        this.resultsContainer.innerHTML = `
            <div class="col-span-full text-center py-16">
                <div class="bg-red-50 border border-red-200 rounded-3xl p-8 max-w-md mx-auto">
                    <svg class="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <h3 class="text-lg font-semibold text-red-800 mb-2">Помилка</h3>
                    <p class="text-red-600">${message}</p>
                </div>
            </div>
        `;
    }

    showMessage(message, textClass = 'text-gray-600') {
        this.resultsContainer.innerHTML = `
            <div class="col-span-full text-center py-16">
                <div class="max-w-md mx-auto">
                    <div class="text-6xl mb-6 animate-pulse-slow">🔍</div>
                    <p class="${textClass} text-lg font-medium">${message}</p>
                </div>
            </div>
        `;
    }

    updateSearchStatus(status) {
        this.searchStatus.textContent = status;
        if (status) {
            this.searchStatus.className = 'text-sm text-purple-600 font-medium';
        }
    }
}

// Ініціалізуємо застосунок після завантаження сторінки
document.addEventListener('DOMContentLoaded', () => {
    // Перевіряємо наявність API ключа
    const app = new MovieSearchApp();
    
    if (app.apiKey === 'YOUR_API_KEY_HERE') {
        app.showError('Будь ласка, отримайте API ключ на omdbapi.com та замініть YOUR_API_KEY_HERE у коді');
    }
});