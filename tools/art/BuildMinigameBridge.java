/* Compiles only our small loader, never the original game's code. */
import com.jpexs.decompiler.flash.SWF;
import com.jpexs.decompiler.flash.abc.avm2.parser.script.ActionScript3Parser;
import com.jpexs.decompiler.flash.configuration.Configuration;
import com.jpexs.decompiler.flash.tags.*;
import com.jpexs.decompiler.flash.types.RECT;
import java.nio.file.*;
import java.io.*;

public class BuildMinigameBridge {
    public static void main(String[] args) throws Exception {
        Configuration.playerLibLocation.set(args[2]);
        SWF swf = new SWF();
        swf.version = 14;
        swf.frameRate = 30;
        swf.frameCount = 1;
        swf.displayRect = new RECT(0, 650 * 20, 0, 500 * 20);
        FileAttributesTag attributes = new FileAttributesTag(swf);
        attributes.actionScript3 = true;
        attributes.useNetwork = true;
        swf.addTag(attributes);
        DoABC2Tag code = new DoABC2Tag(swf);
        code.name = "RiderAdventureBridge";
        swf.addTag(code);
        ActionScript3Parser.compile(Files.readString(Path.of(args[0])), code.getABC(), swf.getAbcIndex(),
            "RiderAdventureBridge.as", 0, 0, false, "RiderAdventureBridge");
        SymbolClassTag document = new SymbolClassTag(swf);
        document.tags.add(0);
        document.names.add("RiderAdventureBridge");
        swf.addTag(document);
        swf.addTag(new ShowFrameTag(swf));
        try (OutputStream out = new FileOutputStream(args[1])) { swf.saveTo(out); }
    }
}
