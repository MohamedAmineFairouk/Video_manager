package com.local.ar44.service;

import com.local.ar44.dto.AppAccessLog;
import com.local.ar44.dto.Video;
import com.local.ar44.dto.VideoWatchLog;
import com.local.ar44.repo.AppAccessLogRepository;
import com.local.ar44.repo.VideoRepository;
import com.local.ar44.repo.VideoWatchLogRepository;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class StatsService {
    private final AppAccessLogRepository appAccessLogRepository;
    private final VideoWatchLogRepository videoWatchLogRepository;
    private final VideoRepository videoRepository;

    public StatsService(AppAccessLogRepository appAccessLogRepository,
                        VideoWatchLogRepository videoWatchLogRepository,
                        VideoRepository videoRepository) {
        this.appAccessLogRepository = appAccessLogRepository;
        this.videoWatchLogRepository = videoWatchLogRepository;
        this.videoRepository = videoRepository;
    }

    public void logAccess(String page, String username) {
        AppAccessLog log = new AppAccessLog();
        log.setPage(page);
        log.setUsername(username);
        log.setAccessedAt(LocalDateTime.now());
        appAccessLogRepository.save(log);
    }

    public void logWatchSession(Long videoId, String page, String username, Integer watchedSeconds) {
        VideoWatchLog log = new VideoWatchLog();
        log.setVideoId(videoId);
        log.setPage(page);
        log.setUsername(username);
        log.setWatchedSeconds(Math.max(0, watchedSeconds == null ? 0 : watchedSeconds));
        log.setWatchedAt(LocalDateTime.now());
        videoWatchLogRepository.save(log);
    }

    public void resetCounters() {
        appAccessLogRepository.deleteAll();
        videoWatchLogRepository.deleteAll();
    }

    private static Map<String, Object> point(String label, long value) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("label", label);
        row.put("value", value);
        return row;
    }

    public Map<String, Object> getOverview() {
        List<AppAccessLog> accesses = appAccessLogRepository.findAll();
        List<VideoWatchLog> watches = videoWatchLogRepository.findAll();

        LocalDate today = LocalDate.now();
        LocalDate thisWeekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        YearMonth thisMonth = YearMonth.now();

        DateTimeFormatter dayFmt = DateTimeFormatter.ofPattern("dd/MM");
        DateTimeFormatter monthFmt = DateTimeFormatter.ofPattern("MM/yy");

        long totalAppAccesses = accesses.size();
        long todayAppAccesses = accesses.stream()
                .filter(a -> a.getAccessedAt() != null && a.getAccessedAt().toLocalDate().equals(today))
                .count();

        long totalVideoViews = watches.size();
        long todayVideoViews = watches.stream()
                .filter(w -> w.getWatchedAt() != null && w.getWatchedAt().toLocalDate().equals(today))
                .count();

        long totalWatchSeconds = watches.stream()
                .map(VideoWatchLog::getWatchedSeconds)
                .filter(Objects::nonNull)
                .mapToLong(Integer::longValue)
                .sum();

        double averageWatchSeconds = totalVideoViews > 0 ? (double) totalWatchSeconds / totalVideoViews : 0d;

        // Connexions par jour (30 derniers jours)
        Map<LocalDate, Long> accessByDay = accesses.stream()
                .filter(a -> a.getAccessedAt() != null)
                .collect(Collectors.groupingBy(a -> a.getAccessedAt().toLocalDate(), Collectors.counting()));
        List<Map<String, Object>> connectionsByDay = new ArrayList<>();
        for (int i = 29; i >= 0; i--) {
            LocalDate d = today.minusDays(i);
            connectionsByDay.add(point(d.format(dayFmt), accessByDay.getOrDefault(d, 0L)));
        }

        // Connexions par semaine (12 dernières semaines, début lundi)
        Map<LocalDate, Long> accessByWeek = accesses.stream()
                .filter(a -> a.getAccessedAt() != null)
                .map(a -> a.getAccessedAt().toLocalDate().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)))
                .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
        List<Map<String, Object>> connectionsByWeek = new ArrayList<>();
        for (int i = 11; i >= 0; i--) {
            LocalDate wStart = thisWeekStart.minusWeeks(i);
            connectionsByWeek.add(point(wStart.format(dayFmt), accessByWeek.getOrDefault(wStart, 0L)));
        }

        // Connexions par mois (12 derniers mois)
        Map<YearMonth, Long> accessByMonth = accesses.stream()
                .filter(a -> a.getAccessedAt() != null)
                .map(a -> YearMonth.from(a.getAccessedAt()))
                .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
        List<Map<String, Object>> connectionsByMonth = new ArrayList<>();
        for (int i = 11; i >= 0; i--) {
            YearMonth m = thisMonth.minusMonths(i);
            connectionsByMonth.add(point(m.format(monthFmt), accessByMonth.getOrDefault(m, 0L)));
        }

        // Répartition des connexions par heure (historique complet) — "quand je me connecte"
        Map<Integer, Long> accessByHour = accesses.stream()
                .filter(a -> a.getAccessedAt() != null)
                .collect(Collectors.groupingBy(a -> a.getAccessedAt().getHour(), Collectors.counting()));
        List<Map<String, Object>> connectionsByHour = new ArrayList<>();
        for (int h = 0; h < 24; h++) {
            connectionsByHour.add(point(String.format("%02dh", h), accessByHour.getOrDefault(h, 0L)));
        }

        // Minutes regardées par jour (30 derniers jours)
        Map<LocalDate, Long> secondsByDay = watches.stream()
                .filter(w -> w.getWatchedAt() != null)
                .collect(Collectors.groupingBy(w -> w.getWatchedAt().toLocalDate(),
                        Collectors.summingLong(w -> w.getWatchedSeconds() == null ? 0 : w.getWatchedSeconds())));
        List<Map<String, Object>> watchMinutesByDay = new ArrayList<>();
        for (int i = 29; i >= 0; i--) {
            LocalDate d = today.minusDays(i);
            watchMinutesByDay.add(point(d.format(dayFmt), Math.round(secondsByDay.getOrDefault(d, 0L) / 60.0)));
        }

        // Minutes regardées par semaine (12 dernières semaines)
        Map<LocalDate, Long> secondsByWeek = watches.stream()
                .filter(w -> w.getWatchedAt() != null)
                .collect(Collectors.groupingBy(
                        w -> w.getWatchedAt().toLocalDate().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)),
                        Collectors.summingLong(w -> w.getWatchedSeconds() == null ? 0 : w.getWatchedSeconds())));
        List<Map<String, Object>> watchMinutesByWeek = new ArrayList<>();
        for (int i = 11; i >= 0; i--) {
            LocalDate wStart = thisWeekStart.minusWeeks(i);
            watchMinutesByWeek.add(point(wStart.format(dayFmt), Math.round(secondsByWeek.getOrDefault(wStart, 0L) / 60.0)));
        }

        // Top vidéos par temps regardé (graphe, pas de tableau)
        Map<Long, List<VideoWatchLog>> groupedByVideo = watches.stream()
                .filter(w -> w.getVideoId() != null)
                .collect(Collectors.groupingBy(VideoWatchLog::getVideoId));
        List<Long> ids = new ArrayList<>(groupedByVideo.keySet());
        Map<Long, String> titlesById = videoRepository.findAllById(ids).stream()
                .collect(Collectors.toMap(Video::getId, v -> v.getTitle() == null ? "(Sans titre)" : v.getTitle()));
        List<Map<String, Object>> topVideosByWatchTime = groupedByVideo.entrySet().stream()
                .map(e -> {
                    long seconds = e.getValue().stream()
                            .map(VideoWatchLog::getWatchedSeconds)
                            .filter(Objects::nonNull)
                            .mapToLong(Integer::longValue)
                            .sum();
                    return point(titlesById.getOrDefault(e.getKey(), "Vidéo #" + e.getKey()), Math.round(seconds / 60.0));
                })
                .sorted((a, b) -> Long.compare((Long) b.get("value"), (Long) a.get("value")))
                .limit(8)
                .toList();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalAppAccesses", totalAppAccesses);
        out.put("todayAppAccesses", todayAppAccesses);
        out.put("totalVideoViews", totalVideoViews);
        out.put("todayVideoViews", todayVideoViews);
        out.put("totalWatchSeconds", totalWatchSeconds);
        out.put("averageWatchSeconds", averageWatchSeconds);

        out.put("connectionsByDay", connectionsByDay);
        out.put("connectionsByWeek", connectionsByWeek);
        out.put("connectionsByMonth", connectionsByMonth);
        out.put("connectionsByHour", connectionsByHour);
        out.put("watchMinutesByDay", watchMinutesByDay);
        out.put("watchMinutesByWeek", watchMinutesByWeek);
        out.put("topVideosByWatchTime", topVideosByWatchTime);

        return out;
    }
}
