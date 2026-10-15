/*
 * Draws named pictures from a Flash file, each of their frames as a PNG:
 * the game's interface art (resource icons, buttons, the bubble over a
 * ready building), for the new client's windows. tools/art/export_ui.sh runs
 * it; RenderSwf.java does the buildings and units.
 *
 *   java -cp <FFDec jars>:<classes> RenderSymbols <out-folder> <scale> <file.swf> <Name>...
 *
 * A name is a picture's class (icoGoldMC), or a path to a part of one by
 * the names the game's code uses for it (GuiMC/bgBar/storeButton: the Build
 * button in the game bar), or a path ending in "@n" for the picture's n-th
 * layer alone (counting from 1, back to front), for parts the code never
 * names (NewQuestIslandButtonMC@1: the island map's name ribbon), and
 * "*n" after any of these for n frames of it playing, its parts' own
 * animations running too (Construction2x2*140: the scaffold's workers at
 * work, though its own timeline is one frame long). It
 * writes <out-folder>/<Name>-<frame>.png for
 * every frame of every name (a path's "/" as "."), and
 * <out-folder>/<Name>.json: the frames' labels, where each picture's
 * point (0, 0 in Flash) is, in its PNG, and each frame's box as Flash
 * measures it (the game places some pictures by it). The pictures are vector drawings,
 * so they're drawn at `scale` times their size in the game (3 for screens
 * with three pixels to the point), still sharp.
 *
 * Only the Flash file's pictures are read: none of its code is used.
 */

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
import java.awt.image.BufferedImage;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.List;
import javax.imageio.ImageIO;

public class RenderSymbols {

    static final int TWIPS = 20;
    /** Room around each picture, in pixels at scale 1: for glows and outlines drawn past its bounds. */
    static final int PAD = 2;

    public static void main(String[] args) throws Exception {
        if (args.length < 4) {
            System.err.println("usage: RenderSymbols <out-folder> <scale> <file.swf> <Name>...");
            System.exit(2);
        }
        System.setProperty("java.awt.headless", "true");
        File out = new File(args[0]);
        double scale = Double.parseDouble(args[1]);
        SWF swf;
        try (InputStream is = new BufferedInputStream(new FileInputStream(args[2]))) {
            swf = new SWF(is, false);
        }
        out.mkdirs();
        int failed = 0;
        for (int i = 3; i < args.length; i++) {
            String name = args[i];
            try {
                int frames = render(swf, name, scale, out);
                System.out.printf("ok %s: %d frame(s)%n", name, frames);
            } catch (Exception e) {
                failed++;
                System.out.println("FAIL " + name + ": " + e);
            }
        }
        System.exit(failed == 0 ? 0 : 1);
    }

    /** A picture by class, or a part of one by the path of its instance names. */
    static Timelined find(SWF swf, String path) {
        String[] names = path.split("/");
        CharacterTag character = swf.getCharacterByClass(names[0]);
        for (int i = 1; i < names.length && character instanceof Timelined; i++) {
            character = part((Timelined) character, names[i]);
        }
        if (!(character instanceof Timelined)) {
            throw new IllegalArgumentException("no picture called " + path);
        }
        return (Timelined) character;
    }

    /** The picture placed under this instance name, in any frame. */
    static CharacterTag part(Timelined parent, String instanceName) {
        for (Frame frame : parent.getTimeline().getFrames()) {
            for (DepthState layer : frame.layers.values()) {
                if (instanceName.equals(layer.instanceName)) {
                    return layer.getCharacter();
                }
            }
        }
        return null;
    }

    static int render(SWF swf, String path, double scale, File out) throws Exception {
        String name = path.replace('/', '.');
        // "<name>*n": n moments of it playing, a frame apart, its parts' own animations running
        // too (each frame else shows them still, at their first frame). Its timeline stops at its last frame.
        int star = path.lastIndexOf('*');
        int moments = star > 0 ? Integer.parseInt(path.substring(star + 1)) : 0;
        if (star > 0) {
            path = path.substring(0, star);
        }
        int at = path.lastIndexOf('@');
        int only = at > 0 ? Integer.parseInt(path.substring(at + 1)) : 0;
        Timeline timeline = find(swf, at > 0 ? path.substring(0, at) : path).getTimeline();
        if (only == 0) {
            return render(timeline, path, name, scale, out, moments);
        }
        // Keep only the chosen layer in every frame, and put the others back
        // after: another picture of the run may want them.
        List<java.util.TreeMap<Integer, DepthState>> all = new java.util.ArrayList<>();
        for (Frame frame : timeline.getFrames()) {
            all.add(new java.util.TreeMap<>(frame.layers));
            Integer keep = new java.util.ArrayList<>(frame.layers.keySet()).get(only - 1);
            frame.layers.keySet().removeIf(depth -> !depth.equals(keep));
        }
        try {
            return render(timeline, path, name, scale, out, moments);
        } finally {
            for (int f = 0; f < all.size(); f++) {
                timeline.getFrames().get(f).layers.putAll(all.get(f));
            }
        }
    }

    static int render(Timeline timeline, String path, String name, double scale, File out, int moments) throws Exception {
        RECT bounds = timeline.getDisplayRectWithFilters();
        int pad = PAD * TWIPS;
        RECT rect = new RECT(
                Math.floorDiv(bounds.Xmin, TWIPS) * TWIPS - pad,
                Math.floorDiv(bounds.Xmax + TWIPS - 1, TWIPS) * TWIPS + pad,
                Math.floorDiv(bounds.Ymin, TWIPS) * TWIPS - pad,
                Math.floorDiv(bounds.Ymax + TWIPS - 1, TWIPS) * TWIPS + pad);
        int aaScale = Configuration.useMsaaForExport.get() ? Configuration.msaaGridForExport.get() : 1;

        List<Frame> frames = timeline.getFrames();
        StringBuilder labels = new StringBuilder();
        StringBuilder sizes = new StringBuilder();
        int count = moments > 0 ? moments : frames.size();
        for (int f = 0; f < count; f++) {
            int shown = Math.min(f, frames.size() - 1);
            Frame frame = frames.get(shown);
            // Each frame as the game shows it after gotoAndStop: its children at their first frame.
            // Playing, the children are f frames on.
            for (DepthState layer : frame.layers.values()) {
                layer.time = 0;
            }
            int time = moments > 0 ? f : 0;
            BufferedImage image = RenderSwf.straightAlpha(SWF.frameToImageGet(timeline, shown, time, null, 0, rect,
                    new Matrix(), null, null, scale, true, aaScale).getBufferedImage());
            ImageIO.write(image, "png", new File(out, name + "-" + f + ".png"));
            labels.append(f > 0 ? ", " : "").append(RenderSwf.jsonStrings(frame.labels));
            sizes.append(f > 0 ? ", " : "").append(box(boundsAt(timeline, shown, time)));
        }
        String manifest = "{\n"
                + "  \"name\": " + RenderSwf.jsonString(path) + ",\n"
                + "  \"scale\": " + scale + ",\n"
                + "  \"origin\": {\"x\": " + Math.round(-rect.Xmin * scale / TWIPS)
                + ", \"y\": " + Math.round(-rect.Ymin * scale / TWIPS) + "},\n"
                + "  \"labels\": [" + labels + "],\n"
                + "  \"bounds\": [" + sizes + "]\n"
                + "}\n";
        Files.writeString(new File(out, name + ".json").toPath(), manifest, StandardCharsets.UTF_8);
        return count;
    }

    /**
     * The box Flash measures a picture's width and height by, at one moment:
     * each layer's box (a part's own, at its frame then: `time` frames on,
     * from its first), moved by its matrix. Masks don't count. In twips from
     * its point, or null when there's nothing.
     */
    static double[] boundsAt(Timeline timeline, int f, int time) {
        double[] box = null;
        for (DepthState layer : timeline.getFrames().get(f).layers.values()) {
            CharacterTag character = layer.getCharacter();
            if (character == null || layer.clipDepth > -1) {
                continue;
            }
            double[] own = null;
            if (character instanceof Timelined) {
                Timeline inner = ((Timelined) character).getTimeline();
                if (inner.getFrameCount() > 0) {
                    own = boundsAt(inner, (layer.time + time) % inner.getFrameCount(), time);
                }
            } else if (character instanceof BoundedTag) {
                RECT rect = ((BoundedTag) character).getRect();
                if (rect != null && rect.Xmin <= rect.Xmax && rect.Ymin <= rect.Ymax) {
                    own = new double[] {rect.Xmin, rect.Ymin, rect.Xmax, rect.Ymax};
                }
            }
            if (own == null) {
                continue;
            }
            Matrix matrix = layer.matrix == null ? new Matrix() : new Matrix(layer.matrix);
            ExportRectangle moved = matrix.transform(new ExportRectangle(own[0], own[1], own[2], own[3]));
            box = box == null ? new double[] {moved.xMin, moved.yMin, moved.xMax, moved.yMax}
                    : new double[] {Math.min(box[0], moved.xMin), Math.min(box[1], moved.yMin),
                                    Math.max(box[2], moved.xMax), Math.max(box[3], moved.yMax)};
        }
        return box;
    }

    /** A box from boundsAt as JSON, in pixels at the game's size, or null. */
    static String box(double[] box) {
        if (box == null) {
            return "null";
        }
        return String.format(java.util.Locale.ROOT, "{\"x\": %.2f, \"y\": %.2f, \"w\": %.2f, \"h\": %.2f}",
                box[0] / TWIPS, box[1] / TWIPS, (box[2] - box[0]) / TWIPS, (box[3] - box[1]) / TWIPS);
    }
}
