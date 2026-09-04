package com.local.ar44.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

/**
 * Lightweight, symmetric byte-scrambling for media files stored on disk.
 * Not cryptographically strong — the goal is to stop the files from being
 * directly openable by VLC/Explorer/Photo Viewer (they'll see garbage
 * bytes, not a valid MP4/JPEG header), not to defend against someone with
 * access to this application's own code/config. XOR with a repeating key
 * is trivially range-addressable, which is what makes video seek (HTTP
 * Range requests) practical to support while streaming.
 */
@Service
public class FileObfuscationService {

    public static final String VIDEO_EXTENSION = "arv";
    public static final String IMAGE_EXTENSION = "ari";

    private final byte[] key;

    public FileObfuscationService(@Value("${app.obfuscation.key:Ar44-local-media-key-2026}") String keyString) {
        this.key = keyString.getBytes(StandardCharsets.UTF_8);
    }

    /** XOR is its own inverse: the same call obfuscates plain bytes or restores obfuscated ones. */
    public void transform(byte[] buffer, int offset, int length, long absolutePosition) {
        for (int i = 0; i < length; i++) {
            int keyIndex = (int) ((absolutePosition + i) % key.length);
            buffer[offset + i] ^= key[keyIndex];
        }
    }

    public byte[] transform(byte[] data) {
        byte[] copy = data.clone();
        transform(copy, 0, copy.length, 0);
        return copy;
    }
}
