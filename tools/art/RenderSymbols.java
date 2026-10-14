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
 * button in the game bar). It writes <out-folder>/<Name>-<frame>.png for
 * every frame of every name (a path's "/" as "."), and
 * <out-folder>/<Name>.json: the frames' labels and where each picture's
 * point (0, 0 in Flash) is, in its PNG. The pictures are vector drawings,
 * so they're drawn at `scale` times their size in the game (3 for screens
 * with three pixels to the point), still sharp.
 *
 * Only the Flash file's pictures are read: none of its code is used.
 */

import com.jpexs.decompiler.flash.SWF;
import com.jpexs.decompiler.flash.configuration.Configuration;
import com.jpexs.decompiler.flash.exporters.commonshape.Matrix;
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
        Timeline timeline = find(swf, path).getTimeline();
        String name = path.replace('/', '.');
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
        for (int f = 0; f < frames.size(); f++) {
            // Each frame as the game shows it after gotoAndStop: its children at their first frame.
            for (DepthState layer : frames.get(f).layers.values()) {
                layer.time = 0;
            }
            BufferedImage image = RenderSwf.straightAlpha(SWF.frameToImageGet(timeline, f, 0, null, 0, rect,
                    new Matrix(), null, null, scale, true, aaScale).getBufferedImage());
            ImageIO.write(image, "png", new File(out, name + "-" + f + ".png"));
            labels.append(f > 0 ? ", " : "").append(RenderSwf.jsonStrings(frames.get(f).labels));
        }
        String manifest = "{\n"
                + "  \"name\": " + RenderSwf.jsonString(path) + ",\n"
                + "  \"scale\": " + scale + ",\n"
                + "  \"origin\": {\"x\": " + Math.round(-rect.Xmin * scale / TWIPS)
                + ", \"y\": " + Math.round(-rect.Ymin * scale / TWIPS) + "},\n"
                + "  \"labels\": [" + labels + "]\n"
                + "}\n";
        Files.writeString(new File(out, name + ".json").toPath(), manifest, StandardCharsets.UTF_8);
        return frames.size();
    }
}
