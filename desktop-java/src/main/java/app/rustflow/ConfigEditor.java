package app.rustflow;

import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.HashSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Graphics-only edits: never accept commands from the UI as executable code. */
public final class ConfigEditor {
    private ConfigEditor() { }
    private static final Set<String> ALLOWED = Set.of("graphics.quality", "graphics.lodbias", "graphics.drawdistance", "graphics.shaderlod", "graphics.shadowdistance", "graphics.shadowmode", "graphics.shadowlights", "graphics.af", "graphics.parallax", "graphics.renderscale", "graphics.branding", "water.quality", "water.reflections", "grass.quality", "grass.displacement", "particle.quality", "effects.maxgibs", "decor.quality", "tree.quality", "tree.meshes", "terrain.quality", "mesh.quality");
    private static final Pattern LINE = Pattern.compile("^(\\uFEFF?[ \\t]*)([a-zA-Z0-9_.]+)([ \\t]+)(\"[^\"\\r\\n]*\"|[^\\s\\r\\n]+)(.*)$");

    public static Map<String, String> preset(String id) {
        boolean potato = "potato".equals(id), combat = "competitive".equals(id), balance = "balanced".equals(id);
        if (!potato && !combat && !balance && !"quality".equals(id)) throw new IllegalArgumentException("Unknown profile");
        String[] keys = {"graphics.drawdistance", "graphics.shaderlod", "graphics.shadowdistance", "graphics.shadowmode", "graphics.shadowlights", "water.quality", "water.reflections", "grass.quality", "grass.displacement", "particle.quality", "effects.maxgibs", "decor.quality", "tree.quality", "tree.meshes", "terrain.quality", "mesh.quality", "graphics.af", "graphics.parallax", "graphics.branding"};
        String[] values = potato ? new String[]{"1200","100","50","1","1","0","0","0","False","25","0","25","100","25","25","50","8","0","False"}
            : combat ? new String[]{"1500","200","50","1","1","0","0","0","True","25","0","25","100","25","25","50","8","0","False"}
            : balance ? new String[]{"1600","300","100","2","1","1","0","40","True","25","500","25","150","75","50","150","4","0","False"}
            : new String[]{"2200","400","300","2","2","2","1","75","True","75","1500","75","200","100","75","200","8","1","False"};
        Map<String, String> result = new LinkedHashMap<>();
        for (int i = 0; i < keys.length; i++) result.put(keys[i], values[i]);
        result.put("graphics.renderscale", "1");
        return result;
    }

    public static String merge(String original, Map<String, String> changes) {
        Map<String, String> updates = new LinkedHashMap<>();
        changes.forEach((key, value) -> { if (ALLOWED.contains(key) && value != null && value.matches("[a-zA-Z0-9_.+\\-]+")) updates.put(key, value); });
        Set<String> seen = new HashSet<>();
        String newline = original.contains("\r\n") ? "\r\n" : original.contains("\r") && !original.contains("\n") ? "\r" : "\n";
        StringBuilder out = new StringBuilder();
        int offset = 0;
        while (offset < original.length()) {
            int end = offset; while (end < original.length() && original.charAt(end) != '\r' && original.charAt(end) != '\n') end++;
            int next = end; if (next < original.length() && original.charAt(next) == '\r') next++;
            if (next < original.length() && original.charAt(next) == '\n') next++;
            String line = original.substring(offset, end);
            Matcher match = LINE.matcher(line);
            if (match.matches() && updates.containsKey(match.group(2).toLowerCase(Locale.ROOT))) {
                String key = match.group(2).toLowerCase(Locale.ROOT); seen.add(key);
                out.append(match.group(1)).append(match.group(2)).append(match.group(3)).append('"').append(updates.get(key)).append('"').append(match.group(5));
            } else out.append(line);
            out.append(original, end, next); offset = next;
        }
        updates.forEach((key, value) -> {
            if (!seen.contains(key)) {
                if (out.length() > 0 && out.charAt(out.length() - 1) != '\n' && out.charAt(out.length() - 1) != '\r') out.append(newline);
                out.append(key).append(" \"").append(value).append('"').append(newline);
            }
        });
        return out.toString();
    }

    public static void apply(Path file, Map<String, String> settings) throws IOException {
        if (!"client.cfg".equalsIgnoreCase(file.getFileName().toString()) || !Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS) || Files.isSymbolicLink(file)) throw new IOException("Выберите существующий обычный client.cfg.");
        if (Files.size(file) > 1024 * 1024) throw new IOException("Файл больше 1 МБ.");
        if (ProcessHandle.allProcesses().anyMatch(p -> p.info().command().map(c -> c.toLowerCase(Locale.ROOT).endsWith("rustclient.exe")).orElse(false))) throw new IOException("Закройте Rust перед изменением файла.");
        byte[] bytes = Files.readAllBytes(file);
        String text = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();
        if (text.indexOf('\0') >= 0) throw new IOException("Недопустимый формат файла.");
        Path backup = file.resolveSibling("client.cfg.bak");
        if (Files.isSymbolicLink(backup)) throw new IOException("client.cfg.bak является ссылкой.");
        Path backupTmp = Files.createTempFile(file.getParent(), ".shift-backup-", ".tmp");
        try {
            Files.write(backupTmp, bytes);
            Files.move(backupTmp, backup, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } finally { Files.deleteIfExists(backupTmp); }
        Path tmp = Files.createTempFile(file.getParent(), ".rustflow-", ".tmp");
        try {
            Files.writeString(tmp, merge(text, settings), StandardCharsets.UTF_8);
            Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } finally { Files.deleteIfExists(tmp); }
    }
    public static void restore(Path file) throws IOException {
        if (!"client.cfg".equalsIgnoreCase(file.getFileName().toString()) || !Files.isRegularFile(file, LinkOption.NOFOLLOW_LINKS) || Files.isSymbolicLink(file)) throw new IOException("Выберите существующий обычный client.cfg.");
        if (ProcessHandle.allProcesses().anyMatch(p -> p.info().command().map(c -> c.toLowerCase(Locale.ROOT).endsWith("rustclient.exe")).orElse(false))) throw new IOException("Закройте Rust перед восстановлением.");
        Path backup = file.resolveSibling("client.cfg.bak");
        if (!Files.isRegularFile(backup, LinkOption.NOFOLLOW_LINKS) || Files.isSymbolicLink(backup)) throw new IOException("client.cfg.bak не найден или является ссылкой.");
        Path tmp = Files.createTempFile(file.getParent(), ".rustflow-restore-", ".tmp");
        try {
            Files.copy(backup, tmp, StandardCopyOption.REPLACE_EXISTING);
            Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } finally { Files.deleteIfExists(tmp); }
    }

}
