// Render the picture frames of a building or unit SWF into PNG files, for
// tools/art/pack_sheet.py to turn into a sprite sheet. Step 1 of the new game
// client (CLIENT.md): the art, as ordinary image files.
//
// Run by tools/export_art.sh, with FFDec's library on the classpath:
//
//   java -cp <ffdec classes and jars> tools/art/RenderSwf.java <out-root> <file.swf>...
//
// For each SWF it writes <out-root>/<name>/: img_<n>.png and manifest.json.
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
//
// Only pictures are read here; the game's code is never decompiled or copied.

import com.jpexs.decompiler.flash.SWF;
import com.jpexs.decompiler.flash.configuration.Configuration;
import com.jpexs.decompiler.flash.exporters.commonshape.Matrix;
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
import javax.imageio.ImageIO;

public class RenderSwf {

    static final int TWIPS = 20;          // Flash measures in 1/20 of a pixel
    static final int PAD = 4 * TWIPS;     // a little room around the sprite's bounds
    static final int MAX_TIME = 600;      // longest animation we render (20 s at 30 fps)
    static final double ZOOM = 1.0;       // the art's bitmaps are drawn 1:1 (bitmap fill scale 20.0)

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

    static int render(File swfFile, File outRoot) throws Exception {
        String name = swfFile.getName().replaceFirst("\\.swf$", "");
        SWF swf;
        try (InputStream is = new BufferedInputStream(new FileInputStream(swfFile))) {
            swf = new SWF(is, false);
        }
        String className = findClass(swf, name);
        Timeline timeline = ((Timelined) swf.getCharacterByClass(className)).getTimeline();

        // The canvas: the sprite's bounds over all frames, children included,
        // in whole pixels, with a little padding.
        RECT bounds = timeline.getDisplayRectWithFilters();
        RECT rect = new RECT(
                Math.floorDiv(bounds.Xmin, TWIPS) * TWIPS - PAD,
                Math.floorDiv(bounds.Xmax + TWIPS - 1, TWIPS) * TWIPS + PAD,
                Math.floorDiv(bounds.Ymin, TWIPS) * TWIPS - PAD,
                Math.floorDiv(bounds.Ymax + TWIPS - 1, TWIPS) * TWIPS + PAD);

        File out = new File(outRoot, name);
        out.mkdirs();
        for (File old : out.listFiles()) {
            old.delete();
        }

        int aaScale = Configuration.useMsaaForExport.get() ? Configuration.msaaGridForExport.get() : 1;
        // Pictures already written, by a fingerprint of their pixels: an
        // animation often shows the same picture for several frames.
        Map<String, Integer> seen = new HashMap<>();
        StringBuilder frames = new StringBuilder();
        boolean capped = false;
        int width = 0, height = 0;

        List<Frame> timelineFrames = timeline.getFrames();
        for (int f = 0; f < timelineFrames.size(); f++) {
            Frame frame = timelineFrames.get(f);
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
                capped = true;
            }

            List<Integer> sequence = new ArrayList<>();
            for (int t = 0; t < length; t++) {
                BufferedImage rendered = SWF.frameToImageGet(timeline, f, t, null, 0, rect, new Matrix(),
                        null, null, ZOOM, true, aaScale).getBufferedImage();
                BufferedImage image = straightAlpha(rendered);
                width = image.getWidth();
                height = image.getHeight();
                int[] data = ((DataBufferInt) image.getRaster().getDataBuffer()).getData();
                String fingerprint = fingerprint(data);
                Integer number = seen.get(fingerprint);
                if (number == null) {
                    number = seen.size();
                    seen.put(fingerprint, number);
                    ImageIO.write(image, "png", new File(out, "img_" + number + ".png"));
                }
                sequence.add(number);
            }

            if (f > 0) {
                frames.append(",\n");
            }
            frames.append("    {\"labels\": ").append(jsonStrings(frame.labels))
                    .append(", \"images\": ").append(sequence).append("}");
        }

        String manifest = "{\n"
                + "  \"swf\": " + jsonString(swfFile.getName()) + ",\n"
                + "  \"class\": " + jsonString(className) + ",\n"
                + "  \"fps\": " + swf.frameRate + ",\n"
                + "  \"zoom\": " + ZOOM + ",\n"
                + "  \"canvas\": {\"w\": " + width + ", \"h\": " + height + "},\n"
                + "  \"origin\": {\"x\": " + (int) Math.round(-rect.Xmin * ZOOM / TWIPS)
                + ", \"y\": " + (int) Math.round(-rect.Ymin * ZOOM / TWIPS) + "},\n"
                + "  \"capped\": " + capped + ",\n"
                + "  \"frames\": [\n" + frames + "\n  ]\n"
                + "}\n";
        Files.writeString(new File(out, "manifest.json").toPath(), manifest, StandardCharsets.UTF_8);
        return seen.size();
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
