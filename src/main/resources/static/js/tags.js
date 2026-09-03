let allTags = [];
let allVideos = [];
let playlistVideos = [];
let activeTag = null;
let currentIndex = -1;

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
    }
    return response.json();
}

function formatDuration(durationMs) {
    if (!durationMs) {
        return '';
    }

    const totalSeconds = Math.floor(durationMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return hours > 0
        ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function renderLevelStars(level) {
    const normalizedLevel = typeof level === 'number' && level >= 1 && level <= 5 ? level : 1;
    const filledStars = 6 - normalizedLevel;
    let html = '';

    for (let index = 1; index <= 5; index++) {
        html += `<span style="color:${index <= filledStars ? '#facc15' : '#334155'};font-size:13px;">★</span>`;
    }

    return html;
}

function videosForTag(tag) {
    return allVideos.filter(video => Array.isArray(video.tags) && video.tags.includes(tag));
}

function tagVideoCount(tag) {
    return videosForTag(tag).length;
}

function renderTagList() {
    const list = document.getElementById('tagList');
    list.innerHTML = '';

    if (!allTags.length) {
        list.innerHTML = '<p class="muted-note">Aucun tag créé.</p>';
        return;
    }

    allTags.forEach(tag => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `tag-list-item${tag === activeTag ? ' active' : ''}`;
        button.onclick = () => selectTag(tag);

        const name = document.createElement('span');
        name.textContent = tag;
        const count = document.createElement('span');
        count.className = 'tag-count';
        count.textContent = `${tagVideoCount(tag)} vidéo(s)`;

        button.append(name, count);
        list.appendChild(button);
    });
}

function renderPlaylist() {
    const title = document.getElementById('tagTitle');
    const description = document.getElementById('tagDescription');
    const grid = document.getElementById('playlistGrid');
    const management = document.getElementById('tagManagement');
    grid.innerHTML = '';
    management.hidden = !activeTag;

    if (!activeTag) {
        title.textContent = 'Tags';
        description.textContent = 'Créez ou sélectionnez un tag pour afficher sa playlist.';
        grid.innerHTML = '<p class="tag-empty">Aucun tag disponible. Vous pouvez en ajouter depuis les réglages.</p>';
        return;
    }

    title.textContent = activeTag;
    description.textContent = `${playlistVideos.length} vidéo(s) dans cette playlist`;

    if (!playlistVideos.length) {
        grid.innerHTML = '<p class="tag-empty">Ce tag ne contient encore aucune vidéo.</p>';
        return;
    }

    playlistVideos.forEach((video, index) => {
        const card = document.createElement('article');
        card.className = 'video-card playlist-card';
        card.tabIndex = 0;
        card.onclick = () => openVideo(index);
        card.onkeydown = event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openVideo(index);
            }
        };

        const media = document.createElement('div');
        media.style.position = 'relative';
        const thumbnail = document.createElement('img');
        thumbnail.className = 'video-thumb';
        thumbnail.src = `/api/videos/thumbnail?id=${video.id}`;
        thumbnail.alt = '';
        thumbnail.loading = 'lazy';
        thumbnail.onerror = () => {
            thumbnail.style.opacity = '0.3';
        };

        const duration = document.createElement('span');
        duration.className = 'video-duration';
        duration.textContent = formatDuration(video.durationMs);
        media.append(thumbnail, duration);

        const info = document.createElement('div');
        info.className = 'video-info';
        const videoTitle = document.createElement('div');
        videoTitle.className = 'video-title';
        videoTitle.textContent = video.title || video.fileName || 'Vidéo sans titre';
        const metadata = document.createElement('div');
        metadata.className = 'video-meta';
        const creators = Array.isArray(video.creators) && video.creators.length
            ? video.creators.join(', ')
            : 'Unknown';
        metadata.textContent = creators;
        const stars = document.createElement('span');
        stars.className = 'level-stars';
        stars.innerHTML = renderLevelStars(video.sourceIndex);
        metadata.append(document.createTextNode(' '), stars);
        info.append(videoTitle, metadata);

        card.append(media, info);
        grid.appendChild(card);
    });
}

function selectTag(tag) {
    activeTag = tag;
    playlistVideos = videosForTag(tag);
    renderTagList();
    renderPlaylist();
}

function renderUpNext() {
    const list = document.getElementById('upNextList');
    list.innerHTML = '';

    const nextVideos = playlistVideos.slice(currentIndex + 1, currentIndex + 51);
    if (!nextVideos.length) {
        list.innerHTML = '<p class="up-next-empty">Fin de cette playlist.</p>';
        return;
    }

    nextVideos.forEach((video, offset) => {
        const index = currentIndex + offset + 1;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'up-next-item';
        button.onclick = () => openVideo(index);

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
        const creators = document.createElement('div');
        creators.className = 'up-next-meta';
        creators.textContent = Array.isArray(video.creators) && video.creators.length
            ? video.creators.join(', ')
            : 'Unknown';
        const duration = document.createElement('div');
        duration.className = 'up-next-meta';
        duration.textContent = formatDuration(video.durationMs) || 'Durée inconnue';
        details.append(title, creators, duration);
        button.append(thumbnail, details);
        list.appendChild(button);
    });
}

function openVideo(index) {
    if (index < 0 || index >= playlistVideos.length) {
        return;
    }

    currentIndex = index;
    const video = playlistVideos[index];
    const player = document.getElementById('mainPlayer');
    player.pause();
    player.src = video.url || '';
    player.play().catch(() => {});
    player.focus();

    document.getElementById('playerTitle').textContent = video.title || video.fileName || 'Lecture vidéo';
    const creators = Array.isArray(video.creators) && video.creators.length
        ? video.creators.join(', ')
        : 'Unknown';
    const tags = Array.isArray(video.tags) && video.tags.length ? video.tags.join(', ') : 'Aucun';
    document.getElementById('playerSubtitle').textContent = `Créateur : ${creators} • Tags : ${tags} • Niveau : ${video.sourceIndex ?? 'N/A'}`;
    document.getElementById('playerModal').style.display = 'flex';
    renderUpNext();
}

function closePlayer() {
    const player = document.getElementById('mainPlayer');
    player.pause();
    player.removeAttribute('src');
    player.load();
    document.getElementById('playerModal').style.display = 'none';
    currentIndex = -1;
}

async function addTag() {
    const input = document.getElementById('newTagName');
    const name = input.value.trim();
    if (!name) {
        input.focus();
        return;
    }

    const response = await fetch(`/api/videos/tags?name=${encodeURIComponent(name)}`, {
        method: 'POST'
    });
    if (!response.ok) {
        document.getElementById('tagDescription').textContent = await response.text();
        return;
    }

    input.value = '';
    activeTag = name;
    await loadTagsPage();
}

async function renameActiveTag() {
    if (!activeTag) {
        return;
    }

    const newName = prompt('Nouveau nom du tag :', activeTag);
    if (!newName || !newName.trim() || newName.trim() === activeTag) {
        return;
    }

    const response = await fetch(
        `/api/videos/tags?oldName=${encodeURIComponent(activeTag)}&newName=${encodeURIComponent(newName.trim())}`,
        { method: 'PUT' }
    );
    if (!response.ok) {
        document.getElementById('tagDescription').textContent = await response.text();
        return;
    }

    activeTag = newName.trim();
    await loadTagsPage();
}

async function deleteActiveTag() {
    if (!activeTag || !confirm(`Supprimer le tag "${activeTag}" ? Les vidéos seront conservées.`)) {
        return;
    }

    const response = await fetch(`/api/videos/tags?name=${encodeURIComponent(activeTag)}`, {
        method: 'DELETE'
    });
    if (!response.ok) {
        document.getElementById('tagDescription').textContent = await response.text();
        return;
    }

    activeTag = null;
    await loadTagsPage();
}

async function loadTagsPage() {
    const grid = document.getElementById('playlistGrid');
    grid.innerHTML = '<p class="tag-empty">Chargement des tags…</p>';

    try {
        const [tags, videos] = await Promise.all([
            fetchJson('/api/videos/tags'),
            fetchJson('/api/videos')
        ]);
        allTags = tags;
        allVideos = videos;

        if (!activeTag || !allTags.includes(activeTag)) {
            activeTag = allTags[0] || null;
        }
        playlistVideos = activeTag ? videosForTag(activeTag) : [];
        renderTagList();
        renderPlaylist();
    } catch (error) {
        console.error(error);
        grid.innerHTML = '<p class="tag-empty">Impossible de charger les tags.</p>';
    }
}

function flashCenterPlayButton(isPlaying) {
    const button = document.getElementById('centerPlayButton');
    if (!button) return;
    button.textContent = isPlaying ? '⏸' : '▶';
    button.classList.remove('pulse');
    void button.offsetWidth; // force reflow to restart the animation
    button.classList.add('pulse');
}

document.addEventListener('DOMContentLoaded', () => {
    const player = document.getElementById('mainPlayer');
    player.addEventListener('ended', () => {
        if (currentIndex < playlistVideos.length - 1) {
            openVideo(currentIndex + 1);
        }
    });

    player.addEventListener('play', () => flashCenterPlayButton(true));
    player.addEventListener('pause', () => flashCenterPlayButton(false));

    document.getElementById('playerModal').addEventListener('click', event => {
        if (event.target === event.currentTarget) {
            closePlayer();
        }
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            closePlayer();
        }
    });

    loadTagsPage();
});
