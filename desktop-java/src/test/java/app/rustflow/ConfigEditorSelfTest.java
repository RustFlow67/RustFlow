package app.rustflow;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
public final class ConfigEditorSelfTest {
    public static void main(String[] args) throws Exception {
        String input = "\ufeff// header\r\nbind q forward;sprint\r\ninput.sensitivity \"0.5\"\r\naudio.master \"0.8\"\r\ngraphics.fov \"90\"\r\nhud.visible \"true\"\r\nlerp.smoothing \"0.2\"\r\ngraphics.drawdistance \"2500\" // test\r\n";
        String output = ConfigEditor.merge(input, Map.of("graphics.drawdistance", "1200", "graphics.fov", "60", "gc.buffer", "4096"));
        if (!output.equals(input.replace("graphics.drawdistance \"2500\"", "graphics.drawdistance \"1200\""))) throw new AssertionError(output);
        Path dir = Files.createTempDirectory("rustflow-test"); Path cfg = dir.resolve("client.cfg"), backup = dir.resolve("client.cfg.bak");
        try {
            Files.writeString(cfg, input, StandardCharsets.UTF_8);
            ConfigEditor.apply(cfg, Map.of("graphics.drawdistance", "1200"));
            if (!Files.readString(cfg).equals(output) || !Files.readString(backup).equals(input)) throw new AssertionError("Config or backup mismatch");
            try { ConfigEditor.apply(cfg, Map.of("graphics.drawdistance", "800")); throw new AssertionError("Existing backup should block the operation"); }
            catch (java.nio.file.FileAlreadyExistsException expected) { /* no overwrite */ }
            if (!Files.readString(cfg).equals(output)) throw new AssertionError("Rejected operation changed config");
            ConfigEditor.restore(cfg);
            if (!Files.readString(cfg).equals(input) || !Files.readString(backup).equals(input)) throw new AssertionError("Restore failed");
        } finally { Files.deleteIfExists(cfg); Files.deleteIfExists(backup); Files.deleteIfExists(dir); }
        System.out.println("ConfigEditorSelfTest passed");
    }
}
