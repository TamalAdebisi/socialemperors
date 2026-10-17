// Exports the original rider illustrations at their labelled progress steps.
import com.jpexs.decompiler.flash.SWF;
import com.jpexs.decompiler.flash.exporters.commonshape.Matrix;
import com.jpexs.decompiler.flash.timeline.*;
import java.io.*;
import javax.imageio.ImageIO;

public class RenderRiderProgress {
    public static void main(String[] args) throws Exception {
        try (InputStream input = new FileInputStream(args[0])) {
            SWF swf = new SWF(input, false);
            Timeline timeline = swf.getTimeline();
            new File(args[1]).mkdirs();
            for (int index = 0; index < timeline.getFrames().size(); index++) {
                Frame frame = timeline.getFrames().get(index);
                for (String label : frame.labels) {
                    if (label.matches("level[1-8]")) {
                        var picture = SWF.frameToImageGet(timeline, index, 0, null, 0, swf.displayRect,
                            new Matrix(), null, null, 1, true, 1).getBufferedImage();
                        ImageIO.write(RenderSwf.straightAlpha(picture), "png", new File(args[1], label + ".png"));
                    }
                }
            }
        }
    }
}
