#!/usr/bin/env python
"""
Ar44 - script d'ingestion de nouvelles videos.

Usage : depose les nouveaux fichiers video (.mp4, .mkv, .avi, .mov, .webm,
.m4v) dans le dossier "new_videos" (a cote de ce script), puis lance :

    python ingest_videos.py

Pour chaque video trouvee, le script :
  1. mesure sa duree (ffprobe)
  2. genere sa miniature principale + son storyboard de survol (ffmpeg)
  3. brouille (meme algorithme que l'appli Java) la video et les 2 images,
     et les place dans videos/ et thumbnails/ sous leur nom interne (.arv/.ari)
  4. attribue un titre ZAr_xxx (pas de createur a l'ingestion) et l'enregistre
     obfusque en base (meme algorithme que TitleObfuscationConverter.java),
     jamais en clair - coherent avec les vidéos deja en base
  5. enregistre la ligne correspondante dans la base Postgres
  6. supprime le fichier source en clair du dossier new_videos

Pre-requis : ffmpeg + ffprobe dans le PATH, module psycopg2
(pip install psycopg2-binary si besoin).

L'appli peut tourner ou etre arretee pendant l'execution : ce script parle
directement a Postgres, pas a l'API HTTP.
"""

import base64
import os
import re
import shutil
import subprocess
import sys
import uuid
from pathlib import Path

import psycopg2

# ---- Configuration (mêmes valeurs par défaut que application.properties) ----
DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_PORT = os.environ.get("DB_PORT", "5432")
DB_NAME = os.environ.get("DB_NAME", "db_video")
DB_USER = os.environ.get("DB_USER", "postgres")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "123456")

BASE_DIR = Path(__file__).resolve().parent
DROP_DIR = BASE_DIR / "new_videos"
VIDEOS_DIR = BASE_DIR / "videos"
THUMBS_DIR = BASE_DIR / "thumbnails"

# Doit correspondre EXACTEMENT à FileObfuscationService.java. Ne pas changer
# sans ré-appliquer la même clé côté Java (sinon les fichiers déjà migrés
# deviennent illisibles).
OBFUSCATION_KEY = "Ar44-local-media-key-2026".encode("utf-8")

# Doit correspondre EXACTEMENT à TitleObfuscationConverter.java (même clé,
# même préfixe) : le titre n'est jamais stocké en clair en base, y compris
# pour les vidéos ingérées par ce script.
TITLE_OBFUSCATION_KEY = "Ar44-title-key-2026".encode("utf-8")
TITLE_OBFUSCATION_PREFIX = "OBF1:"

# Les vidéos ingérées par ce script n'ont pas encore de créateur assigné
# (ça se fait ensuite dans l'appli) : leur titre suit donc la convention
# ZAr_xxx utilisée pour toutes les vidéos sans créateur (voir la migration
# de renommage des titres existants).
ZAR_TITLE_PREFIX = "ZAr"
ZAR_TITLE_RE = re.compile(rf"^{re.escape(ZAR_TITLE_PREFIX)}_(\d+)$")

VIDEO_EXTENSION = "arv"
IMAGE_EXTENSION = "ari"
PLAIN_VIDEO_EXTENSIONS = {"mp4", "mkv", "avi", "mov", "webm", "m4v"}

STORYBOARD_COLS = 5
STORYBOARD_ROWS = 4
STORYBOARD_FRAME_COUNT = STORYBOARD_COLS * STORYBOARD_ROWS
STORYBOARD_TILE_WIDTH = 160
STORYBOARD_TILE_HEIGHT = 90

THUMB_WIDTH = 320
NUMBERED_VIDEO_RE = re.compile(r"^vid_(\d+)$", re.IGNORECASE)


def xor_transform(data: bytearray, absolute_offset: int) -> None:
    """XOR en place — miroir de FileObfuscationService.transform (Java)."""
    key = OBFUSCATION_KEY
    key_len = len(key)
    for i in range(len(data)):
        data[i] ^= key[(absolute_offset + i) % key_len]


def obfuscate_file(src: Path, dest: Path, chunk_size: int = 1024 * 1024) -> None:
    pos = 0
    with open(src, "rb") as fin, open(dest, "wb") as fout:
        while True:
            chunk = bytearray(fin.read(chunk_size))
            if not chunk:
                break
            xor_transform(chunk, pos)
            fout.write(chunk)
            pos += len(chunk)


def obfuscate_bytes(data: bytes) -> bytes:
    buf = bytearray(data)
    xor_transform(buf, 0)
    return bytes(buf)


def obfuscate_title(plain: str) -> str:
    """Miroir de TitleObfuscationConverter.convertToDatabaseColumn (Java)."""
    key = TITLE_OBFUSCATION_KEY
    data = plain.encode("utf-8")
    scrambled = bytes(b ^ key[i % len(key)] for i, b in enumerate(data))
    return TITLE_OBFUSCATION_PREFIX + base64.b64encode(scrambled).decode("ascii")


def deobfuscate_title(value: str) -> str:
    """Miroir de TitleObfuscationConverter.convertToEntityAttribute (Java)."""
    if not value or not value.startswith(TITLE_OBFUSCATION_PREFIX):
        return value or ""
    key = TITLE_OBFUSCATION_KEY
    raw = base64.b64decode(value[len(TITLE_OBFUSCATION_PREFIX):])
    return bytes(b ^ key[i % len(key)] for i, b in enumerate(raw)).decode("utf-8")


def next_zar_number(conn) -> int:
    """Prochain numéro de séquence ZAr_xxx, en continuant depuis le plus grand
    numéro déjà utilisé en base (titres décodés à la volée)."""
    max_num = 0
    with conn.cursor() as cur:
        cur.execute("SELECT title FROM video WHERE title IS NOT NULL")
        for (raw_title,) in cur.fetchall():
            m = ZAR_TITLE_RE.match(deobfuscate_title(raw_title))
            if m:
                max_num = max(max_num, int(m.group(1)))
    return max_num + 1


def base_name_of(filename: str) -> str:
    dot = filename.rfind(".")
    return filename[:dot] if dot > 0 else filename


def extension_of(filename: str) -> str:
    dot = filename.rfind(".")
    return filename[dot + 1:].lower() if dot >= 0 else ""


def thumb_name_for(video_filename: str) -> str:
    """Miroir de ThumbnailStorageService.toThumbnailName (Java)."""
    base = base_name_of(video_filename)
    m = NUMBERED_VIDEO_RE.match(base)
    if m:
        return f"thumb_{m.group(1)}.{IMAGE_EXTENSION}"
    return f"{base}.{IMAGE_EXTENSION}"


def probe_duration_ms(path: Path):
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
            capture_output=True, text=True, timeout=30,
        )
        value = result.stdout.strip()
        if not value:
            return None
        return round(float(value) * 1000)
    except Exception as e:
        print(f"   [WARN] ffprobe: {e}")
        return None


def generate_thumbnail(video_path: Path, out_path: Path, duration_ms) -> bool:
    seek = "3"
    if duration_ms and duration_ms > 10 * 60 * 1000:
        seek = "35"
    cmd = [
        "ffmpeg", "-y", "-ss", seek, "-i", str(video_path),
        "-frames:v", "1", "-vf", f"scale={THUMB_WIDTH}:-1",
        "-q:v", "4", str(out_path),
    ]
    result = subprocess.run(cmd, capture_output=True, timeout=60)
    return result.returncode == 0 and out_path.exists() and out_path.stat().st_size > 0


def generate_storyboard(video_path: Path, out_path: Path, duration_ms: int) -> bool:
    duration_seconds = duration_ms / 1000.0
    fps = STORYBOARD_FRAME_COUNT / duration_seconds
    vf = (f"fps={fps},scale={STORYBOARD_TILE_WIDTH}:{STORYBOARD_TILE_HEIGHT},"
          f"tile={STORYBOARD_COLS}x{STORYBOARD_ROWS}")
    cmd = [
        "ffmpeg", "-y", "-i", str(video_path),
        "-vf", vf, "-frames:v", "1", "-update", "1", "-q:v", "4", str(out_path),
    ]
    result = subprocess.run(cmd, capture_output=True, timeout=120)
    return result.returncode == 0 and out_path.exists() and out_path.stat().st_size > 0


def fetch_existing_filenames(conn) -> set:
    with conn.cursor() as cur:
        cur.execute("SELECT file_name FROM video WHERE file_name IS NOT NULL")
        return {row[0] for row in cur.fetchall()}


def insert_video_row(conn, title: str, file_name: str, duration_ms) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO video (title, file_name, duration_ms, created_at, favorite)
            VALUES (%s, %s, %s, now(), false)
            RETURNING id
            """,
            (obfuscate_title(title), file_name, duration_ms),
        )
        video_id = cur.fetchone()[0]
    conn.commit()
    return video_id


def process_video(path: Path, conn, existing_filenames: set, zar_counter: list) -> bool:
    filename = path.name
    print(f"-> {filename}")

    # Nom interne totalement indépendant du nom du fichier source. Deux vidéos
    # différentes déposées sous le même nom (téléchargements génériques du
    # type "video.mp4", très courant) ne doivent jamais se retrouver avec le
    # même fichier .arv/.ari sur disque : ça écraserait silencieusement une
    # vidéo déjà en bibliothèque. Le nom interne est donc un UUID aléatoire,
    # jamais dérivé du nom d'origine.
    internal_stem = uuid.uuid4().hex
    while f"{internal_stem}.{VIDEO_EXTENSION}" in existing_filenames:
        internal_stem = uuid.uuid4().hex
    obfuscated_name = f"{internal_stem}.{VIDEO_EXTENSION}"

    # Pas de créateur à l'ingestion (assigné plus tard dans l'appli) : le
    # titre suit donc la convention ZAr_xxx, comme les vidéos sans créateur
    # déjà en base.
    title = f"{ZAR_TITLE_PREFIX}_{zar_counter[0]:03d}"

    duration_ms = probe_duration_ms(path)
    print(f"   durée: {duration_ms} ms" if duration_ms else "   durée: inconnue (ffprobe a échoué)")

    tmp_thumb = path.parent / f".tmp_thumb_{internal_stem}.jpg"
    if not generate_thumbnail(path, tmp_thumb, duration_ms):
        print("   [ERREUR] génération de la miniature échouée — vidéo ignorée")
        tmp_thumb.unlink(missing_ok=True)
        return False

    tmp_storyboard = path.parent / f".tmp_storyboard_{internal_stem}.jpg"
    storyboard_ok = bool(duration_ms) and generate_storyboard(path, tmp_storyboard, duration_ms)
    if duration_ms and not storyboard_ok:
        print("   [WARN] génération du storyboard échouée (on continue sans)")

    video_id = insert_video_row(conn, title, obfuscated_name, duration_ms)
    existing_filenames.add(obfuscated_name)
    zar_counter[0] += 1
    print(f"   id={video_id} enregistré en base, titre={title}")

    VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
    THUMBS_DIR.mkdir(parents=True, exist_ok=True)

    obfuscate_file(path, VIDEOS_DIR / obfuscated_name)
    path.unlink()

    thumb_bytes = obfuscate_bytes(tmp_thumb.read_bytes())
    (THUMBS_DIR / thumb_name_for(obfuscated_name)).write_bytes(thumb_bytes)
    tmp_thumb.unlink(missing_ok=True)

    if storyboard_ok:
        sb_bytes = obfuscate_bytes(tmp_storyboard.read_bytes())
        (THUMBS_DIR / f"storyboard_{video_id}.{IMAGE_EXTENSION}").write_bytes(sb_bytes)
    tmp_storyboard.unlink(missing_ok=True)

    print(f"   OK -> videos/{obfuscated_name}")
    return True


def main():
    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        print("ERREUR : ffmpeg/ffprobe introuvables dans le PATH.")
        sys.exit(1)

    DROP_DIR.mkdir(parents=True, exist_ok=True)
    candidates = sorted(
        p for p in DROP_DIR.iterdir()
        if p.is_file() and extension_of(p.name) in PLAIN_VIDEO_EXTENSIONS
    )

    if not candidates:
        print(f"Aucune vidéo trouvée dans {DROP_DIR}")
        return

    print(f"{len(candidates)} vidéo(s) trouvée(s) dans {DROP_DIR}\n")

    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME, user=DB_USER, password=DB_PASSWORD,
    )
    try:
        existing_filenames = fetch_existing_filenames(conn)
        zar_counter = [next_zar_number(conn)]
        ok, failed = 0, 0
        for path in candidates:
            try:
                if process_video(path, conn, existing_filenames, zar_counter):
                    ok += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"   [ERREUR] {e}")
                failed += 1
    finally:
        conn.close()

    print(f"\nTerminé : {ok} importée(s), {failed} ignorée(s)/échouée(s).")


if __name__ == "__main__":
    main()
