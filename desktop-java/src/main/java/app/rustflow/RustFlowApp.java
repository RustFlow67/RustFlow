package app.rustflow;

import java.lang.management.ManagementFactory;
import java.nio.file.Path;
import java.text.DecimalFormat;
import java.util.Locale;
import java.util.prefs.Preferences;
import javafx.animation.FadeTransition;
import javafx.animation.KeyFrame;
import javafx.animation.KeyValue;
import javafx.animation.ParallelTransition;
import javafx.animation.ScaleTransition;
import javafx.animation.Timeline;
import javafx.application.Application;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.Scene;
import javafx.scene.control.*;
import javafx.scene.effect.ColorAdjust;
import javafx.scene.input.Clipboard;
import javafx.scene.input.ClipboardContent;
import javafx.scene.layout.*;
import javafx.scene.paint.Color;
import javafx.scene.shape.Rectangle;
import javafx.stage.FileChooser;
import javafx.stage.Stage;
import javafx.stage.StageStyle;
import javafx.util.Duration;

public final class RustFlowApp extends Application {
    private final Preferences prefs = Preferences.userNodeForPackage(RustFlowApp.class);
    private final StackPane root = new StackPane();
    private final BorderPane shell = new BorderPane();
    private final VBox content = new VBox(14);
    private final Label cpu = metric("—"), ram = metric("—"), uptime = metric("—"), game = metric("—");
    private final Timeline monitor = new Timeline(new KeyFrame(Duration.seconds(1), e -> updateMetrics()));
    private Stage stage;
    private boolean english;
    private double dragX, dragY;

    private String t(String ru, String en) { return english ? en : ru; }
    @Override public void start(Stage window) {
        stage = window;
        english = "en".equals(prefs.get("language", "ru"));
        stage.initStyle(StageStyle.TRANSPARENT);
        Scene scene = new Scene(root, 1100, 760, Color.TRANSPARENT);
        scene.getStylesheets().add(getClass().getResource("glass.css").toExternalForm());
        stage.setTitle("RustFlow"); stage.setScene(scene); stage.setMinWidth(700); stage.setMinHeight(570);
        stage.setOnCloseRequest(e -> monitor.stop());
        stage.show();
        if (prefs.getBoolean("onboarding", false)) showApp(); else loading();
    }
    private static Label metric(String text) { Label label = new Label(text); label.getStyleClass().add("metric"); return label; }
    private static Label title(String text) { Label label = new Label(text); label.getStyleClass().add("title"); label.setWrapText(true); return label; }
    private static Label note(String text) { Label label = new Label(text); label.getStyleClass().add("subtitle"); label.setWrapText(true); label.setMaxWidth(Double.MAX_VALUE); return label; }
    private static VBox card(Node... nodes) { VBox box = new VBox(8, nodes); box.getStyleClass().add("glass"); return box; }
    private static Button button(String text, Runnable action) { Button b = new Button(text); b.setOnAction(e -> action.run()); return b; }
    private void replace(Node node) {
        root.getChildren().setAll(node); node.setOpacity(0); node.setScaleX(.97); node.setScaleY(.97);
        FadeTransition fade = new FadeTransition(Duration.millis(240), node); fade.setToValue(1);
        ScaleTransition scale = new ScaleTransition(Duration.millis(240), node); scale.setToX(1); scale.setToY(1);
        new ParallelTransition(fade, scale).play();
    }
    private void loading() {
        ProgressBar progress = new ProgressBar(0); progress.setMaxWidth(380); progress.setPrefWidth(380);
        Label percent = note("0%"); progress.progressProperty().addListener((o, a, b) -> percent.setText(Math.round(b.doubleValue() * 100) + "%"));
        VBox welcome = card(title("RustFlow"), note("Liquid Glass · Rust optimization"), progress, percent);
        welcome.setAlignment(Pos.CENTER); welcome.setMaxSize(510, 260);
        StackPane screen = new StackPane(welcome); screen.getStyleClass().add("shell"); root.getChildren().setAll(screen);
        Timeline timeline = new Timeline(new KeyFrame(Duration.seconds(1.1), new KeyValue(progress.progressProperty(), 1)));
        timeline.setOnFinished(e -> onboarding()); timeline.play();
    }
    private void onboarding() {
        ComboBox<String> language = new ComboBox<>(); language.getItems().addAll("Русский", "English"); language.getSelectionModel().select(english ? 1 : 0);
        Label heading = title(t("Настройте RustFlow", "Set up RustFlow"));
        Label policy = note(t("Настройки хранятся локально. Данные о ПК не отправляются приложением в сеть. Изменения файлов происходят только после вашего подтверждения.", "Settings stay on this device. This app does not send PC data over the network. Files are changed only after your confirmation."));
        CheckBox accept = new CheckBox(t("Я принимаю условия использования и политику конфиденциальности", "I accept the terms and privacy policy"));
        Button next = button("→", () -> { prefs.put("language", english ? "en" : "ru"); prefs.putBoolean("onboarding", true); showApp(); });
        next.getStyleClass().add("primary"); next.disableProperty().bind(accept.selectedProperty().not());
        language.valueProperty().addListener((o, a, b) -> { english = "English".equals(b); heading.setText(t("Настройте RustFlow", "Set up RustFlow")); policy.setText(t("Настройки хранятся локально. Данные о ПК не отправляются приложением в сеть. Изменения файлов происходят только после вашего подтверждения.", "Settings stay on this device. This app does not send PC data over the network. Files are changed only after your confirmation.")); accept.setText(t("Я принимаю условия использования и политику конфиденциальности", "I accept the terms and privacy policy")); });
        VBox box = card(heading, policy, language, accept, next); box.setMaxSize(560, 360); box.setAlignment(Pos.CENTER_LEFT);
        StackPane page = new StackPane(box); page.getStyleClass().add("shell"); replace(page);
    }
    private HBox titlebar() {
        Label brand = new Label("◈  RustFlow"); brand.setStyle("-fx-font-size: 16px; -fx-font-weight: bold; -fx-text-fill: #ffe3c6;");
        Region space = new Region(); HBox.setHgrow(space, Priority.ALWAYS);
        Button replay = button(t("Обучение", "Onboarding"), () -> { prefs.putBoolean("onboarding", false); monitor.stop(); loading(); });
        Button minimize = button("—", () -> stage.setIconified(true)); Button close = button("×", stage::close);
        HBox bar = new HBox(8, brand, space, replay, minimize, close); bar.setPadding(new Insets(16)); bar.setAlignment(Pos.CENTER_LEFT);
        bar.setOnMousePressed(e -> { dragX = e.getScreenX() - stage.getX(); dragY = e.getScreenY() - stage.getY(); });
        bar.setOnMouseDragged(e -> { stage.setX(e.getScreenX() - dragX); stage.setY(e.getScreenY() - dragY); });
        return bar;
    }
    private void showApp() {
        shell.getStyleClass().setAll("shell"); shell.setTop(titlebar());
        content.setPadding(new Insets(12, 24, 24, 24));
        ScrollPane scroll = new ScrollPane(content); scroll.setFitToWidth(true); scroll.setHbarPolicy(ScrollPane.ScrollBarPolicy.NEVER); shell.setCenter(scroll);
        HBox dock = new HBox(6); dock.setAlignment(Pos.CENTER); dock.setPadding(new Insets(10)); dock.getStyleClass().add("glass");
        addDock(dock, "⌂", t("ПК", "PC"), this::home);
        addDock(dock, "◉", t("Графика", "Graphics"), this::graphics);
        addDock(dock, "☷", t("Твикер", "Tweaks"), this::tweaks);
        addDock(dock, "⊞", "Windows", this::windows);
        addDock(dock, "◐", t("Фильтры", "Filters"), this::filters);
        addDock(dock, "⊞", t("Знания", "Knowledge"), this::knowledge);
        HBox wrap = new HBox(dock); wrap.setPadding(new Insets(8, 12, 16, 12)); wrap.setAlignment(Pos.CENTER); shell.setBottom(wrap);
        replace(shell); home(); monitor.setCycleCount(Timeline.INDEFINITE); updateMetrics(); monitor.play();
    }
    private void addDock(HBox dock, String icon, String label, Runnable action) {
        Button b = button(icon + "  " + label, action); b.setTooltip(new Tooltip(label));
        b.setOnMouseEntered(e -> animateScale(b, 1.07)); b.setOnMouseExited(e -> animateScale(b, 1)); dock.getChildren().add(b);
    }
    private void animateScale(Node node, double to) { ScaleTransition st = new ScaleTransition(Duration.millis(150), node); st.setToX(to); st.setToY(to); st.play(); }
    private void home() {
        FlowPane grid = new FlowPane(12, 12); grid.getChildren().addAll(card(note("CPU · " + t("загрузка", "load")), cpu), card(note("RAM"), ram), card(note(t("Время работы системы", "System uptime")), uptime), card(note("RustClient.exe"), game));
        content.getChildren().setAll(title(t("Ваш компьютер", "Your PC")), note(t("Обновление раз в секунду. Недоступные датчики не заменяются вымышленными значениями.", "Updates once per second. Unavailable sensors are not guessed.")), grid,
            card(note("GPU / VRAM · " + t("недоступно в этой сборке", "not available in this build")), note(t("Частота CPU, температура и диск: датчики не подключены.", "CPU frequency, temperature and disk sensors are not connected."))));
    }
    private void updateMetrics() {
        try {
            java.lang.management.OperatingSystemMXBean os = ManagementFactory.getOperatingSystemMXBean();
            if (os instanceof com.sun.management.OperatingSystemMXBean bean) {
                double load = bean.getCpuLoad(); cpu.setText(load < 0 ? "—" : String.format(Locale.ROOT, "%.0f%%", load * 100));
                long total = bean.getTotalMemorySize(), free = bean.getFreeMemorySize();
                ram.setText(total <= 0 ? "—" : new DecimalFormat("0.0").format((total-free)/1073741824.0) + " / " + new DecimalFormat("0.0").format(total/1073741824.0) + " GB");
            }
            // JVM uptime is not system uptime; use the OS process uptime only where exposed.
            uptime.setText(t("Нет данных", "Unavailable"));
            boolean running = ProcessHandle.allProcesses().anyMatch(p -> p.info().command().map(c -> c.toLowerCase(Locale.ROOT).endsWith("rustclient.exe")).orElse(false));
            game.setText(running ? t("Запущен", "Running") : t("Не обнаружен", "Not detected"));
        } catch (RuntimeException ex) { cpu.setText("—"); ram.setText("—"); game.setText("—"); }
    }
    private void graphics() {
        ComboBox<String> choices = new ComboBox<>(); choices.getItems().addAll("Комбат / Combat", "Баланс / Balanced", "Качество / Quality", "Potato"); choices.getSelectionModel().select(0);
        Label path = note(t("Файл не выбран", "No file selected")); final Path[] selected = {null};
        Button choose = button(t("Выбрать client.cfg", "Choose client.cfg"), () -> {
            FileChooser chooser = new FileChooser(); chooser.setTitle("client.cfg"); java.io.File f = chooser.showOpenDialog(stage);
            if (f != null) { selected[0] = f.toPath(); path.setText(selected[0].toString()); }
        });
        Button apply = button(t("Обновить графику", "Update graphics"), () -> {
            if (selected[0] == null) { alert(Alert.AlertType.WARNING, t("Выберите файл.", "Select a file.")); return; }
            Alert confirmation = new Alert(Alert.AlertType.CONFIRMATION, t("Закройте Rust. Будет создан client.cfg.bak; бинды, FOV, звук, HUD и сеть останутся без изменений. Продолжить?", "Close Rust. A client.cfg.bak will be created; binds, FOV, audio, HUD and network remain unchanged. Continue?"), ButtonType.OK, ButtonType.CANCEL);
            confirmation.initOwner(stage); if (confirmation.showAndWait().orElse(ButtonType.CANCEL) != ButtonType.OK) return;
            String id = new String[]{"competitive", "balanced", "quality", "potato"}[choices.getSelectionModel().getSelectedIndex()];
            try { ConfigEditor.apply(selected[0], ConfigEditor.preset(id)); alert(Alert.AlertType.INFORMATION, t("Сохранено. Резервная копия: client.cfg.bak", "Saved. Backup: client.cfg.bak")); }
            catch (Exception ex) { alert(Alert.AlertType.ERROR, t("Изменение не завершено: ", "Operation failed: ") + ex.getMessage()); }
        }); apply.getStyleClass().add("primary");
        Button restore = button(t("Восстановить из .bak", "Restore from .bak"), () -> {
            if (selected[0] == null) { alert(Alert.AlertType.WARNING, t("Выберите client.cfg.", "Select client.cfg.")); return; }
            Alert confirmation = new Alert(Alert.AlertType.CONFIRMATION, t("Закройте Rust. Вернуть client.cfg.bak и заменить текущий файл?", "Close Rust. Restore client.cfg.bak over the current file?"), ButtonType.OK, ButtonType.CANCEL);
            confirmation.initOwner(stage); if (confirmation.showAndWait().orElse(ButtonType.CANCEL) != ButtonType.OK) return;
            try { ConfigEditor.restore(selected[0]); alert(Alert.AlertType.INFORMATION, t("Копия восстановлена.", "Backup restored.")); }
            catch (Exception ex) { alert(Alert.AlertType.ERROR, t("Откат не завершён: ", "Restore failed: ") + ex.getMessage()); }
        });
        content.getChildren().setAll(title(t("Графика Rust", "Rust graphics")), card(note(t("Профили — отправная точка, не гарантия FPS. Команды и диапазоны могут измениться после обновлений игры.", "Profiles are starting points, not FPS guarantees. Commands may change with game updates.")), choices, choose, path, apply, restore, note(t("Если client.cfg.bak уже существует, сначала перенесите его в безопасное место. Откат: закройте игру и верните этот файл как client.cfg.", "If client.cfg.bak already exists, archive it first. To restore, close the game and rename the backup to client.cfg."))));
    }
    private void tweaks() {
        content.getChildren().setAll(title(t("Твикер", "Tweaks")), card(note(t("В этой версии системные твики не применяются автоматически. Game Bar, питание и мышь меняйте в настройках Windows, записав прежние значения.", "This build does not apply system tweaks. Change Game Bar, power and mouse settings in Windows after noting their original values.")), note(t("HAGS и сетевые изменения требуют проверки драйверов и перезагрузки; прирост не гарантирован. Не отключайте EAC или защиту Windows.", "HAGS and network changes require driver checks and reboot; gains are not guaranteed. Do not disable EAC or Windows security."))));
    }
    private void windows() {
        content.getChildren().setAll(title(t("Windows · очистка", "Windows · cleanup")), card(note(t("Автоматическое завершение процессов и очистка системной памяти в этой версии отключены: они могут удалить несохранённые данные. Используйте штатную очистку Windows и проверьте список перед удалением.", "Automatic process termination and memory clearing are disabled in this build: they may destroy unsaved data. Use Windows Storage settings and review files before deleting."))));
    }
    private void filters() {
        Rectangle preview = new Rectangle(500, 160, Color.web("#815840")); preview.setArcWidth(22); preview.setArcHeight(22);
        ColorAdjust adjust = new ColorAdjust(); preview.setEffect(adjust);
        Slider saturation = new Slider(-1, 1, 0), brightness = new Slider(-1, 1, 0), contrast = new Slider(-1, 1, 0);
        adjust.saturationProperty().bind(saturation.valueProperty()); adjust.brightnessProperty().bind(brightness.valueProperty()); adjust.contrastProperty().bind(contrast.valueProperty());
        Button reset = button(t("Сброс предпросмотра", "Reset preview"), () -> { saturation.setValue(0); brightness.setValue(0); contrast.setValue(0); });
        content.getChildren().setAll(title(t("Световые фильтры", "Color filters")), card(note(t("Демонстрация цвета в приложении, не изображение Rust. Монитор и игра не изменяются.", "In-app color preview, not a Rust screenshot. Your display and game are not modified.")), preview, note(t("Насыщенность", "Saturation")), saturation, note(t("Яркость", "Brightness")), brightness, note(t("Контраст", "Contrast")), contrast, reset, note(t("Применение гаммы к Windows в этой сборке не реализовано.", "Applying display gamma to Windows is not implemented in this build."))));
    }
    private void knowledge() {
        TextField search = new TextField(); search.setPromptText(t("Поиск по карточкам", "Search cards")); VBox cards = new VBox(10);
        String[][] items = {{"Автобег / Autorun", "bind q forward;sprint", "Изменяет клавишу Q. Сначала сохраните keys.cfg."}, {"Автофарм / Farming", "bind z attack;duck", "Проверьте действие и старую привязку Z."}, {"Боевой журнал / Combat log", "combatlog", "Открывает журнал; не назначает F1 автоматически."}, {"Сохранить конфиг / Save", "writecfg", "Сохраняет настройки клиента."}, {"RF / Rust+", "", "Частоты и работа оповещений зависят от версии игры и сервера. Проверьте на тестовом сервере."}, {"Электрика / Electricity", "", "Разделите питание и сигнал тревоги; проверьте резерв и доступ к переключателю."}, {"Фарм / Farming", "", "Измеряйте выход скрапа и риск на одном маршруте, не рассчитывайте на неизменный баланс."}};
        Runnable render = () -> { cards.getChildren().clear(); String query = search.getText().toLowerCase(Locale.ROOT); for (String[] item : items) if ((item[0] + item[1] + item[2]).toLowerCase(Locale.ROOT).contains(query)) {
            VBox block = card(new Label(item[0]), note(item[2]));
            if (!item[1].isEmpty()) block.getChildren().add(button(t("Копировать: ", "Copy: ") + item[1], () -> { ClipboardContent c = new ClipboardContent(); c.putString(item[1]); Clipboard.getSystemClipboard().setContent(c); }));
            cards.getChildren().add(block);
        }};
        search.textProperty().addListener((o, a, b) -> render.run()); render.run();
        content.getChildren().setAll(title(t("Полезные знания", "Knowledge")), note(t("Команды могут измениться. Проверяйте их в F1 и делайте резервную копию.", "Commands can change. Verify them in F1 and make a backup.")), search, cards);
    }
    private void alert(Alert.AlertType type, String message) { Alert a = new Alert(type, message, ButtonType.OK); a.initOwner(stage); a.showAndWait(); }
    public static void main(String[] args) { launch(args); }
}
