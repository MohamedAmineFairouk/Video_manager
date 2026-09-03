let currentVideos = [];
        let allVideos = [];
        let playerVideos = [];
        let currentIndex = -1;
        let currentPage = 1;
        let pageSize = 50;
        let selectedVideoIds = new Set();

        async function fetchJson(url) {
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error("Erreur HTTP " + res.status);
            }
            return await res.json();
        }

        async function fetchText(url) {
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error("Erreur HTTP " + res.status);
            }
            return await res.text();
        }

        function getSelectedTag() {
            return Array.from(document.getElementById('tagSelect').selectedOptions)
                .map(opt => opt.value)
                .filter(val => val && val.trim() !== '');
        }

        function getSelectedCreator() {
            return document.getElementById('creatorSelect').value;
        }

        function getSelectedSourceIndex() {
            // La valeur du filtre étoiles est déjà inversée :
            // 1 = 5 étoiles, 2 = 4 étoiles, ..., 5 = 1 étoile
            return document.getElementById('sourceIndexSelect').value;
        }

        function setStatus(message) {
            document.getElementById('status').textContent = message || '';
        }
        function openPlayer(encodedUrl, encodedTitle) {
            const url = decodeURIComponent(encodedUrl);
            const title = decodeURIComponent(encodedTitle);

            document.getElementById('playerTitle').textContent = title || 'Lecture vidéo';
            document.getElementById('mainPlayer').src = url;
            document.getElementById('playerModal').style.display = 'flex';
        }
        function formatDuration(ms) {
            if (!ms) return '';

            const totalSeconds = Math.floor(ms / 1000);

            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            if (hours > 0) {
                return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }

            return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }

        function renderLevelStars(level) {
            const normalizedLevel = typeof level === 'number' && level >= 1 && level <= 5 ? level : 1;
            const filledStars = 6 - normalizedLevel;
            let html = '';

            for (let index = 1; index <= 5; index++) {
                html += `<span style="color:${index <= filledStars ? '#facc15' : '#334155'};font-size:15px;">★</span>`;
            }

            return html;
        }

        function getSelectedPageSize() {
            const raw = Number(document.getElementById('pageSizeSelect')?.value || 50);
            return Number.isFinite(raw) && raw > 0 ? raw : 50;
        }

        function renderPagination(totalCount, totalPages) {
            const box = document.getElementById('pagination');
            if (!box) return;
            box.innerHTML = '';

            if (!totalCount || totalPages <= 1) return;

            const prev = document.createElement('button');
            prev.className = 'page-btn';
            prev.textContent = 'Préc';
            prev.disabled = currentPage <= 1;
            prev.onclick = () => goToPage(currentPage - 1);
            box.appendChild(prev);

            const start = Math.max(1, currentPage - 2);
            const end = Math.min(totalPages, currentPage + 2);
            for (let p = start; p <= end; p++) {
                const btn = document.createElement('button');
                btn.className = 'page-btn' + (p === currentPage ? ' active' : '');
                btn.textContent = String(p);
                btn.onclick = () => goToPage(p);
                box.appendChild(btn);
            }

            const next = document.createElement('button');
            next.className = 'page-btn';
            next.textContent = 'Suiv';
            next.disabled = currentPage >= totalPages;
            next.onclick = () => goToPage(currentPage + 1);
            box.appendChild(next);
        }

        function goToPage(page) {
            const totalPages = Math.max(1, Math.ceil((allVideos?.length || 0) / pageSize));
            currentPage = Math.max(1, Math.min(totalPages, page));
            renderVideos(allVideos, true);
        }

        function onPageSizeChange() {
            pageSize = getSelectedPageSize();
            currentPage = 1;
            renderVideos(allVideos, true);
        }

        function renderVideos(videos, keepPage = false) {

            allVideos = videos || [];
            if (!keepPage) currentPage = 1;
            pageSize = getSelectedPageSize();
            const totalPages = Math.max(1, Math.ceil(allVideos.length / pageSize));
            if (currentPage > totalPages) currentPage = totalPages;
            const start = (currentPage - 1) * pageSize;
            currentVideos = allVideos.slice(start, start + pageSize);
            currentIndex = -1;

            const container = document.getElementById('videos');
            const countBox = document.getElementById('videoCount');
            container.innerHTML = '';
            countBox.textContent = allVideos.length + ' vidéo(s)';

            if (!allVideos.length) {
                renderPagination(0, 1);
                container.innerHTML = '<div class="empty-state">Aucune vidéo trouvée.</div>';
                return;
            }

            // Vérifier si au moins une vidéo a une URL valide
            const hasValidUrl = allVideos.some(v => v.url && typeof v.url === 'string' && v.url.trim() !== '');
            if (!hasValidUrl) {
                renderPagination(allVideos.length, totalPages);
                container.innerHTML = '<div class="empty-state" style="color:#f87171;">Erreur : aucune vidéo n\'a d\'URL valide.<br>Vérifiez la configuration du host ou la base de données.<br>Astuce : testez l\'API /api/videos dans un navigateur pour voir les URLs générées.</div>';
                return;
            }

            currentVideos.forEach((v, index) => {
                const card = document.createElement('div');
                card.className = 'video-card';

                const thumbUrl = `/api/videos/thumbnail?id=${v.id}`;

                const creators = Array.isArray(v.creators) && v.creators.length > 0
                    ? v.creators.map(name => `<span class="creator-badge">${name}</span>`).join('')
                    : '<span class="creator-badge" style="background:#64748b;">Unknown</span>';
                card.innerHTML = `
    <div style="position:relative;">
        <div class="favorite-icon ${v.favorite ? 'favorite-active' : ''}" onclick="toggleFavoriteModal(${v.id}, this)">♥</div>
        <input type="checkbox" class="video-checkbox" data-id="${v.id}" style="position:absolute; top:8px; right:8px; width:20px; height:20px; cursor:pointer; z-index:10;" onchange="toggleVideoSelection(${v.id}, this.checked)" />
        <img src="${thumbUrl}" class="video-thumb" loading="lazy" onclick="openPlayerByIndex(${index})" onerror="this.style.opacity=0.3;" />
        <div class="video-overlay">
            <div class="video-title" title="${v.title ?? ''}">${v.title ?? ''}</div>
            <div class="video-meta">
                ${creators}
                ${Array.isArray(v.tags) && v.tags.length > 0 ? '• ' + v.tags.join(', ') : ''}
                <span class="level-stars">${renderLevelStars(v.sourceIndex)}</span>
            </div>
        </div>
        <div class="video-duration">${formatDuration(v.durationMs)}</div>
    </div>
                `;
                container.appendChild(card);
            });

            renderPagination(allVideos.length, totalPages);

        }

        function getVideoById(videoId) {
            return playerVideos.find(video => video.id === videoId)
                || currentVideos.find(video => video.id === videoId)
                || allVideos.find(video => video.id === videoId);
        }

        async function createTagForCurrentVideo() {
            const video = playerVideos[currentIndex];
            if (!video) {
                return;
            }

            const name = prompt('Nom du tag :');
            if (!name || !name.trim()) {
                return;
            }

            const response = await fetch(`/api/videos/tags?name=${encodeURIComponent(name.trim())}`, {
                method: 'POST'
            });
            if (!response.ok) {
                setStatus(await response.text());
                return;
            }

            const tagName = name.trim();
            video.tags = [...new Set([...(video.tags || []), tagName])];
            const updateResponse = await fetch(`/api/videos/${video.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tags: video.tags })
            });
            if (!updateResponse.ok) {
                setStatus('Le tag a été créé, mais son association à la vidéo a échoué.');
                return;
            }

            const updatedVideo = await updateResponse.json();
            const videoIndex = playerVideos.findIndex(item => item.id === updatedVideo.id);
            if (videoIndex >= 0) {
                playerVideos[videoIndex] = updatedVideo;
            }
            const allVideoIndex = allVideos.findIndex(item => item.id === updatedVideo.id);
            if (allVideoIndex >= 0) {
                allVideos[allVideoIndex] = updatedVideo;
            }
            openPlayerInQueue(currentIndex);
            setStatus('Tag créé et associé à la vidéo.');
        }

        async function toggleFavoriteModal(videoId, button) {
            const video = getVideoById(videoId);
            if (!video) return;

            await fetch(`/api/videos/favorite/toggle?id=${videoId}`);

            video.favorite = !video.favorite;
            button.classList.toggle('favorite-active');
            document.getElementById('playerFavoriteState').textContent = video.favorite ? 'Oui' : 'Non';
        }
        async function loadVideos() {
            try {
                setStatus('Chargement des vidéos...');
                const tag = getSelectedTag();
                const creator = getSelectedCreator();
                const sourceIndex = getSelectedSourceIndex();
                const favoriteOnly = document.getElementById('favoriteFilter')?.checked;

                let videos = await fetchJson('/api/videos');

                if (tag.length > 0) {
                    videos = videos.filter(v => {
                        const videoTags = Array.isArray(v.tags) ? v.tags : [];
                        // ET logique : la vidéo doit contenir tous les tags sélectionnés (peu importe s'il y en a d'autres)
                        return tag.every(selected => videoTags.includes(selected));
                    });
                }

                if (creator) {
                    videos = videos.filter(v => Array.isArray(v.creators) && v.creators.includes(creator));
                }

                if (sourceIndex) {
                    videos = videos.filter(v => String(v.sourceIndex) === sourceIndex);
                }
                if (favoriteOnly) {
                    videos = videos.filter(v => v.favorite === true);
                }
                const sortOrder = document.getElementById('sortSelect').value;
                applySortOrder(sortOrder, videos);
                renderVideos(videos);
                setStatus('');
            } catch (e) {
                setStatus('Erreur chargement vidéos');
            }
        }

        async function loadTags() {
            try {
                const tags = await fetchJson('/api/videos/tags');
                const filterSelect = document.getElementById('tagSelect');

                filterSelect.innerHTML = '<option value="">Tous</option>';

                tags.forEach(tag => {
                    const opt1 = document.createElement('option');
                    opt1.value = tag;
                    opt1.textContent = tag;
                    filterSelect.appendChild(opt1);
                });
            } catch (e) {}
        }

        async function loadCreators() {
            try {
                const creators = await fetchJson('/api/videos/creators');

                const select = document.getElementById('creatorSelect');
                const newCreator = document.getElementById('newCreator');

                select.innerHTML = '<option value="">Tous</option>';
                newCreator.innerHTML = '<option value="">Sélectionner creator</option>';

                creators.forEach(creator => {
                    const opt1 = document.createElement('option');
                    opt1.value = creator;
                    opt1.textContent = creator;
                    select.appendChild(opt1);

                    const opt2 = document.createElement('option');
                    opt2.value = creator;
                    opt2.textContent = creator;
                    newCreator.appendChild(opt2);
                });
            } catch (e) {}
        }

        async function loadHost() {
            try {
                const host = await fetchText('/api/config/host');
                document.getElementById('hostInput').value = host;
            } catch (e) {}
        }

        async function updateHost() {
            try {
                const host = document.getElementById('hostInput').value.trim();
                if (!host) return;

                setStatus('Mise à jour du host...');
                await fetch(`/api/config/host/set?host=${encodeURIComponent(host)}`);
                await loadVideos();
                setStatus('Host mis à jour');
            } catch (e) {
                setStatus('Erreur mise à jour host');
            }
        }

        async function saveDb() {
            try {
                setStatus('Sauvegarde de la base...');
                await fetch('/api/db/save');
                setStatus('Base sauvegardée ✔');
            } catch (e) {
                setStatus('Erreur sauvegarde DB');
            }
        }

        async function resetFilters() {
            const tagSelect = document.getElementById('tagSelect');
            Array.from(tagSelect.options).forEach(opt => opt.selected = false);
            document.getElementById('creatorSelect').value = '';
            document.getElementById('sourceIndexSelect').value = '';
            document.getElementById('sortSelect').value = 'recent';
            await loadVideos();
        }

        async function createVideo() {
            const fileName = document.getElementById('newFileName').value.trim();
            const title = document.getElementById('newTitle').value.trim();
            const creator = document.getElementById('newCreator').value;

            if (!fileName) {
                setStatus('Le nom de fichier est requis.');
                return;
            }

            const params = new URLSearchParams();
            params.set('fileName', fileName);
            if (title) params.set('title', title);
            if (creator) params.set('creator', creator);

            setStatus('Ajout de la vidéo...');
            try {
                await fetch(`/api/videos/create?${params.toString()}`);
                setStatus('Vidéo ajoutée.');
                document.getElementById('newFileName').value = '';
                document.getElementById('newTitle').value = '';
                document.getElementById('newCreator').value = '';
                await loadCreators();
                await loadVideos();
            } catch (e) {
                setStatus('Erreur ajout vidéo');
                console.error(e);
            }
        }

        async function onFilterChange() {
            await loadVideos();
        }

        function onSortChange() {
            const sortOrder = document.getElementById('sortSelect').value;
            applySortOrder(sortOrder, allVideos);
            renderVideos(allVideos, true);
        }

        function applySortOrder(order, list = allVideos) {
            if (!list || list.length === 0) return;

            switch (order) {
                case 'name-asc':
                    list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
                    break;
                case 'name-desc':
                    list.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
                    break;
                case 'recent':
                    list.sort((a, b) => (b.id || 0) - (a.id || 0));
                    break;
                case 'oldest':
                    list.sort((a, b) => (a.id || 0) - (b.id || 0));
                    break;
                case 'default':
                default:
                    // No sort, keep as-is
                    break;
            }
        }

        function toggleVideoSelection(videoId, isChecked) {
            if (isChecked) {
                selectedVideoIds.add(videoId);
            } else {
                selectedVideoIds.delete(videoId);
            }
            updateSelectionCount();
        }

        function selectAllVisible() {
            currentVideos.forEach(v => selectedVideoIds.add(v.id));
            document.querySelectorAll('.video-checkbox').forEach(cb => cb.checked = true);
            updateSelectionCount();
        }

        function selectNone() {
            selectedVideoIds.clear();
            document.querySelectorAll('.video-checkbox').forEach(cb => cb.checked = false);
            updateSelectionCount();
        }

        function updateSelectionCount() {
            const count = selectedVideoIds.size;
            const countEl = document.getElementById('selectionCount');
            if (countEl) {
                countEl.textContent = count > 0 ? `${count} sélectionné(s)` : '';
            }
        }

        async function exportM3U() {
            if (selectedVideoIds.size === 0) {
                setStatus('Veuillez sélectionner au moins une vidéo.');
                return;
            }

            const selectedVideos = currentVideos.filter(v => selectedVideoIds.has(v.id));
            
            let m3uContent = '#EXTM3U\n';
            selectedVideos.forEach(v => {
                m3uContent += `#EXTINF:${Math.floor((v.durationMs || 0) / 1000)},${v.title || 'Vidéo'}\n`;
                m3uContent += `${v.url}\n`;
            });

            const blob = new Blob([m3uContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `arcad_playlist_${new Date().getTime()}.m3u`;
            a.click();
            URL.revokeObjectURL(url);
            
            setStatus(`Playlist M3U exportée (${selectedVideos.length} vidéo(s)).`);
        }
        let deleteCandidateId = null;

        function closePlayer() {
            const watchedVideo = currentIndex >= 0 && playerVideos[currentIndex] ? playerVideos[currentIndex] : null;
            if (watchedVideo) {
                reportWatchSession(watchedVideo.id);
            }
            const player = document.getElementById('mainPlayer');
            player.pause();
            player.src = '';
            document.getElementById('playerModal').style.display = 'none';
            const seek = document.getElementById('seekBar');
            if (seek) seek.value = 0;
            const cur = document.getElementById('currentTime');
            if (cur) cur.textContent = '00:00';
            hideSeekPreview();
            setBuffering(false);
            currentIndex = -1;
            playerVideos = [];

            closeDeleteConfirm();
        }

        function openDeleteConfirm() {
            if (!playerVideos || currentIndex < 0 || currentIndex >= playerVideos.length) return;
            const video = playerVideos[currentIndex];
            deleteCandidateId = video.id;
            const confirmText = document.getElementById('confirmText');
            confirmText.textContent = `Voulez-vous vraiment supprimer "${video.title || 'cette vidéo'}" ?`;
            document.getElementById('confirmModal').style.display = 'flex';
        }

        function closeDeleteConfirm() {
            deleteCandidateId = null;
            document.getElementById('confirmModal').style.display = 'none';
        }

        async function confirmDelete() {
            if (!deleteCandidateId) return;

            try {
                await fetch(`/api/videos/delete?id=${deleteCandidateId}`);
                setStatus('Vidéo supprimée.');
                closeDeleteConfirm();
                closePlayer();
                await loadVideos();
            } catch (e) {
                setStatus('Erreur suppression vidéo');
                console.error(e);
            }
        }

        function playNext() {
            if (currentIndex >= playerVideos.length - 1) return;
            openPlayerInQueue(currentIndex + 1);
        }

        function renderUpNextVideos() {
            const container = document.getElementById('upNextList');
            if (!container) return;

            container.innerHTML = '';
            const nextVideos = playerVideos.slice(currentIndex + 1, currentIndex + 51);

            if (!nextVideos.length) {
                container.innerHTML = '<p class="up-next-empty">Aucune autre vidéo dans cette liste.</p>';
                return;
            }

            nextVideos.forEach((video, offset) => {
                const videoIndex = currentIndex + offset + 1;
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'up-next-item';
                item.onclick = () => openPlayerInQueue(videoIndex);

                const thumbnail = document.createElement('img');
                thumbnail.className = 'up-next-thumbnail';
                thumbnail.src = `/api/videos/thumbnail?id=${video.id}`;
                thumbnail.alt = '';
                thumbnail.loading = 'lazy';
                thumbnail.onerror = () => {
                    thumbnail.style.opacity = '0.3';
                };

                const details = document.createElement('div');
                details.className = 'up-next-details';

                const title = document.createElement('div');
                title.className = 'up-next-video-title';
                title.textContent = video.title || video.fileName || 'Vidéo sans titre';

                const creators = Array.isArray(video.creators) && video.creators.length
                    ? video.creators.join(', ')
                    : 'Unknown';
                const tags = Array.isArray(video.tags) && video.tags.length
                    ? ` • ${video.tags.join(', ')}`
                    : '';
                const meta = document.createElement('div');
                meta.className = 'up-next-meta';
                meta.textContent = `${creators}${tags}`;

                const duration = document.createElement('div');
                duration.className = 'up-next-meta';
                duration.textContent = formatDuration(video.durationMs) || 'Durée inconnue';

                const level = document.createElement('span');
                level.className = 'up-next-level level-stars';
                level.innerHTML = renderLevelStars(video.sourceIndex);

                details.append(title, meta, duration, level);
                item.append(thumbnail, details);
                container.appendChild(item);
            });
        }

        function flashCenterPlayButton(isPlaying) {
            const button = document.getElementById('centerPlayButton');
            if (!button) return;
            button.textContent = isPlaying ? '⏸' : '▶';
            button.classList.remove('pulse');
            void button.offsetWidth; // force reflow to restart the animation
            button.classList.add('pulse');
        }

        function initPlayerEvents() {
            const player = document.getElementById('mainPlayer');
            const seek = document.getElementById('seekBar');

            player.addEventListener('ended', () => {
                if (currentIndex < playerVideos.length - 1) {
                    playNext();
                }
            });

            player.addEventListener('play', () => {
                document.getElementById('playPauseBtn').textContent = '⏸';
                flashCenterPlayButton(true);
            });

            player.addEventListener('pause', () => {
                document.getElementById('playPauseBtn').textContent = '▶';
                flashCenterPlayButton(false);
            });

            player.addEventListener('click', () => playOrPause());

            player.addEventListener('timeupdate', updateTimeline);
            player.addEventListener('loadedmetadata', updateTimeline);
            player.addEventListener('volumechange', () => {
                const muteBtn = document.getElementById('muteBtn');
                const volume = document.getElementById('volumeSlider');
                if (muteBtn) muteBtn.textContent = player.muted ? '🔇' : '🔊';
                if (volume) volume.value = player.muted ? 0 : player.volume;
            });

            player.addEventListener('waiting', () => setBuffering(true));
            player.addEventListener('stalled', () => setBuffering(true));
            player.addEventListener('seeking', () => setBuffering(true));
            player.addEventListener('playing', () => setBuffering(false));
            player.addEventListener('canplay', () => setBuffering(false));
            player.addEventListener('seeked', () => setBuffering(false));

            if (seek) {
                seek.addEventListener('mousemove', updateSeekPreviewFromEvent);
                seek.addEventListener('mouseleave', hideSeekPreview);
            }
        }

        function playOrPause() {
            const player = document.getElementById('mainPlayer');
            if (!player) return;
            if (player.paused || player.ended) {
                player.play();
            } else {
                player.pause();
            }
        }

        function playPrevious() {
            if (currentIndex <= 0) return;
            openPlayerInQueue(currentIndex - 1);
        }

        function updatePlayerNavButtons() {
            const prevBtn = document.getElementById('prevBtn');
            const nextBtn = document.getElementById('nextBtn');

            prevBtn.disabled = currentIndex <= 0;
            nextBtn.disabled = currentIndex >= playerVideos.length - 1;
        }

        async function checkAuthentication() {
            try {
                const res = await fetch('/api/config/auth/check');
                const isAuthenticated = await res.json();
                if (!isAuthenticated) {
                    window.location.href = '/login';
                }
            } catch (e) {
                console.error('Erreur vérification auth:', e);
                window.location.href = '/login';
            }
        }

        async function logout() {
            if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
                try {
                    await fetch('/api/config/logout');
                    window.location.href = '/login';
                } catch (e) {
                    console.error('Erreur logout:', e);
                }
            }
        }

        window.addEventListener('load', async () => {
            await checkAuthentication();
            initPlayerEvents();
            await loadHost();
            await loadTags();
            await loadCreators();
            await loadVideos();
        });
        document.addEventListener('keydown', (e) => {
            const modalVisible = document.getElementById('playerModal').style.display === 'flex';
            if (!modalVisible) return;

            const activeTag = document.activeElement?.tagName;
            const isTypingInField = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT' || document.activeElement?.isContentEditable;

            if (e.key === 'PageDown') {
                playNext();
            } else if (e.key === 'PageUp') {
                playPrevious();
            } else if (e.key === 'ArrowRight') {
                seekBy(10);
            } else if (e.key === 'ArrowLeft') {
                seekBy(-10);
            } else if (e.key === 'Escape') {
                closePlayer();
            } else if (e.key === ' ' && !isTypingInField) {
                e.preventDefault();
                playOrPause();
            }
        });

        document.getElementById('playerModal')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                closePlayer();
            }
        });

        function seekBy(seconds) {
            const player = document.getElementById('mainPlayer');
            if (!player || isNaN(player.currentTime)) return;
            const target = Math.max(0, Math.min(player.duration || Infinity, player.currentTime + seconds));
            player.currentTime = target;
            setStatus(`Position vidéo : ${Math.round(target)}s`);
        }

        function formatClock(seconds) {
            if (!Number.isFinite(seconds)) return '00:00';
            const s = Math.floor(seconds);
            const m = Math.floor(s / 60);
            const r = s % 60;
            return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`;
        }

        function updateTimeline() {
            const player = document.getElementById('mainPlayer');
            const seek = document.getElementById('seekBar');
            const cur = document.getElementById('currentTime');
            const total = document.getElementById('totalTime');
            if (!player || !seek || !cur || !total) return;
            const duration = Number.isFinite(player.duration) ? player.duration : 0;
            const current = Number.isFinite(player.currentTime) ? player.currentTime : 0;
            seek.value = duration > 0 ? (current / duration) * 100 : 0;
            cur.textContent = formatClock(current);
            total.textContent = formatClock(duration);
        }

        function updateSeekPreviewFromEvent(event) {
            const seek = document.getElementById('seekBar');
            const preview = document.getElementById('seekPreview');
            const player = document.getElementById('mainPlayer');
            if (!seek || !preview || !player || !Number.isFinite(player.duration)) return;
            const rect = seek.getBoundingClientRect();
            const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
            const ratio = rect.width > 0 ? x / rect.width : 0;
            preview.style.left = `${x}px`;
            preview.textContent = formatClock(player.duration * ratio);
            preview.classList.add('visible');
        }

        function hideSeekPreview() {
            const preview = document.getElementById('seekPreview');
            if (preview) preview.classList.remove('visible');
        }

        function setBuffering(active) {
            const indicator = document.getElementById('bufferingIndicator');
            if (!indicator) return;
            indicator.classList.toggle('show', !!active);
        }

        function onSeekBarInput(value) {
            const player = document.getElementById('mainPlayer');
            if (!player || !Number.isFinite(player.duration)) return;
            player.currentTime = (Number(value) / 100) * player.duration;
        }

        function setVolume(value) {
            const player = document.getElementById('mainPlayer');
            if (!player) return;
            player.volume = Math.max(0, Math.min(1, Number(value)));
            player.muted = player.volume === 0;
            const muteBtn = document.getElementById('muteBtn');
            if (muteBtn) muteBtn.textContent = player.muted ? '🔇' : '🔊';
        }

        function toggleMute() {
            const player = document.getElementById('mainPlayer');
            if (!player) return;
            player.muted = !player.muted;
            const muteBtn = document.getElementById('muteBtn');
            const volume = document.getElementById('volumeSlider');
            if (muteBtn) muteBtn.textContent = player.muted ? '🔇' : '🔊';
            if (volume) volume.value = player.muted ? 0 : player.volume;
        }

        function changeSpeed(value) {
            const player = document.getElementById('mainPlayer');
            if (!player) return;
            player.playbackRate = Number(value) || 1;
        }

        function toggleTheaterMode() {
            const shell = document.getElementById('playerShell');
            if (!shell) return;
            shell.classList.toggle('theater');
        }

        function toggleFullScreen() {
            const video = document.getElementById('mainPlayer');
            if (!video) return;
            if (!document.fullscreenElement) {
                if (video.requestFullscreen) video.requestFullscreen();
                else if (video.webkitRequestFullscreen) video.webkitRequestFullscreen();
            } else {
                if (document.exitFullscreen) document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            }
        }

        function markVideoAsWatched(videoId) {
            if (!videoId) return;
            fetch(`/api/videos/${videoId}/watched`, { method: 'POST' }).catch(error => {
                console.error('Erreur mise a jour recently watched:', error);
            });
        }

        function reportWatchSession(videoId) {
            if (!videoId) return;
            const p = document.getElementById('mainPlayer');
            const watchedSeconds = Math.floor(Number(p?.currentTime) || 0);
            fetch(`/api/videos/${videoId}/watch-session?watchedSeconds=${watchedSeconds}&page=index`, { method: 'POST' }).catch(() => {});
        }

        function openPlayerByIndex(index) {
            if (!currentVideos || index < 0 || index >= currentVideos.length) return;

            const selectedVideo = currentVideos[index];
            playerVideos = allVideos.length ? allVideos : currentVideos;
            const playerIndex = playerVideos.findIndex(video => video.id === selectedVideo.id);
            openPlayerInQueue(playerIndex);
        }

        function openPlayerInQueue(index) {
            if (!playerVideos || index < 0 || index >= playerVideos.length) return;

            const previousVideo = currentIndex >= 0 && playerVideos[currentIndex] ? playerVideos[currentIndex] : null;
            if (previousVideo) {
                reportWatchSession(previousVideo.id);
            }

            currentIndex = index;
            const video = playerVideos[index];

            document.getElementById('playerTitle').textContent = video.title || 'Lecture vidéo';
            const creators = Array.isArray(video.creators) && video.creators.length
                ? video.creators.join(', ')
                : 'Unknown';
            document.getElementById('playerSubtitle').textContent = `Créateur: ${creators} • Level: ${video.sourceIndex ?? 'N/A'} • Tags: ${Array.isArray(video.tags) && video.tags.length > 0 ? video.tags.join(', ') : 'Aucun'}`;
            document.getElementById('playerDuration').textContent = `${formatDuration(video.durationMs)} / ${formatDuration(video.durationMs || 0)}`;
            document.getElementById('playerFavoriteState').textContent = video.favorite ? 'Oui' : 'Non';

            const player = document.getElementById('mainPlayer');
            player.pause();
            player.src = video.url || '';
            document.getElementById('playerModal').style.display = 'flex';
            markVideoAsWatched(video.id);
            renderUpNextVideos();

            // Build tag checkboxes
            const videoTags = Array.isArray(video.tags) ? video.tags : [];
            const container = document.getElementById('tagCheckboxesContainer');
            container.innerHTML = '';
            const tagSelect = document.getElementById('tagSelect');
            Array.from(tagSelect.options).forEach(opt => {
                if (!opt.value) return; // skip "Tous"
                const label = document.createElement('label');
                label.style.display = 'flex';
                label.style.alignItems = 'center';
                label.style.gap = '4px';
                label.style.cursor = 'pointer';
                label.style.color = '#e0f2fe';
                label.style.fontSize = '11px';
                label.style.padding = '3px 8px';
                label.style.background = 'rgba(59,130,246,0.25)';
                label.style.border = '1px solid rgba(59,130,246,0.4)';
                label.style.borderRadius = '5px';
                label.style.whiteSpace = 'nowrap';
                label.style.transition = 'all 0.2s ease';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = opt.value;
                checkbox.checked = videoTags.includes(opt.value);
                checkbox.style.cursor = 'pointer';
                checkbox.style.width = '14px';
                checkbox.style.height = '14px';
                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(opt.value));
                label.addEventListener('mouseenter', () => {
                    label.style.background = 'rgba(59,130,246,0.4)';
                    label.style.borderColor = 'rgba(59,130,246,0.6)';
                });
                label.addEventListener('mouseleave', () => {
                    label.style.background = 'rgba(59,130,246,0.25)';
                    label.style.borderColor = 'rgba(59,130,246,0.4)';
                });
                container.appendChild(label);
            });


            // --- Creators MULTISELECT ---
            // --- Creators MULTISELECT ---
            function renderCreatorBadgesAndSelect(allCreators, video, index) {
                const creatorZone = document.getElementById('creatorBadgesContainer');
                creatorZone.innerHTML = '';
                // Utilise la sélection persistée si dispo, sinon la valeur initiale
                let selectedCreators = Array.isArray(video._selectedCreators)
                    ? video._selectedCreators
                    : (Array.isArray(video.creators) ? [...video.creators] : []);
                // Affichage des badges sélectionnés
                selectedCreators.forEach(name => {
                    const badge = document.createElement('span');
                    badge.className = 'creator-badge selected';
                    badge.textContent = name;
                    const remove = document.createElement('span');
                    remove.className = 'remove-badge';
                    remove.textContent = '×';
                    remove.onclick = () => {
                        const idx = selectedCreators.indexOf(name);
                        if (idx !== -1) selectedCreators.splice(idx, 1);
                        video._selectedCreators = selectedCreators;
                        renderCreatorBadgesAndSelect(allCreators, video, index);
                    };
                    badge.appendChild(remove);
                    creatorZone.appendChild(badge);
                });
                // Sélecteur d’ajout
                const addSelect = document.createElement('select');
                addSelect.style.marginLeft = '8px';
                addSelect.style.background = 'rgba(11,17,36,0.8)';
                addSelect.style.color = '#e0f2fe';
                addSelect.style.border = '1px solid rgba(59,130,246,0.3)';
                addSelect.style.borderRadius = '6px';
                addSelect.style.padding = '4px 8px';
                addSelect.style.fontSize = '12px';
                addSelect.style.cursor = 'pointer';
                addSelect.innerHTML = '<option value="">+ Ajouter un creator</option><option value="__create__">+ Créer un creator</option>';
                allCreators.forEach(c => {
                    const name = typeof c === 'string' ? c : c.name;
                    if (!selectedCreators.includes(name)) {
                        const opt = document.createElement('option');
                        opt.value = name;
                        opt.textContent = name;
                        addSelect.appendChild(opt);
                    }
                });
                addSelect.onchange = async () => {
                    if (addSelect.value === '__create__') {
                        const name = prompt('Nom du créateur :');
                        if (!name || !name.trim()) {
                            renderCreatorBadgesAndSelect(allCreators, video, index);
                            return;
                        }

                        const response = await fetch(`/api/videos/creators?name=${encodeURIComponent(name.trim())}`, {
                            method: 'POST'
                        });
                        if (!response.ok) {
                            setStatus(await response.text());
                            renderCreatorBadgesAndSelect(allCreators, video, index);
                            return;
                        }

                        const createdName = await response.text();
                        selectedCreators.push(createdName);
                        video._selectedCreators = selectedCreators;
                        renderCreatorBadgesAndSelect([...allCreators, createdName], video, index);
                        return;
                    }

                    if (addSelect.value && !selectedCreators.includes(addSelect.value)) {
                        selectedCreators.push(addSelect.value);
                        video._selectedCreators = selectedCreators;
                        renderCreatorBadgesAndSelect(allCreators, video, index);
                    }
                };
                creatorZone.appendChild(addSelect);
                // Stocke la sélection pour la sauvegarde
                video._selectedCreators = selectedCreators;
            }

            fetchJson('/api/videos/creators')
                .then(allCreators => {
                    renderCreatorBadgesAndSelect(allCreators, video, index);
                })
                .catch(() => {
                    document.getElementById('creatorBadgesContainer').innerHTML = '<span style="color:#f87171;">Erreur chargement créateurs</span>';
                });

            const level = (video.sourceIndex != null && video.sourceIndex >= 1 && video.sourceIndex <= 5) ? video.sourceIndex : 1;
            renderLevelStarsInModal(level);
            document.getElementById('levelValue').textContent = video.sourceIndex ?? 0;

            function renderLevelStarsInModal(selectedLevel) {
                const container = document.getElementById('levelStarsContainer');
                container.innerHTML = '';
                // Affichage inversé : 1 = 5 étoiles, 2 = 4, ... 5 = 1 étoile
                const stars = 6 - selectedLevel;
                for (let i = 1; i <= 5; i++) {
                    const star = document.createElement('span');
                    star.textContent = '★';
                    star.style.cursor = 'pointer';
                    star.style.fontSize = '22px';
                    star.style.color = i <= stars ? '#facc15' : '#334155';
                    // i=1 (gauche) => niveau 5, i=5 (droite) => niveau 1
                    const levelValue = 6 - i;
                    star.title = `${levelValue} étoile(s)`;
                    star.onclick = () => {
                        renderLevelStarsInModal(levelValue);
                        video._selectedLevel = levelValue;
                        document.getElementById('levelValue').textContent = levelValue;
                    };
                    container.appendChild(star);
                }
            }

            updatePlayerNavButtons();
        }

        // helper: find index of a video in currentVideos by id
        function findIndexByVideoId(id) {
            if (!allVideos || allVideos.length === 0) return -1;
            return allVideos.findIndex(v => v.id === id);
        }

        // Unified save: send tags (array) and sourceIndex together via PUT /api/videos/{id}
        async function saveModalCombined() {
            if (currentIndex < 0 || !playerVideos[currentIndex]) return;
            const video = playerVideos[currentIndex];
            const container = document.getElementById('tagCheckboxesContainer');
            const selectedTags = Array.from(container.querySelectorAll('input[type="checkbox"]'))
                .filter(cb => cb.checked)
                .map(cb => cb.value.trim())
                .filter(Boolean);
            // Correction ici : utilise video.sourceIndex comme fallback si _selectedLevel n'est pas défini
            const newLevel = typeof video._selectedLevel === 'number' ? video._selectedLevel : (video.sourceIndex ?? 1);
            const payload = {};
            if (selectedTags.length) payload.tags = selectedTags;
            if (!Number.isNaN(newLevel)) payload.sourceIndex = Math.max(0, Math.min(5, newLevel));
            // Ajout creators multi
            if (Array.isArray(video._selectedCreators) && video._selectedCreators.length > 0) {
                // Il faut convertir les noms en IDs côté backend, ou adapter ici si tu exposes les IDs
                payload.creatorNames = video._selectedCreators;
            }
            // If nothing to update, do nothing
            if (Object.keys(payload).length === 0) return;
            const res = await fetch('/api/videos/' + encodeURIComponent(video.id), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                console.error('Erreur update modal', res.status, await res.text());
                setStatus('Erreur sauvegarde');
                return;
            }
            const updated = await res.json();
            // update local state
            // try to find and replace in currentVideos
            const idx = findIndexByVideoId(updated.id);
            if (idx >= 0) allVideos[idx] = updated;
            await loadVideos();
            // re-open modal positionnée sur la même vidéo si encore présente
            const newIndex = findIndexByVideoId(updated.id);
            if (newIndex >= 0) {
                pageSize = getSelectedPageSize();
                currentPage = Math.floor(newIndex / pageSize) + 1;
                renderVideos(allVideos, true);
                const pageIndex = currentVideos.findIndex(v => v.id === updated.id);
                if (pageIndex >= 0) openPlayerByIndex(pageIndex);
            }
            setStatus('Modification enregistrée');
        }

let currentLevelFilter = null;
    function renderLevelFilterStars(selectedLevel) {
        const container = document.getElementById('levelFilterStars');
        if (!container) return;
        container.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const levelValue = 6 - i;
            const star = document.createElement('span');
            star.textContent = '★';
            star.style.cursor = 'pointer';
            star.style.fontSize = '22px';
            // Inverse logic: color the first (6 - selectedLevel) stars from the left
            star.style.color = (selectedLevel && i <= (6 - selectedLevel)) ? '#facc15' : '#334155';
            star.title = levelValue + ' étoile(s)';
            star.onclick = function() { setLevelFilter(levelValue); };
            container.appendChild(star);
        }
    }
    function setLevelFilter(level) {
        currentLevelFilter = level;
        document.getElementById('sourceIndexSelect').value = level ? String(level) : '';
        renderLevelFilterStars(level);
        if (typeof onFilterChange === 'function') onFilterChange();
    }
    window.addEventListener('DOMContentLoaded', function() {
        renderLevelFilterStars(null);
    });

function openAddVideoModal() {
    const modal = document.getElementById('addVideoModal');
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    // Remplit la date de création automatiquement
    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    const formatted = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    document.getElementById('createdAtInput').value = formatted;
}
function closeAddVideoModal() {
    document.getElementById('addVideoModal').style.display = 'none';
    document.getElementById('addVideoForm').reset();
    document.getElementById('addVideoStatus').textContent = '';
}
document.getElementById('addVideoForm').onsubmit = async function(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    document.getElementById('addVideoStatus').textContent = 'Ajout en cours...';
    try {
        const res = await fetch('/api/videos/upload', {
            method: 'POST',
            body: formData
        });
        if (res.ok) {
            document.getElementById('addVideoStatus').textContent = 'Vidéo ajoutée !';
            setTimeout(() => {
                closeAddVideoModal();
                loadVideos();
            }, 900);
        } else {
            const txt = await res.text();
            document.getElementById('addVideoStatus').textContent = 'Erreur: ' + txt;
        }
    } catch (err) {
        document.getElementById('addVideoStatus').textContent = 'Erreur: ' + err;
    }
};
