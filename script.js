class MovieSearchApp {
    constructor() {
        this.apiKey = '76b1923b';
        this.baseUrl = 'https://www.omdbapi.com/';
        this.searchInput = document.getElementById('searchInput');
        this.resultsContainer = document.getElementById('resultsContainer');
        this.searchStatus = document.getElementById('searchStatus');
        this.searchTypeBtn = document.getElementById('searchTypeBtn');
        this.yearFilter = document.getElementById('yearFilter');
        this.clearYearBtn = document.getElementById('clearYearBtn');
        this.searchTimeout = null;
        this.currentQuery = '';
        this.searchTypes = ['all', 'movie', 'series'];
        this.currentTypeIndex = 0;
        this.currentPage = 1;
        this.totalResults = 0;
        this.hasMoreResults = false;
        
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

        // Додаємо слухач для фільтра року
        this.yearFilter.addEventListener('change', () => {
            if (this.currentQuery.length >= 3) {
                this.currentPage = 1;
                this.searchMovies(this.currentQuery, false);
            }
        });

        // Додаємо слухач для кнопки очищення року
        this.clearYearBtn.addEventListener('click', () => {
            this.yearFilter.value = '';
            if (this.currentQuery.length >= 3) {
                this.currentPage = 1;
                this.searchMovies(this.currentQuery, false);
            }
        });

        // Ініціалізуємо список років
        this.initializeYearFilter();

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
            this.currentPage = 1;
            this.searchMovies(this.currentQuery, false);
        }
    }

    initializeYearFilter() {
        const currentYear = new Date().getFullYear();
        const startYear = 1900;
        
        // Додаємо роки від 1900 до поточного року
        for (let year = currentYear; year >= startYear; year--) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            this.yearFilter.appendChild(option);
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
            this.showMessage('OMDb API підтримує лише англійські назви. Спробуйте ввести назву латиницею.', 'text-red-800');
            this.updateSearchStatus('Використовуйте латиницю');
            return;
        }

        // Якщо запит занадто короткий, чекаємо більше символів
        if (query.length < 3) {
            this.showMessage('Введіть принаймні 3 символи для пошуку...', 'text-red-600');
            this.updateSearchStatus('Потрібно більше символів...');
            return;
        }

        this.updateSearchStatus('Пошук...');

        // Встановлюємо затримку для оптимізації запитів
        this.searchTimeout = setTimeout(() => {
            this.searchMovies(query, false);
        }, 300);
    }

    async searchMovies(query, isLoadMore = false) {
        // Перевіряємо, чи змінився запит
        if (!isLoadMore) {
            this.currentQuery = query;
            this.currentPage = 1;
        }
        
        // Показуємо індикатор завантаження тільки для нового пошуку
        if (!isLoadMore) {
            this.showLoading();
        }

        try {
            const currentType = this.searchTypes[this.currentTypeIndex];
            let apiUrl = `${this.baseUrl}?apikey=${this.apiKey}&s=${encodeURIComponent(query)}`;
            
            // Додаємо рік якщо він вибраний
            if (this.yearFilter.value) {
                apiUrl += `&y=${this.yearFilter.value}`;
            }
            
            // Додаємо тип пошуку якщо не "all"
            if (currentType !== 'all') {
                apiUrl += `&type=${currentType}`;
            }
            
            // Додаємо номер сторінки
            apiUrl += `&page=${this.currentPage}`;
            
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

            // Обробляємо результати
            if (data.Response === 'True') {
                // Фільтруємо результати, щоб прибрати епізоди та ігри
                const filteredResults = data.Search.filter(movie => 
                    movie.Type !== 'episode' && movie.Type !== 'game'
                );
                
                // Зберігаємо загальну кількість результатів
                this.totalResults = parseInt(data.totalResults) || 0;
                this.hasMoreResults = this.currentPage * 10 < this.totalResults;
                
                if (this.currentPage === 1) {
                    // Перша сторінка - показуємо результати
                    this.displayResults(filteredResults);
                } else {
                    // Додаткова сторінка - додаємо до існуючих
                    this.appendResults(filteredResults);
                }
                
                this.updateSearchStatus(`Знайдено ${this.totalResults} результатів${this.hasMoreResults ? ` (сторінка ${this.currentPage})` : ''}`);
            } else {
                // Спеціальна обробка для "Too many results"
                if (data.Error === 'Too many results.') {
                    this.showMessage('Занадто багато результатів. Спробуйте уточнити пошук.', 'text-red-800');
                    this.updateSearchStatus('Уточніть пошук');
                } else {
                    this.showMessage(data.Error || 'Фільми не знайдено', 'text-gray-600');
                    this.updateSearchStatus('Нічого не знайдено');
                }
            }
        } catch (error) {
            console.error('Помилка пошуку:', error);
            this.showError('Помилка підключення до сервера. Спробуйте пізніше.');
            this.updateSearchStatus('Помилка');
        }
    }





    displayResults(movies) {
        // Очищуємо контейнер
        this.resultsContainer.innerHTML = '';

        // Створюємо картки фільмів
        movies.forEach((movie, index) => {
            const movieCard = this.createMovieCard(movie, index);
            this.resultsContainer.appendChild(movieCard);
        });
        
        // Додаємо кнопку "Завантажити ще" якщо є більше результатів
        if (this.hasMoreResults) {
            this.addLoadMoreButton();
        }
    }

    appendResults(movies) {
        // Видаляємо стару кнопку "Завантажити ще" якщо вона є
        const oldLoadMoreBtn = document.getElementById('loadMoreBtn');
        if (oldLoadMoreBtn) {
            oldLoadMoreBtn.remove();
        }
        
        // Додаємо нові картки до існуючих
        const startIndex = this.resultsContainer.children.length;
        movies.forEach((movie, index) => {
            const movieCard = this.createMovieCard(movie, startIndex + index);
            this.resultsContainer.appendChild(movieCard);
        });
        
        // Додаємо кнопку "Завантажити ще" в кінець
        if (this.hasMoreResults) {
            this.addLoadMoreButton();
        }
    }

    addLoadMoreButton() {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.id = 'loadMoreBtn';
        loadMoreBtn.className = `
            col-span-full mt-8 px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 
            text-white font-semibold rounded-2xl hover:from-purple-600 hover:to-pink-600 
            transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105
        `;
        loadMoreBtn.textContent = `Завантажити ще (${this.totalResults - this.currentPage * 10} залишилося)`;
        loadMoreBtn.onclick = () => this.loadMoreResults();
        
        this.resultsContainer.appendChild(loadMoreBtn);
    }

    updateLoadMoreButton() {
        const loadMoreBtn = document.getElementById('loadMoreBtn');
        if (loadMoreBtn) {
            const remaining = this.totalResults - this.currentPage * 10;
            if (remaining > 0) {
                loadMoreBtn.textContent = `Завантажити ще (${remaining} залишилося)`;
            } else {
                loadMoreBtn.remove();
            }
        }
    }

    async loadMoreResults() {
        this.currentPage++;
        await this.searchMovies(this.currentQuery, true);
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
            this.searchStatus.className = 'text-sm text-purple-950 font-medium mb-6';
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