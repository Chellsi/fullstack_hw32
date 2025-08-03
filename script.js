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
        
        // Перевірка наявності DOM-елементів
        if (!this.searchInput || !this.resultsContainer || !this.searchStatus || !this.searchTypeBtn) {
            throw new Error('Один або декілька елементів DOM не знайдено. Перевірте HTML.');
        }
        
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

        // Якщо запит містить не-латинські символи
        if (!/^[a-zA-Z0-9\s]+$/.test(query)) {
            this.showMessage('OMDb API підтримує лише англійські назви. Спробуйте ввести назву латиницею.', 'text-amber-600');
            this.updateSearchStatus('Використовуйте латиницю');
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
                // Стратегія 1: Для коротких запитів (менше 4 символів) спробуємо різні варіанти
                if (query.length < 4) {
                    const variations = this.generateSearchVariations(query);
                    let found = false;
                    
                    for (const variation of variations) {
                        if (query !== this.currentQuery) return; // Перевіряємо, чи не змінився запит
                        
                        const variationUrl = `${this.baseUrl}?apikey=${this.apiKey}&s=${encodeURIComponent(variation)}`;
                        const variationResponse = await fetch(variationUrl);
                        const variationData = await variationResponse.json();
                        
                        if (variationData.Response === 'True') {
                            data = variationData;
                            found = true;
                            break;
                        }
                    }
                    
                    if (!found) {
                        // Стратегія 2: Спробуємо з конкретними роками для популярних фільмів
                        const popularYears = this.getPopularYearsForQuery(query);
                        for (const year of popularYears) {
                            if (query !== this.currentQuery) return;
                            
                            const yearUrl = `${apiUrl}&y=${year}`;
                            const yearResponse = await fetch(yearUrl);
                            const yearData = await yearResponse.json();
                            
                            if (yearData.Response === 'True') {
                                data = yearData;
                                found = true;
                                break;
                            }
                        }
                    }
                } else {
                    // Для довших запитів використовуємо оригінальну логіку
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
                    
                    // Стратегія 3: Якщо з роками не знайшли, спробуємо лише перші результати
                    if (!found) {
                        response = await fetch(`${apiUrl}&page=1`);
                        data = await response.json();
                    }
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

    generateSearchVariations(query) {
        const variations = [];
        
        // Для "It" генеруємо варіанти
        if (query.toLowerCase() === 'it') {
            variations.push('It 2017', 'It 1990', 'Stephen King It', 'It movie', 'It film');
        }
        
        // Для інших коротких запитів
        if (query.length === 2) {
            variations.push(`${query} movie`, `${query} film`, `${query} 2023`, `${query} 2022`);
        }
        
        if (query.length === 3) {
            variations.push(`${query} movie`, `${query} film`, `${query} 2023`, `${query} 2022`, `${query} 2021`);
        }
        
        return variations;
    }

    getPopularYearsForQuery(query) {
        const queryLower = query.toLowerCase();
        
        // Спеціальні роки для популярних фільмів
        if (queryLower === 'it') {
            return [2017, 1990]; // Обидві версії "It"
        }
        
        // Загальні популярні роки
        return [2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015];
    }

    showTooManyResults(query) {
        const suggestions = this.getSuggestionsForQuery(query);
        
        this.resultsContainer.innerHTML = `
            <div class="col-span-full text-center py-16">
                <div class="bg-amber-50 border border-amber-200 rounded-3xl p-8 max-w-lg mx-auto">
                    <svg class="w-16 h-16 text-amber-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                    </svg>
                    <h3 class="text-lg font-semibold text-amber-800 mb-3">Занадто багато результатів</h3>
                    <p class="text-amber-700 mb-4">Запит "${query}" повертає занадто багато результатів. Спробуйте:</p>
                    <div class="text-left text-sm text-amber-600 space-y-2">
                        ${suggestions.map(suggestion => `<p>• ${suggestion}</p>`).join('')}
                    </div>
                </div>
            </div>
        `;
        this.updateSearchStatus('Уточніть пошук');
    }

    getSuggestionsForQuery(query) {
        const queryLower = query.toLowerCase();
        const suggestions = [];
        
        // Спеціальні підказки для популярних коротких назв
        if (queryLower === 'it') {
            suggestions.push('Спробуйте "It 2017" (нова версія)');
            suggestions.push('Спробуйте "It 1990" (класична версія)');
            suggestions.push('Спробуйте "Stephen King It"');
        } else if (queryLower === 'batman') {
            suggestions.push('Спробуйте "The Dark Knight"');
            suggestions.push('Спробуйте "Batman 2022"');
            suggestions.push('Спробуйте "Batman Begins"');
        } else if (queryLower === 'avatar') {
            suggestions.push('Спробуйте "Avatar 2009"');
            suggestions.push('Спробуйте "Avatar 2022"');
        } else {
            // Загальні підказки
            suggestions.push('Додайте рік випуску (наприклад: "Avatar 2009")');
            suggestions.push('Будьте більш конкретними ("The Dark Knight" замість "Batman")');
            suggestions.push('Використайте кнопку типу пошуку вгорі');
            suggestions.push('Додайте ім\'я актора або режисера');
        }
        
        return suggestions;
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
        card.onclick = () => {
            this.showMovieDetails(movie.imdbID).catch(error => {
                console.error('Помилка при показі деталей фільму:', error);
            });
        };

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

    async showMovieDetails(imdbID) {
        // Блокуємо скролл основної сторінки
        document.body.style.overflow = 'hidden';
        
        // Створюємо модальне вікно з Tailwind стилями
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        
        // Показуємо завантаження
        modal.innerHTML = `
            <div class="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl transform animate-slide-up">
                <div class="text-center">
                    <div class="loading-spinner mx-auto mb-4"></div>
                    <p class="text-gray-600">Завантаження інформації про фільм...</p>
                </div>
            </div>
        `;
        
        const closeModal = () => {
            if (document.body.contains(modal)) {
                document.body.removeChild(modal);
            }
            // Відновлюємо скролл основної сторінки
            document.body.style.overflow = '';
            document.removeEventListener('keydown', escListener);
        };
        
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeModal();
            }
        };

        const escListener = (e) => {
            if (e.key === 'Escape') {
                closeModal();
            }
        };
        document.addEventListener('keydown', escListener);

        document.body.appendChild(modal);

        try {
            // Отримуємо детальну інформацію про фільм
            const response = await fetch(`${this.baseUrl}?apikey=${this.apiKey}&i=${imdbID}&plot=full`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const movieData = await response.json();
            
            if (movieData.Response === 'False') {
                throw new Error(movieData.Error || 'Не вдалося отримати інформацію про фільм');
            }

            // Оновлюємо модальне вікно з детальною інформацією
            modal.innerHTML = this.createDetailedMovieModal(movieData, escListener);
            
        } catch (error) {
            console.error('Помилка отримання деталей фільму:', error);
            modal.innerHTML = `
                <div class="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl transform animate-slide-up">
                    <div class="text-center">
                        <div class="text-6xl mb-4">❌</div>
                        <h3 class="text-xl font-bold text-gray-900 mb-4">Помилка</h3>
                        <p class="text-gray-600 mb-6">Не вдалося завантажити інформацію про фільм</p>
                        <button 
                            onclick="this.closest('.fixed').remove(); document.body.style.overflow = '';" 
                            class="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-2xl font-semibold hover:from-purple-600 hover:to-pink-600 transition-all duration-300 shadow-lg hover:shadow-xl"
                        >
                            Закрити
                        </button>
                    </div>
                </div>
            `;
        }
    }

    createDetailedMovieModal(movieData, escListener) {
        const formatRating = (rating) => {
            if (!rating || rating === 'N/A') return 'Н/Д';
            return rating;
        };

        const formatRuntime = (runtime) => {
            if (!runtime || runtime === 'N/A') return 'Н/Д';
            return runtime;
        };

        const formatPlot = (plot) => {
            if (!plot || plot === 'N/A') return 'Опис недоступний';
            return plot;
        };

        const formatList = (list) => {
            if (!list || list === 'N/A') return 'Н/Д';
            return list.split(', ').join(', ');
        };

        return `
            <div class="bg-white rounded-3xl max-w-4xl w-full shadow-2xl transform animate-slide-up max-h-[90vh] overflow-y-auto modal-scrollbar">
                <!-- Header -->
                <div class="sticky top-0 bg-white rounded-t-3xl p-6 border-b border-gray-100">
                    <div class="flex justify-between items-start">
                        <h2 class="text-2xl font-bold text-gray-900 pr-4">${movieData.Title}</h2>
                        <button 
                            onclick="this.closest('.fixed').remove(); document.body.style.overflow = '';" 
                            class="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-2"
                            title="Закрити"
                        >
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                    <div class="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-600">
                        <span class="flex items-center">
                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                            </svg>
                            ${movieData.Year}
                        </span>
                        <span class="flex items-center">
                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            ${formatRuntime(movieData.Runtime)}
                        </span>
                        <span class="flex items-center">
                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2"/>
                            </svg>
                            ${this.translateType(movieData.Type)}
                        </span>
                        <span class="flex items-center">
                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2"/>
                            </svg>
                            ${movieData.Rated || 'Н/Д'}
                        </span>
                    </div>
                </div>

                <!-- Content -->
                <div class="p-6">
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <!-- Poster -->
                        <div class="lg:col-span-1">
                            <div class="bg-gray-100 rounded-2xl overflow-hidden shadow-lg">
                                ${movieData.Poster && movieData.Poster !== 'N/A' 
                                    ? `<img src="${movieData.Poster}" alt="${movieData.Title}" class="w-full h-auto object-cover">`
                                    : this.createPlaceholderPoster()
                                }
                            </div>
                            
                            <!-- Ratings -->
                            ${movieData.Ratings && movieData.Ratings.length > 0 ? `
                                <div class="mt-4 bg-gray-50 rounded-2xl p-4">
                                    <h4 class="font-semibold text-gray-900 mb-3">Рейтинги</h4>
                                    <div class="space-y-2">
                                        ${movieData.Ratings.map(rating => `
                                            <div class="flex justify-between items-center">
                                                <span class="text-sm text-gray-600">${rating.Source}</span>
                                                <span class="font-semibold text-purple-600">${rating.Value}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>

                        <!-- Details -->
                        <div class="lg:col-span-2 space-y-6">
                            <!-- Plot -->
                            <div>
                                <h3 class="text-lg font-semibold text-gray-900 mb-2">Сюжет</h3>
                                <p class="text-gray-700 leading-relaxed">${formatPlot(movieData.Plot)}</p>
                            </div>

                            <!-- Cast & Crew -->
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <h4 class="font-semibold text-gray-900 mb-2">Режисер</h4>
                                    <p class="text-gray-700">${formatList(movieData.Director)}</p>
                                </div>
                                <div>
                                    <h4 class="font-semibold text-gray-900 mb-2">Актори</h4>
                                    <p class="text-gray-700">${formatList(movieData.Actors)}</p>
                                </div>
                            </div>

                            <!-- Additional Info -->
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <h4 class="font-semibold text-gray-900 mb-2">Жанр</h4>
                                    <p class="text-gray-700">${formatList(movieData.Genre)}</p>
                                </div>
                                <div>
                                    <h4 class="font-semibold text-gray-900 mb-2">Країна</h4>
                                    <p class="text-gray-700">${formatList(movieData.Country)}</p>
                                </div>
                                <div>
                                    <h4 class="font-semibold text-gray-900 mb-2">Мова</h4>
                                    <p class="text-gray-700">${formatList(movieData.Language)}</p>
                                </div>
                                <div>
                                    <h4 class="font-semibold text-gray-900 mb-2">Сценарист</h4>
                                    <p class="text-gray-700">${formatList(movieData.Writer)}</p>
                                </div>
                            </div>

                            <!-- Awards -->
                            ${movieData.Awards && movieData.Awards !== 'N/A' ? `
                                <div>
                                    <h4 class="font-semibold text-gray-900 mb-2">Нагороди</h4>
                                    <p class="text-gray-700">${movieData.Awards}</p>
                                </div>
                            ` : ''}

                            <!-- Box Office -->
                            ${movieData.BoxOffice && movieData.BoxOffice !== 'N/A' ? `
                                <div>
                                    <h4 class="font-semibold text-gray-900 mb-2">Касові збори</h4>
                                    <p class="text-gray-700">${movieData.BoxOffice}</p>
                                </div>
                            ` : ''}

                            <!-- Production -->
                            ${movieData.Production && movieData.Production !== 'N/A' ? `
                                <div>
                                    <h4 class="font-semibold text-gray-900 mb-2">Виробництво</h4>
                                    <p class="text-gray-700">${movieData.Production}</p>
                                </div>
                            ` : ''}

                            <!-- IMDb ID -->
                            <div class="pt-4 border-t border-gray-200">
                                <p class="text-sm text-gray-500">
                                    IMDb ID: <span class="font-mono text-purple-600">${movieData.imdbID}</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
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
        let errorMsg = message;
        if (message instanceof TypeError) {
            errorMsg = 'Помилка мережі або сервер недоступний. Спробуйте пізніше.';
        }
        this.resultsContainer.innerHTML = `
            <div class="col-span-full text-center py-16">
                <div class="bg-red-50 border border-red-200 rounded-3xl p-8 max-w-md mx-auto">
                    <svg class="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <h3 class="text-lg font-semibold text-red-800 mb-2">Помилка</h3>
                    <p class="text-red-600">${errorMsg}</p>
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