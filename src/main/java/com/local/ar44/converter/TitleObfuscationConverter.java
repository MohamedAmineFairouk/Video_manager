package com.local.ar44.converter;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * Same idea as FileObfuscationService but for the video title column: XOR
 * with a fixed key, then Base64-encode so the result is storable as text.
 * Not cryptographically strong — the goal is just that a raw look at the
 * "video" table doesn't show plain titles. Transparently reversed by the
 * app on every read via this converter.
 *
 * Rows without the OBF1: prefix are legacy, not-yet-migrated plain titles
 * and are returned as-is; see TitleObfuscationMigrationRunner.
 */
@Converter
public class TitleObfuscationConverter implements AttributeConverter<String, String> {
    private static final String PREFIX = "OBF1:";
    private static final byte[] KEY = "Ar44-title-key-2026".getBytes(StandardCharsets.UTF_8);

    @Override
    public String convertToDatabaseColumn(String attribute) {
        if (attribute == null) return null;
        byte[] scrambled = xor(attribute.getBytes(StandardCharsets.UTF_8));
        return PREFIX + Base64.getEncoder().encodeToString(scrambled);
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        if (!dbData.startsWith(PREFIX)) return dbData;
        byte[] decoded = Base64.getDecoder().decode(dbData.substring(PREFIX.length()));
        return new String(xor(decoded), StandardCharsets.UTF_8);
    }

    /** XOR is its own inverse: the same call scrambles plain bytes or restores scrambled ones. */
    private static byte[] xor(byte[] data) {
        byte[] out = new byte[data.length];
        for (int i = 0; i < data.length; i++) out[i] = (byte) (data[i] ^ KEY[i % KEY.length]);
        return out;
    }
}
