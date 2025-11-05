import PopupMenuModule from "diagram-js/lib/features/popup-menu";

import ReplaceMenuProvider from "./ReplaceMenuProvider";
import AutoPlaceModule from "../auto-place";

export default {
  __depends__: [PopupMenuModule, AutoPlaceModule],
  __init__: ["replaceMenuProvider"],
  replaceMenuProvider: ["type", ReplaceMenuProvider],
};
