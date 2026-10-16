/*
 * Where the named parts of a picture in the game's Flash file sit, frame by
 * frame: for windows whose parts the new client lays out itself (the world
 * map's islands). Prints JSON: for each frame, each instance name with its
 * point (x, y, in pixels at the game's size) and its scale.
 *
 *     java -cp <ffdec jars>:<classes> Placements <file.swf> <Class/part/...>
 *
 * Built and run by tools/art/export_ui.py (FFDec's jars from tools/ffdec.sh).
 */

import com.jpexs.decompiler.flash.SWF;
import com.jpexs.decompiler.flash.timeline.DepthState;
import com.jpexs.decompiler.flash.timeline.Frame;
import com.jpexs.decompiler.flash.timeline.Timeline;
import java.io.BufferedInputStream;
import java.io.FileInputStream;
import java.io.InputStream;
import java.util.Locale;

public class Placements {
    public static void main(String[] args) throws Exception {
        System.setProperty("java.awt.headless", "true");
        SWF swf;
        try (InputStream is = new BufferedInputStream(new FileInputStream(args[0]))) {
            swf = new SWF(is, false);
        }
        Timeline timeline = RenderSymbols.find(swf, args[1]).getTimeline();
        StringBuilder json = new StringBuilder("[");
        for (int f = 0; f < timeline.getFrameCount(); f++) {
            Frame frame = timeline.getFrames().get(f);
            json.append(f == 0 ? "\n {" : ",\n {");
            boolean first = true;
            for (DepthState layer : frame.layers.values()) {
                if (layer.instanceName == null || layer.instanceName.isEmpty()) {
                    continue;
                }
                double x = 0, y = 0, sx = 1, sy = 1;
                if (layer.matrix != null) {
                    x = layer.matrix.translateX / (double) RenderSymbols.TWIPS;
                    y = layer.matrix.translateY / (double) RenderSymbols.TWIPS;
                    if (layer.matrix.hasScale) {
                        sx = layer.matrix.scaleX;
                        sy = layer.matrix.scaleY;
                    }
                }
                json.append(first ? "" : ", ").append(String.format(Locale.ROOT,
                        "\"%s\": {\"x\": %.2f, \"y\": %.2f, \"sx\": %.3f, \"sy\": %.3f}", layer.instanceName, x, y, sx, sy));
                first = false;
            }
            json.append("}");
        }
        System.out.println(json.append("\n]"));
    }
}
