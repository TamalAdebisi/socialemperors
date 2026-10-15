// Render the picture frames of a building or unit SWF into PNG files, for
// tools/art/pack_sheet.py to turn into a sprite sheet. Step 1 of the new game
// client (CLIENT.md): the art, as ordinary image files.
//
// Run by tools/export_art.sh, with FFDec's library on the classpath:
//
//   java -cp <ffdec classes and jars> tools/art/RenderSwf.java <out-root> <file.swf>...
//
// For each SWF it writes <out-root>/<name>/: img_<n>.png and manifest.json.
// "<file.swf>#<Class>" draws that class of a library file instead (the
// projectiles: 05122012_projectiles.swf#ProyectilMC), named after the class.
//
// How the game's art is laid out (measured on all 1,587 files in
// assets/buildingsprites/): each file has one sprite named after the file
// (767_lanzapiedras.swf -> class 767_lanzapiedras). The game jumps to a frame
// of that sprite and stops there:
//   - units: 5 frames per labelled animation (QUIETO idle, ANDAR walk, ATAQUE
//     attack, MUERTE death, PICAR hit, and special moves), one per drawn
//     direction. The frame either shows a picture or holds a child sprite
//     that plays the animation by itself
//   - buildings: usually 2 frames, the two ways a building can face
// So we render every frame of that sprite, and for each one we let its child
// sprites play: "time" t = 0, 1, 2... shows each child at its own frame t.
//
// Every image of one file is drawn on the same canvas, so a single point (the
// origin: where the game positions the item) is at the same pixel in all of
// them. The packer trims the empty space and keeps that point as the anchor.
// Each frame also records its bounds as Flash measures them (transparent
// parts of pictures included): the game places a building by those.
//
// The biggest dragons and gods have thousands of pictures to draw, each on a
// canvas of several million pixels: hours on one processor core. With
// RENDER_THREADS=n in the environment, n threads share an item's frames, each
// with its own copy of the file (FFDec's objects aren't made to be shared).
//
// Only pictures are read here; the game's code is never decompiled or copied.

import com.jpexs.decompiler.flash.SWF;
import com.jpexs.decompiler.flash.configuration.Configuration;
import com.jpexs.decompiler.flash.exporters.commonshape.ExportRectangle;
import com.jpexs.decompiler.flash.exporters.commonshape.Matrix;
import com.jpexs.decompiler.flash.tags.base.BoundedTag;
import com.jpexs.decompiler.flash.tags.base.CharacterTag;
import com.jpexs.decompiler.flash.timeline.DepthState;
import com.jpexs.decompiler.flash.timeline.Frame;
import com.jpexs.decompiler.flash.timeline.Timeline;
import com.jpexs.decompiler.flash.timeline.Timelined;
import com.jpexs.decompiler.flash.types.RECT;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.awt.image.DataBufferInt;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import javax.imageio.ImageIO;

public class RenderSwf {

    static final int TWIPS = 20;          // Flash measures in 1/20 of a pixel
    // Room around the sprite's bounds: a little, or more when something is
    // drawn outside them (a glow on a part inside the sprite) and reaches the edge.
    static final int[] PADS = {4 * TWIPS, 64 * TWIPS, 256 * TWIPS};
    static final int MAX_TIME = 600;      // longest animation we render (20 s at 30 fps)
    static final double ZOOM = 1.0;       // the art's bitmaps are drawn 1:1 (bitmap fill scale 20.0)
    // No item is really this big (the widest, a chained god, is 11,247 pixels).
    // A sprite whose bounds say more has a stray part placed absurdly far
    // away (2099_medieval_slayer: 15 million pixels); its canvas is cut to
    // this much around the origin, where the item is.
    static final int MAX_REACH = 4096 * TWIPS;
    static final int MAX_CANVAS = 20000 * TWIPS;
    static final int THREADS = Math.max(1, parseInt(System.getenv("RENDER_THREADS"), 1));

    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.err.println("usage: RenderSwf <out-root> <file.swf>...");
            System.exit(2);
        }
        System.setProperty("java.awt.headless", "true");
        File outRoot = new File(args[0]);
        int failed = 0;
        for (int i = 1; i < args.length; i++) {
            File swfFile = new File(args[i]);
            try {
                long start = System.currentTimeMillis();
                int images = render(swfFile, outRoot);
                System.out.printf("ok %s: %d images, %.1f s%n", swfFile.getName(), images,
                        (System.currentTimeMillis() - start) / 1000.0);
            } catch (Exception | OutOfMemoryError | StackOverflowError e) {
                failed++;
                System.out.println("FAIL " + swfFile.getName() + ": " + e);
            }
        }
        System.exit(failed == 0 ? 0 : 1);
    }

    static int parseInt(String value, int fallback) {
        try {
            return value == null ? fallback : Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    static SWF load(File swfFile) throws Exception {
        try (InputStream is = new BufferedInputStream(new FileInputStream(swfFile))) {
            return new SWF(is, false);
        }
    }

    static int render(File swfFile, File outRoot) throws Exception {
        String name = swfFile.getName().replaceFirst("\\.swf$", "");
        String chosen = null;
        int hash = swfFile.getPath().lastIndexOf('#');
        if (hash > 0) {
            chosen = swfFile.getPath().substring(hash + 1);
            swfFile = new File(swfFile.getPath().substring(0, hash));
            name = chosen;
        }
        SWF swf = load(swfFile);
        String className = chosen != null ? chosen : findClass(swf, name);
        File out = new File(outRoot, name);
        // One copy of the file per thread; the first is the one already read.
        List<Timeline> timelines = new ArrayList<>();
        timelines.add(((Timelined) swf.getCharacterByClass(className)).getTimeline());
        for (int i = 1; i < THREADS; i++) {
            timelines.add(((Timelined) load(swfFile).getCharacterByClass(className)).getTimeline());
        }
        for (int i = 0; i < PADS.length; i++) {
            int images = draw(swf, swfFile, name, className, timelines, out, PADS[i], i == PADS.length - 1);
            if (images >= 0) {
                return images;
            }
        }
        throw new IllegalStateException("unreachable");
    }

    /**
     * Draws every picture with `pad` of room around the sprite's bounds.
     * Returns how many different pictures there are, or -1 when one reaches
     * the edge of the canvas (and `last` is false): it needs more room.
     * Each timeline (one per thread) draws every n-th frame.
     */
    static int draw(SWF swf, File swfFile, String name, String className, List<Timeline> timelines, File out, int pad, boolean last)
            throws Exception {
        // The canvas: the sprite's bounds over all frames, children included,
        // in whole pixels, with the padding.
        Timeline timeline = timelines.get(0);
        RECT bounds = timeline.getDisplayRectWithFilters();
        if (bounds.Xmax - bounds.Xmin > MAX_CANVAS || bounds.Ymax - bounds.Ymin > MAX_CANVAS) {
            bounds = new RECT(Math.max(bounds.Xmin, -MAX_REACH), Math.min(bounds.Xmax, MAX_REACH),
                    Math.max(bounds.Ymin, -MAX_REACH), Math.min(bounds.Ymax, MAX_REACH));
        }
        RECT rect = new RECT(
                Math.floorDiv(bounds.Xmin, TWIPS) * TWIPS - pad,
                Math.floorDiv(bounds.Xmax + TWIPS - 1, TWIPS) * TWIPS + pad,
                Math.floorDiv(bounds.Ymin, TWIPS) * TWIPS - pad,
                Math.floorDiv(bounds.Ymax + TWIPS - 1, TWIPS) * TWIPS + pad);
        int width = (rect.Xmax - rect.Xmin) / TWIPS;
        int height = (rect.Ymax - rect.Ymin) / TWIPS;

        out.mkdirs();
        for (File old : out.listFiles()) {
            old.delete();
        }

        int aaScale = Configuration.useMsaaForExport.get() ? Configuration.msaaGridForExport.get() : 1;
        // Pictures already written, by a fingerprint of their pixels: an
        // animation often shows the same picture for several frames.
        Map<String, Integer> seen = new ConcurrentHashMap<>();
        AtomicInteger count = new AtomicInteger();
        AtomicBoolean tooSmall = new AtomicBoolean();
        AtomicBoolean capped = new AtomicBoolean();
        int frameCount = timeline.getFrames().size();
        @SuppressWarnings("unchecked")
        List<Integer>[] sequences = new List[frameCount];

        ExecutorService pool = Executors.newFixedThreadPool(timelines.size());
        List<Future<?>> work = new ArrayList<>();
        for (int k = 0; k < timelines.size(); k++) {
            Timeline mine = timelines.get(k);
            int first = k;
            work.add(pool.submit(() -> {
                for (int f = first; f < frameCount && !tooSmall.get(); f += timelines.size()) {
                    sequences[f] = drawFrame(mine, f, rect, aaScale, out, seen, count, last, tooSmall, capped);
                }
                return null;
            }));
        }
        pool.shutdown();
        try {
            for (Future<?> job : work) {
                job.get();
            }
        } catch (java.util.concurrent.ExecutionException e) {
            throw e.getCause() instanceof Exception ? (Exception) e.getCause() : e;
        }
        if (tooSmall.get()) {
            return -1;
        }

        // A chest that fills up as its camp goes (the festivals): its first
        // frame again with the layers named step1, step2... shown one more at
        // a time, from none to all.
        List<Integer> steps = new ArrayList<>();
        List<DepthState> stepLayers = new ArrayList<>();
        collectSteps(timeline, stepLayers, new HashMap<>());
        if (!stepLayers.isEmpty()) {
            int most = 0;
            for (DepthState layer : stepLayers) {
                most = Math.max(most, stepNumber(layer));
            }
            for (int shown = 0; shown <= most; shown++) {
                for (DepthState layer : stepLayers) {
                    layer.isVisible = stepNumber(layer) <= shown;
                }
                List<Integer> picture = drawFrame(timeline, 0, rect, aaScale, out, seen, count, true, tooSmall, capped);
                steps.add(picture.get(0));
            }
            for (DepthState layer : stepLayers) {
                layer.isVisible = true;
            }
        }

        StringBuilder frames = new StringBuilder();
        List<Frame> timelineFrames = timeline.getFrames();
        for (int f = 0; f < frameCount; f++) {
            Frame frame = timelineFrames.get(f);
            if (f > 0) {
                frames.append(",\n");
            }
            frames.append("    {\"labels\": ").append(jsonStrings(frame.labels))
                    .append(", \"bounds\": ").append(bounds(frame))
                    .append(", \"images\": ").append(sequences[f]).append("}");
        }

        String manifest = "{\n"
                + "  \"name\": " + jsonString(name) + ",\n"
                + "  \"swf\": " + jsonString(swfFile.getName()) + ",\n"
                + "  \"class\": " + jsonString(className) + ",\n"
                + "  \"fps\": " + swf.frameRate + ",\n"
                + "  \"zoom\": " + ZOOM + ",\n"
                + "  \"canvas\": {\"w\": " + width + ", \"h\": " + height + "},\n"
                + "  \"origin\": {\"x\": " + (int) Math.round(-rect.Xmin * ZOOM / TWIPS)
                + ", \"y\": " + (int) Math.round(-rect.Ymin * ZOOM / TWIPS) + "},\n"
                + "  \"capped\": " + capped.get() + ",\n"
                + (steps.isEmpty() ? "" : "  \"steps\": " + steps + ",\n")
                + "  \"frames\": [\n" + frames + "\n  ]\n"
                + "}\n";
        Files.writeString(new File(out, "manifest.json").toPath(), manifest, StandardCharsets.UTF_8);
        return seen.size();
    }

    /**
     * Draws one frame of the sprite, letting its children play, and returns
     * the number of the picture shown at each moment. Writes each picture
     * not seen before. Sets `tooSmall` (and stops) when a picture reaches
     * the canvas's edge, unless this is the `last` try.
     */
    static List<Integer> drawFrame(Timeline timeline, int f, RECT rect, int aaScale, File out,
            Map<String, Integer> seen, AtomicInteger count, boolean last, AtomicBoolean tooSmall,
            AtomicBoolean capped) throws Exception {
        Frame frame = timeline.getFrames().get(f);
        // The game jumps to this frame (gotoAndStop), which creates its
        // children afresh, so each starts at its own first frame.
        for (DepthState layer : frame.layers.values()) {
            layer.time = 0;
        }
        int length = 1;
        for (DepthState layer : frame.layers.values()) {
            length = Math.max(length, cycle(layer.getCharacter(), new HashMap<>()));
        }
        if (length > MAX_TIME) {
            length = MAX_TIME;
            capped.set(true);
        }

        List<Integer> sequence = new ArrayList<>();
        for (int t = 0; t < length; t++) {
            if (tooSmall.get()) {
                return sequence;
            }
            BufferedImage rendered = SWF.frameToImageGet(timeline, f, t, null, 0, rect, new Matrix(),
                    null, null, ZOOM, true, aaScale).getBufferedImage();
            BufferedImage image = straightAlpha(rendered);
            int[] data = ((DataBufferInt) image.getRaster().getDataBuffer()).getData();
            if (!last && touchesEdge(data, image.getWidth(), image.getHeight())) {
                tooSmall.set(true);
                return sequence;
            }
            String fingerprint = fingerprint(data);
            Integer number = seen.get(fingerprint);
            if (number == null) {
                // Only one thread writes a given picture, under the number it got.
                int[] mine = {-1};
                number = seen.computeIfAbsent(fingerprint, key -> mine[0] = count.getAndIncrement());
                if (number == mine[0]) {
                    ImageIO.write(image, "png", new File(out, "img_" + number + ".png"));
                }
            }
            sequence.add(number);
        }
        return sequence;
    }

    /** Whether any pixel on the picture's border shows something. */
    static boolean touchesEdge(int[] pixels, int width, int height) {
        for (int x = 0; x < width; x++) {
            if ((pixels[x] >>> 24) != 0 || (pixels[(height - 1) * width + x] >>> 24) != 0) {
                return true;
            }
        }
        for (int y = 0; y < height; y++) {
            if ((pixels[y * width] >>> 24) != 0 || (pixels[y * width + width - 1] >>> 24) != 0) {
                return true;
            }
        }
        return false;
    }

    /** The sprite named after the file, or the only exported one. */
    static String findClass(SWF swf, String name) {
        if (swf.getCharacterByClass(name) instanceof Timelined) {
            return name;
        }
        List<String> candidates = new ArrayList<>();
        for (CharacterTag character : swf.getCharacters(false).values()) {
            for (String className : character.getClassNames()) {
                if (!className.contains("_fla.") && character instanceof Timelined) {
                    candidates.add(className);
                }
            }
        }
        if (candidates.size() != 1) {
            throw new IllegalStateException("no sprite named " + name + "; exported: " + candidates);
        }
        return candidates.get(0);
    }

    /**
     * The frame's box as Flash measures a sprite's width and height: each
     * layer's box, moved by its matrix, all together. In pixels from the
     * origin, as JSON, or null for an empty frame.
     */
    static String bounds(Frame frame) {
        double xMin = Double.MAX_VALUE, yMin = Double.MAX_VALUE;
        double xMax = -Double.MAX_VALUE, yMax = -Double.MAX_VALUE;
        for (DepthState layer : frame.layers.values()) {
            CharacterTag character = layer.getCharacter();
            if (!(character instanceof BoundedTag) || layer.clipDepth > -1) {
                continue;
            }
            RECT rect = ((BoundedTag) character).getRect();
            if (rect == null || rect.Xmin > rect.Xmax || rect.Ymin > rect.Ymax) {
                continue;
            }
            Matrix matrix = layer.matrix == null ? new Matrix() : new Matrix(layer.matrix);
            ExportRectangle box = matrix.transform(new ExportRectangle(rect));
            xMin = Math.min(xMin, box.xMin);
            yMin = Math.min(yMin, box.yMin);
            xMax = Math.max(xMax, box.xMax);
            yMax = Math.max(yMax, box.yMax);
        }
        if (xMin > xMax) {
            return "null";
        }
        return String.format(java.util.Locale.ROOT, "{\"x\": %.2f, \"y\": %.2f, \"w\": %.2f, \"h\": %.2f}",
                xMin / TWIPS, yMin / TWIPS, (xMax - xMin) / TWIPS, (yMax - yMin) / TWIPS);
    }

    /** Every layer named step<n>, in any frame, at any depth of the sprite. */
    static void collectSteps(Timeline timeline, List<DepthState> found, Map<Timeline, Boolean> seen) {
        if (seen.containsKey(timeline)) {
            return;
        }
        seen.put(timeline, true);
        for (Frame frame : timeline.getFrames()) {
            for (DepthState layer : frame.layers.values()) {
                if (stepNumber(layer) > 0) {
                    found.add(layer);
                }
                if (layer.getCharacter() instanceof Timelined) {
                    collectSteps(((Timelined) layer.getCharacter()).getTimeline(), found, seen);
                }
            }
        }
    }

    /** n for a layer named step<n>, else 0. */
    static int stepNumber(DepthState layer) {
        String name = layer.instanceName;
        return name != null && name.matches("step\\d+") ? Integer.parseInt(name.substring(4)) : 0;
    }

    /** How many frames until a character's animation repeats: the longest timeline inside it. */
    static int cycle(CharacterTag character, Map<CharacterTag, Integer> memo) {
        if (!(character instanceof Timelined) || memo.containsKey(character)) {
            return 1;
        }
        memo.put(character, 1);  // guards against a sprite that contains itself
        Timeline timeline = ((Timelined) character).getTimeline();
        int longest = timeline.getFrameCount();
        for (Frame frame : timeline.getFrames()) {
            for (DepthState layer : frame.layers.values()) {
                longest = Math.max(longest, cycle(layer.getCharacter(), memo));
            }
        }
        memo.put(character, longest);
        return longest;
    }

    /** SHA-256 of the pixels: equal for equal pictures, and never in practice for different ones. */
    static String fingerprint(int[] pixels) throws Exception {
        ByteBuffer bytes = ByteBuffer.allocate(pixels.length * 4);
        bytes.asIntBuffer().put(pixels);
        StringBuilder hex = new StringBuilder();
        for (byte b : MessageDigest.getInstance("SHA-256").digest(bytes.array())) {
            hex.append(String.format("%02x", b));
        }
        return hex.toString();
    }

    /** FFDec draws with premultiplied alpha; PNG wants it straight. */
    static BufferedImage straightAlpha(BufferedImage source) {
        BufferedImage image = new BufferedImage(source.getWidth(), source.getHeight(), BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = image.createGraphics();
        g.drawImage(source, 0, 0, null);
        g.dispose();
        return image;
    }

    static String jsonStrings(List<String> values) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < values.size(); i++) {
            sb.append(i > 0 ? ", " : "").append(jsonString(values.get(i)));
        }
        return sb.append("]").toString();
    }

    static String jsonString(String value) {
        StringBuilder sb = new StringBuilder("\"");
        for (char c : value.toCharArray()) {
            if (c == '"' || c == '\\') {
                sb.append('\\').append(c);
            } else if (c < 0x20) {
                sb.append(String.format("\\u%04x", (int) c));
            } else {
                sb.append(c);
            }
        }
        return sb.append('"').toString();
    }
}
