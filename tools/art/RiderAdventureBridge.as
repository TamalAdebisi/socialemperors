// Our loader for the untouched, shipped SagaOTDC adventure. The parent
// interface is the same one used by the original game's mini-game window.
package {
    import flash.display.MovieClip;
    import flash.display.Loader;
    import flash.events.Event;
    import flash.events.IOErrorEvent;
    import flash.events.KeyboardEvent;
    import flash.external.ExternalInterface;
    import flash.net.URLRequest;
    import flash.system.LoaderContext;
    import flash.system.ApplicationDomain;

    public class RiderAdventureBridge extends MovieClip {
        public var dragonRiderType:uint;
        private var adventure:MovieClip;
        private var level:uint;
        private var session:String;
        private var frames:uint = 0;

        public function RiderAdventureBridge() {
            dragonRiderType = uint(loaderInfo.parameters.rider);
            level = uint(loaderInfo.parameters.level);
            session = String(loaderInfo.parameters.session);
            var loader:Loader = new Loader();
            loader.contentLoaderInfo.addEventListener(Event.COMPLETE, loaded);
            loader.contentLoaderInfo.addEventListener(IOErrorEvent.IO_ERROR, failed);
            loader.load(new URLRequest(loaderInfo.parameters.game), new LoaderContext(false, ApplicationDomain.currentDomain));
            ExternalInterface.addCallback("riderKey", key);
            ExternalInterface.addCallback("riderProgress", progress);
            addEventListener(Event.ENTER_FRAME, tick);
        }

        private function loaded(event:Event):void {
            adventure = MovieClip(event.currentTarget.content);
            addChild(adventure);
            adventure.startLevel(level);
            ExternalInterface.call("seRiderAdventure", "ready", level, session);
        }

        private function failed(event:Event):void {
            ExternalInterface.call("seRiderAdventure", "error", level, session);
        }

        public function levelCompletado(completed:uint):void {
            if (completed == level) ExternalInterface.call("seRiderAdventure", "won", level, session);
        }

        public function levelPerdido(failedLevel:uint):void {
            ExternalInterface.call("seRiderAdventure", "lost", level, session);
        }

        private function key(code:uint, down:Boolean):void {
            (stage.focus != null ? stage.focus : stage).dispatchEvent(new KeyboardEvent(down ? KeyboardEvent.KEY_DOWN : KeyboardEvent.KEY_UP, true, false, 0, code));
        }

        // Read-only state lets accessibility/test hosts observe the actual
        // adventure without changing its health, enemies or outcome.
        private function progress():Object {
            if (adventure == null) return {state:"loading"};
            var screen:Object = adventure.play_screen;
            var hero:Object = screen != null ? screen._CharsArray[0] : null;
            return {
                state:adventure.game_over_screen != null ? "lost" :
                    adventure.congratz_screen != null || adventure.complete_screen != null ? "won" : "playing",
                menuReady:adventure.game_over_screen == null || adventure.game_over_screen.currentFrame >= adventure.game_over_screen.totalFrames,
                distance:screen != null ? screen.x0 : 0,
                x:hero != null ? hero.x : 0,
                y:hero != null ? hero.y : 0,
                enemies:screen != null ? screen._enemiesArray.length : 0,
                distanceToEnemy:screen != null && screen._enemiesArray.length > 0 && hero != null ? screen._enemiesArray[0].x - hero.x : 0,
                frames:frames
            };
        }

        private function tick(event:Event):void { frames++; }
    }
}
