import { domify, classes as domClasses } from "min-dom";
import { Events } from "../../common/EventBusEvents";

export default function Palette(eventBus, canvas) {
  var self = this;

  this._canvas = canvas;

  this.entries = [];

  this._init();

  eventBus.on(Events.TOGGLE_MODE_EVENT, function (context) {
    var active = context.active;

    if (active) {
      domClasses(self.container).remove("hidden");
    } else {
      domClasses(self.container).add("hidden");
    }
  });
}

Palette.prototype._init = function () {
  this.container = domify('<div class="bts-palette hidden"></div>');

  this._canvas.getContainer().appendChild(this.container);
};

Palette.prototype.addEntry = function (entry, index) {
  var childIndex = 0;

  this.entries.forEach(function (entry) {
    if (index >= entry.index) {
      childIndex++;
    }
  });

  this.container.insertBefore(entry, this.container.childNodes[childIndex]);

  this.entries.push({
    entry: entry,
    index: index,
  });
};

Palette.$inject = ["eventBus", "canvas"];
